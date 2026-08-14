import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { displayNameOf, type FeedItem, type LoopzNewsItem } from "@/lib/data";
import { newsLine, newsSource } from "@/lib/newsLine";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LikeButton } from "./LikeButton";
import { QuickAdd } from "./QuickAdd";
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
 * ================= هندسةُ الصفّ (D-223/D-224) =================
 *
 * **ثلاثةُ أعمدةٍ للنوعين معاً** — عائلةُ صفٍّ واحدة:
 *
 * ```
 * [الوجه ٤٤]  اسمٌ ★تقييمُه          ← ثابتٌ في القمّة
 *             النصُّ / جملةُ الخبر      [ملصقٌ ٨٤×١٢٦]
 *             «بحسب X»                 الاسمُ داخله
 *             متى · ❤ · تعليق · 🔖   ← ثابتٌ في القاع
 * ```
 *
 * **والهويّةُ في البداية والملصقُ في النهاية** — لا «يمين» و«يسار»
 * (D-216): بالعربية ينقلب الصفُّ من نفسه.
 *
 * **١ · الاسمُ في القمّة والذيلُ في القاع، ثابتين** (بلاغُ أحمد: «مرّةً
 * الاسمُ فوق ومرّةً نازل وهذا يشوّه المنظر»). **وهذا نقضٌ لتوسيطٍ شحنتُه
 * قبله بساعة** — كنتُ وزّعتُ الفراغ على الطرفين ليبدو الصفُّ متوازناً،
 * **فصار موضعُ الاسم يتبع طولَ التعليق**: سطرٌ واحدٌ يُنزله وثلاثةٌ
 * ترفعه. **والقائمةُ تُقرأ بالمَسح لا بالصفّ الواحد** — وعمودٌ لا يستقرّ
 * فيه شيء يُتعب العين أكثر مما يريحها توازنُ صفٍّ منفرد.
 * **والقاعدة: في قائمةٍ، ثباتُ المِرساة يغلب توازنَ العنصر.**
 *
 * **٢ · اسمُ العمل داخل ملصقه لا فوق النصّ** (طلبُ أحمد). **والمكسبُ
 * سطرٌ كامل يُستردّ**: كان الصفُّ يحمل الاسمَ مرّتين — مكتوباً وفي
 * الصورة. **ولا بطاقةَ ثانية تُخترع لذلك:** `PosterCard` هي التي تكتب
 * الاسم على حجابٍ متدرّج في ثمانية أسطحٍ أخرى.
 *
 * **٣ · ★ بجانب الاسم لا بجانب العنوان.** كان بجوار اسم العمل **فيُقرأ
 * تقييمَ العمل**، وهو تقييمُ صاحبِ التعليق وحده — **ورقمٌ يُقرأ خطأً أسوأ
 * من لا رقم** (D-134). وموضعُه بعد الاسم يقول الجملة كاملة: «فلانٌ أعطاه
 * ٩». **ولا مقامَ له لأنه ليس متوسّطاً** (D-216 تخصّ المتوسّطات).
 *
 * **٤ · الذيلُ: متى · إعجاب · تعليق · حفظ** (ترتيبُ أحمد نصّاً).
 * **ولا قلبَ مع الإعجاب** — سألتُ لأن «عائلةَ تفاعلٍ ثانية» مرفوضة،
 * **وحكمُ أحمد: «صادق، اللايك يكفي حالياً بدون قلب»**.
 *
 * **٥ · ولا «نوع» في الذيل** (طلبُ أحمد: «Series أو Movie تدخل في نفس
 * محتوى الخبر لا تكون لحالها»). **وهو صحيح:** جملةُ الخبر تقولها أصلاً
 * («موسم ٢»، «في الصالات») — **وكلمةٌ تكرّر ما قرأه القارئ للتوّ ضجيج.**
 *
 * ================= ما لم يُنقض =================
 *
 * **خطٌّ فاصل لا إطار** (D-220، حكمُ أحمد) · **💬 بلا رقم** (عددُ الردود
 * لا نملكه لكلِّ تعليق) · **ولا علامةَ حفظٍ للتعليق** — المِرجَعيةُ هنا
 * تحفظ **العمل** لا الكلام، و«حفظُ تعليق» فعلٌ غيرُ مبنيّ (D-217).
 */

