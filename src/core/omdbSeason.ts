/**
 * 🆕 D-1553 — قراءةُ قائمةِ موسمٍ من OMDb: ما فيها من تقييمات، وما ينقصها.
 *
 * بلاغُ أحمد (26 أكتوبر، Lost الموسم الأول): حلقاتٌ لا يظهر تقييمُها مع أنّ لها
 * تقييماً في IMDb. **قائمةُ الموسم عند OMDb ناقصة** — تعطي «N/A» لحلقاتٍ لها
 * تقييمٌ في سجلِّها المفرد، أو تُسقط الحلقةَ من القائمة كلّها. فنسأل عن الناقصة
 * وحدَها حلقةً حلقة (`lib/omdb.ts`).
 *
 * **ولماذا هنا لا في `lib/omdb.ts`:** القرارُ «أيُّ حلقةٍ تستحقّ سؤالاً» حسابٌ
 * خالص يُختبر بلا شبكة — والخطأ فيه يحرق حصّةَ OMDb اليوميّة (١٠٠٠ طلب).
 */

export interface OmdbSeasonEpisode {
  Episode?: string;
  imdbRating?: string;
  Released?: string;
}

/** سقفُ الأسئلة المفردة في الموسم الواحد — **موسمٌ ناقصٌ كلُّه لا يأكل الحصّة** */
export const MAX_EPISODE_LOOKUPS = 12;

/** «8.3» → 8.3؛ و«N/A» وما ليس رقماً موجباً → null (الغيابُ أصدق من البديل، D-063) */
export function ratingNumber(raw: string | undefined): number | null {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * من قائمة الموسم: التقييماتُ الموجودة، والحلقاتُ التي تستحقّ سؤالاً مفرداً.
 *
 * تستحقّ السؤالَ حلقةٌ **بُثّت** بلا تقييم: «N/A» وتاريخُ عرضها مضى —
 * **فحلقةُ الأسبوع القادم لا تُسأل كلَّ يوم** — أو رقمٌ غائبٌ من القائمة بين
 * الأولى وآخرِ حلقةٍ ذُكرت (لا تاريخَ لها فتُعامَل كمعروضة: ما بعدها عُرض).
 */
export function readSeasonList(
  episodes: OmdbSeasonEpisode[],
  today: string,
): { ratings: Record<number, number>; missing: number[] } {
  const ratings: Record<number, number> = {};
  const listed = new Set<number>();
  const missing: number[] = [];
  let last = 0;
  for (const e of episodes) {
    const num = Number(e.Episode);
    if (!Number.isInteger(num) || num < 1) continue;
    listed.add(num);
    last = Math.max(last, num);
    const r = ratingNumber(e.imdbRating);
    if (r !== null) {
      ratings[num] = r;
      continue;
    }
    const released = /^\d{4}-\d{2}-\d{2}$/.test(e.Released ?? "") ? e.Released! : null;
    if (released && released <= today) missing.push(num);
  }
  for (let n = 1; n < last; n++) if (!listed.has(n)) missing.push(n);
  missing.sort((a, b) => a - b);
  return { ratings, missing: missing.slice(0, MAX_EPISODE_LOOKUPS) };
}
