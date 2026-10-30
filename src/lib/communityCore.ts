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
  getFollowedPersonaFeed,
  getTalkRooms,
  getGeneralRoom,
  getTalkFeed,
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
  type TalkFeedPost,
  type ListReviewSocial,
} from "@/lib/data";
import { getLibState } from "@/lib/libState";
import { commentViewKey, newsViewKey } from "@/core/postKeys";
import { isPersonaId } from "@/core/personas";
import { mergeFeedStreams } from "@/core/feedMerge";
import { localizeRows, localizeTalkRooms } from "@/lib/localize";
import { getBatchTranslations } from "@/lib/translate";
import {
  BOARD_ALL,
  BOARD_PREVIEW,
  GUEST_ROOMS,
  LEADERBOARD_POOL,
  type BoardSection,
} from "@/core/communityParams";

/** 🆕 R56 — سقفُ غرف «مكتبتي» الفارغة في الردّ (مكتبةُ ألف عملٍ لا تُرسل ألفَ بطاقة) */

/** 🆕 D-1605 — سقفُ الخطّ الأوّل في `community_activity`/`following_activity_v2` بلا معاملات (الهجرة ٢٢٧ لم تغيّره) */
const FIRST_PAGE = 60;
/** 🆕 D-1605 — مراجعاتُ الشخصيّات المتابَعة في كلِّ صفحة (`followed_persona_reviews`) */
const PERSONA_PAGE = 30;

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
  /** 🆕 R58 — منشوراتُ النقاش في الأنشطة و«النقاش العام» — لتطبيقٍ يعرفهما (`?talk=1`) */
  talk?: boolean;
  /** 🆕 D-1605 — مراجعاتُ شخصيّات لوبز AI التي يتابعها القارئ في الخطّ — لمن يعرفها (`personasAware`؛ الويبُ دائماً) */
  personas?: boolean;
}) {
  const { user, locale, allView } = o;

  const firstOut = { raw: 0 };
  const [memberFeed, personaFeed] = await Promise.all([
    getCommunityFeed(o.scope, undefined, firstOut),
    user && o.personas ? getFollowedPersonaFeed(null, PERSONA_PAGE) : Promise.resolve([]),
  ]);
  /* 🆕 D-1605 — **منبعان بمؤشّرٍ واحد** (`mergeFeedStreams`): الخطُّ الأوّلُ سقفُه ٦٠، فما كان من مراجعات الشخصيّات أقدمَ من آخر
     صفٍّ فيه ينتظر صفحتَه — وإلّا قفز «الأقدم» في التطبيق فوق ما لم يُجلب */
  const followingFeed = mergeFeedStreams(memberFeed, firstOut.raw >= FIRST_PAGE, personaFeed, personaFeed.length >= PERSONA_PAGE).items;
  const localized = await localizeRows(followingFeed, locale);

  /* ترجمةُ المراجعات بلغة القارئ (D-307) — ولا تُترجَم المحجوبات (D-315) — 🆕 D-1605 ولا مراجعاتُ الشخصيّات: نصُّها بلغة القارئ أصلاً */
  const feedTranslations: Record<string, string> = o.translateOn
    ? await getBatchTranslations(
        localized
          .filter((a) => a.review?.trim() && !a.hasSpoiler && a.kind !== "ep_rate" && !isPersonaId(a.person.id))
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
  const follows = await getFollows();
  const followed = new Set(follows.map((f) => `${f.media_type}-${f.tmdb_id}`));
  /* 🆕 R56 — موعدُ الحلقة القادمة المخزَّن في المكتبة (شارةُ «يعرض الآن») — بلا نداء TMDB */
  const nextAir = new Map(follows.filter((f) => f.media_type === "tv" && f.next_air_date).map((f) => [`tv-${f.tmdb_id}`, f.next_air_date as string]));
  /* 🆕 R56 → 🗑️ D-1596 — **لا غرفَ فارغةً في القائمة** (أحمد ٣٠ أكتوبر: «النقاشات ٠ مشاركة اخفيها وتظهر للشخص إذا بحث عنها» — «٣ أ»):
     كانت كلُّ أعمال المكتبة بلا غرفةٍ (حتى ١٥٠) تُرسل بطاقاتٍ «٠ مشاركة» تزحم «مكتبتي» وتثقل الردّ. البحثُ (`TalkSearch`) يبحث في
     الأعمال كلِّها لا في الحمولة، فالغرفةُ الفارغةُ تُفتح منه ومن صفحة العمل كما كانت. الحقلُ يبقى في العقد فارغاً لنسخٍ أقدم */
  const libraryRooms: TalkRoom[] = [];
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
  /* 🆕 R58 — أحمد «٤ أ»: القلمُ دائماً، والغرفةُ إذا نشطت — للمسجَّل (الزائرُ لا يرى خطَّ الأصدقاء أصلاً) */
  const [talkFeed, generalRoom]: [TalkFeedPost[], TalkRoom | null] = o.talk
    ? await Promise.all([user ? getTalkFeed(40) : Promise.resolve([] as TalkFeedPost[]), getGeneralRoom(40)])
    : [[], null];

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
    localized.filter((a) => a.review?.trim() && a.kind !== "ep_rate").map((a) => commentViewKey(a.person.id, a.media_type, a.tmdb_id)),
  );
  const listSocial: Map<string, ListReviewSocial> = await getListReviewSocial([
    ...new Set(localized.map((a) => a.listId).filter(Boolean) as string[]),
  ]);
  const viewCounts = await getPostViewCounts([
    ...localized
      .filter((a) => a.review?.trim() && a.kind !== "ep_rate")
      .map((a) => commentViewKey(a.person.id, a.media_type, a.tmdb_id)),
    ...genNews.map((n) => newsViewKey(n.key)),
  ]);

  return {
    localized,
    feedTranslations,
    rooms,
    roomsShown,
    libraryRooms,
    nextAir,
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
    talkFeed,
    generalRoom,
  };
}

