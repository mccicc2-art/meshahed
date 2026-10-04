/**
 * **طريقةُ عرض أسماء الأعمال — قرارٌ واحدٌ يُتّخذ مرّةً ويُقرأ في كلِّ سطح**
 * (D-544، مواصفةُ أحمد المكتوبة: «نفّذ ميزة اختيار طريقة عرض أسماء الأفلام
 * والمسلسلات… اجعل التنفيذ مركزيًا دون شروط متفرّقة أو طلبات إضافية لكلّ
 * كارد»).
 *
 * ================= لماذا هنا ولماذا نقيّاً =================
 *
 * **هذا الملفّ لا يعرف Supabase ولا TMDB ولا `next/headers`** — **دالّةٌ
 * خالصةٌ تأخذ ثلاثةَ أسماءٍ وتعيد سطرين.** **وهو شرطُ أن يقرأها الخادمُ
 * والعميلُ معاً** (D-193: المسارُ الذي يستورد عميلَ الخادم لا يُستورد من
 * مكوّنِ عميل)، **وشرطُ أن تُختبر بلا قاعدةِ بيانات.**
 *
 * **والجلبُ في مكانٍ آخر**: الأسماءُ تصل مُجمَّعةً من `localize.ts`
 * (TMDB) و`titleAliases.ts` (Supabase) — **لا استعلامَ لكلِّ بطاقة**
 * (D-205).
 */

/**
 * **مفتاحُ الكوكي** — نفسُ عائلةِ بقيّةِ التفضيلات (`loopz_*`).
 *
 * 🔴 🆕 D-1266 — **اسمٌ جديدٌ عمداً** (كان `loopz_title_mode`): أحمد قرّر أنّ وضعَ «Loopz» هو الأصلُ
 * **عند الجميع، ومن اختار بيده قبلها يُنقل إليه أيضاً** («الجميع ينقل له»، ٤ أكتوبر ٢٠٢٦). الاختيارُ
 * يعيش في الكوكي وحدَه — لا عمودَ له في القاعدة — فنقلُ الجميع = ألّا يُقرأ الكوكي القديم. من يختار
 * بعد اليوم يُكتب اختيارُه بالاسم الجديد ويبقى.
 */
export const TITLE_MODE_COOKIE = "loopz_names";

/**
 * **أربعُ طرقٍ لا أكثر:**
 * - `loopz` — 🆕 D-1266، **وهو الافتراض**: كلُّ عملٍ باسمه الإنجليزيّ، والعملُ العربيُّ باسمه العربيّ،
 *   سطراً واحداً. (قرارُ أحمد بعد أن عرض «رائجُ اليوم» أسماءً يابانيّةً لا تُقرأ في وضع «الأصليّ».)
 *   ⚖️ **نقضٌ مسجَّلٌ لقاعدة D-152** («افتراضُ أيِّ تفضيلٍ جديد هو السلوكُ القائم»): الافتراضُ كان
 *   `localized` وصار هذا بأمر صاحب المنتج. وحلَّ محلَّ `both` (المحلّيُّ وتحته الأصليّ) فزال السطران.
 * - `localized` — حسب لغة التطبيق.
 * - `original` — الاسمُ الأصليّ كما سمّاه أهلُه.
 * - `translit` — **الكتابةُ الصوتيّة بالعربية** («جيم أوف ثرونز»).
 *
 * **والترتيبُ ترتيبُ العرض في الإعدادات** — «Loopz» الأوّل (أمرُ أحمد).
 */
export type TitleMode = "loopz" | "localized" | "original" | "translit";

export const TITLE_MODES: readonly TitleMode[] = ["loopz", "localized", "original", "translit"];

export const DEFAULT_TITLE_MODE: TitleMode = "loopz";

/**
 * **قارئٌ متسامح** — كوكيٌّ مجهولٌ أو محرَّرٌ بيدٍ يسقط إلى الافتراض.
 *
 * ⚖️ 🆕 **ولم يعد للّغة رأيٌ هنا** (D-593، حكمُ أحمد: «هنا قلنا فيه
 * خيار رابع الكتابة الصوتية») — **نقضٌ مسجَّلٌ لسطرِ مواصفة D-544**
 * («الصوتيّةُ للواجهة العربية فقط»): كان `titleModeAllowed` يُسقط
 * `translit` في الواجهة الإنجليزيّة **من القائمة والكوكي معاً** —
 * **وصاحبُ الواجهة الإنجليزيّة قد يقرأ العربيّةَ ويريد أسماءَه بها.**
 * **والدالّةُ حُذفت لا عُطِّلت**: حارسٌ يعيد `true` دائماً كذبةٌ باقية.
 */
