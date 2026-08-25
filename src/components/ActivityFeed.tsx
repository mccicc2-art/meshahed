import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgoShort } from "@/lib/when";
import { LOOPZ_ID, LOOPZ_USERNAME, LOOPZ_PERSON } from "@/lib/loopz";
import {
  displayNameOf,
  listReviewKey,
  type FeedItem,
  type LoopzNewsItem,
  type ListReviewSocial,
} from "@/lib/data";
import { newsLine, newsSource } from "@/lib/newsLine";
import { commentViewKey, newsViewKey } from "@/lib/postKeys";
import { curatedName } from "@/lib/universes";
import { backdropUrl } from "@/lib/media";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LikeButton } from "./LikeButton";
import { PosterCard } from "./PosterCard";
import { ShareTitleButton } from "./ShareTitleButton";
import { ProfileMenu } from "./ProfileMenu";
import { RowComment } from "./RowComment";
import { FeedReviewText } from "./FeedReviewText";
import { NewsComment } from "./NewsComment";
import { PostViews } from "./PostViews";
import { actionTailItem } from "./ui/controls";

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

/* ⚠️ **وسقط نوعُ الفرز كلُّه — الخطُّ زمنٌ خالصٌ لا غير** (D-280، طلبُ
   أحمد «أحتاج أتخلّص من الفلاتر الثلاث»).
   **والحجّةُ بالرقم في `app/people/page.tsx`**: «لك» كانت تطرح صفّين من
   أربعةٍ وأربعين وتكلّف ٥٤px من الرأس اللاصق في كلِّ تمريرة.
   **وبقي `showStrangers` وحدَه** (D-255) — مفتاحٌ في الإعدادات لا رقاقة. */

