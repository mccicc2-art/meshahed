import "server-only";

import { getSuggestions } from "@/lib/suggest";
import {
  getTrailerKeys,
  backdropUrl,
  yearOf,
  trending,
  ANIME_KEYWORD,
  type SearchResult,
  type TrailerVideo,
} from "@/lib/tmdb";
import { buildSection, shuffleSeeded } from "@/lib/sections";
import { titleOf } from "@/lib/media";
import { getAppleTrailerUrl } from "@/lib/appleTrailers";
import { getDict, num, type Dict, type Locale } from "@/lib/i18n";
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
   * 🆕 **بدائلُ المقطع مرتّبةً** (D-743) — **الأوّلُ هو `videoKey`
   * نفسُه، وما بعده يُجرَّب حين يرفض يوتيوب الأوّل** (حجبٌ بلدِيٌّ أو
   * تعطيلُ تضمين). **والحجبُ لا يُتوقّع، يُكتشف.**
   */
  videoKeys: string[];
  /**
   * 🔴 🆕 **ملفُّ فيديو أصيلٌ إن وُجد** (D-758) — معاينةُ iTunes بصيغة
   * MP4 تُشغَّل في `<video>` مباشرةً: **أوّلُ إطارٍ بمئات المللي ثانية
   * بدل ثواني إقلاع صفحةِ يوتيوب.** **والغيابُ سقوطٌ إلى مفاتيح يوتيوب
   * لا عطل** — أفلامٌ إنجليزيّةُ الاسم في الغالب، والباقي على D-757.
   */
  fileUrl: string | null;
  /**
   * «لأنك تحبّ …» — **نصُّ `getSuggestions` نفسُه لا صياغةٌ ثانية**.
   * ⚠️ **واختياريٌّ منذ D-734**: **تبويباتُ الكتالوج لا سببَ شخصيَّ لها**
   * — **وسطرُ «لأنك…» تحت عملٍ رائجٍ عالميّاً كذبٌ صغير** (D-217)،
   * **والغيابُ أصدقُ من صياغةٍ عامّة.**
   */
  note?: string;
  /**
   * 🆕 **وسمُ المقطع** (D-772، بلاغُ أحمد: «الفيديوهات قليلة… وش فيه
   * أفكار لزيادة المقاطع؟») — **«تشويقة» · «الإعلان ٢» · «مشهد»**.
   * 🔑 **والعلفُ صار بطاقةً لكلِّ مقطعٍ لا لكلِّ عمل**: **قِيس على
   * المنشور أنّ الصفحة تُنزّل ٥٥ مفتاحاً لأربعةَ عشرَ عملاً وتعرض
   * اثني عشر** — **ثلاثةٌ وأربعون مقطعاً منزَّلاً ومدفوعَ الثمن لا
   * يراها أحد.** **والزيادةُ من الحمولة القائمة بصفر نداء.**
   * ⚠️ **والوسمُ شرطُ الفهم لا زينة**: **بطاقتان لعملٍ واحدٍ بلا وسمٍ
   * تُقرآن تكراراً** — **والأولى (الإعلان الرسميّ) بلا وسمٍ عمداً:
   * هي الأصلُ وما بعدها هو الذي يحتاج تعريفاً.**
   */
  clipLabel: string | null;
}

/**
 * **أرضيّةُ المسبار** — كم عملاً يُسأل عن مقطعه على الأقلّ.
 * ⚠️ **واسمُه صار أرضيّةً لا عدداً منذ D-756**: **الرقمُ الفعليُّ من
 * `probeFor(limit)`** — **وثابتٌ تغيّر معناه ولم يتغيّر تعليقُه يكذب على
 * أوّل قارئٍ بعده.**
 * **وما زاد على الحاجة ثمنُه نداءٌ لا يُعرض.**
 */
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
 * 🔴 🆕 **مفتاحُ القرعة — دلوٌ زمنيٌّ من عشر دقائق** (D-747).
 *
 * 🔑 **يتغيّر مع الزيارات ولا يتغيّر مع الرسم**: **فالقارئُ يرى وجوهاً
 * جديدةً كلَّما عاد** (وهو مطلبُ D-740)، **ولا يُسحب المقطعُ من تحت
 * عينه حين يضغط «أضف لقائمتي»** (وهو بلاغُ اليوم).
 * ⚠️ **وعشرٌ لا دقيقة**: **جلسةُ تصفّحٍ واحدةٌ تسع عشرَ دقائقَ بسهولة**،
 * **ومفتاحٌ يتغيّر كلَّ دقيقةٍ يعيد العطلَ لمن أطال النظر.**
 */