export function parseTitleMode(v: string | undefined): TitleMode {
  return TITLE_MODES.find((x) => x === v) ?? DEFAULT_TITLE_MODE;
}

/**
 * 🆕 D-1269 — **اختيارُ الحساب** (`profiles.title_mode`): `null` حين لم يختر صاحبُه بعد أو حملت الخانةُ
 * قيمةً سقطت من القائمة. **والفرقُ عن `parseTitleMode` مقصود**: تلك تُسقط المجهولَ إلى الافتراض،
 * وهنا الافتراضُ يمحو اختيارَ الجهاز — فالفارغُ يبقى فارغاً والجهازُ على ما هو عليه.
 */
export function accountTitleMode(v: unknown): TitleMode | null {
  return TITLE_MODES.find((x) => x === v) ?? null;
}

/** الأسماءُ الثلاثةُ لعملٍ واحد — **وكلُّها قد تغيب** */
export interface TitleNames {
  /** `movie.title` أو `tv.name` بلغة الواجهة */
  localized?: string | null;
  /** `original_title` أو `original_name` */
  original?: string | null;
  /** الكتابةُ الصوتيّةُ العربية — من Supabase وحدَها، لا من ترجمة TMDB */
  translit?: string | null;
  /** 🆕 D-1266 — الاسمُ الإنجليزيّ (ردُّ TMDB بـ`en-US`). **يُعطى في المعاينة وحدَها**: صفوفُ TMDB
      الحيّة تصل وقد صحّحها `applyLoopzNames` عند المصدر، فـ`localized` فيها هو الجواب */
  english?: string | null;
  /** 🆕 D-1266 — `original_language` من TMDB (`ar` · `en` · `ja` …) */
  originalLanguage?: string | null;
}

/** ما يُرسم: سطرٌ رئيسٌ، وسطرٌ ثانٍ اختياريٌّ تحته بحجمٍ أصغر */
export interface ResolvedTitle {
  primary: string;
  secondary: string | null;
}

const ARABIC = /[؀-ۿݐ-ݿ]/;

/** **حرفٌ عربيٌّ واحدٌ يكفي** — العناوينُ المختلطة («ولاد رزق 3») عربيّة */
export function isArabicTitle(s: string | null | undefined): boolean {
  return !!s && ARABIC.test(s);
}

/** أوّلُ اسمٍ غيرِ فارغٍ في الترتيب المعطى — **والفراغُ ليس اسماً** */
function first(...xs: (string | null | undefined)[]): string | null {
  for (const x of xs) if (x && x.trim()) return x.trim();
  return null;
}

/**
 * **الدالّةُ المركزيّة** — **كلُّ عنوانِ عملٍ يُعرض في التطبيق يمرّ بها**.
 *
 * **وقواعدُ السقوط بنصِّ المواصفة:**
 * ```
 * localized : localizedTitle → originalTitle
 * original  : originalTitle  → localizedTitle
 * loopz     : لغتُه عربيّة؟ الأصليّ · وإلّا الإنجليزيّ → الأصليّ (D-1266)
 * translit  : الأصليُّ عربيٌّ؟ اعرضه كما هو · وإلّا الصوتيّةُ → الأصليّ
 * ```
 *
 * ⚠️ **وما من حالةٍ تعيد فراغاً**: آخرُ ملاذٍ هو `fallback` (الاسمُ
 * المخزَّن في الصفّ) — **وبطاقةٌ بلا اسمٍ عطلٌ أثقلُ من اسمٍ بالطريقة
 * الخطأ** (D-063).
 */
