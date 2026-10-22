/**
 * ====== 🆕 حلقةُ Kitsu ⇢ موسمٌ وحلقةٌ في TMDB (أحمد ٢٢ أكتوبر «نبني دعم كيتسو»، ثمّ «أ نفذ») ======
 *
 * ⚖️ **المصدرُ جدولُ الربط المنشور لا بيانُ الإضافة الحيّ** (R74): خادمُ «Anime Kitsu» يحجب الخوادمَ السحابيّة (سطرُ
 * التشخيص قال `meta_http_403` حتى بهويّة Loopz — R73)، وجدولُها نفسُه منشورٌ على GitHub برخصة Apache-2.0
 * (`static/data/imdb_mapping.json`): لكلِّ مدخلٍ رقمُ IMDb ومن أيِّ موسمٍ وحلقةٍ يبدأ في ترقيم IMDb.
 *
 * والحسابُ حسابُ الإضافة نفسِها (`enrichKitsuEpisodes` عندهم) بلا بيان IMDb:
 *  1. `imdbEpisodes` (قائمةٌ صريحة — ترقيمٌ خارجَ التسلسل) ⇐ الحلقةُ منها، في `fromSeason`؛
 *  2. وإلّا: `fromEpisode − 1 + الحلقة` في `fromSeason`، مطروحاً منها ما قبلها من `nonImdbEpisodes` (حلقاتٌ لا يعدّها IMDb)،
 *     والحلقةُ نفسُها إن كانت منها ⇐ لا شيء.
 * ثمّ **نُرحِّلها على مواسم TMDB** (`placeOnTmdb`): مسلسلٌ طويلٌ يُرقَّم في الجدول تسلسليّاً من موسمه (One Piece «م١ ح١٠٠٠»)،
 * وTMDB يقسمه مواسم — فما فاض عن الموسم ينتقل إلى ما بعده. وموسمٌ لا يعرفه TMDB ⇐ `null`: لا إشارةَ أصدقُ من إشارةٍ خاطئة
 * («✓» على حلقةٍ يعلّم ما قبلها كلَّه).
 */
export type KitsuMapEntry = {
  kitsu_id: number;
  imdb_id?: string | null;
  fromSeason?: number | null;
  fromEpisode?: number | null;
  imdbEpisodes?: (number | null)[] | null;
  nonImdbEpisodes?: number[] | null;
};

export type TmdbSeason = { season_number?: number | null; episode_count?: number | null };

export type Placed = { season: number; episode: number };

const int = (n: unknown): n is number => Number.isInteger(n);

/** حلقةُ Kitsu رقم `ep` في ترقيم IMDb حسب المدخل */
export function imdbEpisodeOf(entry: KitsuMapEntry, ep: number): Placed | null {
  if (!int(ep) || ep < 1) return null;
  const season = int(entry.fromSeason) ? entry.fromSeason : 1;
  if (Array.isArray(entry.imdbEpisodes)) {
    const e = entry.imdbEpisodes[ep - 1];
    return int(e) && e >= 1 ? { season, episode: e } : null;
  }
  const skipped = Array.isArray(entry.nonImdbEpisodes) ? entry.nonImdbEpisodes : [];
  if (skipped.includes(ep)) return null;
  const before = skipped.filter((n) => int(n) && n < ep).length;
  const start = int(entry.fromEpisode) && entry.fromEpisode >= 1 ? entry.fromEpisode : 1;
  return { season, episode: start - 1 + ep - before };
}

/** ترقيمٌ يبدأ من موسمٍ ⇢ موسمُ TMDB وحلقتُه: يفيض إلى المواسم العاديّة التالية؛ والخاصُّ (٠) لا يفيض */
export function placeOnTmdb(seasons: TmdbSeason[], at: Placed): Placed | null {
  const count = (n: number) => {
    const s = seasons.find((x) => x.season_number === n);
    return s && int(s.episode_count) && s.episode_count > 0 ? s.episode_count : null;
  };
  let season = at.season;
  let episode = at.episode;
  if (!int(season) || !int(episode) || episode < 1) return null;
  let have = count(season);
  if (have === null) return null;
  if (season === 0) return episode <= have ? { season, episode } : null;
  const later = seasons
    .map((s) => s.season_number)
    .filter((n): n is number => int(n) && n > season)
    .sort((a, b) => a - b);
  while (episode > have) {
    const next = later.shift();
    if (next === undefined) return null;
    episode -= have;
    season = next;
    have = count(season);
    if (have === null) return null;
  }
  return { season, episode };
}

/**
 * 🆕 R75 — **المطابقةُ بتاريخ العرض** حين لا يتّفق التقسيم (أحمد «أ نفذ»): «حرب الألف عام» في IMDb أجزاءٌ أربعة، وفي TMDB
 * موسمٌ واحدٌ يجمعها (السجلّ: `imdbAt` م٤ و`seasons: 1`) — فلا يُعرف «م٤ ح١» برقمه. لكنّ يومَ العرض واحدٌ في المصادر كلّها:
 * تاريخُ الحلقة من Kitsu الرسميّ ⇐ الحلقةُ التي عُرضت يومَها في هذا العمل عند TMDB.
 * ⚖️ **حلقةٌ واحدةٌ أو لا شيء**: يومٌ عُرضت فيه حلقتان (عرضٌ مزدوج) ⇐ `null`، وإلّا لعُلِّمت الثانية قبل وقتها. ويومٌ قبله أو
 * بعده يُقبل حين لا يطابق اليومُ نفسُه شيئاً — فارقُ التوقيت بين اليابان وتاريخ TMDB — بشرط الوحدة نفسِه.
 */
export type DatedEpisode = { season: number; episode: number; air_date?: string | null };

const DAY_MS = 86_400_000;

export function matchByAirDate(episodes: DatedEpisode[], airdate: string): Placed | null {
  const day = Date.parse(`${airdate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(airdate) || !Number.isFinite(day)) return null;
  const regular = episodes.filter((e) => int(e.season) && e.season > 0 && int(e.episode) && typeof e.air_date === "string");
  const on = (offset: number) => {
    const want = new Date(day + offset * DAY_MS).toISOString().slice(0, 10);
    return regular.filter((e) => e.air_date === want);
  };
  for (const hits of [on(0), [...on(-1), ...on(1)]]) {
    if (hits.length === 1) return { season: hits[0].season, episode: hits[0].episode };
    if (hits.length > 1) return null;
  }
  return null;
}
