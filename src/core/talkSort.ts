/**
 * ====== ترتيبُ غرف «النقاشات» — D-1201 ⇐ D-1207 (٣٠ سبتمبر ٢٠٢٦) ======
 *
 * **دالّةٌ واحدةٌ للسطحين** (الويبُ يرتّب على الخادم، والتطبيقُ يرتّب في يده حين تُضغط الشريحة — بلا جلب):
 * - **المثبَّتُ أوّلاً في الترتيبين** (درجتا D-301/D-314: لوبز ثمّ أنا) — التثبيتُ قرارُك لا الترتيب.
 * - **«الأحدث»**: آخرُ نشاطٍ أوّلاً (`last_at` — والإشعارُ الجديدُ يرفع غرفتَه).
 * - **«الأكثر تفاعلاً»**: تفاعلُ **آخر ٣٠ يوماً** (أحمد: «المشاركات والردود والإعجابات» · «حتى النقاش آخر ٣٠ يوم» — كالنشاط، D-1207):
 *   مشاركاتٌ (والردودُ منها) + إعجاباتٌ بتاريخها (الهجرة ١٩٢). التعادلُ بالأحدث. **وشهرٌ بلا تفاعلٍ كلُّه ⇒ `talkQuiet`**
 *   فيُقال ذلك سطراً خافتاً وتعود البطاقاتُ إلى سطرها العادي — لا ترتيبٌ يطابق «الأحدث» فيبدو معطّلاً.
 */
export type TalkSort = "latest" | "active";

type RoomLike = { postsMonth: number; likesMonth?: number; lastAt: string };

/** تفاعلُ الشهر: مشاركاتٌ (وردودُها) + إعجاباتٌ على مشاركات الغرفة */
export const talkActivity = (r: RoomLike) => r.postsMonth + (r.likesMonth ?? 0);

/** لا غرفةَ تفاعل معها أحدٌ في الشهر ⇒ «الأكثر تفاعلاً» هو «الأحدث» ويُقال ذلك */
export const talkQuiet = (rooms: readonly RoomLike[]) => !rooms.some((r) => talkActivity(r) > 0);

export function sortTalkRooms<T extends RoomLike>(rooms: readonly T[], sort: TalkSort, pinRank: (r: T) => number): T[] {
  const at = (r: T) => Date.parse(r.lastAt) || 0;
  return [...rooms].sort(
    (a, b) =>
      pinRank(b) - pinRank(a) ||
      (sort === "active" ? talkActivity(b) - talkActivity(a) : 0) ||
      at(b) - at(a),
  );
}
