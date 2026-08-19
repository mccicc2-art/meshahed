import {
  getFollows,
  getMyRatings,
  getWatchSummary,
  getWatchedMovies,
  watchedMovieMinutes,
  getAllMovieProgress,
  getAllWatchedEpisodes,
  getWatchHistory,
} from "@/lib/data";
import { getTv, getMovie } from "@/lib/tmdb";
import { getDict, num, type Locale } from "@/lib/i18n";
import { isComplete } from "@/lib/progress";
import { Icon, type IconName } from "./Icon";

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function fmtWatchTime(minutes: number, t: ReturnType<typeof getDict>) {
  const h = Math.round(minutes / 60);
  if (h < 24) return t.hours(h);
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest === 0 ? t.days(d) : t.daysAndHours(d, rest);
}

/** شريط أفقي بنسبة — يُقرأ أسرع من رقم مجرّد لأن الطول نفسه هو المقارنة */
function Bar({
  label,
  value,
  total,
  color = "bg-accent",
  suffix,
  locale,
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
  suffix?: string;
  locale: Locale;
}) {
  const p = pct(value, total);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-xs truncate">{label}</span>
        <span className="text-12 text-muted shrink-0 tabular-nums">
          {num(value, locale)}
          {suffix ? ` ${suffix}` : ""} · {p}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        {/* صفر يعني صفر — الحد الأدنى ٢٪ كان يرسم نقطة تحت تقييم لا وجود له */}
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: value === 0 ? "0%" : `${Math.max(p, 2)}%` }}
        />
      </div>
    </div>
  );
}

