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
  const d = details as {
    seasons?: { season_number?: number; episode_count?: number }[];
    last_episode_to_air?: { season_number?: number; episode_number?: number } | null;
  } | null;
  const list = d?.seasons;
  if (!Array.isArray(list)) return [];
  const all = list
    .map((x) => ({ season: Number(x.season_number), episodes: Number(x.episode_count) }))
    .filter((x) => Number.isInteger(x.season) && x.season > 0 && Number.isInteger(x.episodes) && x.episodes > 0)
    .sort((a, b) => a.season - b.season);
  /* 🆕 R52 — **ما عُرض فقط**: `episode_count` عددُ الموسم المُعلن كلِّه، فكانت «الحلقات» تعرض ٢٦ حلقةً للموسم الثاني
     ولم ينزل منه إلّا ٣ (بلاغُ أحمد ٢١ أكتوبر). «آخرُ حلقةٍ عُرضت» من TMDB تقصّ موسمَها وتُسقط ما بعده؛
     و`null` صريحاً = لم يُعرض شيءٌ بعد فلا غرف. وغيابُ الحقل (تفاصيلُ ناقصة) يُبقي المُعلنَ — أهونُ من قائمةٍ فارغة */
  if (!d || !("last_episode_to_air" in d)) return all;
  const last = d.last_episode_to_air;
  const ls = Number(last?.season_number);
  const le = Number(last?.episode_number);
  if (!Number.isInteger(ls) || ls < 1 || !Number.isInteger(le) || le < 1) return [];
  return all.filter((x) => x.season <= ls).map((x) => (x.season === ls ? { ...x, episodes: Math.min(x.episodes, le) } : x));
}

/* ======================================================================================================================
 * 🆕 D-1508 — **غرفةُ العمل بمستويين: «عام» و«الحلقات»** (أحمد ٢١ أكتوبر: «عام اذا بيتكلمون عن المسلسل بشكل عام ويناقشونه سوى ..
 * حلقات لحلقة حلقة»). الخيطُ ما زال كاملاً من الخادم والتقسيمُ في اليد — دوالُّ خالصةٌ للتطبيق والويب:
 * - **«عام»**: كلامُ الناس بلا حلقة — نشراتُ لوبز («نزلت الحلقة…») خرجت منه، وصارت رأسَ غرفة حلقتها.
 * - **غرفةُ الحلقة**: مشاركاتُها وردودُها؛ الردُّ الذي كُتب تحت النشرة (قبل هذا التقسيم) يصعد جذراً فيها.
 * - **«الحلقات»**: عددُ ما قيل في كلِّ حلقة (جذورٌ وردود) ووقتُ آخره.
 * ==================================================================================================================== */
type TalkRow = Tagged & { bulletin?: string | null; created_at?: string };

/** مفتاحُ الحلقة — `episodeKey` نفسُه (`s:e`) كي يُقارن بما شاهده القارئ */
export const talkEpisodeKey = (season: number, episode: number) => `${season}:${episode}`;

/** «عام»: ما لا حلقةَ له، بلا نشرات (والردُّ يرث جذرَه فلا يتسرّب ردٌّ على نشرة) */
export function generalRows<T extends TalkRow>(rows: T[]): T[] {
  return rows.filter((r) => !r.bulletin && (r.season == null || r.episode == null));
}

/** غرفةُ الحلقة: مشاركاتُها بلا النشرة، وما كان ردّاً على النشرة يصير جذراً */
export function episodeRoomRows<T extends TalkRow>(rows: T[], pick: EpisodeRef): T[] {
  const mine = rowsOfEpisode(rows, pick);
  const bulletins = new Set(mine.filter((r) => r.bulletin).map((r) => r.id));
  return mine.filter((r) => !r.bulletin).map((r) => (r.parent_id && bulletins.has(r.parent_id) ? { ...r, parent_id: null } : r));
}

export type EpisodeStat = { count: number; last: string | null };

/** عددُ ما قيل في كلِّ حلقة (بلا النشرات) ووقتُ آخره */
export function episodeStats<T extends TalkRow>(rows: T[]): Map<string, EpisodeStat> {
  const out = new Map<string, EpisodeStat>();
  for (const r of rows) {
    if (r.bulletin || r.season == null || r.episode == null) continue;
    const k = talkEpisodeKey(r.season, r.episode);
    const cur = out.get(k) ?? { count: 0, last: null };
    cur.count += 1;
    if (r.created_at && (!cur.last || r.created_at > cur.last)) cur.last = r.created_at;
    out.set(k, cur);
  }
  return out;
}

/** نشرةُ الحلقة (رأسُ غرفتها) — الأحدثُ إن تكرّرت */
export function episodeBulletin<T extends TalkRow>(rows: T[], pick: EpisodeRef): T | null {
  let best: T | null = null;
  for (const r of rows) {
    if (!r.bulletin || r.season !== pick.season || r.episode !== pick.episode) continue;
    if (!best || (r.created_at ?? "") > (best.created_at ?? "")) best = r;
  }
  return best;
}

/** آخرُ حلقةٍ نشرها لوبز — سطرُ «آخر حلقة» في رأس «عام» */
export function latestBulletin<T extends TalkRow>(rows: T[]): (T & { season: number; episode: number }) | null {
  let best: T | null = null;
  for (const r of rows) {
    if (!r.bulletin || r.season == null || r.episode == null) continue;
    if (!best || r.season! > best.season! || (r.season === best.season && r.episode! > best.episode!)) best = r;
  }
  return best as (T & { season: number; episode: number }) | null;
}
