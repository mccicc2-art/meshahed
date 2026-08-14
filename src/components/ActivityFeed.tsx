import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { displayNameOf, type FeedItem, type LoopzNewsItem } from "@/lib/data";
import { newsLine, newsSource } from "@/lib/newsLine";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LikeButton } from "./LikeButton";
import { PosterCard } from "./PosterCard";

/**
 * **تبويب «النشاط»** — التعليقاتُ وأخبارُنا في خطٍّ واحدٍ مرتَّبٍ بالزمن
 * (طلبُ أحمد: «اكتيفتي هو تعليقات وأخبارنا البسيطة… الأخبار تُدمج معه»).
 *
 * **وهو نقضٌ صريحٌ لجزءٍ من D-219** — كانت «تعليقات» و«خبر» تبويبين
 * منفصلين — **ونقضُ صاحب القرار قرارَه ليس تناقضاً**: التبويبان كانا
 * يقتسمان قارئاً واحداً ومحتوًى شحيحاً، **وخطّان رفيعان يجعلان كليهما
 * يبدو ميّتاً** (نفسُ حجّة رقاقتَي النطاق في D-187).
 *
 * ================= هندسةُ الصفّ (D-223) =================
 *
 * **ثلاثةُ أعمدةٍ للنوعين معاً** — عائلةُ صفٍّ واحدة، وهندستان في قائمةٍ
 * واحدة تُقرأ سطحين لا سطحاً:
 *
 * ```
 * [الوجه]  اسمٌ ★تقييمُه              [بطاقةُ الملصق]
 *          النصُّ / جملةُ الخبر         الاسمُ داخلها
 *          «بحسب X»                    و«+ للمشاهدة» في زاويتها
 *          ❤ · 💬 ردّ ⋯ نوعٌ · متى
 * ```
 *
 * **والهويّةُ في البداية والملصقُ في النهاية** — لا «يمين» و«يسار»
 * (D-216): بالعربية ينقلب الصفُّ من نفسه.
 *
 * **١ · اسمُ العمل داخل ملصقه لا فوق النصّ** (طلبُ أحمد). **والمكسبُ
 * ليس ترتيباً بل سطرٌ كامل يُستردّ**: كان الصفُّ يحمل الاسمَ مرّتين —
 * مكتوباً وفي الصورة — **فصار العمودُ الأوسط لصاحب الكلام وحده.**
 * **ولا بطاقةَ ثانية تُخترع لذلك:** `PosterCard` هي التي تكتب الاسم على
 * حجابٍ متدرّج في ثمانية أسطحٍ أخرى، فأُعيد استعمالُها كما هي.
 *
 * **٢ · «+ للمشاهدة» على الملصق** (D-205/D-207، طلبُ أحمد هنا): **الحفظُ
 * الذي لا يقطع القراءة**. ومن قرأ رأياً في عملٍ لا يملكه فهذه لحظتُه —
 * **وهي اللحظةُ نفسُها التي بُني لها الزرُّ في اكتشف.**
 * ⚠️ **و`added` من `getFollows()` المخزَّنة في الصفحة** لا من نداءٍ لكل
 * صفّ (D-205)، **ولا زرَّ «شاهدته» بجانبه**: التأشيرُ يفتح ورقةَ تقييمٍ
 * في وجه من كان يقرأ (a04، مرفوض).
 *
 * **٣ · ★ بجانب الاسم لا بجانب العنوان.** كان بجوار اسم العمل **فيُقرأ
 * تقييمَ العمل**، وهو تقييمُ صاحبِ التعليق وحده — **ورقمٌ يُقرأ خطأً أسوأ
 * من لا رقم** (D-134). وموضعُه بعد الاسم يقول الجملة كاملة: «فلانٌ أعطاه
 * ٩». **ولا مقامَ له لأنه ليس متوسّطاً** (D-216 تخصّ المتوسّطات).
 *
 * **٤ · الوقتُ في آخر سطر** (طلبُ أحمد). **وهو الأصحّ لا الأجمل فقط:**
 * الصدرُ للهويّة والقلبُ للكلام، **والزمنُ بيانُ حاشيةٍ لا عنوان** —
 * فمكانُه مع النوع في ذيل الصفّ، بعد الأفعال.
 *
 * **٥ · «ردّ» لا «ناقشه» على التعليق** (طلبُ أحمد: «الشخص بيعلّق على
 * تقييمه»). **والكلمتان تبقيان اثنتين لأن الفعلين اثنان:** على تعليقٍ
 * أنت تردّ على إنسان (`talkReply`، ونفسُ كلمة `TalkThread` — مفردةٌ
 * واحدة للفعل الواحد)، وعلى خبرٍ أنت تفتح نقاشَ العمل (`newsDiscuss`).
 * **وتوحيدُهما كان سيجعل إحداهما تكذب.**
 *
 * **٦ · ارتفاعُ الصفّ من الملصق** (طلبُ أحمد: «البوستر يساوي ارتفاع
 * الردّ»): الملصقُ نسبةٌ ثابتة `2:3` بعرضٍ ثابت، **والعمودُ الأوسط يبلغ
 * ارتفاعَه بحدٍّ أدنى والذيلُ يهبط إلى قاعه** (`mt-auto`).
 * **ولم يُمدَّد الملصقُ ليطابق النصّ** — كان كلُّ صفٍّ سيقصّ ملصقَه قصّاً
 * مختلفاً بحسب طول التعليق، **وقصٌّ متغيّر يجعل القائمة تهتزّ.**
 *
 * ================= ما لم يُنقض =================
 *
 * **خطٌّ فاصل لا إطار** (D-220، حكمُ أحمد) · **❤ برقمه و💬 بلا رقم**
 * (عددُ الردود لا نملكه لكلِّ تعليق؛ `title_talk_stats` تعدّ ردودَ العمل
 * كلِّه) · **ولا علامةَ حفظٍ** حتى يُبنى الفعل (D-217).
 */

