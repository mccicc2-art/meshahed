import { Dimensions, useWindowDimensions } from "react-native";
import type { Density } from "@/core/density";

/**
 * ====== 🆕 D-1379 — مقاساتُ الملصق وبطاقة «تابِع» في مكانٍ واحد، بنسبة عرض الشاشة ======
 *
 * 🔑 **قرارُ أحمد (١٢ أكتوبر)** بعد صورٍ على لقطة خالد: الملصقُ ١٠٠ · ١١٨ · ١٤٠ وبطاقةُ «تابِع» ١١٦ · ١٢٨ · ١٤٤
 * (كانت ٩٦ · ١١٨ · ١٤٨ و١٠٤ · ١٢٨ · ١٦١ — الكبيرُ كان يجعل البطاقةَ شبهَ مربّعة والصغيرُ يضيّقها).
 *
 * **والأرقامُ أرقامُ جهاز خالد (عرضُه ٤١٢) لا أرقامٌ مطلقة** («لاحظتها بين جوالي وجوال احمد»): بالبكسل الثابت كان
 * آيفون ٣٧٥ يعرض ٢٫٨ ملصق في الصفّ وPro Max ٣٫٣ بالإعداد نفسِه. الآن **عددُ الملصقات في الصفّ هو الثابت**، وكلُّ
 * شاشةٍ تضرب الأرقامَ بنسبة عرضها إلى ٤١٢ — بين ٠٫٨٧ (أضيقُ أندرويد، ٣٦٠) و١٫١٢ (لا ملصقاتٍ ضخمةً على التابلت).
 *
 * كانت الأرقامُ مكتوبةً في الرئيسيّة وفي الملفّ كلٌّ على حدة (القاعدة ٣) — هذا الملفُّ هو المصدرُ الوحيد الآن.
 */
export const REF_SCREEN_W = 412;
const MIN_FACTOR = 0.87;
const MAX_FACTOR = 1.12;

const POSTER_W: Record<Density, number> = { compact: 100, comfortable: 118, large: 140 };
const CONTINUE_H: Record<Density, number> = { compact: 116, comfortable: 128, large: 144 };
/** D-1278 — عرضُ بطاقة «تابِع» ١٨٤ على شاشة المرجع؛ لا يتبع الكثافة، يتبع الشاشةَ وحدَها */
const CONTINUE_W = 184;

export function screenFactor(screenW: number): number {
  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, screenW / REF_SCREEN_W));
}

/** للشيفرة التي تعمل خارج الشاشة (تسخينُ الصور): رابطُ الصورة يُبنى من العرض نفسِه الذي سيُرسم */
export function posterWidthFor(density: Density, screenW: number = Dimensions.get("window").width): number {
  return Math.round(POSTER_W[density] * screenFactor(screenW));
}

export type CardSizes = { posterW: number; continueW: number; continueH: number };

export function usePosterSizes(density: Density): CardSizes {
  const { width } = useWindowDimensions();
  const f = screenFactor(width);
  return {
    posterW: Math.round(POSTER_W[density] * f),
    continueW: Math.round(CONTINUE_W * f),
    continueH: Math.round(CONTINUE_H[density] * f),
  };
}
