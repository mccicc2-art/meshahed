"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { getDict, num, type Locale } from "@/lib/i18n";
import { posterUrl } from "@/lib/media";
import { formatDateShort } from "@/lib/when";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import { coalescedRefresh } from "@/lib/refresh";
import { useChatPoll } from "@/lib/usePoll";
import { FeedEmptyCta } from "./FeedEmptyCta";
import { Sheet } from "./ui/Sheet";
import { sheetMenuItem, sheetMenuDivider } from "./ui/controls";
import { BlockConfirmSheet } from "./BlockConfirmSheet";
import { replyToShare, markConversationRead, hideConversation } from "@/lib/actions";
import { StartConversationSheet } from "./StartConversationSheet";
import type { Conversation, ConvEvent } from "@/lib/data";
import { displayNameOf, type PersonLite } from "@/lib/people";

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
  locale,
}: {
  conversations: Conversation[];
  /** متابَعون متبادلون لا محادثة معهم بعد — منهم تبدأ محادثةٌ جديدة */
  startable: PersonLite[];
  openWith: string | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [startWith, setStartWith] = useState<PersonLite | null>(null);

  /* **الاسمُ من `displayNameOf` لا من سطرٍ محليّ** (D-193): كان هنا تعريفٌ
     ثانٍ لـ«اسمُ من أخفى اسمه» — نسخةٌ وُلدت لأن الدالّة الأصلية كانت في
     `data.ts` ولا يستوردها مكوّنُ عميل. وقد صارت في `people.ts` النقيّ،
     **فسقط عذرُ النسخة**. وفرقٌ واحد يُقال: من لا نكنيةَ له ولا معرّف كان
     يُرسم «—» وصار «مستخدم» — نفسُ ما تقوله بقيةُ الشاشات عنه. */
  const nameOf = (p: PersonLite | null) => displayNameOf(p, t.anonymousUser);

  const open = openWith ? conversations.find((c) => c.personId === openWith) : null;
  if (open) {
    return <ConversationView conv={open} name={nameOf(open.person)} locale={locale} />;
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
                  <span className="text-sm font-semibold truncate flex-1">{name}</span>
                  <span className="text-[12px] text-muted shrink-0">
                    {formatDateShort(c.lastAt, t)}
                  </span>
                </span>
                <span
                  className={`block text-[12px] truncate ${
                    c.unread > 0 ? "text-foreground font-medium" : "text-muted"
                  }`}
                >
                  {preview}
                </span>
              </span>
              {c.unread > 0 && (
                <span
                  aria-label={t.communityUnreadAria(c.unread)}
                  className="shrink-0 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-[12px] font-bold tabular-nums"
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
          الضغط يفتح ورقةَ اختيار عمل، فتبدأ المحادثة بمشاركةٍ (D-051 قائمة) */}
      {startShown.length > 0 && (
        <section className="mt-5">
          <p className="text-[12px] font-semibold text-muted uppercase tracking-wide px-1 mb-1.5">
            {t.convStartSection}
          </p>
          <ul className="divide-y divide-[color:var(--divider)]">
            {startShown.map((p) => {
              const name = nameOf(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      tap(6);
                      setStartWith(p);
                    }}
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
                      <span className="block text-sm font-semibold truncate">{name}</span>
                      <span className="block text-[12px] text-muted truncate">
                        {t.convStartRowHint}
                      </span>
                    </span>
                    <span className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-muted" aria-hidden>
                      <Icon name="share" size={16} />
                    </span>
                  </button>
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

/** سطر المعاينة في قائمة المحادثات — آخر حدثٍ فيها */
function previewOf(last: ConvEvent | undefined, t: Dict): string {
  if (!last) return "";
  const mine = last.mine ? `${t.convYou}: ` : "";
  if (last.kind === "reply") return `${mine}${last.body}`;
  if (last.kind === "list") return `${mine}${t.convSharedListPreview(last.list_name ?? "—")}`;
  return `${mine}${t.convSharedPreview(last.title ?? "—")}`;
}

/** خيط محادثةٍ واحد — كالدردشة */
function ConversationView({
  conv,
  name,
  locale,
}: {
  conv: Conversation;
  name: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [events, setEvents] = useState<ConvEvent[]>(conv.events);
  const idRef = useRef(0);

  /* فورية (م٥/D-069): Realtime على جداول الخيط يوقظ التجديد لحظةَ وصول
     رسالة، والاستطلاع كل ٦ ثوانٍ شبكةُ أمانٍ تحته. أحداث الخادم الجديدة
     تحلّ محلّ الحالة — بما فيها المتفائلة، وقد صارت حقيقيةً هناك */
  const liveStatus = useChatPoll(true, ["title_shares", "list_shares", "share_replies"]);
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
    <div className="flex flex-col">
      {/* ترويسة: رجوع، صاحب المحادثة، إخفاء */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-[color:var(--divider)]">
        <Link
          href="/people?tab=inbox"
          aria-label={t.convBackAria}
          className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
        >
          <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90" />
        </Link>
        <Avatar
          src={conv.person?.hide_name ? null : conv.person?.avatar_url ?? null}
          name={name}
          size={34}
          alt={t.avatarAlt}
        />
        <span className="min-w-0 flex-1 text-sm font-bold truncate">{name}</span>
        {/* مؤشر الفورية (تقييم 9 Aug م٥): نقطة خضراء = القناة الحية قائمة،
            ونقطة صامتة = شبكة أمان الاستطلاع وحدها — صدقٌ لا زينة */}
        <span
          className="shrink-0 inline-flex items-center gap-1 text-[10px] text-muted"
          title={liveStatus === "live" ? t.convLiveTitle : t.convPollingTitle}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: liveStatus === "live" ? "var(--success)" : "var(--muted)" }}
            aria-hidden
          />
          {liveStatus === "live" ? t.convLive : t.convPolling}
        </span>
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
        <p id="conv-menu-title" className="text-center font-bold text-[15px] pt-5 pb-2">
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
          <ConvBubble key={`${e.kind}-${e.id}`} event={e} locale={locale} />
        ))}
      </div>

      {/* الردّ معلَّقٌ بآخر عملٍ شورك (D-051) — محادثةٌ بدأت بقائمةٍ وحدها
          لا وجهة لردّها بعد، فبدل حقلٍ يفشل بصمت: سطرٌ يشرح الطريق */}
      {conv.latestShareId ? (
        <ReplyBox
          shareId={conv.latestShareId}
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
      ) : (
        <p className="pt-3 border-t border-[color:var(--divider)] text-xs text-muted text-center">
          {t.convReplyNeedsTitle}
        </p>
      )}
    </div>
  );
}

/** فقاعةٌ واحدة: عملٌ مُشارَك (بطاقة) أو ردٌّ نصّي */
function ConvBubble({ event, locale }: { event: ConvEvent; locale: Locale }) {
  const t = getDict(locale);
  const side = event.mine ? "ms-auto items-end" : "me-auto items-start";

  if (event.kind === "reply") {
    return (
      <div className={`flex flex-col max-w-[80%] ${side}`}>
        <span
          className={`rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-line break-words ${
            event.mine
              ? "bg-accent text-[color:var(--on-accent)]"
              : "bg-surface-2 text-foreground"
          }`}
        >
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
            <span className="block text-[14px] font-semibold truncate group-hover:text-accent transition">
              {event.list_name ?? "—"}
            </span>
            <span className="block text-[12px] text-muted">
              {event.item_count
                ? `${t.convListBadge} · ${t.personWorksCount(event.item_count)}`
                : t.convListBadge}
            </span>
          </span>
        </Link>
        {event.note && (
          <span
            className={`mt-1 rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-line break-words ${
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
          <span className="block text-[14px] font-semibold truncate group-hover:text-accent transition">
            {event.title ?? "—"}
          </span>
          <span className="block text-[12px] text-muted">
            {event.media_type === "tv" ? t.typeSeries : t.typeMovie}
          </span>
        </span>
      </Link>
      {event.note && (
        <span
          className={`mt-1 rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-line break-words ${
            event.mine ? "bg-accent text-[color:var(--on-accent)]" : "bg-surface-2 text-foreground"
          }`}
        >
          {event.note}
        </span>
      )}
    </div>
  );
}

/** حقلُ الردّ — يُعلَّق بآخر عملٍ شورك في المحادثة */
function ReplyBox({
  shareId,
  locale,
  onReplied,
}: {
  shareId: string;
  locale: Locale;
  onReplied: (body: string) => void;
}) {
  const t = getDict(locale);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const body = value.trim();
    if (!body || pending) return;
    tap(8);
    onReplied(body);
    setValue("");
    start(async () => {
      try {
        await replyToShare(shareId, body);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex items-center gap-2 pt-3 border-t border-[color:var(--divider)]">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t.shareReplyPlaceholder}
        aria-label={t.shareReplyPlaceholder}
        maxLength={500}
        className="flex-1 min-w-0 rounded-full bg-surface-2 border border-border px-4 py-2 text-base outline-none focus:border-accent transition"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim() || pending}
        className="shrink-0 px-4 h-9 rounded-full bg-accent text-[color:var(--on-accent)] text-[12px] font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition"
      >
        {t.shareReplySend}
      </button>
    </div>
  );
}
