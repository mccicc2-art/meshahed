import "server-only";
import { sortTalkRooms, type TalkSort } from "@/core/talkSort";
import { after } from "next/server";
import type { Locale } from "@/core/i18n";
import {
  getUser,
  getNewsGenStale,
  refreshLoopzNews,
  getTalkBulletinStale,
  refreshTalkBulletins,
  getLoopzNews,
  getCommunityFeed,
  getTalkRooms,
  getMyRoomPins,
  getGlobalRoomPins,
  getAmAdmin,
  pickTalkedAboutRoom,
  getFollows,
  getReactions,
  getFollowingIds,
  getNewsReplyCounts,
  getReviewReplyCounts,
  getPostViewCounts,
  getListReviewSocial,
  getPeopleFeatured,
  getPeopleLeaderboard,
  getPeopleTopReviews,
  getTopSavedListCards,
  type TalkRoom,
  type ListReviewSocial,
} from "@/lib/data";
import { getLibState } from "@/lib/libState";
import { commentViewKey, newsViewKey } from "@/core/postKeys";
import { localizeRows, localizeTalkRooms } from "@/lib/localize";
import { getBatchTranslations } from "@/lib/translate";
import {
  BOARD_ALL,
  BOARD_PREVIEW,
  GUEST_ROOMS,
  LEADERBOARD_POOL,
  type BoardSection,
} from "@/core/communityParams";

/**
 * ====== نواةُ «المجتمع» — ما تقرؤه `/people` وما يعيده `/api/v1/community` (Phase 11-M · M0) ======
 *
 * 🔑 **نهجُ `lib/homeCore.ts` في 11-H حرفاً**: موجاتُ النداءات التي كانت في جسم
 * `app/people/page.tsx` انتقلت إلى هنا **كما هي** — الشروطُ والتوازي والسقوفُ — فالصفحةُ
 * ترسمها JSX والبابُ يعيدها JSON، **ولا نسخةَ ثانيةً من نداءات `lib/data`** (خطّة 11-M §٥).
 * الحججُ الكاملةُ لكلِّ نداءٍ (D-194/D-263/D-276/D-301/D-314/D-360 …) باقيةٌ في تاريخ الصفحة؛
 * هنا سطرُها وحدَه.
 *
 * ⚠️ **للتبويبات الثلاثة في الصفّ وحدَها** (`activity`/`talk`/`people` — D-276: تُرسم معاً
 * فتُقرأ معاً). `?tab=news` و`?tab=all` بلا شريحة (D-219) تبقى في الصفحة.
 */
