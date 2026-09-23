/**
 * العقودُ المشتركة — **من النواة نفسِها، لا نسخة**. هذا الملفُّ ممرٌّ فقط.
 */
export type { Tag, TitleKind } from "@/core/contracts/tags";
export type { AppError, ErrorCode } from "@/core/contracts/result";
export type { ProvidersPayload, SavedFilterBody, SavedFilterResult, SectionPayload, DiscoverViewPayload, MyRowsBody } from "@/core/contracts/discover";
export type { PersonPayload, PersonWork, FollowArtistBody, UnfollowArtistBody, ListFromPersonBody, ListFromPersonResult } from "@/core/contracts/person";
export type {
  TitlePayload,
  TvTitlePayload,
  MovieTitlePayload,
  TitleSeason,
  SeasonPayload,
  TitleExtrasPayload,
  TitleArtOptionsPayload,
  TitleArtBody,
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
  ListDetailPayload,
  ListDetailItem,
  ListUpdateBody,
  ListDeleteBody,
  ListReorderBody,
  ListCoverBody,
  ListReviewLikeBody,
  ListReviewReplyBody,
  ListReplyDeleteBody,
  ListReplyRow,
  /* Phase 11-G · G5/G6 */
  SmartRuleBody,
  ShareFriendBody,
  CommunityPostBody,
  FriendsPayload,
  FollowsPayload,
  CommunitiesPayload,
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
  EpisodeRateBody,
  ShowRefBody,
  RateBody,
  UnrateBody,
  TrackResult,
  ShowWatchedResult,
  UnmarkEpisodesBody,
} from "@/core/contracts/track";
/* Phase 11-H — الرئيسيةُ الأصليّة: الويبُ بحذافيره عبر عقد `v1` (D-1066) */
export type {
  HomePayload,
  HomeExtrasPayload,
  HomeHeaderPayload,
  HomeStat,
  HomeContinueCard,
  HomeListNext,
  HomeMixedCard,
  HomeShowCard,
  HomeMovieCard,
  HomeRatedCard,
  HomeFriendCard,
  HomeTrendCard,
  HomeWeekDay,
  HomeWeekEntry,
  HomeQueueItem,
  HomeToWatchQueueCard,
  HomeViewBody,
  HomeOrderBody,
  DiscoverPayload,
  DiscoverRail,
  DiscoverCard,
} from "@/core/contracts/home";
/* Phase 11-G — البحثُ الأصليّ: الحمولةُ حمولةُ الويب نفسُها (`searchTypes.ts`) عبر عقد `v1` */
export type { SearchScope, SearchTitle, SearchArtist, SearchList, SearchPayload, SearchStoryBody, SearchStoryItem, SearchStoryPayload } from "@/core/contracts/search";
