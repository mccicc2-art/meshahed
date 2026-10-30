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
  /* المدقّق ٣٠ أكتوبر — قياسُ مقاسات الودجت (D-1570، «widget sizes») تشخيصٌ يُرسل مرّةً في الجلسة لا سقوط: كان ٧٣ سطراً
     `AppCrash` في أسبوعٍ فغطّى على الأعطال الحقيقيّة في عدّ المراقبين */
  if (screen === "widget" && message.startsWith("widget sizes")) return "AppDiag";
  if (screen === "messages" && message.startsWith("dm category:")) return "AppDiag";
  return "AppCrash";
}
