/**
 * Phase 11 · A0-prep — **صفرُ ساعة الأداء**.
 *
 * 🔑 **يُستورد أوّلاً في `index.ts` قبل `expo-router/entry`**، فيكون أوّلَ كودٍ لنا
 * يُقيَّم في الحزمة: قبل الموجِّه وقبل `_layout.tsx` وكلِّ استيراداته
 * (تصحيحُ المراجع `5576037708` §٣ — الصفرُ السابقُ كان بعد تقييم استيرادات
 * التخطيط و`preventAutoHideAsync` و`applyDirection`). ما يسبقه: تهيئةُ RN الأصليّة
 * وتحميلُ الحزمة نفسِها — **ولذلك يبقى الرقمُ مسمّىً بدقّة `js-entry → …`**، ولا
 * يُستعمل وحدَه للحكم على cold usable end-to-end؛ **`am start -W` يغطّي ما قبله.**
 * الساعةُ رتيبة (`performance.now()`) لا `Date.now()`.
 */
export const launchT0 = performance.now();
export const perfMs = () => Math.round(performance.now() - launchT0);
