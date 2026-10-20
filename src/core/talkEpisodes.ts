/**
 * ====== نقاشُ الحلقات — الحلقةُ لكلِّ سطرٍ والتصفيةُ بها (🆕 D-1495) ======
 *
 * أحمد ٢٠ أكتوبر: «فيه نقاش لكل حلقة واقدر اختار الكل ويظهر الكل». الغرفةُ تبقى غرفةَ العمل (D-224)، والسطرُ يحمل حلقتَه:
 * المشاركةُ ما كُتبت فيه (الهجرة ٢١٥)، والنشرةُ حلقتَها (`data.s/e`)، **والردُّ يرث جذرَه** — فلا ينفصل ردٌّ عن أصله
 * حين تُختار حلقة. والتصفيةُ في اليد (الخادمُ يرسل الخيطَ كاملاً): «الكل» بلا جلب، وتبديلُ الحلقة في الإطار نفسِه.
 * دوالُّ خالصةٌ يقرؤها الخادمُ (`threadCore`) والتطبيقُ والويب معاً.
 */

export type EpisodeRef = { season: number; episode: number };

type Tagged = { id: string; parent_id: string | null; season?: number | null; episode?: number | null };

const valid = (s: unknown, e: unknown): s is number =>
  Number.isInteger(s) && Number.isInteger(e) && (s as number) >= 0 && (e as number) >= 1;

/** حلقةُ نشرة لوبز من `data` (`s` · `e` — الهجرة ٨٠)، و`null` لغير ذلك */
export function bulletinEpisode(data: Record<string, unknown> | null | undefined): EpisodeRef | null {
  const s = Number(data?.s);
  const e = Number(data?.e);
  return valid(s, e) ? { season: s, episode: e } : null;
}

/**
 * **الردُّ يرث حلقةَ جذره** — تمشي السلسلةَ صعوداً (العمقُ ٣ في الغرفة) وتعيد السطورَ نفسَها بحلقة الجذر.
 * أبٌ غائبٌ عن الخيط (محذوفٌ أو محجوب) ⇒ يبقى الردُّ بما معه.
 */
export function inheritEpisodes<T extends Tagged>(rows: T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const rootOf = (r: T): T => {
    let cur = r;
    for (let i = 0; i < 8 && cur.parent_id; i++) {
      const up = byId.get(cur.parent_id);
      if (!up) break;
      cur = up;
    }
    return cur;
  };
  return rows.map((r) => {
    if (!r.parent_id) return r;
    const root = rootOf(r);
    return { ...r, season: root.season ?? null, episode: root.episode ?? null };
  });
}

/** التصفيةُ بالحلقة المختارة — `null` = «الكل» */
export function rowsOfEpisode<T extends { season?: number | null; episode?: number | null }>(rows: T[], pick: EpisodeRef | null): T[] {
  if (!pick) return rows;
  return rows.filter((r) => r.season === pick.season && r.episode === pick.episode);
}

/** مواسمُ المسلسل من تفاصيل TMDB — الموسمُ صفر (الحلقاتُ الخاصّة) والموسمُ بلا حلقات خارجه */
export function seasonsOf(details: unknown): { season: number; episodes: number }[] {
  const list = (details as { seasons?: { season_number?: number; episode_count?: number }[] } | null)?.seasons;
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => ({ season: Number(x.season_number), episodes: Number(x.episode_count) }))
    .filter((x) => Number.isInteger(x.season) && x.season > 0 && Number.isInteger(x.episodes) && x.episodes > 0)
    .sort((a, b) => a.season - b.season);
}
