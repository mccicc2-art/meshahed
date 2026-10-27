"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AccountBadges } from "./AccountIdentity";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { getDict, num, type Locale } from "@/core/i18n";
import { gifUrl, posterUrl } from "@/core/media";
import { formatDateShort, timeAgo } from "@/core/when";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import { coalescedRefresh } from "@/core/refresh";
import { useChatPoll } from "@/lib/usePoll";
import { FeedEmptyCta } from "./FeedEmptyCta";
import { Sheet } from "./ui/Sheet";
import { KeyboardDock } from "./ui/KeyboardDock";
import { sheetMenuItem, sheetMenuDivider } from "./ui/controls";
import { BlockConfirmSheet } from "./BlockConfirmSheet";
import { sendDirectMessage, markConversationRead, hideConversation } from "@/lib/actions";
import { DM_MAX } from "@/core/dmPolicy";
import { DEFAULT_CHAT_BG, type ChatBg } from "@/core/chatBg";
import { ChatBackground } from "./ChatBackground";
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
}) {
  const t = getDict(locale);
  /* 🆕 11-M · M4 — الورقةُ تُفتح للشخص المطلوب إن كان ممّن يُبدأ معهم فعلاً؛ غيرُه يسقط إلى القائمة بلا ورقة */
  const [startWith, setStartWith] = useState<PersonLite | null>(() =>
    openStart ? startable.find((p) => p.id === openStart) ?? null : null,
  );

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
  if (open) {
    return (
      <ConversationView conv={open} name={nameOf(open.person)} locale={locale} lastSeen={lastSeen} canMessage={canMessage} chatBg={chatBg} />
    );
  }

  // لا محادثاتٍ ولا من نبدأ معه: الفراغ وحده
  if (conversations.length === 0 && startable.length === 0) {
    /* حالة موجهة (تعميم نمط D-106): الرسائل تحتاج متابعة متبادلة —
       فأول خطوة من الفراغ هي إيجاد الأصدقاء، والزر يفتح ورقة البحث */
    return (
      <div>
        <FeedEmptyCta locale={locale} text={t.inboxEmpty} />
      </div>
    );
  }

  /* **صفُّ البحث ذهب** (طلب أحمد ١١ أغسطس، لقطةٌ مشطوبةٌ بالأحمر): كان
     يفعل شيئين — يُرشّح محادثاتك بالاسم، **ويكشف من تستطيع أن تبدأ معه**.
     والأوّل يسقط بلا خسارة: الوارد قائمةٌ قصيرة عند أكثر الناس، وترشيحُ
     خمسة صفوفٍ حقلٌ لا يستحقّ صدر الشاشة.
     **والثاني لا يسقط، فهو البابُ الوحيد لمحادثةٍ جديدة** — فصار قسمُ
     «ابدأ محادثة» **ظاهراً دائماً** بدل أن ينتظر حرفاً يُكتب.
     **والكلفة تُقال:** من له متابَعون متبادلون كثيرون يرى قائمةً أطول
     أسفل محادثاته. ولم يُقصَّ القسم بسقفٍ صامت — سقفٌ يُخفي أشخاصاً
     ويقول إنه عرض الجميع أسوأ من قائمةٍ طويلة (D-165). */
  const shown = conversations;
  const startShown = startable;

  return (
    <div>
      {shown.length > 0 && (
        <ul className="divide-y divide-[color:var(--divider)]">
          {shown.map((c) => {
        const name = nameOf(c.person);
        const last = c.events[c.events.length - 1];
        const preview = previewOf(last, t);
        return (
          <li key={c.personId}>
            <Link
              href={`/people?tab=inbox&with=${c.personId}`}
              aria-label={t.convOpenAria(name)}
              className="flex items-center gap-3 py-3 hover:bg-surface-2 -mx-2 px-2 rounded-xl transition"
            >
              <Avatar
                src={c.person?.hide_name ? null : c.person?.avatar_url ?? null}
                name={name}
                size={44}
                alt={t.avatarAlt}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="flex flex-1 min-w-0 items-center" style={{ gap: 4 }}>
                    <span className="text-sm font-semibold truncate min-w-0">{name}</span>
                    {c.person?.hide_name ? null : (
                      <AccountBadges profile={c.person} t={t} />
                    )}
                  </span>
                  <span className="text-12 text-muted shrink-0">
                    {formatDateShort(c.lastAt, t)}
                  </span>
                </span>
                <span
                  className={`block text-12 truncate ${
                    c.unread > 0 ? "text-foreground font-medium" : "text-muted"
                  }`}
                >
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
          <p className="text-12 font-semibold text-muted uppercase tracking-wide px-1 mb-1.5">
            {t.convStartSection}
          </p>
          <ul className="divide-y divide-[color:var(--divider)]">
            {startShown.map((p) => {
              const name = nameOf(p);
              return (
                <li key={p.id}>
                  <Link
                    href={`/people?tab=inbox&with=${p.id}`}
                    onClick={() => tap(6)}
                    aria-label={t.convStartRowAria(name)}
                    className="w-full flex items-center gap-3 py-3 hover:bg-surface-2 -mx-2 px-2 rounded-xl transition text-start"
                  >
                    <Avatar
                      src={p.hide_name ? null : p.avatar_url}
                      name={name}
                      size={44}
                      alt={t.avatarAlt}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center min-w-0" style={{ gap: 4 }}>
                        <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
                        {p.hide_name ? null : <AccountBadges profile={p} t={t} />}
                      </span>
                      <span className="block text-12 text-muted truncate">
                        {t.convStartRowHint}
                      </span>
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

      {startWith && (
        <StartConversationSheet
          person={startWith}
          locale={locale}
          onClose={() => setStartWith(null)}
        />
      )}
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
      .then(() => router.push("/people?tab=inbox"))
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

  return (
    <>
    {/* 🆕 D-1382 — الخلفيّةُ طبقةٌ ثابتةٌ تحت الخيط، والخيطُ فوقها (`z-[1]`) */}
    <ChatBackground bg={chatBg} />
    <div className="relative z-[1] flex flex-col">
      {/* ترويسة: رجوع، صاحب المحادثة، إخفاء */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-[color:var(--divider)]">
        <Link
          href="/people?tab=inbox"
          aria-label={t.convBackAria}
          className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
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
              .finally(() => router.push("/people?tab=inbox"));
          }}
        />
      )}

      {/* الأحداث */}
      <div className="py-4 space-y-3">
        {events.map((e) => (
          <ConvBubble key={`${e.kind}-${e.id}`} event={e} locale={locale} peerName={name} />
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
        <KeyboardDock spacer="h-20">
        <ReplyBox
          recipientId={conv.personId}
          locale={locale}
          onReplied={(body) =>
            setEvents((prev) => [
              ...prev,
              {
                kind: "reply",
                id: `tmp-${idRef.current++}`,
                mine: true,
                body,
                created_at: new Date().toISOString(),
              },
            ])
          }
        />
        </KeyboardDock>
      )}
    </div>
    {bgSheet !== null ? <ChatBgSheet open={bgSheet} onClose={() => setBgSheet(false)} locale={locale} /> : null}
    </>
  );
}

/** فقاعةٌ واحدة: عملٌ مُشارَك (بطاقة) أو ردٌّ نصّي */
/** 🆕 D-1403 — اقتباسُ الأصل: خطٌّ بلون صاحبه، اسمُه، وأوّلُ سطرٍ أو «📷 صورة»/«GIF» ومصغّرتُها */
function ReplyQuote({ r, onMine, t, peerName }: { r: NonNullable<ConvReplyEvent["reply"]>; onMine: boolean; t: Dict; peerName: string }) {
  const who = r.kind === "gone" ? "" : r.mine ? t.convYou : peerName;
  const line =
    r.kind === "gone" ? t.msgReplyGone : r.kind === "gif" ? t.msgGifPreview : r.kind === "image" ? (r.body ? `${t.msgImagePreview} · ${r.body}` : t.msgImagePreview) : r.body;
  const thumb = r.kind === "image" ? r.image?.url ?? null : r.kind === "gif" && r.gif_id ? gifUrl(r.gif_id, "small") : null;
  return (
    <span className={`flex items-stretch gap-2 overflow-hidden rounded-xl ${onMine ? "bg-black/10" : "bg-white/5"}`}>
      <span className={`w-1 shrink-0 ${r.mine ? (onMine ? "bg-[color:var(--on-accent)]" : "bg-accent") : onMine ? "bg-[color:var(--on-accent)] opacity-50" : "bg-muted"}`} />
      <span className="min-w-0 flex-1 py-1.5 pe-2 text-12 leading-snug">
        {who ? <span className="block font-bold">{who}</span> : null}
        <span className="block truncate opacity-80">{line}</span>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element -- رابطٌ مؤقّتٌ من مخزنٍ خاصّ أو Giphy */}
      {thumb ? <img src={thumb} alt="" className="h-12 w-12 shrink-0 object-cover" loading="lazy" /> : null}
    </span>
  );
}

function ConvBubble({ event, locale, peerName }: { event: ConvEvent; locale: Locale; peerName: string }) {
  const t = getDict(locale);
  const side = event.mine ? "ms-auto items-end" : "me-auto items-start";
  /* 🆕 D-1403 — الاقتباسُ فوق الردّ: الويبُ يعرضه (والردُّ نفسُه من التطبيق) — فلا يُقرأ ردٌّ هنا بلا سياقه */
  const quote =
    event.kind === "reply" && event.reply ? <ReplyQuote r={event.reply} onMine={event.mine} t={t} peerName={peerName} /> : null;

  /* 🆕 D-1441 — رسالةٌ حذفها صاحبُها للجميع: سطرٌ خافتٌ مائلٌ بإطارٍ متقطّع مكانَها، لا لونُ صاحبها (لا محتوى بقي) */
  if (event.kind === "reply" && event.deleted) {
    return (
      <div className={`flex flex-col max-w-[80%] ${side}`}>
        <span className="flex items-center gap-1.5 rounded-2xl border border-dashed border-border px-3.5 py-2 text-13 italic text-muted">
          <Icon name="trash" size={13} />
          {event.mine ? t.msgDeletedMine : t.msgDeleted}
        </span>
      </div>
    );
  }
  /* 🆕 D-1387 — GIF أو صورةٌ (وتعليقُها تحتها) في إطارٍ بلون صاحبها، كفقاعة النصّ. الويبُ يعرض ولا يرسل بعدُ */
  if (event.kind === "reply" && (event.gif_id || event.image)) {
    const src = event.gif_id ? gifUrl(event.gif_id, "small") : event.image?.url ?? null;
    return (
      <div className={`flex flex-col max-w-[70%] ${side}`}>
        <div className={`rounded-2xl p-[3px] ${event.mine ? "bg-accent text-[color:var(--on-accent)]" : "bg-surface-2 text-foreground"}`}>
          {quote ? <div className="p-1">{quote}</div> : null}
          {src ? (
            <a href={event.image?.url ?? src} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- رابطٌ مؤقّتٌ من مخزنٍ خاصّ أو Giphy: لا يمرّ بمحسّن الصور */}
              <img src={src} alt={event.gif_id ? "GIF" : t.msgPickImage} loading="lazy" className="block max-w-full max-h-80 rounded-[13px] object-cover" />
            </a>
          ) : null}
          {event.body ? (
            <span className="fs-content block px-3 pt-1.5 pb-1 text-14 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">{event.body}</span>
          ) : null}
        </div>
      </div>
    );
  }
  if (event.kind === "reply") {
    return (
      <div className={`flex flex-col max-w-[80%] ${side}`}>
        <span
          className={`fs-content max-w-full min-w-0 rounded-2xl px-3.5 py-2 text-14 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere] ${
            event.mine
              ? "bg-accent text-[color:var(--on-accent)]"
              : "bg-surface-2 text-foreground"
          }`}
        >
          {quote ? <span className="block mb-1.5">{quote}</span> : null}
          {event.body}
        </span>
      </div>
    );
  }

  // قائمةٌ مُشارَكة — بطاقةٌ كبطاقة العمل: أيقونةٌ مكان الملصق، والرابط
  // إلى صفحة القائمة الحيّة (الاسم والعدّة لحظة الإرسال، D-048 روحاً)
  if (event.kind === "list") {
    return (
      <div className={`flex flex-col max-w-[80%] ${side}`}>
        <Link
          href={`/lists/${event.list_id}`}
          prefetch={false}
          className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-2 hover:bg-surface-2 transition group w-full"
        >
          <span
            className="grid place-items-center w-10 shrink-0 aspect-[2/3] rounded-md bg-surface-2 text-muted"
            aria-hidden
          >
            <Icon name="list" size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-14 font-semibold truncate group-hover:text-accent transition">
              {event.list_name ?? "—"}
            </span>
            <span className="block text-12 text-muted">
              {event.item_count
                ? `${t.convListBadge} · ${t.personWorksCount(event.item_count)}`
                : t.convListBadge}
            </span>
          </span>
        </Link>
        {event.note && (
          <span
            className={`mt-1 fs-content max-w-full min-w-0 rounded-2xl px-3.5 py-2 text-14 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere] ${
              event.mine ? "bg-accent text-[color:var(--on-accent)]" : "bg-surface-2 text-foreground"
            }`}
          >
            {event.note}
          </span>
        )}
      </div>
    );
  }

  // عملٌ مُشارَك — بطاقةٌ بسطحٍ محايد في الجهتين، مصطفّةٌ حسب المُرسِل
  const poster = posterUrl(event.poster_path, "w185");
  const href = `/${event.media_type === "tv" ? "show" : "movie"}/${event.tmdb_id}`;
  return (
    <div className={`flex flex-col max-w-[80%] ${side}`}>
      <Link
        href={href}
        prefetch={false}
        className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-2 hover:bg-surface-2 transition group w-full"
      >
        <span className="relative block w-10 shrink-0 aspect-[2/3] rounded-md overflow-hidden bg-surface-2">
          {poster ? (
            <Image src={poster} alt="" fill sizes="40px" className="object-cover" />
          ) : (
            <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
              <Icon name="film" size={13} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-14 font-semibold truncate group-hover:text-accent transition">
            {event.title ?? "—"}
          </span>
          <span className="block text-12 text-muted">
            {event.media_type === "tv" ? t.typeSeries : t.typeMovie}
          </span>
        </span>
      </Link>
      {event.note && (
        <span
          className={`mt-1 fs-content max-w-full min-w-0 rounded-2xl px-3.5 py-2 text-14 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere] ${
            event.mine ? "bg-accent text-[color:var(--on-accent)]" : "bg-surface-2 text-foreground"
          }`}
        >
          {event.note}
        </span>
      )}
    </div>
  );
}

/** حقلُ الرسالة — 🆕 D-1380: نصٌّ مباشرٌ إلى صاحب الخيط (`sendDirectMessage`)، كان ردّاً معلَّقاً بآخر عملٍ شورك.
 *  ⚖️ 🆕 D-765 (بلاغ ٢٨ أغسطس: «ماتشوف وش كتبت»): كان `<input>` سطراً
 *  واحداً لا يلتفّ — الكتابةُ الطويلة تهرب أفقيّاً خارج النظر. صار
 *  `textarea` ينمو مع المحتوى: الارتفاعُ يُقاس من `scrollHeight` بعد
 *  تصفيره (القياسُ الصادقُ الوحيد للالتفاف)، بسقفِ ~أربعة أسطرٍ ثم
 *  تمريرٌ داخليّ. وEnter يُرسل كما كان (وShift+Enter سطرٌ جديد) —
 *  فسلوكُ الإرسال لم يتغيّر على أحد. */
function ReplyBox({
  recipientId,
  locale,
  onReplied,
}: {
  recipientId: string;
  locale: Locale;
  onReplied: (body: string) => void;
}) {
  const t = getDict(locale);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);

  /* النموُّ بعد كلِّ تغيير قيمة — في effect لا في onChange: القياسُ يقع
     بعد أن يرسم React القيمةَ الجديدة فعلاً (ومنه التصفيرُ بعد الإرسال) */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  function submit() {
    const body = value.trim();
    if (!body || pending) return;
    tap(8);
    onReplied(body);
    setValue("");
    start(async () => {
      try {
        await sendDirectMessage(recipientId, body);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    /* items-end لا items-center: زرُّ الإرسال يلزم قاعَ الحقل وهو ينمو */
    /* الفاصلُ العلويُّ والحشوُ صارا للمرسى (`KeyboardDock`) */
    <div className="flex items-end gap-2">
      <textarea
        ref={box}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t.shareReplyPlaceholder}
        aria-label={t.shareReplyPlaceholder}
        maxLength={DM_MAX}
        rows={1}
        className="flex-1 min-w-0 resize-none overflow-y-auto rounded-2xl bg-surface-2 border border-border px-4 py-2 text-base leading-relaxed outline-none focus:border-accent transition"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim() || pending}
        className="shrink-0 px-4 h-9 rounded-full bg-accent text-[color:var(--on-accent)] text-12 font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition"
      >
        {t.shareReplySend}
      </button>
    </div>
  );
}
