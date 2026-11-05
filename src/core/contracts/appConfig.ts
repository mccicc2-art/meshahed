/**
 * 🆕 **عقدُ إعداد التطبيق** — `GET /api/v1/app/config` (خطّةُ Loopz+ v2، المرحلة ٠: لافتةُ «حدّث التطبيق»).
 *
 * 🔑 **لماذا يأتي من الخادم**: بناءُ 1.14.0 يغيّر بصمةَ التطبيق الأصليّة، فلا يصل 1.13.x بعده تحديثٌ عبر الهواء — واللافتةُ
 * التي تقول «حدّث من المتجر» يجب أن تكون عنده **قبل** ذلك. فتنزل الآن مطفأةً (`min_version: null`)، وتُشغَّل برقعة ويب يومَ
 * يصير 1.14.0 في المتجرين.
 * ⚖️ **الرقمُ رقمُ الثنائيّ** (`expoConfig.version`): تحديثُ الهواء لا يصل إلّا ثنائيّاً ببصمته، والرقمُ يتبدّل مع كلِّ بناءٍ أصليّ.
 */
export interface AppConfig {
  /** أقلُّ إصدارٍ يكفي — ما دونه يرى اللافتة. `null` = لا لافتة */
  min_version: string | null;
  /** أين يُحدَّث — ومنصّةٌ بلا رابطٍ لا ترى اللافتة */
  store_url: { ios: string | null; android: string | null };
}

/** `a < b` لأرقامٍ مثل `1.13.2` — الأجزاءُ الناقصةُ أصفار، وما ليس رقماً صفر */
export function versionBelow(a: string, b: string): boolean {
  const pa = a.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0;
  }
  return false;
}
