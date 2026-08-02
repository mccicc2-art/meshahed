import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { num, type Dict } from "@/lib/i18n";

function fmtWatchTime(minutes: number, t: Dict) {
  const h = Math.round(minutes / 60);
  if (h < 24) return t.hours(h);
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest === 0 ? t.days(d) : t.daysAndHours(d, rest);
}

export default async function StatsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  const [follows, watchedEps, watchedMovieIds] = await Promise.all([
    getFollows(),
    getAllWatchedEpisodes(),
    getWatchedMovieIds(),
  ]);

  const totalEpisodes = watchedEps.length;
  // متوسط مدة الحلقة 40 دقيقة إن لم تتوفر المدة الفعلية
  const epMinutes = watchedEps.reduce((sum, e) => sum + (e.runtime ?? 40), 0);
  const distinctShows = new Set(watchedEps.map((e) => e.show_tmdb_id)).size;
  const movieCount = watchedMovieIds.size;
  const totalMinutes = epMinutes + movieCount * 110;

  const stats = [
    { label: t.statsWatchMinutes, value: fmtWatchTime(totalMinutes, t), icon: "⏱️" },
    { label: t.statsWatchedEpisodes, value: num(totalEpisodes, locale), icon: "✅" },
    { label: t.statsStartedShows, value: num(distinctShows, locale), icon: "📺" },
    { label: t.statsWatchedMovies, value: num(movieCount, locale), icon: "🎬" },
    { label: t.statsFollowing, value: num(follows.length, locale), icon: "⭐" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t.statsTitle}</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-2xl p-5">
            <div className="text-3xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm text-muted mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {totalEpisodes === 0 && movieCount === 0 && (
        <p className="text-center text-muted py-10">{t.statsEmpty}</p>
      )}
    </div>
  );
}
