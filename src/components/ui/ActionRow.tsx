import { Icon, type IconName } from "@/components/Icon";

/**
 * ============ صفُّ الفعل — وصفةٌ واحدةٌ لبابٍ في ذيل صفحة (D-810) ============
 *
 * **رمزٌ · عنوانٌ وسطرٌ تحته · سهم**، داخل بطاقةٍ محدودة.
 *
 * **ولمَ خرج**: **قارئُه الثاني وُلد** — «الإحصائيات الكاملة» في ذيل
 * «تقريرك» (D-805)، **و«شارك تقريرك» بجانبها** (D-810) — **وصفّان
 * بالشكل نفسِه مكتوبان بنصَّي أصنافٍ متطابقين يفترقان عند أوّل تعديل**
 * (D-002: عند القارئ الثاني يُستخرج · القاعدة ٣: لا وصفةَ ثانية).
 *
 * 🔑 **و`actionRowClass` منفصلةٌ عن الجسم** — **عُرفُ `buttonClass`
 * نفسُه** (`ui/Button`): **أحدُ الصفَّين رابطٌ والآخرُ زرٌّ بحالة
 * انشغال** — **ورابطٌ يرث شكلَ الزرِّ أصدقُ من زرٍّ يتظاهر بأنه رابط.**
 *
 * ⚠️ **والسهمُ بلا `dir="ltr"`** (D-801): **`›` مرآويٌّ في يونيكود**
 * **فينقلب مع العربيّة إلى جهة القراءة** — **وقسرُ اتّجاهه يقلبه إلى
 * الجهة الخطأ في العربيّة.**
 */
export const actionRowClass =
  "w-full flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-start active:opacity-70 transition disabled:opacity-50";

export function ActionRowBody({
  icon,
  title,
  sub,
  /** **السهمُ يسقط حين لا وجهةَ** — زرٌّ يفعل في مكانه لا يَعِد بصفحة */
  arrow = true,
}: {
  icon: IconName;
  title: string;
  sub: string;
  arrow?: boolean;
}) {
  return (
    <>
      <Icon name={icon} size={18} className="text-accent shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-14 font-bold">{title}</span>
        <span className="block text-12 text-muted mt-0.5">{sub}</span>
      </span>
      {arrow ? (
        <span aria-hidden className="text-muted shrink-0">
          ›
        </span>
      ) : null}
    </>
  );
}
