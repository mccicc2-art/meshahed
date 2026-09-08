import {
  getFollows,
  getWatchSummary,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
  getMyTitleArt,
  getMyAnimeFlags,
  getMyFavorites,
  artKey,
} from "@/lib/data";
import { showStatusOf, movieStatusOf } from "@/core/libraryStatus";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale, getTabPrefs } from "@/lib/locale";
import { defaultTab } from "@/core/tabPrefs";
import { localizeFollows } from "@/lib/localize";
import type {
  LibraryItem,
  LibraryPayload,
  LibraryStatus,
  LibraryTab,
} from "@/core/contracts/library";

/**
 * `GET /api/v1/me/library` — كلُّ ما أتابعه بحالته.
 *
 * 🔑 **الملخّصُ من Postgres لا من الصفوف** (`watch_summary`): صفٌّ لكلِّ
 * مسلسلٍ بدل صفٍّ لكلِّ حلقة — وهو ما تفعله المكتبةُ في الويب منذ جولة
 * الأداء. **والسقوطُ إلى العدِّ اليدويّ** إن غابت الدالّةُ، كما هناك.
 *
 * ⚠️ **لا صورَ ولا TMDB هنا**: الإحصاءاتُ مخزّنةٌ في `follows` نفسِه
 * (`aired_episodes` · `next_air_date`) — **فالمكتبةُ صفرُ رحلاتٍ خارجيّة.**
 *
 * 🆕 Phase 11 · B1 — **حقولُ التكافؤ** (B0 §٢ الفجوات ١ و٣ و٤ و٥ و٦، قرارُ
 * المراجع `5576037708`): **الموجةُ نفسُها التي تجمعها صفحةُ المكتبة**
 * (`localizeFollows` · `getMyTitleArt` · `getMyAnimeFlags` · `getMyFavorites`)
 * تُضاف إلى `Promise.all` **فلا تزيد زمنَ الردّ إلا بأبطأ نداء** — والقيمُ
 * حرفاً ما تعرضه الصفحة: **مصدرٌ واحدٌ للحقيقة، لا ترجمةٌ ثانية في الشاشة.**
 * `localizeFollows` هي دالّةُ الصفحة نفسُها (بحدِّها ٢٤ وتخبئتها) — **فما لا
 * تناديه الصفحةُ من TMDB لا يناديه هذا المسار.** والتبويبُ الافتراضيُّ من
 * الكوكي كما في الصفحة؛ **وطلبٌ بـ`Bearer` بلا كوكي يعود `shows`** — وهو
 * السقوطُ نفسُه للزائر الجديد.
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:library:${auth.user.id}`, 60, 60_000);
    if (lim) return lim;

    const [followRows, summary, movieIds, locale, myArt, animeFlags, favorites, tabPrefs] =
      await Promise.all([
        getFollows(),
        getWatchSummary(),
        getWatchedMovieIds(),
        getLocale(),
        getMyTitleArt(),
        getMyAnimeFlags(),
        getMyFavorites(),
        getTabPrefs("library"),
      ]);
    const localized = await localizeFollows(followRows, locale);

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
    const items: LibraryItem[] = followRows.map((f, n) => {
      const isTv = f.media_type === "tv";
      const w = isTv ? watchedByShow.get(f.tmdb_id) : undefined;
      const movieWatched = !isTv && movieIds.has(f.tmdb_id);
      const status = isTv ? showStatusOf(f, w?.watched ?? 0) : movieStatusOf(f, movieWatched);
      counts[status] += 1;
      const key = artKey(f.media_type, f.tmdb_id);
      /* الصفُّ المترجَم يقابل الخامَ بموضعه: `localizeFollows` تعيد المصفوفةَ
         نفسَها ترتيباً (تستبدل عناصرَ لا تحذف) — كما تعتمد عليه الصفحة. */
      const loc = localized[n];
      const art = myArt.get(key);
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
        display_title: loc?.title ?? f.title,
        display_poster_path: art?.poster_path ?? loc?.poster_path ?? f.poster_path,
        is_anime: animeFlags.get(key) ?? null,
        is_favorite: favorites.has(key),
      };
    });
    const dt = defaultTab(tabPrefs, "shows");
    const payload: LibraryPayload = {
      items,
      counts,
      default_tab: dt === "movies" || dt === "anime" ? dt : ("shows" satisfies LibraryTab),
    };
    return ok(payload);
  });
}
