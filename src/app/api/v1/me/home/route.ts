import {
  getFollows,
  getWatchSummary,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
  getWatchedForShow,
} from "@/lib/data";
import { getTv } from "@/lib/tmdb";
import { nextUnwatchedEpisode } from "@/core/progress";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type {
  ContinueItem,
  HomePayload,
  StartItem,
  WeekEpisode,
} from "@/core/contracts/home";

/**
 * `GET /api/v1/me/home` — الرئيسيةُ في التطبيق: ثلاثةُ صفوفٍ في ردٍّ واحد (D-919).
 *
 * 🔑 **الترشيحُ من القاعدة قبل TMDB**: `follows` تحمل `aired_episodes`
 * و`next_air_date`، فمن يُكمَل ومن يُذاع هذا الأسبوع يُعرفان بلا رحلة —
 * **ثمّ تُطلب تفاصيلُ TMDB للمرشَّحين وحدَهم** (١٢ + من يُذاع)، لا للمكتبة.
 * وهو ترتيبُ الرئيسية في الويب نفسُه (`CONTINUE_PROBE`).
 *
 * 🔑 **الحلقةُ التالية بالدالّة الواحدة** `nextUnwatchedEpisode` (D-603/D-374):
 * تمشي على نافذة كلِّ موسمٍ الحقيقيّة ولا تقترح حلقةً لم تُذَع.
 *
 * ⚠️ **الفشلُ في عملٍ واحدٍ لا يُسقط الصفّ**: `getTv` قد يخفق لعملٍ
 * حُذف من TMDB — فيسقط هو وحدَه.
 */
const CONTINUE_MAX = 12;
const START_MAX = 12;
const WEEK_DAYS = 7;

export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:home:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;

    const [follows, summary, movieIds] = await Promise.all([
      getFollows(),
      getWatchSummary(),
      getWatchedMovieIds(),
    ]);

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

    const live = follows.filter((f) => !f.dropped);
    const airedOf = (f: (typeof follows)[number]) => f.aired_episodes ?? f.total_episodes ?? 0;

    // ——— ١) أكمل المشاهدة: بدأتُه ولم ألحق بكلِّ ما أُذيع ———
    const continueCandidates = live
      .filter((f) => f.media_type === "tv")
      .map((f) => ({ f, w: watchedByShow.get(f.tmdb_id) }))
      .filter(({ f, w }) => (w?.watched ?? 0) > 0 && (w?.watched ?? 0) < airedOf(f))
      .sort((a, b) => (b.w?.last ?? "").localeCompare(a.w?.last ?? ""))
      .slice(0, CONTINUE_MAX);

    const cont = await Promise.all(
      continueCandidates.map(async ({ f, w }): Promise<ContinueItem | null> => {
        try {
          const [tv, keys] = await Promise.all([
            getTv(f.tmdb_id),
            getWatchedForShow(f.tmdb_id, f.rewatch_started_at ?? null),
          ]);
          const next = nextUnwatchedEpisode(tv, keys);
          return {
            id: f.tmdb_id,
            title: f.title,
            poster_path: f.poster_path,
            backdrop_path: tv.backdrop_path ?? null,
            next: next
              ? { season: next.season, episode: next.episode, runtime: tv.episode_run_time?.[0] ?? null }
              : null,
            watched: w?.watched ?? 0,
            aired: airedOf(f),
            last_watched: w?.last ?? null,
          };
        } catch {
          return null;
        }
      }),
    );

    // ——— ٢) أسبوعك: حلقاتٌ تُذاع خلال سبعة أيّام ———
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + WEEK_DAYS * 864e5).toISOString().slice(0, 10);
    const weekCandidates = live.filter(
      (f) => f.media_type === "tv" && f.next_air_date && f.next_air_date >= from && f.next_air_date <= to,
    );
    const week = await Promise.all(
      weekCandidates.map(async (f): Promise<WeekEpisode | null> => {
        try {
          const tv = await getTv(f.tmdb_id);
          const n = tv.next_episode_to_air;
          return {
            id: f.tmdb_id,
            title: f.title,
            poster_path: f.poster_path,
            air_date: n?.air_date ?? f.next_air_date!,
            season: n?.season_number ?? null,
            episode: n?.episode_number ?? null,
            name: n?.name ?? null,
          };
        } catch {
          return {
            id: f.tmdb_id,
            title: f.title,
            poster_path: f.poster_path,
            air_date: f.next_air_date!,
            season: null,
            episode: null,
            name: null,
          };
        }
      }),
    );

    // ——— ٣) ابدأ: ما أضفتُه ولم ألمسه ———
    const start: StartItem[] = live
      .filter((f) =>
        f.media_type === "tv"
          ? (watchedByShow.get(f.tmdb_id)?.watched ?? 0) === 0
          : !movieIds.has(f.tmdb_id),
      )
      .sort((a, b) => b.added_at.localeCompare(a.added_at))
      .slice(0, START_MAX)
      .map((f) => ({
        kind: f.media_type,
        id: f.tmdb_id,
        title: f.title,
        poster_path: f.poster_path,
        added_at: f.added_at,
      }));

    const payload: HomePayload = {
      continue: cont.filter((x): x is ContinueItem => x !== null),
      week: week
        .filter((x): x is WeekEpisode => x !== null)
        .sort((a, b) => a.air_date.localeCompare(b.air_date)),
      start,
    };
    return ok(payload);
  });
}
