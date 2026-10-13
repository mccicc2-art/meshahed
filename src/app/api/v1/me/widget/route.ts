import type { NextRequest } from "next/server";
import {
  getFollows,
  getWatchSummary,
  getWatchedMovies,
  getProfile,
  getAllMovieProgress,
  getMyRatings,
  getMyLists,
  getList,
  listsForDisplay,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { getTv, wellKnownMovies, type TvDetails } from "@/lib/tmdb";
import { buildHomeHeader, buildHomeBody, freshenFollows } from "@/lib/homeCore";
import { calendarEntries, todayIn } from "@/core/calendar";
import { asTimeZone } from "@/core/zone";
import { watchStateOf } from "@/core/libraryStatus";
import { BROWSE_GENRES } from "@/core/browse";
import { titleOf } from "@/core/media";
import { isRtl } from "@/core/i18n";
import { handle, requireUser, limited } from "@/lib/v1";
import { routeName } from "@/lib/reqTrace";
import { noteWidgetLang } from "@/lib/widgetToken";
import { ok } from "@/core/contracts/result";
import {
  WIDGET_FEED_VERSION,
  type WidgetFeed,
  type WidgetContinueItem,
  type WidgetToWatchSeries,
  type WidgetUpcomingItem,
  type WidgetMovie,
  type WidgetListSource,
  type WidgetTitle,
} from "@/core/contracts/widget";

/**
 * 🆕 `GET /api/v1/me/widget?lists=<id,id>` — **بياناتُ الودجتات كلِّها في ردٍّ واحد** (خطّةُ الودجتات).
 *
 * 🔑 **لا وصفةَ جديدة**: «أكمل المشاهدة» و«للمشاهدة» من موجتَي الرئيسيّة (`homeCore`) بترتيبها وأولويّة
 * صاحبها (D-605)، **و«القادم» من `calendarEntries` حرفاً** — فالودجتُ لا يقول «اليوم» والتقويمُ يقول غيرَه.
 *
 * ⚡ **ونداءاتُ TMDB محسوبة**: رقمُ الحلقة القادمة للثلاثة الظاهرة وحدَها (قرارُ «١ أ» — التقويمُ نفسُه بلا
 * أرقام، D-437)، والموسمُ المؤكّدُ بلا موعد لا يُسأل عنه إلّا إن نقصت الثلاثةُ (W7، «٢ أ») ولمسلسلاتٍ في
 * «أكمل المشاهدة» أو أنهاها صاحبُها — بسقفٍ ستّة. وكلُّها مخبّأةٌ ساعةً (`getTv`).
 *
 * ⚠️ **`private, no-store`**: شخصيٌّ، والتطبيقُ يجلبه في الخلفيّة أيضاً.
 */
export async function GET(req: NextRequest) {
  return handle<WidgetFeed>(
    async () => {
      routeName("me/widget");
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const lim = limited(`v1:widget:${auth.user.id}`, 20, 60_000);
      if (lim) return lim;

      const { locale, t } = await getT();
      /* 🆕 W14 — ✓ يُرسم حيث يعمل فقط: للعضو رمزُ ودجتٍ صادر (والجدولُ موجود). ويُحفظ معه لغةُ سطر الردّ */
      const checkPromise = noteWidgetLang(auth.user.id, locale);
      const movieProgressPromise = getAllMovieProgress();
      const [storedFollows, summary, watchedMovies, profile, myRatings] = await Promise.all([
        getFollows(),
        getWatchSummary(),
        getWatchedMovies(),
        getProfile(),
        getMyRatings(),
      ]);
      const { followRows, freshStats } = await freshenFollows(storedFollows, summary);
      const head = await buildHomeHeader({ followRows, summary, watchedMovies, profile, myRatings, t });
      const { watchedMovieIds, prefs, today: homeToday, watchedByShow, lastWatchedOrder, rewatchSinceMap } = head;
      const body = await buildHomeBody({
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
        today: homeToday,
        freshStats,
      });

      /* يومُ القارئ بمنطقته — **دالّةُ التقويم نفسُها** (`me/calendar`) */
      const today = todayIn(asTimeZone(profile?.timezone));

      /* ——— «أكمل المشاهدة»: المسلسلاتُ وحدَها، بترتيب الرئيسيّة ——— */
      const continueItems: WidgetContinueItem[] = body.continueTop.slice(0, 3).map((i, n) => {
        const ex = body.continueExtra[n];
        /* 🆕 W17 — **حسابُ بطاقة الرئيسيّة نفسُه** (`apps/mobile/src/home/Cards.tsx`): النسبةُ من المشاهَد والمعروض،
           والسطرُ الثاني «الحلقة · باقي N» — فالبطاقتان لا تختلفان في رقم */
        const left = i.aired > i.watched ? i.aired - i.watched : 0;
        const pct = i.aired > 0 ? Math.max(0, Math.min(100, Math.round((i.watched / i.aired) * 100))) : 0;
        const sub = [ex?.episodeLabel ?? null, left > 0 ? t.leftEps(left) : null].filter(Boolean).join(" · ") || null;
        return {
          kind: "tv",
          id: i.id,
          title: i.name,
          poster_path: i.posterPath,
          season: ex?.season ?? null,
          episode: ex?.episode ?? null,
          /* 🆕 W14 — سطرُ البطاقة في `label` و`sub` فارغ: بعد ✓ يكتب الودجتُ (أندرويد وiOS) `next.label` من الردّ
             مكانَ `label` وحدَه — فلو بقي السطرُ في `sub` لبقي «الحلقة · باقي N» القديمُ حتى يُفتح التطبيق.
             الردُّ يبني السطرَ بالشكل نفسِه (`widgetMark`)، والنسبةُ تتجدّد في الجلب التالي (البناءُ العامّ يصلحها) */
          label: sub ?? (ex?.season != null && ex?.episode != null ? t.epLabel(ex.season, ex.episode) : null),
          backdrop_path: ex?.backdropPath ?? null,
          sub: null,
          pct,
        };
      });
      /* العددُ كلُّه لا الظاهرُ — مفاتيحُ `c-` في طابور الصفّ هي المسلسلاتُ نفسُها */
      const continueTotal = body.continueQueueItems.filter((q) => (q.key ?? "").startsWith("c-")).length;
      const nextById = new Map(
        body.continueTop.map((i, n) => [i.id, body.continueExtra[n]] as const),
      );

      /* ——— خاناتٌ باهتةٌ من «للمشاهدة»: أوّلُ المسلسلات (W5، «٢ أ») ——— */
      const stateById = new Map(
        followRows
          .filter((f) => f.media_type === "tv")
          .map((f) => [f.tmdb_id, watchStateOf(f, watchedByShow.get(f.tmdb_id) ?? 0)] as const),
      );
      const towatchSeries: WidgetToWatchSeries[] = body.toWatchOrdered
        .filter((x) => x.mediaType === "tv" && x.tmdbId != null)
        .slice(0, 2)
        .map((x) => ({
          kind: "tv",
          id: x.tmdbId!,
          title: x.title,
          poster_path: x.posterPath,
          action: stateById.get(x.tmdbId!) === "paused" ? "unpause" : "start",
        }));
      const towatchAll: WidgetTitle[] = body.toWatchOrdered.slice(0, 3).map((x) => ({
        kind: x.mediaType === "tv" ? "tv" : "movie",
        id: x.tmdbId ?? Number(x.href.split("/").pop()),
        title: x.title,
        poster_path: x.posterPath,
      }));

      /* ——— «القادم»: مسلسلاتُه وحدَها، أقربُ ثلاثة ——— */
      const tvEntries = calendarEntries(
        followRows.filter((f) => f.media_type === "tv"),
        { today, until: "9999-12-31" },
      );
      const top = tvEntries.slice(0, 3);
      const tvDetails = new Map<number, TvDetails | null>();
      await Promise.all(
        top.map((e) =>
          getTv(e.tmdbId)
            .then((tv) => tvDetails.set(e.tmdbId, tv))
            .catch(() => tvDetails.set(e.tmdbId, null)),
        ),
      );
      const upcomingItems: WidgetUpcomingItem[] = top.map((e) => {
        const nx = tvDetails.get(e.tmdbId)?.next_episode_to_air ?? null;
        /* الرقمُ يُقبل إن طابق موعدُه الموعدَ المخزَّن — وإلّا فالمخزَّنُ أقدمُ من TMDB ولا يُخلط بينهما */
        const match = nx && nx.air_date === e.date ? nx : null;
        const season = match?.season_number ?? null;
        const episode = match?.episode_number ?? null;
        const label =
          season != null && episode != null
            ? episode === 1
              ? t.widgetPremiere(season)
              : t.epLabel(season, episode)
            : null;
        /* «أنت عند …» (W9): حلقتُه التالية في «أكمل المشاهدة» غيرُ الحلقة النازلة */
        const mine = nextById.get(e.tmdbId);
        const behind =
          mine?.season != null &&
          mine?.episode != null &&
          season != null &&
          episode != null &&
          (mine.season !== season || mine.episode !== episode)
            ? t.widgetYouAreAt.replace("%s", t.epLabel(mine.season, mine.episode))
            : null;
        return {
          kind: "tv",
          id: e.tmdbId,
          title: e.title,
          poster_path: e.posterPath,
          date: e.date,
          season,
          episode,
          label,
          behind_label: behind,
        };
      });

      /* ——— موسمٌ مؤكّدٌ بلا موعد (W7): لا يُسأل عنه إلّا إن نقصت الثلاثة ——— */
      if (upcomingItems.length < 3) {
        const dated = new Set(tvEntries.map((e) => e.tmdbId));
        const pool = [
          ...body.continueTop.map((i) => i.id),
          ...[...body.doneShowIds],
        ];
        const followed = new Map(followRows.filter((f) => f.media_type === "tv" && !f.dropped).map((f) => [f.tmdb_id, f]));
        const candidates = [...new Set(pool)].filter((id) => followed.has(id) && !dated.has(id)).slice(0, 6);
        const found = await Promise.all(
          candidates.map((id) =>
            getTv(id)
              .then((tv) => {
                if (tv.status !== "Returning Series" || tv.next_episode_to_air) return null;
                const last = tv.last_episode_to_air?.season_number ?? 0;
                const s = (tv.seasons ?? []).find((x) => x.season_number > last && !x.air_date);
                return s ? { id, season: s.season_number } : null;
              })
              .catch(() => null),
          ),
        );
        for (const f of found) {
          if (!f || upcomingItems.length >= 3) continue;
          const row = followed.get(f.id)!;
          upcomingItems.push({
            kind: "tv",
            id: f.id,
            title: row.title,
            poster_path: row.poster_path,
            date: null,
            season: f.season,
            episode: null,
            label: t.widgetSeasonNoDate(f.season),
            behind_label: null,
          });
        }
      }

      /* ——— «فيلم الليلة» (W12): «للمشاهدة» أوّلاً ثمّ المقترح ——— */
      const towatchMovies: WidgetMovie[] = body.toWatchOrdered
        .filter((x) => x.mediaType === "movie" && x.tmdbId != null)
        .slice(0, 10)
        .map((x) => ({
          kind: "movie",
          id: x.tmdbId!,
          title: x.title,
          poster_path: x.posterPath,
          runtime: x.runtime ?? null,
          rating: null,
          source: "towatch",
        }));
      let tonight = towatchMovies;
      if (tonight.length < 10) {
        /* أنواعُه المفضّلةُ مسجّلةٌ بمعرّفات المسلسلات (`GENRES`)، ومقابلُها في الأفلام من جدول التصفّح نفسِه */
        const toMovie = (ids: readonly number[]) =>
          [...new Set(ids.flatMap((id) => BROWSE_GENRES.find((g) => g.tv.includes(id))?.movie ?? []))];
        const fav = toMovie(profile?.favorite_genres ?? []);
        const unwanted = toMovie(profile?.unwanted_genres ?? []);
        const excluded = new Set<number>([
          ...followRows.filter((f) => f.media_type === "movie").map((f) => f.tmdb_id),
          ...watchedMovieIds,
          ...tonight.map((m) => m.id),
        ]);
        const take = (rows: Awaited<ReturnType<typeof wellKnownMovies>>) =>
          rows.filter((r) => !excluded.has(r.id));
        let pool = fav.length ? take(await wellKnownMovies({ genres: fav, withoutGenres: unwanted })) : [];
        /* البِركةُ الضيّقةُ تُكمَل من كلِّ الأنواع بالحاجزين نفسيهما («٢ أ») */
        if (pool.length < 10) {
          const wide = take(await wellKnownMovies({ genres: [], withoutGenres: unwanted }));
          const have = new Set(pool.map((r) => r.id));
          pool = [...pool, ...wide.filter((r) => !have.has(r.id))];
        }
        /* خلطٌ خفيف — والودجتُ يقلّب بينها محلّيّاً */
        const shuffled = pool
          .map((r) => ({ r, k: Math.random() }))
          .sort((a, b) => a.k - b.k)
          .map((x) => x.r);
        tonight = [
          ...tonight,
          ...shuffled.slice(0, 10 - tonight.length).map((r): WidgetMovie => ({
            kind: "movie",
            id: r.id,
            title: titleOf(r),
            poster_path: r.poster_path,
            runtime: null,
            rating: typeof r.vote_average === "number" ? Math.round(r.vote_average * 10) / 10 : null,
            source: "suggested",
          })),
        ];
      }

      /* ——— مصادرُ الاختيار (W10): أسماءُ قوائمه، وعناصرُ ما طُلب منها وحدَه ——— */
      const wanted = new Set(
        (req.nextUrl.searchParams.get("lists") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
          .slice(0, 4),
      );
      const myLists = listsForDisplay(await getMyLists().catch(() => []));
      const lists: WidgetListSource[] = await Promise.all(
        myLists.slice(0, 30).map(async (l) => {
          let items: WidgetTitle[] = [];
          if (wanted.has(l.id)) {
            const full = await getList(l.id).catch(() => null);
            /* قوائمُه وحدَه — `getList` يعيد المعلنةَ لغيره أيضاً */
            if (full && full.list.user_id === auth.user.id)
              items = full.items.slice(0, 3).map((x) => ({
                kind: x.media_type === "tv" ? "tv" : "movie",
                id: x.tmdb_id,
                title: x.title ?? "—",
                poster_path: x.poster_path,
              }));
          }
          return { id: l.id, name: l.name, count: l.item_count, items };
        }),
      );

      const payload: WidgetFeed = {
        v: WIDGET_FEED_VERSION,
        lang: locale,
        dir: isRtl(locale) ? "rtl" : "ltr",
        today,
        continue: { items: continueItems, total: continueTotal },
        towatch_series: towatchSeries,
        towatch_all: towatchAll,
        upcoming: { items: upcomingItems, total: tvEntries.length },
        tonight,
        lists,
        check: await checkPromise,
        strings: {
          continueTitle: t.widgetContinue,
          comingUpTitle: t.widgetComingUp,
          tonightTitle: t.widgetTonight,
          towatchTitle: t.libToWatch,
          all: t.seeAll,
          allCount: t.widgetAllCount,
          next: t.widgetNext,
          start: t.widgetStart,
          towatchStart: t.widgetTowatchStart,
          startSomething: t.widgetStartSomething,
          noUpcoming: t.widgetNoUpcoming,
          noTowatchMovies: t.widgetNoTowatchMovies,
          today: t.whenToday,
          tomorrow: t.whenTomorrow,
          anotherMovie: t.widgetAnotherMovie,
          suggested: t.widgetSuggested,
          fromTowatch: t.widgetFromTowatch,
          youAreAt: t.widgetYouAreAt,
          movieType: t.typeMovie,
          seriesType: t.typeSeries,
          emptySignedOut: t.widgetSignedOut,
          undo: t.undoWatched,
        },
      };
      return ok(payload);
    },
    { cacheControl: "private, no-store" },
  );
}
