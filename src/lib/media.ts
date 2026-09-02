// أدوات آمنة للاستخدام في الخادم والمتصفح معاً (لا تستورد next/headers)
import { resolveMediaTitle, type ResolvedTitle, type TitleMode } from "@/lib/titleMode";

export const IMG = "https://image.tmdb.org/t/p";

export type MediaType = "tv" | "movie";

/**
 * بناء رابط صورة TMDB من مسارٍ مخزَّن.
 *
 * المسار يصلنا من مصدرين: TMDB مباشرةً — ويأتي دائماً بشرطةٍ بادئة
 * (`/abc.jpg`) — وصفوفٌ في قاعدتنا كُتبت على مرّ نسخٍ مختلفة، فبعضها بلا
 * شرطة وبعضها رابطٌ كامل. الوصل الساذج `${IMG}/${size}${path}` يعطي
 * `.../w185abc.jpg` في الحالة الثانية ورابطاً مضاعفاً في الثالثة، وكلاهما
 * يظهر للمستخدم أيقونة صورةٍ مكسورة. فالتطبيع هنا مرّةً واحدة بدل أن
 * يُصلح كل موضعٍ على حدة.
 */
function tmdbImage(path: string | null | undefined, size: string): string | null {
  if (!path) return null;
  const p = path.trim();
  if (!p) return null;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return `${IMG}/${size}/${p.replace(/^\/+/, "")}`;
}

/**
 * 🆕 أبعادُ الملصق الجوهريّة لكلِّ دلوٍ (D-845 · دَينُ D-840).
 *
 * 🔑 **لماذا `width`/`height` لا `fill`**: صورةُ `fill` تجعل Next يكتب
 * `srcset` بسلّم العروض كلِّه (~١٦ مرشَّحاً) — **ومرشَّحاتُ الممرّ
 * المخزَّن روابطُ متطابقةٌ حرفاً** (المحمِّلُ يتجاهل العرضَ عمداً —
 * D-841)، **فالسلّمُ كلُّه وزنُ HTML ميّتٌ يتكرّر مع كلِّ ملصق.**
 * `width`/`height` تكتبان مرشَّحَين (1x/2x) — **والمقاسُ الحقيقيُّ
 * يقرّره دلو TMDB المعلَنُ في الرابط لا srcset أصلاً.**
 *
 * ⚠️ والنسبةُ ٢:٣ نسبةُ ملصق TMDB — الرسمُ الفعليُّ يحكمه صندوقُ
 * المستدعي (`absolute inset-0` + `object-cover`)، وهذان الرقمان
 * تلميحُ نسبةٍ وعرضا srcset لا غير.
 */
export const POSTER_INTRINSIC = {
  w185: { width: 185, height: 278 },
  /* 🆕 D-895 (`LOOPZ-AUD-0082`): **176 لا 342** — الرقمان تلميحُ نسبةٍ
     وعرضا srcset (انظر أعلاه)، **والبطاقاتُ تُرسم بعرض 137–176 css px**
     (رفوفٌ وشبكةُ الاكتشاف عند 1280). بـ342 كان مرشَّحُ 1x = 384 فيطلب
     المحمِّلُ `w342` (44–58 KB) حتى على شاشة DPR 1 يكفيها `w185` (17–20).
     بـ176 يصير مرشَّحُ 1x = 256 ⇢ `w185`، ومرشَّحُ 2x = 384 ⇢ `w342`
     كما كان — فشاشاتُ DPR ≥ 1.5 والهواتفُ بلا تغيير. النسبةُ ٢:٣ كما هي. */
  w342: { width: 176, height: 264 },
  w500: { width: 500, height: 750 },
} as const;

/**
 * مقاسا الخلفيّة الجوهريّان — ١٦:٩ بحسابٍ لا بتخمين.
 *
 * **ولماذا مقاسان لا واحد** (سدادُ دَين D-845): `w300` يسلك الممرَّ
 * المخزَّن فمرشَّحاتُه رابطٌ واحدٌ مكرَّر — **فيُكتب بمقاسٍ صريحٍ
 * ينتج مرشَّحَين** — **و`w780` سطحُ محسِّنٍ مرشَّحاتُه متباينةٌ
 * حقّاً فيبقى على `fill`** (D-841، القاعدةُ الرابعة في D-845).
 */
export const BACKDROP_INTRINSIC = {
  w300: { width: 300, height: 169 },
  w780: { width: 780, height: 439 },
} as const;

export function posterUrl(path: string | null, size: "w185" | "w342" | "w500" = "w342") {
  return tmdbImage(path, size);
}

export function backdropUrl(path: string | null, size: "w300" | "w500" | "w780" | "w1280" = "w1280") {
  return tmdbImage(path, size);
}

/** صورة شخص — مقاسات TMDB للأشخاص غير مقاسات الملصقات */
export function profileUrl(path: string | null, size: "w185" | "h632" = "w185") {
  return tmdbImage(path, size);
}

/**
 * تطبيع نصّ عربي/إنجليزي للمقارنة.
 *
 * العربية تُكتب بأكثر من صورة للحرف نفسه: «أ إ آ» و«ا»، و«ة» و«ه»، و«ى»
 * و«ي» — ومن يكتب «الحفره» لا يقصد شيئاً غير «الحفرة». والتشكيل يَرِد
 * أحياناً في عناوين TMDB. فلو قارنّا الحروف كما وردت لسقطت مطابقاتٌ
 * صحيحة. والإنجليزية تُخفَّض حالتها فقط.
 *
 * موضعها هنا لا في `tmdb.ts`: يستعملها ترتيبُ البحث وقاموسُ الجنسيات معاً،
 * ونسختان منها تفترقان أوّل يوم يُضاف فيه حرف.
 */
