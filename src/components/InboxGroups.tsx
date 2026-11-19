"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { KeyboardDock } from "./ui/KeyboardDock";
import { sheetMenuItem, sheetMenuDivider, sheetScroll } from "./ui/controls";
import { buttonClass } from "./ui/Button";
import { ChatBackground } from "./ChatBackground";
import { ChatComposer, uploadChatImage, v1Get, v1Post, type Outgoing } from "./InboxComposer";
import { ConvBubble, MsgDeleteSheet, MsgMenuSheet, MsgShell, canUnsend, deleteMessages } from "./InboxChat";
import { getDict, type Locale } from "@/core/i18n";
import { gifUrl } from "@/core/media";
import { coalescedRefresh } from "@/core/refresh";
import { displayNameOf, type PersonLite } from "@/core/people";
import { type ChatBg } from "@/core/chatBg";
import {
  GROUP_MAX_MEMBERS,
  GROUP_NAME_MAX,
  GROUP_RANK_LEVEL,
  canRemove,
  rankOf,
  rolesFor,
  type GroupCreatePayload,
  type GroupManageBody,
  type GroupMsgEvent,
  type GroupRank,
  type GroupSysEvent,
  type MsgGroupConversation,
} from "@/core/contracts/groups";
import type { ConvEvent } from "@/lib/data";
import { tap } from "@/lib/haptics";
import { copiedToast, flashError } from "@/lib/toast";
import { useChatPoll } from "@/lib/usePoll";

/**
 * ====== 🆕 T397 — القروباتُ في رسائل الويب (الهجرة ٢٠٥) — ما كان في التطبيق وحدَه ======
 *
 * 🔑 **القروبُ صفٌّ في القائمة نفسِها وخيطٌ بالشكل نفسِه** (نهجُ `groups.tsx` في التطبيق): رسالةُ القروب تُحوَّل إلى شكل
 * الرسالة المباشرة (`asBubbleEvent`) فتُرسم بـ`ConvBubble` نفسِها — الوقتُ والعلامةُ والاقتباسُ والصورةُ والـGIF —
 * ويُزاد فوقها اسمُ المرسِل بلونه وصورتُه أوّلَ كلِّ دفعة.
 * 🔑 **القاعدةُ هي الحَكَم** في كلِّ فعل (`dm_group_*`): الواجهةُ تُخفي ما سيُرفض (`canRemove` · `rolesFor`) ولا تقرّر.
 * 🔑 **معلوماتُ القروب تُفتح عند الطلب** (قرار أحمد ١٧ نوفمبر: «ب» لا لوحٌ ثالثٌ دائم) — ورقةٌ من رأس الخيط.
 * ⚖️ **ولا «بحث لوبز» في خانة القروب بعد** (إرسالُ بطاقة عملٍ من البحث، D-1435): البطاقاتُ تُعرض إن أرسلها التطبيق، والإرسالُ
 * من الويب جولةٌ تالية.
 */

type Dict = ReturnType<typeof getDict>;

export function personIn(g: MsgGroupConversation, id: string | null): PersonLite | null {
  return id ? g.people.find((p) => p.id === id) ?? null : null;
}

/** اسمُ شخصٍ في القروب — «أنت» للقارئ */
export function nameIn(g: MsgGroupConversation, id: string | null, meId: string, t: Dict): string {
  if (id && id === meId) return t.grpYou;
  return displayNameOf(personIn(g, id), t.anonymousUser);
}

/** سطرُ النظام بلغة القارئ — نسخةُ `sysLine` في التطبيق */
export function sysLine(e: GroupSysEvent, g: MsgGroupConversation, meId: string, t: Dict): string {
  const a = nameIn(g, e.actor_id, meId, t);
  const b = nameIn(g, e.target_id, meId, t);
  switch (e.sys) {
    case "created":
      return t.grpSysCreated(a);
    case "added":
      return t.grpSysAdded(a, b);
    case "left":
      return t.grpSysLeft(a);
    case "removed":
      return t.grpSysRemoved(a, b);
    case "renamed":
      return t.grpSysRenamed(a, e.text ?? "");
    case "photo":
      return t.grpSysPhoto(a);
    case "role":
      return t.grpSysRole(a, b, e.text ?? "member");
  }
}

/** 🆕 D-1435 — نصُّ رسالة العمل حيث لا بطاقة: «🎬 الاسم · التعليق» */
function titleText(e: GroupMsgEvent): string {
  if (!e.title) return e.body;
  return [`🎬 ${e.title.title ?? ""}`.trim(), e.body.trim()].filter(Boolean).join(" · ");
}

