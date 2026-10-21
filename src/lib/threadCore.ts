import "server-only";
import {
  getUser,
  getMyProfileLite,
  getMyArtFor,
  getCommunityRating,
  getTitleThread,
  getPostLikes,
  getPostVotes,
  getFollowState,
  isMovieWatched,
  getNewsPost,
  getNewsThread,
  getPostViewCounts,
  getReactions,
  getTitleReviews,
  getTitleReplies,
  getWatchedForShow,
  getReviewReplyCounts,
  type TitleReview,
} from "@/lib/data";
import { getMovie, getTv } from "@/lib/tmdb";
import { displayWorkTitle } from "@/lib/wikidata";
import { getT, getTranslateEnabled } from "@/lib/locale";
import { getBatchTranslations } from "@/lib/translate";
import { bulletinLine, bulletinFacts, bulletinSpoiler, bulletinName } from "@/core/bulletinLine";
import { bulletinEpisode, inheritEpisodes, seasonsOf } from "@/core/talkEpisodes";
import { newsLine, newsSource } from "@/core/newsLine";
import { newsViewKey, commentViewKey } from "@/core/postKeys";
import type { Locale } from "@/core/i18n";
import type { PersonLite } from "@/core/people";
import type { ThreadPayload, ThreadRow, ThreadWork } from "@/core/contracts/thread";

/**
 * ====== حمولةُ «النقاش» — ما تقرؤه صفحاتُ الويب الثلاث نفسُها (Phase 11-M · M3) ======
 *
 * 🔑 **فوق دوالّ `lib/data` نفسِها لا نسخةٍ ثانية** (خطّة §٥، نهجُ `communityCore`): `talk/[type]/[id]/page.tsx` ·
 * `post/[key]/page.tsx` · `review/[type]/[id]/[user]/page.tsx` — نداءً بنداء، **والحراسةُ (الإخفاءُ والحظرُ والمُبلَّغُ عنه)
 * في دوالّ القاعدة** (D-011/D-145) فيقرؤها التطبيقُ بالحدود نفسِها.
 *
 * 🔑 **والصياغةُ هنا لا في التطبيق** (D-1172): سطرُ النشرة وحقائقُها ومحجوبُها بلغة القارئ، والترجمةُ الدفعيّة
 * (للغرفة وحدَها كالويب، ولا تُترجم المحجوبات D-315)، والصورةُ لا تمرّ إلّا `https://` (D-298).
 * `null` = لا شيءَ بهذا المفتاح (`notFound()` في الويب) ⇒ `not_found`.
 */

type Kind = "tv" | "movie";

/** 🆕 R58 — «النقاش العام»: لا عملَ ولا TMDB — اسمُه وسطرُه بلغة القارئ، والرأسُ يُرسم بشعار لوبز (`media_type: general`) */
function generalWork(t: { talkGeneralTitle: string; talkGeneralSub: string }): ThreadWork & { overview: string; raw: string; seasons: { season: number; episodes: number }[] } {
  return { tmdb_id: 0, media_type: "general", title: t.talkGeneralTitle, raw: t.talkGeneralTitle, poster_path: null, backdrop_path: null, community: { avg: 0, count: 0 }, overview: t.talkGeneralSub, seasons: [] };
}

async function workOf(tmdbId: number, kind: Kind, locale: Locale, fallback: string): Promise<ThreadWork & { overview: string; raw: string; seasons: { season: number; episodes: number }[] }> {
  const [details, myArt, community] = await Promise.all([
    (kind === "tv" ? getTv(tmdbId) : getMovie(tmdbId)).catch(() => null),
    getMyArtFor(tmdbId, kind).catch(() => null),
    getCommunityRating(tmdbId, kind).catch(() => ({ avg: 0, count: 0 })),
  ]);
  const d = details as { name?: string; title?: string; poster_path?: string | null; backdrop_path?: string | null; overview?: string | null } | null;
  const raw = (kind === "tv" ? d?.name : d?.title) ?? "";
  const title = raw ? await displayWorkTitle(tmdbId, kind, raw, locale).catch(() => raw) : fallback;
  return {
    tmdb_id: tmdbId,
    media_type: kind,
    title,
    raw,
    poster_path: myArt?.poster_path ?? d?.poster_path ?? null,
    backdrop_path: myArt?.backdrop_path ?? d?.backdrop_path ?? null,
    community: { avg: Math.round(community.avg * 10) / 10, count: community.count },
    overview: (d?.overview ?? "").trim(),
    /* 🆕 D-1495 — مواسمُ منتقي الحلقة من التفاصيل المجلوبة أصلاً (لا نداءَ ثانٍ) */
    seasons: kind === "tv" ? seasonsOf(details) : [],
  };
}

