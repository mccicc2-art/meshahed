import * as Haptics from "expo-haptics";

/**
 * ====== الاهتزاز — D-1043 (Phase 11-F · F5) ======
 *
 * **لماذا**: الضغطُ المطوّل في التطبيق صامت — القائمةُ تظهر ولا تقول اليدُ إنّها فُهمت. اهتزازان لا غير
 * (المواصفة §F5.2): **نقرةُ اختيارٍ** حين تفتح القائمة، و**نجاحٌ** بعد كتابةٍ نجحت منها. **لا شيءَ آخر** —
 * تطبيقٌ يهتزّ لكلِّ لمسةٍ يُطفأ اهتزازُه من الإعدادات فيضيع الاثنان المفيدان.
 * 🔑 **بابٌ واحد**: لا أحدَ ينادي `expo-haptics` مباشرةً؛ والفشلُ صمت (جهازٌ بلا محرّك، أو اهتزازٌ مُطفأ).
 */
export const haptic = {
  pick: () => void Haptics.selectionAsync().catch(() => {}),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};
