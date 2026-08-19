import { Icon } from "./Icon";
import { getDict, type Locale } from "@/lib/i18n";
import type { TitleCircle } from "@/lib/data";

/**
 * «٣ ممن تتابعهم شاهدوه · متوسط تقييمهم ★٨» (D-127).
 *
 * الفيد يقول «ماذا شاهدت دائرتك» ويُقرأ مرّةً ثم يمضي. صفحةُ العمل تُفتح
 * لحظةَ القرار — أشاهده أم لا — ونفس البيانات هناك تجيب سؤالاً آخر:
 * «هل جرّبه أحدٌ أثق به؟». مكانٌ ثانٍ لبياناتٍ موجودة، بلا مصدرٍ جديد.
 *
 * **الكتم تحت ثلاثة في SQL لا هنا** (`title_circle`): صفرٌ راجعٌ يعني
 * «لا تُرسم» — والمكوّن يختفي بلا سطرٍ يقول «لا أحد». غيابُ الخبر ليس
 * خبراً، وسطرٌ يعلن أن دائرتك لم تشاهده يضيف يأساً لا معلومة.
 *
 * ولا لغةَ بصريةٍ جديدة: نفس حجم سطر البيانات فوقه، ونفس لون `muted`،
 * والنجمة نفسها التي يقرؤها المستخدم في كل مكان.
 */
export function CircleNote({ circle, locale }: { circle: TitleCircle; locale: Locale }) {
  const t = getDict(locale);
  if (circle.watchers < 3) return null;

  /* رقمٌ بفاصلةٍ عشرية واحدة، و«٨٫٠» تُقصّ إلى «٨»: الكسر الصفريّ ضجيج.
     الأرقام لاتينية كبقيّة أرقام التطبيق (`tabular-nums`)، والجملة تبقى
     في اتجاه الصفحة — لفُّها بـ`dir="ltr"` يقلب العربية حولها */
  const avg =
    circle.raters >= 3 && circle.avgRating !== null
      ? circle.avgRating.toFixed(1).replace(/\.0$/, "")
      : null;

  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs sm:text-[12px] text-muted">
      <Icon name="people" size={14} />
      <span>{t.circleWatched(circle.watchers)}</span>
      {avg && (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{t.circleAvg(avg)}</span>
        </>
      )}
    </p>
  );
}
