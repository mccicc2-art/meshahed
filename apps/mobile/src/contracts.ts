/**
 * العقودُ المشتركة — **من النواة نفسِها، لا نسخة**. هذا الملفُّ ممرٌّ فقط.
 */
export type { Tag, TitleKind } from "@/core/contracts/tags";
export type { AppError, ErrorCode } from "@/core/contracts/result";
export type {
  TitlePayload,
  TvTitlePayload,
  MovieTitlePayload,
  TitleSeason,
  SeasonPayload,
  SeasonEpisode,
} from "@/core/contracts/title";
export type { LibraryItem, LibraryPayload, LibraryStatus } from "@/core/contracts/library";
export type {
  ToggleEpisodeBody,
  WatchUpToBody,
  SetSeasonBody,
  ToggleMovieBody,
  TrackResult,
} from "@/core/contracts/track";