function drawKey(): number {
  return Math.floor(Date.now() / 600000);
}

/**
 * 🔑 **والسقفُ المطلوبُ من `getSuggestions` هو سقفُ «مختار لك» نفسُه**
 * (D-726): **الدالّةُ مخبَّأةٌ للطلب بوسائطها** — **فسقفٌ مختلفٌ هنا
 * يُبطل الخبيئةَ صامتاً ويخلط الترشيحَ مرّتين في فتحةٍ واحدة.**
 * **والقصُّ عندنا بعد القراءة لا عندها.**
 */
const POOL = 300;

/**
 * 🔴 🆕 **والمسبارُ يتبع المطلوب لا رقماً واحداً للجميع** (D-756).
 *
 * **رفعتُ سقفَ العلف من ١٢ إلى ١٤ ليبقى فائضٌ تُملأ منه الخانات، والمسبارُ
 * ١٤ على حاله** — **فالفائضُ لا وجودَ له إلّا إن كان لكلِّ أربعةَ عشرَ
 * عملاً ترايلر**، **وسقفٌ يساوي مسبارَه فائضُه صفرٌ بالتعريف.**
 * 🔑 **والقاعدةُ مكتوبةٌ في رأس هذا الملفّ منذ D-726**: «**يُطلب ضِعفُ
 * المطلوب تقريباً ثمّ يُقصّ بعد التصفية**» — **ورفعُ السقف بلا رفع
 * المسبار نقضٌ لها بلا أن يُقصد.**
 * ⚠️ **ورايلُ اكتشف لا يدفع شيئاً**: ستٌّ تُعرض وتسعٌ تُطلب **فيبقى
 * مسبارُه أربعةَ عشرَ كما كان** — **والسطحُ الذي طُلبت له السرعةُ لا
 * يُحمَّل ثمنَ سطحٍ آخر.**
 */
function probeFor(limit: number): number {
  return Math.min(24, Math.max(PROBE, Math.ceil(limit * 1.5)));
}

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

export type TrailerPin = { mediaType: "movie" | "tv"; tmdbId: number };

export function asTrailerScope(raw: string | null | undefined): TrailerScope | undefined {
  return raw === "movies" || raw === "shows" || raw === "anime" ? raw : undefined;
}

export function parseTrailerAt(raw: string | null | undefined): TrailerPin | undefined {
  const match = /^(movie|tv)-(\d+)$/.exec(raw ?? "");
  if (!match) return undefined;
  const tmdbId = Number(match[2]);
  return Number.isSafeInteger(tmdbId) && tmdbId > 0
    ? { mediaType: match[1] as TrailerPin["mediaType"], tmdbId }
    : undefined;
}

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
 * 🆕 **الأنواعُ التي تستحقّ بطاقةً بنفسها** (D-772).
 * ⚠️ **و«خلف الكواليس» و«الأخطاء» ليست ترايلرات**: تبقى بدائلَ خانةٍ
 * حين يرفض يوتيوب مقطعاً، **ولا تُرقّى بطاقةً في علفِ إعلانات** —
 * **وصفحةٌ اسمُها «ترايلرات» تعرض لقطاتِ كواليسَ تكذب على اسمها**
 * (D-664: الاسمُ يقول قاعدتَه).
 */
const CLIP_TYPES = new Set(["Trailer", "Teaser", "Clip"]);

/** **وسمُ البطاقة** — والأوّلُ الرسميُّ بلا وسمٍ عمداً (هو الأصل) */
function clipLabelOf(v: TrailerVideo, ordinal: number, locale: Locale, t: Dict): string | null {
  const n = num(ordinal, locale);
  if (v.type === "Teaser") return ordinal > 1 ? `${t.clipTeaser} ${n}` : t.clipTeaser;
  if (v.type === "Clip") return ordinal > 1 ? `${t.clipScene} ${n}` : t.clipScene;
  return ordinal > 1 ? `${t.clipTrailer} ${n}` : null;
}

