import "server-only";

import { getSuggestions } from "@/lib/suggest";
import { getTrailer, backdropUrl, yearOf, trending, type SearchResult } from "@/lib/tmdb";
import { buildSection } from "@/lib/sections";
import { titleOf } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { browseGenreForId, browseGenreName } from "@/lib/browse";
import { originAdjectives } from "@/lib/region";
import { looksAnime } from "@/lib/topChart";
import type { TrailerTab } from "@/lib/trailerTabs";
export { asTrailerTab, TRAILER_TABS, type TrailerTab } from "@/lib/trailerTabs";

/**
 * 🆕 **علفُ «ترايلرات لك»** (D-726، مواصفةُ أحمد المكتوبة).
 *
 * 🔑 **ولا محرّكَ ترشيحٍ ثانٍ**: `getSuggestions` هي التي تُطعم «مختار
 * لك» منذ D-494 — **وصفٌّ ثانٍ بمصدرٍ ثانٍ تحت الاسم نفسِه («لك»)
 * يُخرج ترشيحين متناقضين في شاشةٍ واحدة** (D-664: رقمان بقاعدتين تحت
 * اسمٍ واحد). **والمصروفُ من `dismissed_titles` مصروفٌ من الاثنين معاً**
 * — **فزرُّ «ليس لي» يعمل يومَ يُبنى بلا جدولٍ جديدٍ ولا فعلٍ جديد.**
 *
 * ⚠️ **والمقطعُ يُطلب لِما سيُعرض وحدَه** (D-510): `getTrailer` نداءٌ
 * أو نداءان لكلِّ عمل، **فلا يُسأل عن ثلاثمئة اقتراحٍ ليُعرض عشرة.**
 * **وردودُ TMDB مخبَّأةٌ ساعةً** (`revalidate: 3600` في `tmdb.ts`) —
 * **فالكلفةُ الحقيقيّةُ أوّلُ قارئٍ في الساعة لا كلُّ فتحة.**
 *
 * ⚠️ **وما لا مقطعَ له يسقط ولا يترك بطاقةً فارغة** (شرطُ أحمد حرفاً،
 * وهو D-222 نفسُها: الصفرُ لا يُرسم) — **ولذلك يُطلب ضِعفُ المطلوب
 * تقريباً ثمّ يُقصّ بعد التصفية، لا قبلها.**
 */
export interface TrailerItem {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  /** مفتاحُ يوتيوب — **لا رابطٌ كامل**: القالبُ يُبنى عند الرسم */
  videoKey: string;
  backdrop: string | null;
  /** **المسارُ الخامُ لا الرابط** — `follow` تخزّن المسار (D-718: يُخزَّن ما يُرسم) */
  posterPath: string | null;
  year: string;
  /** اسمُ أوّلِ نوعٍ بلغة القارئ — «Action» تحت الاسم في تصميمه */
  genre: string | null;
  /**
   * 🆕 **نسبةُ العمل** (D-729، حكمُه: «جنب التصنيف اكتب إذا عمل أمريكي
   * أو مصري وهكذا») — **`countryAdjective` من D-562 حرفاً** (القاعدة ٣):
   * **جدولُ النسب مكتوبٌ منذ ذلك اليوم بلغتين**، **ومن كتب «أمريكي»
   * ثانيةً كتب سلّماً ثانياً يفترق عند أوّل بلدٍ يُضاف.**
   * ⚠️ **و`origin_country` وحدَه ما يصل في ردِّ القائمة** — **وبلدانُ
   * الإنتاج في التفاصيل ولا تُطلب لأجل سطر** (D-510).
   */
  country: string | null;
  /**
   * 🆕 **نبذةُ العمل** (D-729، حكمُه: «إذا فتحت قائمة الترايلر أبغاه
   * يعرض النبذة») — **مجّانيّةٌ في ردِّ القائمة**، **ولا نداءَ لأجلها.**
   * ⚠️ **وتُعرض في الصفحة الكاملة وحدَها**: **صفُّ اكتشف بطاقاتٌ
   * تُمرَّر، وثلاثةُ أسطرٍ في كلٍّ تُطيل الصفَّ بلا أن تُقرأ** (D-510).
   */
  overview: string | null;
  /**
   * «لأنك تحبّ …» — **نصُّ `getSuggestions` نفسُه لا صياغةٌ ثانية**.
   * ⚠️ **واختياريٌّ منذ D-734**: **تبويباتُ الكتالوج لا سببَ شخصيَّ لها**
   * — **وسطرُ «لأنك…» تحت عملٍ رائجٍ عالميّاً كذبٌ صغير** (D-217)،
   * **والغيابُ أصدقُ من صياغةٍ عامّة.**
   */
  note?: string;
}

/** كم عملاً يُسأل عن مقطعه — **وما زاد على الحاجة ثمنُه نداءٌ لا يُعرض** */
const PROBE = 14;

