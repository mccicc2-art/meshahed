/**
 * ====== عقودُ التتبّع — `POST /api/v1/track/*` ======
 *
 * 🔑 **أربعةُ مساراتٍ لا مسارٌ بعلَم** (القاعدة ٦ في المستودع: علَمٌ يقلب
 * الردَّ كلَّه بابٌ لخطأٍ صامت). كلُّ مسارٍ جسمٌ واحدٌ وردٌّ واحد.
 *
 * 🔑 **الأجسامُ تطابق مدخلاتِ `actions.ts` حرفاً** — لا ترجمةَ في الغلاف،
 * فلا موضعَ يفترق فيه التطبيقُ عن الويب في معنى حقل.
 */

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