/**
 * 🔴 🆕 **التوزيعُ دائريٌّ لا متتابع** (D-772): **مقطعٌ من كلِّ عملٍ
 * أوّلاً ثمّ نعمّق** — **فلا يقع عملان متجاوران لعملٍ واحد**، **ورأسُ
 * العلف يبقى أعرضَ تنويعاً كما كان.** **والتتابعُ (كلُّ مقاطع العمل
 * معاً) كان سيقلب صفحةَ اكتشافٍ إلى أرشيفِ عملٍ واحد.**
 */
function interleaveClips(
  titles: { base: Omit<TrailerItem, "clipLabel">; videos: TrailerVideo[] }[],
  limit: number,
  perTitle: number,
  locale: Locale,
  t: Dict,
): TrailerItem[] {
  const out: TrailerItem[] = [];
  const depth = Math.max(1, perTitle);
  /* **بطاقاتُ كلِّ عملٍ وبدائلُه تُحسب مرّةً** — ودورانٌ يعيد حسابَها
     في كلِّ جولةٍ يكرّر العملَ بلا فائدة */
  const plan = titles.map(({ base, videos }) => {
    /* **البطاقاتُ من الأنواع الثلاثة وحدَها** — وعملٌ لا يملك منها
       شيئاً يأخذ أوّلَ ما عنده بطاقةً واحدة: **إسقاطُه بالكامل خسارةُ
       عملٍ كاملٍ ثمناً لوسمٍ** (D-222: الصفرُ لا يُرسم، وهذا ليس صفراً). */
    const typed = videos.filter((v) => CLIP_TYPES.has(v.type));
    const cards = typed.length ? typed : videos.slice(0, 1);
    /* 🔑 **والبدائلُ ما لم يصر بطاقةً** (D-756 محفوظةً): **سلسلةُ
       الاحتياط تبقى لكلِّ بطاقة** — **لكنّها لا تحمل مفتاحاً هو نفسُه
       بطاقةٌ مجاورة**، **وإلّا عرض الاحتياطُ ما تعرضه جارتُه.** */
    const asCards = new Set(cards.slice(0, depth).map((v) => v.key));
    const spares = videos.filter((v) => !asCards.has(v.key)).map((v) => v.key);
    return { base, cards, spares };
  });
  for (let round = 0; round < depth && out.length < limit; round++) {
    for (const { base, cards, spares } of plan) {
      if (out.length >= limit) break;
      const v = cards[round];
      if (!v) continue;
      /* **ورتبةُ الوسم داخل نوعه**: «الإعلان ٢» يعني ثانيَ إعلانٍ لا
         ثانيَ مقطعٍ أيّاً كان — **ورقمٌ يعدّ غيرَ ما يسمّيه يكذب.** */
      const ordinal = cards.slice(0, round + 1).filter((x) => x.type === v.type).length;
      out.push({
        ...base,
        videoKey: v.key,
        videoKeys: [v.key, ...spares],
        /* **وملفُّ آبل للأولى وحدَها** — هو معاينةُ العمل لا هذا المقطع */
        fileUrl: round === 0 ? base.fileUrl : null,
        clipLabel: clipLabelOf(v, ordinal, locale, t),
      });
    }
  }
  return out;
}

/**
 * **صفٌّ من TMDB يصير بطاقةَ ترايلر** — **ووصفةٌ واحدةٌ للتبويبات
 * الخمسة** (القاعدة ٣): **ما يفترق بينها هو المصدرُ وحدَه.**
 */
