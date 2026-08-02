import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  getProfile,
  getFollows,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
  getAllMovieProgress,
} from "@/lib/data";
import { Avatar } from "@/components/Avatar";
import { PosterCard } from "@/components/PosterCard";
import { GENRES } from "@/lib/tmdb";

function fmtHours(minutes: number) {
  const h = Math.round(minutes / 60);
  if (h < 24) return `${h} ساعة`;
  const d = Math.floor(h / 24);
  return `${d} يوم و ${h % 24} س`;
}

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const [profile, follows, watchedEps, watchedMovieIds, movieProgress] = await Promise.all([
    getProfile(),
    getFollows(),
    getAllWatchedEpisodes(),
    getWatchedMovieIds(),
    getAllMovieProgress(),
  ]);

  const displayName = profile?.nickname || user.email?.split("@")[0] || "مستخدم";
  const username = profile?.username;

  const tv = follows.filter((f) => f.media_type === "tv");
  const movies = follows.filter((f) => f.media_type === "movie");

  const watchedByShow = new Map<number, number>();
  for (const w of watchedEps)
    watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);

  const epMinutes = watchedEps.reduce((s, e) => s + (e.runtime ?? 40), 0);
  const totalMinutes = epMinutes + watchedMovieIds.size * 110;

  const stats = [
    { label: "وقت المشاهدة", value: fmtHours(totalMinutes), icon: "⏱️" },
    { label: "حلقة", value: watchedEps.length.toLocaleString("ar"), icon: "✅" },
    { label: "مسلسل", value: tv.length.toLocaleString("ar"), icon: "📺" },
    { label: "فيلم", value: movies.length.toLocaleString("ar"), icon: "🎬" },
  ];

  const favNames = GENRES.filter((g) => profile?.favorite_genres?.includes(g.id));

  return (
    <div className="space-y-10">
      {/* رأس البروفايل */}
      <section className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-5 flex-wrap">
          <Avatar src={profile?.avatar_url} name={displayName} size={96} />

          <div className="flex-1 min-w-[12rem]">
            <h1 className="text-2xl font-bold">{displayName}</h1>
            {username && <p className="text-muted text-sm mt-0.5" dir="ltr">@{username}</p>}
            <p className="text-xs text-muted mt-1">{user.email}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href="/profile/edit"
              className="px-5 py-2.5 rounded-xl bg-accent text-[#1a1200] font-semibold text-sm hover:brightness-110 transition text-center"
            >
              تعديل الملف الشخصي
            </Link>
            <Link
              href="/profile/settings"
              className="px-5 py-2.5 rounded-xl bg-surface-2 border border-border text-sm hover:border-accent transition text-center"
            >
              إعدادات الحساب
            </Link>
          </div>
        </div>

        {favNames.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-border">
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
      </section>

      {/* الإحصائيات */}
      <section>
        <h2 className="text-lg font-bold mb-4">الإحصائيات</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface border border-border rounded-2xl p-5">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-xs text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* المسلسلات */}
      <section>
        <h2 className="text-lg font-bold mb-4">المسلسلات التي أشاهدها ({tv.length})</h2>
        {tv.length ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {tv.map((f) => {
              const c = watchedByShow.get(f.tmdb_id) ?? 0;
              return (
                <PosterCard
                  key={f.tmdb_id}
                  href={`/show/${f.tmdb_id}`}
                  title={f.title}
                  posterPath={f.poster_path}
                  badge={c > 0 ? `${c} حلقة` : undefined}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-muted text-sm">لم تتابع أي مسلسل بعد.</p>
        )}
      </section>

      {/* الأفلام */}
      <section>
        <h2 className="text-lg font-bold mb-4">الأفلام التي أشاهدها ({movies.length})</h2>
        {movies.length ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {movies.map((f) => {
              const prog = movieProgress.find((p) => p.movie_tmdb_id === f.tmdb_id);
              const pct =
                prog?.runtime_minutes && prog.runtime_minutes > 0
                  ? Math.round((prog.position_minutes / prog.runtime_minutes) * 100)
                  : undefined;
              return (
                <PosterCard
                  key={f.tmdb_id}
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
          </div>
        ) : (
          <p className="text-muted text-sm">لم تضف أي فيلم بعد.</p>
        )}
      </section>

      <form action="/auth/signout" method="post" className="sm:hidden">
        <button className="w-full py-3 rounded-xl border border-border text-muted hover:text-red-300 hover:border-red-400/60 transition">
          تسجيل الخروج
        </button>
      </form>
    </div>
  );
}