function person(p: Omit<PersonLite, "id">, id: string): PersonLite {
  return {
    id,
    nickname: p.nickname,
    username: p.username,
    avatar_url: p.avatar_url,
    hide_name: p.hide_name,
    plan: p.plan ?? null,
    founder: p.founder ?? null,
    verified_at: p.verified_at ?? null,
  };
}

const safeImage = (v: unknown): string | null => (typeof v === "string" && v.startsWith("https://") ? v : null);

function plainRow(base: Omit<ThreadRow, "bulletin" | "bulletin_vote" | "bulletin_spoiler" | "has_spoiler" | "image" | "gif_id" | "translated" | "likes" | "liked_by_me" | "score" | "my_vote">): ThreadRow {
  return { ...base, bulletin: null, bulletin_vote: null, bulletin_spoiler: null, has_spoiler: false, image: null, gif_id: null, translated: null, likes: 0, liked_by_me: false, score: 0, my_vote: 0 };
}

/** غرفةُ العمل — `talk/[type]/[id]/page.tsx` */
export async function talkPayload(tmdbId: number, kind: Kind | "general"): Promise<ThreadPayload> {
  /* 🆕 R58 — «النقاش العام» يمرّ بالمسار نفسِه (الإعجابُ والتصويتُ والترجمةُ والردود) بلا ما يخصّ العمل */
  const general = kind === "general";
  /* 🆕 1.12.7 — **ثلاثُ جولاتٍ متتالية صارت اثنتين** (`thread.open` p95 ٦٣٣ms على آيفون): العملُ (`workOf` — TMDB ثمّ
     الاسمُ المعروض) لا يحتاج الخيط، و«وجهي» (`getMyProfileLite`) لا يحتاج إلّا الجلسةَ المخبّأة — كانا ينتظران جولةً
     وجولتين بلا سبب. يبدآن مع الجولة الأولى، والردُّ حرفاً كما كان (`getMyProfileLite` يعيد `null` بلا جلسة ولا يرمي). */
  const tP = getT();
  const workP = tP.then(({ locale, t }) => (kind === "general" ? generalWork(t) : workOf(tmdbId, kind, locale, t.talkFallbackTitle)));
  const meP = getMyProfileLite();
  const [user, { locale, t }, thread, follow, watched, reviewsAll] = await Promise.all([
    getUser(),
    tP,
    getTitleThread(tmdbId, kind),
    kind === "general" ? Promise.resolve({ following: false, dropped: false }) : getFollowState(tmdbId, kind).catch(() => ({ following: false, dropped: false })),
    kind === "movie" ? isMovieWatched(tmdbId).catch(() => false) : Promise.resolve(false),
    /* 🆕 R56 — مراجعاتُ صفحة العمل تظهر في «عام» (والغرفةِ كلِّها للفيلم)؛ نجومٌ بلا نصٍّ لا تظهر (أحمد «٣ أ») */
    kind === "general" ? Promise.resolve([] as TitleReview[]) : getTitleReviews(tmdbId, kind).catch(() => [] as TitleReview[]),
  ]);
  const reviews = reviewsAll.filter((r) => r.review?.trim());
  /* 🆕 D-1508 — ما شاهده القارئُ من حلقات المسلسل (كلَّ ما أشّره، لا دورةَ الإعادة وحدَها): غرفةُ الحلقة تغطّي كلامَها عمّن
     لم يشاهدها، وقائمةُ «الحلقات» تقفلها. بلا جلسةٍ مصفوفةٌ فارغة (والغلقُ لكلِّ شيء — الزائرُ لا يُحرَق) */
  const watchedEpsP = kind === "tv" && user ? getWatchedForShow(tmdbId, null).then((s) => [...s]).catch(() => [] as string[]) : Promise.resolve([] as string[]);
  const ids = thread.map((p) => p.postId);
  const [work, likes, votes, translations, me, reviewReplies] = await Promise.all([
    workP,
    getPostLikes(ids).catch(() => ({ counts: {} as Record<string, number>, mine: [] as string[] })),
    getPostVotes(ids),
    translationsOf(
      [
        ...thread.filter((p) => !p.kind && !p.hasSpoiler && p.body?.trim()).map((p) => ({ id: p.postId, text: p.body })),
        ...reviews.filter((r) => !r.has_spoiler).map((r) => ({ id: `review:${r.id}`, text: r.review ?? "" })),
      ],
      locale,
    ),
    meP,
    general ? Promise.resolve(new Map<string, number>()) : getReviewReplyCounts(reviews.map((r) => commentViewKey(r.id, kind as Kind, tmdbId))),
  ]);
  const mine = new Set(likes.mine);
  const rows: ThreadRow[] = inheritEpisodes(thread.map((p) => {
    const bulletin = bulletinLine(p.kind, p.data, t, locale);
    const facts = bulletin ? bulletinFacts(p.data, t) : { vote: null };
    const my = votes.mine[p.postId] ?? 0;
    return {
      id: p.postId,
      person: person(p, p.authorId),
      parent_id: p.parentId,
      body: p.body,
      created_at: p.createdAt,
      mine: p.isMine,
      bulletin,
      bulletin_vote: facts.vote,
      bulletin_spoiler: bulletin ? bulletinSpoiler(p.spoiler, locale) : null,
      /* 🆕 D-1508 — اسمُ الحلقة ومدّتُها لرأس غرفتها */
      ...(bulletin ? { bulletin_name: bulletinName(p.kind, p.data, locale), bulletin_runtime: bulletinFacts(p.data, t).runtime } : {}),
      has_spoiler: p.hasSpoiler,
      image: bulletin ? null : safeImage(p.imagePath ?? (p.data as Record<string, unknown> | null)?.img),
      gif_id: bulletin ? null : p.gifId,
      ...(!bulletin && p.share ? { share: p.share } : {}),
      translated: translations[p.postId] ?? null,
      likes: likes.counts[p.postId] ?? 0,
      liked_by_me: mine.has(p.postId),
      score: votes.scores[p.postId] ?? 0,
      my_vote: my === 1 ? 1 : my === -1 ? -1 : 0,
      /* 🆕 D-1495 — حلقةُ السطر: النشرةُ من `data`، والمشاركةُ من عمودها، والردُّ يرث جذرَه (`inheritEpisodes`) */
      ...(bulletin ? (bulletinEpisode(p.data) ?? { season: null, episode: null }) : { season: p.season, episode: p.episode }),
    };
  }));
  /* 🆕 R56 — المراجعةُ سطرٌ بلا أب، وقتُه آخرُ تعديلٍ لها، وقلبُها قلبُها (`community/like` بـ`target: review`) */
  for (const r of reviews) {
    rows.push({
      id: `review:${r.id}`,
      person: person(r, r.id),
      parent_id: null,
      body: r.review ?? "",
      created_at: r.updated_at,
      mine: r.isMine,
      bulletin: null,
      bulletin_vote: null,
      bulletin_spoiler: null,
      has_spoiler: !!r.has_spoiler,
      image: null,
      gif_id: null,
      translated: translations[`review:${r.id}`] ?? null,
      likes: r.likes,
      liked_by_me: r.likedByMe,
      score: 0,
      my_vote: 0,
      season: null,
      episode: null,
      review: { user_id: r.id, rating: r.rating, replies: reviewReplies.get(commentViewKey(r.id, kind as Kind, tmdbId)) ?? 0 },
    });
  }
  const w = asWork(work);
  return {
    viewer: { signed_in: !!user, me_id: user?.id ?? null, me: user ? me : null },
    work: w,
    head: { kind: "talk", overview: work.overview, watched, in_library: !watched && follow.following, seasons: work.seasons, watched_eps: await watchedEpsP },
    rows,
    nested: true,
    has_likes: true,
    has_votes: true,
    share_path: `/talk/${kind}/${tmdbId}`,
  };
}

