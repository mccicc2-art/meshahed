import { shownProgressFor, skipModeOf } from "@/lib/skipProgress";
import {
  getProfile,
  getFollows,
  getWatchSummary,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
  getMyTitleArt,
  getMyAnimeFlags,
  getMyFavorites,
  getMyLists,
  getSavedListsCount,
  getFollowedArtists,
  getWatchedKeysForShows,
  artKey,
} from "@/lib/data";
import { getTv } from "@/lib/tmdb";
import { nextUnwatchedEpisode } from "@/core/progress";
import { skipKeysForTv } from "@/core/skipProgress";
import { showStatusOf, movieStatusOf, watchStateOf } from "@/core/libraryStatus";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale, getTabPrefs, getHiddenRails } from "@/lib/locale";
import { defaultTab, applyTabPrefs } from "@/core/tabPrefs";
import { viewerIsPlus } from "@/lib/actions";
import { sanitizeUiState } from "@/lib/uiState";
import { liveTour } from "@/core/tour";
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

    /* 🆕 D-947 — **عدّادا التبويبَين الرابع والخامس في الموجة نفسِها** كما في
       الصفحة (D-128/D-374: الثقيلُ مشروطٌ بتبويبه، **والعدّادُ لا**):
       `getMyLists` و`getSavedListsCount` و`getFollowedArtists(60)` نداءاتُ
       Supabase خفيفةٌ بلا TMDB. والصفوفُ المخفيّةُ وبلس للشاشة كما للصفحة. */
    const [followRows, summary, movieIds, locale, myArt, animeFlags, favorites, tabPrefs, lists, savedCount, artistRows, hiddenRails, plus, profileRow] =
      await Promise.all([
        getFollows(),
        getWatchSummary(),
        getWatchedMovieIds(),
        getLocale(),
        getMyTitleArt(),
        getMyAnimeFlags(),
        getMyFavorites(),
        getTabPrefs("library"),
        getMyLists().catch(() => []),
        getSavedListsCount().catch(() => 0),
        getFollowedArtists(60).catch(() => []),
        getHiddenRails().catch(() => new Set<string>()),
        viewerIsPlus().catch(() => false),
        /* D-954 — `getProfile` مخبّأةٌ للطلب (`cache`) فلا رحلةَ إضافيّةً فعليّاً */
        getProfile().catch(() => null),
      ]);
    /* 🆕 D-1623 — من اختار إخفاء الفلر/الذهبيّ يرى عدَّ صفحة العمل (بلا المخفيّ) — لأعمال القوائم وحدَها، في الموجة نفسِها */
    const rewatch = new Map<number, string>();
    for (const f of followRows) if (f.media_type === "tv" && f.rewatch_started_at) rewatch.set(f.tmdb_id, f.rewatch_started_at);
    /* 🆕 T492 — **قرصُ «الحلقة التالية»** (أحمد ٢٠ نوفمبر: «بدل كم باقي حلقة اكتب وين واصل» — «S2 E6»): المرشَّحون مسلسلاتٌ جاريةٌ
       بدأها صاحبُها (`summary` بلا عدِّ الإخفاء — مجموعةٌ أوسع تُصفّى بشرط البطاقة بعدُ)، **في الموجة الثانية نفسِها** فلا تزيد
       الردَّ إلا بأبطأ نداء: تفاصيلُ العمل من خبيئة TMDB (`getTv` — ما تناديه «تابِع المشاهدة» لكلّ عملٍ أصلاً) ومفاتيحُ المشاهدة
       باستعلامٍ واحد. الحدُّ ٨٠ بأحدث مشاهدة، وكلُّ تفاصيلٍ تتأخّر ثانيةً ونصفاً ⇐ `null` فلا قرصَ لها، لا ردٌّ عالق. */
    const started = new Map<number, string | null>();
    if (summary) for (const r of summary) if (r.watched > 0) started.set(r.show_tmdb_id, r.last_watched);
    const nextIds = followRows
      .filter((f) => f.media_type === "tv" && !f.dropped && (!summary || started.has(f.tmdb_id)))
      .sort((a, b) => (started.get(b.tmdb_id) ?? "").localeCompare(started.get(a.tmdb_id) ?? ""))
      .slice(0, NEXT_CAP)
      .map((f) => f.tmdb_id);
    const mode = skipModeOf(profileRow);
    const [localized, shown, nextEp] = await Promise.all([
      localizeFollows(followRows, locale),
      shownProgressFor(followRows.filter((f) => f.media_type === "tv" && !f.dropped).map((f) => f.tmdb_id), mode, rewatch),
      nextEpisodes(nextIds, rewatch, mode).catch(() => new Map<number, { s: number; e: number } | null>()),
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
    const items: LibraryItem[] = followRows.map((f, n) => {
      const isTv = f.media_type === "tv";
      const sh = isTv ? shown.get(f.tmdb_id) : undefined;
      const raw = isTv ? watchedByShow.get(f.tmdb_id) : undefined;
      const w = raw && sh ? { ...raw, watched: sh.watched } : raw;
      /* الصفُّ بمعروضه بعد الإخفاء — فـ«مكتمل» يعني ما يعنيه في صفحة العمل */
      const fs = sh ? { ...f, aired_episodes: sh.aired } : f;
      const movieWatched = !isTv && movieIds.has(f.tmdb_id);
      const status = isTv ? showStatusOf(fs, w?.watched ?? 0) : movieStatusOf(f, movieWatched);
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
        aired: isTv ? (sh?.aired ?? f.aired_episodes ?? f.total_episodes ?? 0) : 1,
        next_air_date: f.next_air_date ?? null,
        last_watched: w?.last ?? null,
        rewatch_count: f.rewatch_count ?? 0,
        display_title: loc?.title ?? f.title,
        display_poster_path: art?.poster_path ?? loc?.poster_path ?? f.poster_path,
        is_anime: animeFlags.get(key) ?? null,
        is_favorite: favorites.has(key),
        paused: isTv && status === "watching" && watchStateOf(fs, w?.watched ?? 0) === "paused",
        next_ep: isTv ? (nextEp.get(f.tmdb_id) ?? null) : undefined,
      };
    });
    const dt = defaultTab(tabPrefs, "shows");
    const ALL: LibraryTab[] = ["shows", "movies", "anime", "artists", "lists"];
    const isTab = (k: string): k is LibraryTab => (ALL as string[]).includes(k);
    /* الشريطُ بترتيب صاحبه — **والمخفيُّ يبقى في الردّ معلَماً**: الشاشةُ
       تعرف أنّ المفتوحَ لا يُخفى من نفسه (`applyTabPrefs` بلا `active`). */
    const ordered = applyTabPrefs(ALL.map((key) => ({ key })), tabPrefs.map((p) => ({ ...p, hidden: false })));
    const hiddenTabs = new Set(tabPrefs.filter((p) => p.hidden).map((p) => p.key));
    const tabs = ordered.map((x) => ({ key: x.key, hidden: hiddenTabs.has(x.key) }));
    const payload: LibraryPayload = {
      items,
      counts,
      default_tab: isTab(dt) ? dt : ("shows" satisfies LibraryTab),
      tabs,
      artist_count: artistRows.length,
      list_count: lists.length + savedCount,
      anime_unknown: items.filter((x) => x.is_anime === null).length,
      hidden_rails: [...hiddenRails],
      plus,
      hints: sanitizeUiState(profileRow?.ui_state).hints,
      tour: liveTour(sanitizeUiState(profileRow?.ui_state).tour),
    };
    return ok(payload);
  });
}

