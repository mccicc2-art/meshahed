import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { displayNameOf, type FeedItem, type LoopzNewsItem } from "@/lib/data";
import { newsLine, newsSource } from "@/lib/newsLine";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LikeButton } from "./LikeButton";

/**
 * **تبويب «النشاط»** — التعليقاتُ وأخبارُنا في خطٍّ واحدٍ مرتَّبٍ بالزمن
 * (طلبُ أحمد: «اكتيفتي هو تعليقات وأخبارنا البسيطة… الأخبار تُدمج معه»).
 *
 * **وهو نقضٌ صريحٌ لجزءٍ من D-219** — كانت «تعليقات» و«خبر» تبويبين
 * منفصلين — **ونقضُ صاحب القرار قرارَه ليس تناقضاً**: التبويبان كانا
 * يقتسمان قارئاً واحداً ومحتوًى شحيحاً، **وخطّان رفيعان يجعلان كليهما
 * يبدو ميّتاً** (نفسُ حجّة رقاقتَي النطاق في D-187).
 *
 * ================= هندسةُ الصفّ =================
 *
 * **عائلةُ صفٍّ واحدة للنوعين** (طلبُ أحمد بلوحته، وقاعدةُ «لا عائلة
 * ثانية لأي شيء»):
 *
 * ```
 * [صاحبُ الكلام]  اسمٌ · متى            [ملصقُ العمل]
 *                 السطرُ الغليظ
 *                 النصّ / المصدر
 *                 الأفعال
 * ```
 *
 * **والهويّةُ في البداية والملصقُ في النهاية** — لا «يمين» و«يسار»
 * (D-216): بالعربية ينقلب الصفُّ من نفسه، والصورةُ التي رسمها أحمد
 * بالإنجليزية هي هذه بعينها معكوسة.
 *
 * **ولماذا صاحبُ الكلام في صدر الصفّ:** الفرقُ بين النوعين ليس زخرفةً بل
 * **من قال**. صفُّ الخبر يصدّره ختمُ Loopz **«كأنّه لوبز مغرّد»** (نصُّ
 * أحمد)، وصفُّ التعليق يصدّره وجهُ صاحبه — **فيُعرف مصدرُ الجملة قبل
 * قراءتها**، ولا يُخلط ما نكتبه نحن بما يكتبه الناس. **والإسنادُ في
 * الواجهة صدقٌ لا تزيين** (قاعدةُ D-213 نفسها في موضعٍ آخر).
 *
 * **والملصقُ لا الغلاف** — وأحمد عرضه خياراً. صفُّ الخطّ يحمل
 * `poster_path` وحده، **والغلافُ يعني تغييرَ دالّة `definer` (هجرة)
 * لأجل صورةٍ عرضُها ٥٦ بكسل**، والقصُّ ١٦:٩ عند هذا العرض يبتلع الوجه.
 * يعود يوم يُطلب لذاته.
 *
 * ================= ما لم يُنقض =================
 *
 * **١ · خطٌّ فاصل لا إطار** (D-220، حكمُ أحمد): صفحةٌ من بطاقاتٍ مؤطَّرة
 * تُقرأ شبكةً لا قائمة. **وأربعةُ أسطحٍ اليوم بخطٍّ فاصلٍ واحد**:
 * `WorksTalk` · `TalkThread` · هذا · وما يتبعه.
 *
 * **٢ · ❤ برقمه، و💬 بلا رقم**: عددُ الردود لا نملكه لكلِّ تعليق —
 * `title_talk_stats` تعدّ ردودَ **العمل** كلِّه، **ووضعُه تحت تعليقٍ
 * بعينه رقمٌ يُقرأ خطأً** (D-134). فـ💬 بابٌ يفتح الغرفة لا عدّاد.
 *
 * **٣ · ولا علامةَ حفظٍ** — لا يوجد عندنا «حفظُ تعليق»، **ورمزٌ يبدو
 * زرّاً ولا يفعل شيئاً أسوأ من غيابه** (D-217).
 */

/** صفٌّ في الخطّ: تعليقُ إنسانٍ أو خبرٌ من عندنا — **والزمنُ يرتّبهما معاً** */
type Row =
  | { at: number; kind: "comment"; item: FeedItem }
  | { at: number; kind: "news"; item: LoopzNewsItem };