/** شريط واحد مقسّم — للمقارنات ذات الفئات القليلة */
function Split({
  segments,
  locale,
}: {
  segments: { label: string; value: number; color: string }[];
  locale: Locale;
}) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-surface-2">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.label}
              className={s.color}
              style={{ width: `${pct(s.value, total)}%` }}
              title={`${s.label}: ${s.value}`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-12 text-muted">
            <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} aria-hidden />
            {s.label}
            <b className="text-foreground tabular-nums">{num(s.value, locale)}</b>
            <span className="tabular-nums">({pct(s.value, total)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
      <h3 className="text-sm font-bold">{title}</h3>
      {hint && <p className="text-12 text-muted mt-0.5 mb-4 leading-relaxed">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </section>
  );
}

/**
 * تحليل المكتبة.
 *
 * يطلب تفاصيل TMDB لكل عمل تتابعه — وهو ما تتجنّبه بقية صفحة المكتبة عمداً.
 * لذلك يُغلَّف بـ Suspense في الصفحة: المكتبة تُرسم فوراً، والتحليل يصل بعدها.
 * وردود TMDB مخزّنة ساعة، والصفحة الرئيسية تطلب نفس الأعمال، فالغالب أن
 * الطلبات مخدومة من الذاكرة لا من الشبكة.
 */
export async function LibraryAnalysis({ locale }: { locale: Locale }) {
  const t = getDict(locale);

  const [follows, ratings, summary, watchedMovies, movieProgress, history] = await Promise.all([
    getFollows(),
    getMyRatings(),
    getWatchSummary(),
    getWatchedMovies(),
    getAllMovieProgress(),
    getWatchHistory(1000),
  ]);

  // مجموعة المعرّفات للحالة (شوهد؟)، والدقائق الفعلية للوقت — من الصفوف نفسها
  const watchedMovieIds = new Set(watchedMovies.map((m) => m.id));
  const movieMinutes = watchedMovieMinutes(watchedMovies);

  if (!follows.length) {
    return <p className="text-sm text-muted text-center py-10">{t.analysisEmpty}</p>;
  }

  const watchedByShow = new Map<number, number>();
  let epMinutes = 0;
  let totalEpisodes = 0;

  if (summary) {
    for (const s of summary) {
      watchedByShow.set(s.show_tmdb_id, s.watched);
      totalEpisodes += s.watched;
      epMinutes += s.minutes;
    }
  } else {
    for (const w of await getAllWatchedEpisodes()) {
      watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
      epMinutes += w.runtime ?? 40;
      totalEpisodes++;
    }
  }

  const tvFollows = follows.filter((f) => f.media_type === "tv");
  const movieFollows = follows.filter((f) => f.media_type === "movie");
  const startedMovieIds = new Set(movieProgress.map((m) => m.movie_tmdb_id));

  // ===== أين وصلت =====
  let done = 0;
  let inProgress = 0;
  let notStarted = 0;

  for (const f of tvFollows) {
    const w = watchedByShow.get(f.tmdb_id) ?? 0;
    const aired = f.aired_episodes ?? f.total_episodes ?? 0;
    if (isComplete(w, aired)) done++;
    else if (w > 0) inProgress++;
    else notStarted++;
  }
  for (const f of movieFollows) {
    if (watchedMovieIds.has(f.tmdb_id)) done++;
    else if (startedMovieIds.has(f.tmdb_id)) inProgress++;
    else notStarted++;
  }

  // ===== الأنواع والسنوات من TMDB =====
  // سقف ٤٠ لكل نوع (كسقف localizeFollows): مكتبة من ٣٠٠ عمل كانت تطلق
  // ٣٠٠ طلب متزامن فتصطدم بحدود TMDB ويعلق الهيكل — عيّنة الأحدث تكفي
  // لرسم توزيع الأنواع والعقود
  const [tvDetails, movieDetails] = await Promise.all([
    Promise.all(tvFollows.slice(0, 40).map((f) => getTv(f.tmdb_id).catch(() => null))),
    Promise.all(movieFollows.slice(0, 40).map((f) => getMovie(f.tmdb_id).catch(() => null))),
  ]);

  const genreTally = new Map<string, number>();
  const decadeTally = new Map<number, number>();
  let genreTags = 0;

  for (const d of tvDetails) {
    for (const g of d?.genres ?? []) {
      genreTally.set(g.name, (genreTally.get(g.name) ?? 0) + 1);
      genreTags++;
    }
    const y = Number(d?.first_air_date?.slice(0, 4));
    if (y) decadeTally.set(Math.floor(y / 10) * 10, (decadeTally.get(Math.floor(y / 10) * 10) ?? 0) + 1);
  }
  for (const d of movieDetails) {
    for (const g of d?.genres ?? []) {
      genreTally.set(g.name, (genreTally.get(g.name) ?? 0) + 1);
      genreTags++;
    }
    const y = Number(d?.release_date?.slice(0, 4));
    if (y) decadeTally.set(Math.floor(y / 10) * 10, (decadeTally.get(Math.floor(y / 10) * 10) ?? 0) + 1);
  }

  const topGenres = [...genreTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const decades = [...decadeTally.entries()].sort((a, b) => b[0] - a[0]);
  const decadeTotal = decades.reduce((n, [, v]) => n + v, 0);

  // ===== التقييمات =====
  const buckets = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((star) => ({
    star,
    count: ratings.filter((r) => r.rating === star).length,
  }));
  const ratedTotal = ratings.length;
  const avg = ratedTotal ? ratings.reduce((n, r) => n + r.rating, 0) / ratedTotal : 0;

  // الوقت الكلّي = دقائق الحلقات + دقائق الأفلام الفعلية (لا تقدير ١١٠ الثابت)
  const totalMinutes = epMinutes + movieMinutes;

  // ===== الملخّص السنوي =====
  // من بداية السنة الميلادية: السجلّ يحمل الطابع الزمني، فالحساب من
  // البيانات نفسها لا من عدّاد يُخزَّن ويُنسى تحديثه
  const yearNow = new Date().getUTCFullYear();
  const yearRows = history.filter((h) => h.watchedAt.slice(0, 4) === String(yearNow));
  const yearEpisodes = yearRows.filter((h) => h.kind === "episode").length;
  const yearMovies = yearRows.filter((h) => h.kind === "movie").length;
  const yearMinutes = yearRows.reduce((n, h) => n + (h.runtime ?? (h.kind === "movie" ? 110 : 40)), 0);

  const monthTally = new Map<string, number>();
  for (const h of yearRows) {
    const m = h.watchedAt.slice(0, 7);
    monthTally.set(m, (monthTally.get(m) ?? 0) + 1);
  }
  const busiest = [...monthTally.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const busiestName = busiest
    ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
        month: "long",
        timeZone: "UTC",
        calendar: "gregory",
      }).format(new Date(`${busiest[0]}-01T00:00:00Z`))
    : "";

  const headline: { label: string; value: string; icon: IconName; color: string }[] = [
    {
      label: t.statWatchTime,
      value: fmtWatchTime(totalMinutes, t),
      icon: "clock",
      color: "var(--accent)",
    },
    {
      label: t.statsWatchedEpisodes,
      value: num(totalEpisodes, locale),
      icon: "check",
      color: "var(--info)",
    },
    {
      label: t.statsWatchedMovies,
      value: num(watchedMovieIds.size, locale),
      icon: "film",
      color: "var(--accent-2)",
    },
    {
      label: t.statsFollowing,
      value: num(follows.length, locale),
      icon: "star",
      color: "var(--brand-3)",
    },
  ];

  // ===== الأكثر مشاهدة: خمسة مسلسلات بعدد حلقاتها =====
  const titleByShow = new Map(tvFollows.map((f) => [f.tmdb_id, f.title]));
  const topWatched = [...watchedByShow.entries()]
    .filter(([id, n]) => n > 0 && titleByShow.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topMax = topWatched[0]?.[1] ?? 0;

  return (
    <div className="space-y-4">
      {/* الأرقام الإجمالية — انتقلت من الرئيسية إلى هنا، حيث يُنظر إليها بقصد */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {headline.map((h) => (
          <div key={h.label} className="bg-surface border border-border rounded-2xl p-3 sm:p-4">
            <Icon name={h.icon} size={18} style={{ color: h.color }} />
            <div className="text-20 sm:text-2xl font-rabold mt-1.5 leading-none tabular-nums">
              {h.value}
            </div>
            <div className="text-12 text-muted mt-1 leading-tight">{h.label}</div>
          </div>
        ))}
      </div>

      {/* الملخّص السنوي أولاً: هو أكثر ما يُفتَح لأجله هذا القسم */}
      <Card title={t.yearTitle(yearNow)} hint={t.yearSub}>
        {yearRows.length === 0 ? (
          <p className="text-xs text-muted">{t.yearNone}</p>
        ) : (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <span>
              <b className="text-2xl font-extrabold">{num(yearEpisodes, locale)}</b>{" "}
              <span className="text-xs text-muted">{t.yearEpisodes}</span>
            </span>
            <span>
              <b className="text-2xl font-extrabold">{num(yearMovies, locale)}</b>{" "}
              <span className="text-xs text-muted">{t.yearMovies}</span>
            </span>
            <span>
              <b className="text-2xl font-extrabold">{fmtWatchTime(yearMinutes, t)}</b>
            </span>
            {busiest && (
              <span className="text-xs text-muted">
                {t.yearBusiest}: <b className="text-foreground">{busiestName}</b>
              </span>
            )}
          </div>
        )}
      </Card>

      {/* الأكثر مشاهدة: الطول هو المقارنة — أطول شريط = أكثر حلقات */}
      {topWatched.length > 0 && (
        <Card title={t.statsTopShows} hint={t.statsTopShowsSub}>
          <div className="space-y-3.5">
            {topWatched.map(([id, n], i) => (
              <div key={id}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-xs truncate">
                    <span className="text-muted tabular-nums me-1.5" dir="ltr">
                      {i + 1}.
                    </span>
                    {titleByShow.get(id)}
                  </span>
                  <span className="text-12 text-muted shrink-0 tabular-nums">
                    {t.diaryEpsGrouped(n)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(Math.round((n / topMax) * 100), 4)}%`,
                      background:
                        "linear-gradient(90deg, var(--accent), var(--accent-2))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t.analysisMix}>
          <Split
            locale={locale}
            segments={[
              { label: t.libShowsGroup, value: tvFollows.length, color: "bg-accent" },
              { label: t.libMoviesGroup, value: movieFollows.length, color: "bg-[color:var(--success)]" },
            ]}
          />
        </Card>

        <Card title={t.analysisStatus}>
          <Split
            locale={locale}
            segments={[
              { label: t.statusDone, value: done, color: "bg-[color:var(--success)]" },
              { label: t.statusWatching, value: inProgress, color: "bg-accent" },
              { label: t.statusNotStarted, value: notStarted, color: "bg-muted/40" },
            ]}
          />
        </Card>
      </div>

      {topGenres.length > 0 && (
        <Card title={t.analysisTaste} hint={t.analysisTasteSub}>
          <div className="space-y-3">
            {topGenres.map(([name, count]) => (
              <Bar
                key={name}
                label={name}
                value={count}
                total={genreTags}
                locale={locale}
                color="bg-accent"
              />
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ratedTotal > 0 && (
          <Card
            title={t.analysisRatings}
            hint={`${t.avgRatingLabel(avg.toFixed(1))} · ${t.ratedCount(ratedTotal)}`}
          >
            <div className="space-y-3">
              {buckets.map((b) => (
                <Bar
                  key={b.star}
                  label={`★ ${b.star}/10`}
                  value={b.count}
                  total={ratedTotal}
                  locale={locale}
                  color="bg-accent-2"
                />
              ))}
            </div>
          </Card>
        )}

        {decades.length > 0 && (
          <Card title={t.analysisDecades}>
            <div className="space-y-3">
              {decades.map(([decade, count]) => (
                <Bar
                  key={decade}
                  label={`${decade}s`}
                  value={count}
                  total={decadeTotal}
                  locale={locale}
                  color="bg-accent"
                />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/** هيكل عظمي بنفس ارتفاع التحليل تقريباً حتى لا تقفز الصفحة عند وصوله */
export function LibraryAnalysisSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[86px] bg-surface border border-border rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 bg-surface border border-border rounded-2xl" />
        <div className="h-32 bg-surface border border-border rounded-2xl" />
      </div>
      <div className="h-72 bg-surface border border-border rounded-2xl" />
    </div>
  );
}