async function shape(
  rows: SearchResult[],
  locale: Locale,
  limit: number,
  /* 🆕 **والمسبارُ وسيطٌ لا ثابتٌ مخبوء** (D-739): **الوصفةُ واحدةٌ
     للتبويبات الخمسة والمتبدِّلُ سعةُ الغرفة لا شكلُها** — **وفرعٌ
     `if (tab === "anime")` داخل الوصفة هو كيف تفترق الوصفةُ يوماً.**
     ⚠️ **وهو قبل `note` لا بعده** (D-756): **كلُّ مُنادٍ يمرّره
     و`note` وحدَه اختياريّ** — **ووسيطٌ واجبٌ خلف اختياريٍّ لا يُترجَم.** */
  probe: number,
  /* 🆕 **وكم بطاقةً لكلِّ عمل** (D-772) — **واحدةٌ افتراضاً**: **رايلُ
     اكتشف صفُّ تصفّحٍ لا علفُ مشاهدة**، **وعملٌ يأخذ خانتين من تسعٍ
     فيه يضيّق التنويعَ الذي وُجد الصفُّ لأجله** (D-510 روحاً).
     **وصفحةُ الترايلرات وحدَها تعمّق** — الطلبُ كان لها. */
  perTitle: number,
  note?: (r: SearchResult) => string | undefined,
): Promise<TrailerItem[]> {
  const t = getDict(locale);
  const withKeys = await Promise.all(
    rows
      .slice(0, probe)
      .map(async (r): Promise<{ base: Omit<TrailerItem, "clipLabel">; videos: TrailerVideo[] } | null> => {
      const mediaType = r.media_type === "movie" ? ("movie" as const) : ("tv" as const);
      /* 🆕 **ونداءا المقطع والملفّ يجريان معاً** (D-758): مهلةُ آبل
         ٢٫٥ث سقفاً وخبيئتُه أسبوعٌ — **فلا يضيف غيابُه إلى زمن الصفّ
         شيئاً يُذكر، ووجودُه يقلب البطاقةَ إلى مسار الملفّ.**
         ⚠️ **والاسمُ للبحث أصليُّ العملِ الإنجليزيُّ لا المعرَّب**:
         بحثُ آبل بأسمائهم، **والحارسُ اللاتينيُّ في الدالّة نفسِها.** */
      const [trailer, fileUrl] = await Promise.all([
        getTrailerKeys(mediaType, r.id).catch(() => null),
        mediaType === "movie"
          ? getAppleTrailerUrl(r.original_title ?? r.title, yearOf(r))
          : Promise.resolve(null),
      ]);
      if (!trailer?.keys.length) return null;
      const g = r.genre_ids?.length ? browseGenreForId(r.genre_ids[0]) : null;
      const country: string | null =
        originAdjectives({ origin: r.origin_country }, locale === "en" ? "en" : "ar", 1)[0] ?? null;
      return {
        videos: trailer.videos,
        base: {
        tmdbId: r.id,
        mediaType,
        title: titleOf(r),
        videoKey: trailer.keys[0],
        videoKeys: trailer.keys,
        fileUrl,
        /* 🆕 **والغلافُ `w1280` لا `w780`** (D-756): **البطاقةُ تبلغ
           ١٠٣٠px على سطح المكتب** (D-755) **فمصدرٌ بعرض ٧٨٠ يُمطّ**،
           **والصورةُ هي كلُّ ما يُرى قبل أوّل إطارٍ وبعد كلِّ توقّف.**
           ⚠️ **ولا كلفةَ شبكةٍ على القارئ**: **`/_next/image` يقصّها إلى
           مقاس مكانها ويخبّئها** — **والأكبرُ مصدرٌ أنقى لا حمولةٌ أثقل.** */
        backdrop: backdropUrl(r.backdrop_path ?? null, "w1280"),
        posterPath: r.poster_path ?? null,
        year: yearOf(r) ?? "",
        genre: g ? browseGenreName(g, locale) : null,
        country,
        /* **والفارغُ يُكتب غائباً لا سلسلةً فارغة** (D-167/D-222) */
        overview: r.overview?.trim() || null,
        note: note?.(r),
        },
      };
    }),
  );
  const titles = withKeys.filter((x): x is NonNullable<typeof x> => x !== null);
  return interleaveClips(titles, limit, perTitle, locale, t);
}

/**
 * 🆕 **خياراتُ العلف** (D-772) — **الصفحةُ وعمقُ المقاطع**.
 * 🔑 **و`page` نافذةٌ في البِركة نفسِها لا مصدرٌ ثانٍ**: `getSuggestions`
 * تعيد ثلاثمئة، و`buildSection` تقبل سقفاً — **فالدفعةُ التالية قصٌّ
 * أبعدُ من الشيء نفسِه**، **ومصدرٌ ثانٍ للدفعة الثانية كان سيُخرج
 * ترشيحين متناقضين تحت اسمٍ واحد** (D-664/D-731).
 */
export interface TrailerFeedOpts {
  /** دفعةٌ صفريّةُ الأساس — ما بعد الأولى يُطلب عند بلوغ آخر العلف */
  page?: number;
  /** كم بطاقةً لكلِّ عمل (الرايل واحدة، وصفحةُ الترايلرات أعمق) */
  perTitle?: number;
  /** نطاقُ «لك» وحدَه — والتبويباتُ الأربعةُ نطاقُها اسمُها */
  scope?: TrailerScope;
}

/**
 * **علفُ تبويبٍ واحد** (D-734).
 * ⚠️ **والصمتُ عند فشل المصدر** — تبويبٌ فارغٌ خيرٌ من صفحةٍ ساقطة.
 */