export function ActivityFeed({
  comments,
  news,
  meId,
  emptyText,
  locale,
}: {
  comments: FeedItem[];
  /** أخبارُنا — **تُمرَّر فارغةً في نطاق «من أتابع»**، انظر الصفحة */
  news: LoopzNewsItem[];
  /** لتمييز تعليقي: مراجعتُك تعرض العدد بلا زرّ إعجاب */
  meId: string;
  /** **وفراغُ «الكل» غيرُ فراغ «من أتابع»** — الصفحةُ تملك النطاق فتملك جملته */
  emptyText: string;
  locale: Locale;
}) {
  const t = getDict(locale);

  /* **المكتوبُ وحده يدخل** — «شاهد» و«قيّم بلا نصّ» أحداثٌ بلا كلام،
     وخطٌّ من التعليقات لا يُبنى من صمت (نفسُ حارس `groupByWork`) */
  const rows: Row[] = [
    ...comments
      .filter((a) => a.review?.trim())
      .map((item) => ({
        at: Date.parse(item.updated_at) || 0,
        kind: "comment" as const,
        item,
      })),
    /* **وخبرٌ بلا صيغةٍ يسقط هنا لا عند الرسم**: لو سقط عند الرسم لظهر
       فراغٌ في موضعٍ منتظم، **والفراغُ في موضعٍ منتظم يُقرأ عطلاً** (D-181) */
    ...news
      .filter((n) => newsLine(n, t, locale) !== null)
      .map((item) => ({
        at: Date.parse(item.published_at) || 0,
        kind: "news" as const,
        item,
      })),
  ].sort((a, b) => b.at - a.at);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-10 px-5 text-center leading-relaxed">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="divide-y divide-[color:var(--divider)]">
      {rows.map((row) =>
        row.kind === "comment" ? (
          <CommentRow
            key={`c-${row.item.person.id}-${row.item.tmdb_id}-${row.item.media_type}-${row.item.day}`}
            a={row.item}
            meId={meId}
            locale={locale}
          />
        ) : (
          <NewsRow key={`n-${row.item.key}`} n={row.item} locale={locale} />
        ),
      )}
    </div>
  );
}

/* ============================ قطعُ الصفّ ============================
   **وصفةٌ لا مكوّن** (D-145): الهيكلُ واحدٌ للنوعين، فيُكتب مرّةً هنا
   ولا تُنسخ سلسلةُ الأصناف في موضعين. */

/** الملصقُ في نهاية الصفّ — يفتح صفحةَ العمل، ويحجز مقاسه فلا يقفز الصفّ (D-046) */
function EndPoster({
  href,
  posterPath,
  mediaType,
}: {
  href: string;
  posterPath: string | null;
  mediaType: "tv" | "movie";
}) {
  const src = posterUrl(posterPath, "w185");
  return (
    <Link
      href={href}
      prefetch={false}
      tabIndex={-1}
      aria-hidden
      className="shrink-0 w-14 active:opacity-80 transition"
    >
      <span className="relative block w-full aspect-[2/3] rounded-lg overflow-hidden bg-surface-2 border border-border">
        {src ? (
          <Image src={src} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-muted">
            <Icon name={mediaType === "tv" ? "tv" : "film"} size={16} />
          </span>
        )}
      </span>
    </Link>
  );
}