export function resolveMediaTitle(
  names: TitleNames,
  mode: TitleMode,
  fallback = "",
): ResolvedTitle {
  const localized = first(names.localized);
  const original = first(names.original);
  const translit = first(names.translit);
  const any = first(localized, original, fallback) ?? fallback;

  switch (mode) {
    case "loopz": {
      /* 🆕 D-1266 — العربيُّ بأصله، وما سواه بالإنجليزيّة؛ وعملٌ لا اسمَ إنجليزيّاً له يبقى بأصله.
         **صفٌّ حيٌّ يصل بلا `english` ولا لغة**: `tmdb()` صحّح اسمَه عند المصدر (`applyLoopzNames`)،
         فـ`localized` هو اسمُ Loopz نفسُه ولا يُعاد الحكمُ هنا. المعاينةُ وحدَها تعطي الاثنين. */
      const lang = names.originalLanguage ?? null;
      const english = first(names.english);
      if (lang === null && english === null) return { primary: first(localized, original, fallback) ?? any, secondary: null };
      const arabic = lang === "ar" || (lang === null && isArabicTitle(original));
      if (arabic && original) return { primary: original, secondary: null };
      return { primary: first(lang === "en" ? original : null, english, original, localized, fallback) ?? any, secondary: null };
    }

    case "original":
      return { primary: first(original, localized, fallback) ?? any, secondary: null };

    case "translit": {
      /* **الأصليُّ عربيٌّ فلا صوتيّةَ له أصلاً** — «عوالم خفية» تُكتب
         كما هي، **وكتابتُها صوتيّاً بالعربية عبثٌ.** */
      if (isArabicTitle(original)) return { primary: original!, secondary: null };
      /* **ولا ترجمةَ آليّةً بديلاً** (بنصِّ المواصفة): **غيابُ الصوتيّة
         يعني الاسمَ الأصليّ**، لا اسماً مترجَماً يُقدَّم على أنه صوتيّ. */
      return { primary: first(translit, original, localized, fallback) ?? any, secondary: null };
    }

    case "localized":
    default:
      return { primary: first(localized, original, fallback) ?? any, secondary: null };
  }
}

/**
 * **هل تحتاج هذه الطريقةُ الاسمَ الأصليَّ أصلاً؟** — **يقرؤه جالبُ TMDB
 * ليقرّر هل يدفع ثمنَ نداءٍ أم لا** (D-510: لا يدفع أحدٌ كلفةَ ما لن
 * يراه). **والافتراضُ لا يحتاجه، فلا يدفع أحدٌ شيئاً حتى يختار.**
 */
export function needsOriginal(mode: TitleMode): boolean {
  /* 🆕 D-1266 — `loopz` لا يحتاجه هنا: اسمُه يُصحَّح عند مصدر TMDB (`applyLoopzNames`) */
  return mode === "original" || mode === "translit";
}

/** **وهل تحتاج جدولَ البدائل؟** — الصوتيّةُ وحدَها تُقرأ من Supabase */
export function needsTranslit(mode: TitleMode): boolean {
  return mode === "translit";
}

/**
 * 🆕 D-1266 — **أمثلةُ المعاينة في مكانٍ واحد** (كانت جدولاً منسوخاً في الويب والتطبيق — D-145:
 * جدولُ أمثلةٍ يُكتب مرّتين يفترق مرّةً). الثلاثةُ أمثلةُ أحمد بعينها: عملٌ إنجليزيّ، وعربيّ، ويابانيّ —
 * **والثالثُ هو ما يُري الفرقَ** بين «Loopz» و«الأصليّ».
 */
export const TITLE_SAMPLES: readonly { ar: string; en: string; original: string; translit: string; lang: string }[] = [
  { ar: "صراع العروش", en: "Game of Thrones", original: "Game of Thrones", translit: "جيم أوف ثرونز", lang: "en" },
  { ar: "عوالم خفية", en: "Hidden Secret", original: "عوالم خفية", translit: "عوالم خفية", lang: "ar" },
  { ar: "هجوم العمالقة", en: "Attack on Titan", original: "進撃の巨人", translit: "أتاك أون تايتان", lang: "ja" },
];

/** مثالٌ كما يراه محرّكُ الأسماء في لغة الواجهة المعطاة — المعاينةُ تمرّ بـ`resolveMediaTitle` نفسِها */
export function sampleNames(s: (typeof TITLE_SAMPLES)[number], locale: "ar" | "en"): TitleNames {
  return { localized: locale === "en" ? s.en : s.ar, original: s.original, translit: s.translit, english: s.en, originalLanguage: s.lang };
}
