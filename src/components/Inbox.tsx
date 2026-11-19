"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountBadges } from "./AccountIdentity";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { getDict, num, type Locale } from "@/core/i18n";
import { gifUrl } from "@/core/media";
import { formatDateShort, timeAgo } from "@/core/when";
import { tap } from "@/lib/haptics";
import { copiedToast, flashError } from "@/lib/toast";
import { coalescedRefresh } from "@/core/refresh";
import { useChatPoll } from "@/lib/usePoll";
import { FeedEmptyCta } from "./FeedEmptyCta";
import { Sheet } from "./ui/Sheet";
import { KeyboardDock } from "./ui/KeyboardDock";
import { sheetMenuItem, sheetMenuDivider } from "./ui/controls";
import { BlockConfirmSheet } from "./BlockConfirmSheet";
import { sendDirectMessage, markConversationRead, hideConversation } from "@/lib/actions";
import { DEFAULT_CHAT_BG, type ChatBg } from "@/core/chatBg";
import { ChatBackground } from "./ChatBackground";
import { ChatComposer, type Outgoing } from "./InboxComposer";
import { ConvBubble, MsgDeleteSheet, MsgMenuSheet, MsgShell, canUnsend, clockOf, deleteMessages, replyLineOf, replyRefOf } from "./InboxChat";
import { webWords } from "./webWords";
import { CreateGroupSheet, GroupAvatar, GroupView, groupPreview } from "./InboxGroups";
import type { MsgDeleteKind } from "@/core/contracts/messages";
import type { MsgGroupConversation } from "@/core/contracts/groups";
import dynamic from "next/dynamic";
/* الورقةُ تُحمَّل عند أوّل فتحٍ لا مع الصفحة (نمطُ TitleSearchSheet في
   الشريط السفليّ): لا تُرسم إلا بضغطةٍ، فشحنُها مع أوّل رسمةٍ ثمنٌ بلا
   قارئ — و`ssr: false` لأن لا HTML لها قبل الضغطة. */
/* 🆕 D-1382 — منتقي الخلفيّة كذلك: لا يُرسم إلا من ⋯ */
const ChatBgSheet = dynamic(() => import("./ChatBgSheet").then((m) => m.ChatBgSheet), { ssr: false });
const StartConversationSheet = dynamic(() => import("./StartConversationSheet").then((m) => m.StartConversationSheet), { ssr: false });
import type { Conversation, ConvEvent, ConvReplyEvent } from "@/lib/data";
import { displayNameOf, type PersonLite } from "@/core/people";

/**
 * تبويب «الرسائل» — محادثةٌ واحدة لكل شخص، كالرسائل الخاصة.
 *
 * كان كل مشاركةٍ خيطاً مستقلاً، فتظهر محادثتان مع الشخص نفسه. الآن كل ما
 * بينك وبين شخصٍ — مشاركاتٌ وردود — في محادثةٍ واحدة مرتّبة زمنياً. مستويان
 * كتويتر: قائمةُ محادثات، والضغط يفتح خيطها (`?with=<id>` في الرابط، فيبقى
 * قابلاً للرجوع والمشاركة ويُرسم على الخادم). والردّ الجديد يُعلَّق بآخر
 * عملٍ شورك، فيبقى شرط «الردّ معلَّقٌ بعمل» قائماً (D-051).
 */
