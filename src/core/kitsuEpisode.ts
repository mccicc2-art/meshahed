/**
 * ====== 🆕 حلقةُ Kitsu ⇢ موسمٌ وحلقةٌ في TMDB (أحمد ٢٢ أكتوبر «نبني دعم كيتسو») ======
 *
 * بيانُ إضافة «Anime Kitsu» يعطي كلَّ حلقةٍ رقمين:
 *  - `imdbSeason · imdbEpisode` — مكانُها في **ترقيم IMDb**؛
 *  - `absoluteEpisode` — رقمُها التسلسليُّ في السلسلة كلِّها (حلقاتُ المواسم العاديّة قبلها + رقمُها في مدخل Kitsu).
 *
 * 🔑 **والرقمُ التسلسليُّ أوّلاً، لأنّ TMDB وIMDb يقسمان المواسمَ في الأنمي قسمةً مختلفة**: Bleach في IMDb ستّةَ عشر
 * موسماً، وفي TMDB موسمٌ واحدٌ من ٣٦٦ حلقة ثمّ «حرب الألف عام» موسماً ثانياً — فحلقةُ IMDb «م٢ ح٥» تقع في TMDB على
 * «م٢ ح٥» من حرب الألف عام، وهي حلقةٌ أخرى تماماً. والعدُّ التسلسليُّ على مواسم TMDB العاديّة يصيب في القسمتين.
 * ثمّ ترقيمُ IMDb **إن وُجد موسمُه في TMDB ووسعت حلقاتُه الرقم**؛ وما سوى ذلك `null` — لا إشارةَ أصدقُ من إشارةٍ خاطئة
 * («✓» على حلقةٍ يعلّم ما قبلها كلَّه).
 */
export type TmdbSeason = { season_number?: number | null; episode_count?: number | null };

export type Placed = { season: number; episode: number };

export function placeKitsuEpisode(
  seasons: TmdbSeason[],
  ep: { imdbSeason?: number | null; imdbEpisode?: number | null; absoluteEpisode?: number | null },
): Placed | null {
  const regular = seasons
    .filter((s) => Number.isInteger(s.season_number) && (s.season_number as number) > 0)
    .filter((s) => Number.isInteger(s.episode_count) && (s.episode_count as number) > 0)
    .sort((a, b) => (a.season_number as number) - (b.season_number as number));

  const abs = ep.absoluteEpisode;
  if (Number.isInteger(abs) && (abs as number) >= 1) {
    let left = abs as number;
    for (const s of regular) {
      const count = s.episode_count as number;
      if (left <= count) return { season: s.season_number as number, episode: left };
      left -= count;
    }
    /* أبعدُ من كلِّ ما يعرفه TMDB: حلقةٌ عُرضت قبل أن يضيفها — ننزل إلى ترقيم IMDb بشرطه */
  }

  const season = ep.imdbSeason;
  const episode = ep.imdbEpisode;
  if (!Number.isInteger(season) || !Number.isInteger(episode) || (episode as number) < 1) return null;
  const match = seasons.find((s) => s.season_number === season);
  if (!match || !Number.isInteger(match.episode_count) || (episode as number) > (match.episode_count as number)) return null;
  return { season: season as number, episode: episode as number };
}
