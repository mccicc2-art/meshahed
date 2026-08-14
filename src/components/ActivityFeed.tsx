import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgoShort } from "@/lib/when";
import { displayNameOf, type FeedItem, type LoopzNewsItem } from "@/lib/data";
import { newsLine, newsSource } from "@/lib/newsLine";
import type { TalkStat } from "@/lib/data";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LikeButton } from "./LikeButton";
import { PosterCard } from "./PosterCard";
import { ShareTitleButton } from "./ShareTitleButton";
import { ProfileMenu } from "./ProfileMenu";
import { RowComment } from "./RowComment";

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

/**
 * **اتّجاهُ نصٍّ من أوّل حرفٍ قويّ فيه** — بديلُ `dir="auto"` حين لا يكون
 * النصُّ أوّلَ ما في الفقرة (انظر `CommentRow`).
 *
 * **والمدى يشمل العربية والفارسية والعبرية معاً** — لا العربيةَ وحدها:
 * قاعدةٌ تُكتب لحرفٍ واحد تُكسَر بأوّل مستخدمٍ يكتب بغيره.
 */
const RTL_FIRST = /^[^\p{L}]*[\p{Script=Arabic}\p{Script=Hebrew}]/u;
function dirOf(text: string | null): "rtl" | "ltr" {
  return text && RTL_FIRST.test(text) ? "rtl" : "ltr";
}

/** صفٌّ في الخطّ: تعليقُ إنسانٍ أو خبرٌ من عندنا — **والزمنُ يرتّبهما معاً** */
type Row =
  | { at: number; kind: "comment"; item: FeedItem }
  | { at: number; kind: "news"; item: LoopzNewsItem };

/**
 * ارتفاعُ الصفّ = ارتفاعُ الملصق: عرضٌ ثابت ونسبة `2:3` (٩٢ × ١٣٨).
 *
 * **رحلةُ رقمين تُقال لأنها تشرح القاعدة:** ٨٤ ← ٧٢ ← ٩٢. ضُيِّق أوّلاً
 * لأن الصفَّ كان يبدو فارغاً، **ثم وُسِّع لمّا صار النصُّ يمرّ تحت الوجه
 * بعرض العمود كلِّه** (D-228) فامتلأ الصفُّ من نفسه.
 * **والقاعدة: مقاسُ الملصق يتبع كثافةَ الصفّ لا ذوقاً في المقاس** —
 * وكلُّ تغييرٍ في تدفّق النصّ يعيد فتح السؤال.
 */
const POSTER_W = "w-[92px]";
const ROW_MIN_H = "min-h-[138px]";

/** إعجاباتُ خبرِنا — عددٌ لكلّ عمل، وما أعجبتُ به أنا (`post_reactions`) */
export type PostLikes = { counts: Record<string, number>; mine: ReadonlySet<string> };

export function ActivityFeed({
  comments,
  news,
  meId,
  followed = new Set<string>(),
  postLikes,
  stats,
  followingIds,
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
  /** عدّاداتُ العمل (كم شاهده) — نداءٌ واحد لكل الصفوف (D-193) */
  stats?: Map<string, TalkStat>;
  /** مَن أتابعهم — لصفّ المتابعة في قائمة النقاط (نداءٌ واحدٌ مخزَّن) */
  followingIds?: ReadonlySet<string>;
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
            watchers={stats?.get(key)?.watchers ?? 0}
            iFollowThem={followingIds?.has(row.item.person.id) ?? false}
            locale={locale}
          />
        ) : (
          <NewsRow
            key={`n-${row.item.key}`}
            n={row.item}
            added={followed.has(key)}
            watchers={stats?.get(key)?.watchers ?? 0}
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
      {/* **`hideTitle`** (D-225، بلاغُ أحمد): فنُّ الملصق يحمل العنوان في
          تصميمه، **فحجابُنا كان يكتبه ثانيةً على وجهه**. والاسمُ انتقل
          إلى سطر الترويسة للتعليق، **وجملةُ الخبر تقوله أصلاً للخبر** —
          فلا ملصقَ بلا اسمٍ في سياقٍ بلا اسم. */}
      <PosterCard
        href={`/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`}
        title={title}
        posterPath={posterPath}
        posterSize="w185"
        fallbackIcon={mediaType === "tv" ? "tv" : "film"}
        hideTitle
        /* **الخيطُ الرماديّ يقول «عندك»** (D-229) — والأخضرُ لا يُرسم هنا
           لأن الخطَّ لا يقرأ «شوهد كاملاً»؛ يعود يوم يقرأه. */
        saved={added}
        /* **الضغطُ المطوَّل بأفعاله الثلاثة** — وهو بديلُ المِرجَعية التي
           غادرت الذيل (D-229، طلبُ أحمد) */
        hold={{ tmdbId, mediaType, added, watched: false, locale }}
      />
    </div>
  );
}