/** صفٌّ في الخطّ: تعليقُ إنسانٍ أو خبرٌ من عندنا — **والزمنُ يرتّبهما معاً** */
type Row =
  | { at: number; kind: "comment"; item: FeedItem }
  | { at: number; kind: "news"; item: LoopzNewsItem };

/** ارتفاعُ الصفّ = ارتفاعُ الملصق: عرضٌ ثابت ونسبة `2:3` (٨٤ × ١٢٦) */
const POSTER_W = "w-[84px]";
const ROW_MIN_H = "min-h-[126px]";

/** إعجاباتُ خبرِنا — عددٌ لكلّ عمل، وما أعجبتُ به أنا (`post_reactions`) */
export type PostLikes = { counts: Record<string, number>; mine: ReadonlySet<string> };

export function ActivityFeed({
  comments,
  news,
  meId,
  followed = new Set<string>(),
  postLikes,
  emptyText,
  locale,
}: {
  comments: FeedItem[];
  /** أخبارُنا — **تُمرَّر فارغةً في نطاق «من أتابع»**، انظر الصفحة */
  news: LoopzNewsItem[];
  /** لتمييز تعليقي: مراجعتُك تعرض العدد بلا زرّ إعجاب */
  meId: string;
  /**
   * مفاتيحُ `"<media>-<tmdb>"` لما في مكتبة القارئ — حالةُ المِرجَعية.
   *
   * **اختياريٌّ لأن المكوّن يُشحن قبل مستهلكه** (D-028)، **والغيابُ يُظهر
   * «احفظ» لا «محفوظ»** — وهو الاتجاه الآمن: أوّلُ لمسةٍ تُصلحه بـ`upsert`.
   */
  followed?: ReadonlySet<string>;
  /** إعجاباتُ الأخبار — تُقرأ في الصفحة بنداءٍ واحدٍ للقائمة كلِّها */
  postLikes?: PostLikes;
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
      {rows.map((row) => {
        const key = `${row.item.media_type}-${row.item.tmdb_id}`;
        return row.kind === "comment" ? (
          <CommentRow
            key={`c-${row.item.person.id}-${key}-${row.item.day}`}
            a={row.item}
            meId={meId}
            added={followed.has(key)}
            locale={locale}
          />
        ) : (
          <NewsRow
            key={`n-${row.item.key}`}
            n={row.item}
            added={followed.has(key)}
            likes={postLikes?.counts[key] ?? 0}
            likedByMe={postLikes?.mine.has(key) ?? false}
            locale={locale}
          />
        );
      })}
    </div>
  );
}

/* ============================ قطعُ الصفّ ============================
   **وصفةٌ لا مكوّن** (D-145): الهيكلُ واحدٌ للنوعين، فيُكتب مرّةً هنا
   ولا تُنسخ سلسلةُ الأصناف في موضعين. */

/**
 * عمودُ الملصق — **`PosterCard` كما هي**: الاسمُ داخلها على حجابٍ متدرّج.
 *
 * **ولا `+` في زاويتها** (طلبُ أحمد): الحفظُ نزل إلى ذيل الصفّ مِرجَعيةً
 * بين الأفعال. **والحجّةُ تُقال:** على ملصقٍ عرضُه ٨٤px كان القرصُ ٣٢px
 * يأكل ثلثَ العرض ويجلس على وجه العمل — **وفي شبكة اكتشف عرضُ البطاقة
 * ضِعفُ هذا فلا يزاحم.** موضعٌ ثانٍ لأن المقاس ثانٍ، لا لأن الفعل ثانٍ.
 */
function RowPoster({
  tmdbId,
  mediaType,
  title,
  posterPath,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
}) {
  return (
    <div className={`${POSTER_W} shrink-0`}>
      <PosterCard
        href={`/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`}
        title={title}
        posterPath={posterPath}
        posterSize="w185"
        fallbackIcon={mediaType === "tv" ? "tv" : "film"}
      />
    </div>
  );
}

