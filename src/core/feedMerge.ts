/**
 * ====== 🆕 D-1605 — دمجُ خطّين بمؤشّرٍ واحد: نشاطُ الأعضاء ومراجعاتُ الشخصيّات المتابَعة ======
 *
 * الخطُّ صفحاتٌ بمؤشّر «الأقدم» (`before`) واحد (D-1596)، والصفوفُ تأتي من منبعين لكلٍّ سقفُه: دالّةُ النشاط (٦٠ للأولى · ٣٠ للتالية)
 * و`followed_persona_reviews` (٣٠). **منبعٌ امتلأ لا يُعرف ما تحت آخر صفٍّ فيه** — فلو بقيت صفوفُ المنبع الآخر الأقدمُ منه في
 * الصفحة لصار «أقدمُ صفٍّ ظاهر» تحت فجوةٍ لم تُجلب، وقفز التطبيقُ فوقها (مؤشّرُه أقدمُ ما رسم). 🔑 **فالحدُّ أحدثُ «آخِرِ صفٍّ» في
 * منبعٍ ممتلئ**: يُقصّ ما تحته من المنبعين، والصفحةُ التالية تجلبه من جديد (مؤشّرُها الحدُّ نفسُه). منبعٌ لم يمتلئ قال كلَّ ما عنده
 * فلا حدَّ منه. **ولا منبعَ ممتلئاً ⇒ لا حدّ ولا صفحةَ بعدها.**
 */
export function mergeFeedStreams<T extends { updated_at: string }>(
  a: readonly T[],
  aFull: boolean,
  b: readonly T[],
  bFull: boolean,
): { items: T[]; cutoff: string | null } {
  const ms = (x: T) => Date.parse(x.updated_at);
  const oldest = (xs: readonly T[]) => xs.reduce<T | null>((m, x) => (m === null || ms(x) < ms(m) ? x : m), null);
  const edges = [aFull ? oldest(a) : null, bFull ? oldest(b) : null].filter((x): x is T => x !== null);
  const edge = edges.reduce<T | null>((m, x) => (m === null || ms(x) > ms(m) ? x : m), null);
  const items = [...a, ...b];
  if (!edge) return { items, cutoff: null };
  const floor = ms(edge);
  return { items: items.filter((x) => ms(x) >= floor), cutoff: edge.updated_at };
}
