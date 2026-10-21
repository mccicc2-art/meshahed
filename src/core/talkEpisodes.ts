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

/* ======================================================================================================================
 * 🆕 R56 — **قائمةُ «الحلقات» من حلقات الموسم نفسِها لا من عددها** (أحمد ٢١ أكتوبر بلقطة ون بيس: «يذكر الحلقات ب 1176 مثال
 * نبيه نفس كذا · نبي عنوان الحلقات ظاهر · نبي صورة الحلقة ظاهره»). كانت القائمةُ ترقّم ١…N من `episode_count`، وTMDB يرقّم
 * بعضَ الأعمال ترقيماً كلّيّاً (الموسم ٢٣ من ون بيس: 1156–1180) — فلا تطابق «شاهدتها» (`s:e` برقم TMDB) ولا نشرةُ الحلقة.
 * الرقمُ الآن `episode_number` كما في صفحة العمل والتتبّع، وما لم يُعرض بعدُ (بلا تاريخ أو تاريخُه بعد اليوم) لا غرفةَ له.
 * ==================================================================================================================== */
export function airedEpisodes<E extends { episode_number: number; air_date: string | null }>(eps: readonly E[], today = new Date().toISOString().slice(0, 10)): E[] {
  return eps.filter((e) => !!e.air_date && e.air_date <= today).sort((a, b) => b.episode_number - a.episode_number);
}

/* «الحلقة 1156» / «Episode 12» عنوانٌ مكرّرٌ من الرقم لا عنوان — TMDB يملأ به ما لم يُترجم؛ أحمد «٢ ب»: لا نعرضه */
const GENERIC_EPISODE_NAME = /^\s*(?:الحلقة|حلقة|episode|ep\.?|épisode|episodio|folge)\s*\d+\s*$/i;
export function episodeTitle(name: string | null | undefined): string | null {
  const s = (name ?? "").trim();
  return s && !GENERIC_EPISODE_NAME.test(s) ? s : null;
}

/* ======================================================================================================================
 * 🆕 R56 — **شارةُ «يعرض الآن» في بطاقة الغرفة** (أحمد ٢١ أكتوبر: «افكر اضيف شيء يوضح انها تعرض الان … يمين تحت داخل ايطار
 * العمل»؛ «ج»: النقطةُ والموعدُ معاً، ويومَ النزول «● Ep 1,181 out»). من مصدرين بلا نداءٍ جديد:
 * - `next`: موعدُ الحلقة القادمة المخزَّن في مكتبة القارئ (`follows.next_air_date`) — اليومُ أو بعده وحدَه.
 * - `out`: نشرةُ لوبز الأخيرة (`data.air`) إن عُرضت اليومَ أو أمس — رقمُها رقمُ TMDB.
 * ونشرةٌ في آخر ١٤ يوماً بلا موعدٍ معروف ⇒ «يعرض الآن» وحدَها. غيرُ ذلك لا شارة — لا نخمّن يوماً.
 * ==================================================================================================================== */
export type RoomAiring = { next: string | null; out: number | null; /** 🆕 R57 — «On break»: لا موعدَ وآخرُ حلقةٍ قبل ١٥–٦٠ يوماً */ pause?: boolean };

const DAY_MS = 86_400_000;
const dayNum = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / DAY_MS);
/* 🆕 R57 — أحمد ٢١ أكتوبر («ليش فقط بلاك كلوفر ايرينق ناو؟ ون بيس؟ تيد لاسو؟»؛ «ب»): «يعرض الآن» يتّسع إلى آخر ٦٠ يوماً،
   وما بين ١٥ و٦٠ يوماً بلا موعدٍ معروف «On break» رماديّة — ون بيس في توقّفٍ لا «انتهى»، ولا يختلط بما تنزل حلقاتُه فعلاً */
const FRESH_DAYS = 14;
const AIRING_DAYS = 60;

export function roomAiring(bulletin: Record<string, unknown> | null | undefined, nextAirDate: string | null | undefined, today: string): RoomAiring | null {
  const air = typeof bulletin?.air === "string" && /^\d{4}-\d{2}-\d{2}/.test(bulletin.air) ? bulletin.air.slice(0, 10) : null;
  const ep = bulletinEpisode(bulletin);
  const next = nextAirDate && /^\d{4}-\d{2}-\d{2}/.test(nextAirDate) && nextAirDate.slice(0, 10) >= today ? nextAirDate.slice(0, 10) : null;
  const ago = air ? dayNum(today) - dayNum(air) : null;
  const out = ep && ago != null && ago >= 0 && ago <= 1 ? ep.episode : null;
  if (next || out != null) return { next, out };
  if (ago == null || ago < 0 || ago > AIRING_DAYS) return null;
  return ago <= FRESH_DAYS ? { next: null, out: null } : { next: null, out: null, pause: true };
}
