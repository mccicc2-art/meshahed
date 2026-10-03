/**
 * ====== اسمُ الحلقة العامّ — بالحروف لا بالرقم (D-1255) ======
 *
 * **اقتراحُ أحمد (٣ أكتوبر ٢٠٢٦، بلقطةِ «1. الحلقة 1»): «ليش مو بدالها يكون الرقم كتابة .. مثل الحلقة
 * الأولى؟»** — TMDB يسمّي كلَّ حلقةٍ لم يُدخَل اسمُها «Episode N»/«الحلقة N»، والصفُّ يكتب رقمَ الحلقة
 * قبل اسمها، فيتكرّر الرقمُ مرّتين. بالحروف يُقرأ «1. الحلقة الأولى».
 *
 * 🔑 **الاسمُ العامُّ يُعاد كتابتُه بلغة القارئ** لا بلغة النسخة التي وصل بها — فحين تُجلب القائمةُ
 * من اللغة البديلة (D-1254) لا تظهر «الحلقة 1» في واجهةٍ إنجليزيّة. **والاسمُ الحقيقيُّ لا يُمسّ.**
 * 🔑 **حتى ٢٠ بالحروف** (حدُّ أحمد): فوقها يطول الاسمُ حتى لا يُقرأ في سطر («السادسة والخمسون بعد
 * المئة والألف») — فيبقى رقماً.
 *
 * نقيّةٌ بلا استيراد: يقرؤها الخادمُ اليوم، وتصلح للطرفين.
 */

/** حدُّ الكتابة بالحروف */
export const EPISODE_WORDS_MAX = 20;

const AR = [
  "الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة",
  "الحادية عشرة", "الثانية عشرة", "الثالثة عشرة", "الرابعة عشرة", "الخامسة عشرة", "السادسة عشرة",
  "السابعة عشرة", "الثامنة عشرة", "التاسعة عشرة", "العشرون",
];
const EN = [
  "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
];

/** «الحلقة الأولى» / «Episode One» حتى ٢٠، ثمّ «الحلقة 21» / «Episode 21» */
export function episodeWordName(n: number, locale: "ar" | "en"): string {
  const words = locale === "en" ? EN : AR;
  const word = Number.isInteger(n) && n >= 1 && n <= EPISODE_WORDS_MAX ? words[n - 1] : String(n);
  return locale === "en" ? `Episode ${word}` : `الحلقة ${word}`;
}

/** ما يُعرف عن سجلّ الحلقة غيرَ اسمها — به يُفرَّق الاسمُ العامُّ عن عنوانٍ حقيقيٍّ بالنصّ نفسِه */
export type EpisodeRecord = { overview?: string | null; still_path?: string | null };

/**
 * هل الاسمُ عامّ؟ — فارغ، أو كلمةُ «حلقة» ثمّ **رقمُ هذه الحلقة نفسُه** («Episode 3» اسماً للحلقة الخامسة
 * عنوانٌ مقصود).
 *
 * 🔴 **«إذا الاسم الفعلي Episode 3 خلّيه نفسه»** (أحمد، أثناء التنفيذ): مسلسلاتٌ تسمّي حلقاتِها هكذا
 * فعلاً، والنصُّ واحدٌ في الحالتين — فلا يُفرَّق بالاسم. **الفارقُ سجلُّ الحلقة**: الاسمُ المؤقّتُ يأتي مع
 * سجلٍّ لم يُملأ (بلا وصفٍ ولا صورة)، والعنوانُ الحقيقيُّ مع سجلٍّ مملوء. فـ«Episode N» الإنجليزيّة تُعدّ
 * عامّةً **حين يخلو السجلُّ وحدَه**. ⚠️ الحدُّ يُقال: عنوانٌ حقيقيٌّ بسجلٍّ فارغٍ تماماً يُكتب بالحروف،
 * واسمٌ مؤقّتٌ رُفعت صورتُه قبل اسمه يبقى رقماً — وكلاهما المعنى نفسُه.
 * **والعربيّةُ «الحلقة N» عامّةٌ دائماً**: هي ما يضعه TMDB حين تغيب الترجمة، لا عنوانٌ يكتبه أحد.
 */
export function isGenericEpisodeName(name: string | null | undefined, episodeNumber: number, record: EpisodeRecord = {}): boolean {
  const s = (name ?? "").trim();
  if (!s) return true;
  const ar = /^(?:ال)?حلقة\s*#?\s*(\d+)$/u.exec(s);
  if (ar) return Number(ar[1]) === episodeNumber;
  const en = /^episode\s*#?\s*(\d+)$/iu.exec(s);
  if (!en || Number(en[1]) !== episodeNumber) return false;
  return !(record.overview ?? "").trim() && !record.still_path;
}

/** الاسمُ كما يُعرض: العامُّ يُكتب بلغة القارئ، والحقيقيُّ كما هو */
export function episodeDisplayName(name: string | null | undefined, episodeNumber: number, locale: "ar" | "en", record: EpisodeRecord = {}): string {
  return isGenericEpisodeName(name, episodeNumber, record) ? episodeWordName(episodeNumber, locale) : (name ?? "").trim();
}
