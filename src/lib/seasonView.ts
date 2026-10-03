import "server-only";
import { getSeason, getTv, type SeasonDetails } from "@/lib/tmdb";
import { missingAiredEpisodes } from "@/core/progress";
import { getLocale } from "@/lib/locale";
import { episodeDisplayName, episodeWordName } from "@/core/episodeName";

/**
 * ====== الموسمُ كما يُعرض — قائمةُ TMDB + ما حُسب معروضاً ولم يدخلها بعد (D-1254) ======
 *
 * 🔑 **قارئان بدالّةٍ واحدة** (القاعدة ٦): `/api/season` (الويب) و`/api/v1/title/tv/{id}/season/{n}`
 * (التطبيق) — فلا يقول رأسُ الموسم «٠/١» في سطحٍ ويجد حلقتَه وفي آخرَ لا يجدها.
 *
 * الصفُّ المضاف **عامّ**: «الحلقة الأولى» بلغة القارئ (D-1255) وتاريخُ آخر ما عُرض، بلا صورةٍ ولا مدّة — ويختفي من
 * نفسه حين تدخل الحلقةُ قائمةَ TMDB (لا يُحفظ شيء). `getTv` هنا هو نداءُ صفحة العمل نفسُه (خبيئةٌ
 * واحدة)، وفشلُه يعيد القائمةَ كما هي: الترقيعُ يُحسِّن ولا يُشترط.
 */
export async function getSeasonForView(tvId: number, seasonNumber: number): Promise<SeasonDetails> {
  const raw = await getSeason(tvId, seasonNumber);
  const locale = (await getLocale()) === "en" ? "en" : "ar";
  /* 🆕 D-1255 — الاسمُ العامُّ («Episode N»/«الحلقة N») يُكتب بالحروف وبلغة القارئ؛ الحقيقيُّ كما هو —
     و«Episode 3» عنواناً فعليّاً (سجلٌّ مملوء) يبقى كما هو (أحمد). الفارقُ في `isGenericEpisodeName`. */
  const season: SeasonDetails = {
    ...raw,
    episodes: (raw.episodes ?? []).map((e) => ({ ...e, name: episodeDisplayName(e.name, e.episode_number, locale, e) })),
  };
  if (seasonNumber < 1) return season;
  const tv = await getTv(tvId).catch(() => null);
  if (!tv) return season;
  const missing = missingAiredEpisodes(tv, seasonNumber, season.episodes);
  if (!missing.length) return season;
  const padded = missing.map((m) => ({
    id: 0,
    name: episodeWordName(m.episode_number, locale),
    overview: "",
    episode_number: m.episode_number,
    season_number: seasonNumber,
    air_date: m.air_date,
    still_path: null,
    runtime: null,
  }));
  return {
    ...season,
    episodes: [...season.episodes, ...padded].sort((a, b) => a.episode_number - b.episode_number),
  };
}