function CommentRow({ a, meId, locale }: { a: FeedItem; meId: string; locale: Locale }) {
  const t = getDict(locale);
  const talkHref = `/talk/${a.media_type}/${a.tmdb_id}`;
  const titleHref = `/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`;
  const who = displayNameOf(a.person, t.anonymousUser);
  /** الملفُّ إن كان له `@handle`؛ وإلّا فالغرفة — **ولا صفَّ ملفٍّ بلا اسم** (D-063) */
  const whoHref = a.person.username ? `/u/${a.person.username}` : talkHref;

  return (
    <article className="py-4 first:pt-0 flex gap-3">
      <Link href={whoHref} prefetch={false} className="shrink-0 active:opacity-80 transition">
        <Avatar
          src={a.person.hide_name ? null : a.person.avatar_url}
          name={who}
          size={36}
          alt=""
        />
      </Link>

      <div className="min-w-0 flex-1">
        {/* **ترويسةُ التغريدة**: من قال ومتى — قبل ما قيل */}
        <Link
          href={whoHref}
          prefetch={false}
          className="flex items-baseline gap-1.5 text-[11px] text-muted active:opacity-80 transition"
        >
          <span className="font-bold text-[13px] text-foreground line-clamp-1">{who}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{timeAgo(a.updated_at, t)}</span>
        </Link>

        <div className="mt-0.5 flex items-baseline gap-2">
          <Link
            href={titleHref}
            prefetch={false}
            className="font-bold text-[15px] leading-tight line-clamp-1 hover:text-accent transition"
          >
            {a.title}
          </Link>
          {/* تقييمُ صاحبِ التعليق نفسِه — **لا متوسّطَ أحد**، فلا مقامَ
              له ولا يحتاجه (قاعدةُ D-216 تخصّ المتوسّطات) */}
          {a.rating != null && (
            <span
              className="shrink-0 text-[12px] font-bold text-accent tabular-nums"
              title={t.rateOutOf(a.rating)}
            >
              ★ <span dir="ltr">{a.rating.toFixed(1)}</span>
            </span>
          )}
        </div>

        {/* الضغطُ على النصّ يفتح الغرفة — **حيث يُقرأ كاملاً ويُردّ عليه** */}
        <Link href={talkHref} prefetch={false} className="block mt-1">
          <p className="text-[13px] leading-relaxed text-foreground/85 line-clamp-3">
            {a.review}
          </p>
        </Link>

        <div className="mt-2 flex items-center gap-1">
          <LikeButton
            reviewUserId={a.person.id}
            tmdbId={a.tmdb_id}
            mediaType={a.media_type}
            likes={a.likes}
            likedByMe={a.likedByMe}
            isMine={a.person.id === meId}
            locale={locale}
          />
          <Link
            href={talkHref}
            prefetch={false}
            aria-label={t.newsDiscuss}
            title={t.newsDiscuss}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-accent transition"
          >
            <Icon name="comment" size={14} />
            {t.newsDiscuss}
          </Link>
        </div>
      </div>

      <EndPoster href={titleHref} posterPath={a.poster_path} mediaType={a.media_type} />
    </article>
  );
}

function NewsRow({ n, locale }: { n: LoopzNewsItem; locale: Locale }) {
  const t = getDict(locale);
  const text = newsLine(n, t, locale);
  if (!text) return null;
  const titleHref = `/${n.media_type === "tv" ? "show" : "movie"}/${n.tmdb_id}`;
  const src = newsSource(n);

  return (
    <article className="py-4 first:pt-0 flex gap-3">
      {/* **ختمُ Loopz في موضع الوجه** — الأيقونةُ الرسمية نفسُها، لا
          مونوغرام جديد: **الوردمارك هو الشعار** (D-039)، وعلامةٌ ثانية
          للعلامة الواحدة عيبٌ لا تمييز. */}
      <span className="shrink-0">
        <Avatar src="/icon-192.png" name="Loopz" size={36} alt="" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 text-[11px] text-muted">
          <span className="font-bold text-[13px] text-foreground" dir="ltr">
            Loopz
          </span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{timeAgo(n.published_at, t)}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{n.media_type === "tv" ? t.typeSeries : t.typeMovie}</span>
        </div>

        {/* **ولا رابطَ خارجيّ في الجملة إطلاقاً** (طلبُ أحمد الصريح):
            الضغطُ يفتح صفحةَ العمل عندنا — والقراءةُ والتعليقُ داخل التطبيق */}
        <Link
          href={titleHref}
          prefetch={false}
          className="block mt-0.5 text-[15px] leading-snug font-bold hover:text-accent transition"
        >
          {text}
        </Link>

        {/* **سطرُ النسبة** (D-213): الحدثُ من الصحافة والجملةُ من عندنا */}
        {src && (
          <p className="mt-1 text-[11px] text-muted">
            {src.url ? (
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline decoration-dotted underline-offset-2 hover:text-accent transition"
              >
                {t.newsPerSource(src.name)}
              </a>
            ) : (
              t.newsPerSource(src.name)
            )}
          </p>
        )}

        <div className="mt-2 flex items-center gap-1">
          {/* التعليقُ داخل التطبيق — بابُ الكلام القائم (D-193)، ولا
              خيطَ نقاشٍ ثالث تحت كل خبر */}
          <Link
            href={`/talk/${n.media_type}/${n.tmdb_id}`}
            prefetch={false}
            aria-label={t.newsDiscuss}
            title={t.newsDiscuss}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-accent transition"
          >
            <Icon name="comment" size={14} />
            {t.newsDiscuss}
          </Link>
        </div>
      </div>

      <EndPoster href={titleHref} posterPath={n.poster_path} mediaType={n.media_type} />
    </article>
  );
}
