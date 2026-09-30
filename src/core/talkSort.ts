/**
 * ====== ترتيبُ غرف «النقاشات» — D-1201 (٣٠ سبتمبر ٢٠٢٦) ======
 *
 * **دالّةٌ واحدةٌ للسطحين** (الويبُ يرتّب على الخادم، والتطبيقُ يرتّب في يده حين تُضغط الشريحة — بلا جلب):
 * - **المثبَّتُ أوّلاً في الترتيبين** (درجتا D-301/D-314: لوبز ثمّ أنا) — التثبيتُ قرارُك لا الترتيب.
 * - **«الأحدث»**: آخرُ مشاركةٍ أوّلاً (ترتيبُ `title_talk_rooms` نفسُه).
 * - **«الأكثر تفاعلاً»**: تفاعلُ **أسبوع السبت الجاري** لا مجموعُ العمر (أحمد: «المشاركات والردود والإعجابات») — وإلّا بقي نقاشٌ
 *   قديمٌ كبيرٌ فوق دائماً ولو صمت. المشاركاتُ تشمل الردود أصلاً (`title_posts` بـ`parent_id`)، والإعجاباتُ من `likes_week`
 *   (الهجرة ١٩٢ — قبلها صفرٌ فيبقى الترتيبُ بالمشاركات وحدَها، قارئٌ متسامح D-179). التعادلُ يُحسم بالأحدث.
 */
export type TalkSort = "latest" | "active";

type RoomLike = { postsWeek: number; likesWeek?: number; lastAt: string };

/** تفاعلُ الأسبوع: مشاركاتٌ (وردودُها) + إعجاباتٌ على مشاركات الغرفة */
export const talkActivity = (r: RoomLike) => r.postsWeek + (r.likesWeek ?? 0);

export function sortTalkRooms<T extends RoomLike>(rooms: readonly T[], sort: TalkSort, pinRank: (r: T) => number): T[] {
  const at = (r: T) => Date.parse(r.lastAt) || 0;
  return [...rooms].sort(
    (a, b) =>
      pinRank(b) - pinRank(a) ||
      (sort === "active" ? talkActivity(b) - talkActivity(a) : 0) ||
      at(b) - at(a),
  );
}
