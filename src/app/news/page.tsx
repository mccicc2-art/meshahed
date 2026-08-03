import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  getUser,
  getFollows,
  getReactions,
  getTopRated,
  getMostWatched,
} from "@/lib/data";
import {
  upcomingMovies,
  airingTv,
  topRatedThisWeek,
  mostPopularThisWeek,
  titleOf,
  posterUrl,
  backdropUrl,
  type SearchResult,
} from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import type { NewsItem } from "@/components/NewsPost";
import { NewsList } from "@/components/NewsList";
import { NewsTabs } from "@/components/NewsTabs";
import { FilterBar, type FilterGroup } from "@/components/FilterBar";
import { Leaderboard } from "@/components/Leaderboard";
import {
  RANGE_DAYS,
  mergeLeaders,
  parseRange,
  parseSource,
  parseTab,
  parseType,
} from "@/lib/leaderboard";

function dateOf(r: SearchResult) {
  return r.release_date ?? r.first_air_date ?? "";
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; range?: string; src?: string; lib?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const type = parseType(sp.type);
  const range = parseRange(sp.range);
  const source = parseSource(sp.src);
  const lib = sp.lib === "mine" || sp.lib === "new" ? sp.lib : "all";

  const follows = await getFollows();
  const followed = follows.map((f) => `${f.media_type}-${f.tmdb_id}`);
  const followedSet = new Set(followed);

  const typeGroup: FilterGroup = {
    param: "type",
    label: t.filterType,
    options: [
      { value: "all", label: t.filterAll },
      { value: "tv", label: t.filterTv },
      { value: "movie", label: t.filterMovie },
    ],
  };

  // ---------- تبويب القادم الجديد ----------
  if (tab === "upcoming") {
    const [movies, tv] = await Promise.all([
      upcomingMovies().catch(() => [] as SearchResult[]),
      airingTv().catch(() => [] as SearchResult[]),
    ]);

    const today = new Date().toISOString().slice(0, 10);

    const items: NewsItem[] = [...movies, ...tv]
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .filter((r) => type === "all" || r.media_type === type)
      .filter((r) => {
        if (lib === "all") return true;
        const owned = followedSet.has(`${r.media_type}-${r.id}`);
        return lib === "mine" ? owned : !owned;
      })
      .map((r) => ({
        id: r.id,
        mediaType: r.media_type as "tv" | "movie",
        title: titleOf(r),
        overview: r.overview ?? "",
        poster: posterUrl(r.poster_path, "w342"),
        posterPath: r.poster_path,
        // البطاقة ٤٦٠ بكسل على سطح المكتب — w780 كان يحمّل ضعف ما يُعرض
        backdrop: backdropUrl(r.backdrop_path, "w500"),
        date: dateOf(r),
        rating: r.vote_average ? Number(r.vote_average.toFixed(1)) : null,
      }))
      .sort((a, b) => {
        const aFuture = a.date >= today;
        const bFuture = b.date >= today;
        if (aFuture !== bFuture) return aFuture ? -1 : 1;
        return aFuture ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      })
      .slice(0, 30);

    // عدّادات 🔥 للعناصر الظاهرة فقط بدل قراءة جدول التفاعلات كاملاً
    const reactions = await getReactions(items.map((i) => i.id));

    const groups: FilterGroup[] = [
      typeGroup,
      {
        param: "lib",
        label: t.filterLibrary,
        options: [
          { value: "all", label: t.libraryAll },
          { value: "mine", label: t.libraryMine },
          { value: "new", label: t.libraryNew },
        ],
      },
    ];

    return (
      <div>
        <header className="mb-4">
          <h1 className="text-2xl font-bold">{t.newsTitle}</h1>
          <p className="text-muted text-sm mt-1">{t.newsSubtitle}</p>
        </header>

        <Suspense fallback={null}>
          <NewsTabs locale={locale} active="upcoming" />
        </Suspense>

        <div className="mb-5">
          <Suspense fallback={null}>
            <FilterBar groups={groups} resetLabel={t.filtersReset} keep={["tab"]} />
          </Suspense>
        </div>

        {items.length === 0 ? (
          <p className="text-center text-muted py-20">
            {type === "all" && lib === "all" ? t.newsEmpty : t.newsFilterEmpty}
          </p>
        ) : (
          <NewsList
            items={items}
            locale={locale}
            counts={reactions.counts}
            mine={[...reactions.mine]}
            followed={followed}
          />
        )}
      </div>
    );
  }

  // ---------- تبويبا لوحة الصدارة ----------
  const days = RANGE_DAYS[range];

  const [community, global] = await Promise.all([
    tab === "rated" ? getTopRated(days) : getMostWatched(days),
    (tab === "rated" ? topRatedThisWeek() : mostPopularThisWeek()).catch(
      () => [] as SearchResult[],
    ),
  ]);

  const entries = mergeLeaders({ community, global, type, source });

  const groups: FilterGroup[] = [
    typeGroup,
    {
      param: "range",
      label: t.filterRange,
      options: [
        { value: "week", label: t.rangeWeek },
        { value: "month", label: t.rangeMonth },
        { value: "all", label: t.rangeAll },
      ],
    },
    {
      param: "src",
      label: t.filterSource,
      options: [
        { value: "all", label: t.sourceAll },
        { value: "community", label: t.sourceCommunity },
        { value: "global", label: t.sourceGlobal },
      ],
    },
  ];

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">{t.newsTitle}</h1>
        <p className="text-muted text-sm mt-1">
          {tab === "rated" ? t.leaderRatedSub : t.leaderWatchedSub}
        </p>
      </header>

      <Suspense fallback={null}>
        <NewsTabs locale={locale} active={tab} />
      </Suspense>

      <div className="mb-5">
        <Suspense fallback={null}>
          <FilterBar groups={groups} resetLabel={t.filtersReset} keep={["tab"]} />
        </Suspense>
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-muted py-20">{t.leaderEmpty}</p>
      ) : (
        <Leaderboard
          entries={entries}
          locale={locale}
          metric={tab === "rated" ? "rating" : "watch"}
          inLibrary={followed}
        />
      )}
    </div>
  );
}
