import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PERSON_COLS, type PersonLite } from "@/core/people";
import { isPlus } from "@/core/plan";
import type { Dict } from "@/core/i18n";
import type { MsgImage } from "@/core/contracts/messages";
import type { GroupEvent, GroupMember, GroupReplyRef, GroupRole, GroupSys, GroupTitleRef, MsgGroupConversation } from "@/core/contracts/groups";

/**
 * ====== القروبات — ما يُقرأ للصندوق (الهجرة ٢٠٥) ======
 *
 * 🔑 **بجلسة القارئ** والسياساتُ هي الحَكَم: لا يعود إلّا قروبٌ أنت فيه، ورسائلُه منذ دخلتَه. لا خدمةَ ولا دالّة تلتفّ.
 * 🔑 **قبل الهجرة** الجداولُ غائبة: الخطأُ يُبتلع فيعود الصندوقُ بلا قروبات كما كان — فنشرُ الواجهة قبل الهجرة لا يكسر شيئاً.
 * 🔑 **✓✓ من «آخر قراءة» لكلِّ عضو**: رسالتي مقروءةٌ للكلّ متى قرأها كلُّ من كان عضواً حين أُرسلت.
 */

/** عمرُ الرابط المؤقّت — كصور الخاص (`DM_IMAGE_URL_TTL`) */
const URL_TTL = 6 * 3600;
/** أحدثُ الرسائل عبر القروبات كلِّها — كحدّ الخاص */
const MAX_ROWS = 2000;
const SNIPPET = 140;

type GroupRow = { id: string; name: string; photo_path: string | null; last_at: string };
type MemberRow = { group_id: string; user_id: string; role: GroupRole; joined_at: string; last_read_at: string; muted: boolean };
type MsgRow = {
  id: string;
  group_id: string;
  sender_id: string | null;
  kind: "text" | "system";
  body: string;
  gif_id: string | null;
  image_path: string | null;
  reply_to: string | null;
  sys: GroupSys | null;
  sys_target: string | null;
  created_at: string;
  /* 🆕 D-1435 — الهجرة ٢٠٧ (قبلها غائبة) */
  tmdb_id?: number | null;
  media_type?: "tv" | "movie" | null;
  title?: string | null;
  poster_path?: string | null;
  /* 🆕 D-1441 — الهجرة ٢٠٨ (قبلها غائب) */
  deleted_at?: string | null;
};

const MSG_COLS_205 = "id, group_id, sender_id, kind, body, gif_id, image_path, reply_to, sys, sys_target, created_at";
/**
 * 🆕 D-1435 — أعمدةُ العمل من الهجرة ٢٠٧. **الواجهةُ قد تُنشر قبل الهجرة**: عمودٌ غائبٌ (`42703`) يعيد القراءةَ بأعمدة ٢٠٥
 * فتبقى القروباتُ كما كانت — بدونه كان الخطأُ يُبتلع فيعود الصندوقُ بلا قروباتٍ أصلاً.
 */
const MSG_COLS_207 = `${MSG_COLS_205}, tmdb_id, media_type, title, poster_path`;
/** 🆕 D-1441 — `deleted_at` من الهجرة ٢٠٨، والقراءةُ تنزل درجةً درجةً قبلها (`42703`) كما نزلت ٢٠٧ */
const MSG_COLS = `${MSG_COLS_207}, deleted_at`;
const titleOf = (m: MsgRow): GroupTitleRef | null =>
  m.tmdb_id && (m.media_type === "tv" || m.media_type === "movie") ? { media_type: m.media_type, tmdb_id: m.tmdb_id, title: m.title ?? null, poster_path: m.poster_path ?? null } : null;

