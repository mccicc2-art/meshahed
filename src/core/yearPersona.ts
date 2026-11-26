import type { Locale } from "./i18n";

/**
 * ====== 🆕 «حصاد 2026» — بصمةُ السنة جملةً عن صاحبها (أحمد ٢٦ نوفمبر، استوديو المشاركة «ق٧» و«ص٦») ======
 *
 * **لماذا جملةٌ لا رقم**: البطاقةُ يشاركها العضوُ لأنّها تقول شيئاً عنه («محقّق الجرائم») لا لأنّها جدول — قاعدةُ بطاقات المشاركة:
 * الهويّةُ أوّلاً والأرقامُ تسندها. والجملةُ من **أكبر نوعٍ في دقائق سنته** (`taste.genres` من `buildPeriodStats` — الحسابُ الذي
 * ترسمه صفحةُ الإحصائيات نفسُها، فلا تقول البطاقةُ عن ذوقه غيرَ ما تقوله الصفحة). والأنمي إن غلب على وقته اسمُه أولى من نوعه.
 * مفاتيحُ الأنواع هي `BROWSE_GENRES` (`core/browse.ts`).
 */
const BY_GENRE: Record<string, { ar: string; en: string }> = {
  crime: { ar: "محقّق الجرائم", en: "Crime Detective" },
  drama: { ar: "عاشق الدراما", en: "Drama Devotee" },
  comedy: { ar: "صائد الضحكات", en: "Laugh Hunter" },
  action: { ar: "مدمن الأكشن", en: "Action Junkie" },
  thriller: { ar: "حابس الأنفاس", en: "Edge-of-Seat Watcher" },
  mystery: { ar: "حلّال الألغاز", en: "Puzzle Solver" },
  scifi: { ar: "مسافر العوالم", en: "World Traveler" },
  horror: { ar: "قلبٌ لا يخاف", en: "Fearless Heart" },
  romance: { ar: "قلبٌ رومانسيّ", en: "Romantic at Heart" },
  animation: { ar: "عاشق الرسوم", en: "Animation Lover" },
  documentary: { ar: "باحث الحقائق", en: "Fact Seeker" },
  family: { ar: "سهرات العائلة", en: "Family Night Host" },
  war: { ar: "مؤرّخ المعارك", en: "Battle Historian" },
  reality: { ar: "نجم الواقع", en: "Reality Fan" },
  western: { ar: "فارس الغرب", en: "Western Rider" },
};
const ANIME = { ar: "أوتاكو السنة", en: "Otaku of the Year" };
const ANY = { ar: "رفيق الشاشة", en: "Screen Companion" };
/** الأنمي يسمّي السنةَ حين يأخذ هذا القدرَ من وقتها فأكثر */
const ANIME_SHARE = 40;

export function yearPersona(
  input: { genres: readonly { slug: string; pct: number }[]; animePct: number; thin: boolean },
  locale: Locale,
): string {
  const pick = input.animePct >= ANIME_SHARE ? ANIME : input.thin ? ANY : (BY_GENRE[input.genres[0]?.slug ?? ""] ?? ANY);
  return locale === "en" ? pick.en : pick.ar;
}

/**
 * **المعدود في البطاقة**: الرقمُ كبيرٌ والكلمةُ صغيرةٌ تحته (وحدةٌ لا جملة)، فالتمييزُ بقاعدته — مفردٌ لواحد، ومثنّى **بلا رقم**
 * («مسلسلان» لا «٢ مسلسلان»)، وجمعٌ من ٣ إلى ١٠، ومنوَّنٌ من ١١ إلى ٩٩، ومفردٌ لمئةٍ فما فوق. يعيد الرقمَ (أو لا شيء للواحد والاثنين)
 * والكلمة.
 */
export function countedUnit(
  n: number,
  w: { one: string; two: string; few: string; many: string; hundred: string; en1: string; enN: string },
  locale: Locale,
): { value: string | null; unit: string } {
  if (locale === "en") return { value: String(n), unit: n === 1 ? w.en1 : w.enN };
  if (n === 1) return { value: null, unit: w.one };
  if (n === 2) return { value: null, unit: w.two };
  const r = n % 100;
  if (n >= 3 && n <= 10) return { value: String(n), unit: w.few };
  if (r >= 11 && r <= 99 && n < 100) return { value: String(n), unit: w.many };
  return { value: String(n), unit: w.hundred };
}
