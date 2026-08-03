import type { Dict } from "@/lib/i18n";

/**
 * مستوى المشاهد.
 *
 * النقاط = حلقة واحدة نقطة، والفيلم نقطتان (زمنه ضعف الحلقة تقريباً).
 * والعتبات تتباعد كلما ارتفعت: المستوى الأول يُبلغ في أمسية، والأخير لا
 * يُبلغ إلا بسنوات — وإلا صار الشريط ممتلئاً دائماً فلا يعني شيئاً.
 */
export const LEVEL_STEPS = [0, 25, 75, 200, 450, 900, 1800, 3500] as const;

export interface LevelInfo {
  /** رقم المستوى ابتداءً من ١ */
  level: number;
  /** نسبة التقدّم إلى المستوى التالي (٠–١٠٠)، و١٠٠ عند المستوى الأخير */
  percent: number;
  points: number;
  /** النقاط الباقية للمستوى التالي، و٠ عند الأخير */
  remaining: number;
  isMax: boolean;
}

export function levelPoints(episodes: number, movies: number): number {
  return episodes + movies * 2;
}

export function getLevel(points: number): LevelInfo {
  let index = 0;
  for (let i = 0; i < LEVEL_STEPS.length; i++) {
    if (points >= LEVEL_STEPS[i]) index = i;
  }
  const isMax = index === LEVEL_STEPS.length - 1;
  const start = LEVEL_STEPS[index];
  const next = isMax ? start : LEVEL_STEPS[index + 1];
  const span = next - start;
  return {
    level: index + 1,
    percent: isMax ? 100 : Math.max(0, Math.min(100, Math.round(((points - start) / span) * 100))),
    points,
    remaining: isMax ? 0 : next - points,
    isMax,
  };
}

/** اسم المستوى من القاموس — الأسماء نصوص مترجمة لا أرقام */
export function levelName(level: number, t: Dict): string {
  return t.levelNames[Math.min(level, t.levelNames.length) - 1];
}
