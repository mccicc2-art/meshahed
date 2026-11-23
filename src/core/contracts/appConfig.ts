/**
 * 🆕 **عقدُ إعداد التطبيق** — `GET /api/v1/app/config` (خطّةُ Loopz+ v2، المرحلة ٠: لافتةُ «حدّث التطبيق»).
 *
 * 🔑 **لماذا يأتي من الخادم**: بناءُ 1.14.0 يغيّر بصمةَ التطبيق الأصليّة، فلا يصل 1.13.x بعده تحديثٌ عبر الهواء — واللافتةُ
 * التي تقول «حدّث من المتجر» يجب أن تكون عنده **قبل** ذلك. فتنزل الآن مطفأةً (`min_version: null`)، وتُشغَّل برقعة ويب يومَ
 * يصير 1.14.0 في المتجرين.
 * ⚖️ **الرقمُ رقمُ الثنائيّ** (`expoConfig.version`): تحديثُ الهواء لا يصل إلّا ثنائيّاً ببصمته، والرقمُ يتبدّل مع كلِّ بناءٍ أصليّ.
 *
 * 🆕 T535 (أحمد ٢٤ نوفمبر: «الزامية من اول مره» · «١ أ» رقمٌ لكلِّ منصّة · «ب» شاشةُ «ما الجديد») — **الشاشةُ إلزاميّةٌ** يقرؤها
 * `min_versions` لكلِّ منصّةٍ وحدَها: جوجلُ قد تنشر قبل مراجعة آبل بأيّام، ولا يُطلب من الآيفون تحديثٌ لم يصل متجرَه.
 * `min_version` يبقى للنسخ التي لم يصلها هذا التحديث (لافتتُها القديمة القابلةُ للإخفاء) — ويبقى `null` ما لم يُقرَّر غيرُه.
 */
export interface AppConfig {
  /** النسخُ القديمة (اللافتةُ ذاتُ «✕») — أقلُّ إصدارٍ يكفي للمنصّتين معاً. `null` = لا لافتة */
  min_version: string | null;
  /** 🆕 T535 — أقلُّ إصدارٍ لكلِّ منصّة؛ ما دونه يرى شاشةَ التحديث الإلزاميّة. `null` = لا شاشة لتلك المنصّة */
  min_versions: { ios: string | null; android: string | null };
  /** 🆕 T535 — «ما الجديد» في الإصدار المطلوب، بلغتَي التطبيق. قائمةٌ فارغة ⇒ الشاشةُ بجملتها وزرّها وحدَهما */
  whats_new: WhatsNewItem[];
  /** أين يُحدَّث — ومنصّةٌ بلا رابطٍ لا ترى اللافتة ولا الشاشة */
  store_url: { ios: string | null; android: string | null };
}

/** سطرٌ في «ما الجديد». `icon` اسمٌ من مجموعة أيقونات التطبيق الواحدة؛ اسمٌ لا تعرفه النسخةُ يُرسم بالنجمة */
export interface WhatsNewItem {
  icon?: string;
  title: { ar: string; en: string };
  sub?: { ar: string; en: string };
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

/**
 * 🆕 T535 — **هل يُجبَر هذا الجهاز على التحديث؟** قرارٌ خالصٌ يُختبر وحدَه: رقمٌ مضبوطٌ لمنصّته، ورابطُ متجرٍ لها، وإصدارُه
 * دون الرقم. أيُّ نقصٍ ⇒ لا شاشة — فالإجبارُ لا يقع إلّا بتأكيدٍ صريحٍ من الخادم.
 */
export function mustUpdate(c: Pick<AppConfig, "min_versions" | "store_url"> | null | undefined, platform: "ios" | "android", version: string): string | null {
  const min = c?.min_versions?.[platform] ?? null;
  const store = c?.store_url?.[platform] ?? null;
  if (!min || !store) return null;
  return versionBelow(version, min) ? store : null;
}
