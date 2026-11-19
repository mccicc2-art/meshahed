import "server-only";

import {
  getFollows,
  getWatchSummary,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
  getMyAnimeFlags,
  getMyRatings,
  getTitleMetaFor,
} from "@/lib/data";
import { showStatusOf, movieStatusOf } from "@/core/libraryStatus";
import { localizeFollows } from "@/lib/localize";
import type { Locale } from "@/core/i18n";
import type { PickerItem } from "@/core/contracts/library";

/**
 * ====== 🆕 T450 — أعمالُ مكتبتك لاختيار «قائمة جديدة» ======
 *
 * **لماذا ملفٌّ وحدَه**: الويبُ (`/lists/new`) والتطبيقُ (`GET /api/v1/lists/picker`) يقرآن القائمةَ نفسَها (D-145)،
 * والفلاترُ (النوع · التصنيف · الحقبة · تقييمي) تُطبَّق في الجهاز — **فالحمولةُ تحمل ما تحتاجه دفعةً واحدة**.
 *
 * 🔑 **من جداولنا وحدَها، بلا نداء TMDB**: الحالةُ بقاعدة المكتبة نفسِها (`showStatusOf`/`movieStatusOf`)، والسنةُ
 * من `title_meta`، والاسمُ والملصقُ بلغة القارئ (`localizeFollows`). **و«آخرُ نشاط»** آخرُ حلقةٍ شوهدت، وإلّا
 * تاريخُ الإضافة — فرقاقةُ «شاهدتها مؤخراً» ترتّب بما فعلتَه لا بما أضفتَه.
 */
export async function getPickerItems(locale: Locale): Promise<PickerItem[]> {
  const [follows, summary, watchedMovies, animeFlags, ratings] = await Promise.all([
    getFollows(),
    getWatchSummary(),
    getWatchedMovieIds(),
    getMyAnimeFlags(),
    getMyRatings(),
  ]);
  if (!follows.length) return [];

  const byShow = new Map<number, { watched: number; last: string | null }>();
  if (summary) {
    for (const r of summary) byShow.set(r.show_tmdb_id, { watched: r.watched, last: r.last_watched });
  } else {
    for (const e of await getAllWatchedEpisodes()) {
      const cur = byShow.get(e.show_tmdb_id) ?? { watched: 0, last: null };
      cur.watched += 1;
      if (!cur.last || e.watched_at > cur.last) cur.last = e.watched_at;
      byShow.set(e.show_tmdb_id, cur);
    }
  }
  const my = new Map<string, number>();
  for (const r of ratings) my.set(`${r.media_type}-${r.tmdb_id}`, r.rating);

  const [localized, meta] = await Promise.all([
    localizeFollows(follows, locale),
    getTitleMetaFor(follows.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id }))).catch(() => new Map()),
  ]);

  return follows
    .map((f, n) => {
      const key = `${f.media_type}-${f.tmdb_id}`;
      const isTv = f.media_type === "tv";
      const w = isTv ? byShow.get(f.tmdb_id) : undefined;
      const status = isTv ? showStatusOf(f, w?.watched ?? 0) : movieStatusOf(f, watchedMovies.has(f.tmdb_id));
      const loc = localized[n];
      const m = meta.get(key) as { release_year?: number | null } | undefined;
      return {
        id: f.tmdb_id,
        kind: f.media_type,
        title: loc?.title ?? f.title,
        poster_path: loc?.poster_path ?? f.poster_path,
        status,
        last: (w?.last && w.last > f.added_at ? w.last : f.added_at) ?? f.added_at,
        genres: f.genres ?? [],
        year: m?.release_year ?? null,
        my: my.get(key) ?? null,
        anime: animeFlags.get(key) === true,
      } satisfies PickerItem;
    })
    .sort((a, b) => (b.last > a.last ? 1 : b.last < a.last ? -1 : 0));
}