/**
 * 🆕 **ومسبارُ الأنمي أوسعُ لأن معدنَه أفقر** (D-739، بحكم أحمد بعد أن
 * عُرض الثمن): **أربعةٌ من أربعةَ عشرَ عنوانَ أنمي لها ترايلر عند TMDB**
 * — **والرافّةُ تُقصّ عند مصدرِها لا عند سقفها**، فالتبويبُ يُخرج أربعاً
 * مهما رفعنا `limit`.
 * 🔑 **والقاعدةُ: المسبارُ يقاس بخصوبة مصدره لا برقمٍ واحدٍ للجميع** —
 * **ورقمٌ واحدٌ لخمسة مصادرَ يُنصف أغناها ويُجحف أفقرَها.**
 * ⚠️ **والثمنُ معلَنٌ ومحصور**: أربعون نداءَ فيديو بدل أربعةَ عشرَ
 * **عند أوّل رسمٍ لتبويب الأنمي وحدَه** — **ولم يُرفع للتبويبات الأربعة
 * الباقية** لأن معدنَها لا يحتاجه، **وما زاد على الحاجة ثمنُه نداءٌ لا
 * يُعرض** (السطرُ فوق، ولم يُنقض).
 */
const PROBE_ANIME = 40;

/**
 * 🔑 **والسقفُ المطلوبُ من `getSuggestions` هو سقفُ «مختار لك» نفسُه**
 * (D-726): **الدالّةُ مخبَّأةٌ للطلب بوسائطها** — **فسقفٌ مختلفٌ هنا
 * يُبطل الخبيئةَ صامتاً ويخلط الترشيحَ مرّتين في فتحةٍ واحدة.**
 * **والقصُّ عندنا بعد القراءة لا عندها.**
 */
const POOL = 300;

/**
 * 🔴 **والتبويبُ فلترٌ لا زينة** (D-731، بلاغُ أحمد: «في صفحة الأفلام
 * والأنمي لا يظهر لي ترايلر») — **وهي عينُ الشكوى التي أصلحها الصفُّ
 * المجاور قبل شهر**: «بيكد فور يو فالأفلام قاعد يقترح مسلسلات».
 * 🔑 **وقد قرأتُ ذلك السطرَ يومَ بنيتُ هذا الصفَّ ولم أطبّقه**: **أخذتُ
 * من `getSuggestions` بِركتَها ولم آخذ شرطَها** — **ووراثةُ المصدر
 * ليست وراثةَ قواعده.**
 * ⚠️ **والشرطان لا شرطٌ واحد** (D-197 وسابقةُ ١٢ أغسطس): الجهةُ
 * **وألّا يكون أنمي** — **فمن يتابع أنمي تأتيه مقترحاتُ أنميٍ فتظهر في
 * تبويب المسلسلات**، وله تبويبُه.
 * ⚠️ **والتصفيةُ قبل السَّبر لا بعده**: **لو سبرتُ أربعةَ عشرَ ثمّ
 * صفّيتُ لخرج الصفُّ فارغاً في تبويبٍ مليء** — **والقصُّ يسبق التصفية
 * عطلٌ صامت.**
 */
export type TrailerScope = "movies" | "shows" | "anime";

/**
 * 🆕 **تبويباتُ صفحة الترايلرات** (D-734، المرحلةُ الثانية بحكمه).
 *
 * 🔑 **و«لك» وحدَها شخصيّةٌ والأربعُ الباقية كتالوج**: **تبويبٌ يُصفّي
 * ترشيحَك الشخصيَّ يبقى فقيراً بفقر مكتبتك** — **ومن فتح «أفلام» يريد
 * أفلاماً لا أفلاماً تخصّه.** **والشخصيُّ له تبويبُه الأوّل.**
 * ⚠️ **والمصادرُ قائمةٌ كلُّها**: `trending()` و`buildSection("most-popular")`
 * **بحرّاسها وكتمِ لغاتها** (D-545) — **ولا مصدرَ سادسٌ يُكتب لهذه
 * الصفحة** (القاعدة ٣/D-731: وراثةُ المصدر تعني وراثةَ قواعده).
 */
/* 🔴 **والمفرداتُ في `trailerTabs.ts` لا هنا** — هذا الملفُّ
   `server-only`، **وشريطُ الرقائق عميل** (انظر رأسَ ذلك الملفّ). */

/**
 * **صفٌّ من TMDB يصير بطاقةَ ترايلر** — **ووصفةٌ واحدةٌ للتبويبات
 * الخمسة** (القاعدة ٣): **ما يفترق بينها هو المصدرُ وحدَه.**
 */
