/**
 * ====== عقدُ صفحة العمل — `GET /api/v1/title/{kind}/{id}` ======
 *
 * 🔑 **النوعُ هو الوثيقة** (Phase 9 §4.3 القاعدة ٣): يُستورد من الخادم
 * (ليُلزَم به الردّ) ومن التطبيق (ليُقرأ به) — **ولا OpenAPI منفصلٌ يشيخ.**
 *
 * ⚠️ **مكتوبٌ صراحةً لا مشتقٌّ من دالّة الخادم**: التطبيقُ لا يستطيع
 * استيرادَ `route.ts` (Next خادميّ)، **والعقدُ الذي لا يقرؤه الطرفان
 * ليس عقداً.** مفاتيحُ TMDB الخام (`poster_path`…) تبقى بأسمائها لأنّ
 * `core/media.ts` هو من يركّب منها روابطَ الصور — في المنصّتين.
 */

import type { TitleKind } from "./tags.ts";

export type TitleSeason = {
  season_number: number;
  name: string;
  episode_count: number;
  /** ما بُثّ فعلاً — قاعدةُ D-603 للترقيم المطلق تُطبَّق في الخادم */
  aired: number;
  poster_path: string | null;
  air_date: string | null;
};

type TitleBase = {
  id: number;
  name: string;
  original_name: string | null;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  status: string;
  genres: { id: number; name: string }[];
  vote_average: number;
  trailer_key: string | null;
};

export type TvTitlePayload = TitleBase & {
  kind: Extract<TitleKind, "tv">;
  first_air_date: string | null;
  episode_run_time: number | null;
  next_episode_to_air: {
    season_number: number;
    episode_number: number;
    air_date: string | null;
    name: string;
  } | null;
  seasons: TitleSeason[];
  aired_total: number;
  /** حالتي — فارغةٌ للزائر لا مرفوضة (D-892) */
  me: {
    following: boolean;
    dropped: boolean;
    watched_count: number;
    /** مفاتيحُ `episodeKey(season, episode)` — نفسُ شكل الويب */
    watched: string[];
    /** 🆕 D-919 — تقييمي من ١٠، أو null */
    rating: number | null;
  };
};

export type MovieTitlePayload = TitleBase & {
  kind: Extract<TitleKind, "movie">;
  release_date: string | null;
  runtime: number | null;
  me: {
    following: boolean;
    dropped: boolean;
    watched: boolean;
    progress: unknown;
    /** 🆕 D-919 — تقييمي من ١٠، أو null */
    rating: number | null;
  };
};

export type TitlePayload = TvTitlePayload | MovieTitlePayload;

/** `GET /api/v1/title/tv/{id}/season/{n}` */
export type SeasonEpisode = {
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  /** حالتي — `false` دائماً للزائر */
  watched: boolean;
};

export type SeasonPayload = {
  tv_id: number;
  season_number: number;
  episodes: SeasonEpisode[];
};
