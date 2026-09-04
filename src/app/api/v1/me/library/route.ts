import {
  getFollows,
  getWatchSummary,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
} from "@/lib/data";
import { showStatusOf, movieStatusOf } from "@/core/libraryStatus";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { LibraryItem, LibraryPayload, LibraryStatus } from "@/core/contracts/library";

/**
 * `GET /api/v1/me/library` — كلُّ ما أتابعه بحالته.
 *
 * 🔑 **الملخّصُ من Postgres لا من الصفوف** (`watch_summary`): صفٌّ لكلِّ
 * مسلسلٍ بدل صفٍّ لكلِّ حلقة — وهو ما تفعله المكتبةُ في الويب منذ جولة
 * الأداء. **والسقوطُ إلى العدِّ اليدويّ** إن غابت الدالّةُ، كما هناك.
 *
 * ⚠️ **لا صورَ ولا TMDB هنا**: الإحصاءاتُ مخزّنةٌ في `follows` نفسِه
 * (`aired_episodes` · `next_air_date`) — **فالمكتبةُ صفرُ رحلاتٍ خارجيّة.**
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:library:${auth.user.id}`, 60, 60_000);
    if (lim) return lim;

    const [follows, summary, movieIds] = await Promise.all([
      getFollows(),
      getWatchSummary(),
      getWatchedMovieIds(),
    ]);

    // خريطةُ العدّ: من الملخّص، وإلا من الصفوف الخام (السقوطُ نفسُه في الويب)
    const watchedByShow = new Map<number, { watched: number; last: string | null }>();
    if (summary) {
      for (const r of summary)
        watchedByShow.set(r.show_tmdb_id, { watched: r.watched, last: r.last_watched });
    } else {
      for (const e of await getAllWatchedEpisodes()) {
        const cur = watchedByShow.get(e.show_tmdb_id) ?? { watched: 0, last: null };
        cur.watched += 1;
        if (!cur.last || e.watched_at > cur.last) cur.last = e.watched_at;
        watchedByShow.set(e.show_tmdb_id, cur);
      }
    }

    const counts: Record<LibraryStatus, number> = {
      watching: 0,
      unstarted: 0,
      completed: 0,
      dropped: 0,
    };
    const items: LibraryItem[] = follows.map((f) => {
      const isTv = f.media_type === "tv";
      const w = isTv ? watchedByShow.get(f.tmdb_id) : undefined;
      const movieWatched = !isTv && movieIds.has(f.tmdb_id);
      const status = isTv ? showStatusOf(f, w?.watched ?? 0) : movieStatusOf(f, movieWatched);
      counts[status] += 1;
      return {
        kind: f.media_type,
        id: f.tmdb_id,
        title: f.title,
        poster_path: f.poster_path,
        added_at: f.added_at,
        status,
        watched: isTv ? (w?.watched ?? 0) : movieWatched ? 1 : 0,
        aired: isTv ? (f.aired_episodes ?? f.total_episodes ?? 0) : 1,
        next_air_date: f.next_air_date ?? null,
        last_watched: w?.last ?? null,
        rewatch_count: f.rewatch_count ?? 0,
      };
    });
    const payload: LibraryPayload = { items, counts };
    return ok(payload);
  });
}