/**
 * ذيلُ الصفّ — **متى · إعجاب · تعليق · حفظ**، بهذا الترتيب (طلبُ أحمد).
 *
 * **والوقتُ أوّلُ الذيل لا آخرُه:** كان في الحافة المقابلة **فبَعُد عن
 * الصفّ الذي يخصّه** وقطعت عينُ القارئ الشاشةَ كلَّها لتصله. وموضعُه
 * الآن يقرأ الجملةَ كما تُقال: «قبل تسع ساعات… وهذه أفعالُك».
 *
 * **والفعلان الأخيران يخصّان العمل لا الكلام** — وهما ما يجعل الخبرَ
 * والتعليق ذيلاً واحداً: **ما يختلف بينهما شيءٌ واحد، مَن يُعجَب به.**
 */
function RowFooter({ time, children }: { time: string; children: React.ReactNode }) {
  return (
    <div className="pt-2 flex items-center gap-0.5">
      {children}
      <span className="ms-auto shrink-0 text-[11px] text-muted">{time}</span>
    </div>
  );
}

/**
 * بابُ الغرفة — **رمزٌ بلا كلمة** (طلبُ أحمد: «احذف كلمة كومنت، العلامة
 * تكفي»). **والمعنى في `aria-label` لا يسقط** (D-177): فقاعةُ الكلام عُرفٌ
 * يُقرأ بلا نصّ، **وكلمةٌ واحدة بين ثلاثة رموزٍ عارية تُخلّ بالصفّ أكثر
 * ممّا تشرح.**
 */
function CommentAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      title={label}
      className="inline-flex items-center rounded-full px-2.5 py-1.5 text-muted hover:text-accent transition"
    >
      <Icon name="comment" size={15} />
    </Link>
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
      {/* **عمودُ الهويّة: وجهُه وتحته تقييمُه** (طلبُ أحمد).
          **وهو أصدقُ موضعٍ للنجمة على الإطلاق**: كانت بجوار اسم العمل
          فتُقرأ تقييمَ العمل، ثم بجوار الاسم فتُقرأ صحيحةً — **وتحت
          وجهه تُقرأ صحيحةً بلا قراءة**، لأن ما تحت الصورة يخصّ صاحبَها.
          وعرضٌ ثابت (`w-11`) كي تتحاذى أعمدةُ الصفوف كلِّها. */}
      <div className="shrink-0 w-11 flex flex-col items-center gap-1">
        <Link href={whoHref} prefetch={false} className="active:opacity-80 transition">
          <Avatar
            src={a.person.hide_name ? null : a.person.avatar_url}
            name={who}
            size={44}
            alt=""
          />
        </Link>
        {a.rating != null && (
          <span
            className="text-[11px] font-bold text-accent tabular-nums leading-none"
            title={t.rateOutOf(a.rating)}
          >
            ★ <span dir="ltr">{a.rating.toFixed(1)}</span>
          </span>
        )}
      </div>

      {/* **`justify-between`: الاسمُ في القمّة والذيلُ في القاع مهما طال
          النصّ** — والفراغُ يقع في الوسط حيث لا مِرساةَ تهتزّ */}
      <div className={`min-w-0 flex-1 flex flex-col justify-between ${ROW_MIN_H}`}>
        <div>
          {/* **الصدرُ للاسم وحده** — والتقييمُ انتقل تحت الوجه */}
          <Link
            href={whoHref}
            prefetch={false}
            dir="auto"
            className="block font-bold text-[14px] text-foreground line-clamp-1 hover:text-accent transition"
          >
            {who}
          </Link>

          {/* الضغطُ على النصّ يفتح الغرفة — **حيث يُقرأ كاملاً ويُردّ عليه** */}
          {/* **`dir="auto"`: اتّجاهُ الكلام من الكلام لا من الصفحة**
              (طلبُ أحمد: «من يكتب بالعربي يكون عرضُه RTL»). المتصفّح يقرأ
              أوّلَ حرفٍ ذي اتجاهٍ قويّ فيحسم — **فتعليقٌ عربيّ داخل واجهةٍ
              إنجليزية يُرسم من اليمين، ونقطتُه وفاصلتُه في مكانهما.**
              **وهو أصحُّ من قراءة لغة الحساب:** الكاتبُ قد يكتب بلغةٍ غير
              لغة واجهته، **والنصُّ يعرف نفسَه ولا يحتاج من يخبره.**
              ⚠️ **ولا يوضع على جملة الخبر**: تلك جملتُنا نحن بلغة القارئ،
              وعنوانٌ عربيٌّ في أوّلها كان سيقلب سطراً إنجليزياً كاملاً. */}
          <Link href={talkHref} prefetch={false} className="block mt-1">
            <p
              dir="auto"
              className="text-[13px] leading-relaxed text-foreground/85 line-clamp-3"
            >
              {a.review}
            </p>
          </Link>
        </div>

        <RowFooter time={timeAgo(a.updated_at, t)}>
          <LikeButton
            reviewUserId={a.person.id}
            tmdbId={a.tmdb_id}
            mediaType={a.media_type}
            likes={a.likes}
            likedByMe={a.likedByMe}
            isMine={a.person.id === meId}
            locale={locale}
          />
          <CommentAction href={talkHref} label={t.actionComment} />
          <QuickAdd
            variant="inline"
            tmdbId={a.tmdb_id}
            mediaType={a.media_type}
            title={a.title ?? ""}
            posterPath={a.poster_path}
            added={added}
            locale={locale}
          />
        </RowFooter>
      </div>

      <RowPoster
        tmdbId={a.tmdb_id}
        mediaType={a.media_type}
        title={a.title ?? ""}
        posterPath={a.poster_path}
      />
    </article>
  );
}

