import {
  getFollows,
  getMyRatings,
  getWatchedMovies,
  watchedMovieMinutes,
  getAllMovieProgress,
  getAllWatchedEpisodes,
  getWatchHistory,
} from "@/lib/data";
import { getTv, getMovie } from "@/lib/tmdb";
import { posterUrl } from "@/lib/media";
import Image from "next/image";
import { getDict, num, type Locale } from "@/lib/i18n";
import { isComplete } from "@/lib/progress";
import { Icon, type IconName } from "./Icon";

/** المدى الزمنيّ الذي تحكمه تبويبات الصفحة */
export type StatsRange = "all" | "year" | "month";

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

/**
 * **حلقةُ وقت المشاهدة.**
 *
 * ⚠️ **والقوسُ رقمٌ لا زينة**: يرسم **نصيبَ المدى المختار من وقتك
 * كلِّه** — «٢٠٢٦» ثُلثُ الحلقة لأن ثلث ساعاتك فيها، **والكلُّ حلقةٌ
 * كاملة لأنه الكلّ.** **وقوسٌ يمتلئ بلا مقامٍ يُعرف زخرفةٌ تدّعي
 * المعنى** — وهو ما يمنعه هذا التطبيق في كل رسمٍ فيه.
 */
function Ring({ share, label, value }: { share: number; label: string; value: string }) {
  const R = 66;
  const C = 2 * Math.PI * R;
  const on = Math.max(0, Math.min(1, share)) * C;
  return (
    <div className="relative shrink-0 w-[164px] h-[164px] grid place-items-center">
      <svg viewBox="0 0 164 164" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx="82"
          cy="82"
          r={R}
          fill="none"
          strokeWidth="11"
          className="stroke-[color:var(--accent)]"
          opacity="0.18"
        />
        <circle
          cx="82"
          cy="82"
          r={R}
          fill="none"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${on} ${C - on}`}
          className="stroke-[color:var(--accent)]"
        />
      </svg>
      {/* 🔴 🆕 **قيدُ عرضِ القلب شرطُ الالتفاف** (D-606، بلاغُ أحمد
          بلقطةٍ عربيّة: «125 يوم و 18 س» تفيض خارج الحلقة والشاشة):
          عنصرُ الشبكة الموسَّط يأخذ عرضَ محتواه الأقصى **فسطرٌ أطولُ
          من الحلقة لا يلتفّ بل يفيض** — والإنجليزيّة «125d 18h» أقصرُ
          فلم يُرَ العطل. **والقيدُ قطرُ الحلقة الداخليُّ نفسُه**
          (2×(66−5.5) ≈ 121) فالنصُّ الطويل يلتفّ سطرين وسطَها. */}
      <div className="text-center leading-none max-w-[120px]">
        <div className="text-24 font-extrabold tabular-nums leading-tight">{value}</div>
        <div className="text-12 text-muted mt-1.5">{label}</div>
        <Icon name="clock" size={18} className="mx-auto mt-2 text-accent" />
      </div>
    </div>
  );
}

/** خانةٌ في شبكة الأرقام — رمزٌ ملوّن، رقمٌ عريض، اسمٌ خافت */
function Cell({
  icon,
  color,
  value,
  label,
  border,
}: {
  icon: IconName;
  color: string;
  value: string;
  label: string;
  border: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 py-3 px-1 ${border}`}>
      <Icon name={icon} size={20} style={{ color }} />
      <span className="text-20 font-extrabold leading-none tabular-nums">{value}</span>
      <span className="text-12 text-muted leading-none truncate max-w-full">{label}</span>
    </div>
  );
}

/**
 * تحليل المكتبة — **شكلُ الصفحة كما رسمه أحمد** (D-493).
 *
 * يطلب تفاصيل TMDB لكل عمل تتابعه — وهو ما تتجنّبه بقية صفحة المكتبة عمداً.
 * لذلك يُغلَّف بـ Suspense في الصفحة: الترويسةُ والتبويبات تُرسم فوراً،
 * والتحليل يصل بعدها.
 *
 * ⚠️ **والحلقاتُ تُقرأ كاملةً لا بسقفِ ألف** (`getAllWatchedEpisodes`
 * المُرقِّمة): **الرقمُ المعروض قبل اليوم كان «١٠٠٠ حلقة» بالضبط** —
 * وهو سقفُ الاستعلام لا عددُ ما شاهده. **ورقمٌ يساوي سقفَه ليس رقماً،
 * هو الحدُّ يرتدي زيَّ حقيقة.**
 */