/** سطرُ المعاينة في القائمة: «فلان: النصّ» */
export function groupPreview(g: MsgGroupConversation, meId: string, t: Dict): string {
  const last = g.events[g.events.length - 1];
  if (!last) return "";
  if (last.kind === "sys") return sysLine(last, g, meId, t);
  const who = last.mine ? t.convYou : nameIn(g, last.sender_id, meId, t);
  const what = last.deleted
    ? last.mine
      ? t.msgDeletedMine
      : t.msgDeleted
    : last.gif_id
      ? t.msgGifPreview
      : last.image
        ? last.body
          ? `${t.msgImagePreview} · ${last.body}`
          : t.msgImagePreview
        : last.title
          ? titleText(last)
          : last.body;
  return `${who}: ${what}`;
}

/** رسالةُ القروب بشكل الرسالة المباشرة — لتُرسم بـ`ConvBubble` نفسِها (نسخةُ `asBubbleEvent`) */
function asBubbleEvent(e: GroupMsgEvent): ConvEvent {
  if (e.title)
    return {
      kind: "share",
      id: e.id,
      mine: e.mine,
      tmdb_id: e.title.tmdb_id,
      media_type: e.title.media_type,
      title: e.title.title,
      poster_path: e.title.poster_path,
      note: e.body.trim() || null,
      created_at: e.created_at,
      ...(e.mine && typeof e.read === "boolean" ? { read: e.read } : {}),
    };
  return {
    kind: "reply",
    id: e.id,
    mine: e.mine,
    body: e.body,
    created_at: e.created_at,
    dm: true,
    ...(e.gif_id ? { gif_id: e.gif_id } : {}),
    ...(e.image ? { image: e.image } : {}),
    ...(e.mine && typeof e.read === "boolean" ? { read: e.read } : {}),
    ...(e.deleted ? { deleted: true } : {}),
    ...(e.reply
      ? { reply: { id: e.reply.id, mine: e.reply.mine, kind: e.reply.kind, body: e.reply.body, ...(e.reply.image ? { image: e.reply.image } : {}), ...(e.reply.gif_id ? { gif_id: e.reply.gif_id } : {}) } }
      : {}),
  };
}

/** لونُ اسم المرسِل — ثابتٌ لكلِّ شخص من معرّفه (ألوانُ التطبيق الثمانية) */
const SENDER_COLORS = ["#E0803A", "#2FA36B", "#3D8FD6", "#9B5DE5", "#D6455D", "#14A3A3", "#C9A227", "#E05FA8"];
function senderColor(id: string | null): string {
  if (!id) return SENDER_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[h % SENDER_COLORS.length];
}

function rankLabel(r: GroupRank, t: Dict): string | null {
  return r === "owner" ? t.grpOwner : r === "co_owner" ? t.grpCoOwner : r === "admin" ? t.grpAdmin : null;
}

/** صورةُ القروب: صورتُه إن رُفعت، وإلّا ثلاثةٌ من أعضائه متداخلين (غيرُك أوّلاً) — كالتطبيق */
export function GroupAvatar({ g, meId, size = 44 }: { g: MsgGroupConversation; meId: string; size?: number }) {
  if (g.photo) {
    return (
      <span className="block shrink-0 overflow-hidden rounded-full bg-surface-2" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- رابطٌ مؤقّتٌ من المخزن الخاصّ */}
        <img src={g.photo.url} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  const faces = [...g.members.filter((m) => m.id !== meId), ...g.members.filter((m) => m.id === meId)].slice(0, 3).map((m) => personIn(g, m.id));
  const small = Math.round(size * 0.62);
  const mid = Math.round((size - small) / 2);
  const spots: React.CSSProperties[] =
    faces.length === 1
      ? [{ top: mid, insetInlineStart: mid }]
      : faces.length === 2
        ? [{ top: 0, insetInlineStart: 0 }, { bottom: 0, insetInlineEnd: 0 }]
        : [{ top: 0, insetInlineStart: 0 }, { top: 0, insetInlineEnd: 0 }, { bottom: 0, insetInlineStart: mid }];
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }} aria-hidden>
      {faces.map((p, i) => (
        <span
          key={p?.id ?? i}
          className="absolute grid place-items-center overflow-hidden rounded-full border-[1.5px] border-[color:var(--background)] bg-surface-2 text-muted"
          style={{ width: small, height: small, ...(spots[i] ?? spots[0]) }}
        >
          {p && !p.hide_name && p.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- صورُ الأعضاء صغيرةٌ ومتداخلة
            <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon name="people" size={Math.round(small * 0.45)} />
          )}
        </span>
      ))}
    </span>
  );
}