export function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, "") // تشكيل
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ ← ا
    .replace(/ة/g, "ه") // ة ← ه
    .replace(/ى/g, "ي") // ى ← ي
    .replace(/[^\p{L}\p{N}]+/gu, " ") // الترقيم فاصل
    .replace(/\s+/g, " ")
    .trim();
}

export function titleOf(r: { title?: string; name?: string }): string {
  return r.title ?? r.name ?? "—";
}

/**
 * 🆕 **الاسمُ الأصليُّ من صفِّ TMDB** (D-544) — `original_title` للأفلام
 * و`original_name` للمسلسلات.
 *
 * ⚠️ **وهو مجّانيٌّ حيث يُقرأ**: كلُّ ردٍّ من TMDB (بحثاً كان أو قائمةً
 * أو تفصيلاً) **يحمل العمودين أصلاً** — **فلا نداءَ ثانياً لأجل الوضع
 * «الأصلي»** في كلِّ سطحٍ يقرأ من TMDB مباشرةً (الاكتشاف، الرفوف،
 * البحث، صفحةُ العمل). **والذي يدفع ثمناً هو الصفوفُ المخزَّنةُ في
 * قاعدتنا وحدَها** (المكتبة والقوائم)، **وثمنُها في `localize.ts`.**
 */
export function originalTitleOf(r: {
  original_title?: string | null;
  original_name?: string | null;
}): string | null {
  return r.original_title ?? r.original_name ?? null;
}

/**
 * 🆕 **حلُّ اسمِ صفٍّ آتٍ من TMDB مباشرةً** (D-544) — الاكتشافُ والرفوفُ
 * والبحثُ وصفحةُ العمل.
 *
 * **ولا نداءَ زائدٌ هنا إطلاقاً**: الاسمان في الصفِّ نفسِه، **والكتابةُ
 * الصوتيّةُ تصل مُجمَّعةً من الصفحة** (`titleAliases.getTranslits`) —
 * **لا استعلامَ لكلِّ بطاقة** (شرطُ المواصفة).
 */
export function resolveTmdbTitle(
  r: {
    title?: string;
    name?: string;
    original_title?: string | null;
    original_name?: string | null;
  },
  mode: TitleMode,
  translit: string | null = null,
): ResolvedTitle {
  return resolveMediaTitle(
    { localized: titleOf(r), original: originalTitleOf(r), translit },
    mode,
    titleOf(r),
  );
}

export function yearOf(r: { first_air_date?: string | null; release_date?: string | null }): string {
  const d = r.first_air_date ?? r.release_date;
  return d ? d.slice(0, 4) : "";
}

// الأنواع المتاحة للاختيار في الملف الشخصي (معرّفات TMDB)
export const GENRES: { id: number; ar: string; en: string; emoji: string }[] = [
  { id: 35, ar: "كوميدي", en: "Comedy", emoji: "😂" },
  { id: 18, ar: "دراما", en: "Drama", emoji: "🎭" },
  { id: 10759, ar: "أكشن ومغامرة", en: "Action & Adventure", emoji: "💥" },
  { id: 9648, ar: "غموض", en: "Mystery", emoji: "🕵️" },
  { id: 80, ar: "جريمة", en: "Crime", emoji: "🚔" },
  { id: 10765, ar: "خيال علمي وفانتازيا", en: "Sci-Fi & Fantasy", emoji: "🚀" },
  { id: 16, ar: "رسوم متحركة", en: "Animation", emoji: "🎨" },
  { id: 99, ar: "وثائقي", en: "Documentary", emoji: "📚" },
  { id: 10751, ar: "عائلي", en: "Family", emoji: "👨‍👩‍👧" },
  { id: 10766, ar: "دراما يومية", en: "Soap", emoji: "📺" },
  { id: 37, ar: "غربي", en: "Western", emoji: "🤠" },
  { id: 10768, ar: "حربي وسياسي", en: "War & Politics", emoji: "⚔️" },
];

export function genreName(g: { ar: string; en: string }, locale: "ar" | "en") {
  return locale === "en" ? g.en : g.ar;
}

/**
 * 🆕 **رابطُ الـGIF يُركَّب من معرّفه** (D-362).
 *
 * 🔴 **ولا يُخزَّن رابطٌ في القاعدة أبداً**: ما يصل من العميل معرّفٌ من
 * حروفٍ وأرقام، **والعنوانُ يُبنى هنا من قالبٍ ثابت** — **فرابطٌ يرسله
 * عميلٌ ونرسمه `<img>` للناس هو ما تمنعه D-298/D-302**، وهذا يقطع البابَ
 * من أصله لا يحرسه.
 *
 * **وهو في `media.ts` لأن قارئيه ضفّتان**: بحثُ الخادم (`lib/gif.ts`)
 * ورسمُ الصفّ في المتصفّح — **وملفٌّ `server-only` لا يُقرأ من العميل**
 * (D-002: القالبُ واحدٌ ومكانُه حيث يراه الاثنان).
 */
export const GIF_ID_RE = /^[A-Za-z0-9]{1,64}$/;

export function gifUrl(id: string | null | undefined, size: "small" | "full" = "full"): string | null {
  if (!id || !GIF_ID_RE.test(id)) return null;
  return `https://media.giphy.com/media/${id}/${size === "small" ? "200w.gif" : "giphy.gif"}`;
}