export async function LibraryAnalysis({
  locale,
  range = "all",
}: {
  locale: Locale;
  range?: StatsRange;
}) {
  const t = getDict(locale);

  const [follows, ratings, episodes, watchedMovies, movieProgress, history] = await Promise.all([
    getFollows(),
    getMyRatings(),
    getAllWatchedEpisodes(),
    getWatchedMovies(),
    getAllMovieProgress(),
    getWatchHistory(1000),
  ]);

  if (!follows.length) {
    return <p className="text-sm text-muted text-center py-10">{t.analysisEmpty}</p>;
  }

  const watchedMovieIds = new Set(watchedMovies.map((m) => m.id));
  const movieMinutes = watchedMovieMinutes(watchedMovies);

  const watchedByShow = new Map<number, number>();
  let epMinutes = 0;
  for (const w of episodes) {
    watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
    epMinutes += w.runtime ?? 40;
  }
  const totalMinutes = epMinutes + movieMinutes;

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

  /* ===== المدى المختار =====
     **البادئةُ نصٌّ لا تاريخ**: `watched_at` نصٌّ ISO، **ومقارنةُ
     بادئةٍ أرخصُ من بناء `Date` لكلِّ صفٍّ من آلاف** — ولا منطقةَ
     زمنيّةً تنزلق تحتها. */
  const nowY = new Date().getUTCFullYear();
  const monthKey = new Date().toISOString().slice(0, 7);
  const prefix = range === "year" ? String(nowY) : range === "month" ? monthKey : "";

  const inRange = (iso: string) => prefix === "" || iso.startsWith(prefix);

  const rangeEpRows = prefix ? episodes.filter((e) => inRange(e.watched_at)) : episodes;
  const rangeEpisodes = rangeEpRows.length;
  const rangeEpMinutes = rangeEpRows.reduce((n, e) => n + (e.runtime ?? 40), 0);

  /* ⚠️ **والأفلامُ من السجلّ لأنه وحدَه يحمل تاريخَها** — وهي عشراتٌ
     لا آلاف، **فسقفُ الألف لا يبلغها** (بخلاف الحلقات أعلاه). */
  const movieHistory = history.filter((h) => h.kind === "movie");
  const rangeMovieRows = prefix ? movieHistory.filter((h) => inRange(h.watchedAt)) : movieHistory;
  const rangeMovies = prefix ? rangeMovieRows.length : watchedMovieIds.size;
  const rangeMovieMinutes = prefix
    ? rangeMovieRows.reduce((n, h) => n + (h.runtime ?? 110), 0)
    : movieMinutes;

  const rangeMinutes = rangeEpMinutes + rangeMovieMinutes;
  const rangeTitles = prefix
    ? new Set([
        ...rangeEpRows.map((e) => `tv-${e.show_tmdb_id}`),
        ...rangeMovieRows.map((h) => `mv-${h.tmdbId}`),
      ]).size
    : follows.length;

  const rangeRatings = prefix ? ratings.filter((r) => inRange(r.updated_at)) : ratings;
  const rangeAvg = rangeRatings.length
    ? rangeRatings.reduce((n, r) => n + r.rating, 0) / rangeRatings.length
    : 0;

  // ===== ملخّص السنة — سطرٌ واحد تحت الأرقام =====
  const yearRows = episodes.filter((e) => e.watched_at.startsWith(String(nowY)));
  const yearEpisodes = yearRows.length;
  const yearMovies = movieHistory.filter((h) => h.watchedAt.startsWith(String(nowY))).length;
  const yearMinutes =
    yearRows.reduce((n, e) => n + (e.runtime ?? 40), 0) +
    movieHistory
      .filter((h) => h.watchedAt.startsWith(String(nowY)))
      .reduce((n, h) => n + (h.runtime ?? 110), 0);

  // ===== الأنواع من TMDB (عيّنة ٤٠ لكلِّ نوعٍ كما كانت) =====
  const [tvDetails, movieDetails] = await Promise.all([
    Promise.all(tvFollows.slice(0, 40).map((f) => getTv(f.tmdb_id).catch(() => null))),
    Promise.all(movieFollows.slice(0, 40).map((f) => getMovie(f.tmdb_id).catch(() => null))),
  ]);
  const genreTally = new Map<string, number>();
  let genreTags = 0;
  for (const d of [...tvDetails, ...movieDetails]) {
    for (const g of d?.genres ?? []) {
      genreTally.set(g.name, (genreTally.get(g.name) ?? 0) + 1);
      genreTags++;
    }
  }
  const topGenres = [...genreTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  // ===== الأكثر مشاهدة: ثلاثةٌ بملصقاتها =====
  const showById = new Map(tvFollows.map((f) => [f.tmdb_id, f]));
  const topWatched = [...watchedByShow.entries()]
    .filter(([id, n]) => n > 0 && showById.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topMax = topWatched[0]?.[1] ?? 0;

  const statusTotal = done + inProgress + notStarted;
  const ratedTotal = ratings.length;
  const avgAll = ratedTotal ? ratings.reduce((n, r) => n + r.rating, 0) / ratedTotal : 0;

  const divider = "border-[color:var(--divider)]";

  return (
    <div className="space-y-6">
      {/* ===== الحلقةُ وشبكةُ الأرقام ===== */}
      <div className="flex items-center gap-3 sm:gap-6">
        <Ring
          share={range === "all" ? 1 : totalMinutes > 0 ? rangeMinutes / totalMinutes : 0}
          label={t.statWatchTime}
          value={fmtWatchTime(rangeMinutes, t)}
        />
        <div className="grid grid-cols-2 flex-1 min-w-0">
          <Cell
            icon="play"
            color="var(--info)"
            value={num(rangeEpisodes, locale)}
            label={t.statsWatchedEpisodes}
            border=""
          />
          <Cell
            icon="film"
            color="var(--accent-2)"
            value={num(rangeMovies, locale)}
            label={t.shortMovies}
            border={`border-s ${divider}`}
          />
          <Cell
            icon="star"
            color="var(--accent-2)"
            value={num(rangeTitles, locale)}
            label={t.statsCellTitles}
            border={`border-t ${divider}`}
          />
          <Cell
            icon="sparkle-star"
            color="var(--verified)"
            value={rangeRatings.length ? rangeAvg.toFixed(1) : "—"}
            label={t.statsCellRating}
            border={`border-s border-t ${divider}`}
          />
        </div>
      </div>

      {/* ===== سطرُ السنة — «ما جمعتَه منذ يناير» في أربع خانات ===== */}
      <div className={`grid grid-cols-4 items-center border-y ${divider} py-3`}>
        <span className="flex items-center gap-2 px-1 min-w-0">
          <Icon name="calendar" size={18} className="text-accent shrink-0" />
          <span className="text-12 font-bold leading-tight">{t.statsSoFar(nowY)}</span>
        </span>
        {[
          { v: num(yearEpisodes, locale), l: t.statsWatchedEpisodes },
          { v: num(yearMovies, locale), l: t.shortMovies },
          { v: fmtWatchTime(yearMinutes, t), l: t.statWatchTime },
        ].map((c) => (
          <span key={c.l} className={`text-center border-s ${divider} px-1 min-w-0`}>
            <b className="block text-14 font-extrabold tabular-nums leading-none">{c.v}</b>
            <span className="block text-12 text-muted mt-1 truncate">{c.l}</span>
          </span>
        ))}
      </div>

      {/* ===== الأكثر مشاهدة ===== */}
      {topWatched.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-22 font-bold mb-3">
            <Icon name="film" size={20} className="text-accent" />
            {t.statsTopShows}
          </h2>
          <div className="space-y-3">
            {topWatched.map(([id, n], i) => {
              const f = showById.get(id)!;
              const url = posterUrl(f.poster_path, "w185");
              return (
                <div key={id} className="flex items-center gap-3">
                  <span className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-surface-2 border border-border">
                    {url && (
                      <Image src={url} alt="" fill sizes="48px" className="object-cover" />
                    )}
                  </span>
                  <span
                    className="shrink-0 grid place-items-center w-6 h-6 rounded-full border border-border text-12 font-bold tabular-nums text-muted"
                    dir="ltr"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-14 font-semibold truncate" dir="auto">
                        {f.title}
                      </span>
                      <span className="shrink-0 text-end leading-tight">
                        <b className="block text-14 font-extrabold tabular-nums">
                          {num(n, locale)}
                        </b>
                        <span className="block text-12 text-muted">
                          {t.statsWatchedEpisodes}
                        </span>
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${Math.max(Math.round((n / topMax) * 100), 4)}%` }}
                      />
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== ذوقُك: الأنواع يساراً، وأين وقفت يميناً ===== */}
      {(topGenres.length > 0 || statusTotal > 0) && (
        <section>
          <h2 className="flex items-center gap-2 text-22 font-bold mb-3">
            <Icon name="sparkles" size={20} className="text-accent" />
            {t.analysisTaste}
          </h2>
          {/* 🆕 **وعمودان على كلِّ مقاسٍ لا من `sm` فصاعداً** (D-503،
              لقطةُ أحمد بدائرةٍ حمراء على اللوح: «خلّها مثل كذا عشان
              تصير في صفحة وحدة»): **الأنواعُ الثلاثةُ فوق الحالة**
              كانت تُنزل ذيلَ التقييمات خارج الشاشة — **ونصفُ عرضٍ يكفي
              اسمَ نوعٍ ونسبتَه**، والشريطُ الأفقيُّ للحالة أصلاً يعمل
              في أيِّ عرض. */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2.5">
              {topGenres.map(([name, count]) => (
                <div key={name}>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-12 truncate" dir="auto">
                      {name}
                    </span>
                    <span className="text-12 text-muted shrink-0 tabular-nums">
                      {pct(count, genreTags)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(pct(count, genreTags), 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {statusTotal > 0 && (
              <div className={`border-s ${divider} ps-4 sm:ps-6`}>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-2">
                  {[
                    { v: done, c: "bg-[color:var(--success)]" },
                    { v: inProgress, c: "bg-accent" },
                    { v: notStarted, c: "bg-[color:var(--disabled)]" },
                  ].map((s, i) =>
                    s.v > 0 ? (
                      <div key={i} className={s.c} style={{ width: `${pct(s.v, statusTotal)}%` }} />
                    ) : null,
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    { l: t.statusDone, v: done, c: "bg-[color:var(--success)]" },
                    { l: t.statusWatching, v: inProgress, c: "bg-accent" },
                    { l: t.statusNotStarted, v: notStarted, c: "bg-[color:var(--disabled)]" },
                  ].map((s) => (
                    <div key={s.l} className="flex items-center gap-2 text-12">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.c}`} aria-hidden />
                      <span className="flex-1 truncate">{s.l}</span>
                      <span className="text-muted tabular-nums shrink-0">
                        {pct(s.v, statusTotal)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* 🆕 ⚖️ **وذيلُ التقييمات دخل اللوحَ نفسَه** (D-503): كان
              قسماً مستقلّاً تحته بخطٍّ فاصل، **فيقع خارج الشاشة في
              لقطة أحمد ويُقرأ نصفَ سطر.** **وهو جملةٌ عن ذوقك لا قسمٌ
              قائمٌ بذاته** — **وسطرٌ واحدٌ لا يستحقّ عنواناً ولا
              فاصلاً.** */}
          {ratedTotal > 0 && (
            <div className={`mt-3 flex items-center gap-3 border-t ${divider} pt-3`}>
              <span className="flex gap-0.5 shrink-0" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <Icon key={i} name="star" size={16} style={{ color: "var(--verified)" }} />
                ))}
              </span>
              <span className="text-12 text-muted">
                {t.ratedCount(ratedTotal)} · {t.avgRatingLabel(avgAll.toFixed(1))}
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** هيكل عظمي بنفس ارتفاع التحليل تقريباً حتى لا تقفز الصفحة عند وصوله */
export function LibraryAnalysisSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-[164px] h-[164px] rounded-full bg-surface-2 shrink-0" />
        <div className="flex-1 h-[164px] rounded-2xl bg-surface-2" />
      </div>
      <div className="h-16 rounded-2xl bg-surface-2" />
      <div className="h-44 rounded-2xl bg-surface-2" />
      <div className="h-40 rounded-2xl bg-surface-2" />
    </div>
  );
}
