import { after } from "next/server";
import {
  getFollows,
  getWatchSummary,
  getWatchedMovies,
  getProfile,
  getAllMovieProgress,
  getMyRatings,
  getUnreadSignals,
  getUnreadShares,
  getFollowStats,
  getNewsGenStale,
  refreshLoopzNews,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { isPlus } from "@/core/plan";
import { curatedName } from "@/core/universes";
import { applyQueueOrder } from "@/core/homePrefs";
import { sanitizeUiState } from "@/lib/uiState";
import { toLibraryListCard } from "@/lib/listCard";
import { cacheShowStats, cacheMovieStats, cacheFollowMeta } from "@/lib/actions";
import { buildHomeHeader, buildHomeBody } from "@/lib/homeCore";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type {
  HomePayload,
  HomeContinueCard,
  HomeMixedCard,
  HomeQueueItem,
} from "@/core/contracts/home";

/**
 * `GET /api/v1/me/home` — الرئيسيةُ الويبيّةُ بحذافيرها للتطبيق (D-1066،
 * نقضُ D-919 بقرار أحمد).
 *
 * 🔑 **الموجتان موجتا الصفحة نفسُهما**: الأولى (`buildHomeHeader`) والثانية
 * (`buildHomeBody`) من `lib/homeCore.ts` — **حرفاً ما تقرؤه `app/page.tsx`**،
 * وهذا الملفُّ لا يحسب شيئاً: **يغيّر الشكلَ وحدَه** (JSON بدل JSX). قرارٌ
 * في النواة يصل السطحَين معاً (القاعدة ٦).
 *
 * ⚡ **ما كان الويبُ يبثّه بعد الرفوف ليس هنا** — مشاهدُ «التالي»، أرقامُ
 * حلقات القادم، والرائجُ في `me/home/extras` (نظيرُ `Suspense` الأقسام).
 *
 * 🔑 **آثارُ الويب الجانبيّةُ تبقى**: ما كانت `ShowStatsSync`/`MovieStatsSync`/
 * `FollowMetaSync` تكتبه من العميل (D-023 وأخواتُها) يُكتب هنا في `after()`
 * — **فمكتبةٌ تُفتح من التطبيق وحدَه لا تبقى بلا أعدادِ حلقاتٍ ومواعيد**؛
 * وتجديدُ الأخبار (D-215) من الباب نفسِه لأنّ الرئيسيةَ أكثرُ الأسطح زيارة.
 * وكلُّها صامتةُ الفشل: إحصاءٌ يكسر الرئيسيةَ أسوأُ صفقة (D-909).
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:home:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    const user = auth.user;

    const { locale, t } = await getT();
    // وعدٌ يُطلق قبل الموجة الأولى ويُنتظر في الثانية — كالصفحة (جولة ٢٢ أغسطس)
    const movieProgressPromise = getAllMovieProgress();
    const [followRows, summary, watchedMovies, profile, myRatings] = await Promise.all([
      getFollows(),
      getWatchSummary(),
      getWatchedMovies(),
      getProfile(),
      getMyRatings(),
    ]);

    const head = await buildHomeHeader({ followRows, summary, watchedMovies, profile, myRatings, t });
    const { watchedMovieIds, prefs, today, watchedByShow, lastWatchedOrder, rewatchSinceMap, headerStats } = head;

    const [unreadSignals, unreadShares, followStats, body] = await Promise.all([
      getUnreadSignals(),
      getUnreadShares(),
      getFollowStats(user.id).catch(() => ({ followers: 0, following: 0 })),
      buildHomeBody({
        followRows,
        summary,
        watchedMovieIds,
        profile,
        movieProgress: movieProgressPromise,
        prefs,
        watchedByShow,
        lastWatchedOrder,
        rewatchSinceMap,
        myRatings,
        locale,
        t,
        today,
      }),
    ]);

    /* ——— آثارٌ جانبيّةٌ بعد الردّ — ما كان العميلُ الويبيُّ يكتبه ——— */
    after(async () => {
      const quiet = async (p: Promise<unknown>) => {
        try {
          await p;
        } catch {
          /* خدمةٌ خلفيّة — سقوطُها لا يمسّ الردّ */
        }
      };
      await Promise.all([
        body.statsToCache.length ? quiet(cacheShowStats(body.statsToCache)) : null,
        body.movieDatesToCache.length ? quiet(cacheMovieStats(body.movieDatesToCache)) : null,
        body.metaToCache.length ? quiet(cacheFollowMeta(body.metaToCache)) : null,
        quiet((async () => { if (await getNewsGenStale(10)) await refreshLoopzNews(); })()),
      ]);
    });

    /* ——— الشكلُ: من متغيّرات الصفحة إلى JSON — بنفس ترتيبها وشروطها ——— */
    const kindOf = (mt: "tv" | "movie") => mt;
    const mixed = (x: (typeof body.toWatchRow)[number] & { date?: string }): HomeMixedCard => ({
      key: x.key,
      kind: kindOf(x.mediaType ?? (x.href.startsWith("/show/") ? "tv" : "movie")),
      id: x.tmdbId ?? Number(x.href.split("/").pop()),
      title: x.title,
      poster_path: x.posterPath,
      progress: x.progress ?? null,
      badge: x.badge ?? null,
      badge_tone: x.badgeTone ?? null,
      subtitle: x.subtitle ?? null,
      runtime: x.runtime ?? null,
      date: x.date ?? null,
      ep: x.ep ?? null,
    });
    const queue = (q: (typeof body.continueQueueItems)[number]): HomeQueueItem => ({
      /* طوابيرُ الرئيسية كلُّها بمفاتيحَ صريحة (`lc-` · `pl-` · `c-` · `tw-`)؛
         الاحتياطُ اشتقاقُ `listItemKey` حرفاً (D-581) — ووحدةُ الورقة عميلٌ لا يُستورد هنا */
      key: q.key ?? `${q.media_type ?? "movie"}-${q.tmdb_id ?? 0}`,
      title: q.title,
      poster_path: q.poster_path,
      ...(q.media_type ? { media_type: q.media_type } : {}),
      ...(q.fallbackIcon ? { fallback_icon: q.fallbackIcon } : {}),
    });

    /* «تابِع المشاهدة» بترتيب `ContinueSection` حرفاً: طابورٌ فقوائمُ فأعمالٌ
       ثمّ أولويّةُ صاحبها فوقها (D-605) */
    const cont: HomeContinueCard[] = [];
    if (body.toWatchCard)
      cont.push({
        type: "towatch",
        key: "lc-towatch",
        list_name: body.toWatchCard.name,
        next: {
          kind: body.toWatchCard.next.media_type,
          id: body.toWatchCard.next.tmdb_id,
          title: body.toWatchCard.next.title,
          poster_path: body.toWatchCard.next.poster_path,
        },
        watched: body.toWatchCard.watched,
        total: body.toWatchCard.total,
      });
    for (const c of body.playlistCards)
      cont.push({
        type: "playlist",
        key: `pl-${c.list.id}`,
        list_id: c.list.id,
        list_name: curatedName(c.list.sourceSlug, c.list.name, locale),
        next: { kind: c.next!.media_type, id: c.next!.tmdb_id, title: c.next!.title, poster_path: c.next!.poster_path, followed: c.nextFollowed },
        watched: c.watched,
        total: c.total,
      });
    for (const c of body.listCards)
      cont.push({
        type: "list",
        key: `lc-${c.list.id}`,
        list_id: c.list.id,
        list_name: curatedName(c.list.sourceSlug, c.list.name, locale),
        next: { kind: c.next!.media_type, id: c.next!.tmdb_id, title: c.next!.title, poster_path: c.next!.poster_path, followed: c.nextFollowed },
        watched: c.watched,
        total: c.total,
      });
    body.continueTop.forEach((i, n) => {
      const ex = body.continueExtra[n];
      cont.push({
        type: "show",
        key: `c-${i.id}`,
        id: i.id,
        title: i.name,
        poster_path: i.posterPath,
        backdrop_path: ex?.backdropPath ?? null,
        progress: i.progress,
        watched: i.watched,
        aired: i.aired,
        episode_label: ex?.episodeLabel ?? null,
        season: ex?.season ?? null,
        episode: ex?.episode ?? null,
        runtime: ex?.runtime ?? null,
      });
    });
    const continueOrdered = applyQueueOrder(cont, (x) => x.key, prefs.continueOrder);

    const payload: HomePayload = {
      header: {
        display_name: profile?.nickname || user.email?.split("@")[0] || "",
        username: profile?.username ?? null,
        plan: profile?.plan ?? null,
        founder: profile?.founder ?? false,
        plus_until: profile?.plus_until ?? null,
        verified_at: profile?.verified_at ?? null,
        avatar_url: profile?.avatar_url ?? null,
        avatar_pos: profile?.avatar_pos ?? null,
        cover_url: profile?.cover_url ?? null,
        cover_pos: profile?.cover_pos ?? null,
        unread_signals: unreadSignals,
        unread_shares: unreadShares,
        followers: followStats.followers,
        following: followStats.following,
        hide_follow_lists: !!profile?.hide_follow_lists,
        stats: prefs.statsPick.map((k, n) => ({ key: k, icon: headerStats[n].icon, value: headerStats[n].value, label: headerStats[n].label, href: headerStats[n].href ?? "/library" })),
        show_stats: prefs.stats,
      },
      prefs,
      plus: isPlus(profile),
      sections: {
        continue: continueOrdered,
        week: {
          days: body.weekDays.map((d) => ({ date: d.date, weekday: d.weekday, day_num: d.dayNum })),
          entries: body.weekEntries.map((e) => ({ date: e.date, show_id: e.showTmdbId, title: e.title })),
        },
        towatch: { items: body.toWatchRow.map(mixed), all: body.toWatchOrdered.map(mixed) },
        upcoming: body.upcomingRow.map(mixed),
        shows: {
          items: body.myShows.map((i) => ({
            id: i.id,
            title: i.name,
            poster_path: i.posterPath,
            progress: i.progress,
            watched: i.watched,
            aired: i.aired,
            count: i.watched > 0 && i.aired > i.watched ? i.aired - i.watched : null,
            badge: i.watched === 0 ? t.notStartedBadge : i.aired > 0 && i.watched >= i.aired ? t.watchedBadge : null,
            badge_tone: i.aired > 0 && i.watched >= i.aired && i.watched > 0 ? "watched" : "neutral",
          })),
          total: body.myShows.length,
        },
        movies: {
          items: body.myMovies.map((m) => ({ id: m.tmdbId, title: m.title, poster_path: m.posterPath, progress: m.progress, badge: m.badge })),
          total: body.myMovies.length,
        },
        recap: body.recap,
        ratings: body.topRated.map((r) => ({ kind: r.media_type, id: r.tmdb_id, title: r.title ?? "—", poster_path: r.poster_path, rating: r.rating })),
        lists: {
          cards: body.listsRowCards.map((c) => toLibraryListCard(c, locale)),
          towatch_card: body.toWatchQueueCard,
          towatch_at: body.toWatchListAt,
        },
        friends: body.friendsRows.map((r) => ({
          kind: r.media_type,
          id: r.tmdb_id,
          title: r.title,
          poster_path: r.poster_path,
          saved: body.followedKeys.has(`${r.media_type}-${r.tmdb_id}`),
          watched: r.media_type === "movie" ? watchedMovieIds.has(r.tmdb_id) : body.doneShowIds.has(r.tmdb_id),
        })),
      },
      queues: {
        continue: body.continueQueueItems.map(queue),
        towatch: body.toWatchQueueItems.map(queue),
        lists: body.listsQueueItems.map(queue),
        towatch_list: body.toWatchListItems.map(queue),
      },
      widget: body.widgetItems,
      pick_genres_hint: body.favGenres.length === 0,
      hints: sanitizeUiState(profile?.ui_state).hints,
    };
    return ok(payload);
  });
}
