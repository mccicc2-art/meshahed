// كثافةُ الملصقات — تفضيلٌ واحد تقرؤه الرئيسية والملفّ العامّ (D-441)

/**
 * **حجمُ الملصق اختيارُ صاحب الصفحة** (المرحلة ٤ من خطّة أحمد:
 * «خيارات Layout: Compact · Comfortable · Large · واختيار Poster Size»).
 *
 * **وهما سؤالٌ واحدٌ لا سؤالان**: «كم بطاقةً أرى في الصفّ» و«كم يكبر
 * الملصق» **وجهان لرقمٍ واحدٍ هو عرضُ البطاقة** — **ومفتاحان لسؤالٍ
 * واحد يجعلانك تقارن بدل أن تختار** (D-061).
 *
 * ⚠️ **وهو غيرُ `cardCount`**: ذاك **سقفٌ لعدد البطاقات المجلوبة**
 * (D-152)، وهذا **عرضُ الواحدة**. **الأوّل يقصّ الصفَّ، والثاني يكبّر
 * ما بقي فيه.**
 *
 * **والتطبيقُ متغيّرُ CSS لا معامِلٌ يُمرَّر**: `RailItem` منتشرٌ في
 * عشرات المواضع، **وتمريرُ مقاسٍ عبر كلِّ صفٍّ كان سيجعل كلَّ صفحةٍ
 * تعرف تفضيلاً لا يخصّها** — **والمتغيّرُ يُكتب مرّةً على جذر الصفحة
 * فيرثه كلُّ ملصقٍ تحتَه**، ومن لم يُكتب له يبقى على الافتراضيّ.
 */
export const DENSITIES = ["compact", "comfortable", "large"] as const;
export type Density = (typeof DENSITIES)[number];

export const DEFAULT_DENSITY: Density = "comfortable";

/** عرضُ الملصق — للجوال ثم للشاشة الواسعة. و«المريح» هو المقاس القائم */
const WIDTH: Record<Density, { w: string; sm: string }> = {
  compact: { w: "96px", sm: "112px" },
  comfortable: { w: "118px", sm: "138px" },
  large: { w: "148px", sm: "176px" },
};

/**
 * المتغيّراتُ التي تُكتب على جذر الصفحة.
 *
 * **والافتراضيُّ يكتبها أيضاً** ولا يُترك للاحتياط في الصنف: **لو
 * تشاركت صفحتان جذراً واحداً لبقي مقاسُ الأولى على الثانية** — والكتابةُ
 * الصريحة تقطع الوراثة.
 */
export function densityVars(d: Density): React.CSSProperties {
  const { w, sm } = WIDTH[d];
  return { "--poster-w": w, "--poster-w-sm": sm } as React.CSSProperties;
}

/** ما جاء من عمود JSON الحرّ قد يكون أيَّ شيء — يسقط إلى الافتراضي */
export function sanitizeDensity(raw: unknown): Density {
  return typeof raw === "string" && (DENSITIES as readonly string[]).includes(raw)
    ? (raw as Density)
    : DEFAULT_DENSITY;
}
