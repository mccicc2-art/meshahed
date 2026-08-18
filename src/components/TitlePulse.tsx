import { getDict, num, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * **نبضُ العمل في الترويسة — قلوبُ الناس وتقييمُهم** (D-408، طلبُ أحمد
 * بلقطةٍ على الفراغ جنب الملصق: «في هذي المساحة أحتاج أعرف كم واحد
 * معطيه قلب وكم تقييمه… وأعتقد فوق»).
 *
 * ================= ولماذا هنا لا في تبويب المجتمع =================
 *
 * **الترويسةُ تقول ما يقوله العالمُ عن العمل**: IMDb وطماطم والتصنيف
 * العمريّ (D-286). **وهذا ما يقوله أهلُ Loopz عنه** — **حقيقةٌ من
 * نوعها**، فموضعُها السطرُ الذي يليها مباشرةً. **وكانت مدفونةً في بطاقة
 * «انضمّ إلى الحديث» داخل تبويبٍ لا يفتحه إلا من قصده** (D-407 نقلها من
 * هناك، فلا رقمَ في موضعين).
 *
 * 🔴 **وهي جوابُ سؤالٍ ثانٍ سأله أحمد في اللقطة نفسِها**: «عمل مثل هذا
 * ليه ما هو واضح وين يعرض؟ أو تصنيفه العمري أو حتى تقييمه؟» —
 * **والجوابُ الصادق أن TMDB وOMDb لا تملكان لهذا العمل شيئاً** (عملٌ
 * عربيٌّ خارج تغطيتهما): لا `imdb_id` فلا تقييمَ ولا تصنيفَ عمريّ، ولا
 * مزوّدَ بثٍّ عند JustWatch. **ولا نخترع رقماً لا نملكه** (D-217).
 * **لكنّ عملاً لا يعرفه العالمُ قد يعرفه أهلُه** — **فهذا السطرُ يملأ
 * الفراغَ بما نملكه فعلاً**، ويظهر حيث تغيب شارات الخارج.
 *
 * **والصفرُ لا يُرسم** (D-222): عملٌ لا قلبَ له ولا تقييم لا يحمل سطراً
 * يقول صفراً.
 */
export function TitlePulse({
  hearts,
  votes,
  avg,
  locale,
}: {
  hearts: number;
  votes: number;
  avg: number;
  locale: Locale;
}) {
  const t = getDict(locale);
  if (hearts <= 0 && votes <= 0) return null;
  const rounded = Math.round(avg * 10) / 10;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
      {hearts > 0 && (
        <span
          className="inline-flex items-center gap-1.5"
          title={t.titlePulseHearts(num(hearts, locale))}
        >
          <Icon name="heart-filled" size={14} className="text-[color:var(--error)] shrink-0" />
          <span className="font-bold tabular-nums">{num(hearts, locale)}</span>
        </span>
      )}
      {votes > 0 && (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="font-bold text-accent tabular-nums">
            ★ <span dir="ltr">{rounded.toFixed(1)}</span>
          </span>
          <span className="tabular-nums">({num(votes, locale)})</span>
        </span>
      )}
    </div>
  );
}
