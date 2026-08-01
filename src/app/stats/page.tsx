import { redirect } from "next/navigation";
import {
  getUser,
  getFollows,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
} from "@/lib/data";

function fmtHours(minutes: number) {
  const h = Math.round(minutes / 60);
  if (h < 24) return `${h} ساعة`;
  const d = Math.floor(h / 24);
  return `${d} يوم و ${h % 24} ساعة`;
}

export default async function StatsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

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
    { label: "دقائق المشاهدة", value: fmtHours(totalMinutes), icon: "⏱️" },
    { label: "حلقات مشاهَدة", value: totalEpisodes.toLocaleString("ar"), icon: "✅" },
    { label: "مسلسلات بدأتها", value: distinctShows.toLocaleString("ar"), icon: "📺" },
    { label: "أفلام شاهدتها", value: movieCount.toLocaleString("ar"), icon: "🎬" },
    { label: "أعمال تتابعها", value: follows.length.toLocaleString("ar"), icon: "⭐" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">الإحصائيات</h1>

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
        <p className="text-center text-muted py-10">
          ابدأ بتأشير الحلقات والأفلام لتظهر إحصائياتك.
        </p>
      )}
    </div>
  );
}