export async function buildCommunity(o: {
  user: Awaited<ReturnType<typeof getUser>>;
  locale: Locale;
  scope: "all" | "following";
  /** «عرض الكل» لقسمٍ واحد، أو `null` للّوحة */
  allView: BoardSection | null;
  translateOn: boolean;
  talkFollowedOnly: boolean;
  /** 🆕 D-1201 — ترتيبُ «النقاشات» (الغيابُ «الأحدث») */
  talkSort?: TalkSort;
}) {
  const { user, locale, allView } = o;

  const followingFeed = await getCommunityFeed(o.scope);
  const localized = await localizeRows(followingFeed, locale);

  /* ترجمةُ المراجعات بلغة القارئ (D-307) — ولا تُترجَم المحجوبات (D-315) */
  const feedTranslations: Record<string, string> = o.translateOn
    ? await getBatchTranslations(
        localized
          .filter((a) => a.review?.trim() && !a.hasSpoiler)
          .map((a) => ({ id: commentViewKey(a.person.id, a.media_type, a.tmdb_id), text: a.review ?? "" })),
        locale === "ar" ? "ar" : "en",
      )
    : {};

  /* موجةٌ واحدة (D-263): الغرفُ · التثبيتُ · لوحةُ الناس · من أتابع */
  const wantAll = allView !== null;
  const need = (k: BoardSection) => !wantAll || allView === k;
  const [roomsRaw, pinsWave, peopleTab, boardFollowing] = await Promise.all([
    getTalkRooms(40).then((r) => localizeTalkRooms(r, locale)),
    user
      ? Promise.all([getMyRoomPins(), getGlobalRoomPins(), getAmAdmin()])
      : Promise.resolve([null, null, false] as const),
    Promise.all([
      need("featured") ? getPeopleFeatured(90, wantAll ? BOARD_ALL : BOARD_PREVIEW) : [],
      need("top") || need("rising")
        ? getPeopleLeaderboard(wantAll ? LEADERBOARD_POOL.all : LEADERBOARD_POOL.preview)
        : [],
      need("reviews") ? getPeopleTopReviews(30, wantAll ? BOARD_ALL : BOARD_PREVIEW) : [],
      need("lists") ? getTopSavedListCards(7, wantAll ? BOARD_ALL : BOARD_PREVIEW) : [],
    ]),
    getFollowingIds(),
  ]);
  const [pins, globalPins, amAdmin] = pinsWave;

  /* درجتان (D-301/D-314): تثبيتُ لوبز ثمّ تثبيتي ثمّ البقية — 🆕 D-1201: وداخلَ كلِّ درجةٍ بترتيب صاحبها
     (الأحدث · الأكثر تفاعلاً) — `sortTalkRooms` نفسُها التي يرتّب بها التطبيق في يده */
  const pinRank = (r: TalkRoom) => {
    const key = `${r.mediaType}-${r.tmdbId}`;
    if (globalPins?.has(key)) return 2;
    if (pins?.has(key)) return 1;
    return 0;
  };
  const rooms: TalkRoom[] = sortTalkRooms(roomsRaw, o.talkSort ?? "latest", pinRank);

  const [featured, board, topReviews, savedLists] = peopleTab;

  /* العملُ الذي يدور حوله الكلام (D-291) — وللزائر أنشطُ غرفةٍ إجمالاً (D-630) */
  const talkedAboutWeekly = wantAll ? null : pickTalkedAboutRoom(rooms);
  const talkedAbout =
    talkedAboutWeekly ??
    (!user && !wantAll && rooms.length ? rooms.reduce((best, r) => (r.posts > best.posts ? r : best)) : null);
  /* يُقاس القسمُ بما يعرضه هو (D-181) */
  const peopleEmpty =
    allView === "rising"
      ? board.every((r) => r.total - r.prevTotal <= 0)
      : featured.length === 0 && board.length === 0 && topReviews.length === 0;

  const genNews = await getLoopzNews(12);

  /* حالةُ «+ للمشاهدة» ومكتبتي (D-205/D-850) */
  const followed = new Set((await getFollows()).map((f) => `${f.media_type}-${f.tmdb_id}`));
  const libState = await getLibState().catch(() => undefined);

  /* «أعمالي المتابَعة فقط» (D-306) · والزائرُ أفضلُ خمسٍ (D-628) */
  const roomsFiltered =
    o.talkFollowedOnly && user ? rooms.filter((r) => followed.has(`${r.mediaType}-${r.tmdbId}`)) : rooms;
  const roomsShown = user
    ? roomsFiltered
    : [...roomsFiltered].sort((a, b) => b.postsWeek - a.postsWeek || b.posts - a.posts).slice(0, GUEST_ROOMS);

  const postLikes = genNews.length
    ? await getReactions(genNews.map((n) => n.tmdb_id))
    : { counts: {} as Record<string, number>, mine: new Set<string>() };

  const followingIds = await getFollowingIds();

  /* نشرةُ لوبز لمن يهمّه خبرُها (D-360): مكتبتي ومن أتابعهم؛ ومن لا إشارةَ له يرى الكلّ */
  const talkedByFriends = new Set(
    localized
      .filter((a) => a.tmdb_id && a.person?.id && followingIds.has(a.person.id))
      .map((a) => `${a.media_type}-${a.tmdb_id}`),
  );
  const hasTasteSignal = followed.size > 0 || talkedByFriends.size > 0;
  const newsForMe = hasTasteSignal
    ? genNews.filter((n) => {
        const key = `${n.media_type}-${n.tmdb_id}`;
        return followed.has(key) || talkedByFriends.has(key);
      })
    : genNews;

  const newsReplies = genNews.length
    ? await getNewsReplyCounts(genNews.map((n) => n.key))
    : new Map<string, number>();
  const reviewReplies = await getReviewReplyCounts(
    localized.filter((a) => a.review?.trim()).map((a) => commentViewKey(a.person.id, a.media_type, a.tmdb_id)),
  );
  const listSocial: Map<string, ListReviewSocial> = await getListReviewSocial([
    ...new Set(localized.map((a) => a.listId).filter(Boolean) as string[]),
  ]);
  const viewCounts = await getPostViewCounts([
    ...localized
      .filter((a) => a.review?.trim())
      .map((a) => commentViewKey(a.person.id, a.media_type, a.tmdb_id)),
    ...genNews.map((n) => newsViewKey(n.key)),
  ]);

  return {
    localized,
    feedTranslations,
    rooms,
    roomsShown,
    pins,
    globalPins,
    amAdmin,
    featured,
    board,
    topReviews,
    savedLists,
    boardFollowing,
    talkedAbout,
    peopleEmpty,
    genNews,
    newsForMe,
    followed,
    libState,
    postLikes,
    followingIds,
    newsReplies,
    reviewReplies,
    listSocial,
    viewCounts,
  };
}

export type CommunityData = Awaited<ReturnType<typeof buildCommunity>>;

/**
 * **التجديدُ بحركة المرور** (D-210/D-215/D-261): دورةُ رصد الأخبار ونشرةُ الغرف بعد إرسال
 * الردّ — فلا ينتظرها قارئ. **والبابُ يطرقها كالصفحة** كي لا يبقى مجتمعُ التطبيق بلا تجديد.
 * `pagerTab` يحرس الأولى كما كانت في الصفحة؛ والثانيةُ لكلِّ فتحة.
 */
export async function refreshCommunityAfter(pagerTab: boolean) {
  if (pagerTab && (await getNewsGenStale(10))) after(() => refreshLoopzNews());
  if (await getTalkBulletinStale(180)) after(() => refreshTalkBulletins());
}
