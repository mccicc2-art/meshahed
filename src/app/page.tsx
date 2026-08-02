import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
  getProfile,
  getAllMovieProgress,
} from "@/lib/data";
import {
  getTv,
  trending,
  discoverByGenres,
  titleOf,
  yearOf,
  posterUrl,
  GENRES,
  type TvDetails,
  type SearchResult,
} from "@/lib/tmdb";
import { PosterCard } from "@/components/PosterCard";
import { Avatar } from "@/components/Avatar";

function fmtHours(minutes: number) {
  const h = Math.round(minutes / 60);
  if (h < 24) return `${h} ساعة`;
  const d = Math.floor(h / 24);
  return `${d} يوم و ${h % 24} س`;
}

export default async function HomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [follows, watchedEps, watchedMovieIds, profile, movieProgress] = await Promise.all([
    getFollows(),
    getAllWatchedEpisodes(),
    getWatchedMovieIds(),
    getProfile(),
    getAllMovieProgress(),
  ]);

  const tvFollows = follows.filter((f) => f.media_type === "tv");
  const movieFollows = follows.filter((f) => f.media_type === "movie");

  const watchedByShow = new Map<number, number>();
  for (const w of watchedEps) {
    watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
  }

  const tvDetails = await Promise.all(
    tvFollows.map((f) => getTv(f.tmdb_id).catch(() => null)),
  );

  type Item = { tv: TvDetails; watched: number; total: number; progress: number };
  const items: Item[] = [];
  const upcoming: { tv: TvDetails; date: string }[] = [];

  for (const tv of tvDetails) {
    if (!tv) continue;
    const watched = watchedByShow.get(tv.id) ?? 0;
    const total = tv.number_of_episodes;
    const progress = total ? Math.round((watched / total) * 100) : 0;
    items.push({ tv, watched, total, progress });
    if (tv.next_episode_to_air?.air_date) {
      upcoming.push({ tv, date: tv.next_episode_to_air.air_date });
    }
  }

  const continueWatching = items
    .filter((i) => i.watched > 0 && i.progress < 100)
    .sort((a, b) => b.progress - a.progress);
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  const empty = follows.length === 0;

  // TMDB خارجي — أي خلل فيه يجب ألا يُسقط الصفحة الرئيسية بالكامل
  const favGenres = profile?.favorite_genres ?? [];
  const followedIds = new Set(follows.map((f) => f.tmdb_id));

  const [trend, suggestedRaw] = await Promise.all([
    trending().catch(() => [] as SearchResult[]),
    favGenres.length
      ? discoverByGenres(favGenres, "tv").catch(() => [] as SearchResult[])
      : Promise.resolve([] as SearchResult[]),
  ]);

  const suggested = suggestedRaw.filter((r) => !followedIds.has(r.id)).slice(0, 12);
  const showTrending = empty || (!suggested.length && continueWatching.length === 0);

  const displayName = profile?.nickname || user.email?.split("@")[0] || "مستخدم";
  const epMinutes = watchedEps.reduce((s, e) => s + (e.runtime ?? 40), 0);
  const totalMinutes = epMinutes + watchedMovieIds.size * 110;
  const favNames = GENRES.filter((g) => favGenres.includes(g.id));

  const stats = [
    { label: "وقت المشاهدة", value: fmtHours(totalMinutes), icon: "⏱️" },
    { label: "حلقة", value: watchedEps.length.toLocaleString("ar"), icon: "✅" },
    { label: "مسلسل", value: tvFollows.length.toLocaleString("ar"), icon: "📺" },
    { label: "فيلم", value: movieFollows.length.toLocaleString("ar"), icon: "🎬" },
  ];

  return (
    <div className="space-y-10">
      {/* بطاقة الملف الشخصي — مدمجة في الرئيسية */}
      <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
          <Avatar src={profile?.avatar_url} name={displayName} size={80} />

          <div className="flex-1 min-w-[10rem]">
            <h1 className="text-xl sm:text-2xl font-bold">{displayName}</h1>
            {profile?.username && (
              <p className="text-muted text-sm mt-0.5" dir="ltr">
                @{profile.username}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link
              href="/profile/edit"
              className="px-4 py-2 rounded-xl bg-accent text-[#1a1200] font-semibold text-sm hover:brightness-110 transition"
            >
              تعديل الملف الشخصي
            </Link>
            <Link
              href="/profile/settings"
              className="px-4 py-2 rounded-xl bg-surface-2 border border-border text-sm hover:border-accent transition"
            >
              إعدادات الحساب
            </Link>
          </div>
        </div>

        {favNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            {favNames.map((g) => (
              <span
                key={g.id}
                className="text-xs bg-surface-2 border border-border px-2.5 py-1 rounded-full"
              >
                {g.emoji} {g.name}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-2 rounded-xl p-3 text-center">
              <div className="text-lg">{s.icon}</div>
              <div className="text-base font-bold mt-0.5">{s.value}</div>
              <div className="text-[11px] text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {empty && (
        <section className="text-center py-4">
          <p className="text-muted">ابدأ بمتابعة مسلسل أو فيلم لتظهر هنا.</p>
        </section>
      )}

      {movieProgress.length > 0 && (
        <Section title="⏸️ أفلام توقّفت عندها">
          {movieProgress.map((m) => {
            const pct =
              m.runtime_minutes && m.runtime_minutes > 0
                ? Math.round((m.position_minutes / m.runtime_minutes) * 100)
                : 0;
            return (
              <PosterCard
                key={`mp-${m.movie_tmdb_id}`}
                href={`/movie/${m.movie_tmdb_id}`}
                title={m.title ?? "فيلم"}
                posterPath={m.poster_path}
                progress={pct}
                badge={`د ${m.position_minutes}`}
              />
            );
          })}
        </Section>
      )}

      {continueWatching.length > 0 && (
        <Section title="أكمل المشاهدة">
          {continueWatching.map(({ tv, progress }) => (
            <PosterCard
              key={tv.id}
              href={`/show/${tv.id}`}
              title={tv.name}
              posterPath={tv.poster_path}
              progress={progress}
              badge={`${progress}%`}
            />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4">🔔 القادم قريباً</h2>
          <div className="space-y-2">
            {upcoming.map(({ tv, date }) => (
              <Link
                key={tv.id}
                href={`/show/${tv.id}`}
                className="flex items-center gap-4 bg-surface border border-border rounded-xl p-3 hover:border-accent/50 transition"
              >
                <div className="w-12 shrink-0">
                  <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-surface-2">
                    {posterUrl(tv.poster_path, "w185") && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={posterUrl(tv.poster_path, "w185")!}
                        alt=""
                        className="object-cover w-full h-full"
                      />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tv.name}</p>
                  <p className="text-xs text-muted">
                    الحلقة {tv.next_episode_to_air?.episode_number} · الموسم{" "}
                    {tv.next_episode_to_air?.season_number}
                  </p>
                </div>
                <span className="text-sm text-accent-2 shrink-0">{date}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* المسلسلات التي أشاهدها */}
      {tvFollows.length > 0 && (
        <Section title={`المسلسلات التي أشاهدها (${tvFollows.length})`}>
          {tvFollows.map((f) => {
            const c = watchedByShow.get(f.tmdb_id) ?? 0;
            return (
              <PosterCard
                key={`tvf-${f.tmdb_id}`}
                href={`/show/${f.tmdb_id}`}
                title={f.title}
                posterPath={f.poster_path}
                badge={c > 0 ? `${c} حلقة` : undefined}
              />
            );
          })}
        </Section>
      )}

      {/* الأفلام التي أشاهدها */}
      {movieFollows.length > 0 && (
        <Section title={`الأفلام التي أشاهدها (${movieFollows.length})`}>
          {movieFollows.map((f) => {
            const prog = movieProgress.find((p) => p.movie_tmdb_id === f.tmdb_id);
            const pct =
              prog?.runtime_minutes && prog.runtime_minutes > 0
                ? Math.round((prog.position_minutes / prog.runtime_minutes) * 100)
                : undefined;
            return (
              <PosterCard
                key={`mvf-${f.tmdb_id}`}
                href={`/movie/${f.tmdb_id}`}
                title={f.title}
                posterPath={f.poster_path}
                progress={pct}
                badge={
                  watchedMovieIds.has(f.tmdb_id)
                    ? "✓ شوهد"
                    : prog
                      ? `د ${prog.position_minutes}`
                      : undefined
                }
              />
            );
          })}
        </Section>
      )}

      {suggested.length > 0 && (
        <Section title="✨ مقترح لك حسب ذوقك">
          {suggested.map((r) => (
            <PosterCard
              key={`sug-${r.id}`}
              href={`/show/${r.id}`}
              title={titleOf(r)}
              posterPath={r.poster_path}
              year={yearOf(r)}
            />
          ))}
        </Section>
      )}

      {favGenres.length === 0 && !empty && (
        <Link
          href="/profile/edit"
          className="block text-center text-sm text-muted hover:text-accent border border-dashed border-border rounded-xl py-4 transition"
        >
          حدّد أنواعك المفضّلة في الملف الشخصي لتظهر لك اقتراحات على ذوقك ←
        </Link>
      )}

      {showTrending && trend.length > 0 && (
        <Section title="🔥 رائج هذا الأسبوع">
          {trend.slice(0, 12).map((r) => (
            <PosterCard
              key={`${r.media_type}-${r.id}`}
              href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`}
              title={titleOf(r)}
              posterPath={r.poster_path}
              year={yearOf(r)}
              badge={r.media_type === "tv" ? "مسلسل" : "فيلم"}
            />
          ))}
        </Section>
      )}

      <form action="/auth/signout" method="post" className="sm:hidden">
        <button className="w-full py-3 rounded-xl border border-border text-muted hover:text-red-300 hover:border-red-400/60 transition">
          تسجيل الخروج
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">{children}</div>
    </section>
  );
}