async function shape(
  rows: SearchResult[],
  locale: Locale,
  limit: number,
  note?: (r: SearchResult) => string,
  /* 🆕 **والمسبارُ وسيطٌ لا ثابتٌ مخبوء** (D-739): **الوصفةُ واحدةٌ
     للتبويبات الخمسة والمتبدِّلُ سعةُ الغرفة لا شكلُها** — **وفرعٌ
     `if (tab === "anime")` داخل الوصفة هو كيف تفترق الوصفةُ يوماً.** */
  probe: number = PROBE,
): Promise<TrailerItem[]> {
  const withKeys = await Promise.all(
    rows.slice(0, probe).map(async (r): Promise<TrailerItem | null> => {
      const mediaType = r.media_type === "movie" ? ("movie" as const) : ("tv" as const);
      const trailer = await getTrailer(mediaType, r.id).catch(() => null);
      if (!trailer?.key) return null;
      const g = r.genre_ids?.length ? browseGenreForId(r.genre_ids[0]) : null;
      const country: string | null =
        originAdjectives({ origin: r.origin_country }, locale === "en" ? "en" : "ar", 1)[0] ?? null;
      return {
        tmdbId: r.id,
        mediaType,
        title: titleOf(r),
        videoKey: trailer.key,
        backdrop: backdropUrl(r.backdrop_path ?? null, "w780"),
        posterPath: r.poster_path ?? null,
        year: yearOf(r) ?? "",
        genre: g ? browseGenreName(g, locale) : null,
        country,
        overview: r.overview?.trim() || null,
        note: note?.(r),
      };
    }),
  );
  return withKeys.filter((x): x is TrailerItem => x !== null).slice(0, limit);
}

/**
 * **علفُ تبويبٍ واحد** (D-734).
 * ⚠️ **والصمتُ عند فشل المصدر** — تبويبٌ فارغٌ خيرٌ من صفحةٍ ساقطة.
 */
export async function getTrailerTabFeed(
  tab: TrailerTab,
  limit: number,
  locale: Locale,
): Promise<TrailerItem[]> {
  if (tab === "for-you") return getTrailerFeed(limit, locale);
  if (tab === "trending") {
    const rows = await trending().catch(() => []);
    return shape(rows, locale, limit);
  }
  const media = tab === "anime" ? "anime" : tab === "movies" ? "movie" : "tv";
  /* 🆕 **والأنمي يُسحب أوسعَ ويُسبر أوسع** (D-739): **توسيعُ المسبار
     بلا توسيع السحب لا يجد ما يسبره** — الرقمُ الواحدُ يخدم الطرفين. */
  const probe = tab === "anime" ? PROBE_ANIME : PROBE;
  const rows = await buildSection(
    "most-popular",
    { media, base: {}, active: false },
    probe,
  ).catch(() => []);
  return shape(rows, locale, limit, undefined, probe);
}

export async function getTrailerFeed(
  limit: number,
  locale: Locale,
  scope?: TrailerScope,
): Promise<TrailerItem[]> {
  const t = getDict(locale);
  /* **والاقتراحاتُ تُطلب واسعةً ثمّ تُقصّ**: `getSuggestions` تخلط
     وتُصفّي المصروفَ والمُشاهَد، **وسقفُها الداخليُّ هو ما نمرّره.** */
  const all = await getSuggestions(POOL, locale).catch(() => []);
  if (!all.length) return [];
  const inScope = scope
    ? all.filter((s) =>
        scope === "anime"
          ? looksAnime(s.result)
          : (scope === "movies"
              ? s.result.media_type === "movie"
              : s.result.media_type === "tv") && !looksAnime(s.result),
      )
    : all;
  const pool = inScope.slice(0, PROBE);
  if (!pool.length) return [];

  const withKeys = await Promise.all(
    pool.map(async (s): Promise<TrailerItem | null> => {
      const mediaType = s.result.media_type === "movie" ? ("movie" as const) : ("tv" as const);
      const trailer = await getTrailer(mediaType, s.result.id).catch(() => null);
      if (!trailer?.key) return null;
      const g = s.result.genre_ids?.length ? browseGenreForId(s.result.genre_ids[0]) : null;
      /* **والنوعُ يُعلَن `string | null` صراحةً**: `[0]` يُستنتج `string`
         بلا `noUncheckedIndexedAccess`، **فيضيق نوعُ الصفِّ عن العقد
         ويسقط حارسُ التصفية أدناه** — عطلٌ يمسكه المترجِم. */
      const country: string | null =
        originAdjectives({ origin: s.result.origin_country }, locale === "en" ? "en" : "ar", 1)[0] ?? null;
      return {
        tmdbId: s.result.id,
        mediaType,
        title: titleOf(s.result),
        videoKey: trailer.key,
        backdrop: backdropUrl(s.result.backdrop_path ?? null, "w780"),
        posterPath: s.result.poster_path ?? null,
        year: yearOf(s.result) ?? "",
        genre: g ? browseGenreName(g, locale) : null,
        country,
        /* **والفارغُ يُكتب غائباً لا سلسلةً فارغة** (D-167/D-222) */
        overview: s.result.overview?.trim() || null,
        note: s.seedTitle ? t.recoFrom(s.seedTitle) : t.recoFromGenre,
      };
    }),
  );

  return withKeys.filter((x): x is TrailerItem => x !== null).slice(0, limit);
}
