import { Icon } from "../Icon";

/**
 * 🆕 **صفُّ «ما اخترتَه» — رقاقةٌ لكلِّ محورٍ يُصفّي الآن، تُلغيه بضغطة.**
 *
 * **وكان مرسوماً بيده في `DiscoverFilters` وحدَها منذ D-134**، **وتتمّةُ
 * المرحلة ٨ تطلبه في المكتبة** — **فنُقل إلى مكوّنٍ واحدٍ قبل أن يُنسخ**:
 * **نسخةٌ ثانيةٌ من صفٍّ هذا شكلُه بالضبط خطأٌ بالقاعدة ٦**، وأوّلُ تعديلٍ
 * غداً كان سيمسّ إحداهما.
 *
 * ⚠️ **ومكوّنٌ هنا لا وصفةُ أصناف** — بخلاف `chipClass` و`actionTailItem`:
 * **الدلالةُ واحدةٌ في كلِّ موضع** (زرُّ إلغاءٍ داخل `role="group"`)،
 * **ولا تختلف بين رابطٍ وزرّ.** الوصفةُ تُترك للشكل الذي تختلف دلالتُه.
 *
 * ⚠️ **ولم تأخذ `chipClass`**: **الممتلئةُ بلون الهوية تعني «مختار،
 * المسني لتُلغيه»** — **وهذه معناها الإلغاءُ وحدَه**، فحدٌّ خفيفٌ و«×»
 * ظاهرة. (الحجّةُ من D-134 بحرفها.)
 *
 * ⚠️ **وصفرُ رقائقٍ يعني صفرَ بكسلات**: المنادي لا يرسم الصفَّ أصلاً —
 * **وهذا هو الفرقُ بينه وبين صفِّ الرقاقات الذي حُذف في D-280**، وذاك
 * كان يأكل ٥٤px من الرأس اللاصق **في كلِّ لحظةِ تمرير، مفعَّلاً أو لا.**
 */
export type FilterChip = {
  key: string;
  /** ما يُكتب في الرقاقة — جاهزاً بلغة القارئ، لا مفتاحاً يُترجَم هنا */
  label: string;
  clear: () => void;
};

export function ActiveFilterChips({
  chips,
  groupLabel,
  removeLabel,
  clearAllLabel,
  onClearAll,
}: {
  chips: FilterChip[];
  groupLabel: string;
  /** `t.browseRemoveFilter` — الدالّةُ نفسُها في كلِّ سطح */
  removeLabel: (label: string) => string;
  clearAllLabel: string;
  /**
   * **يُرسم «امسح الكل» متى كانت الرقائقُ أكثرَ من واحدة** — **وواحدةٌ
   * تُمسح بنفسها**، فزرٌّ ثانٍ لفعلٍ أوّلُ حرفٍ منه أقربُ زيادةٌ لا خيار.
   */
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="-mx-4 px-4 flex flex-wrap items-center gap-2"
    >
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.clear}
          aria-label={removeLabel(c.label)}
          className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent px-3 py-1.5 text-14 font-semibold hover:bg-accent/20 active:scale-[0.97] transition"
        >
          <span className="max-w-[14rem] truncate">{c.label}</span>
          <Icon name="close" size={13} strokeWidth={2.4} />
        </button>
      ))}
      {chips.length > 1 && (
        /* **نفسُ هندسة الرقاقة لا نصٌّ عارٍ**: الصفُّ قد يلتفّ فيقع «امسح
           الكل» وحدَه في سطر — **ونصٌّ وحدَه في سطرٍ يُقرأ عنواناً لا
           زرّاً.** والحدُّ والحشو يبقيانه فعلاً، ولونُه الرمادي يبقيه دون
           الرقائق في الصوت. */
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-full border border-border text-muted hover:text-foreground hover:border-accent/50 px-3 py-1.5 text-12 font-semibold transition"
        >
          {clearAllLabel}
        </button>
      )}
    </div>
  );
}