export function Inbox({
  conversations,
  startable,
  openWith,
  openStart = null,
  locale,
  lastSeen = null,
  peer = null,
  canMessage = null,
  chatBg = DEFAULT_CHAT_BG,
  groups = [],
  canCreateGroup = false,
  openGroup = null,
  meId,
  header = null,
}: {
  conversations: Conversation[];
  /** متابَعون متبادلون لا محادثة معهم بعد — منهم تبدأ محادثةٌ جديدة */
  startable: PersonLite[];
  openWith: string | null;
  /** 🆕 11-M · M4 — `?start=<id>`: ورقةُ «ابدأ محادثة» مفتوحةٌ لذلك الشخص (بابُ التطبيق قبل M5 — يبقى لنسخةٍ لم يصلها التحديث) */
  openStart?: string | null;
  locale: Locale;
  /** 🆕 D-765: آخرُ ظهورِ صاحبِ الخيط المفتوح — يُجلب مع الصفحة (`last_seen_of`) */
  lastSeen?: string | null;
  /** 🆕 D-1380 — صاحبُ خيطٍ لم يبدأ بعد (`?with=` بلا محادثة) */
  peer?: PersonLite | null;
  /** 🆕 D-1380 — حكمُ البوّاب على `openWith` (`null` = لم يُحكم) */
  canMessage?: boolean | null;
  /** 🆕 D-1382 — خلفيّةُ الخيط كما تُرسم (`effectiveChatBg`) — واحدةٌ لكلِّ المحادثات */
  chatBg?: ChatBg;
  /** 🆕 T397 — القروباتُ (الهجرة ٢٠٥) من `getGroups` — في القائمة نفسِها بجانب الخاص، مرتّبةً بآخر نشاط */
  groups?: MsgGroupConversation[];
  /** 🆕 T397 — لوبز+: «إنشاء قروب» يفتح الورقة؛ ولغيره يقول لمن هو ويفتح صفحةَ لوبز+ */
  canCreateGroup?: boolean;
  /** 🆕 T397 — `?group=<id>`: القروبُ المفتوح */
  openGroup?: string | null;
  /** معرّفُ القارئ — «أنت» في القروب ومن كتب ماذا */
  meId: string;
  /** 🆕 T397 — ترويسةُ الصفحة (التلميح + التبويبات) تسكن لوحَ القائمة: على الجوال تسقط مع القائمة حين يُفتح خيط (D-767)،
   *  وعلى الحاسوب تبقى فوق القائمة واللوحان معاً */
  header?: React.ReactNode;
}) {
  const t = getDict(locale);
  /* 🆕 11-M · M4 — الورقةُ تُفتح للشخص المطلوب إن كان ممّن يُبدأ معهم فعلاً؛ غيرُه يسقط إلى القائمة بلا ورقة */
  const [startWith, setStartWith] = useState<PersonLite | null>(() =>
    openStart ? startable.find((p) => p.id === openStart) ?? null : null,
  );
  /* 🆕 T397 — ورقةُ «إنشاء قروب» (تُحمَّل أوّلَ فتحٍ وتبقى بعده لتعمل حركةُ الإغلاق) */
  const [createOpen, setCreateOpen] = useState<boolean | null>(null);

  /* **الاسمُ من `displayNameOf` لا من سطرٍ محليّ** (D-193): كان هنا تعريفٌ
     ثانٍ لـ«اسمُ من أخفى اسمه» — نسخةٌ وُلدت لأن الدالّة الأصلية كانت في
     `data.ts` ولا يستوردها مكوّنُ عميل. وقد صارت في `people.ts` النقيّ،
     **فسقط عذرُ النسخة**. وفرقٌ واحد يُقال: من لا نكنيةَ له ولا معرّف كان
     يُرسم «—» وصار «مستخدم» — نفسُ ما تقوله بقيةُ الشاشات عنه. */
  const nameOf = (p: PersonLite | null) => displayNameOf(p, t.anonymousUser);

  /* 🆕 D-1380 — خيطٌ لشخصٍ لا محادثةَ معه بعد: محادثةٌ فارغة تُرسم بخانة كتابة (من ملفّه أو من «ابدأ محادثة») */
  const fresh = openWith ? (peer ?? startable.find((p) => p.id === openWith) ?? null) : null;
  const open =
    (openWith ? conversations.find((c) => c.personId === openWith) : null) ??
    (fresh ? { personId: fresh.id, person: fresh, events: [], lastAt: "", unread: 0, latestShareId: "" } : null);
  const group = !open && openGroup ? groups.find((g) => g.group_id === openGroup) ?? null : null;
  const threadOpen = !!open || !!group;

  /* 🆕 T397 — الخاصُّ والقروباتُ صفوفٌ في قائمةٍ واحدة، الأحدثُ أوّلاً — كما في التطبيق */
  type Row = { k: "dm"; at: string; c: Conversation } | { k: "group"; at: string; g: MsgGroupConversation };
  const rows: Row[] = [
    ...conversations.map((c): Row => ({ k: "dm", at: c.lastAt, c })),
    ...groups.map((g): Row => ({ k: "group", at: g.last_at, g })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  /* **صفُّ البحث ذهب** (طلب أحمد ١١ أغسطس، لقطةٌ مشطوبةٌ بالأحمر): كان
     يفعل شيئين — يُرشّح محادثاتك بالاسم، **ويكشف من تستطيع أن تبدأ معه**.
     والأوّل يسقط بلا خسارة: الوارد قائمةٌ قصيرة عند أكثر الناس، وترشيحُ
     خمسة صفوفٍ حقلٌ لا يستحقّ صدر الشاشة.
     **والثاني لا يسقط، فهو البابُ الوحيد لمحادثةٍ جديدة** — فصار قسمُ
     «ابدأ محادثة» **ظاهراً دائماً** بدل أن ينتظر حرفاً يُكتب.
     **والكلفة تُقال:** من له متابَعون متبادلون كثيرون يرى قائمةً أطول
     أسفل محادثاته. ولم يُقصَّ القسم بسقفٍ صامت — سقفٌ يُخفي أشخاصاً
     ويقول إنه عرض الجميع أسوأ من قائمةٍ طويلة (D-165). */
  const startShown = startable;
  const rowClass = (active: boolean) =>
    `flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl transition ${active ? "bg-surface-2" : "hover:bg-surface-2"}`;

  const list =
    rows.length === 0 && startShown.length === 0 ? (
      /* حالة موجهة (تعميم نمط D-106): الرسائل تحتاج متابعة متبادلة —
         فأول خطوة من الفراغ هي إيجاد الأصدقاء، والزر يفتح ورقة البحث */
      <div>
        <FeedEmptyCta locale={locale} text={t.inboxEmpty} />
      </div>
    ) : (
      <div>
        {rows.length > 0 && (
          <ul className="divide-y divide-[color:var(--divider)]">
            {rows.map((r) => {
              if (r.k === "group") {
                const g = r.g;
                const active = group?.group_id === g.group_id;
                return (
                  <li key={`g-${g.group_id}`}>
                    <Link
                      href={`/messages?group=${g.group_id}`}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      aria-label={t.convOpenAria(g.name)}
                      className={rowClass(active)}
                    >
                      <GroupAvatar g={g} meId={meId} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="flex flex-1 min-w-0 items-center gap-1.5">
                            <span className="text-sm font-semibold truncate min-w-0">{g.name}</span>
                            {g.muted ? <Icon name="volume-off" size={13} className="shrink-0 text-muted" /> : null}
                          </span>
                          <span className="text-12 text-muted shrink-0">{formatDateShort(g.last_at, t)}</span>
                        </span>
                        <span className={`block text-12 truncate ${g.unread > 0 ? "text-foreground font-medium" : "text-muted"}`}>
                          {groupPreview(g, meId, t)}
                        </span>
                      </span>
                      {g.unread > 0 && (
                        <span
                          aria-label={t.communityUnreadAria(g.unread)}
                          className={`shrink-0 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full text-12 font-bold tabular-nums ${
                            g.muted ? "bg-surface-2 text-muted" : "bg-accent text-[color:var(--on-accent)]"
                          }`}
                          dir="ltr"
                        >
                          {num(g.unread, locale)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              }
              const c = r.c;
              const name = nameOf(c.person);
              const last = c.events[c.events.length - 1];
              const preview = previewOf(last, t);
              const active = open?.personId === c.personId;
              return (
                <li key={c.personId}>
                  <Link
                    href={`/messages?with=${c.personId}`}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    aria-label={t.convOpenAria(name)}
                    className={rowClass(active)}
                  >
                    <Avatar src={c.person?.hide_name ? null : c.person?.avatar_url ?? null} name={name} size={44} alt={t.avatarAlt} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="flex flex-1 min-w-0 items-center" style={{ gap: 4 }}>
                          <span className="text-sm font-semibold truncate min-w-0">{name}</span>
                          {c.person?.hide_name ? null : <AccountBadges profile={c.person} t={t} />}
                        </span>
                        <span className="text-12 text-muted shrink-0">{formatDateShort(c.lastAt, t)}</span>
                      </span>
                      <span className={`block text-12 truncate ${c.unread > 0 ? "text-foreground font-medium" : "text-muted"}`}>
                        {preview}
                      </span>
                    </span>
                    {c.unread > 0 && (
                      <span
                        aria-label={t.communityUnreadAria(c.unread)}
                        className="shrink-0 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-12 font-bold tabular-nums"
                        dir="ltr"
                      >
                        {num(c.unread, locale)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* ابدأ محادثة — كلُّ متابَعٍ متبادلٍ لا خيط معه بعد، **ظاهراً دائماً**
            بعد أن ذهب صفُّ البحث الذي كان يكشفهم.
            🆕 D-1380 — الضغطُ يفتح الخيطَ نفسَه بخانة كتابة (كان ورقةَ اختيار عمل — D-051 المنقوضة) */}
        {startShown.length > 0 && (
          <section className="mt-5">
            <p className="text-12 font-semibold text-muted uppercase tracking-wide px-1 mb-1.5">{t.convStartSection}</p>
            <ul className="divide-y divide-[color:var(--divider)]">
              {startShown.map((p) => {
                const name = nameOf(p);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/messages?with=${p.id}`}
                      scroll={false}
                      onClick={() => tap(6)}
                      aria-label={t.convStartRowAria(name)}
                      className={`${rowClass(open?.personId === p.id)} w-full text-start`}
                    >
                      <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={44} alt={t.avatarAlt} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center min-w-0" style={{ gap: 4 }}>
                          <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
                          {p.hide_name ? null : <AccountBadges profile={p} t={t} />}
                        </span>
                        <span className="block text-12 text-muted truncate">{t.convStartRowHint}</span>
                      </span>
                      <span className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-muted" aria-hidden>
                        <Icon name="chat" size={16} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    );

  /* 🆕 T397 — «إنشاء قروب» فوق القائمة: لمشترك لوبز+ يفتح الورقة، ولغيره رابطٌ إلى لوبز+ يقول لمن هي (`grpPlusOnly`) */
  const createRow = canCreateGroup ? (
    <button
      type="button"
      onClick={() => {
        tap(6);
        setCreateOpen(true);
      }}
      className="mb-2 flex w-full items-center gap-3 rounded-xl -mx-2 px-2 py-2.5 text-start hover:bg-surface-2 transition"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2 text-accent" aria-hidden>
        <Icon name="people" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t.grpCreate}</span>
        <span className="block text-12 text-muted truncate">{t.grpCreateSub}</span>
      </span>
    </button>
  ) : (
    <Link href="/plus" className="mb-2 flex w-full items-center gap-3 rounded-xl -mx-2 px-2 py-2.5 hover:bg-surface-2 transition">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2 text-muted" aria-hidden>
        <Icon name="people" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t.grpCreate}</span>
        <span className="block text-12 text-muted truncate">{t.grpPlusOnly}</span>
      </span>
      <Icon name="lock" size={14} className="shrink-0 text-muted" />
    </Link>
  );

  return (
    /* 🆕 T397 — **لوحان على الحاسوب** (قرار أحمد ١٧ نوفمبر، اتجاه «أ»): القائمةُ ٣٤٠ ثابتةٌ في جهة البداية والمحادثةُ
       بجانبها بعرض ما بقي. **وتحت ١٠٢٤ لا شيء تغيّر**: لوحٌ واحدٌ — القائمةُ أو الخيط — كما كان (D-767).
       الخيطُ يبقى في تمرير الصفحة نفسِه والخانةُ في مرساها (`KeyboardDock`)، والقائمةُ تلتصق برأس النافذة وتُمرَّر وحدها */
    <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      <div
        className={`${threadOpen ? "hidden lg:block" : "space-y-4"} lg:space-y-4 lg:sticky lg:top-6 lg:z-[2] lg:h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain lg:pe-4 lg:border-e lg:border-[color:var(--divider)] lg:bg-[color:var(--background)]`}
      >
        {header}
        <div>
          {createRow}
          {list}
        </div>
      </div>

      <div className={`${threadOpen ? "" : "hidden lg:block"} min-w-0 lg:ps-6`}>
        {open ? (
          <ConversationView
            key={open.personId}
            conv={open}
            name={nameOf(open.person)}
            locale={locale}
            lastSeen={lastSeen}
            canMessage={canMessage}
            chatBg={chatBg}
          />
        ) : group ? (
          <GroupView key={group.group_id} g={group} meId={meId} locale={locale} chatBg={chatBg} />
        ) : (
          /* الحاسوبُ وحدَه: لوحُ المحادثة فارغٌ حتى تُختار واحدة — أيقونةٌ وعنوانٌ لا فراغٌ أبيض */
          <div className="grid min-h-[70vh] place-items-center text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-surface-2 text-muted" aria-hidden>
                <Icon name="chat" size={28} />
              </span>
              <p className="text-15 font-bold">{t.communityTabInbox}</p>
              <p className="max-w-xs text-12 text-muted">{t.convStartRowHint}</p>
            </div>
          </div>
        )}
      </div>

      {startWith && (
        <StartConversationSheet person={startWith} locale={locale} onClose={() => setStartWith(null)} />
      )}
      {createOpen !== null ? (
        <CreateGroupSheet open={createOpen} onClose={() => setCreateOpen(false)} locale={locale} />
      ) : null}
    </div>
  );
}

type Dict = ReturnType<typeof getDict>;

/** 🆕 D-765: سطرُ الحضور — «متصل الآن» خلال خمس دقائق وإلا «آخر ظهور
 *  قبل …» (صيغةُ `timeAgo` نفسُها — لا صيغةَ زمنٍ ثالثة). خارجَ المكوّن
 *  كأخواتها في `when.ts`: قراءةُ الساعة ليست من نقاء جسد المكوّن،
 *  والسطرُ يتجدّد مع استطلاع الخيط كلَّ ٢٠ ثانية فلا يتجمّد */
function presenceOf(lastSeen: string | null, t: Dict): string | null {
  if (!lastSeen) return null;
  const at = new Date(lastSeen).getTime();
  if (!Number.isFinite(at)) return null;
  if (Date.now() - at < 5 * 60_000) return t.convOnline;
  return t.convLastSeen(timeAgo(lastSeen, t));
}

/** سطر المعاينة في قائمة المحادثات — آخر حدثٍ فيها */
function previewOf(last: ConvEvent | undefined, t: Dict): string {
  if (!last) return "";
  const mine = last.mine ? `${t.convYou}: ` : "";
  if (last.kind === "reply") return `${mine}${replyPreview(last, t)}`;
  if (last.kind === "list") return `${mine}${t.convSharedListPreview(last.list_name ?? "—")}`;
  return `${mine}${t.convSharedPreview(last.title ?? "—")}`;
}

/** 🆕 D-1387 — سطرُ الرسالة في القائمة: «📷 صورة» (وتعليقُها إن وُجد) أو «GIF» أو النصّ */
function replyPreview(e: Extract<ConvEvent, { kind: "reply" }>, t: Dict): string {
  /* 🆕 D-1441 — المحذوفةُ للجميع سطرُها «حُذفت» لا فراغ */
  if (e.deleted) return e.mine ? t.msgDeletedMine : t.msgDeleted;
  if (e.gif_id) return t.msgGifPreview;
  if (e.image) return e.body ? `${t.msgImagePreview} · ${e.body}` : t.msgImagePreview;
  return e.body;
}

/** 🆕 T397 — نوعُ الرسالة عند الحذف (`MsgDeleteKind`) — الردُّ القديمُ في خيط عمل لا يُحذف (نسخةُ `delKind` في التطبيق) */
function delKind(e: ConvEvent): MsgDeleteKind | null {
  if (e.id.startsWith("tmp-")) return null;
  return e.kind === "reply" ? (e.dm ? "dm" : null) : e.kind;
}

/** 🆕 T397 — ما يُنسخ: نصُّ الرسالة أو تعليقُ الصورة أو ملاحظةُ البطاقة — ولا شيء لـGIF وحده أو لمحذوفة */
function copyOf(e: ConvEvent): string {
  if (e.kind === "reply") return e.deleted ? "" : e.body.trim();
  return (e.note ?? "").trim();
}

/** مصغّرةُ ما يُقتبس فوق الخانة */
function replyThumb(e: ConvReplyEvent): string | null {
  return e.image?.url ?? (e.gif_id ? gifUrl(e.gif_id, "small") : null);
}

/** خيط محادثةٍ واحد — كالدردشة */
function ConversationView({
  conv,
  name,
  locale,
  lastSeen,
  canMessage = null,
  chatBg,
}: {
  conv: Conversation;
  name: string;
  locale: Locale;
  lastSeen: string | null;
  canMessage?: boolean | null;
  chatBg: ChatBg;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [events, setEvents] = useState<ConvEvent[]>(conv.events);
  const idRef = useRef(0);
  /* 🆕 T397 — الردُّ على رسالة، وورقتا الأفعال والحذف لرسالةٍ واحدة */
  const [replyTo, setReplyTo] = useState<ConvReplyEvent | null>(null);
  const [acting, setActing] = useState<ConvEvent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  /* 🆕 R255 — **تحديدُ عدّة رسائل** (توأمُ D-1401/D-1441 في التطبيق): «تحديد» من قائمة الرسالة يُدخل الوضع، والضغطةُ بعدها
     تحدِّد وتُلغي، وشريطُ «محدّد N · رد · نسخ · حذف» مكانَ الترويسة، وEsc أو ✕ يخرج. المفتاحُ `نوع-معرّف` (المعرّفاتُ من جداول شتّى) */
  const [selected, setSelected] = useState<string[]>([]);

  /* فورية (م٥/D-069): Realtime على جداول الخيط يوقظ التجديد لحظةَ وصول
     رسالة، والاستطلاع كل ٦ ثوانٍ شبكةُ أمانٍ تحته. أحداث الخادم الجديدة
     تحلّ محلّ الحالة — بما فيها المتفائلة، وقد صارت حقيقيةً هناك.
     ⚖️ 🆕 D-765: حالُ القناة لم يعد يُعرض — «live» قُرئت حالاً للشخص
     وهي ليست كذلك (بلاغ ٢٨ أغسطس)، والصادقُ عن الشخص سطرُ آخرِ ظهوره */
  useChatPoll(true, ["title_shares", "list_shares", "share_replies", "direct_messages"]);

  /* «متصل الآن» لنشاطٍ خلال خمس دقائق (نبضةُ الحضور كلَّ أربع) — وإلا
     «آخر ظهور قبل ساعة/قبل يوم». لا نبضةَ له بعدُ؟ لا سطرَ أصلاً —
     ترويسةٌ صامتةٌ أصدقُ من «آخر ظهور» عن زمنٍ لا نعرفه */
  const presence = presenceOf(lastSeen, t);
  /* مزامنةٌ أثناء الرسم لا داخل effect (توصية React نفسها): وصولُ نسخة
     خادمٍ أحدث يستبدل الحالة في نفس الجولة بلا رسمٍ متتالٍ */
  const [prevServerEvents, setPrevServerEvents] = useState(conv.events);
  if (conv.events !== prevServerEvents) {
    setPrevServerEvents(conv.events);
    setEvents(conv.events);
  }

  /* قائمة «المزيد» في الترويسة. كان فيها زرُّ إخفاءٍ وحيد، والحظر لا بابَ
     له إلا صفحةُ الملف — وهذا معكوس: من يريد حظر أحدٍ يريده **وهو يقرأ
     رسالته**، لا بعد رحلةٍ إلى ملفّه. والزرُّ الرابع في ترويسةٍ ضيّقة كان
     سيزاحم؛ فصار الزرّ نقاطاً وصارت الأفعال الثلاثة صفوفاً — نفس ورقة
     `DetailTopBar` و`ProfileMenu` بلا عائلةٍ ثانية (D-018). */
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  /* 🆕 D-1382 — منتقي الخلفيّة؛ يُحمَّل أوّلَ فتحٍ ويبقى مركَّباً بعده لتعمل حركةُ الإغلاق */
  const [bgSheet, setBgSheet] = useState<boolean | null>(null);

  /* 🆕 ٦ أكتوبر ٢٠٢٦ (بلاغُ خالد: «لازم أنزل تحت لين يظهر مكان الإرسال»): المحادثةُ تُفتح على **آخرها** لا أوّلها —
     عُرفُ كلِّ محادثة، وبدونه يبقى الحقلُ المثبَّت ظاهراً والقارئُ عند أقدم ما قيل. وبعدها ينزل عند كلِّ حدثٍ جديد
     **إن كان منّي أو كنتُ قرب القاع أصلاً**: من صعد يقرأ قديماً لا يُسحب من تحت عينه (الاستطلاعُ يبدّل المصفوفةَ
     كلَّ مرّة، فالمرجعُ عددُ الأحداث لا هويّتُها). */
  const count = events.length;
  const lastMine = events[count - 1]?.mine === true;
  const seenCount = useRef(0);
  useEffect(() => {
    const first = seenCount.current === 0;
    const grew = count > seenCount.current;
    seenCount.current = count;
    if (!grew) return;
    const doc = document.documentElement;
    const near = doc.scrollHeight - window.innerHeight - window.scrollY < 240;
    if (first || near || lastMine) window.scrollTo({ top: doc.scrollHeight, behavior: first ? "auto" : "smooth" });
  }, [count, lastMine]);
  const username = conv.person?.username ?? null;

  function doHide() {
    setMenu(false);
    tap(8);
    hideConversation(conv.personId)
      .then(() => router.push("/messages"))
      .catch((e) => flashError((e as Error).message));
  }

  // الوارد يُعلَّم مقروءاً عند الفتح — وكلّما وصل جديدٌ والخيط مفتوح
  useEffect(() => {
    if (conv.unread > 0) {
      markConversationRead(conv.personId)
        .then(() => coalescedRefresh(router))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.unread]);

  /* 🆕 T397 — الإرسالُ: فقاعةٌ متفائلةٌ فوراً (بصورتها المحلّيّة أو الـGIF أو اقتباسها)، ثمّ الكتابة، ثمّ تجديدُ الخيط
     فيحلّ ما في الخادم محلَّها — نهجُ الحقل القديم نفسُه */
  async function send(m: Outgoing) {
    const quoted = m.reply_to ? events.find((e): e is ConvReplyEvent => e.kind === "reply" && e.id === m.reply_to) ?? null : null;
    const tmpId = `tmp-${idRef.current++}`;
    setEvents((prev) => [
      ...prev,
      {
        kind: "reply",
        id: tmpId,
        mine: true,
        body: m.body,
        created_at: new Date().toISOString(),
        dm: true,
        ...(m.gif_id ? { gif_id: m.gif_id } : {}),
        ...(m.local ? { image: { url: m.local, key: m.local } } : {}),
        ...(quoted ? { reply: replyRefOf(quoted) } : {}),
      },
    ]);
    try {
      await sendDirectMessage(conv.personId, m.body, { gif_id: m.gif_id ?? null, image_path: m.image_path ?? null, reply_to: m.reply_to ?? null });
      coalescedRefresh(router);
    } catch (e) {
      /* A-65 (المدقّق ١٨ نوفمبر) — توأمُ القروب: الفقاعةُ المتفائلةُ تُرفع إن فشل الإرسال فلا تبقى كأنّها أُرسلت */
      setEvents((prev) => prev.filter((x) => x.id !== tmpId));
      flashError((e as Error).message);
    }
  }

  /* 🆕 T397 — أفعالُ الرسالة: الردُّ على المباشرة وحدها (D-1403)، والنسخُ لما فيه نصّ، والحذفُ لما يقبله الخادم (D-1441) */
  const act = acting;
  const canReply = !!act && act.kind === "reply" && !!act.dm && !act.deleted;
  const copyText = act ? copyOf(act) : "";
  const kind = act ? delKind(act) : null;
  /* ما يُحذف: المحدَّدُ في وضع التحديد، وإلا رسالةُ القائمة وحدها */
  const keyOfEv = (e: ConvEvent) => `${e.kind}-${e.id}`;
  const selectedEvents = events.filter((e) => selected.includes(keyOfEv(e)));
  const selecting = selected.length > 0;
  const targets = selecting ? selectedEvents : act ? [act] : [];
  const canAll = targets.length > 0 && targets.every((e) => !!delKind(e)) && canUnsend(targets) && targets.every((e) => !(e.kind === "reply" && e.deleted));
  const canDeleteSel = selectedEvents.length > 0 && selectedEvents.every((e) => !!delKind(e));
  const copySel = (() => {
    /* كالتطبيق (`copyTextOf`): رسالةٌ واحدةٌ نصُّها وحدَه، وأكثرُ ⇐ «[الوقت] الاسم: النص» بترتيب المحادثة لا ترتيب اللمس */
    const rows = [...selectedEvents].filter((e) => copyOf(e)).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (rows.length === 1) return copyOf(rows[0]);
    return rows.map((e) => `[${clockOf(e.created_at, t)}] ${e.mine ? t.convYou : name}: ${copyOf(e)}`).join("\n");
  })();
  const replyableSel =
    selectedEvents.length === 1 && selectedEvents[0].kind === "reply" && !!selectedEvents[0].dm && !selectedEvents[0].deleted ? (selectedEvents[0] as ConvReplyEvent) : null;
  const toggleSel = (e: ConvEvent) => setSelected((cur) => (cur.includes(keyOfEv(e)) ? cur.filter((k) => k !== keyOfEv(e)) : [...cur, keyOfEv(e)]));
  /* Esc يخرج من التحديد — إلا وورقةُ الحذف مفتوحة (Esc لها أوّلاً) */
  useEffect(() => {
    if (!selecting || delOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected([]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selecting, delOpen]);

  async function runDelete(scope: "me" | "all") {
    const list = targets.filter((e) => !!delKind(e));
    setDelOpen(false);
    setSelected([]);
    if (!list.length) return;
    tap(8);
    try {
      const res = await deleteMessages({ scope, items: list.map((e) => ({ kind: delKind(e)!, id: e.id })) }, t);
      const refused = new Set(res.refused);
      if (refused.size) flashError(scope === "all" ? t.apiUnsendWindow : t.apiInternal);
      const done = new Set(list.filter((e) => !refused.has(e.id)).map(keyOfEv));
      if (!done.size) return;
      setEvents((prev) =>
        prev.flatMap((x): ConvEvent[] =>
          !done.has(keyOfEv(x))
            ? [x]
            : scope === "all" && x.kind === "reply"
              ? [{ kind: "reply", id: x.id, mine: x.mine, body: "", created_at: x.created_at, dm: true, deleted: true }]
              : [],
        ),
      );
      if (replyTo && done.has(keyOfEv(replyTo))) setReplyTo(null);
      coalescedRefresh(router);
    } catch (err) {
      flashError((err as Error).message);
    }
  }

  return (
    <>
    {/* 🆕 D-1382 — الخلفيّةُ طبقةٌ ثابتةٌ تحت الخيط، والخيطُ فوقها (`z-[1]`) */}
    <ChatBackground bg={chatBg} />
    <div className="relative z-[1] flex flex-col">
      {/* ترويسة: رجوع، صاحب المحادثة، إخفاء */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-[color:var(--divider)] lg:sticky lg:top-0 lg:z-10 lg:-mt-6 lg:pt-6 lg:bg-[color:var(--background)]">
        {selecting ? (
          /* 🆕 R255 — شريطُ التحديد مكانَ الترويسة (التطبيق D-1401 كالواتس): ✕ يلغي · العدد · رد (لواحدة) · نسخ · حذف */
          <>
            <button type="button" onClick={() => setSelected([])} aria-label={t.msgSelectCancel} title={t.msgSelectCancel} className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition">
              <Icon name="close" size={16} />
            </button>
            <span className="min-w-0 flex-1 truncate text-15 font-bold" aria-live="polite">
              {t.msgSelectedCount(selected.length)}
            </span>
            {replyableSel ? (
              <button
                type="button"
                onClick={() => {
                  setSelected([]);
                  setReplyTo(replyableSel);
                }}
                aria-label={t.msgReply}
                title={t.msgReply}
                className="shrink-0 grid place-items-center w-10 h-10 rounded-full text-foreground hover:bg-surface-2 transition"
              >
                <Icon name="reply" size={19} />
              </button>
            ) : null}
            <button
              type="button"
              disabled={!copySel}
              onClick={() => {
                navigator.clipboard?.writeText(copySel).then(() => copiedToast(t.msgCopied), () => {});
                setSelected([]);
              }}
              aria-label={t.msgCopy}
              title={t.msgCopy}
              className="shrink-0 grid place-items-center w-10 h-10 rounded-full text-foreground hover:bg-surface-2 transition disabled:opacity-35"
            >
              <Icon name="copy" size={18} />
            </button>
            <button
              type="button"
              disabled={!canDeleteSel}
              onClick={() => setDelOpen(true)}
              aria-label={t.msgDelete}
              title={t.msgDelete}
              className="shrink-0 grid place-items-center w-10 h-10 rounded-full text-[color:var(--error)] hover:bg-surface-2 transition disabled:opacity-35"
            >
              <Icon name="trash" size={18} />
            </button>
          </>
        ) : (
        <>
        {/* 🆕 T397 — على الحاسوب القائمةُ بجانب الخيط فلا رجوع */}
        <Link
          href="/messages"
          aria-label={t.convBackAria}
          className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition lg:hidden"
        >
          <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90" />
        </Link>
        {/* 🆕 D-767 (طلب أحمد: «الاسم احتاج أقدر أضغطه»): الهويّةُ كلُّها —
            صورةٌ واسمٌ وسطرُ الحضور — بابُ الملفّ. صاحبُ الاسم المخفيّ لا
            صفحةَ له فيبقى نصّاً (قاعدةُ صفِّ القائمة في ورقة «المزيد» نفسُها).
            وصفُّ الملفّ في الورقة باقٍ — بابان لمقصدٍ واحدٍ لا عائلتان. */}
        {(() => {
          const identity = (
            <>
              <Avatar
                src={conv.person?.hide_name ? null : conv.person?.avatar_url ?? null}
                name={name}
                size={34}
                alt={t.avatarAlt}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold truncate">{name}</span>
                {/* ⚖️ 🆕 D-765: مكانَ شارة «فوري/تحديث دوري» — كانت حالَ قناة
                    Realtime فقُرئت «الشخص متصل» وهي لا تقول ذلك. السطرُ الآن
                    عن الشخص فعلاً، ويتجدّد مع استطلاع الخيط (كل ٢٠ ثانية) */}
                {presence && (
                  <span className="block text-12 text-muted truncate">{presence}</span>
                )}
              </span>
            </>
          );
          /* 🆕 **والشارةُ أختٌ للباب لا ابنةٌ له** (D-773ب): الترويسةُ كلُّها
             بابٌ واحد منذ D-767، **ورابطٌ داخل رابطٍ ترميزٌ باطل** — فتقف
             الشارةُ بعده في الصفّ نفسِه.
             ⚠️ **و`flex-1` انتقلت إلى الغلاف**: لو بقيت على الباب لدُفعت
             الشارةُ إلى آخر الترويسة بجوار النقاط — **وشارةٌ بعيدةٌ عن اسمها
             تُقرأ صفةً لغير صاحبها.** */
          return (
            <span className="flex min-w-0 flex-1 items-center" style={{ gap: 4 }}>
              {username ? (
                <Link
                  href={`/u/${username}`}
                  aria-label={t.viewProfileOf(name)}
                  className="flex min-w-0 items-center gap-2.5 rounded-xl -my-1 py-1 -ms-1 ps-1 pe-1 hover:bg-surface-2 active:opacity-80 transition"
                >
                  {identity}
                </Link>
              ) : (
                <span className="flex min-w-0 items-center gap-2.5">{identity}</span>
              )}
              {conv.person?.hide_name ? null : (
                <AccountBadges profile={conv.person} t={t} />
              )}
            </span>
          );
        })()}
        <button
          type="button"
          onClick={() => {
            tap(6);
            setMenu(true);
          }}
          aria-label={t.moreMenuTitle}
          title={t.moreMenuTitle}
          className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
        >
          <Icon name="dots" size={16} />
        </button>
        </>
        )}
      </div>

      {/* ورقة «المزيد» — الملفّ ثم الإخفاء ثم الحظر، الأخطرُ أخيراً */}
      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        closeLabel={t.closeLabel}
        variant="bottom"
        labelledBy="conv-menu-title"
      >
        <p id="conv-menu-title" className="text-center font-bold text-15 pt-5 pb-2">
          {t.moreMenuTitle}
        </p>
        <div className="pb-3">
          {/* بلا معرّفٍ لا صفحة — والصفُّ يغيب بدل أن يظهر معطّلاً بلا سبب */}
          {username && (
            <Link
              href={`/u/${username}`}
              onClick={() => setMenu(false)}
              className={sheetMenuItem}
            >
              <Icon name="people" size={18} className="text-accent" />
              {t.viewProfileOf(name)}
            </Link>
          )}

          {/* 🆕 D-1382 — الخلفيّةُ تُختار من داخل المحادثة: هناك يُفكَّر فيها، لا في الإعدادات */}
          <button
            type="button"
            onClick={() => {
              setMenu(false);
              setBgSheet(true);
            }}
            className={sheetMenuItem}
          >
            <Icon name="palette" size={18} className="text-accent" />
            {t.chatBgTitle}
          </button>

          <button type="button" onClick={doHide} className={sheetMenuItem}>
            <Icon name="eye-off" size={18} className="text-muted" />
            {t.convHide}
          </button>

          <div className={sheetMenuDivider} />

          <button
            type="button"
            onClick={() => {
              setMenu(false);
              setConfirmBlock(true);
            }}
            className={sheetMenuItem}
          >
            <Icon name="close" size={18} className="text-[color:var(--error)]" />
            <span className="text-[color:var(--error)]">{t.blockOption}</span>
          </button>
        </div>
      </Sheet>

      {/* الحظر من داخل المحادثة يُخفي الخيط أيضاً — لا صفَّ تشرحه لمن
          حظرتَ صاحبه. والإخفاء من جهتي وحدها كما هو (D-066)، فالحظر لا
          يمحو ما كتبه أحدٌ عند نفسه. */}
      {confirmBlock && (
        <BlockConfirmSheet
          targetId={conv.personId}
          locale={locale}
          onClose={() => setConfirmBlock(false)}
          onBlocked={() => {
            hideConversation(conv.personId)
              .catch(() => {})
              .finally(() => router.push("/messages"));
          }}
        />
      )}

      {/* الأحداث */}
      <div className="py-4 space-y-3">
        {events.map((e) => (
          <MsgShell
            key={`${e.kind}-${e.id}`}
            mine={e.mine}
            enabled={!e.id.startsWith("tmp-") && !(e.kind === "reply" && e.deleted && !delKind(e))}
            label={t.moreMenuTitle}
            className={e.mine ? "ms-auto max-w-[85%] lg:max-w-[70%]" : "me-auto max-w-[85%] lg:max-w-[70%]"}
            onMenu={() => {
              setActing(e);
              setMenuOpen(true);
            }}
            selecting={selecting}
            selected={selected.includes(keyOfEv(e))}
            onToggle={() => toggleSel(e)}
          >
            <ConvBubble event={e} t={t} quoteWho={name} />
          </MsgShell>
        ))}
        {/* 🆕 D-1380 — خيطٌ لم يبدأ بعد: دعوةٌ لا فراغ */}
        {events.length === 0 && canMessage !== false ? (
          <div className="py-16 flex flex-col items-center gap-1.5 text-center">
            <Icon name="comment" size={26} className="text-muted" />
            <p className="text-sm font-semibold">{t.convSayHi(name)}</p>
            <p className="text-12 text-muted">{t.convSayHiSub}</p>
          </div>
        ) : null}
      </div>

      {/* 🆕 D-1380 — الحقلُ في كلِّ محادثة: الرسالةُ نصٌّ مباشرٌ لا ردٌّ معلَّقٌ بعمل (D-051 المنقوضة). وحين لا يقبل الشخصُ
          رسائلَ ولا محادثةَ قائمة: سطرٌ يقول ذلك بدل حقلٍ يفشل */}
      {events.length === 0 && canMessage === false ? (
        <p className="pt-3 border-t border-[color:var(--divider)] text-xs text-muted text-center">
          {t.msgNotAcceptingOf(name)}
        </p>
      ) : (
        /* 🆕 الحقلُ على حافّة الشاشة (مرسى النقاش نفسُه — D-320) لا في آخر المستند: خيطٌ طويلٌ كان يدفنه تحت كلِّ ما قيل */
        <KeyboardDock spacer={replyTo ? "h-36" : "h-24"}>
          <ChatComposer
            locale={locale}
            reply={replyTo ? { id: replyTo.id, who: replyTo.mine ? t.convYou : name, line: replyLineOf(replyTo, t), thumb: replyThumb(replyTo) } : null}
            onCancelReply={() => setReplyTo(null)}
            onSend={send}
          />
        </KeyboardDock>
      )}
    </div>
    <MsgMenuSheet
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      t={t}
      onReply={
        canReply
          ? () => {
              setMenuOpen(false);
              setReplyTo(act as ConvReplyEvent);
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
        kind
          ? () => {
              setMenuOpen(false);
              setDelOpen(true);
            }
          : null
      }
      onSelect={
        act && !act.id.startsWith("tmp-")
          ? () => {
              setMenuOpen(false);
              setSelected([keyOfEv(act)]);
            }
          : null
      }
      selectLabel={webWords(locale).msgSelect}
    />
    <MsgDeleteSheet open={delOpen} count={targets.length} canAll={canAll} onMe={() => void runDelete("me")} onAll={() => void runDelete("all")} onClose={() => setDelOpen(false)} t={t} />
    {bgSheet !== null ? <ChatBgSheet open={bgSheet} onClose={() => setBgSheet(false)} locale={locale} /> : null}
    </>
  );
}
