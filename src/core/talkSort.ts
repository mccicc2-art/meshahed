/**
 * ====== ترتيبُ غرف «النقاشات» — D-1201 ⇐ D-1207 (٣٠ سبتمبر ٢٠٢٦) ======
 *
 * **دالّةٌ واحدةٌ للسطحين** (الويبُ يرتّب على الخادم، والتطبيقُ يرتّب في يده حين تُضغط الشريحة — بلا جلب):
 * - **المثبَّتُ أوّلاً في الترتيبين** (درجتا D-301/D-314: لوبز ثمّ أنا) — التثبيتُ قرارُك لا الترتيب.
 * - **«الأحدث»**: آخرُ منشورٍ أو آخرُ حلقةٍ نزلت، أيُّهما أحدث (`talkLatestAt`، D-1603).
 * - **«الأكثر تفاعلاً»**: تفاعلُ **آخر ٣٠ يوماً** (أحمد: «المشاركات والردود والإعجابات» · «حتى النقاش آخر ٣٠ يوم» — كالنشاط، D-1207):
 *   مشاركاتٌ (والردودُ منها) + إعجاباتٌ بتاريخها (الهجرة ١٩٢). التعادلُ بالأحدث. **وشهرٌ بلا تفاعلٍ كلُّه ⇒ `talkQuiet`**
 *   فيُقال ذلك سطراً خافتاً وتعود البطاقاتُ إلى سطرها العادي — لا ترتيبٌ يطابق «الأحدث» فيبدو معطّلاً.
 */
export type TalkSort = "latest" | "active";

type RoomLike = { postsMonth: number; likesMonth?: number; lastAt: string; lastPostAt?: string | null; bulletin?: Record<string, unknown> | null };

/**
 * 🆕 D-1603 — **«الأحدث» = أحدثُ الأمرين: آخرُ منشورٍ من عضو أو آخرُ حلقةٍ نزلت** (أحمد ٣٠ أكتوبر: «لاتيست اخر شيء سواء نزلت
 * حلقة او سار فيه منشور»). `last_at` كان وقتَ كتابة لوبز للنشرة لا يومَ الحلقة — نشرةٌ تأخّرت أو أُعيدت ترفع غرفةً حلقتُها قديمة.
 * يومُ الحلقة من النشرة (`air`)، والمنشورُ من `lastPostAt`؛ صفٌّ بلا أيٍّ منهما (خادمٌ أقدم) يبقى على `last_at`.
 */
export function talkLatestAt(r: RoomLike): number {
  const post = r.lastPostAt ? Date.parse(r.lastPostAt) || 0 : 0;
  const air = typeof r.bulletin?.air === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.bulletin.air) ? Date.parse(`${r.bulletin.air.slice(0, 10)}T00:00:00Z`) || 0 : 0;
  /* نشرةٌ قديمةٌ بلا `air` (قبل حقله): وقتُ كتابتها أقربُ ما نعرف ليوم الحلقة */
  const best = Math.max(post, air || (r.bulletin ? Date.parse(r.lastAt) || 0 : 0));
  return best || Date.parse(r.lastAt) || 0;
}

/** تفاعلُ الشهر: مشاركاتٌ (وردودُها) + إعجاباتٌ على مشاركات الغرفة */
export const talkActivity = (r: RoomLike) => r.postsMonth + (r.likesMonth ?? 0);

/** لا غرفةَ تفاعل معها أحدٌ في الشهر ⇒ «الأكثر تفاعلاً» هو «الأحدث» ويُقال ذلك */
export const talkQuiet = (rooms: readonly RoomLike[]) => !rooms.some((r) => talkActivity(r) > 0);

export function sortTalkRooms<T extends RoomLike>(rooms: readonly T[], sort: TalkSort, pinRank: (r: T) => number): T[] {
  const at = talkLatestAt;
  return [...rooms].sort(
    (a, b) =>
      pinRank(b) - pinRank(a) ||
      (sort === "active" ? talkActivity(b) - talkActivity(a) : 0) ||
      at(b) - at(a),
  );
}
