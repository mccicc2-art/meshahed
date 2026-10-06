import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, hasServiceKey } from "@/lib/supabase/service";
import { getDict, type Dict, type Locale } from "@/core/i18n";
import { PERSON_COLS, type PersonLite } from "@/core/people";
import { curatedName } from "@/core/universes";
import type { SignalKind, SignalRow } from "@/core/signals";
import {
  EPISODE_PUSH_FROM_HOUR,
  PUSH_GROUP_OF,
  episodesPush,
  localDayHour,
  messagePush,
  parseMuted,
  signalPush,
  type PushGroup,
  type PushText,
} from "@/core/push";

/**
 * ====== إشعاراتُ الدفع — الإرسالُ من الخادم عبر خدمة Expo (D-1305) ======
 *
 * 🔑 **فوق الأفعال القائمة لا بجانبها**: الجرسُ يُحسب من الجداول (`my_signals`) ولا صفَّ «إشعار» يُكتب — فلا قادحَ
 * واحداً يُعلَّق عليه. كلُّ فعلٍ يُنتج سطراً في جرسِ غيرك ينادي `notifySignal` بعد نجاح كتابته، والرسالةُ `notifyMessage`.
 *
 * 🔑 **بعد إرسال الردّ** (`after`): صاحبُ الضغطة لا ينتظر Expo، وفشلُ الدفع لا يُفشل فعلَه — **كلُّ ما هنا صامت**.
 *
 * 🔑 **بعميل الخدمة وحدَه**: رموزُ أجهزة المستلم وتفضيلاتُه ليست لجلسة المرسل (الهجرة ١٩٥). والمفتاحُ غائبٌ ⇒ لا
 * يُرسل شيء (لا ارتدادَ إلى الجلسة — كان سيقرأ فراغاً ويبدو سليماً).
 *
 * 🔑 **سجلُّ ما أُرسل** (`push_sent`): إعجابٌ يُسحب ويُعاد، ومتابعةٌ تُلغى وتُعاد، لا يرنّان مرّتين.
 */

const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";
/** قناةُ أندرويد — تُنشأ في التطبيق بالاسم نفسِه (`apps/mobile/src/push.ts`) */
const CHANNEL = "default";

type Device = { token: string; lang: Locale };

async function devicesOf(db: SupabaseClient, userId: string): Promise<Device[]> {
  const { data } = await db.from("device_tokens").select("token, lang").eq("user_id", userId).limit(20);
  return ((data ?? []) as { token: string; lang: string }[]).map((d) => ({ token: d.token, lang: d.lang === "en" ? "en" : "ar" }));
}

async function mutedOf(db: SupabaseClient, userId: string): Promise<PushGroup[]> {
  const { data } = await db.from("push_prefs").select("muted").eq("user_id", userId).maybeSingle();
  return parseMuted((data as { muted?: unknown } | null)?.muted);
}

/** `true` = المفتاحُ جديد (أرسِل). خطأُ التكرار وكلُّ خطأٍ آخر ⇒ لا إرسال: الصمتُ أرخصُ من رنّتين */
async function claim(db: SupabaseClient, key: string): Promise<boolean> {
  const { error } = await db.from("push_sent").insert({ key: key.slice(0, 200) });
  return !error;
}

async function send(db: SupabaseClient, batch: { token: string; text: PushText }[]): Promise<number> {
  if (!batch.length) return 0;
  let sent = 0;
  /* Expo يقبل مئةً في النداء */
  for (let i = 0; i < batch.length; i += 100) {
    const part = batch.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(
          part.map((m) => ({
            to: m.token,
            title: m.text.title,
            body: m.text.body,
            data: m.text.url ? { url: m.text.url } : {},
            sound: "default",
            channelId: CHANNEL,
            priority: "high",
          })),
        ),
      });
      const json = (await res.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } }[] } | null;
      const tickets = Array.isArray(json?.data) ? json.data : [];
      const dead: string[] = [];
      tickets.forEach((tk, n) => {
        if (tk?.status === "ok") sent++;
        /* التطبيقُ حُذف أو الرمزُ دُوِّر: الصفُّ يُنسى فلا يُرسَل إليه ثانيةً */
        else if (tk?.details?.error === "DeviceNotRegistered" && part[n]) dead.push(part[n].token);
      });
      if (dead.length) await db.from("device_tokens").delete().in("token", dead);
    } catch {
      /* شبكة Expo — يسقط هذا الإشعارُ وحدَه */
    }
  }
  return sent;
}

