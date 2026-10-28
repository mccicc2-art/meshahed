/**
 * 🆕 D-1557 — بديلُ `InteractionManager.runAfterInteractions` الذي أزالته React Native 0.88 (Expo SDK 58).
 * التوصيةُ الرسميّة `requestIdleCallback`: ينتظر فراغَ خيط JS بدل انتظار انتهاء الحركات — والنتيجةُ نفسُها
 * لاستعمالاتنا (تسخينٌ وحفظٌ مؤجَّل لا يجب أن يزاحم الإطارات). نُبقي شكلَ `{ cancel }` القديم فلا تتغيّر النداءات.
 * `timeout` حدٌّ أعلى: إن بقي الخيطُ مشغولاً لا يتأجّل العملُ إلى الأبد (كان الوعدُ القديم يُنفَّذ في النهاية دائماً).
 */
export function afterInteractions(fn: () => void, timeout = 2000): { cancel: () => void } {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(() => fn(), { timeout });
    return { cancel: () => cancelIdleCallback(id) };
  }
  const t = setTimeout(fn, 0);
  return { cancel: () => clearTimeout(t) };
}
