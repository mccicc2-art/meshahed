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
  /** D-988 — أوّلُ رقمِ حلقةٍ في الموسم (`firstEpisodeOf`): ١ عادةً، ونافذةُ الموسم في الترقيم المطلق —
      كي لا يكتب «حتى هنا» عبر المواسم أرقاماً لا تطابق حلقةً (أشباحُ خالد، D-603) */
  first_episode: number;
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
  /**
   * 🆕 D-1011 — **تقييمُ IMDb للحلقة**: يُطلب بـ`?r=1` كما تطلبه صفحةُ الويب
   * (`/api/season?r=1`) — رحلةٌ إلى OMDb لكلِّ موسم، فلا تُدفع إلا حين يفتح
   * المستخدمُ التقييمات. `undefined` = لم تُطلب؛ `null` = طُلبت ولا رقم.
   */
  imdb_rating?: number | null;
  /** تقييمي لهذه الحلقة — من `episode_ratings_of`، فارغٌ للزائر */
  my_rating?: number | null;
  /** تعليقي عليها (D-1015) */
  my_review?: string | null;
};

export type SeasonPayload = {
  tv_id: number;
  season_number: number;
  episodes: SeasonEpisode[];
};

/* ====== ملحقاتُ صفحة العمل — Phase 11-D · D2/D3 (D-956) ====== */

/** `GET /api/v1/title/{kind}/{id}/extras` — كلُّ ما حول البطل في ردٍّ ثانٍ خفيف */
export type TitleExtrasPayload = {
  ratings: { imdb: string | null; rt: string | null; rated: string | null } | null;
  pulse: { hearts: number; votes: number; avg: number };
  /** أين يُشاهَد — منطقةُ القارئ ومزوّدوها بروابطهم (إن وُجدت) */
  watch: {
    region: string;
    groups: { key: "flatrate" | "free" | "rent" | "buy"; providers: { id: number; name: string; logo_path: string | null; link: string | null }[] }[];
  } | null;
  cast: { id: number; name: string; character: string | null; profile_path: string | null }[];
  collection: { id: number; name: string; parts: { id: number; title: string; poster_path: string | null; year: string | null }[] } | null;
  related: { kind: TitleKind; id: number; title: string; poster_path: string | null; year: string | null }[];
  /** قوائمي العاديّة (لا الذكيّة) وما يحوي هذا العملَ منها — لورقة «إلى قائمة» */
  my_lists: { id: string; name: string }[];
  containing: string[];
  favorite: boolean;
};

/** `GET /api/v1/title/{kind}/{id}/community` — تبويبُ المجتمع للقراءة؛ الكتابةُ في الويب (`/talk`) */
export type TitleCommunityPayload = {
  my_review: { rating: number; review: string | null; has_spoiler: boolean } | null;
  reviews: {
    user_id: string;
    name: string;
    username: string | null;
    avatar_url: string | null;
    rating: number;
    review: string | null;
    has_spoiler: boolean;
    updated_at: string;
    likes: number;
    replies: number;
    mine: boolean;
  }[];
  /** نشراتُ لوبز وأخبارُه بلغة القارئ — سطرٌ وتاريخ (`bulletinLine` · `newsLine`) */
  bulletins: { line: string; at: string; replies: number }[];
  talk_path: string;
};

/** `POST /api/v1/track/favorite` — تبديلُ المفضّل؛ يعود بالحالة الحقيقيّة */
export type FavoriteBody = { tmdbId: number; mediaType: TitleKind; title: string; posterPath: string | null };
/** `POST /api/v1/lists/toggle-item` — إضافةُ عملٍ إلى قائمةٍ أو نزعُه */
export type ListToggleItemBody = { listId: string; tmdbId: number; mediaType: TitleKind; title: string; posterPath: string | null; add: boolean };