/** القلبُ: مستلمٌ واحد، نوعٌ واحد، ونصٌّ يُبنى بلغة كلِّ جهاز */
async function deliver(input: { to: string; group: PushGroup; dedupe?: string; actorId?: string; build: (t: Dict, lang: Locale) => PushText | null }) {
  if (!hasServiceKey()) return;
  const db = await createServiceClient();
  const devices = await devicesOf(db, input.to);
  if (!devices.length) return;
  if ((await mutedOf(db, input.to)).includes(input.group)) return;
  if (input.actorId) {
    /* من حظرتَه لا يرنّ عندك — الكتابةُ نفسُها تُرفض في أغلب الأفعال، وهذا حزامٌ ثانٍ لما لا يُرفض */
    const { data } = await db.from("blocks").select("blocked_id").match({ blocker_id: input.to, blocked_id: input.actorId }).maybeSingle();
    if (data) return;
  }
  if (input.dedupe && !(await claim(db, input.dedupe))) return;
  const batch: { token: string; text: PushText }[] = [];
  for (const d of devices) {
    const text = input.build(getDict(d.lang), d.lang);
    if (text) batch.push({ token: d.token, text });
  }
  await send(db, batch);
}

async function personOf(db: SupabaseClient, id: string): Promise<PersonLite | null> {
  const { data } = await db.from("public_profiles").select(PERSON_COLS).eq("id", id).maybeSingle();
  return (data as PersonLite | null) ?? null;
}

function quiet(fn: () => Promise<void>) {
  try {
    after(async () => {
      try {
        await fn();
      } catch {
        /* لا شيء — الدفعُ لا يُفشل فعلاً */
      }
    });
  } catch {
    /* خارج طلب (لا `after`) — يسقط */
  }
}

/**
 * سطرٌ جديدٌ في جرس `to` ⇢ دفع. `dedupe` مفتاحُ الحدث (فاعل · مستلم · شيء): بدونه يرنّ كلُّ نداء (الردود).
 * العنوانُ يُقرأ من مكتبة `titleOwner` إن لم يُمرَّر (نصُّ `my_signals`: «العنوان من مكتبتك»)، والقائمةُ من صفّها.
 */
type SignalInput = {
  to: string;
  kind: SignalKind;
  actorId: string;
  tmdbId?: number | null;
  mediaType?: "tv" | "movie" | null;
  title?: string | null;
  titleOwner?: string | null;
  listId?: string | null;
  dedupe?: string;
};

export function notifySignal(input: SignalInput) {
  if (!input.to || input.to === input.actorId) return;
  quiet(() => signalNow(input));
}

async function signalNow(input: SignalInput): Promise<void> {
  if (!input.to || input.to === input.actorId) return;
  {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    const person = await personOf(db, input.actorId);
    if (!person) return;
    let title = input.title ?? null;
    let listSlug: string | null = null;
    if (input.listId) {
      const { data } = await db.from("user_lists").select("name, source_slug, is_public").eq("id", input.listId).maybeSingle();
      const l = data as { name: string | null; source_slug: string | null; is_public: boolean | null } | null;
      /* قائمةٌ خاصّة لا تُنتج سطراً في الجرس أصلاً (`ul.is_public` في `my_signals`) */
      if (!l || !l.is_public) return;
      title = l.name;
      listSlug = l.source_slug;
    } else if (!title && input.tmdbId && input.mediaType) {
      const { data } = await db
        .from("follows")
        .select("title")
        .match({ user_id: input.titleOwner ?? input.to, tmdb_id: input.tmdbId, media_type: input.mediaType })
        .maybeSingle();
      title = (data as { title?: string | null } | null)?.title ?? null;
    }
    const row: SignalRow = {
      kind: input.kind,
      person,
      tmdbId: input.tmdbId ?? null,
      mediaType: input.mediaType ?? null,
      title,
      at: new Date().toISOString(),
      isNew: true,
      listId: input.listId ?? null,
      listSlug,
    };
    await deliver({
      to: input.to,
      group: PUSH_GROUP_OF[input.kind],
      dedupe: input.dedupe,
      actorId: input.actorId,
      build: (t, lang) => signalPush(row, t, curatedName(listSlug, title ?? "", lang), input.to),
    });
  }
}