export async function getGroups(): Promise<{ groups: MsgGroupConversation[]; canCreate: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { groups: [], canCreate: false };
    const me = user.id;

    const [{ data: mine, error }, { data: prof }] = await Promise.all([
      supabase.from("dm_group_members").select("group_id, user_id, role, joined_at, last_read_at, muted").eq("user_id", me),
      supabase.from("profiles").select("plan, plus_until").eq("id", me).maybeSingle(),
    ]);
    const canCreate = isPlus(prof as { plan?: string | null; plus_until?: string | null } | null);
    if (error || !mine?.length) return { groups: [], canCreate };
    const ids = (mine as MemberRow[]).map((m) => m.group_id);

    const readMsgs = (cols: string) => supabase.from("dm_group_messages").select(cols).in("group_id", ids).order("created_at", { ascending: false }).limit(MAX_ROWS);
    const [{ data: gRows }, { data: mRows }, first, { data: hidRows }] = await Promise.all([
      supabase.from("dm_groups").select("id, name, photo_path, last_at").in("id", ids),
      supabase.from("dm_group_members").select("group_id, user_id, role, joined_at, last_read_at, muted").in("group_id", ids),
      readMsgs(MSG_COLS),
      /* 🆕 D-1441 — «حذف عندي»: صفوفي وحدي (قبل ٢٠٨ الجدولُ غائبٌ فيعود فارغاً) */
      supabase.from("dm_group_hidden").select("message_id").limit(MAX_ROWS),
    ]);
    let cols = MSG_COLS;
    let msgRows = first.data;
    if (first.error?.code === "42703") {
      for (const c of [MSG_COLS_207, MSG_COLS_205]) {
        const r = await readMsgs(c);
        cols = c;
        msgRows = r.data;
        if (r.error?.code !== "42703") break;
      }
    }
    const hidden = new Set(((hidRows ?? []) as { message_id: string }[]).map((h) => h.message_id));
    const groups = (gRows ?? []) as GroupRow[];
    const members = (mRows ?? []) as MemberRow[];
    const msgs = ((msgRows ?? []) as unknown as MsgRow[]).reverse().filter((m) => !hidden.has(m.id));

    /* الأصولُ المقتبَسةُ الغائبةُ عن الصفحة: طلبٌ واحد، والسياسةُ نفسُها تحكم */
    const byId = new Map(msgs.map((m) => [m.id, m]));
    const missing = [...new Set(msgs.map((m) => m.reply_to).filter((x): x is string => !!x && !byId.has(x)))];
    if (missing.length) {
      const { data } = await supabase.from("dm_group_messages").select(cols).in("id", missing.slice(0, 200));
      for (const m of (data ?? []) as unknown as MsgRow[]) byId.set(m.id, m);
    }

    /* الصورُ وصورُ القروبات في المخزن الخاصّ: رابطٌ مؤقّتٌ لكلٍّ منها بطلبٍ واحد */
    const paths = [
      ...new Set([...[...byId.values()].map((m) => m.image_path), ...groups.map((g) => g.photo_path)].filter((p): p is string => !!p)),
    ];
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await supabase.storage.from("dm-media").createSignedUrls(paths, URL_TTL);
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
    const img = (p: string | null): MsgImage | null => (p && signed.get(p) ? { url: signed.get(p)!, key: p } : null);

    /* كلُّ من يُذكر: الأعضاء، ومن كتب، ومن أُضيف أو حُذف */
    const personIds = new Set<string>(members.map((m) => m.user_id));
    for (const m of byId.values()) {
      if (m.sender_id) personIds.add(m.sender_id);
      if (m.sys_target) personIds.add(m.sys_target);
    }
    const { data: people } = await supabase.from("public_profiles").select(PERSON_COLS).in("id", [...personIds]);
    const peopleById = new Map(((people ?? []) as PersonLite[]).map((p) => [p.id, p]));

    const refOf = (id: string | null): GroupReplyRef | null => {
      if (!id) return null;
      const r = byId.get(id);
      /* 🆕 D-1441 — المحذوفةُ للجميع والمخفيّةُ عندي غائبتان في الاقتباس */
      if (!r || r.deleted_at || hidden.has(id)) return { id, sender_id: null, mine: false, kind: "gone", body: "" };
      const kind = r.image_path ? "image" : r.gif_id ? "gif" : "text";
      /* 🆕 D-1435 — اقتباسُ بطاقة عمل: اسمُ العمل نصُّه (والتعليقُ بعده) — يُقرأ في كلِّ نسخةٍ بلا نوعٍ جديد */
      const t = titleOf(r);
      const text = t ? [t.title ?? "", r.body].map((x) => x.trim()).filter(Boolean).join(" · ") : r.body;
      return {
        id: r.id,
        sender_id: r.sender_id,
        mine: r.sender_id === me,
        kind,
        body: text.replace(/\s+/g, " ").trim().slice(0, SNIPPET),
        ...(r.image_path ? { image: img(r.image_path) } : {}),
        ...(r.gif_id ? { gif_id: r.gif_id } : {}),
      };
    };

    const out: MsgGroupConversation[] = [];
    for (const g of groups) {
      const self = (mine as MemberRow[]).find((m) => m.group_id === g.id);
      if (!self) continue;
      const gm = members.filter((m) => m.group_id === g.id);
      const others = gm.filter((m) => m.user_id !== me);
      const events: GroupEvent[] = [];
      let unread = 0;
      for (const m of msgs) {
        if (m.group_id !== g.id) continue;
        if (m.kind === "system") {
          events.push({ kind: "sys", id: m.id, created_at: m.created_at, sys: m.sys ?? "created", actor_id: m.sender_id, target_id: m.sys_target, text: m.sys === "renamed" ? m.body : null });
          continue;
        }
        const mineMsg = m.sender_id === me;
        if (!mineMsg && !m.deleted_at && m.created_at > self.last_read_at) unread++;
        let read: boolean | undefined;
        let readBy: string[] | undefined;
        if (mineMsg) {
          /* من كان عضواً حين أُرسلت — والقراءةُ آخرُ قراءته */
          const due = others.filter((o) => o.joined_at <= m.created_at);
          readBy = due.filter((o) => o.last_read_at >= m.created_at).map((o) => o.user_id);
          read = due.length > 0 && readBy.length === due.length;
        }
        events.push({
          kind: "msg",
          id: m.id,
          mine: mineMsg,
          sender_id: m.sender_id,
          body: m.body,
          created_at: m.created_at,
          ...(m.gif_id ? { gif_id: m.gif_id } : {}),
          ...(m.image_path ? { image: img(m.image_path) } : {}),
          ...(m.reply_to ? { reply: refOf(m.reply_to) } : {}),
          ...(titleOf(m) ? { title: titleOf(m) } : {}),
          ...(mineMsg ? { read, read_by: readBy } : {}),
          ...(m.deleted_at ? { deleted: true } : {}),
        });
      }
      const ordered: GroupMember[] = [...gm]
        .sort((a, b) => (a.role === b.role ? a.joined_at.localeCompare(b.joined_at) : a.role === "admin" ? -1 : 1))
        .map((m) => ({ id: m.user_id, role: m.role }));
      const mentioned = new Set<string>(gm.map((m) => m.user_id));
      for (const e of events) {
        if (e.kind === "msg" && e.sender_id) mentioned.add(e.sender_id);
        if (e.kind === "sys") {
          if (e.actor_id) mentioned.add(e.actor_id);
          if (e.target_id) mentioned.add(e.target_id);
        }
      }
      out.push({
        group_id: g.id,
        name: g.name,
        photo: img(g.photo_path),
        me_role: self.role,
        muted: self.muted,
        members: ordered,
        people: [...mentioned].map((id) => peopleById.get(id)).filter((p): p is PersonLite => !!p),
        events,
        last_at: g.last_at,
        unread,
      });
    }
    out.sort((a, b) => b.last_at.localeCompare(a.last_at));
    return { groups: out, canCreate };
  } catch {
    return { groups: [], canCreate: false };
  }
}

/** رفضُ القاعدة ⇢ مفتاحٌ يُقرأ: لوبز+ · عضوٌ لا يُضاف · القروبُ ممتلئ · مشرفٌ وحدَه */
export function groupErrorKey(e: { code?: string; message?: string; hint?: string } | null): Extract<keyof Dict, `apiGroup${string}`> | null {
  if (!e) return null;
  if (e.hint === "plus") return "apiGroupPlus";
  if (e.hint === "member") return "apiGroupMember";
  if (e.hint === "full") return "apiGroupFull";
  if (e.code === "42501") return "apiGroupForbidden";
  return null;
}
