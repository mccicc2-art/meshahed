/**
 * 🆕 T540 — **حدُّ البحث بالوصف اليوميّ للمجانيّ** (أحمد ٢٤ نوفمبر: «البحث بالوصف خله مجاني» ثمّ «حد ٥ عمليات بحث يومي
 * للمجاني»، ثمّ «لازم يظهر له ان عنده حد وانه تجاوزه» واعتمد الصورة بـ«نفذ»).
 *
 * كان لبلس بثلاث تجاربٍ مدى الحياة (هجرة ٢٤٣). الآن: خمسٌ في اليوم للمجانيّ، والمشتركُ بلا حدّ. **والعدُّ كما كان**: لا يُحسب
 * البحثُ إلّا إذا رجع بنتائج، فوصفٌ قصيرٌ أو «لم أجد» لا يأكل من اليوم.
 *
 * 🔑 **ولا هجرة**: جدولُ `ai_story_trials` يحفظ العدَّ ووقتَ آخر بحث (`updated_at`) — فعدٌّ آخرُه قبل اليوم يُقرأ صفراً، والبحثُ
 * الأوّلُ في يومٍ جديد يكتب ١ بدل أن يزيد. **واليومُ يومُ الرياض** (لا منطقةُ العضو): هذا ما قيل له في الصورة («بعد منتصف
 * الليل»)، والرياضُ بلا توقيتٍ صيفيّ فالفارقُ ثابت (+٣) ولا يحتاج مكتبةَ مناطق — والعميلُ يحسب الساعاتِ الباقيةَ بالرقم نفسِه.
 */
export const STORY_DAILY_FREE = 5;

const DAY_MS = 86_400_000;
const RIYADH_OFFSET_MS = 3 * 3_600_000;

/** مفتاحُ اليوم بتوقيت الرياض (`YYYY-MM-DD`) */
export function storyDay(ms: number): string {
  return new Date(ms + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

/** ما استُهلك اليوم: العدُّ المحفوظ إن كان آخرُ بحثٍ في يوم `now`، وإلّا صفر */
export function storyUsedToday(used: number, updatedAt: string | null | undefined, now: number): number {
  if (!updatedAt || !Number.isFinite(used) || used <= 0) return 0;
  const at = Date.parse(updatedAt);
  if (Number.isNaN(at)) return 0;
  return storyDay(at) === storyDay(now) ? used : 0;
}

/** الباقي اليوم من الحدّ — لا ينزل تحت الصفر */
export function storyLeft(usedToday: number): number {
  return Math.max(0, STORY_DAILY_FREE - usedToday);
}

/** كم ساعةً حتى يتجدّد الحدّ (منتصفُ ليل الرياض) — مقرّبةً لأعلى، وساعةٌ على الأقلّ: «بعد ٠ ساعات» لا تُقال */
export function storyResetHours(now: number): number {
  const ms = DAY_MS - ((now + RIYADH_OFFSET_MS) % DAY_MS);
  return Math.max(1, Math.ceil(ms / 3_600_000));
}
