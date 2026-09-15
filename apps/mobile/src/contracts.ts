/**
 * العقودُ المشتركة — **من النواة نفسِها، لا نسخة**. هذا الملفُّ ممرٌّ فقط.
 */
export type { Tag, TitleKind } from "@/core/contracts/tags";
export type { AppError, ErrorCode } from "@/core/contracts/result";
export type { PersonPayload, PersonWork, FollowArtistBody, UnfollowArtistBody, ListFromPersonBody, ListFromPersonResult } from "@/core/contracts/person";
export type {
  TitlePayload,
  TvTitlePayload,
  MovieTitlePayload,
  TitleSeason,
  SeasonPayload,
  TitleExtrasPayload,
  TitleCommunityPayload,
  FavoriteBody,
  ListToggleItemBody,
  SeasonEpisode,
} from "@/core/contracts/title";
export type {
  LibraryItem,
  LibraryPayload,
  LibraryStatus,
  LibraryTab,
  LibraryArtist,
  LibraryArtistsPayload,
  LibraryListCard,
  LibraryListsPayload,
  LibraryAutoGroup,
  CreateListBody,
  ListPlaylistBody,
  SaveListBody,
  ToWatchBody,
  HiddenRailsBody,
  QueueItem,
  ListReviewBody,
  ListReviewDeleteBody,
  QueueOrderBody,
  SmartListBody,
  UiStateBody,
} from "@/core/contracts/library";
export type { CuratedCard, CuratedRailKey, CuratedRailPayload, CuratedTab, PersonalCard, PersonalRailsPayload, DiscoverListsPayload, TrailerCard, TrailersRailPayload } from "@/core/contracts/discover";
export type {
  ToggleEpisodeBody,
  WatchUpToBody,
  SetSeasonBody,
  ToggleMovieBody,
  FollowBody,
  UnfollowBody,
  SetDroppedBody,
  DismissBody,
  ShowRefBody,
  RateBody,
  UnrateBody,
  TrackResult,
} from "@/core/contracts/track";
export type {
  HomePayload,
  ContinueItem,
  WeekEpisode,
  StartItem,
  DiscoverPayload,
  DiscoverRail,
  DiscoverCard,
} from "@/core/contracts/home";
