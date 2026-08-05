/**
 * عائلتا الاختيار — وصفتا أصنافٍ لا مكوّنان.
 *
 * كان في التطبيق سبع لغاتٍ لحالة «مختار»: قرصٌ ممتلئ في مسار، ورقاقةٌ
 * بحدّ، ورقاقةٌ بصبغة `accent/15`، وخطٌّ سفليّ، ونسخةٌ بـ`accent-2`،
 * وأخرى بسطحٍ بلا لون هوية — والشاشة الواحدة تجمع ثلاثاً منها أحياناً.
 * الآن عائلتان لا أكثر:
 *
 *  - **segmented**: خياراتٌ يستبعد بعضها بعضاً وعددها قليل ومعروف
 *    (تبويب، جهة محتوى، لغة). قرصٌ ممتلئ داخل مسارٍ محدود.
 *  - **chip**: فلترٌ من قائمةٍ مفتوحة قد تُمرَّر أفقياً (الأنواع، الفرز،
 *    شرائح المكتبة). حدٌّ رفيع يمتلئ بلون الهوية عند الاختيار.
 *
 * وصفاتٌ لا مكوّنات لأن الدلالة تختلف بين الموضعين: بعضها `role="tablist"`
 * بتنقّل أسهم، وبعضها أزرار `aria-pressed`، وبعضها روابط. الشكل يوحَّد
 * دون أن تُفرض دلالةٌ واحدة على الجميع.
 */

/** مسار المقسّم — الأزرار تُوضع داخله مباشرةً */
export const segmentedTrack =
  "inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border";

/** مسارٌ يملأ العرض ويقسّمه بالتساوي — أبناؤه يأخذون `flex-1`.
    لا يُبنى فوق `segmentedTrack`: ذاك `inline-flex`، وترتيب أصناف
    Tailwind يجعل `inline-flex` يغلب `flex` مهما كان ترتيب النصّ. */
export const segmentedTrackFull =
  "flex w-full items-center gap-1 p-1 rounded-full bg-surface border border-border";

/**
 * قرص المقسّم.
 *
 * `pad=false` لمن يحتاج حشواً خاصاً: تمرير `px-2` في `className` لا يكفي —
 * الغلبة في CSS لترتيب التوليد لا لترتيب النصّ، و`px-4` المكتوب هنا يهزم
 * `px-2` المكتوب هناك. فمن يريد حشوه يُلغي الحشو الأساسي أولاً.
 */
export function segmentedItem(active: boolean, className = "", pad = true) {
  return `${pad ? "px-4 py-1.5 text-[13px] " : ""}rounded-full font-semibold transition whitespace-nowrap ${
    active
      ? "bg-accent text-[color:var(--on-accent)] shadow-lg shadow-accent/25"
      : "text-muted hover:text-foreground"
  }${className ? ` ${className}` : ""}`;
}

export type ChipSize = "sm" | "md";

const CHIP_SIZE: Record<ChipSize, string> = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3.5 py-2 text-sm",
};

export function chipClass(active: boolean, size: ChipSize = "md", className = "") {
  return `${CHIP_SIZE[size]} rounded-full border font-semibold whitespace-nowrap transition ${
    active
      ? "bg-accent text-[color:var(--on-accent)] border-accent"
      : "bg-surface text-muted border-border hover:text-foreground hover:border-accent/50"
  }${className ? ` ${className}` : ""}`;
}

/** صفٌّ أفقي من الرقائق يلامس حافّة الشاشة ويُمرَّر بالسحب */
export const chipRow =
  "-mx-4 px-4 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