/** خيطُ قروبٍ واحد — نظيرُ `ConversationView` */
export function GroupView({ g, meId, locale, chatBg }: { g: MsgGroupConversation; meId: string; locale: Locale; chatBg: ChatBg }) {
  const t = getDict(locale);
  const router = useRouter();
  const [events, setEvents] = useState(g.events);
  const [prevServer, setPrevServer] = useState(g.events);
  if (g.events !== prevServer) {
    setPrevServer(g.events);
    setEvents(g.events);
  }
  const idRef = useRef(0);
  const [replyTo, setReplyTo] = useState<GroupMsgEvent | null>(null);
  const [acting, setActing] = useState<GroupMsgEvent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [info, setInfo] = useState<boolean | null>(null);

  /* الفوريّةُ على جدولَي القروب (نهجُ التطبيق في `live.ts`) والاستطلاعُ شبكةُ أمانٍ تحتها */
  useChatPoll(true, ["dm_group_messages", "dm_group_members"]);

  /* يُعلَّم مقروءاً عند الفتح — وكلّما وصل جديدٌ والخيطُ مفتوح */
  useEffect(() => {
    if (g.unread > 0) {
      v1Post(`/api/v1/me/groups/${g.group_id}/manage`, { action: "read" } satisfies GroupManageBody, t)
        .then(() => coalescedRefresh(router))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.unread]);

  /* يُفتح على آخره، وينزل مع الجديد إن كان منّي أو كنتُ قرب القاع (نهجُ الخاص — بلاغ خالد ٦ أكتوبر) */
  const count = events.length;
  const lastMine = (() => {
    const l = events[count - 1];
    return !!l && l.kind === "msg" && l.mine;
  })();
  const seen = useRef(0);
  useEffect(() => {
    const first = seen.current === 0;
    const grew = count > seen.current;
    seen.current = count;
    if (!grew) return;
    const doc = document.documentElement;
    const near = doc.scrollHeight - window.innerHeight - window.scrollY < 240;
    if (first || near || lastMine) window.scrollTo({ top: doc.scrollHeight, behavior: first ? "auto" : "smooth" });
  }, [count, lastMine]);

  async function send(m: Outgoing) {
    const quoted = m.reply_to ? events.find((e): e is GroupMsgEvent => e.kind === "msg" && e.id === m.reply_to) ?? null : null;
    const tmpId = `tmp-${idRef.current++}`;
    setEvents((prev) => [
      ...prev,
      {
        kind: "msg",
        id: tmpId,
        mine: true,
        sender_id: meId,
        body: m.body,
        created_at: new Date().toISOString(),
        ...(m.gif_id ? { gif_id: m.gif_id } : {}),
        ...(m.local ? { image: { url: m.local, key: m.local } } : {}),
        ...(quoted
          ? {
              reply: {
                id: quoted.id,
                sender_id: quoted.sender_id,
                mine: quoted.mine,
                kind: quoted.gif_id ? "gif" : quoted.image ? "image" : "text",
                body: quoted.body,
                ...(quoted.image ? { image: quoted.image } : {}),
                ...(quoted.gif_id ? { gif_id: quoted.gif_id } : {}),
              },
            }
          : {}),
      },
    ]);
    try {
      await v1Post(`/api/v1/me/groups/${g.group_id}`, { body: m.body, gif_id: m.gif_id ?? null, image_path: m.image_path ?? null, reply_to: m.reply_to ?? null }, t);
      coalescedRefresh(router);
    } catch (e) {
      /* A-65 (المدقّق ١٨ نوفمبر) — الفقاعةُ المتفائلةُ تُرفع إن فشل الإرسال: كانت تبقى بساعتها كأنّها أُرسلت حتى يجدّد الخادمُ الخيط.
         نهجُ التطبيق نفسُه (GroupScreen `deliver` يُسقطها عند الفشل) */
      setEvents((prev) => prev.filter((x) => x.id !== tmpId));
      flashError((e as Error).message);
    }
  }

  const act = acting;
  const canReply = !!act && !act.deleted && !act.title && !act.id.startsWith("tmp-");
  const copyText = act && !act.deleted ? (act.title ? titleText(act) : act.body).trim() : "";
  const canDel = !!act && !act.id.startsWith("tmp-");
  const canAll = !!act && canDel && !act.deleted && canUnsend([act]);

  async function runDelete(scope: "me" | "all") {
    const e = acting;
    setDelOpen(false);
    if (!e) return;
    tap(8);
    try {
      const res = await deleteMessages({ scope, items: [{ kind: "group", id: e.id }], group_id: g.group_id }, t);
      if (res.refused.includes(e.id)) {
        flashError(t.apiUnsendWindow);
        return;
      }
      setEvents((prev) =>
        prev.flatMap((x) =>
          x.kind !== "msg" || x.id !== e.id ? [x] : scope === "all" ? [{ ...x, body: "", gif_id: null, image: null, reply: null, title: null, deleted: true }] : [],
        ),
      );
      if (replyTo?.id === e.id) setReplyTo(null);
      coalescedRefresh(router);
    } catch (err) {
      flashError((err as Error).message);
    }
  }

  const replyDraft = replyTo
    ? {
        id: replyTo.id,
        who: replyTo.mine ? t.convYou : nameIn(g, replyTo.sender_id, meId, t),
        line: replyTo.gif_id ? t.msgGifPreview : replyTo.image ? (replyTo.body ? `${t.msgImagePreview} · ${replyTo.body}` : t.msgImagePreview) : replyTo.body,
        thumb: replyTo.image?.url ?? (replyTo.gif_id ? gifUrl(replyTo.gif_id, "small") : null),
      }
    : null;

  return (
    <>
      <ChatBackground bg={chatBg} />
      <div className="relative z-[1] flex flex-col">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[color:var(--divider)] lg:sticky lg:top-0 lg:z-10 lg:-mt-6 lg:pt-6 lg:bg-[color:var(--background)]">
          <Link
            href="/messages"
            aria-label={t.convBackAria}
            className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition lg:hidden"
          >
            <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90" />
          </Link>
          {/* الرأسُ كلُّه بابُ معلومات القروب — تُفتح عند الطلب (قرار «ب») */}
          <button
            type="button"
            onClick={() => {
              tap(6);
              setInfo(true);
            }}
            aria-label={t.grpInfo}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl -my-1 py-1 -ms-1 ps-1 pe-1 text-start hover:bg-surface-2 transition"
          >
            <GroupAvatar g={g} meId={meId} size={34} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="block text-sm font-bold truncate">{g.name}</span>
                {g.muted ? <Icon name="volume-off" size={13} className="shrink-0 text-muted" /> : null}
              </span>
              <span className="block text-12 text-muted truncate">{`${t.grpTag} · ${t.grpMembersCount(g.members.length)}`}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              tap(6);
              setInfo(true);
            }}
            aria-label={t.grpInfo}
            title={t.grpInfo}
            className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
          >
            <Icon name="info" size={17} />
          </button>
        </div>

        <div className="py-4 space-y-1.5">
          {events.map((e, i) => {
            if (e.kind === "sys") {
              return (
                <p key={`s-${e.id}`} className="py-1.5 text-center">
                  <span className="inline-block rounded-full bg-surface-2 px-3 py-1 text-12 text-muted">{sysLine(e, g, meId, t)}</span>
                </p>
              );
            }
            const prev = events[i - 1];
            const runStart = !prev || prev.kind !== "msg" || prev.sender_id !== e.sender_id;
            const sender = personIn(g, e.sender_id);
            const who = nameIn(g, e.sender_id, meId, t);
            const bubble = (
              <MsgShell
                mine={e.mine}
                enabled={!e.id.startsWith("tmp-")}
                label={t.moreMenuTitle}
                onMenu={() => {
                  setActing(e);
                  setMenuOpen(true);
                }}
              >
                <ConvBubble event={asBubbleEvent(e)} t={t} quoteWho={e.reply ? nameIn(g, e.reply.sender_id, meId, t) : ""} />
              </MsgShell>
            );
            if (e.mine) {
              return (
                <div key={e.id} className={`ms-auto max-w-[85%] lg:max-w-[70%] ${runStart ? "pt-1.5" : ""}`}>
                  {bubble}
                </div>
              );
            }
            /* الآخرون: صورتُه واسمُه بلونه أوّلَ الدفعة، وما بعدها يصطفّ تحتها بلا تكرار */
            return (
              <div key={e.id} className={`me-auto flex max-w-[85%] lg:max-w-[70%] items-start gap-2 ${runStart ? "pt-1.5" : ""}`}>
                <span className="w-7 shrink-0">
                  {runStart ? <Avatar src={sender?.hide_name ? null : sender?.avatar_url ?? null} name={who} size={28} alt={t.avatarAlt} /> : null}
                </span>
                <div className="min-w-0">
                  {runStart ? (
                    <span className="mb-0.5 block px-1 text-12 font-bold" style={{ color: senderColor(e.sender_id) }}>
                      {who}
                    </span>
                  ) : null}
                  {bubble}
                </div>
              </div>
            );
          })}
        </div>

        <KeyboardDock spacer={replyTo ? "h-36" : "h-24"}>
          <ChatComposer locale={locale} reply={replyDraft} onCancelReply={() => setReplyTo(null)} onSend={send} />
        </KeyboardDock>
      </div>

      <MsgMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        t={t}
        onReply={
          canReply
            ? () => {
                setMenuOpen(false);
                setReplyTo(act);
              }
            : null
        }
        onCopy={
          copyText
            ? () => {
                setMenuOpen(false);
                navigator.clipboard?.writeText(copyText).then(() => copiedToast(t.msgCopied), () => {});
              }
            : null
        }
        onDelete={
          canDel
            ? () => {
                setMenuOpen(false);
                setDelOpen(true);
              }
            : null
        }
      />
      <MsgDeleteSheet open={delOpen} canAll={canAll} onMe={() => void runDelete("me")} onAll={() => void runDelete("all")} onClose={() => setDelOpen(false)} t={t} />
      {info !== null ? <GroupInfoSheet open={info} onClose={() => setInfo(false)} g={g} meId={meId} locale={locale} /> : null}
    </>
  );
}

