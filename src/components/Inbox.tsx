"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { getDict, type Locale } from "@/lib/i18n";
import { posterUrl } from "@/lib/media";
import { formatDateShort } from "@/lib/when";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import { coalescedRefresh } from "@/lib/refresh";
import { replyToShare, hideShare, markSharesRead } from "@/lib/actions";
import type { ShareThread, ShareReply, PersonLite } from "@/lib/data";

/**
 * تبويب «الرسائل» — خيوط مشاركةِ عملٍ، الأحدث أولاً.
 *
 * كلٌّ معلّقٌ بعملٍ بعينه: لا محادثة تبدأ من فراغ (shares.sql). الرسالة =
 * عملٌ + سطر، والردّ أسطرٌ تحته. القراءة تُعلَّم **عند فتح التبويب لا لكل
 * صفّ**: فتحُ التبويب هو تركيب هذا المكوّن، فتُستدعى `markSharesRead` مرّةً
 * ثم يُحدَّث الخادم كي تنطفئ شارة العدّاد فوق التبويب.
 *
 * الحالة محليّة كي يظهر الردّ والإخفاء فوريّاً بلا انتظار الشبكة؛ والكتابة
 * خلفها، وإن فشلت رجعت الحالة.
 */
export function Inbox({
  threads: initial,
  locale,
}: {
  threads: ShareThread[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [threads, setThreads] = useState(initial);

  // فتحُ التبويب = تركيب المكوّن: تُعلَّم كل الوارد مقروءاً مرّةً واحدة، ثم
  // يُحدَّث الخادم لتنطفئ الشارة. مصفوفة اعتماداتٍ فارغة فلا حلقة تكرار
  useEffect(() => {
    if (initial.some((s) => s.isIncoming && !s.read_at)) {
      markSharesRead()
        .then(() => coalescedRefresh(router))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nameOf(p: PersonLite | null) {
    if (!p || p.hide_name) return t.anonymousUser;
    return p.nickname || p.username || "—";
  }

  function onReplied(shareId: string, reply: ShareReply) {
    setThreads((prev) =>
      prev.map((s) => (s.id === shareId ? { ...s, replies: [...s.replies, reply] } : s)),
    );
  }

  function onHidden(shareId: string) {
    setThreads((prev) => prev.filter((s) => s.id !== shareId));
  }

  if (threads.length === 0) {
    return (
      <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
        {t.inboxEmpty}
      </p>
    );
  }

  return (
    <div className="divide-y divide-[color:var(--divider)]">
      {threads.map((s) => (
        <ShareCard
          key={s.id}
          share={s}
          locale={locale}
          name={nameOf(s.isIncoming ? s.sender : s.recipient)}
          nameOf={nameOf}
          onReplied={onReplied}
          onHidden={onHidden}
        />
      ))}
    </div>
  );
}

/** كم ردّاً يُعرض قبل الطيّ */
const REPLY_PREVIEW = 3;

function ShareCard({
  share,
  locale,
  name,
  nameOf,
  onReplied,
  onHidden,
}: {
  share: ShareThread;
  locale: Locale;
  name: string;
  nameOf: (p: PersonLite | null) => string;
  onReplied: (shareId: string, reply: ShareReply) => void;
  onHidden: (shareId: string) => void;
}) {
  const t = getDict(locale);
  const other = share.isIncoming ? share.sender : share.recipient;
  const poster = posterUrl(share.poster_path, "w185");
  const href = `/${share.media_type === "tv" ? "show" : "movie"}/${share.tmdb_id}`;

  // خيطٌ طويل يُطوى: تُعرض آخر ثلاثة ردود، والبقية خلف زرّ — المحادثة
  // تُقرأ من أحدثها، لا من أوّلها
  const [expanded, setExpanded] = useState(false);
  const total = share.replies.length;
  const collapsed = total > REPLY_PREVIEW && !expanded;
  const shown = collapsed ? share.replies.slice(total - REPLY_PREVIEW) : share.replies;

  return (
    <article className="py-4 first:pt-0">
      {/* رأس الخيط: صاحبه، الاتجاه، التاريخ، وإخفاءٌ من جهتي */}
      <div className="flex items-center gap-3">
        <Avatar
          src={other?.hide_name ? null : other?.avatar_url ?? null}
          name={name}
          size={34}
          alt={t.avatarAlt}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">
            {share.isIncoming ? t.inboxFromOther(name) : t.inboxFromYou(name)}
          </p>
          <p className="text-[11px] text-muted">{formatDateShort(share.created_at, t)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            tap(8);
            onHidden(share.id);
            hideShare(share.id).catch((e) => flashError((e as Error).message));
          }}
          aria-label={t.shareHideAria}
          title={t.shareHide}
          className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
        >
          <Icon name="eye-off" size={16} />
        </button>
      </div>

      {/* العمل المُشارَك: ملصقٌ صغير واسمٌ ونوع، رابطٌ إلى صفحته */}
      <Link
        href={href}
        prefetch={false}
        className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5 hover:bg-surface-2 transition group"
      >
        <span className="relative block w-11 shrink-0 aspect-[2/3] rounded-md overflow-hidden bg-surface-2">
          {poster ? (
            <Image src={poster} alt="" fill sizes="44px" className="object-cover" />
          ) : (
            <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
              <Icon name="film" size={14} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold truncate group-hover:text-accent transition">
            {share.title ?? "—"}
          </span>
          <span className="block text-[11px] text-muted">
            {share.media_type === "tv" ? t.typeSeries : t.typeMovie}
          </span>
        </span>
      </Link>

      {/* السطر المرافق — إن وُجد */}
      {share.note && (
        <p className="mt-2.5 text-[15px] leading-relaxed whitespace-pre-line">{share.note}</p>
      )}

      {/* خيط الردود */}
      {total > 0 && (
        <div className="mt-3 space-y-2 ps-3 border-s-2 border-[color:var(--divider)]">
          {collapsed && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-[12px] font-semibold text-accent hover:brightness-110"
            >
              {t.shareShowReplies(total)}
            </button>
          )}
          {shown.map((r) => (
            <div key={r.id} className="text-[13px]">
              <span className="font-semibold">{nameOf(r.author)}</span>{" "}
              <span className="text-foreground/90 whitespace-pre-line break-words">{r.body}</span>
            </div>
          ))}
        </div>
      )}

      <ReplyBox share={share} locale={locale} onReplied={onReplied} />
    </article>
  );
}

/** حقلُ ردٍّ قصير أسفل الخيط — تفاؤليّ، والكتابة خلفه */
function ReplyBox({
  share,
  locale,
  onReplied,
}: {
  share: ShareThread;
  locale: Locale;
  onReplied: (shareId: string, reply: ShareReply) => void;
}) {
  const t = getDict(locale);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const idRef = useRef(0);

  function submit() {
    const body = value.trim();
    if (!body || pending) return;
    tap(8);
    // ردٌّ مؤقّت يظهر فوراً؛ يُستبدل بما يعود من الخادم عند التحديث التالي
    const optimistic: ShareReply = {
      id: `tmp-${idRef.current++}`,
      author_id: "me",
      author: null,
      body,
      created_at: new Date().toISOString(),
    };
    onReplied(share.id, optimistic);
    setValue("");
    start(async () => {
      try {
        await replyToShare(share.id, body);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <div className="mt-3 flex items-center gap-2">
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
        /* ١٦ بكسلاً كي لا يكبّر سفاري iOS الصفحة عند التركيز */
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
