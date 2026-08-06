/**
 * عائلتا الاختيار — وصفتا أصنافٍ لا مكوّنان.
 *
 * كان في التطبيق سبع لغاتٍ لحالة «مختار»: قرصٌ ممتلئ في مسار، ورقاقةٌ
 * بحدّ، ورقاقةٌ بصبغة `accent/15`، وخطٌّ سفليّ، ونسخةٌ بـ`accent-2`،
 * وأخرى بسطحٍ بلا لون هوية — والشاشة الواحدة تجمع ثلاثاً منها أحياناً.
 * الآن عائلتان لا أكثر:
 *
 *  - **segmented**: خياراتٌ يستبعد بعضها بعضاً وعددها قليل ومعروف
 *    (تبويب، جهة محتوى، لغة). خطٌّ فاصلٌ رفيع أسفل الصفّ، وخطٌّ بلون
 *    التمييز يجلس عليه تحت المختار وحده. اخترنا الخطّ السفليّ على القرص
 *    الممتلئ لأنه أخفّ بصرياً ولا يزاحم المحتوى — قرارُ المالك بعد
 *    مراجعة الشكل (يُنقض به اختيار القرص في تمريرة توحيد النظام، ويُحدَّث
 *    D-016). القرصُ الممتلئ بقي للرقائق وحدها.
 *  - **chip**: فلترٌ من قائمةٍ مفتوحة قد تُمرَّر أفقياً (الأنواع، الفرز،
 *    شرائح المكتبة). حدٌّ رفيع يمتلئ بلون الهوية عند الاختيار.
 *
 * وصفاتٌ لا مكوّنات لأن الدلالة تختلف بين الموضعين: بعضها `role="tablist"`
 * بتنقّل أسهم، وبعضها أزرار `aria-pressed`، وبعضها روابط. الشكل يوحَّد
 * دون أن تُفرض دلالةٌ واحدة على الجميع.
 */

/**
 * مسار المقسّم — صفٌّ يلامس محتواه فوق خطٍّ فاصلٍ سفليّ، وفاصلٌ رأسيّ
 * رفيع بين الخانات.
 *
 * الفاصل الرأسيّ عنصرٌ زائفٌ (`before`) على كل خانةٍ عدا الأولى، لا
 * `divide-x`: ذاك يمدّ الخطّ بكامل ارتفاع الخانة فيلتقي بالخطّ الأفقيّ
 * السفليّ ويصنع زاويةً مقفلة. هنا يُقصّ من أعلى وأسفل (`inset-y-2`)
 * فتبقى فجوةٌ قبل الأفقيّ — قرارُ المالك بعد مراجعة الشكل.
 */
export const segmentedTrack =
  "inline-flex items-stretch border-b border-[color:var(--divider)]";

/** مسارٌ يملأ العرض ويقسّمه بالتساوي — أبناؤه يأخذون `flex-1` */
export const segmentedTrackFull =
  "flex w-full items-stretch border-b border-[color:var(--divider)]";

/**
 * خانة المقسّم — نصٌّ شفّاف يعلوه خطُّ تمييزٍ سفليّ عريض عند الاختيار.
 *
 * الخطّ عنصرٌ زائفٌ (`after`) يجلس على حدّ المسار السفليّ ويمتدّ بعرض
 * الخانة نفسها إلا هامشاً يسيراً على الطرفين. متماثلٌ في RTL/LTR.
 *
 * والفاصل الرأسيّ عنصرٌ زائفٌ (`before`) على كل خانةٍ عدا الأولى، مقصوصٌ
 * من أعلى وأسفل فلا يلمس الخطّ الأفقيّ السفليّ. يُوضع على الحافة البادئة
 * (`start`) فينقلب تلقائياً في RTL.
 *
 * `pad=false` لمن يحتاج حشواً خاصاً: تمرير `px-2` في `className` لا يكفي —
 * الغلبة في CSS لترتيب التوليد لا لترتيب النصّ. فمن يريد حشوه يمرّر `false`.
 */
export function segmentedItem(active: boolean, className = "", pad = true) {
  const rule =
    "before:pointer-events-none before:absolute before:inset-y-2 before:start-0 before:w-px before:bg-[color:var(--divider)] first:before:hidden";
  return `${pad ? "px-4 pt-2 pb-3 text-[13px] " : ""}relative font-semibold whitespace-nowrap transition-colors ${rule} ${
    active
      ? "text-foreground after:pointer-events-none after:absolute after:-bottom-px after:inset-x-4 after:h-[3px] after:rounded-full after:bg-accent"
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