export function ActivityFeed({
  comments,
  news,
  meId,
  followed = new Set<string>(),
  postLikes,
  views,
  followingIds,
  showStrangers = true,
  sort = "smart",
  translations,
  newsReplies,
  reviewReplies,
  listSocial,
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
  /**
   * **كم شخصاً رأى كلَّ منشور** — بمفتاح `postKeys`، نداءٌ واحد للخطّ (D-237).
   *
   * ⚠️ **وكان `stats.watchers` فسقط**: ذاك «كم شاهد **العمل**»، فيظهر
   * الرقمُ نفسُه تحت كلِّ صفٍّ يتكلّم عن «Se7en» — **رقمٌ لا يخصّ الصفَّ
   * الذي تحته أسوأ من لا رقم** (D-134، وبلاغُ أحمد نصّاً).
   */
  views?: Map<string, number>;
  /** مَن أتابعهم — لصفّ المتابعة في قائمة النقاط (نداءٌ واحدٌ مخزَّن) */
  followingIds?: ReadonlySet<string>;
  /**
   * **هل يُعرض كلامُ من لا تتابعهم؟** (D-255، طلبُ أحمد) — **يُرشِّح
   * «الأحدث» و«الأكثر تفاعلاً» وحدهما**: «لك» تُرشّح أصلاً بأوسع منه.
   * **وافتراضُه `true`** لأن افتراضَ أي تفضيلٍ جديد هو السلوكُ القائم
   * (D-152)، **ولأن مكوّناً يسبق مستهلكَه يأخذ حقلاً اختيارياً** (D-028).
   */
  showStrangers?: boolean;
  /**
   * 🆕 **ترتيبُ الخطّ** (D-306، طلبُ أحمد: «الترتيب بآخر منشور أو ترتيب
   * ذكي مثل الحالي»). **و«آخر منشور» تخطٍّ للساعة المصحَّحة لا صيغةٌ
   * ثانية**: الصفوفُ مرتّبةٌ بالزمن أصلاً عند بنائها.
   */
  sort?: "smart" | "latest";
  /** 🆕 **ترجماتُ المراجعات بلغة القارئ** (D-307) — بمفتاح `commentViewKey` */
  translations?: Record<string, string>;
  /** ردودُ نشراتنا — بمفتاح المنشور، نداءٌ واحد للخطّ كلِّه (D-236) */
  newsReplies?: Map<string, number>;
  /**
   * 🆕 **ردودُ آراءِ الناس** (D-289، الهجرة ٨٩) — **النصفُ الذي كان
   * معلَّقاً في D-283.** مفتاحُها `commentViewKey`.
   */
  reviewReplies?: Map<string, number>;
  /**
   * 🆕 **قلوبُ آراء القوائم وعددُ ردودها** (D-370، الهجرة ١١٣) —
   * بمفتاح `listId|userId` من `listReviewKey`.
   *
   * **واختياريّةٌ لأن غيابَها يعني «لا قلوبَ بعد» لا «تعذّرت القراءة»**
   * (D-028/D-063): القارئُ يُرجع خريطةً فارغةً عند الفشل، **فيُرسم
   * الذيلُ بصفرٍ ويبقى الخطُّ مقروءاً.**
   */
  listSocial?: Map<string, ListReviewSocial>;
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

  /* ============ الترشيحُ ثم الترجيح (D-283) ============

     ⚖️ **وهذا نقضٌ لِما اخترتُه في D-280 بحكم أحمد** (بنصّه: «ناس ما
     أتابعهم ولا أتابع أفلامهم لا تظهرهم لي»).
     **يومَها حذفتُ الرقاقات وأبقيتُ الزمنَ الخالص وحاججتُ بأن الباقيَ
     يجب أن يكون الذي لا يطرح.** **وحجّتُه أقوى:** خطٌّ يعرض غريباً يتكلّم
     عن عملٍ لا يعرفه القارئُ ليس «نشاطَه». **والذي سقط في D-280 هو
     الخيارُ لا السلوك** — فلا تناقض: **رقاقةٌ تُحذف، وسلوكٌ يُختار.**

     **والدائرةُ ثلاثة:** كلامُك أنت (D-251) · ومن تتابعهم · **ومن تكلّم
     عن عملٍ في مكتبتك** — وهذا الثالثُ هو ما يجعلها «لك» لا «من أتابع»:
     **غريبٌ يتكلّم عن مسلسلٍ تشاهده أقربُ إليك من صديقٍ يتكلّم عن عملٍ
     لا تعرفه.**
     **ونشرتُنا لا تُرشَّح** — تُلغى من قائمة حسابها (D-252). */
  let shown = rows.filter(
    (r) =>
      r.kind === "news" ||
      r.item.person.id === meId ||
      (followingIds?.has(r.item.person.id) ?? false) ||
      followed.has(`${r.item.media_type}-${r.item.tmdb_id}`),
  );

  /* **ومفتاحُ «من يظهر» يضيق فوق ذلك** (D-255): بعد D-283 صار يُسقط
     **الغريبَ الذي تكلّم عن عملٍ في مكتبتك** وحدَه — وهو بالضبط ما
     طلبه أحمد يومَ كتبه («حتى FOR YOU»). */
  if (!showStrangers) {
    shown = shown.filter(
      (r) =>
        r.kind === "news" ||
        r.item.person.id === meId ||
        (followingIds?.has(r.item.person.id) ?? false),
    );
  }

  /* ============ والترتيبُ زمنٌ يشيخ ببطء (D-283) ============

     **صيغةُ أحمد بنصّها:** «كل لايك ينقص من وقته نص ساعة وكل رد ساعة».
     **وهي أذكى مما تبدو** — لأنها **ليست فرزاً ثانياً بل زمناً واحداً
     مصحَّحاً**: يبقى الترتيبُ زمنيّاً يفهمه القارئُ بلا شرح، **والصفُّ
     المتفاعَلُ معه يشيخ أبطأ** بدل أن يقفز فوق كلِّ جديد.
     **وهذا ما يمنع عطلَ «الأكثر تفاعلاً» القديم** (D-240): ذاك كان
     يرتّب بالتفاعل وحدَه **فيتصدّر خطّاً أكثرُ إعجاباته صفر عشوائياً.**

     ✅ **واكتمل النصفان** (D-289، الهجرة ٨٩): كان الإعجابُ يُحسب
     للرأي ولا تُحسب ردودُه لأن العدّادَ كان لنشراتنا وحدها — **وصار
     `review_reply_counts` يعطيها بصيغة `commentViewKey` نفسِها**
     (D-237). **ونصفُ صيغةٍ يعمل صامتاً أسوأُ من نصفٍ معلَن** (D-217)،
     **فيُشطب الإعلانُ يومَ يكتمل لا يُترك يكذب** (D-155/D-146). */
  const LIKE_MS = 30 * 60 * 1000;
  const REPLY_MS = 60 * 60 * 1000;
  const effAt = (r: Row): number => {
    const key = `${r.item.media_type}-${r.item.tmdb_id}`;
    if (r.kind === "comment") {
      /* ✅ **واكتملت الصيغةُ هنا** (D-289): كانت تحسب الإعجابَ وحدَه
         **لأن ردودَ الآراء لم يكن لها عدّاد**، وصار لها منذ ٨٩. */
      const ck = commentViewKey(r.item.person.id, r.item.media_type, r.item.tmdb_id);
      return (
        r.at + (r.item.likes ?? 0) * LIKE_MS + (reviewReplies?.get(ck) ?? 0) * REPLY_MS
      );
    }
    return (
      r.at +
      (postLikes?.counts[key] ?? 0) * LIKE_MS +
      (newsReplies?.get(r.item.key) ?? 0) * REPLY_MS
    );
  };
  /* 🆕 **والذكيُّ اختيارٌ لا قدَر** (D-306): «آخر منشور» يُبقي ترتيبَ
     الزمن الذي بُنيت به الصفوف — **فلا فرزَ ثانياً أصلاً.** */
  if (sort === "smart") shown = [...shown].sort((a, b) => effAt(b) - effAt(a));

  if (shown.length === 0) {
    return (
      <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-10 px-5 text-center leading-relaxed">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="divide-y divide-[color:var(--divider)]">
      {shown.map((row) => {
        const key = `${row.item.media_type}-${row.item.tmdb_id}`;
        return row.kind === "comment" ? (
          <CommentRow
            key={`c-${row.item.person.id}-${row.item.listId ?? key}-${row.item.day}`}
            a={row.item}
            meId={meId}
            added={followed.has(key)}
            viewKey={commentViewKey(row.item.person.id, row.item.media_type, row.item.tmdb_id)}
            views={views}
            iFollowThem={followingIds?.has(row.item.person.id) ?? false}
            listSocial={listSocial}
            locale={locale}
            translated={translations?.[commentViewKey(row.item.person.id, row.item.media_type, row.item.tmdb_id)] ?? null}
          />
        ) : (
          <NewsRow
            key={`n-${row.item.key}`}
            n={row.item}
            added={followed.has(key)}
            viewKey={newsViewKey(row.item.key)}
            views={views}
            likes={postLikes?.counts[key] ?? 0}
            likedByMe={postLikes?.mine.has(key) ?? false}
            replies={newsReplies?.get(row.item.key) ?? 0}
            followLoopz={followingIds?.has(LOOPZ_ID) ?? false}
            locale={locale}
          />
        );
      })}
      {/* **جزيرةٌ واحدة تعدّ الخطَّ كلَّه** (D-237): تلتقط الصفوفَ من
          سِمَتها `data-post-key` — **فلا عميلَ في كل صفّ** ولا نداءَ
          لكل صفّ. */}
      <PostViews />
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
 * بين الأفعال.
 *
 * 🆕 **وصار مُصدَّراً** (D-583): تبويبُ «مراجعات» في ملفّ المستخدم يلبس
 * بطاقةَ المجتمع نفسَها — **والعمودُ يُستورد من هنا لا يُنسخ** (القاعدة ٦). **والحجّةُ تُقال:** على ملصقٍ عرضُه ٨٤px كان القرصُ ٣٢px
 * يأكل ثلثَ العرض ويجلس على وجه العمل — **وفي شبكة اكتشف عرضُ البطاقة
 * ضِعفُ هذا فلا يزاحم.** موضعٌ ثانٍ لأن المقاس ثانٍ، لا لأن الفعل ثانٍ.
 */
export function RowPoster({
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

/**
 * **خانةُ الإحصاء — تُحجَز وإن كان العدد صفراً** (D-234، بلاغُ أحمد:
 * «شكلٌ مختلف!»).
 *
 * **والعلّةُ كانت في `justify-between` لا في الرقم:** شريطٌ موزَّعٌ يعيد
 * توزيعَ عناصره كلَّما نقص واحد — **فصفٌّ بلا إحصاءٍ تنزلق رموزُه كلُّها**
 * ولا يحاذي جارَه. **والقائمةُ تُقرأ بالمَسح**، فأعمدةٌ تتحرّك بين صفٍّ
 * وصفّ فوضى ولو كان كلُّ صفٍّ صحيحاً وحده.
 *
 * **فتُحجَز الخانة ويُخفى رقمُها** — **والصفرُ يبقى غيرَ مرسوم**
 * (D-222): **الحجزُ للتخطيط والإخفاءُ للصدق**، ولا يتنازعان.
 * (D-046 نفسُها: لا شيء يتغيّر موضعُه بعد أن يُرسم.)
 */
function StatChip({ icon, n, label }: { icon: "chart"; n: number; label: string }) {
  const has = n > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 text-12 tabular-nums ${
        has ? "text-muted" : "text-muted/35"
      }`}
      title={has ? label : undefined}
      aria-label={has ? `${label}: ${n}` : undefined}
      aria-hidden={!has}
    >
      <Icon name={icon} size={14} />
      {has && n}
    </span>
  );
}

function CommentRow({
  a,
  meId,
  added,
  viewKey,
  views,
  iFollowThem,
  listSocial,
  locale,
  translated,
}: {
  a: FeedItem;
  /** 🆕 **ترجمةُ المراجعة بلغة القارئ** (D-307) — غيابُها «لا ترجمةَ لازمة» */
  translated?: string | null;
  meId: string;
  added: boolean;
  viewKey: string;
  views?: Map<string, number>;
  iFollowThem: boolean;
  /** 🆕 **قلوبُ آراء القوائم وردودُها** (D-370) — لذيل صفِّ القائمة وحدَه */
  listSocial?: Map<string, ListReviewSocial>;
  locale: Locale;
}) {
  const t = getDict(locale);
  /* 🆕 **صفُّ قائمةٍ لا صفُّ عمل** (الهجرة ١٠٦ — الخيطُ الثالث): **كلُّ ما
     في هذا الصفّ يتبدّل بحضور `listId`** — الوجهةُ والعنوانُ والذيل.
     ⚠️ **وهذا هو الحارسُ الذي وُعد به**: صفُّ قائمةٍ بلا `tmdb_id` كان
     سيُرسم رابطاً إلى `/movie/0` — **ورابطٌ ميّتٌ في خطٍّ اجتماعيّ أسوأُ
     من صفٍّ غائب** (D-181/D-063). */
  const isList = !!a.listId;
  /* **وضغطةُ الصفّ تفتح التعليقَ نفسَه لا غرفةَ العمل** (D-242، طلبُ
     أحمد: «وحتى طريقة الفتح نفس الصورة»). **كانت تفتح `/talk`** — فتضغط
     كلامَ خالد فتصل إلى صفحةٍ فيها كلامُ عشرة وتبحث عن سطره.
     **ومراجعةُ القائمة ليس لها صفحةٌ خاصّة** (D-334: بابٌ واحدٌ للقائمة)
     — **فالوجهتان واحدةٌ: صفحتُها وفيها تبويبُ التقييمات** (D-333). */
  const listHref = a.listId ? `/lists/${a.listId}` : null;
  const reviewHref = listHref ?? `/review/${a.media_type}/${a.tmdb_id}/${a.person.id}`;
  const titleHref = listHref ?? `/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`;
  /* **واسمُ قائمةِ لوبز بلغة القارئ** (دَينُ D-328) — البوّابةُ نفسُها */
  const rowTitle = isList
    ? curatedName(a.listSlug, a.title ?? "", locale === "en" ? "en" : "ar")
    : a.title;
  const who = displayNameOf(a.person, t.anonymousUser);
  /** الملفُّ إن كان له `@handle`؛ وإلّا فالغرفة — **ولا صفَّ ملفٍّ بلا اسم** (D-063) */
  const whoHref = a.person.username ? `/u/${a.person.username}` : reviewHref;

  return (
    /* **`data-post-key` هي عقدُ العدّ** (D-237): `PostViews` تراقب هذه
       السِّمة وحدها — **فالصفُّ الذي لا يحملها لا يُعدّ**، والعقدُ ظاهرٌ
       في الترميز لا مخبوءٌ في مكوّن. */
    /* ⚠️ **وصفُّ القائمة لا يُعدّ**: مفتاحُ العدّ `(شخص، عمل)` **ولا عملَ
       فيه** — فكلُّ صفوف القوائم كانت ستشترك في مفتاحٍ واحد (D-237). */
    <article className="py-4 first:pt-0 flex gap-3" data-post-key={isList ? undefined : viewKey}>
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
                className="min-w-0 truncate font-bold text-14 leading-tight text-foreground hover:text-accent transition"
              >
                <bdi>{who}</bdi>
              </Link>
              {/* **العمرُ مختصرٌ ملاصقٌ للنقاط** (طلبُ أحمد): `6d` لا «قبل
                  ستّة أيام» — **جملةٌ في موضعِ وسمٍ تسرق العرضَ من الاسم
                  فيُقصّ**، والترويسةُ تحمل أربعةَ أشياء في سطر. */}
              {/* **والعمرُ بابٌ ثانٍ إلى الصفحة** — عادةُ تويتر نفسُها،
                  ونفسُ ما فُعل بصفّ النشرة في D-239. */}
              <Link
                href={reviewHref}
                prefetch={false}
                className="ms-auto shrink-0 text-12 text-muted tabular-nums hover:text-accent transition"
              >
                {timeAgoShort(a.updated_at, t)}
              </Link>
              {/* **والغلافُ حاويةُ مرونةٍ أيضاً** — حارسٌ ثانٍ على نفس
                  العلّة: لا صندوقَ سطرٍ يُعيد فراغَ النوازل من الباب الآخر.
                  ⚠️ **ولا نقاطَ على صفّك أنت** (D-251): القائمةُ متابعةٌ
                  وحظرٌ وبلاغٌ ورسالة — **وكلُّها على نفسك عبثٌ يُقرأ
                  عطلاً** (D-217). **وصفُّك يبقى كصفّ الناس في كل شيءٍ
                  آخر**، والحذفُ والتعديل لهما بيتٌ في صفحة العمل. */}
              {a.person.id !== meId && (
                <span className="shrink-0 flex items-center">
                  <ProfileMenu
                    person={a.person}
                    mutual={false}
                    follow={{ following: iFollowThem }}
                    variant="plain"
                    locale={locale}
                  />
                </span>
              )}
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
                className="min-w-0 flex items-center gap-1 truncate text-12 text-muted hover:text-accent transition"
              >
                {/* **ورمزُ القائمة قبل اسمها** — السطرُ نفسُه يحمل عملاً
                    مرّةً وقائمةً مرّة، **والقارئُ يجب أن يعرف أيّهما قبل
                    أن يضغط** (D-294: رمزٌ واحدٌ لمعنًى واحد). */}
                {isList && <Icon name="list" size={13} className="shrink-0" />}
                <bdi className="truncate">{rowTitle}</bdi>
              </Link>
              {a.rating != null && (
                <span
                  className="shrink-0 text-14 font-bold text-accent tabular-nums"
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
        {/* ⚠️ **و`dir` على الرابط لا على الفقرة** (D-282): الفقرةُ تحمل
            `line-clamp` وهي `display: -webkit-box`، **وصندوقُ WebKit يحلّ
            `text-align: start` حلّاً آخر** — فيُرسم العربيُّ يساراً على
            iPhone ويميناً على سطح المكتب. **فصلُ الاتّجاه عن الصندوق
            المقصوص، ومحاذاةٌ صريحة فوقه.** */}
        {/* 🆕 **المتنُ في جزيرةِ عميلٍ صغيرة** (D-307) — الخطُّ مكوّنُ
            خادمٍ وزرُّ «النص الأصلي» حالةُ ضغطة؛ الحجّةُ كاملةً في رأس
            `FeedReviewText`. **والاتّجاهُ من النصّ المعروض لا الأصل.** */}
        <FeedReviewText
          href={reviewHref}
          review={a.review ?? ""}
          /* **وترجمةُ صفِّ القائمة تُتجاهَل**: خريطةُ الترجمات مفتاحُها
             `(كاتب، عمل)` — **ومفتاحٌ يشترك فيه صفّان يعطي أحدَهما كلامَ
             الآخر** (D-237). */
          translated={isList ? null : translated}
          locale={locale}
          hasSpoiler={a.hasSpoiler}
        />

        {/* **الذيلُ كلُّه في `RowComment`** لأن صندوق الكتابة يحتاج عرضَ
            الصفّ والمقبضَ يسكن شريطاً مسقوفاً — حالةٌ واحدة لعنصرين
            يحملها مكوّنٌ واحد (D-227). و`mt-auto` يُنزله إلى القاع فيثبت
            موضعُه بين الصفوف (D-224). */}
        {/* ⚖️ **وذيلُ صفِّ القائمة وُلد اليوم** (D-370، الهجرة ١١٣):
            **كان يُحذف عمداً** لأن «الإعجابَ والردَّ مفتاحُهما (كاتب،
            عمل، وسيط) ولا عملَ هنا — وزرٌّ لا يكتب شيئاً أسوأُ من غيابه»
            (D-123). **والذي تغيّر أن الجدولَ وُجد**: `list_review_likes`
            بمفتاح (صاحبُ الرأي + القائمة)، **فصار الزرُّ يكتب.**
            ⚠️ **وذيلُه ليس ذيلَ العمل**: **لا صندوقَ كتابةٍ في الخطّ**
            (`RowComment` يكتب في `review_replies` بمفتاح العمل)، **ولا
            عدّادَ مشاهدات** (صفُّ القائمة لا يُعدّ — D-237)، **ولا
            مشاركةَ عملٍ لا عملَ له**. **قلبٌ يكتب، ورقمُ ردودٍ يفتح
            صفحتَها** — **وما لا يُنفَّذ هنا يُشار إلى حيث يُنفَّذ**
            (D-155). */}
        {isList && a.listId && (
          <div className="mt-auto -mx-0.5 flex items-center gap-1">
            <LikeButton
              target="listReview"
              reviewUserId={a.person.id}
              listId={a.listId}
              likes={listSocial?.get(listReviewKey(a.listId, a.person.id))?.likes ?? 0}
              likedByMe={
                listSocial?.get(listReviewKey(a.listId, a.person.id))?.likedByMe ?? false
              }
              isMine={a.person.id === meId}
              locale={locale}
            />
            {/* **رابطٌ لا زرّ**: الخيطُ يسكن تبويبَ تقييمات القائمة
                (D-333/D-334)، **والرقمُ يجاور صاحبَه** (D-223). */}
            <Link
              href={listHref ?? "#"}
              prefetch={false}
              aria-label={t.talkReply}
              title={t.talkReply}
              className={actionTailItem(false)}
            >
              <Icon name="comment" size={15} />
              <span>{t.talkReply}</span>
              {/* **والصفرُ لا يُرسم** (D-222) */}
              {(listSocial?.get(listReviewKey(a.listId, a.person.id))?.replies ?? 0) > 0 && (
                <span className="tabular-nums">
                  {listSocial!.get(listReviewKey(a.listId, a.person.id))!.replies}
                </span>
              )}
            </Link>
          </div>
        )}

        {!isList && (
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
                <StatChip icon="chart" n={views?.get(viewKey) ?? 0} label={t.postViewsHint} />
                <ShareTitleButton path={titleHref} title={a.title ?? ""} locale={locale} />
              </>
            }
          />
        </div>
        )}
      </div>

      {/* **ولا عمودَ ملصقٍ لقائمة** — لا ملصقَ لها أصلاً، **وإطارٌ فارغٌ
          بعرض ٨٤px يُقرأ صورةً لم تُحمَّل** (D-181).
          🔴 🆕 **وللقائمة غلافُها اليوم** (D-425، بلاغُ أحمد: «Mesh علّقت
          على لسته المفروض صورة اللستة تطلع هنا»): **الحجّةُ أعلاه ماتت
          يومَ صار للقائمة غلافٌ مختار** (D-208) — **والفراغُ لم يعد
          صدقاً، صار بياناً عندنا لا نعرضه.**
          **وشكلُه عريضٌ لا ملصق**: الغلافُ ١٦:٩ **وقصُّه إلى ٢:٣ يأكل
          ثلثيه**، **واختلافُ الشكل نفسُه يقول «هذه قائمةٌ لا عمل»** —
          فرقٌ يُقرأ بلا كلمة (D-002 معكوسةً: مقاسان لأن المعنيين اثنان).
          **وقائمةٌ بلا غلافٍ تبقى بلا عمود** حرفاً كما كانت. */}
      {!isList ? (
        <RowPoster
          tmdbId={a.tmdb_id}
          mediaType={a.media_type}
          title={a.title ?? ""}
          posterPath={a.poster_path}
          added={added}
          locale={locale}
        />
      ) : (
        a.listCover && (
          <Link
            href={listHref ?? "#"}
            className={`${POSTER_W} shrink-0 block rounded-xl overflow-hidden border border-border bg-surface-2 relative aspect-video active:scale-[.98] transition`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={backdropUrl(a.listCover, "w300") ?? ""}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </Link>
        )
      )}
    </article>
  );
}

function NewsRow({
  n,
  added,
  viewKey,
  views,
  likes,
  likedByMe,
  replies,
  followLoopz,
  locale,
}: {
  n: LoopzNewsItem;
  added: boolean;
  viewKey: string;
  views?: Map<string, number>;
  likes: number;
  likedByMe: boolean;
  replies: number;
  /** هل يتابع القارئُ حسابَ Loopz؟ — حالةُ صفّ المتابعة في ⋯ (D-252) */
  followLoopz: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const text = newsLine(n, t, locale);
  if (!text) return null;
  const titleHref = `/${n.media_type === "tv" ? "show" : "movie"}/${n.tmdb_id}`;
  /* **مفتاحُ النشرة مُرمَّزٌ في المسار** (D-239): `key` نصٌّ مركَّب
     `kind:media:id:dedupe` — والترميزُ عقدٌ لا احتياط. */
  const postHref = `/post/${encodeURIComponent(n.key)}`;
  const src = newsSource(n);

  return (
    /* **`data-post-key` هي عقدُ العدّ** (D-237): `PostViews` تراقب هذه
       السِّمة وحدها — **فالصفُّ الذي لا يحملها لا يُعدّ**، والعقدُ ظاهرٌ
       في الترميز لا مخبوءٌ في مكوّن. */
    <article className="py-4 first:pt-0 flex gap-3" data-post-key={viewKey}>
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
              مونوغرام جديد: **الوردمارك هو الشعار** (D-039).
              **🆕 وصار باباً** (D-252): الوجهُ في صفّ التعليق يفتح صاحبَه،
              **والختمُ صار له صاحبٌ حقيقيّ** — فعائلةُ الصفّ الواحدة
              تقتضي أن يفتح مثلَه. */}
          <Link
            href={`/u/${LOOPZ_USERNAME}`}
            prefetch={false}
            className="shrink-0 active:opacity-80 transition"
          >
            <Avatar src="/loopz-mark.png" name="Loopz" size={44} alt="" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/u/${LOOPZ_USERNAME}`}
                prefetch={false}
                className="shrink-0 font-bold text-14 leading-tight text-foreground hover:text-accent transition"
                dir="ltr"
              >
                Loopz
              </Link>
              {/* **العمرُ رابطٌ إلى صفحة النشرة** (D-239) — **عادةُ تويتر
                  نفسُها**: الوسمُ الزمنيّ يفتح المنشورَ وحدَه. */}
              <Link
                href={postHref}
                prefetch={false}
                className="ms-auto shrink-0 text-12 text-muted tabular-nums hover:text-accent transition"
              >
                {timeAgoShort(n.published_at, t)}
              </Link>
              {/* **⋯ عادت إلى صفّ النشرة** (D-252 — بلاغُ أحمد: «لوبز لازم
                  يكون له ٣ نقاط»). **حجّةُ غيابها ماتت بموت سببها** (نفسُ
                  حكم D-250): «لا إنسانَ في خبرنا» كانت صحيحةً يومَ كان
                  الختمُ صورةً — **وصار خلفَه حسابٌ يُتابَع ويُحظَر.**
                  والقائمةُ مرشَّحةٌ بـ`system`: لا رسالةَ ولا بلاغ. */}
              <span className="shrink-0 flex items-center">
                <ProfileMenu
                  person={LOOPZ_PERSON}
                  mutual={false}
                  follow={{ following: followLoopz }}
                  variant="plain"
                  system
                  locale={locale}
                />
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
                className="min-w-0 truncate text-12 text-muted hover:text-accent transition"
              >
                <bdi>{n.title}</bdi>
              </Link>
              <span aria-hidden className="shrink-0 text-muted text-12">
                ·
              </span>
              <span className="shrink-0 text-12 text-muted">
                {n.media_type === "tv" ? t.typeSeries : t.typeMovie}
              </span>
            </div>
          </div>
        </div>

        {/* ===== الجملة — بعرض العمود كلِّه، تحت الختم =====
            **وصوتُنا لا يعلو على صوت الناس**: بمقاس نصّ التعليق نفسِه.
            **ولا رابطَ خارجيّ فيها** (طلبُ أحمد الصريح): الضغطُ يبقى داخل
            التطبيق.
            **⚖️ ونقضٌ مُسجَّل — الوجهةُ صارت صفحةَ النشرة لا صفحةَ العمل**
            (بلاغُ أحمد: «نشرات لوبز إذا ضغطت النص يوديني على صفحة الفلم،
            والمفروض يوديني في صفحة التعليقات على نشرته مثل باقي النشرات»).
            **والحجّةُ الأولى ماتت بموتِ سببها**: يومَ كُتبت لم تكن
            `/post/[key]` موجودة (وُلدت في D-239)، **فكانت صفحةُ العمل
            أقربَ ما يوجد**. والآن **للنشرة عنوانٌ يخصّها**، وضغطُ نصِّ
            المنشور في كل خطٍّ في الدنيا يفتح المنشورَ لا موضوعَه —
            **وصفُّ التعليق المجاور يفعلها بالضبط** (نصُّه يفتح
            `/review/…`)، **فعائلةُ الصفّ الواحدة تقتضيها.** */}
        <Link
          href={postHref}
          prefetch={false}
          className="block mt-2 text-14 leading-relaxed font-semibold hover:text-accent transition line-clamp-3"
        >
          {text}
        </Link>

        {/* **سطرُ النسبة** (D-213): الحدثُ من الصحافة والجملةُ من عندنا */}
        {src && (
          <p className="mt-1 text-12 text-muted">
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

        {/* **وبابٌ صريحٌ حين يكون هناك ما يُقرأ** (D-239): الوسمُ الزمنيّ
            يعرفه من يعرف تويتر، **ومن لا يعرفه لا يجد الردودَ أبداً**.
            **ولا يظهر على صفرٍ** (D-222) — ولا رقمَ فيه لأن 💬 يحمله:
            **رقمٌ مرّتين في شريطٍ واحد ضجيج.** */}
        {replies > 0 && (
          <Link
            href={postHref}
            prefetch={false}
            className="mt-1 inline-block text-12 font-semibold text-accent hover:underline"
          >
            {t.postOpenReplies}
          </Link>
        )}

        {/* **الذيلُ في `NewsComment`** لأن صندوق الكتابة يحتاج عرضَ الصفّ
            والمقبضَ يسكن الشريط — حالةٌ واحدة لعنصرين (D-236). */}
        <div className="mt-auto">
          <NewsComment
            postKey={n.key}
            replies={replies}
            label={t.actionComment}
            locale={locale}
            before={
              /* **إعجابٌ على خبرِنا** — `post_reactions` القائم منذ
                 `news.sql` (D-224). **وهو قرارُ 🔥 المرفوض وقد صُحِّح لا
                 نُقض:** الرفضُ كان أن «🔥 هي الإعجابُ نفسه بأيقونةٍ أخرى»
                 — **فرُسمت بأيقونة الإعجاب**، عائلةً واحدة برمزٍ واحد. */
              <LikeButton
                target="post"
                tmdbId={n.tmdb_id}
                mediaType={n.media_type}
                likes={likes}
                likedByMe={likedByMe}
                isMine={false}
                locale={locale}
              />
            }
            after={
              <>
                <StatChip icon="chart" n={views?.get(viewKey) ?? 0} label={t.postViewsHint} />
                <ShareTitleButton path={titleHref} title={n.title} locale={locale} />
              </>
            }
          />
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
