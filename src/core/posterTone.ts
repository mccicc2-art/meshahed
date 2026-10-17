/**
 * ====== 🆕 D-1448 — كم يبرز الملصقُ على خلفيّةٍ داكنة ======
 *
 * أحمد ١٧ أكتوبر: «دائماً بوستر الفلم ما يكون من البوسترات الداكنة — الأولويّة للي فيها ألوان بحيث ما يضيع مع الخلفية».
 * دالّةٌ نقيّةٌ على بكسلات نسخةٍ مصغّرة (RGB متتالية) — القراءةُ والتصغيرُ في `lib/vividPoster` (الخادم)، والحسابُ هنا ليُختبر.
 * - **الإضاءة** متوسّطُ اللمعان النسبيّ (أوزانُ sRGB) — ملصقٌ أسودُ يضيع في خلفيّة التطبيق مهما كان جميلاً.
 * - **اللون** متوسّطُ «الكروما» (أعلى قناةٍ ناقص أدناها) — الأحمرُ القاني يبرز وإن كان معتماً، والرماديُّ لا يبرز وإن أضاء قليلاً.
 * - **الدرجة** مزيجُهما؛ وتحت `DARK_SCORE` يُعدّ الملصقُ داكناً فيُبحث له عن أخٍ أوضح.
 */

export type PosterTone = { lum: number; chroma: number; score: number; dark: boolean };

/** حدُّ «الداكن» — مُعايَرٌ على ملصقاتٍ سوداءَ بعنوانٍ أحمر (≈0.13) مقابل ملصقاتٍ ملوّنةٍ عاديّة (≈0.3) */
export const DARK_SCORE = 0.2;
/** البديلُ لا يُختار إلا إن كان أوضحَ بفارقٍ يُرى — لا نبدّل ملصقاً رسميّاً لأجل فرقٍ لا تلحظه العين */
export const MIN_GAIN = 0.08;

export function posterTone(rgb: ArrayLike<number>): PosterTone {
  const n = Math.floor(rgb.length / 3);
  if (n === 0) return { lum: 0, chroma: 0, score: 0, dark: true };
  let lum = 0;
  let chroma = 0;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    chroma += Math.max(r, g, b) - Math.min(r, g, b);
  }
  lum /= n * 255;
  chroma /= n * 255;
  const score = 0.55 * lum + 0.45 * chroma;
  return { lum, chroma, score, dark: score < DARK_SCORE };
}

/**
 * الاختيار: الملصقُ الحاليّ يبقى ما لم يكن داكناً؛ وإن كان، فأوضحُ المرشّحين **غيرِ الداكنين** بفارق `MIN_GAIN` —
 * المرشّحون مرتّبون بالأولويّة (لغةُ القارئ · بلا نصّ · الإنجليزيّة)، والتعادلُ للأسبق.
 * لا بديلَ يصلح ⇒ الحاليّ مع `dark` ليرسم التطبيقُ حوله إطاراً فاتحاً (قرارُ أحمد ٢ أ).
 */
export function pickVivid(
  current: { path: string; tone: PosterTone },
  candidates: { path: string; tone: PosterTone }[],
): { path: string; dark: boolean } {
  if (!current.tone.dark) return { path: current.path, dark: false };
  let best: { path: string; tone: PosterTone } | null = null;
  for (const c of candidates) {
    if (c.path === current.path || c.tone.dark) continue;
    if (c.tone.score < current.tone.score + MIN_GAIN) continue;
    if (!best || c.tone.score > best.tone.score + 0.02) best = c;
  }
  return best ? { path: best.path, dark: false } : { path: current.path, dark: true };
}
