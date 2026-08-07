import type { Dict } from "@/lib/i18n";
import { num, type Locale } from "@/lib/i18n";

/**
 * مستوى المشاهد — **بلا سقف**.
 *
 * النقاط = حلقة واحدة نقطة، والفيلم نقطتان (زمنه ضعف الحلقة تقريباً).
 *
 * كان السلّم ثماني عتباتٍ تنتهي عند ٣٥٠٠، ومن بلغها وقف الشريط عنده ممتلئاً
 * إلى الأبد — أي أن أكثر المستخدمين وفاءً هو أوّل من يفقد المؤشّر. الآن
 * السلّم لا ينتهي: العتبات الثماني الأولى **كما هي بالضبط** فلا يهبط أحدٌ
 * مستوىً كسبه، وما بعدها يُولَّد بضرب العتبة السابقة في ١٫٦ مقرَّباً إلى
 * أقرب مئة.
 *
 * ولماذا ١٫٦ لا ٢: النسب في السلّم الأصلي تهبط من ٣× إلى ٢× إلى ١٫٩×،
 * فمواصلتها بـ١٫٦ استمرارٌ لمنحناه لا قفزةٌ فيه. والمضاعفة تجعل المستوى
 * الثاني عشر يطلب مليوناً — وهذا سقفٌ مقنَّع لا غياب سقف.
 *
 * وكل مستوى أصعب مما قبله بالضرورة: الفارق بين عتبتين يكبر في كل درجة
 * (٣٥٠٠ ← ٥٦٠٠ فارقه ٢١٠٠، ثم ٥٦٠٠ ← ٩٠٠٠ فارقه ٣٤٠٠) — وهو المطلوب.
 */

/** العتبات المكتوبة — أساس السلّم، ولا تُمسّ: تغييرها يُنزل مستخدمين درجة */
export const LEVEL_STEPS = [0, 25, 75, 200, 450, 900, 1800, 3500] as const;

/** معامل النموّ بعد آخر عتبةٍ مكتوبة */
const GROWTH = 1.6;

/**
 * عتبة المستوى رقم `level` (يبدأ من ١).
 *
 * تُحسب بالتكرار لا بصيغةٍ مغلقة: التكرار يبقى دقيقاً مع التقريب إلى المئة،
 * والصيغة المغلقة تنحرف عن العتبات المكتوبة. والتكلفة لا تُذكر — عشرون
 * دورةً لأعلى مستوىً يبلغه إنسان.
 */
export function levelThreshold(level: number): number {
  if (level <= LEVEL_STEPS.length) return LEVEL_STEPS[Math.max(1, level) - 1];
  let value: number = LEVEL_STEPS[LEVEL_STEPS.length - 1];
  for (let i = LEVEL_STEPS.length; i < level; i++) {
    value = Math.round((value * GROWTH) / 100) * 100;
  }
  return value;
}

export interface LevelInfo {
  /** رقم المستوى ابتداءً من ١ */
  level: number;
  /** نسبة التقدّم إلى المستوى التالي (٠–١٠٠) */
  percent: number;
  points: number;
  /** النقاط الباقية للمستوى التالي */
  remaining: number;
  /**
   * لم يعد يصير `true` أبداً — السلّم لا ينتهي.
   * باقٍ في الواجهة كي لا ينكسر مستدعٍ، ويُحذف حين يسقط آخر استعمالٍ له.
   */
  isMax: boolean;
}

export function levelPoints(episodes: number, movies: number): number {
  return episodes + movies * 2;
}

export function getLevel(points: number): LevelInfo {
  const p = Math.max(0, points);

  // نصعد حتى نتجاوز، ثم نرجع درجة. السقف الصلب حارسٌ من حلقةٍ لا تنتهي
  // لو أُدخل رقمٌ فاسد، لا حدٌّ للّعبة
  let level = 1;
  while (level < 200 && p >= levelThreshold(level + 1)) level++;

  const start = levelThreshold(level);
  const next = levelThreshold(level + 1);
  const span = Math.max(1, next - start);

  return {
    level,
    percent: Math.max(0, Math.min(100, Math.round(((p - start) / span) * 100))),
    points: p,
    remaining: Math.max(0, next - p),
    isMax: false,
  };
}

/**
 * اسم المستوى.
 *
 * الأسماء الثمانية المكتوبة لأوّل ثمانية مستويات؛ وما بعدها يُعاد آخر اسم
 * بدرجةٍ رقمية — «خالد ٢»، «خالد ٣». إمّا هذا وإمّا اختراع أسماءٍ بلا نهاية،
 * وترقيم الدرجة العليا عُرفٌ مفهوم في الألعاب ولا يَعِد بما لا يُوفى.
 */
export function levelName(level: number, t: Dict, locale: Locale = "ar"): string {
  const names = t.levelNames;
  if (level <= names.length) return names[Math.max(1, level) - 1];
  const tier = level - names.length + 1;
  return `${names[names.length - 1]} ${num(tier, locale)}`;
}
