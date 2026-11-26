import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getFollows, getMyAnimeFlags, getProfile, getTitleMetaFor, getUserId, getWatchSummary, type FollowRow } from "@/lib/data";
import { shownProgressFor, skipModeOf } from "@/lib/skipProgress";
import { localizeFollows } from "@/lib/localize";
import { sanitizeUiState } from "@/lib/uiState";
import type { Locale } from "@/core/i18n";
import {
  pickToRate,
  rateCardShown,
  rateKey,
  type RateQueueItem,
  type RateQueuePayload,
  type RateSource,
} from "@/core/rateQueue";

/**
 * ====== 🆕 T530 — «بانتظار تقييمك» من جداولنا وحدَها ======
 *
 * الوقائعُ ثلاثة: المكتبة (`follows`) والمشاهدة (`watch_summary` · `watched_movies`) والتقييمات (`ratings`)، والقرارُ في
 * `core/rateQueue.ts` (`pickToRate`). **بلا نداء TMDB** إلّا ترجمةَ الاسم والملصق بلغة القارئ (`localizeFollows`)، وهي ما
 * تفعله «قائمة جديدة» على المكتبة كلِّها (`listPicker.ts`).
 *
 * 🔴 **التقييماتُ كلُّها لا أوّلُ مئتين**: `getMyRatings` مقصوصةٌ عند ٢٠٠ (محرّكُ الاقتراحات)، ومن قيّم ٣١٢ عملاً كان سيُسأل عن
 * ١١٢ قيّمها. فالمفاتيحُ تُقرأ هنا صفحةً صفحة.
 */

const PAGE = 1000;

async function pages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

async function ratedKeys(db: SupabaseClient, uid: string): Promise<Set<string>> {
  const rows = await pages<{ tmdb_id: number; media_type: "tv" | "movie" }>((from, to) =>
    db.from("ratings").select("tmdb_id, media_type").eq("user_id", uid).order("tmdb_id").order("media_type").range(from, to),
  );
  return new Set(rows.map((r) => rateKey(r.media_type, r.tmdb_id)));
}

async function watchedMovieDates(db: SupabaseClient, uid: string): Promise<Map<number, string | null>> {
  const rows = await pages<{ movie_tmdb_id: number; watched_at: string | null }>((from, to) =>
    db.from("watched_movies").select("movie_tmdb_id, watched_at").eq("user_id", uid).order("movie_tmdb_id").range(from, to),
  );
  return new Map(rows.map((r) => [r.movie_tmdb_id, r.watched_at]));
}

/** حلقاتُ كلِّ مسلسلٍ وآخرُها — من `watch_summary` (تحترم الإعادة كالمكتبة)، وإلّا عدٌّ من الصفوف */
async function showCounts(
  db: SupabaseClient,
  uid: string,
  viaSummary: boolean,
  /** بدايةُ الإعادة لكلِّ مسلسلٍ يُعاد — ما شوهد قبلها لا يُعدّ، كما في `watch_summary()` حرفاً (مراجعةُ الوكيل، البند ١) */
  rewatchFrom: ReadonlyMap<number, string> = new Map(),
): Promise<Map<number, { watched: number; last: string | null }>> {
  const out = new Map<number, { watched: number; last: string | null }>();
  if (viaSummary) {
    const summary = await getWatchSummary();
    if (summary) {
      for (const r of summary) out.set(r.show_tmdb_id, { watched: r.watched, last: r.last_watched });
      return out;
    }
  }
  const rows = await pages<{ show_tmdb_id: number; watched_at: string | null }>((from, to) =>
    db.from("watched_episodes").select("show_tmdb_id, watched_at").eq("user_id", uid).order("show_tmdb_id").order("season_number").order("episode_number").range(from, to),
  );
  for (const r of rows) {
    const since = rewatchFrom.get(r.show_tmdb_id);
    if (since && (!r.watched_at || r.watched_at < since)) continue;
    const cur = out.get(r.show_tmdb_id) ?? { watched: 0, last: null };
    cur.watched += 1;
    if (r.watched_at && (!cur.last || r.watched_at > cur.last)) cur.last = r.watched_at;
    out.set(r.show_tmdb_id, cur);
  }
  return out;
}

async function followsOf(db: SupabaseClient, uid: string): Promise<(RateSource & { rewatch_started_at: string | null })[]> {
  return pages<RateSource & { rewatch_started_at: string | null }>((from, to) =>
    db
      .from("follows")
      .select("tmdb_id, media_type, title, poster_path, added_at, total_episodes, aired_episodes, dropped, watch_state, rewatch_started_at")
      .eq("user_id", uid)
      .order("added_at", { ascending: false })
      .range(from, to),
  );
}

/**
 * **عددُ ما ينتظر تقييمَ عضوٍ** بعميل الخدمة — للإشعار الأسبوعيّ. الوقائعُ نفسُها والقرارُ نفسُه (`pickToRate`)؛ الفرقُ الوحيد
 * أنّ الحلقات تُعدّ من الصفوف (`watch_summary` دالّةُ الجلسة) — وبشرطها نفسِه: ما شوهد قبل بداية الإعادة لا يُعدّ.
 */