export async function getTrailerTabFeed(
  tab: TrailerTab,
  limit: number,
  locale: Locale,
  opts: TrailerFeedOpts = {},
): Promise<TrailerItem[]> {
  const page = Math.max(0, opts.page ?? 0);
  const perTitle = opts.perTitle ?? 1;
  if (tab === "for-you") return getTrailerFeed(limit, locale, opts.scope, undefined, opts);
  if (tab === "trending") {
    const rows = await trending().catch(() => []);
    /* **و«الرائج» بِركةٌ واحدةٌ لا تُعمَّق**: مصدرُه صفحةُ اليوم عند
       TMDB — **والدفعةُ التالية تنزل فيها لا تطلب صفحةً لا وجودَ لها.** */
    return shape(rows.slice(page * probeFor(limit)), locale, limit, probeFor(limit), perTitle);
  }
  const media = tab === "anime" ? "anime" : tab === "movies" ? "movie" : "tv";
  /* 🆕 **والأنمي يُسحب أوسعَ ويُسبر أوسع** (D-739): **توسيعُ المسبار
     بلا توسيع السحب لا يجد ما يسبره** — الرقمُ الواحدُ يخدم الطرفين. */
  const probe = tab === "anime" ? PROBE_ANIME : probeFor(limit);
  /* 🔴 🆕 **ومفتاحُ الأنمي شرطُ المصدر لا حارسٌ بعده** (D-739، بعد قياسٍ
     حيٍّ أثبت أن توسيع المسبار وحدَه لم يرفع الأربعةَ صفّاً واحداً):
     **كنتُ أطلب «الأكثرَ شعبيّةً» عامّاً ثمّ أُسقط ما ليس أنمي** —
     **فالبِركةُ تُصفَّى بعد سحبها، ولا يبقى منها ما يُسبر أصلاً.**
     🔑 **والقاعدةُ مكتوبةٌ في `sections.ts` بحرفها**: «**الأنمي
     `/discover` دائماً: `/popular` لا يقبل مفتاحاً**» — **ومكتوبةٌ ثانيةً
     في `news/page.tsx`** حيث كلُّ سطحِ أنمي يمرّر `ANIME_KEYWORD` في
     `base`. **وأنا ورثتُ `buildSection` ولم أرث ما يُمرَّر إليها.**
     ⚠️ **وهي D-731 حرفاً للمرّة الثالثة** («وراثةُ المصدر تعني وراثةَ
     قواعده») — **والمرّةُ الثالثةُ ليست سهواً بل عادة**: **من نسخ نداءً
     فليقرأ وسائطَ أقرانه قبل أن يقيس نتيجتَه.** */
  const rows = await buildSection(
    "most-popular",
    {
      media,
      base: media === "anime" ? { keywords: [ANIME_KEYWORD] } : {},
      active: false,
      /* ⚖️ 🆕 **و`sample` أُطفئت وقامت مقامَها قرعةُ المفتاح** (D-747،
         نقضٌ لنصف D-740): **قرعةُ `ctx.sample` تُحسب عند كلِّ رسم** —
         **فكانت تبدّل التبويبَ تحت إصبع القارئ عند كلِّ فعلٍ خادميّ.**
         **والقرعةُ باقيةٌ، انتقلت إلى مفتاحٍ يتغيّر بالزمن لا بالرسم.** */
    },
    /* 🆕 **والدفعةُ التالية تُطلب أعمقَ ثمّ يُقصّ رأسُها** (D-772):
       `buildSection` تقبل سقفاً لا صفحةً — **والسقفُ الأعمقُ يُنزل
       صفحاتِ TMDB التالية**، **وردودُ القوائم مخبَّأةٌ ساعةً فثمنُ
       الدفعة الثانية قائمةٌ لا أربعون فيديو.** */
    probe * (page + 1),
  ).catch(() => []);
  return shape(
    shuffleSeeded(rows, drawKey()).slice(page * probe),
    locale,
    limit,
    probe,
    perTitle,
  );
}

