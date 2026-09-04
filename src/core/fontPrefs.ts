// حجم الخط — تفضيلان مستقلّان: واجهة النظام ومحتوى المستخدم (طلب أحمد ١٩ أغسطس)

/**
 * لماذا تفضيلان لا واحد: من يريد كلامَ الناس (مراجعات، منشورات، ردود)
 * أكبر لا يريد بالضرورة ترويسةً وأزراراً أكبر — والعكس. المعاملان
 * منفصلان في CSS (`--fs-ui` و`--fs-content` في globals.css)، وهذا
 * الملف يملك أسماءَ الدرجات وتنظيفَها وأسماءَ الكوكيين — **مصدرٌ واحد
 * يقرؤه الخادم (layout) والعميل (شاشة الإعدادات) والهجرة ١٢١.**
 *
 * التخزين على نمط الثيم حرفاً (D-014 + `ThemeCookieSync`): كوكي يقرؤه
 * الخادم قبل أول رسمة — فلا وميضَ ولا فرقَ ترطيب — وعمودان في
 * `profiles` للمسجَّل حتى يتبعه اختيارُه بين أجهزته، و`FontPrefsSync`
 * يهاجر قيمة الحساب إلى كوكي الجهاز الجديد مرةً ثم يصمت.
 */

export const FONT_SIZES = ["sm", "md", "lg", "xl"] as const;
export type FontSize = (typeof FONT_SIZES)[number];

/** كوكيا الحجم — أسماءٌ قصيرة لأنهما يُرسلان مع كل طلب */
export const FONT_UI_COOKIE = "fs_ui";
export const FONT_CONTENT_COOKIE = "fs_content";

/** قيمةٌ من خارج القائمة (كوكي معطوب، عمود قديم) تسقط إلى الافتراضي */
export function sanitizeFontSize(value: unknown): FontSize {
  return FONT_SIZES.includes(value as FontSize) ? (value as FontSize) : "md";
}

/**
 * قيمة `data-fs-*` على جذر الصفحة — الافتراضي بلا سمةٍ أصلاً حتى يبقى
 * HTML أغلب الزوار نظيفاً ولا يدفع أحدٌ ثمنَ ميزةٍ لا يستعملها.
 */
export function fontAttr(size: FontSize): string | undefined {
  return size === "md" ? undefined : size;
}