/** منشورُ لوبز — `post/[key]/page.tsx` */
export async function postPayload(key: string): Promise<ThreadPayload | null> {
  /* 1.12.7 — «وجهي» مع الجولة الأولى لا جولةً ثالثةً بعد الردود (انظر `talkPayload`) */
  const meP = getMyProfileLite();
  const [user, { locale, t }, post] = await Promise.all([getUser(), getT(), getNewsPost(key)]);
  if (!post) return null;
  const loc = locale === "en" ? "en" : "ar";
  const line = newsLine(post, t, loc);
  if (!line) return null;
  const likeKey = `${post.media_type}-${post.tmdb_id}`;
  const [replies, views, reactions, work, me] = await Promise.all([
    getNewsThread(key),
    getPostViewCounts([newsViewKey(key)]),
    getReactions([post.tmdb_id]),
    workOf(post.tmdb_id, post.media_type, locale, post.title),
    meP,
  ]);
  const w = asWork(work);
  return {
    viewer: { signed_in: !!user, me_id: user?.id ?? null, me: user ? me : null },
    /* عنوانُ الخبر كما كُتب فيه — الويبُ يرسم `post.title` لا اسمَ TMDB */
    work: { ...w, title: post.title || w.title, poster_path: post.poster_path ?? w.poster_path },
    head: {
      kind: "post",
      key,
      line,
      source: newsSource(post),
      published_at: post.published_at,
      views: views.get(newsViewKey(key)) ?? 0,
      likes: reactions.counts[likeKey] ?? 0,
      liked_by_me: reactions.mine.has(likeKey),
    },
    rows: replies.map((r) =>
      plainRow({ id: r.replyId, person: person(r, r.authorId), parent_id: r.parentId, body: r.body, created_at: r.createdAt, mine: r.isMine }),
    ),
    nested: false,
    has_likes: false,
    has_votes: false,
    share_path: `/post/${encodeURIComponent(key)}`,
  };
}