/** صفٌّ في الخطّ: تعليقُ إنسانٍ أو خبرٌ من عندنا — **والزمنُ يرتّبهما معاً** */
type Row =
  | { at: number; kind: "comment"; item: FeedItem }
  | { at: number; kind: "news"; item: LoopzNewsItem };

/** ارتفاعُ الصفّ = ارتفاعُ الملصق: عرضٌ ثابت ونسبة `2:3` (٨٤ × ١٢٦) */
const POSTER_W = "w-[84px]";
const ROW_MIN_H = "min-h-[126px]";

export function ActivityFeed({
  comments,
  news,
  meId,
  followed = new Set<string>(),
  emptyText,
  locale,
}: {
  comments: FeedItem[];
  /** أخبارُنا — **تُمرَّر فارغةً في نطاق «من أتابع»**، انظر الصفحة */
  news: LoopzNewsItem[];
  /** لتمييز تعليقي: مراجعتُك تعرض العدد بلا زرّ إعجاب */
  meId: string;
  /**
   * مفاتيحُ `"<media>-<tmdb>"` لما في مكتبة القارئ — حالةُ «+» الابتدائية.
   *
   * **اختياريٌّ لأن المكوّن يُشحن قبل مستهلكه** (D-028: كل دفعة تُصرَّف
   * وحدها)، **والغيابُ يُظهر «+» لا «✓»** — وهو الاتجاه الآمن: أوّلُ لمسةٍ
   * تُصلحه بـ`upsert`، بينما «✓» كاذبة تمنع الحفظ (نفسُ حجّة D-205).
   */
  followed?: ReadonlySet<string>;
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
            added={followed.has(`${row.item.media_type}-${row.item.tmdb_id}`)}
            locale={locale}
          />
        ) : (
          <NewsRow
            key={`n-${row.item.key}`}
            n={row.item}
            added={followed.has(`${row.item.media_type}-${row.item.tmdb_id}`)}
            locale={locale}
          />
        ),
      )}
    </div>
  );
}

/* ============================ قطعُ الصفّ ============================
   **وصفةٌ لا مكوّن** (D-145): الهيكلُ واحدٌ للنوعين، فيُكتب مرّةً هنا
   ولا تُنسخ سلسلةُ الأصناف في موضعين. */

/**
 * عمودُ الملصق — **`PosterCard` كما هي**: الاسمُ داخلها على حجابٍ متدرّج،
 * و«+ للمشاهدة» في زاويتها. **ولا `badge` عليها**: شارةٌ فوق ملصقٍ عرضُه
 * ٨٤px تأكل الصورة، **وتقييمُ صاحبِ التعليق ليس تقييمَ العمل** فلا يُوضع
 * على وجهه.
 */
function RowPoster({
  tmdbId,
  mediaType,
  title,
  posterPath,
  added,
  locale,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  added: boolean;
  locale: Locale;
}) {
  return (
    <div className={`${POSTER_W} shrink-0`}>
      <PosterCard
        href={`/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`}
        title={title}
        posterPath={posterPath}
        posterSize="w185"
        fallbackIcon={mediaType === "tv" ? "tv" : "film"}
        quickAdd={{ tmdbId, mediaType, added, locale }}
      />
    </div>
  );
}