function NewsRow({
  n,
  added,
  likes,
  likedByMe,
  locale,
}: {
  n: LoopzNewsItem;
  added: boolean;
  likes: number;
  likedByMe: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const text = newsLine(n, t, locale);
  if (!text) return null;
  const titleHref = `/${n.media_type === "tv" ? "show" : "movie"}/${n.tmdb_id}`;
  const talkHref = `/talk/${n.media_type}/${n.tmdb_id}`;
  const src = newsSource(n);

  return (
    <article className="py-4 first:pt-0 flex gap-3">
      {/* **ختمُ Loopz في موضع الوجه** — الأيقونةُ الرسمية نفسُها، لا
          مونوغرام جديد: **الوردمارك هو الشعار** (D-039)، وعلامةٌ ثانية
          للعلامة الواحدة عيبٌ لا تمييز. */}
      {/* نفسُ عرض عمود الهويّة في صفّ التعليق — **فتتحاذى الصفوف كلُّها**
          وإن لم يكن للخبر تقييمٌ تحته */}
      <span className="shrink-0 w-11">
        <Avatar src="/icon-192.png" name="Loopz" size={44} alt="" />
      </span>

      <div className={`min-w-0 flex-1 flex flex-col justify-between ${ROW_MIN_H}`}>
        <div>
          <span className="block font-bold text-[14px] text-foreground" dir="ltr">
            Loopz
          </span>

          {/* **وصوتُنا لا يعلو على صوت الناس**: جملةُ الخبر بمقاس نصّ
              التعليق نفسِه — **وسطرٌ لنا أغلظ من كلام إنسانٍ يقلب معنى
              الصفحة**. **ولا رابطَ خارجيّ فيها** (طلبُ أحمد الصريح):
              الضغطُ يفتح صفحةَ العمل عندنا. */}
          <Link
            href={titleHref}
            prefetch={false}
            className="block mt-1 text-[13px] leading-relaxed font-semibold hover:text-accent transition line-clamp-3"
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
        </div>

        <RowFooter time={timeAgo(n.published_at, t)}>
          {/* **إعجابٌ على خبرِنا** — `post_reactions` القائم منذ `news.sql`
              (D-224). **وهو قرارُ 🔥 المرفوض وقد صُحِّح لا نُقض:** الرفضُ
              كان أن «🔥 هي الإعجابُ نفسه بأيقونةٍ أخرى» — **فرُسمت
              بأيقونة الإعجاب**، عائلةً واحدة برمزٍ واحد. */}
          <LikeButton
            target="post"
            tmdbId={n.tmdb_id}
            mediaType={n.media_type}
            likes={likes}
            likedByMe={likedByMe}
            isMine={false}
            locale={locale}
          />
          <CommentAction href={talkHref} label={t.actionComment} />
          <QuickAdd
            variant="inline"
            tmdbId={n.tmdb_id}
            mediaType={n.media_type}
            title={n.title}
            posterPath={n.poster_path}
            added={added}
            locale={locale}
          />
        </RowFooter>
      </div>

      <RowPoster
        tmdbId={n.tmdb_id}
        mediaType={n.media_type}
        title={n.title}
        posterPath={n.poster_path}
      />
    </article>
  );
}
