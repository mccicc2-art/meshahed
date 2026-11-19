import { useFonts } from "expo-font";

/**
 * ====== الخطوط — Poppins للاتينيّ وTajawal للعربيّ (D-454) ======
 *
 * 🔑 **الملفّاتُ هي ملفّاتُ الويب نفسُها**: `@fontsource/tajawal` (المقطعُ
 * العربيّ) و`@fontsource/poppins` (اللاتينيّ) بالأوزان التي يستوردها
 * `globals.css` حرفاً — حُوِّلت من WOFF إلى TTF بلا لمسِ الحروف (fontTools،
 * `flavor=None`)، **فالحرفُ الذي تراه الصفحةُ هو الحرفُ الذي تراه الشاشة**
 * (B0 §٤: الخطوط مطابقة، مضمَّنةٌ في الحزمة).
 *
 * ⚠️ **أندرويد لا يفهم `fontWeight` مع خطٍّ مخصَّص**: كلُّ وزنٍ عائلةٌ باسمها
 * — لذلك `familyOf(script, weight)` لا `fontWeight`. **والويبُ يكتب Poppins
 * أوّلاً في العائلة فيحلّ اللاتينيَّ منه والعربيَّ من Tajawal**؛ وهنا لا
 * سلسلةَ سقوطٍ في RN، **فالنصُّ يُقسَّم إلى مقاطعَ بحسب الحرف** (`ui.tsx`).
 */
export const FONTS = {
  "Tajawal-400": require("../assets/fonts/Tajawal-400.ttf"),
  "Tajawal-500": require("../assets/fonts/Tajawal-500.ttf"),
  "Tajawal-700": require("../assets/fonts/Tajawal-700.ttf"),
  "Tajawal-800": require("../assets/fonts/Tajawal-800.ttf"),
  "Poppins-400": require("../assets/fonts/Poppins-400.ttf"),
  "Poppins-500": require("../assets/fonts/Poppins-500.ttf"),
  "Poppins-600": require("../assets/fonts/Poppins-600.ttf"),
  "Poppins-700": require("../assets/fonts/Poppins-700.ttf"),
  /* 🆕 T338 — لكلمة GOLD وحدَها (أحمد ٦ نوفمبر: «كلمة قولد ثقيلة نفس درجة شعار لوبز»، «١أ» = ٨٠٠)، من `@fontsource/poppins`
     كأخواتها. **لا يدخل `familyOf`**: ٤٦ نصّاً بوزن ٨٠٠ تسقط إلى ٧٠٠ منذ D-454 وتغييرُها كلِّها لم يُطلب */
  "Poppins-800": require("../assets/fonts/Poppins-800.ttf"),
} as const;

export type Weight = "400" | "500" | "600" | "700" | "800";

/** المقطعُ العربيّ (بما فيه العلاماتُ والأرقامُ الهنديّة) — حرفٌ واحدٌ يكفي ليُعدّ المقطعُ عربيّاً */
export const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/**
 * اسمُ العائلة لوزنٍ وحرف. Poppins بلا ٨٠٠ ⇢ ٧٠٠. والعربيُّ أثقلُ درجةً من الوزن المطلوب (T482 — `AR_WEIGHT`):
 * ٤٠٠ ⇢ ٥٠٠ · ٥٠٠ ⇢ ٧٠٠ · ٦٠٠ و٧٠٠ و٨٠٠ ⇢ ٨٠٠. ⚠️ الويبُ ما زال على قاعدة `globals.css` («٦٠٠ العربيّ يسقط إلى ٧٠٠»)
 * — التثقيلُ للتطبيق وحده بقرار أحمد.
 */
const AR_WEIGHT: Record<Weight, "500" | "700" | "800"> = { "400": "500", "500": "700", "600": "800", "700": "800", "800": "800" };

export function familyOf(arabic: boolean, weight: Weight): keyof typeof FONTS {
  if (arabic) {
    /* 🆕 T482 — **العربيُّ أثقلُ درجةً في كلِّ الأوزان** (أحمد ٢٠ نوفمبر، بعد صورتين على لقطة خالد: «ثقله مثل ما وريتني»).
       Tajawal أنحفُ من Poppins في الوزن نفسِه — سماكةُ جذع الألف من ملفّه: ٤٠٠ ⇐ ٦٧ مقابلَ ٩١ للّاتينيّ، ٥٠٠ ⇐ ٨٦ مقابلَ ١١٤ —
       وجسمُ حروفه أصغر، فكان العربيُّ يبدو باهتاً بجوار الإنجليزيّ في السطر نفسِه. درجةٌ أثقل تقارب سماكتَه:
       ٤٠٠ ⇐ ٥٠٠ (٨٦ ≈ ٩١) · ٥٠٠ ⇐ ٧٠٠ (١٢٦ ≈ ١١٤) · ٦٠٠ و٧٠٠ و٨٠٠ ⇐ ٨٠٠ (١٤٥ — أثقلُ ما نحمله).
       الخطُّ نفسُه باقٍ (قرار ٢١ أكتوبر). والويبُ لم يُمسّ */
    const w = AR_WEIGHT[weight];
    return `Tajawal-${w}` as keyof typeof FONTS;
  }
  /* ⚠️ ٨٠٠ يبقى ساقطاً إلى ٧٠٠ رغم وجود `Poppins-800` (T338): ذاك الملفُّ لشارة GOLD وحدَها */
  const w = weight === "800" ? "700" : weight;
  return `Poppins-${w}` as keyof typeof FONTS;
}

/** يُحمَّل مرّةً في الجذر؛ قبل الاكتمال تُرسم الشاشاتُ بخطّ النظام لا فراغاً */
export function useAppFonts(): boolean {
  const [loaded] = useFonts(FONTS);
  return loaded;
}