type InfoMode = { k: "info" } | { k: "member"; id: string } | { k: "remove"; id: string } | { k: "leave" } | { k: "edit" } | { k: "add" };

/** معلوماتُ القروب — ورقةٌ عند الطلب: الأعضاءُ ورتبُهم، الكتم، الإضافة والتعديل للمشرفين، والخروج */
function GroupInfoSheet({ open, onClose, g, meId, locale }: { open: boolean; onClose: () => void; g: MsgGroupConversation; meId: string; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [mode, setMode] = useState<InfoMode>({ k: "info" });
  const [busy, setBusy] = useState(false);
  /* 🆕 D-1453 — رتبتي: الخادمُ الأحدث يرسل `me_rank`، والأقدمُ `me_role` وحده */
  const myRank: GroupRank = g.me_rank ?? (g.me_role === "admin" ? "admin" : "member");
  const admin = GROUP_RANK_LEVEL[myRank] >= 1;
  const rankIn = (id: string): GroupRank => {
    const m = g.members.find((x) => x.id === id);
    return m ? m.rank ?? rankOf(m.role) : "member";
  };
  const close = () => {
    onClose();
    setMode({ k: "info" });
  };

  async function manage(body: GroupManageBody, after?: () => void) {
    if (busy) return;
    setBusy(true);
    try {
      await v1Post(`/api/v1/me/groups/${g.group_id}/manage`, body, t);
      after?.();
      coalescedRefresh(router);
    } catch (e) {
      flashError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ordered = [...g.members].sort((a, b) => GROUP_RANK_LEVEL[rankIn(b.id)] - GROUP_RANK_LEVEL[rankIn(a.id)]);

  let body: React.ReactNode;
  if (mode.k === "add") {
    body = (
      <PeoplePicker
        locale={locale}
        exclude={g.members.map((m) => m.id)}
        max={GROUP_MAX_MEMBERS - g.members.length}
        cta={t.grpAdd}
        busy={busy}
        onBack={() => setMode({ k: "info" })}
        onDone={(ids) => void manage({ action: "add", member_ids: ids }, () => setMode({ k: "info" }))}
      />
    );
  } else if (mode.k === "edit") {
    body = <EditGroup g={g} meId={meId} locale={locale} busy={busy} onBack={() => setMode({ k: "info" })} onSave={(b) => void manage(b, () => setMode({ k: "info" }))} />;
  } else if (mode.k === "leave" || mode.k === "remove") {
    const leaving = mode.k === "leave";
    const who = mode.k === "remove" ? nameIn(g, mode.id, meId, t) : "";
    body = (
      <div className="p-5">
        <p className="font-bold text-15 mb-1.5">{leaving ? t.grpLeave : t.grpRemove}</p>
        <p className="text-xs text-muted leading-relaxed mb-4">{leaving ? t.grpLeaveConfirm : t.grpRemoveConfirm(who)}</p>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => setMode({ k: "info" })} className={buttonClass({ variant: "ghost", size: "md" })}>
            {t.cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              leaving
                ? void manage({ action: "leave" }, () => {
                    close();
                    router.push("/messages");
                  })
                : void manage({ action: "remove", person_id: (mode as { id: string }).id }, () => setMode({ k: "info" }))
            }
            className={buttonClass({ variant: "danger", size: "md", className: "flex-1" })}
          >
            {leaving ? t.grpLeave : t.grpRemoveAction}
          </button>
        </div>
      </div>
    );
  } else if (mode.k === "member") {
    const id = mode.id;
    const p = personIn(g, id);
    const them = rankIn(id);
    const roles = rolesFor(myRank, them);
    body = (
      <div className="py-3">
        <p className="px-5 pb-2 pt-2 text-center text-15 font-bold truncate">{displayNameOf(p, t.anonymousUser)}</p>
        {p?.username && !p.hide_name ? (
          <Link href={`/u/${p.username}`} onClick={close} className={sheetMenuItem}>
            <Icon name="people" size={18} className="text-accent" />
            {t.viewProfileOf(displayNameOf(p, t.anonymousUser))}
          </Link>
        ) : null}
        <Link href={`/messages?with=${id}`} onClick={close} className={sheetMenuItem}>
          <Icon name="chat" size={18} className="text-accent" />
          {t.grpStartChat}
        </Link>
        {roles
          .filter((r): r is "co_owner" | "admin" => r === "co_owner" || r === "admin")
          .map((r) => (
            <button key={r} type="button" disabled={busy} onClick={() => void manage({ action: "role", person_id: id, role: r }, () => setMode({ k: "info" }))} className={sheetMenuItem}>
              <Icon name="shield" size={18} className="text-accent" />
              {r === "co_owner" ? t.grpMakeCoOwner : t.grpMakeAdmin}
            </button>
          ))}
        {roles.includes("member") ? (
          <button type="button" disabled={busy} onClick={() => void manage({ action: "role", person_id: id, role: "member" }, () => setMode({ k: "info" }))} className={sheetMenuItem}>
            <Icon name="shield" size={18} className="text-muted" />
            {them === "co_owner" ? t.grpUnCoOwner : t.grpUnAdmin}
          </button>
        ) : null}
        {canRemove(myRank, them) ? (
          <>
            <div className={sheetMenuDivider} />
            <button type="button" onClick={() => setMode({ k: "remove", id })} className={sheetMenuItem}>
              <Icon name="close" size={18} className="text-[color:var(--error)]" />
              <span className="text-[color:var(--error)]">{t.grpRemove}</span>
            </button>
          </>
        ) : null}
        <button type="button" onClick={() => setMode({ k: "info" })} className={sheetMenuItem}>
          <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90 text-muted" />
          {t.grpCancel}
        </button>
      </div>
    );
  } else {
    const action = (icon: React.ComponentProps<typeof Icon>["name"], label: string, onClick: () => void, enabled = true) => (
      <button
        type="button"
        onClick={onClick}
        disabled={!enabled || busy}
        className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-border px-2 py-3 hover:bg-surface-2 text-12 font-semibold disabled:opacity-40 transition"
      >
        <Icon name={icon} size={18} className="text-accent" />
        {label}
      </button>
    );
    body = (
      <div className={sheetScroll}>
        <div className="flex flex-col items-center gap-1.5 px-5 pt-6 pb-4 text-center">
          <GroupAvatar g={g} meId={meId} size={72} />
          <p id="grp-info-title" className="mt-1 text-lg font-bold">
            {g.name}
          </p>
          <p className="text-12 text-muted">{`${t.grpTag} · ${t.grpMembersCount(g.members.length)}`}</p>
        </div>
        <div className="flex gap-2 px-5 pb-4">
          {action("person-plus", t.grpAdd, () => setMode({ k: "add" }), admin && g.members.length < GROUP_MAX_MEMBERS)}
          {action(g.muted ? "volume" : "volume-off", g.muted ? t.grpUnmute : t.grpMute, () => void manage({ action: "mute", muted: !g.muted }))}
          {action("edit", t.grpEdit, () => setMode({ k: "edit" }), admin)}
        </div>
        <p className="px-5 pb-1 text-12 font-bold text-muted">{`${t.grpMembersTitle} · ${t.grpMembersCount(g.members.length)}`}</p>
        <ul className="px-3">
          {ordered.map((m) => {
            const p = personIn(g, m.id);
            const mine = m.id === meId;
            const rank = rankIn(m.id);
            const label = rankLabel(rank, t);
            const actionable = !mine;
            const row = (
              <>
                <Avatar src={p?.hide_name ? null : p?.avatar_url ?? null} name={displayNameOf(p, t.anonymousUser)} size={38} alt={t.avatarAlt} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{mine ? t.grpYou : displayNameOf(p, t.anonymousUser)}</span>
                {label ? <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-accent">{label}</span> : null}
              </>
            );
            return (
              <li key={m.id}>
                {actionable ? (
                  <button type="button" onClick={() => setMode({ k: "member", id: m.id })} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start hover:bg-surface-2 transition">
                    {row}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-2 py-2">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="px-3 pt-2 pb-4">
          <button type="button" onClick={() => setMode({ k: "leave" })} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-start text-[color:var(--error)] hover:bg-surface-2 transition">
            <Icon name="close" size={18} />
            <span className="text-15 font-bold">{t.grpLeave}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <Sheet open={open} onClose={close} closeLabel={t.closeLabel} variant={mode.k === "leave" || mode.k === "remove" ? "center" : "bottom"} labelledBy="grp-info-title" className="flex flex-col">
      {mode.k !== "info" ? (
        <p id="grp-info-title" className="sr-only">
          {t.grpInfo}
        </p>
      ) : null}
      {body}
    </Sheet>
  );
}

/** تعديلُ القروب للمشرفين: الاسمُ والصورة (تُرفع إلى المخزن الخاصّ كصورة الرسالة) */
function EditGroup({
  g,
  meId,
  locale,
  busy,
  onBack,
  onSave,
}: {
  g: MsgGroupConversation;
  meId: string;
  locale: Locale;
  busy: boolean;
  onBack: () => void;
  onSave: (b: GroupManageBody) => void;
}) {
  const t = getDict(locale);
  const [name, setName] = useState(g.name);
  const [pic, setPic] = useState<{ path: string; url: string } | null>(null);
  const [clear, setClear] = useState(false);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const clean = name.trim();
  const changed = (clean && clean !== g.name) || !!pic || (clear && !!g.photo);

  return (
    <div className="p-5">
      <p className="font-bold text-15 mb-4 text-center">{t.grpEdit}</p>
      <div className="mb-4 flex items-center gap-3">
        <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2">
          {pic ? (
            // eslint-disable-next-line @next/next/no-img-element -- معاينةٌ محلّيّة
            <img src={pic.url} alt="" className="h-full w-full object-cover" />
          ) : g.photo && !clear ? (
            // eslint-disable-next-line @next/next/no-img-element -- رابطٌ مؤقّتٌ من المخزن الخاصّ
            <img src={g.photo.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <GroupAvatar g={{ ...g, photo: null }} meId={meId} size={64} />
          )}
        </span>
        <div className="flex flex-col items-start gap-1">
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setUploading(true);
              try {
                const path = await uploadChatImage(f, t);
                setPic({ path, url: URL.createObjectURL(f) });
                setClear(false);
              } catch (err) {
                flashError((err as Error).message);
              } finally {
                setUploading(false);
              }
            }}
          />
          <button type="button" disabled={uploading || busy} onClick={() => file.current?.click()} className="text-sm font-semibold text-accent disabled:opacity-40">
            {uploading ? "…" : g.photo || pic ? t.grpPhotoChange : t.grpPhotoAdd}
          </button>
          {(g.photo && !clear) || pic ? (
            <button
              type="button"
              onClick={() => {
                setPic(null);
                setClear(true);
              }}
              className="text-12 text-muted hover:text-foreground"
            >
              {t.grpPhotoRemove}
            </button>
          ) : null}
        </div>
      </div>
      <label className="mb-1 block text-12 font-bold text-muted" htmlFor="grp-edit-name">
        {t.grpNameTitle}
      </label>
      <input
        id="grp-edit-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={GROUP_NAME_MAX}
        placeholder={t.grpNamePlaceholder}
        className="mb-4 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base outline-none focus:border-accent"
      />
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={onBack} className={buttonClass({ variant: "ghost", size: "md" })}>
          {t.grpCancel}
        </button>
        <button
          type="button"
          disabled={!changed || !clean || busy || uploading}
          onClick={() =>
            onSave({ action: "edit", name: clean && clean !== g.name ? clean : null, photo_path: pic?.path ?? null, clear_photo: clear && !pic })
          }
          className={buttonClass({ variant: "primary", size: "md", className: "flex-1" })}
        >
          {t.grpSave}
        </button>
      </div>
    </div>
  );
}

type Followed = PersonLite;

/** اختيارُ الأعضاء ممّن تتابعهم (`/api/v1/me/follows?dir=following` — قائمةُ «إنشاء قروب» في التطبيق نفسُها) */
function PeoplePicker({
  locale,
  exclude,
  max,
  cta,
  busy,
  onBack,
  onDone,
}: {
  locale: Locale;
  exclude: string[];
  max: number;
  cta: string;
  busy: boolean;
  onBack: (() => void) | null;
  onDone: (ids: string[]) => void;
}) {
  const t = getDict(locale);
  const [people, setPeople] = useState<Followed[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    /* 🔴 T406 — الظرفُ `{ data }` لا `{ ok }` (`readV1`): كانت القائمةُ تقول «صار خلل» دائماً */
    v1Get<{ people?: Followed[] }>("/api/v1/me/follows?dir=following").then((d) => {
      if (!alive) return;
      if (d) setPeople(d.people ?? []);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    const out = new Set(exclude);
    const needle = q.trim().toLowerCase();
    return (people ?? []).filter(
      (p) => !out.has(p.id) && (!needle || `${p.nickname ?? ""} ${p.username ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [people, exclude, q]);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= max ? prev : [...prev, id]));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label={t.grpCancel} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground">
            <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90" />
          </button>
        ) : null}
        <p id="grp-pick-title" className="min-w-0 flex-1 text-15 font-bold">
          {t.grpPickTitle}
        </p>
        <span className="shrink-0 text-12 text-muted tabular-nums">{t.grpCount(picked.length, max)}</span>
      </div>
      <div className="px-4 pb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.grpSearchFollowing}
          aria-label={t.grpSearchFollowing}
          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base outline-none focus:border-accent"
        />
      </div>
      <div className={`${sheetScroll} px-2`}>
        {people === null && !failed ? (
          <p className="py-10 text-center text-12 text-muted">…</p>
        ) : failed || shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{failed ? t.apiInternal : t.grpNoFollowing}</p>
        ) : (
          <ul>
            {shown.map((p) => {
              const on = picked.includes(p.id);
              const name = displayNameOf(p, t.anonymousUser);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    disabled={!on && picked.length >= max}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start hover:bg-surface-2 disabled:opacity-40 transition"
                  >
                    <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={38} alt={t.avatarAlt} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{name}</span>
                      {p.username && !p.hide_name ? <span className="block truncate text-12 text-muted" dir="ltr">@{p.username}</span> : null}
                    </span>
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${on ? "border-accent bg-accent text-[color:var(--on-accent)]" : "border-border"}`}
                      aria-hidden
                    >
                      {on ? <Icon name="check" size={13} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-[color:var(--divider)] px-4 py-3">
        <button
          type="button"
          disabled={!picked.length || busy}
          onClick={() => onDone(picked)}
          className={buttonClass({ variant: "primary", size: "md", className: "w-full" })}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}

/** «إنشاء قروب» (لوبز+): اختيارُ الأعضاء ثمّ الاسم — ثمّ يُفتح القروبُ الجديد */
export function CreateGroupSheet({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [ids, setIds] = useState<string[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => {
    onClose();
    setIds(null);
    setName("");
  };

  async function create() {
    const clean = name.trim();
    if (!ids?.length || !clean || busy) return;
    setBusy(true);
    try {
      const res = await v1Post<GroupCreatePayload>("/api/v1/me/groups", { name: clean, member_ids: ids }, t);
      close();
      router.push(`/messages?group=${res.group_id}`);
    } catch (e) {
      flashError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} closeLabel={t.closeLabel} variant="bottom" labelledBy="grp-pick-title" className="flex flex-col">
      {ids === null ? (
        /* أنت عضوٌ أصلاً — فالمختارون حتى ١٥ */
        <PeoplePicker locale={locale} exclude={[]} max={GROUP_MAX_MEMBERS - 1} cta={t.grpNext} busy={false} onBack={null} onDone={(x) => setIds(x)} />
      ) : (
        <div className="p-5">
          <p className="mb-4 text-center text-15 font-bold">{t.grpNameTitle}</p>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
            maxLength={GROUP_NAME_MAX}
            placeholder={t.grpNamePlaceholder}
            aria-label={t.grpNameTitle}
            className="mb-4 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setIds(null)} className={buttonClass({ variant: "ghost", size: "md" })}>
              {t.grpCancel}
            </button>
            <button type="button" disabled={!name.trim() || busy} onClick={() => void create()} className={buttonClass({ variant: "primary", size: "md", className: "flex-1" })}>
              {t.grpCreateBtn}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