/** ذيلُ الصفّ — الأفعالُ في البداية، والنوعُ والوقتُ في النهاية */
function RowFooter({ children, meta }: { children: React.ReactNode; meta: string }) {
  return (
    <div className="mt-auto pt-2 flex items-center gap-1">
      {children}
      <span className="ms-auto shrink-0 text-[11px] text-muted">{meta}</span>
    </div>
  );
}

function CommentRow({
  a,
  meId,
  added,
  locale,
}: {
  a: FeedItem;
  meId: string;
  added: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const talkHref = `/talk/${a.media_type}/${a.tmdb_id}`;
  const who = displayNameOf(a.person, t.anonymousUser);
  /** الملفُّ إن كان له `@handle`؛ وإلّا فالغرفة — **ولا صفَّ ملفٍّ بلا اسم** (D-063) */
  const whoHref = a.person.username ? `/u/${a.person.username}` : talkHref;

  return (
    <article className="py-4 first:pt-0 flex gap-3">
      <Link href={whoHref} prefetch={false} className="shrink-0 active:opacity-80 transition">
        <Avatar
          src={a.person.hide_name ? null : a.person.avatar_url}
          name={who}
          size={44}
          alt=""
        />
      </Link>

      <div className={`min-w-0 flex-1 flex flex-col ${ROW_MIN_H}`}>
        {/* **الصدرُ للهويّة**: من قال، وبكم قيّمه */}
        <div className="flex items-baseline gap-2">
          <Link
            href={whoHref}
            prefetch={false}
            className="font-bold text-[14px] text-foreground line-clamp-1 hover:text-accent transition"
          >
            {who}
          </Link>
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

        <RowFooter meta={timeAgo(a.updated_at, t)}>
          <LikeButton
            reviewUserId={a.person.id}
            tmdbId={a.tmdb_id}
            mediaType={a.media_type}
            likes={a.likes}
            likedByMe={a.likedByMe}
            isMine={a.person.id === meId}
            locale={locale}
          />
          {/* **«ردّ» لا «ناقشه»** — الوجهةُ إنسانٌ كتب، لا موضوعٌ يُفتح */}
          <Link
            href={talkHref}
            prefetch={false}
            aria-label={t.talkReply}
            title={t.talkReply}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-muted hover:text-accent transition"
          >
            <Icon name="comment" size={14} />
            {t.talkReply}
          </Link>
        </RowFooter>
      </div>

      <RowPoster
        tmdbId={a.tmdb_id}
        mediaType={a.media_type}
        title={a.title ?? ""}
        posterPath={a.poster_path}
        added={added}
        locale={locale}
      />
    </article>
  );
}

function NewsRow({ n, added, locale }: { n: LoopzNewsItem; added: boolean; locale: Locale }) {
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
        <Avatar src="/icon-192.png" name="Loopz" size={44} alt="" />
      </span>

      <div className={`min-w-0 flex-1 flex flex-col ${ROW_MIN_H}`}>
        <span className="font-bold text-[14px] text-foreground" dir="ltr">
          Loopz
        </span>

        {/* **ولا رابطَ خارجيّ في الجملة إطلاقاً** (طلبُ أحمد الصريح):
            الضغطُ يفتح صفحةَ العمل عندنا — والقراءةُ والتعليقُ داخل التطبيق */}
        <Link
          href={titleHref}
          prefetch={false}
          className="block mt-1 text-[14px] leading-snug font-bold hover:text-accent transition line-clamp-3"
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

        <RowFooter
          meta={`${n.media_type === "tv" ? t.typeSeries : t.typeMovie} · ${timeAgo(n.published_at, t)}`}
        >
          {/* **«ناقشه» لا «ردّ»** — لا أحدَ يُردّ عليه في خبر؛ والبابُ
              بابُ الكلام القائم (D-193)، ولا خيطَ نقاشٍ ثالث تحت كل خبر */}
          <Link
            href={`/talk/${n.media_type}/${n.tmdb_id}`}
            prefetch={false}
            aria-label={t.newsDiscuss}
            title={t.newsDiscuss}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-muted hover:text-accent transition"
          >
            <Icon name="comment" size={14} />
            {t.newsDiscuss}
          </Link>
        </RowFooter>
      </div>

      <RowPoster
        tmdbId={n.tmdb_id}
        mediaType={n.media_type}
        title={n.title}
        posterPath={n.poster_path}
        added={added}
        locale={locale}
      />
    </article>
  );
}