export type CommunityData = Awaited<ReturnType<typeof buildCommunity>>;

/**
 * 🆕 D-1596 — **صفحةُ «الأقدم» في النشاط** (أحمد ٣٠ أكتوبر: «كل مانزل يعرض زيادة» — «٤ أ»): ثلاثون رأياً مكتوباً قبل
 * `before`، بالشكل الذي يرسمه الخطُّ حرفاً (`feedRows`) — لكن **بلا بقيّة المجتمع**: لا غرفَ ولا لوحةَ ناسٍ ولا أخبار؛ ما يحتاجه
 * صفُّ الرأي وحدَه (الترجمة · الردود · المشاهدات · إعجاباتُ القوائم · حالةُ المكتبة). بالأحدث دائماً: «الأكثر تفاعلاً» ترتيبُ
 * الصفحة الأولى، وما تحتها تاريخٌ متّصل. `next_before` آخرُ ما أعادته الدالّة (قبل ترشيح «الغرباء») فلا تتكرّر صفحةٌ ولا تُقفز.
 */
export async function buildFeedPage(o: {
  user: Awaited<ReturnType<typeof getUser>>;
  locale: Locale;
  before: string;
  limit: number;
  translateOn: boolean;
  /** 🆕 D-1605 — كما في `buildCommunity` */
  personas?: boolean;
}) {
  const out = { raw: 0 };
  const [memberItems, personaItems] = await Promise.all([
    getCommunityFeed("all", { before: o.before, limit: o.limit, out }),
    o.user && o.personas ? getFollowedPersonaFeed(o.before, PERSONA_PAGE) : Promise.resolve([]),
  ]);
  /* 🆕 D-1605 — المؤشّرُ التالي حدُّ الدمج: منبعٌ امتلأ لم يقل كلَّ ما عنده؛ ولا ممتلئَ ⇒ انتهى الخطّ */
  const merged = mergeFeedStreams(memberItems, out.raw >= o.limit, personaItems, personaItems.length >= PERSONA_PAGE);
  const items = merged.items;
  const localized = await localizeRows(items, o.locale);
  const reviewKeys = localized
    .filter((a) => a.review?.trim() && a.kind !== "ep_rate")
    .map((a) => commentViewKey(a.person.id, a.media_type, a.tmdb_id));
  const [feedTranslations, follows, followingIds, libState, reviewReplies, listSocial, viewCounts] = await Promise.all([
    o.translateOn
      ? getBatchTranslations(
          localized
            .filter((a) => a.review?.trim() && !a.hasSpoiler && a.kind !== "ep_rate" && !isPersonaId(a.person.id))
            .map((a) => ({ id: commentViewKey(a.person.id, a.media_type, a.tmdb_id), text: a.review ?? "" })),
          o.locale === "ar" ? "ar" : "en",
        )
      : Promise.resolve({} as Record<string, string>),
    o.user ? getFollows() : Promise.resolve([] as Awaited<ReturnType<typeof getFollows>>),
    getFollowingIds(),
    getLibState().catch(() => undefined),
    getReviewReplyCounts(reviewKeys),
    getListReviewSocial([...new Set(localized.map((a) => a.listId).filter(Boolean) as string[])]),
    getPostViewCounts(reviewKeys),
  ]);
  return {
    core: {
      talkFeed: [],
      localized,
      newsForMe: [],
      followingIds,
      reviewReplies,
      postLikes: { counts: {} as Record<string, number>, mine: new Set<string>() },
      newsReplies: new Map<string, number>(),
      listSocial,
      feedTranslations,
      viewCounts,
      libState,
      followed: new Set(follows.map((f) => `${f.media_type}-${f.tmdb_id}`)),
    },
    /* انتهى الخطُّ حين أعادت الدالّتان أقلَّ من صفحتيهما — 🆕 D-1605 والمؤشّرُ حدُّ الدمج (`mergeFeedStreams`) */
    next_before: merged.cutoff,
  };
}


/**
 * **التجديدُ بحركة المرور** (D-210/D-215/D-261): دورةُ رصد الأخبار ونشرةُ الغرف بعد إرسال
 * الردّ — فلا ينتظرها قارئ. **والبابُ يطرقها كالصفحة** كي لا يبقى مجتمعُ التطبيق بلا تجديد.
 * `pagerTab` يحرس الأولى كما كانت في الصفحة؛ والثانيةُ لكلِّ فتحة.
 */
export async function refreshCommunityAfter(pagerTab: boolean) {
  if (pagerTab && (await getNewsGenStale(10))) after(() => refreshLoopzNews());
  if (await getTalkBulletinStale(180)) after(() => refreshTalkBulletins());
}
