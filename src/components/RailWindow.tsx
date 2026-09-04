import Link from "next/link";
import { segmentedTrack, segmentedItem } from "./ui/controls";
import type { RailWin } from "@/core/browse";

/** النوافذُ الثلاث بترتيبها — من الأضيق إلى الأوسع، فالقراءةُ تمشي في اتجاه */
const WINS = ["week", "month", "all"] as const;
export type RailWinKey = (typeof WINS)[number];

/**
 * مبدِّلُ نافذة رفِّ «أفضل ١٠» — **أسبوع · شهر · كل الأوقات** (D-445).
 *
 * **عادت بمواصفة المرحلة ٦** («Top 10 This Week — Week / Month / All
 * time») بعد أن شطبَ أحمد رقائقَ D-099 في D-420، **ونقضُه مسجَّلٌ باسمه
 * في `browse.ts`**. **والذي تغيّر ليس الرأيَ فحسب بل السؤال**: تلك كانت
 * «أسبوع/شهر/سنة» — **و«سنة» يجيبها ذيلُ «أفضل ٢٥ هذي السنة» في الصفحة
 * نفسِها**، فكان المبدِّلُ يعرض بابين لغرفةٍ واحدة. **و«كل الأوقات» لا
 * بابَ لها في اكتشف اليوم.**
 *
 * ⚠️ **وروابطُ لا أزرار — والفرقُ ليس أسلوباً**: هذا مكوّنُ خادمٍ بلا
 * جافاسكربت، **والنافذةُ حالةٌ في الرابط** (`?wm=month`) كسائر محاور
 * اكتشف — فتُشارَك وتُحفَظ ويعود منها زرُّ الرجوع. **ومبدِّلٌ بحالةٍ في
 * الذاكرة كان سيجعل الرفَّ يقول شيئاً والرابطُ شيئاً آخر** حين يُنسخ.
 * و`replace` لا `push`: نافذةٌ تُجرَّب ثلاثَ مرّاتٍ في دقيقة **لا تستحقّ
 * ثلاثَ خطواتٍ في تاريخ التصفّح** (قصدُ D-023 نفسُه).
 * و`scroll={false}` كي لا تقفز الصفحةُ إلى أعلاها عند كلِّ لمسة —
 * **والرفُّ الذي يتبدّل تحت إصبعك يجب أن يبقى تحته.**
 *
 * **والعائلةُ `segmented` لا `chip`** (`ui/controls.ts`): ثلاثةُ خياراتٍ
 * يستبعد بعضُها بعضاً وعددُها معروف — وهو نصُّ تعريف العائلة. **وبمسارٍ
 * ذي خطٍّ سفليّ** (`segmentedTrack` لا `Bare`): الشريطُ الأصفر يجلس على
 * خطٍّ **ورأسُ الرفّ لا يحمل خطّاً**، فبلا مسارٍ يحمله لطفا الشريطُ في
 * الفراغ — وهي بالضبط شكوى ٩ أغسطس («لا تحط خط ثاني»).
 */
export function RailWindow({
  value,
  hrefs,
  labels,
  ariaLabel,
}: {
  value: RailWin;
  /** وجهةُ كلِّ نافذة — تُبنى على الخادم فتحمل الفلترَ ونوافذَ الرفوف الأخرى */
  hrefs: Record<RailWinKey, string>;
  labels: Record<RailWinKey, string>;
  ariaLabel: string;
}) {
  return (
    <span role="group" aria-label={ariaLabel} className={`${segmentedTrack} shrink-0`}>
      {WINS.map((w) => {
        const on = value === w;
        return (
          <Link
            key={w}
            href={hrefs[w]}
            replace
            scroll={false}
            /* `aria-current` لا `aria-pressed`: هذه روابطُ تنقّلٍ لا أزرارُ
               تبديل، **والدلالةُ تتبع العنصرَ لا الشكلَ** (`controls.ts`:
               «وصفاتٌ لا مكوّنات» لهذا السبب بعينه). */
            aria-current={on ? "true" : undefined}
            className={segmentedItem(on, "px-2.5 pt-1 pb-2 text-12", false)}
          >
            {labels[w]}
          </Link>
        );
      })}
    </span>
  );
}
