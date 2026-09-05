/**
 * ====== عقودُ التتبّع — `POST /api/v1/track/*` ======
 *
 * 🔑 **أربعةُ مساراتٍ لا مسارٌ بعلَم** (القاعدة ٦ في المستودع: علَمٌ يقلب
 * الردَّ كلَّه بابٌ لخطأٍ صامت). كلُّ مسارٍ جسمٌ واحدٌ وردٌّ واحد.
 *
 * 🔑 **الأجسامُ تطابق مدخلاتِ `actions.ts` حرفاً** — لا ترجمةَ في الغلاف،
 * فلا موضعَ يفترق فيه التطبيقُ عن الويب في معنى حقل.
 */

import type { TitleKind } from "./tags.ts";

export type EpisodeRef = { season: number; episode: number; runtime: number | null };

/** `POST /track/episode` — تبديلُ حلقةٍ واحدة */
export type ToggleEpisodeBody = {
  showTmdbId: number;
  season: number;
  episode: number;
  runtime: number | null;
  watched: boolean;
  title?: string | null;
  posterPath?: string | null;
};

/** `POST /track/watch-up-to` — كلُّ ما قبل هذه الحلقة (وهي معها) */
export type WatchUpToBody = {
  showTmdbId: number;
  episodes: EpisodeRef[];
  title?: string | null;
  posterPath?: string | null;
};

/** `POST /track/season` — موسمٌ كاملٌ: شوهد أو لم يُشاهَد */
export type SetSeasonBody = {
  showTmdbId: number;
  episodes: EpisodeRef[];
  watched: boolean;
  title?: string | null;
  posterPath?: string | null;
};

/** `POST /track/movie` */
export type ToggleMovieBody = {
  movieTmdbId: number;
  runtime: number | null;
  watched: boolean;
};

/** ردُّ كلِّ كتابةِ تتبّع — لا بياناتَ، الوسومُ هي الردّ */
export type TrackResult = { done: true };

/**
 * 🆕 D-916 — المتابعةُ من التطبيق. بلا «تابِع» كان الطريقُ الوحيدُ إلى
 * المكتبة أن تشاهد حلقةً؛ فيلمٌ «للمشاهدة لاحقاً» لم يكن له باب.
 * الأجسامُ تطابق `follow`/`unfollow`/`setDropped` في `actions.ts` حرفاً.
 */

/** `POST /track/follow` — إلى المكتبة (للمشاهدة) */
export type FollowBody = {
  tmdbId: number;
  mediaType: TitleKind;
  title: string;
  posterPath: string | null;
};

/** `POST /track/unfollow` — من المكتبة */
export type UnfollowBody = { tmdbId: number; mediaType: TitleKind };

/** `POST /track/dropped` — البطاقةُ الحمراء أو رفعُها؛ يبقى في المكتبة */
export type SetDroppedBody = { tmdbId: number; mediaType: TitleKind; dropped: boolean };

/** 🆕 D-919 — `POST /track/rate` و`/track/unrate`: تطابق `saveRating`/`deleteRating` */
export type RateBody = {
  tmdbId: number;
  mediaType: TitleKind;
  rating: number;
  review: string;
  title: string;
  posterPath: string | null;
};
export type UnrateBody = { tmdbId: number; mediaType: TitleKind };
