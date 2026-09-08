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
} as const;

export type Weight = "400" | "500" | "600" | "700" | "800";

/** المقطعُ العربيّ (بما فيه العلاماتُ والأرقامُ الهنديّة) — حرفٌ واحدٌ يكفي ليُعدّ المقطعُ عربيّاً */
export const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/**
 * اسمُ العائلة لوزنٍ وحرف. **الأوزانُ غيرُ الموجودة تسقط إلى أقرب موجود
 * كما يفعل المتصفّح**: Tajawal بلا ٦٠٠ ⇢ ٧٠٠؛ Poppins بلا ٨٠٠ ⇢ ٧٠٠ (وهي
 * القاعدةُ التي شرحها `globals.css`: «٦٠٠ العربيّ يسقط إلى ٧٠٠»).
 */
export function familyOf(arabic: boolean, weight: Weight): keyof typeof FONTS {
  if (arabic) {
    const w = weight === "600" ? "700" : weight;
    return `Tajawal-${w}` as keyof typeof FONTS;
  }
  const w = weight === "800" ? "700" : weight;
  return `Poppins-${w}` as keyof typeof FONTS;
}

/** يُحمَّل مرّةً في الجذر؛ قبل الاكتمال تُرسم الشاشاتُ بخطّ النظام لا فراغاً */
export function useAppFonts(): boolean {
  const [loaded] = useFonts(FONTS);
  return loaded;
}
