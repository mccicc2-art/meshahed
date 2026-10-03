import "server-only";
import { getSeason, getTv, type SeasonDetails } from "@/lib/tmdb";
import { missingAiredEpisodes } from "@/core/progress";
import { getT } from "@/lib/locale";

/**
 * ====== الموسمُ كما يُعرض — قائمةُ TMDB + ما حُسب معروضاً ولم يدخلها بعد (D-1254) ======
 *
 * 🔑 **قارئان بدالّةٍ واحدة** (القاعدة ٦): `/api/season` (الويب) و`/api/v1/title/tv/{id}/season/{n}`
 * (التطبيق) — فلا يقول رأسُ الموسم «٠/١» في سطحٍ ويجد حلقتَه وفي آخرَ لا يجدها.
 *
 * الصفُّ المضاف **عامّ**: «الحلقة N» بلغة القارئ وتاريخُ آخر ما عُرض، بلا صورةٍ ولا مدّة — ويختفي من
 * نفسه حين تدخل الحلقةُ قائمةَ TMDB (لا يُحفظ شيء). `getTv` هنا هو نداءُ صفحة العمل نفسُه (خبيئةٌ
 * واحدة)، وفشلُه يعيد القائمةَ كما هي: الترقيعُ يُحسِّن ولا يُشترط.
 */
export async function getSeasonForView(tvId: number, seasonNumber: number): Promise<SeasonDetails> {
  const season = await getSeason(tvId, seasonNumber);
  if (seasonNumber < 1) return season;
  const tv = await getTv(tvId).catch(() => null);
  if (!tv) return season;
  const missing = missingAiredEpisodes(tv, seasonNumber, season.episodes ?? []);
  if (!missing.length) return season;
  const { t } = await getT();
  const padded = missing.map((m) => ({
    id: 0,
    name: t.episodeNo(m.episode_number),
    overview: "",
    episode_number: m.episode_number,
    season_number: seasonNumber,
    air_date: m.air_date,
    still_path: null,
    runtime: null,
  }));
  return {
    ...season,
    episodes: [...(season.episodes ?? []), ...padded].sort((a, b) => a.episode_number - b.episode_number),
  };
}
