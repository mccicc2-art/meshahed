import { getContentPrefs } from "@/lib/data";
import { EMPTY_CONTENT_PREFS, isExcludedLanguage } from "@/core/contentPrefs";
import type { SearchResult } from "./tmdb";
import {
  airingTv,
  nowPlayingMovies,
  popularWellKnown,
  topByFilter,
  topTenThisWeek,
  topTenGenreThisWeek,
  topTenAnimeThisWeek,
  topTenAnimeMoviesThisWeek,
  upcomingByFilter,
  upcomingByGenre,
  upcomingMovies,
  worksByPeople,
  type DiscoverFilter,
} from "./tmdb";
import { getFollowedArtists } from "./data";
import { railGuard, topChartRail } from "./topChart";
/* 🆕 **حكمُ IMDb لصفِّ «أفضل ٢٥»** (D-827) — **انتقل مع مصدره من
   `news/page.tsx`**، فلا يبقى نصفُ الصفِّ في صفحةٍ ونصفُه هنا. */
import { withImdbRatings, rankByImdb } from "./omdb";
import type { Locale } from "@/core/i18n";
import type { RailWin } from "@/core/browse";

/**
 * خلطٌ عشوائيّ — **قرعةُ خادمٍ لا دالّةُ عرض** (نمط D-073 حرفياً).
 *
 * ⚠️ **وبلا `eslint-disable` هنا، بخلاف D-073:** قاعدةُ `react-hooks/purity`
 * تفحص **دوالَّ الرسم** لا كلَّ دالّة، وهذه دالّةٌ مساعدة في وحدةِ خادم —
 * فالاستثناءُ كان سيُبلَّغ عنه «تعليقٌ زائد». **والقاعدةُ التي تحمينا هنا
 * أنّ هذا الملفَّ لا يُستورد من مكوّن عميلٍ قطُّ** (يقرأ `./data`).
 */
/* ⚖️ **و`shuffle` عادت خاصّةً بعد D-747**: **صُدِّرت في D-740 لصفِّ
   الترايلرات، ثمّ استبدله بـ`shuffleSeeded`** — **وتصديرٌ لا مستوردَ له
   بابٌ مفتوحٌ على غرفةٍ لا أحدَ فيها.** */
/**
 * 🔴 🆕 **قرعةٌ بمِفتاح** (D-747) — **تُعيد الترتيبَ نفسَه لنفس المفتاح.**
 *
 * 🔑 **وقرعةٌ تُحسب عند كلِّ رسمٍ تتحرّك تحت إصبع القارئ**: **كلُّ فعلٍ
 * خادميٍّ يُعيد رسمَ الصفحة** («أضف لقائمتي» · «ليس لي» · عودةٌ من
 * صفحة) — **فكان الصفُّ يُبنى من جديدٍ والمقطعُ الذي يشاهده يُستبدل في
 * منتصفه.**
 * 🔑 **والفرقُ الذي غاب عنّي في D-740**: **«لا يتكرّر بين الزيارات» شيء،
 * و«يتبدّل داخل الزيارة» شيءٌ آخر** — **والعشوائيّةُ المطلقة تعطي
 * الأولى وتُهدي الثانية بلا أن يطلبها أحد.**
 *
 * **والمفتاحُ دلوٌ زمنيٌّ من عشر دقائق**: يتغيّر مع الزيارات ولا يتغيّر
 * مع الرسم. ⚠️ **ولا يُبنى على `Math.random`** — mulberry32 صغيرةٌ
 * وحتميّةٌ، **وحتميّةٌ هي كلُّ المطلوب.**
 */