export async function getTrailerFeed(
  limit: number,
  locale: Locale,
  scope?: TrailerScope,
  pin?: TrailerPin,
  opts: TrailerFeedOpts = {},
): Promise<TrailerItem[]> {
  const t = getDict(locale);
  const page = Math.max(0, opts.page ?? 0);
  const perTitle = opts.perTitle ?? 1;
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
  /* 🔴 🆕 **قرعةٌ لكلِّ طلب — وإلّا فرأسُ ترتيبٍ ثابتٍ ثابت** (D-740،
     بلاغُ أحمد بلقطة: «المقاطع ما فيه جديدة، مكرّرة»): **كنتُ آخذ
     أوّلَ أربعةَ عشرَ من `getSuggestions` بترتيبها** — **وهي دالّةٌ
     مرتّبةٌ لا عشوائيّة**، **فرأسُها هو رأسُها في كلِّ زيارة**، ويرى
     القارئُ المقاطعَ نفسَها إلى أن تتغيّر مكتبتُه.
     🔑 **والعلاجُ مكتوبٌ في `sections.ts` منذ D-202**: «**قرعةٌ لكلّ
     طلبٍ للصفّ… فلا يتجمّد على نفس الوجوه**» — **وهو نصُّ طلبِه القديم
     حرفاً** («عشوائية مثل بيكد فور يو»). **ورثتُ الترشيحَ ولم أرث
     قرعتَه.**
     ⚠️ **والقرعةُ من نافذةٍ لا من البِركة كلِّها**: **ثلاثةُ أضعافِ
     المسبار** — **قرعةٌ من ثلاثمئةٍ تُلغي معنى «لك»** وتُخرج المرتبةَ
     المئتين، **ونافذةٌ بقدر المسبار لا تُغيّر شيئاً.**
     ⚠️ **ولا نداءَ إضافيّ**: **الخلطُ قبل السبر لا بعده** — **أربعةَ
     عشرَ نداءً كما كانت، مختلفةً في كلِّ زيارة.** */
  const pinned = pin
    ? inScope.find(
        (suggestion) =>
          suggestion.result.id === pin.tmdbId &&
          (suggestion.result.media_type === "movie" ? "movie" : "tv") === pin.mediaType,
      )
    : undefined;
  const probe = probeFor(limit);
  /* 🆕 **والدفعةُ التالية نافذةٌ أبعدُ في البِركة نفسِها** (D-772):
     **ثلاثمئةُ اقتراحٍ مقروءةٌ أصلاً** — **والدفعةُ الثانية قصٌّ منها
     لا نداءٌ جديد**، **والقرعةُ داخل النافذة كما كانت** (D-740).
     ⚠️ **والمثبَّتُ للدفعة الأولى وحدَها**: `?at=` يفتح على مقطعٍ بعينه،
     **وتثبيتُه في كلِّ دفعةٍ كان سيكرّره كلَّما نزل القارئ.** */
  const window = probe * 3;
  const shuffled = shuffleSeeded(
    inScope.slice(page * window, (page + 1) * window),
    drawKey() + page,
  ).filter((suggestion) => suggestion !== pinned);
  const pool = (pinned && page === 0 ? [pinned, ...shuffled] : shuffled).slice(0, probe);
  if (!pool.length) return [];

  /**
   * 🔴 🆕 **ووصفةُ البطاقة واحدةٌ للتبويبات الخمسة** (D-756، القاعدة ٣):
   * **كانت مكتوبةً هنا مرّةً وفي `shape` مرّةً، والفرقُ بينهما حقلُ
   * `note` وحدَه** — **و`shape` تقبل `note` وسيطاً منذ D-734.**
   * 🔑 **ونسختان تفترقان عند أوّل تعديلٍ في خانة**: **رفعُ الغلاف إلى
   * `w1280` كان سيقع في إحداهما ويُنسى في الأخرى** (D-002/D-733).
   * ⚠️ **والسببُ يُحمَل في خريطةٍ لا يُعاد حسابُه**: **`shape` تقرأ صفَّ
   * TMDB ولا تعرف بِذرةَ الترشيح** — **والمفتاحُ بالجهة والمعرّف معاً**
   * فلا يصطدم فيلمٌ بمسلسلٍ يحمل الرقمَ نفسَه.
   */
  const noteOf = new Map(
    pool.map((s) => [
      `${s.result.media_type === "movie" ? "movie" : "tv"}-${s.result.id}`,
      s.seedTitle ? t.recoFrom(s.seedTitle) : t.recoFromGenre,
    ]),
  );

  return shape(
    pool.map((s) => s.result),
    locale,
    limit,
    probe,
    perTitle,
    (r) => noteOf.get(`${r.media_type === "movie" ? "movie" : "tv"}-${r.id}`),
  );
}