export async function countRateQueueFor(db: SupabaseClient, uid: string, skipped: ReadonlySet<string>): Promise<{ total: number; first: string | null }> {
  const [follows, movies, rated] = await Promise.all([followsOf(db, uid), watchedMovieDates(db, uid), ratedKeys(db, uid)]);
  const rewatchFrom = new Map(
    follows.filter((f) => f.media_type === "tv" && f.rewatch_started_at).map((f) => [f.tmdb_id, f.rewatch_started_at as string]),
  );
  const shows = await showCounts(db, uid, false, rewatchFrom);
  const list = pickToRate({ follows, shows, watchedMovies: movies, rated, skipped });
  return { total: list.length, first: list[0]?.title ?? null };
}

/**
 * **القائمةُ لصاحب الجلسة** — `summary` لبطاقة الرئيسيّة: العددُ وأوّلُ ثلاثةٍ مترجمةً وحدَها (لا ترجمةَ مئتي اسمٍ لبطاقة).
 */
export async function getRateQueue(locale: Locale, o: { summary?: boolean; nowMs?: number } = {}): Promise<RateQueuePayload | null> {
  const uid = await getUserId();
  if (!uid) return null;
  const db = await createClient();
  const follows = await getFollows();
  const rewatchOf = new Map<number, string>();
  for (const f of follows) if (f.media_type === "tv" && f.rewatch_started_at) rewatchOf.set(f.tmdb_id, f.rewatch_started_at);
  const [shows, movies, rated, profile] = await Promise.all([
    /* `rewatchOf` للارتداد وحدَه: إن سقطت `watch_summary` عُدّت الصفوفُ بشرطها نفسِه */
    showCounts(db, uid, true, rewatchOf),
    watchedMovieDates(db, uid),
    ratedKeys(db, uid),
    db.from("profiles").select("ui_state").eq("id", uid).maybeSingle(),
  ]);
  const ui = sanitizeUiState(profile.data?.ui_state);
  /* 🆕 مراجعةُ الوكيل (البند ٧) — **عدُّ المكتبة لمن أخفى الفلر/الذهبيّ** (D-1623، `shownProgressFor`): أنمي أتمّ صاحبُه حلقاتِه
     الأصليّة «مكتملٌ» في المكتبة، فيُسأل عنه هنا أيضاً. الحسابُ نفسُه بسقفه (١٢ عملاً) وبيانات TMDB المخبّأة */
  const shown = await getProfile()
    .catch(() => null)
    .then((p) => shownProgressFor(follows.filter((f) => f.media_type === "tv" && !f.dropped).map((f) => f.tmdb_id), skipModeOf(p), rewatchOf))
    .catch(() => new Map<number, { aired: number; watched: number }>());
  const facts = shown.size
    ? follows.map((f) => {
        const sh = f.media_type === "tv" ? shown.get(f.tmdb_id) : undefined;
        if (!sh) return f;
        shows.set(f.tmdb_id, { watched: sh.watched, last: shows.get(f.tmdb_id)?.last ?? null });
        return { ...f, aired_episodes: sh.aired, total_episodes: sh.aired };
      })
    : follows;
  const picked = pickToRate({
    follows: facts as unknown as RateSource[],
    shows,
    watchedMovies: movies,
    rated,
    skipped: new Set(ui.rateSkip),
  }) as unknown as FollowRow[];

  const total = picked.length;
  const showsN = picked.filter((f) => f.media_type === "tv").length;
  const take = o.summary ? picked.slice(0, 3) : picked;
  const [localized, meta, anime] = await Promise.all([
    localizeFollows(take, locale),
    o.summary ? Promise.resolve(new Map()) : getTitleMetaFor(take.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id }))).catch(() => new Map()),
    /* رزمةُ الأنمي في التطبيق: علَمُ المكتبة نفسُه (`getMyAnimeFlags`، خريطةٌ فارغةٌ إن تعذّر — فيبقى كلُّ شيءٍ في رزمته) */
    o.summary ? Promise.resolve(new Map<string, boolean | null>()) : getMyAnimeFlags().catch(() => new Map<string, boolean | null>()),
  ]);
  const items: RateQueueItem[] = take.map((f, n) => {
    const loc = localized[n];
    const m = meta.get(rateKey(f.media_type, f.tmdb_id)) as { release_year?: number | null } | undefined;
    const at = f.media_type === "tv" ? shows.get(f.tmdb_id)?.last : movies.get(f.tmdb_id);
    return {
      kind: f.media_type,
      id: f.tmdb_id,
      title: loc?.title ?? f.title,
      poster_path: loc?.poster_path ?? f.poster_path,
      year: m?.release_year ?? null,
      at: at || f.added_at,
      ...(anime.get(rateKey(f.media_type, f.tmdb_id)) ? { anime: true } : {}),
    };
  });
  return {
    items,
    total,
    movies: total - showsN,
    shows: showsN,
    card: rateCardShown(total, ui.rateCard, o.nowMs ?? Date.now()),
  };
}