export function shuffleSeeded<T>(rows: T[], seed: number): T[] {
  let a2 = (seed >>> 0) || 1;
  const rnd = () => {
    a2 = (a2 + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a2 ^ (a2 >>> 15), 1 | a2);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffle<T>(rows: T[]): T[] {
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    // العشوائية مقصودة: تُنفَّذ مرّةً لكل طلبٍ على الخادم، لا في رسمٍ يُعاد
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * **سجلُّ أقسام «اكتشف» — مصدرٌ واحد للصفّ وللصفحة الكاملة** (D-198،
 * مواصفةُ أحمد: «Every section title should be clickable → open the full
 * list page containing all items in that category»).
 *
 * ================= لماذا سجلٌّ ولم يكفِ نسخُ الاستعلام =================
 *
 * **لأن هذا بالضبط هو العطلُ الذي كلّفنا ثلاثةَ قرارات.** «أفضل ٥٠» كان
 * يُبنى في مكانين بطريقتين (D-135)، ثم في مكانٍ ثالث لم يُنتبه له (D-164)،
 * ثم تبدّل مصدرُه مرّتين (D-183 · D-189) — **وكلُّ ذلك لأن سؤالاً واحداً
 * كان له أكثرُ من جوابٍ في الشيفرة**. وصفحةٌ كاملةٌ لكل قسمٍ تعني **مصدراً
 * ثانياً لكل قسم**: أربعةَ عشرَ موضعاً تنحرف.
 *
 * فالقسمُ هنا **شيءٌ واحد**: مفتاحُه واسمُه وأيقونتُه **ودالّةُ بنائه**.
 * الصفُّ يناديها بحدٍّ صغير، والصفحةُ تناديها بحدٍّ كبير — **ونفسُ
 * الصفوف بنفس الترتيب** لأنها نفسُ الدالّة.
 *
 * ⚠️ **وما لا يسكن هنا يُقال:** «أفضل ٥٠» و«أفضل ٢٥٠» لهما محرّكُهما في
 * `topChart.ts` (بِركةُ IMDb وحارسُها الثلاثيّ)، **وهما قائمتان كاملتان
 * أصلاً لا صفٌّ يُختصر** — فلا صفحةَ «كاملة» لهما تختلف عمّا يُعرض.
 * و«مقترح لك» بِركةٌ مشتقّةٌ من مكتبة القارئ لا استعلام، **فصفحتُه
 * الكاملة هي `‎/news` نفسه** (D-197: يُصفّى محلياً ويُخفى إن فرغ).
 *
 * ✅ **والبابُ أُغلق (D-199): الأقسامُ الستّة كلُّها تبني من هنا** —
 * `most-popular` · `top-ten` · `upcoming` · `in-cinemas` · `airing-now` ·
 * `from-artists`. **ولم يبقَ في `news/page.tsx` استعلامُ قسمٍ واحد.**
 *
 * **وما بقي هناك بقي لأنه ليس بناءَ القسم:** مدى النافذة (تاريخٌ يخصّ
 * الرقائق) واسمُ منطقة السينما (سطرٌ تحت العنوان، D-150). **السجلُّ يملك
 * «ما يُعرض»، والصفحةُ تملك «كيف يُقال».**
 *
 * 🔑 **ولماذا هذا قرارُ تجربةٍ لا ترتيبُ شيفرة** (وهو ما طلبه أحمد):
 * الرقائقُ تعِد بأن ضغطَ العنوان يفتح **نفسَ النافذة موسَّعةً**. فلو بقي
 * الفرعُ مكتوباً في ملفّين لرأى العميلُ شهراً في الصفحة وأسبوعاً في الصفّ
 * — **وهو لا يعرف أنه رأى شيئين**، فيقرأ الاختلافَ عطلاً في التطبيق لا
 * اختلافَ نطاق. **المصدرُ الواحد ليس نظافةً بل وعدٌ لا يُخلف.**
 */
export type SectionKey =
  | "most-popular"
  | "top-ten"
  /**
   * 🆕 **«أفضل ٢٥ هذي السنة» — بابٌ لصفٍّ كان بلا باب** (D-827، لقطةُ
   * أحمد: صفّان من أربعةٍ بلا «الكل»).
   *
   * 🔑 **ومصدرُه انتقل إلى هنا من `news/page.tsx`** — **وهو بالضبط ما
   * وُجد هذا الملفُّ لأجله** (نصُّ رأسه: «أفضل ٥٠ عاش في ثلاثة مواضع
   * فتبدّل مصدرُه أربع مرّات»): **صفٌّ مصدرُه في صفحةٍ وصفحةٌ تفتحه
   * بمصدرٍ ثانٍ تعرض غيرَ ما ضُغط** (D-199).
   */
  | "top-25"
  | "upcoming"
  | "in-cinemas"
  | "airing-now"
  | "from-artists"
  /**
   * 🆕 **صفُّك أنت، كاملاً** (D-378، بلاغُ أحمد: «أضغط على دراما وأنزل
   * وأشوف الأفلام وأضغط المزيد»): صفوفُ `myRows` كانت **بلا عنوانٍ
   * يُضغط أصلاً** — **وصفٌّ لا بابَ له يقول إن ما تراه هو كلُّ ما هناك**
   * (D-198 من جهتها الثانية).
   *
   * **ومصدرُه مصدرُ الصفّ حرفاً** (`topByFilter` بالشعبية): **لو فتح
   * العنوانُ قسماً آخرَ لصار ما يُضغط غيرَ ما يُرى** (D-199).
   */
  | "my-row";

/** جهةُ المحتوى التي يبنيها القسم — الأنمي جهتان معاً */
export type SectionMedia = "movie" | "tv" | "anime";

export interface SectionCtx {
  media: SectionMedia;
  /** الفلترُ مبنيّاً — يُحسب مرّةً في الصفحة ويُمرَّر (لا يُعاد بناؤه هنا) */
  base: DiscoverFilter;
  /** معرّفاتُ النوع الدرامي لهذه الجهة — تُضاف إلى `base` عند الطلب */
  genreIds?: number[];
  /** هل الفلترُ مفعَّل؟ بعضُ المصادر لا تقبل محاورَه فتتبدّل */
  active: boolean;
  /** نافذةُ صفّ «أفضل ١٠» — أسبوع/شهر/كل الأوقات (D-099 ثم D-445).
      **والنوعُ من `browse.ts` لا نسخةٌ مكتوبةٌ هنا**: كان اتحاداً حرفياً
      في الملفّين، **فاتّساعُ أحدهما وحدَه هو بالضبط ما يجعل نافذةً
      تُرسَل ولا تُقرأ.** */
  win?: RailWin;
  /** مدى النافذة محسوباً — يُمرَّر كي لا يُحسب التاريخ مرّتين */
  winRange?: { from: string; to: string } | null;
  /**
   * **قرعةٌ لكل طلب — للصفّ لا للصفحة** (D-202، طلب أحمد: «تكون عشوائية
   * مثل بيكد فور يو»).
   *
   * **والوعدُ الذي قطعه D-199 يبقى قائماً بصياغته الصحيحة:** الصفُّ
   * **عيّنةٌ من بِركة الصفحة**، فكلُّ ما تراه في الصفّ موجودٌ في الصفحة —
   * والصفحةُ لا تُقرع فترتيبُها ثابتٌ بالشعبية. **«نفسُ المصدر» لا «نفسُ
   * العشرين»**، وهو أقصى ما يمكن أن يعنيه الوعدُ لصفٍّ طُلب أن يتغيّر.
   */
  sample?: boolean;
  /**
   * لغةُ القارئ — **يلزمها مصدرُ الكلاسيكيّات وحده** (`topChartRail`):
   * صفوفُ `imdb_chart` لا يملكها أحد فتُترجَم عند العرض (D-048/D-147).
   * اختياريّةٌ فبدونها يسقط المزجُ ويبقى الرائجُ وحده — **درجةٌ أقلُّ لا
   * شاشةُ خطأ**.
   */
  locale?: Locale;
}

/** مفتاحُ الترجمة لعنوان القسم — الاسمُ يبقى في `i18n.ts` لا يُنسخ هنا */
export const SECTION_TITLE_KEY: Record<
  SectionKey,
  { movie: string; tv: string; anime: string }
> = {
  "most-popular": {
    movie: "mostPopularMovies",
    tv: "mostPopularSeries",
    anime: "mostPopularAnime",
  },
  "top-ten": { movie: "top10Movies", tv: "top10Series", anime: "top10Anime" },
  /* **والاسمُ من مفاتيح الصفِّ نفسِها** (D-703): ما يُضغط هو ما يُقرأ */
  "top-25": { movie: "top50Movies", tv: "top50Series", anime: "top50AnimeMovies" },
  upcoming: { movie: "comingSoon", tv: "comingSoon", anime: "upcomingAnime" },
  "in-cinemas": { movie: "inCinemas", tv: "inCinemas", anime: "animeInCinemas" },
  "airing-now": { movie: "airingNowAnime", tv: "airingNowAnime", anime: "airingNowAnime" },
  "from-artists": { movie: "artistsRail", tv: "artistsRail", anime: "artistsRail" },
  /* **وعنوانُ صفِّك يُركَّب من نوعه ووسمه في الصفحة نفسِها** — لا مفتاحَ
     قاموسٍ له، **فالاسمُ من اختيارك لا من قاموسنا** (D-337/D-147). */
  "my-row": { movie: "navNews", tv: "navNews", anime: "navNews" },
};

/**
 * وجهةُ عنوانِ القسم — **والفلترُ يُحمل معه** (مواصفةُ أحمد: الفلترُ عامٌّ
 * داخل التبويب، فمن ضغط عنواناً وهو يصفّي يتوقّع أن تصل التصفيةُ معه).
 *
 * والرابطُ يُبنى من `search` الحاليّ حرفياً بدل إعادة تركيبه محورًا محورًا:
 * **محورٌ جديد غداً يصل من نفسه**، ولو عُدّدت المحاور هنا لصار الرابطُ
 * يُنسى تحديثُه — وهو ما وقع في D-174 مع بانيَي الرابط.
 */
export function sectionHref(key: SectionKey, media: SectionMedia, search?: string): string {
  const p = new URLSearchParams(search ?? "");
  p.delete("tab");
  p.set("m", media);
  const qs = p.toString();
  return `/discover/${key}${qs ? `?${qs}` : ""}`;
}

/**
 * 🔴 🆕 **ويُشتقُّ من `SECTION_TITLE_KEY` لا يُعدَّد بيدٍ** (D-827):
 * **كان اتحاداً مكتوباً حرفاً حرفاً** — **فقسمٌ يُضاف إلى النوع وإلى
 * الخريطة ويُنسى هنا يردّ `notFound()`**، **وهو بابٌ يُفتح على لا
 * شيءٍ لا عطلٌ يُرى** (وقد كاد يقع في هذه الدفعة نفسِها).
 * 🔑 **والخريطةُ لا تُنسى لأنّ الصفحةَ لا تُرسم بلا عنوان** — **فما
 * يُشتقُّ منها لا يفترق عنها.**
 */
export function isSectionKey(v: string): v is SectionKey {
  return Object.prototype.hasOwnProperty.call(SECTION_TITLE_KEY, v);
}

export function isSectionMedia(v: string | undefined): v is SectionMedia {
  return v === "movie" || v === "tv" || v === "anime";
}

/** الجهةُ التي تُسأل عنها TMDB — والأنمي يُسأل عن الجهتين ثم يُدمج */
const sides = (m: SectionMedia): ("movie" | "tv")[] =>
  m === "anime" ? ["tv", "movie"] : [m];

/**
 * **بناءُ قسمٍ — الدالّةُ الواحدة التي يناديها الصفُّ والصفحة.**
 *
 * `limit` هو كلُّ الفرق بينهما: الصفُّ يطلب عشرين والصفحةُ ستّين.
 * **ولا فرقَ ثانٍ** — لا ترتيبٌ آخر ولا مصدرٌ آخر ولا حارسٌ آخر، وإلا صار
 * ما تراه في الصفحة غيرَ ما وعد به الصفّ الذي أتيت منه.
 *
 * **والحارسُ (D-194) داخلَ الدالّة لا عند مستدعيها:** لو تُرك للمستدعي
 * لعادت اللغاتُ المكتومة من باب الصفحة الجديدة — وهو حرفياً درسُ D-175
 * (حارسٌ في أحد الفروع يحرس فرعَه وحده).
 */
export async function buildSection(
  key: SectionKey,
  ctx: SectionCtx,
  limit = 20,
): Promise<SearchResult[]> {
  const { media, base, genreIds, active } = ctx;
  const anime = media === "anime" ? ("only" as const) : ("drop" as const);
  /* «خلّها تظهر إذا شخص حدّد جنسيتهم فقط» (D-194) — والكتمُ يسقط بلغةٍ أو بلد */
  const unmute = !!base.lang || !!base.country;

  /* ===== 🆕 اللغاتُ المستبعدة تُحذف من الاستكشاف (D-545) =====

     **ومكانُها هنا بالضبط**: `guard` هو الحلقُ الذي تمرّ به **كلُّ**
     أقسام الاكتشاف بلا استثناء — **فقاعدةٌ واحدةٌ تُكتب مرّةً**، ولا
     شرطٌ متفرّقٌ في خمسة عشر فرعاً (`switch` أدناه).

     ⚠️ **حذفٌ لا إعادةَ ترتيب** (شرطُ المواصفة: «لا تغيّر ترتيب
     الأقسام الموضوعية مثل Top 10 إلّا لإزالة اللغات المستبعدة»):
     **الترتيبُ الداخليُّ يبقى كما أنتجه القسم**، والذي يقع هو سقوطُ
     صفوفٍ من الوسط.

     ⚠️ **ولا تعزيزَ هنا ولا تخفيض**: **الاستكشافُ تصفّحٌ لا توصية** —
     **وتعزيزُ لغةٍ في «الأكثر شعبيّة» يجعل القسمَ يكذب على اسمه.**
     التعزيزُ في `blendRecommendations` وحدَها.

     ⚠️ **وبلا استبعادٍ لا يُنادى شيء**: `hasAnyPrefs` تُفحص أوّلاً،
     **والقراءةُ مخبَّأةٌ للطلب** (`getContentPrefs`) فلا استعلامَ
     لكلِّ قسم. */
  /* 🔴 **ولا يُنتظر هنا** (D-549، تراجعٌ مقيسٌ أدخلته D-545 في يومها):
     **كُتب أوّلاً `await getContentPrefs()` قبل `switch`** — **فصار كلُّ
     رفٍّ في «اكتشف» ينتظر قراءةَ صفِّ الملفّ من Supabase قبل أن يُطلق
     نداءَ TMDB الأوّل.** **و`getProfile` مخبَّأةٌ للطلب فالقراءةُ واحدة،
     لكنّ الرفوفَ الثمانية تنطلق بعدها لا معها** — **حاجزٌ متسلسلٌ أمام
     صفحةٍ معمارُها كلُّه بثٌّ متوازٍ** (D-515).

     **والعلاجُ أن يُطلق الوعدُ ولا يُنتظر**: النداءُ يبدأ الآن مع
     أوّل سطر، **ويُنتظر داخل `guard` بعد أن يعود جلبُ الرفّ** — **فيقع
     في ظلِّ نداء TMDB بدل أن يقف أمامه.** **والناتجُ حرفٌ بحرفٍ كما
     كان.** */
  const prefsP = getContentPrefs().catch(() => EMPTY_CONTENT_PREFS);

  const guard = async (rows: SearchResult[]) => {
    const kept = railGuard(rows, { anime, unmute });
    const prefs = await prefsP;
    return (
      prefs.excludedLanguages.length > 0
        ? kept.filter((r) => !isExcludedLanguage(r, prefs))
        : kept
    ).slice(0, limit);
  };

  try {
    switch (key) {
      case "most-popular": {
        /* ================= D-202 — إعادةُ بناءٍ كاملة =================
           **بلاغ أحمد بلقطة:** الصفُّ كان Secret Story ٤٫٦ · Paradise
           Hotel ٤٫٣ · Paradise Hotel ٤٫١ · Big Brother. وطلبُه بنصّه:
           «لازم فيها الأشياء الأكثر شعبية **جداً** · وتكون عشوائية مثل
           بيكد فور يو · وتركّز على الشعبية العالية **والمعروفة جداً** ·
           وتكون ذكية: تعرض شيئاً شعبياً جداً رائجاً **مع** شعبيٍّ جداً
           يجب مشاهدتُه **مثل Lost»**.

           **فثلاثةُ أشياء لا واحد، ولكلٍّ سببُه:**

           **١) حاجزُ جودةٍ وحاجزُ أصوات** (`popularWellKnown`): قائمةُ
              `/popular` العارية تُرتّب بـ`popularity` — **رقمُ حركةٍ لا
              رقمُ جودة**. وبرامجُ الواقع تُنتج نسخةً وطنيةً كلَّ موسم
              فتتصدّرها بأصواتٍ قليلة (**ولهذا ظهر «Paradise Hotel»
              مرّتين — صفّان مختلفان عند TMDB**).

           **٢) مزجٌ بالمعروفِ الخالد** (`getImdbChart`): «مثل Lost» هي
              المفتاح — Lost **ليست رائجةً هذا الأسبوع**، فلا تصل من
              مصدرِ شعبيةٍ أبداً مهما رفعنا حاجزه. **فالثلثُ من قائمة
              IMDb** التي نملكها أصلاً (D-135)، وهي حرفياً «شعبيٌّ جداً
              يجب مشاهدتُه». **ولا نداءَ جديد:** قراءةٌ من قاعدتنا.

           **٣) قرعةٌ لكل طلبٍ للصفّ** (`ctx.sample`، نمط D-073): الصفُّ
              عشرون من بِركةِ ستّين، فلا يتجمّد على نفس الوجوه — **وهو
              ما طلبه: «عشوائية مثل بيكد فور يو»**.

           ⚠️ **ومع الفلتر يسقط المزجُ ويبقى الحاجزان:** من اختار «٢٠٢٦»
              أو «كوري» لا يريد كلاسيكيّاتٍ لا تطابق اختياره — **والقائمةُ
              لا تحمل لغةً ولا سنةً تُصفّى بها** (D-189). فالتصفيةُ وعدٌ
              يُقدَّم على التنويع. */
        const wantMix = !active && media !== "anime";
        const locale = ctx.locale;
        const [fresh, classics] = await Promise.all([
          Promise.all(
            sides(media).map((mt) =>
              /* الأنمي `/discover` دائماً: `/popular` لا يقبل مفتاحاً */
              /* 🆕 **والصفحاتُ تكبر مع الحدّ** (D-378): صفحةُ القسم تطلب
                 ستّين ثم مئةً وعشرين عند «المزيد» — **وصفحتان تعطيان
                 أربعين مهما طلبتَ**، فيقف الترقيمُ عند أوّل ضغطة.
                 **و`want` يفتح سُلَّمَ الحواجز** حين لا تكفي البِركةُ
                 المضيَّقة بالفلتر (بلاغُ العربية). */
              popularWellKnown(
                mt,
                { ...base, genreIds },
                Math.max(wantMix ? 2 : 3, Math.ceil(limit / 20)),
                undefined,
                undefined,
                limit,
              ),
            ),
          ).then((r) => r.flat()),
          /* 🔴 **`topChartRail` لا `getImdbChart` — وهذا خطأٌ وقع وقِيس على
             الإنتاج قبل أن يُصلَح، فيُقال:** أوّلُ نسخةٍ قرأت القائمةَ
             **خاماً** فعاد الصفُّ يحمل **«Sapne vs Everyone» و«Scam 1992»**
             (هنديّ) و**«Blue Planet II» و«Cosmos» مرّتين** (وثائقيّ)
             و**«Bluey»** — أي **كلُّ ما أُسقط في D-165 وD-170 وD-189 عاد
             من بابٍ خلفيّ**.

             **والسببُ أنّ الحُرّاس ليست في القائمة بل في `filterRail`**:
             الوثائقيُّ واللغةُ المكتومة وقائمةُ الاستبعاد كلُّها هناك.
             **وأسوأُ من ذلك أن `railGuard` لم يكن يستطيع مساعدتَنا**:
             الصفوفُ المصنوعة يدوياً من `ChartRow` **لا تحمل
             `original_language` ولا `genre_ids`** — فالحارسُ يقرأ فراغاً
             ويُمرّر. **حارسٌ يُمرَّر عليه صفٌّ بلا حقولٍ يقرؤها ليس حارساً.**

             **فالمصدرُ صار الدالّةَ التي تحرس وتترجم أصلاً** — وهي نفسُها
             التي تبني «أفضل ٥٠» في هذه الصفحة، **فالتفاصيلُ مخبّأةٌ من
             ندائها ولا كلفةَ ثانية**. */
          wantMix && locale
            ? topChartRail(media === "movie" ? "movie" : "tv", 60, locale).catch(
                () => [] as SearchResult[],
              )
            : Promise.resolve([] as SearchResult[]),
        ]);

        /* **و`guard` صارت مؤجَّلة** (D-549) — والقارئُ الوحيدُ الذي
           يستعمل ناتجَها متزامناً ينتظرها هنا صراحةً. */
        const byPopularity = await guard(
          fresh.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
        );
        /* **الثلثُ خالدٌ والثلثان رائج** — ونصيبُ الخالد يُحسب من الحدّ لا
           من طول البِركة، كي تبقى النسبةُ نفسَها في الصفّ وفي الصفحة. */
        const keepClassics = wantMix ? Math.round(limit / 3) : 0;
        const seen = new Set(byPopularity.map((r) => `${r.media_type}-${r.id}`));
        const mixed = [
          ...byPopularity,
          ...classics.filter((r) => !seen.has(`${r.media_type}-${r.id}`)).slice(0, keepClassics * 2),
        ];

        if (!ctx.sample) return mixed.slice(0, limit);

        /* قرعةُ خادمٍ عند كل طلب (D-073): البِركةُ مخبّأةٌ ساعةً، فبلا
           القرعة يرى العميلُ الوجوهَ نفسها كلَّ فتحة. والانحيازُ مقصود:
           الرائجُ أوّلاً ثم يُخلط الكلّ، فيبقى الصفُّ «الأكثرَ شعبية» ولا
           يصير رفَّ كلاسيكيّات. */
        const pick = [
          ...shuffle(byPopularity.slice(0, Math.max(limit, 40))).slice(0, limit - keepClassics),
          ...shuffle(mixed.slice(byPopularity.length)).slice(0, keepClassics),
        ];
        return shuffle(pick).slice(0, limit);
      }

      case "top-ten": {
        /* نوافذُ D-099 كما هي: الأسبوعُ من الرائج (أو `/discover` المُصفّى)،
           والشهرُ والسنةُ من `/discover` بمدىً محسوبٍ في المستدعي. */
        /* 🔴 🆕 **هامشٌ قبل الحارس** (D-322، عطلٌ قِيس على المنشور: رفُّ
           «أفضل ١٠ مسلسلات» عرض **ستّةً** بعد أن اتّسع الكتمُ في D-321).
           **والعلّةُ أن هذا الفرعَ وحدَه كان يطلب من المصدر عددَ ما يعرض
           بالضبط** — بينما «أفضل ٥٠» يطلب `DOC_MARGIN` و«الأكثر شعبية»
           صفحتين. **فبِركةٌ بحجم الحدّ تُفسد الحاجزَ الذي فوقها** (D-185)،
           **ودرسُ D-189 يُعاد للمرّة الرابعة: الهامشُ يتّسع مع ما يُسقطه
           أو يكذب العنوان.** */
        const pool = Math.min(60, Math.round(limit * 2.5));
        const w = ctx.win ?? "week";
        /* 🆕 **ونافذةُ «كل الأوقات» تُرتَّب بعدد الأصوات لا بالشعبية**
           (D-445). **والسببُ أن الترتيبَ هنا اختيارُ بِركةٍ لا حكمٌ
           نهائيّ**: المستدعي يمرّر الصفَّ على `withImdbRatings` فيفرزه
           بتقييم IMDb تنازلياً — **فوظيفةُ هذا السطر أن يقرّر مَن يدخل
           العشرة لا مَن يتقدّمها**. و«الأكثرُ أصواتاً» بِركةُ ما شاهده
           الناسُ فعلاً عبر التاريخ، **بينما `popularity` حركةُ هذا
           الأسبوع** — فترتيبُها كان سيجعل «كل الأوقات» تعرض أفلامَ
           السنةِ نفسَها التي تعرضها نافذةُ الشهر. */
        const sortFor =
          w === "week"
            ? ("vote_average.desc" as const)
            : w === "month"
              ? ("popularity.desc" as const)
              : ("vote_count.desc" as const);
        const rows = await Promise.all(
          sides(media).map((mt) => {
            /* ⚠️ **و«كل الأوقات» تغادر مسارَ الأنمي السريع**: ذاك يُبنى
               من الرائج بمدىً اختياريّ، **ومدىً غائبٌ فيه يعني «هذا
               الأسبوع» لا «كل الأوقات»** — فكان الزرُّ الثالث سيعرض
               نتيجةَ الأوّل بالضبط. */
            if (media === "anime" && !active && w !== "all") {
              const r = ctx.winRange ?? undefined;
              return mt === "movie"
                ? topTenAnimeMoviesThisWeek(pool, r)
                : topTenAnimeThisWeek(pool, r);
            }
            if (active || w !== "week" || media === "anime") {
              return topByFilter(
                mt,
                { ...base, genreIds, ...(ctx.winRange ?? {}) },
                pool,
                sortFor,
              );
            }
            return genreIds?.length
              ? topTenGenreThisWeek(mt, genreIds, pool)
              : topTenThisWeek(mt, pool);
          }),
        );
        return guard(rows.flat());
      }

      case "upcoming": {
        const rows = await Promise.all(
          sides(media).map((mt) =>
            active || media === "anime"
              ? upcomingByFilter(mt, { ...base, genreIds })
              : genreIds?.length
                ? upcomingByGenre(genreIds, mt)
                : mt === "movie"
                  ? upcomingMovies()
                  : airingTv(),
          ),
        );
        const today = new Date().toISOString().slice(0, 10);
        return guard(
          rows
            .flat()
            .filter((r) => (r.release_date || r.first_air_date || "") >= today)
            .sort((a, b) =>
              (a.release_date || a.first_air_date || "").localeCompare(
                b.release_date || b.first_air_date || "",
              ),
            ),
        );
      }

      case "in-cinemas": {
        /* `‎/now_playing` **لا يقبل نوعاً ولا لغةً** — يقبل المنطقة وحدها،
           فيغيب وقتَ الفلتر بدل أن يعرض ما لم يُطلب (D-075). */
        if (active) return [];
        const c = await nowPlayingMovies();
        return c ? guard(c.results) : [];
      }

      case "airing-now": {
        /* **موسمُ الأنمي الحاليّ لا `‎/tv/on_the_air`** — وقد جُرّبت تلك
           وأعادت صفراً على الإنتاج (قائمةٌ عالميّة لا تقبل مفتاحاً). */
        const now = new Date();
        const q = `${now.getUTCFullYear()}-${String(
          Math.floor(now.getUTCMonth() / 3) * 3 + 1,
        ).padStart(2, "0")}-01`;
        const rows = await topByFilter(
          "tv",
          { ...base, genreIds, from: base.from ?? q, to: base.to ?? now.toISOString().slice(0, 10) },
          limit * 2,
          "popularity.desc",
        );
        return guard(rows);
      }

      /**
       * 🆕 **«أفضل ٢٥ هذي السنة»** (D-827) — **نُقل حرفاً من
       * `bestOfYear` في `news/page.tsx`**، **والذي تبدّل شيئان لا
       * ثالثَ لهما**: **الحدُّ صار `limit`** (كان ٢٥ ثابتاً) —
       * **فالصفحةُ تعمّق ما يعرضه الصفّ ولا تغيّره** (D-199) —
       * **والبِركةُ تتّسع معه** بهامشٍ ثابت (درسُ D-322: بِركةٌ بحجم
       * الحدّ تُفسد الحاجزَ فوقها).
       *
       * ⚠️ **والسنةُ تعلو على الحقبة المختارة** — **بنصِّ التعليق
       * الأصليّ**: «من اختار التسعينات ثمّ قرأ عنواناً يقول هذي السنة
       * ينتظر هذي السنة» (D-141).
       */
      case "top-25": {
        const y = new Date().getFullYear();
        /* 🔴 **والبِركةُ ستّون ثابتاً لا تتبع `limit` — قِيس فسقط**:
           **أوّلُ نسخةٍ وسّعتها إلى مئةٍ وخمسين للصفحة**، **فعادت
           الصفحةُ بأحدَ عشرَ صفّاً والرفُّ باثنين وعشرين** — **صفحةٌ
           أضيقُ من الرفِّ الذي فتحها، وهو نقيضُ الوعد** (D-199).
           **والعلّةُ أنّ إثراءَ التقييمات ليس مجّانيّاً**: `rankByImdb`
           تُسقط ما لا تقييمَ له، **وبِركةٌ أوسعُ تعني نصيباً أقلَّ من
           الإثراء لكلِّ صفّ** — **فالأوسعُ أفقرُ هنا، خلافاً للحدس.**
           🔑 **والدرسُ**: **رقمٌ مضبوطٌ بالقياس لا يُعمَّم بضربه في
           معاملٍ يبدو معقولاً** (درسُ D-322 من جهته المقابلة). */
        const rows = await topByFilter(
          media === "tv" ? "tv" : "movie",
          { ...base, genreIds, from: `${y}-01-01`, to: `${y}-12-31` },
          60,
          "vote_count.desc",
        );
        const rated = await withImdbRatings(rows);
        /* **وخمسةٌ وعشرون سقفُه لأنّ اسمَه حدُّه**: **«أفضل ٢٥» ليست
           عيّنةً من قائمةٍ أطول** — **وصفحةٌ تعرض ستّين تحت عنوانٍ يقول
           خمسةً وعشرين تكذب** (D-141). **والصفحةُ تعطي ما يعطيه الرفُّ
           شبكةً لا رفّاً أفقيّاً**، وهو الفرقُ الذي فتحه البابُ. */
        return guard(rankByImdb(rated, { want: Math.min(limit, 25) }));
      }

      case "my-row": {
        /* **نفسُ نداء `MyRowsRails` بحرفه**: `topByFilter` بالشعبية،
           **والوسمُ والأنمي يصلان في `base.keywords`** كما تبنيهما
           الصفحة — **فما يفتحه العنوانُ هو ما يعرضه الصفّ، أعمقَ لا
           أغيرَ** (D-199). */
        const rows = await topByFilter(
          media === "movie" ? "movie" : "tv",
          { ...base, genreIds },
          limit,
          "popularity.desc",
        );
        return guard(rows);
      }

      case "from-artists": {
        /* أعمالُ من تتابعه — **أفلامٌ فقط، قيدُ مصدرٍ لا اختيار**:
           TMDB لا يقبل `with_people` على `/discover/tv` (D-062). */
        const artists = await getFollowedArtists(20);
        if (!artists.length) return [];
        const rows = await worksByPeople(
          artists.map((a) => a.person_id),
          limit,
        );
        /* ⚠️ **ولا كتمَ لغةٍ في هذا القسم وحده** — وهو **استثناءٌ مقصود
           لا سهو** (D-194): الصفُّ أعمالُ فنّانين **اختارهم العميلُ
           بنفسه**، وكتمُ لغةٍ اختارها هو **تجاهلٌ لذوقه لا تحرير**. ومن
           تابع مخرجاً كوريّاً يريد أفلامه — لا صفّاً فارغاً يسأل نفسه
           لماذا. **والأنمي يُسقط كما هو** (له تبويبُه). */
        return railGuard(rows, { anime, unmute: true }).slice(0, limit);
      }
    }
  } catch {
    /* قسمٌ تعذّر بناؤه يعود فارغاً فيُخفى — لا شاشةَ خطأ لصفٍّ واحد */
    return [];
  }
}