/** T492 — أقصى ما يُحسب له قرصُ «الحلقة التالية» في الطلب الواحد */
const NEXT_CAP = 80;
/** T492 — مهلةُ تفاصيل العمل الواحد: خبيئةٌ تردّ في أجزاء الثانية، ورحلةُ TMDB باردةٌ لا تحبس المكتبة */
const NEXT_WAIT_MS = 1_500;

/**
 * T492 — الحلقةُ التالية لكلّ مسلسل: **`nextUnwatchedEpisode` نفسُها** التي تكتب «S2 E6» في «تابِع المشاهدة»، والمخفيُّ بالفلر
 * لا يُقترح (`skipKeysForTv`) — فما يقوله القرصُ هو ما تقوله الرئيسيّةُ وصفحةُ العمل.
 */
async function nextEpisodes(
  ids: readonly number[],
  rewatch: ReadonlyMap<number, string>,
  mode: ReturnType<typeof skipModeOf>,
): Promise<Map<number, { s: number; e: number } | null>> {
  const out = new Map<number, { s: number; e: number } | null>();
  if (!ids.length) return out;
  const timeout = <T,>(p: Promise<T>) =>
    Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), NEXT_WAIT_MS))]);
  const [keys, tvs] = await Promise.all([
    getWatchedKeysForShows(ids, rewatch),
    Promise.all(ids.map((id) => timeout(getTv(id)).catch(() => null))),
  ]);
  ids.forEach((id, n) => {
    const tv = tvs[n];
    if (!tv) return out.set(id, null);
    const next = nextUnwatchedEpisode(tv, keys.get(id) ?? new Set(), skipKeysForTv(tv, mode));
    out.set(id, next ? { s: next.season, e: next.episode } : null);
  });
  return out;
}