/** رسالةٌ (عملٌ أو قائمةٌ لصديق، أو ردٌّ في خيطها) ⇢ دفع */
export function notifyMessage(input: { to: string; actorId: string; text: string | null; sharedTitle?: string | null; isList?: boolean }) {
  if (!input.to || input.to === input.actorId) return;
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    const person = await personOf(db, input.actorId);
    if (!person) return;
    await deliver({
      to: input.to,
      group: "messages",
      actorId: input.actorId,
      build: (t) =>
        messagePush(
          {
            senderId: input.actorId,
            senderName: person.hide_name ? t.anonymousUser : person.nickname || person.username || t.anonymousUser,
            text: input.text,
            sharedTitle: input.sharedTitle,
            isList: input.isList,
          },
          t,
        ),
    });
  });
}

/** ردٌّ في خيط مشاركة: الطرفُ الآخر من صفّها (عملٌ أو قائمة) */
export function notifyShareReply(input: { shareId: string; actorId: string; text: string }) {
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    let pair: { sender_id: string; recipient_id: string } | null = null;
    for (const table of ["title_shares", "list_shares"] as const) {
      const { data } = await db.from(table).select("sender_id, recipient_id").eq("id", input.shareId).maybeSingle();
      if (data) {
        pair = data as { sender_id: string; recipient_id: string };
        break;
      }
    }
    if (!pair) return;
    const to = pair.sender_id === input.actorId ? pair.recipient_id : pair.recipient_id === input.actorId ? pair.sender_id : null;
    if (!to) return;
    const person = await personOf(db, input.actorId);
    if (!person) return;
    await deliver({
      to,
      group: "messages",
      actorId: input.actorId,
      build: (t) =>
        messagePush({ senderId: input.actorId, senderName: person.hide_name ? t.anonymousUser : person.nickname || person.username || t.anonymousUser, text: input.text }, t),
    });
  });
}

/**
 * ردٌّ على رأي ⇢ صاحبُ الرأي وصاحبُ الردّ الأب (الحالتان في `my_signals` بنوعٍ واحد) — كلٌّ مرّةً، ولا أحدَ لنفسه.
 * `table`: جدولُ الردود الذي فيه الأب.
 */
export function notifyReply(input: {
  kind: "reply" | "list_reply" | "talk_reply";
  table: "review_replies" | "list_review_replies" | "title_posts";
  actorId: string;
  ownerId?: string | null;
  parentId?: string | null;
  tmdbId?: number | null;
  mediaType?: "tv" | "movie" | null;
  title?: string | null;
  listId?: string | null;
}) {
  quiet(async () => {
    if (!hasServiceKey()) return;
    const db = await createServiceClient();
    const to = new Set<string>();
    if (input.ownerId) to.add(input.ownerId);
    if (input.parentId) {
      const { data } = await db.from(input.table).select("user_id").eq("id", input.parentId).maybeSingle();
      const parent = (data as { user_id?: string } | null)?.user_id;
      if (parent) to.add(parent);
    }
    to.delete(input.actorId);
    for (const id of to) {
      await signalNow({
        to: id,
        kind: input.kind,
        actorId: input.actorId,
        tmdbId: input.tmdbId,
        mediaType: input.mediaType,
        title: input.title,
        /* عنوانُ العمل من مكتبة صاحب الرأي — صاحبُ الردّ الأب قد لا يتابعه */
        titleOwner: input.ownerId ?? id,
        listId: input.listId,
      });
    }
  });
}

/* ================= حلقاتُ اليوم ================= */

/** بوّابةُ الذاكرة: نسخةُ الوظيفة لا تسأل القاعدةَ أكثرَ من مرّةٍ كلَّ عشر دقائق */
let lastTry = 0;
const TRY_EVERY_MS = 10 * 60_000;
/** نافذةُ الدورة: مرّةٌ كلَّ ساعتين مهما كثر المرور */
const WINDOW_HOURS = 2;

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * **«حلقةٌ جديدة اليوم»** — بحركة المرور، بلا cron ولا سرّ (نمطُ D-210): يُنادى في `after` من `me/badges`.
 *
 * 🔑 **موعدُ الحلقة من مكتبات الناس لا من TMDB**: `follows.next_air_date` يُحدَّث لمن فتح التطبيق؛ ومن غاب أسبوعاً
 * موعدُه قديم — وهو بالذات من يُراد إعلامُه. فالسؤالُ «أيُّ مسلسلٍ يُعرض اليوم؟» يُجاب من صفوف الجميع (أحدثُ قارئٍ
 * يكفي)، ثمّ يُبلَّغ كلُّ من يتابعه وله جهاز. صفرُ نداءِ TMDB.
 *
 * 🔑 **اليومُ بمنطقة صاحبه، ولا رنينَ قبل العاشرة** (`EPISODE_PUSH_FROM_HOUR`) — D-1253: الحلقةُ معروضةٌ متى حلّ
 * تاريخُها. ومفتاحٌ في `push_sent` لكلِّ (مستخدم · عمل · يوم): دورةٌ لاحقةٌ لا تعيد ما أُعلن.
 */