/** عدّادٌ صغيرٌ برمزه — **والصفرُ لا يُرسم** (D-222) */
function StatChip({ icon, n, label }: { icon: "chart"; n: number; label: string }) {
  if (n <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1 text-[12px] text-muted tabular-nums"
      title={label}
      aria-label={`${label}: ${n}`}
    >
      <Icon name={icon} size={14} />
      {n}
    </span>
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
function RowFooter({ children }: { children: React.ReactNode }) {
  return (
    /* **شريطٌ موزَّعٌ بعرض العمود كلِّه** (D-232، بلاغُ أحمد: «راحت يسار
       بزيادة… خلّها متوازنة مع صورة الشخص ومع الثلاث نقاط»).
       **والسقفُ ٢٦٠px كان الخطأ**: شريطٌ مسقوفٌ في عمودٍ عريضٍ يبدأ من
       حافةٍ وينتهي في الهواء — **فلا يحاذي شيئاً**. الآن أوّلُ رمزٍ فوق
       حافة الوجه وآخرُه تحت النقاط، **فالصفُّ مربوطٌ بمِرساتين لا بواحدة**.
       **و`-mx-2.5` تُلغي حشوةَ الزرّ عند الطرفين** فتتحاذى **الرموزُ**
       لا صناديقُها — وهي متماثلةٌ فلا تنقلب في RTL (D-216). */
    <div className="pt-2 -mx-1.5 flex items-center justify-between">{children}</div>
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
  watchers,
  iFollowThem,
  locale,
}: {
  a: FeedItem;
  meId: string;
  added: boolean;
  watchers: number;
  iFollowThem: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const talkHref = `/talk/${a.media_type}/${a.tmdb_id}`;
  const titleHref = `/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`;
  const who = displayNameOf(a.person, t.anonymousUser);
  /** الملفُّ إن كان له `@handle`؛ وإلّا فالغرفة — **ولا صفَّ ملفٍّ بلا اسم** (D-063) */
  const whoHref = a.person.username ? `/u/${a.person.username}` : talkHref;

  return (
    <article className="py-4 first:pt-0 flex gap-3">
      {/* **العمودُ الأيسر يحمل الصفَّ كلَّه، والملصقُ وحده خارجه** (D-228).
          **والنصُّ يمرّ تحت الوجه لا بجانبه** (بلاغُ أحمد: «المساحة تحت
          صورة الشخص نحتاجها ضمن مساحة التعليق») — **فالوجهُ يجاور
          الترويسةَ وحدها**، وما تحته عرضٌ يُستردّ للكلام. */}
      <div className={`min-w-0 flex-1 flex flex-col ${ROW_MIN_H}`}>
        {/* ===== الترويسة: وجهٌ · اسمٌ / عملٌ ★ · عمرٌ · نقاط ===== */}
        <div className="flex items-center gap-2.5">
          <Link
            href={whoHref}
            prefetch={false}
            className="shrink-0 active:opacity-80 transition"
          >
            <Avatar
              src={a.person.hide_name ? null : a.person.avatar_url}
              name={who}
              size={44}
              alt=""
            />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {/* ⚠️ **ولا `dir="auto"` على الاسم** — كان عليه فطار اسمٌ
                  لاتينيّ إلى الطرف المقابل في الواجهة العربية (بلاغُ
                  أحمد). **`bdi` هي الأداة**: تعزل اتّجاهَ الاسم داخلَه
                  ولا تمسّ محاذاةَ السطر. */}
              <Link
                href={whoHref}
                prefetch={false}
                className="min-w-0 truncate font-bold text-[14px] leading-tight text-foreground hover:text-accent transition"
              >
                <bdi>{who}</bdi>
              </Link>
              {/* **العمرُ مختصرٌ ملاصقٌ للنقاط** (طلبُ أحمد): `6d` لا «قبل
                  ستّة أيام» — **جملةٌ في موضعِ وسمٍ تسرق العرضَ من الاسم
                  فيُقصّ**، والترويسةُ تحمل أربعةَ أشياء في سطر. */}
              <span className="ms-auto shrink-0 text-[11px] text-muted tabular-nums">
                {timeAgoShort(a.updated_at, t)}
              </span>
              <span className="shrink-0">
                <ProfileMenu
                  person={a.person}
                  mutual={false}
                  follow={{ following: iFollowThem }}
                  variant="plain"
                  locale={locale}
                />
              </span>
            </div>

            {/* **اسمُ العمل سطرٌ ثانٍ، والتقييمُ بعده** (طلبُ أحمد):
                **عنوانٌ طويل كان يزاحم الاسمَ فيُقصّان معاً**، وسطرٌ
                خاصّ به يحلّها بلا قصّ.
                **و★ بعد العنوان لا بعد الاسم** — حكمُ أحمد بعد أربعة
                مواضع جُرِّبت. **والخطرُ الذي أخرجه من هنا أوّلَ مرّة**
                (أن يُقرأ تقييمَ العمل) **زال بأن صار للعمل سطرٌ يملكه
                صاحبُ الصفّ**: الترويسةُ كلُّها كلامُ خالد، فالنجمةُ فيها
                نجمتُه. */}
            <div className="mt-px flex items-center gap-1.5">
              <Link
                href={titleHref}
                prefetch={false}
                className="min-w-0 truncate text-[13px] text-muted hover:text-accent transition"
              >
                <bdi>{a.title}</bdi>
              </Link>
              {a.rating != null && (
                <span
                  className="shrink-0 text-[13px] font-bold text-accent tabular-nums"
                  title={t.rateOutOf(a.rating)}
                >
                  ★ <span dir="ltr">{a.rating.toFixed(1)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ===== الكلام — بعرض العمود كلِّه، تحت الوجه =====
            **اتّجاهُ الكلام من الكلام لا من الصفحة** (طلبُ أحمد): تعليقٌ
            عربيّ داخل واجهةٍ إنجليزية يُرسم من اليمين ونقطتُه في مكانها.
            **وأصحُّ من قراءة لغة الحساب**: الكاتبُ قد يكتب بغير لغة
            واجهته، **والنصُّ يعرف نفسَه ولا يحتاج من يخبره.** */}
        <Link href={talkHref} prefetch={false} className="block mt-2">
          <p
            dir={dirOf(a.review)}
            className="text-[13px] leading-relaxed text-foreground/85 line-clamp-3"
          >
            {a.review}
          </p>
        </Link>

        {/* **الذيلُ كلُّه في `RowComment`** لأن صندوق الكتابة يحتاج عرضَ
            الصفّ والمقبضَ يسكن شريطاً مسقوفاً — حالةٌ واحدة لعنصرين
            يحملها مكوّنٌ واحد (D-227). و`mt-auto` يُنزله إلى القاع فيثبت
            موضعُه بين الصفوف (D-224). */}
        <div className="mt-auto">
          <RowComment
            reviewUserId={a.person.id}
            tmdbId={a.tmdb_id}
            mediaType={a.media_type}
            label={t.actionComment}
            locale={locale}
            before={
              <LikeButton
                reviewUserId={a.person.id}
                tmdbId={a.tmdb_id}
                mediaType={a.media_type}
                likes={a.likes}
                likedByMe={a.likedByMe}
                isMine={a.person.id === meId}
                locale={locale}
              />
            }
            after={
              <>
                <StatChip icon="chart" n={watchers} label={t.talkWatchersHint} />
                <ShareTitleButton path={titleHref} title={a.title ?? ""} locale={locale} />
              </>
            }
          />
        </div>
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

function NewsRow({
  n,
  added,
  watchers,
  likes,
  likedByMe,
  locale,
}: {
  n: LoopzNewsItem;
  added: boolean;
  watchers: number;
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
      {/* **هيكلُ صفّ التعليق نفسُه حرفاً** (D-232، بلاغُ أحمد: «ليه الفوضى
          هذي… وشكلٌ مختلف!»). **والعلّةُ كانت بنيويةً لا تنسيقاً:** صفُّ
          التعليق نُقل ليمرّ نصُّه تحت الوجه (D-228) **ولم يُنقل معه صفُّ
          الخبر** — فبقي ذيلُه مزاحاً بعرض الوجه بينما ذيلُ جاره على الحافة.
          **وصفّان بهيكلين في قائمةٍ واحدة يُقرآن تطبيقين.**
          **والقاعدة: تغييرُ هيكلِ صفٍّ في عائلةٍ يُطبَّق على العائلة كلِّها
          في الدفعة نفسِها** — وإلا فالعائلةُ انقسمت. */}
      <div className={`min-w-0 flex-1 flex flex-col ${ROW_MIN_H}`}>
        {/* ===== الترويسة: ختمٌ · اسمٌ / عملٌ · نوعٌ · عمرٌ ===== */}
        <div className="flex items-center gap-2.5">
          {/* **ختمُ Loopz في موضع الوجه** — الأيقونةُ الرسمية نفسُها، لا
              مونوغرام جديد: **الوردمارك هو الشعار** (D-039). */}
          <span className="shrink-0">
            <Avatar src="/icon-192.png" name="Loopz" size={44} alt="" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 font-bold text-[14px] leading-tight text-foreground" dir="ltr">
                Loopz
              </span>
              {/* **ولا نقاطَ هنا**: القائمةُ متابعةٌ وحظرٌ وبلاغٌ على
                  **إنسان**، ولا إنسانَ في خبرِنا — **ومقبضٌ يفتح خياراتٍ لا
                  تنطبق أسوأ من غيابه** (D-217). */}
              <span className="ms-auto shrink-0 text-[11px] text-muted tabular-nums">
                {timeAgoShort(n.published_at, t)}
              </span>
            </div>

            {/* **اسمُ العمل ونوعُه تحت الاسم** (طلبُ أحمد) — موضعُ «اسمِ
                العمل و★» في صفّ التعليق بعينه. **والنوعُ عاد ملتصقاً
                بالعنوان لا وحده في الذيل**: هناك كان يكرّر ما تقوله الجملة،
                **وهنا يعرّف العملَ الذي يتكلّم عنه الخبر.** */}
            <div className="mt-px flex items-center gap-1.5">
              <Link
                href={titleHref}
                prefetch={false}
                className="min-w-0 truncate text-[13px] text-muted hover:text-accent transition"
              >
                <bdi>{n.title}</bdi>
              </Link>
              <span aria-hidden className="shrink-0 text-muted text-[12px]">
                ·
              </span>
              <span className="shrink-0 text-[13px] text-muted">
                {n.media_type === "tv" ? t.typeSeries : t.typeMovie}
              </span>
            </div>
          </div>
        </div>

        {/* ===== الجملة — بعرض العمود كلِّه، تحت الختم =====
            **وصوتُنا لا يعلو على صوت الناس**: بمقاس نصّ التعليق نفسِه.
            **ولا رابطَ خارجيّ فيها** (طلبُ أحمد الصريح): الضغطُ يفتح
            صفحةَ العمل عندنا. */}
        <Link
          href={titleHref}
          prefetch={false}
          className="block mt-2 text-[13px] leading-relaxed font-semibold hover:text-accent transition line-clamp-3"
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

        <div className="mt-auto">
          <RowFooter>
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
            <StatChip icon="chart" n={watchers} label={t.talkWatchersHint} />
            <ShareTitleButton path={titleHref} title={n.title} locale={locale} />
          </RowFooter>
        </div>
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
