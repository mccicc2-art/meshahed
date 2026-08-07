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
import { replyToShare, markConversationRead, hideConversation } from "@/lib/actions";
import { StartConversationSheet } from "./StartConversationSheet";
import type { Conversation, ConvEvent, PersonLite } from "@/lib/data";

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
  /** متابَعون متبادلون لا محادثة معهم بعد — لبدء محادثةٍ من البحث */
  startable: PersonLite[];
  openWith: string | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [query, setQuery] = useState("");
  const [startWith, setStartWith] = useState<PersonLite | null>(null);

  const nameOf = (p: PersonLite | null) =>
    !p || p.hide_name ? t.anonymousUser : p.nickname || p.username || "—";

  const open = openWith ? conversations.find((c) => c.personId === openWith) : null;
  if (open) {
    return <ConversationView conv={open} name={nameOf(open.person)} locale={locale} />;
  }

  // لا محادثاتٍ ولا من نبدأ معه: الفراغ وحده، بلا حقل بحثٍ لا معنى له
  if (conversations.length === 0 && startable.length === 0) {
    return (
      <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
        {t.inboxEmpty}
      </p>
    );
  }

  // ترشيحٌ بالاسم — يكمل محادثةً قائمة، أو **يبدأ** مع متابَعٍ متبادلٍ لم
  // تراسله. بحثٌ محلّيّ فوق المحمّل: لا طلبَ شبكةٍ لكل حرف. المحادثات تظهر
  // دائماً؛ ومن نبدأ معهم لا يظهرون إلا عند الكتابة كي لا تُغرق القائمةَ.
  const q = query.trim().toLowerCase();
  const shown = q
    ? conversations.filter((c) => nameOf(c.person).toLowerCase().includes(q))
    : conversations;
  const startShown = q
    ? startable.filter((p) => nameOf(p).toLowerCase().includes(q))
    : [];
  const nothing = q !== "" && shown.length === 0 && startShown.length === 0;

  return (
    <div>
      {/* حقلُ بحثٍ يتصدّر القائمة: أيقونةٌ ثابتة داخل الحقل، وزرُّ مسحٍ
          يظهر عند الكتابة فقط — نفس هيكل بحث التطبيق، بلا عائلةِ تحكّمٍ جديدة */}
      <div className="relative mb-3">
        <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-muted">
          <Icon name="search" size={16} />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.convSearchPlaceholder}
          aria-label={t.convSearchPlaceholder}
          className="w-full rounded-full bg-surface-2 border border-border ps-9 pe-9 py-2 text-base outline-none focus:border-accent transition"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t.closeLabel}
            className="absolute inset-y-0 end-2 my-auto grid place-items-center w-7 h-7 rounded-full text-muted hover:text-foreground hover:bg-surface transition"
          >
            <Icon name="close" size={15} />
          </button>
        )}
      </div>

      {nothing && (
        <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
          {t.convNoMatch}
        </p>
      )}

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
                  <span className="text-[11px] text-muted shrink-0">
                    {formatDateShort(c.lastAt, t)}
                  </span>
                </span>
                <span
                  className={`block text-[13px] truncate ${
                    c.unread > 0 ? "text-foreground font-medium" : "text-muted"
                  }`}
                >
                  {preview}
                </span>
              </span>
              {c.unread > 0 && (
                <span
                  aria-label={t.communityUnreadAria(c.unread)}
                  className="shrink-0 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-[11px] font-bold tabular-nums"
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

      {/* ابدأ محادثة — متابَعون متبادلون طابق اسمُهم البحثَ ولا خيط معهم بعد.
          الضغط يفتح ورقةَ اختيار عمل، فتبدأ المحادثة بمشاركةٍ (D-051 قائمة) */}
      {startShown.length > 0 && (
        <section className="mt-5">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide px-1 mb-1.5">
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
                      <span className="block text-[13px] text-muted truncate">
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

  // فتح المحادثة يُعلّم واردها مقروءاً مرّةً — ثم يُحدَّث ليخفت العدّاد
  useEffect(() => {
    if (conv.unread > 0) {
      markConversationRead(conv.personId)
        .then(() => coalescedRefresh(router))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <button
          type="button"
          onClick={() => {
            tap(8);
            hideConversation(conv.personId)
              .then(() => router.push("/people?tab=inbox"))
              .catch((e) => flashError((e as Error).message));
          }}
          aria-label={t.convHideAria(name)}
          title={t.convHide}
          className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
        >
          <Icon name="eye-off" size={16} />
        </button>
      </div>

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
            <span className="block text-[13px] font-semibold truncate group-hover:text-accent transition">
              {event.list_name ?? "—"}
            </span>
            <span className="block text-[11px] text-muted">
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
          <span className="block text-[13px] font-semibold truncate group-hover:text-accent transition">
            {event.title ?? "—"}
          </span>
          <span className="block text-[11px] text-muted">
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
        className="shrink-0 px-4 h-9 rounded-full bg-accent text-[color:var(--on-accent)] text-[13px] font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition"
      >
        {t.shareReplySend}
      </button>
    </div>
  );
}