/** الرأيُ وخيطُه — `review/[type]/[id]/[user]/page.tsx` */
export async function reviewPayload(tmdbId: number, kind: Kind, authorId: string): Promise<ThreadPayload | null> {
  /* 1.12.7 — **جولةٌ واحدةٌ لا ثلاث**: العدّادُ والعملُ و«وجهي» لا يحتاج أيٌّ منها قائمةَ الآراء — كانت تنتظرها ثمّ
     تنتظر بعضَها. رأيٌ غائبٌ (نادر) يكلّف قراءتين ضاعتا؛ والحاضرُ يربح جولتين في كلِّ فتح. */
  const tP = getT();
  const [user, reviews, allReplies, views, work, me] = await Promise.all([
    getUser(),
    getTitleReviews(tmdbId, kind),
    getTitleReplies(tmdbId, kind),
    getPostViewCounts([commentViewKey(authorId, kind, tmdbId)]),
    tP.then(({ locale }) => workOf(tmdbId, kind, locale, "")),
    getMyProfileLite(),
  ]);
  const r = reviews.find((x) => x.id === authorId);
  if (!r) return null;
  const w = asWork(work);
  return {
    viewer: { signed_in: !!user, me_id: user?.id ?? null, me: user ? me : null },
    work: w,
    head: {
      kind: "review",
      author: person(r, r.id),
      rating: r.rating ?? null,
      review: r.review,
      has_spoiler: !!r.has_spoiler,
      updated_at: r.updated_at,
      views: views.get(commentViewKey(authorId, kind, tmdbId)) ?? 0,
      likes: r.likes,
      liked_by_me: r.likedByMe,
      mine: r.isMine,
    },
    rows: allReplies
      .filter((x) => x.reviewUserId === authorId)
      .map((x) => plainRow({ id: x.replyId, person: person(x, x.id), parent_id: x.parentId, body: x.body, created_at: x.createdAt, mine: x.isMine })),
    nested: false,
    has_likes: false,
    has_votes: false,
    share_path: `/review/${kind}/${tmdbId}/${authorId}`,
  };
}

async function translationsOf(items: { id: string; text: string }[], locale: Locale): Promise<Record<string, string>> {
  if (!items.length || !(await getTranslateEnabled())) return {};
  return getBatchTranslations(items, locale === "ar" ? "ar" : "en").catch(() => ({}));
}

/** العملُ كما يعبر العقد — بلا النبذة (رأسُ الغرفة وحدَه يحملها) ولا الاسم الخام */
function asWork(w: ThreadWork & { overview: string; raw: string }): ThreadWork {
  return { tmdb_id: w.tmdb_id, media_type: w.media_type, title: w.title, poster_path: w.poster_path, backdrop_path: w.backdrop_path, community: w.community };
}
