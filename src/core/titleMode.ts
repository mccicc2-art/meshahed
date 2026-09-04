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

/** **مفتاحُ الكوكي** — نفسُ عائلةِ بقيّةِ التفضيلات (`loopz_*`) */
export const TITLE_MODE_COOKIE = "loopz_title_mode";

/**
 * **أربعُ طرقٍ لا أكثر:**
 * - `localized` — **حسب لغة التطبيق، وهو الافتراض** (D-152: افتراضُ أيِّ
 *   تفضيلٍ جديد هو السلوكُ القائم — **فمن لم يفتح الإعدادات لا يتغيّر
 *   عنده حرف**).
 * - `original` — الاسمُ الأصليّ كما سمّاه أهلُه.
 * - `translit` — **الكتابةُ الصوتيّة بالعربية** («جيم أوف ثرونز»).
 * - `both` — المحلّيُّ وتحته الأصليُّ بحجمٍ أصغر.
 */
export type TitleMode = "localized" | "original" | "translit" | "both";

export const TITLE_MODES: readonly TitleMode[] = ["localized", "original", "translit", "both"];

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
  return TITLE_MODES.find((x) => x === v) ?? "localized";
}

/** الأسماءُ الثلاثةُ لعملٍ واحد — **وكلُّها قد تغيب** */
export interface TitleNames {
  /** `movie.title` أو `tv.name` بلغة الواجهة */
  localized?: string | null;
  /** `original_title` أو `original_name` */
  original?: string | null;
  /** الكتابةُ الصوتيّةُ العربية — من Supabase وحدَها، لا من ترجمة TMDB */
  translit?: string | null;
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

/**
 * **مفتاحُ مقارنةٍ يُبنى ويُرمى** — **ولا يُعرض أبداً** (قاعدةُ
 * `arabic.ts` نفسُها): «Dune» و«dune » و«Dune  » اسمٌ واحد، **فلا
 * يتكرّر السطرُ لفارقِ حالةٍ أو مسافة.**
 */
function same(a: string, b: string): boolean {
  const k = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return k(a) === k(b);
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
 * translit  : الأصليُّ عربيٌّ؟ اعرضه كما هو · وإلّا الصوتيّةُ → الأصليّ
 * both      : المحلّيُّ + الأصليُّ، ولا يُعاد الثاني إن طابق الأوّل
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

    case "both": {
      const primary = first(localized, original, fallback) ?? any;
      const second = first(original);
      return { primary, secondary: second && !same(second, primary) ? second : null };
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
  return mode !== "localized";
}

/** **وهل تحتاج جدولَ البدائل؟** — الصوتيّةُ وحدَها تُقرأ من Supabase */
export function needsTranslit(mode: TitleMode): boolean {
  return mode === "translit";
}