export async function runEpisodePush(nowMs = Date.now()): Promise<{ ran: boolean; users: number; sent: number }> {
  const idle = { ran: false, users: 0, sent: 0 };
  if (!hasServiceKey()) return idle;
  if (nowMs - lastTry < TRY_EVERY_MS) return idle;
  lastTry = nowMs;
  const db = await createServiceClient();
  const window = Math.floor(new Date(nowMs).getUTCHours() / WINDOW_HOURS);
  if (!(await claim(db, `job:episodes:${dayOf(nowMs)}:${window}`))) return idle;

  const { data: tok } = await db.from("device_tokens").select("user_id, token, lang").limit(5000);
  const tokens = (tok ?? []) as { user_id: string; token: string; lang: string }[];
  if (!tokens.length) return { ran: true, users: 0, sent: 0 };
  const users = [...new Set(tokens.map((x) => x.user_id))];

  /* ما يُعرض أمس · اليوم · غداً (UTC) — يغطّي كلَّ منطقةٍ زمنيّة */
  const days = [dayOf(nowMs - 86_400_000), dayOf(nowMs), dayOf(nowMs + 86_400_000)];
  const { data: air } = await db.from("follows").select("tmdb_id, next_air_date").eq("media_type", "tv").in("next_air_date", days).limit(10_000);
  const airing = new Map<string, Set<number>>();
  for (const r of (air ?? []) as { tmdb_id: number; next_air_date: string }[]) {
    const set = airing.get(r.next_air_date) ?? new Set<number>();
    set.add(r.tmdb_id);
    airing.set(r.next_air_date, set);
  }
  const ids = [...new Set([...airing.values()].flatMap((s) => [...s]))];
  if (!ids.length) return { ran: true, users: users.length, sent: 0 };

  const muted = new Set<string>();
  const zone = new Map<string, string | null>();
  const mine = new Map<string, { tmdbId: number; title: string }[]>();
  for (let i = 0; i < users.length; i += 200) {
    const part = users.slice(i, i + 200);
    const [prefs, profs, rows] = await Promise.all([
      db.from("push_prefs").select("user_id, muted").in("user_id", part),
      db.from("profiles").select("id, timezone").in("id", part),
      db.from("follows").select("user_id, tmdb_id, title, dropped").eq("media_type", "tv").in("user_id", part).in("tmdb_id", ids.slice(0, 1000)).limit(10_000),
    ]);
    for (const p of (prefs.data ?? []) as { user_id: string; muted: unknown }[]) if (parseMuted(p.muted).includes("episodes")) muted.add(p.user_id);
    for (const p of (profs.data ?? []) as { id: string; timezone: string | null }[]) zone.set(p.id, p.timezone);
    for (const r of (rows.data ?? []) as { user_id: string; tmdb_id: number; title: string; dropped: boolean | null }[]) {
      if (r.dropped) continue;
      const list = mine.get(r.user_id) ?? [];
      list.push({ tmdbId: r.tmdb_id, title: r.title });
      mine.set(r.user_id, list);
    }
  }

  const batch: { token: string; text: PushText }[] = [];
  for (const user of users) {
    if (muted.has(user)) continue;
    const { day, hour } = localDayHour(nowMs, zone.get(user));
    if (hour < EPISODE_PUSH_FROM_HOUR) continue;
    const today = airing.get(day);
    if (!today) continue;
    const fresh: { tmdbId: number; title: string }[] = [];
    for (const s of mine.get(user) ?? []) {
      if (today.has(s.tmdbId) && (await claim(db, `ep:${user}:${s.tmdbId}:${day}`))) fresh.push(s);
    }
    if (!fresh.length) continue;
    for (const d of tokens.filter((x) => x.user_id === user)) {
      const text = episodesPush(fresh, getDict(d.lang === "en" ? "en" : "ar"));
      if (text) batch.push({ token: d.token, text });
    }
  }
  return { ran: true, users: users.length, sent: await send(db, batch) };
}
