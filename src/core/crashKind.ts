/**
 * A-10 (المدقّق ٢١ أكتوبر) — **نوعُ السطر في `runtime_errors` لبلاغات `/api/v1/app/crash`.**
 *
 * الطريقُ نفسُه يحمل سقوطَ الشاشات وتشخيصاتٍ ليست سقوطاً: سجلُّ لمسات الودجت (الشاشة `widget`) وتتبّعُ زرَّي
 * إشعار الرسائل (`messages` برسالةٍ تبدأ «dm category:»). كانت كلُّها `AppCrash` فتضخّم عدَّ الأعطال في تقارير
 * المراقبين؛ التشخيصُ يُكتب `AppDiag` والسقوطُ الحقيقيُّ يبقى `AppCrash` كما كان.
 */
export function crashKind(screen: string, message: string): "AppCrash" | "AppDiag" {
  /* A-22 (المدقّق ٢٤ أكتوبر) — بالبادئة لا بالشاشة وحدَها: سقوطٌ حقيقيٌّ لشاشة الودجت يبقى `AppCrash` فيُعدّ */
  if (screen === "widget" && message.startsWith("widget taps:")) return "AppDiag";
  if (screen === "messages" && message.startsWith("dm category:")) return "AppDiag";
  return "AppCrash";
}
