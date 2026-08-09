import { PersonName } from "./PersonRow";
import { FollowUserButton } from "./FollowUserButton";
import { getDict, type Locale } from "@/lib/i18n";
import type { SuggestedPerson } from "@/lib/data";

/**
 * «أشخاص لمتابعتهم» — الفراغ يُعالَج من جذره (D-126).
 *
 * `FeedEmptyCta` (D-106) يقول «ابحث عن أصدقاء» ويفتح ورقة بحث: خطوةٌ
 * صحيحة تفترض أن المستخدم يعرف من يبحث عنه بالاسم. أكثر الحسابات
 * الجديدة لا تعرف أحداً هنا — فالورقة تُفتح وتُغلق فارغة. هذه البطاقة
 * تحمل الاسم إليه بدل أن تطلبه منه.
 *
 * **وتظهر ما دام الخطّ هزيلاً لا فارغاً وحده** (أقلّ من خمسة صفوف):
 * دائرةٌ من شخصين تُنتج خطّاً صامتاً تماماً كدائرةٍ من صفر، والفرق أن
 * الأولى لا تُظهر أي حالةٍ فارغة فتبدو الصفحة معطوبة لا ناقصة.
 *
 * لا فيد عام (D-059): الغرباء يظهرون **كاقتراح متابعة** لا كمحتوى —
 * الفرق أن هذا يُبنى دائرةً ويُطوى، وذاك يستبدل الدائرة بالغرباء.
 */
export function PeopleToFollow({
  people,
  locale,
  compact = false,
}: {
  people: SuggestedPerson[];
  locale: Locale;
  /** داخل خطٍّ فيه صفوف: بلا حدٍّ متقطّع ولا سطر تمهيد ثانٍ */
  compact?: boolean;
}) {
  const t = getDict(locale);
  if (!people.length) return null;

  return (
    <section
      aria-label={t.suggestPeopleTitle}
      className={
        compact
          ? "mt-6 pt-5 border-t border-[color:var(--divider)]"
          : "mt-4 bg-surface border border-dashed border-border rounded-xl p-4"
      }
    >
      <h2 className="text-sm font-bold">{t.suggestPeopleTitle}</h2>
      <p className="text-xs text-muted mt-1">{t.suggestPeopleHint}</p>

      <ul className="mt-3 divide-y divide-[color:var(--divider)]">
        {people.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <PersonName
              person={p}
              t={t}
              size={36}
              /* سببٌ واحد لا سببان: التقاطع إن وُجد، وإلا المتابِعون —
                 سطرٌ يشرح «لماذا هذا الشخص»، وسطران يشرحان لا شيء */
              sub={
                p.shared > 0
                  ? t.suggestShared(p.shared)
                  : p.followers > 0
                    ? t.suggestFollowers(p.followers)
                    : undefined
              }
            />
            <div className="shrink-0">
              <FollowUserButton targetId={p.id} locale={locale} initialFollowing={false} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
