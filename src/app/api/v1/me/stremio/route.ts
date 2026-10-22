import { getProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getMovie, getSeason, getTv } from "@/lib/tmdb";
import { stremioLinkOf } from "@/lib/stremio";
import { handle, requireUser, limited } from "@/lib/v1";
import { isPlus } from "@/core/plan";
import { ok } from "@/core/contracts/result";
import type { StremioSignal, StremioState } from "@/core/contracts/stremio";

const PAGE = 50;

type Row = { id: number; media_type: "tv" | "movie"; tmdb_id: number; season: number | null; episode: number | null; seen_at: string };

/**
 * `GET /api/v1/me/stremio` — حالةُ الربط والإشاراتُ المنتظرةُ **المشغَّلة** (`played_at`) (بطاقةُ الرئيسيّة وقائمةُ «عرض الكل» وشاشةُ الربط).
 *
 * 🔑 **ما شوهد منذ الفتح لا يُسأل عنه**: عضوٌ فتح E5 في Stremio ثمّ علّمها في Loopz بيده — الإشارةُ تُغلق هنا صامتةً
 * (`watched`) بدل سؤالٍ عن شيءٍ أجاب عنه (قرار ٩). والصورةُ 16:9: لقطةُ الحلقة، وإلّا خلفيّةُ العمل، وإلّا الملصق (قرار ٧).
 * ⚖️ أسماءُ الأعمال من TMDB بوضع أسماء العضو (`tmdb()`) ومخبَّأةٌ ساعة — خمسون إشارةً أقصى ما يُرسم.
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:stremio:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    const uid = auth.user.id;
    const [profile, link] = await Promise.all([getProfile(), stremioLinkOf(uid)]);
    const plus = isPlus(profile);
    const supabase = await createClient();
    const { data, count } = await supabase
      .from("watch_signals")
      .select("id, media_type, tmdb_id, season, episode, seen_at", { count: "exact" })
      .match({ user_id: uid, state: "pending" })
      /* 🆕 «أ مع ج» — يُسأل عمّا شُغّل لا عمّا فُتح: فتحُ الصفحة ثمّ الخروج ليس سؤالاً */
      .not("played_at", "is", null)
      .order("seen_at", { ascending: false })
      .limit(PAGE);
    let rows = (data ?? []) as Row[];
    let total = count ?? rows.length;

    /* ما عُلِّم بعد الفتح يُغلق صامتاً */
    const shows = [...new Set(rows.filter((r) => r.media_type === "tv").map((r) => r.tmdb_id))];
    const movies = [...new Set(rows.filter((r) => r.media_type === "movie").map((r) => r.tmdb_id))];
    const [eps, mvs] = await Promise.all([
      shows.length
        ? supabase.from("watched_episodes").select("show_tmdb_id, season_number, episode_number").eq("user_id", uid).in("show_tmdb_id", shows).limit(20_000)
        : Promise.resolve({ data: [] }),
      movies.length
        ? supabase.from("watched_movies").select("movie_tmdb_id").eq("user_id", uid).in("movie_tmdb_id", movies)
        : Promise.resolve({ data: [] }),
    ]);
    const seenEp = new Set(((eps.data ?? []) as { show_tmdb_id: number; season_number: number; episode_number: number }[]).map((w) => `${w.show_tmdb_id}:${w.season_number}:${w.episode_number}`));
    const seenMv = new Set(((mvs.data ?? []) as { movie_tmdb_id: number }[]).map((w) => w.movie_tmdb_id));
    const done = rows.filter((r) => (r.media_type === "movie" ? seenMv.has(r.tmdb_id) : seenEp.has(`${r.tmdb_id}:${r.season}:${r.episode}`)));
    if (done.length) {
      await supabase
        .from("watch_signals")
        .update({ state: "watched", answered_at: new Date().toISOString() })
        .eq("user_id", uid)
        .eq("state", "pending")
        .in("id", done.map((r) => r.id));
      const gone = new Set(done.map((r) => r.id));
      rows = rows.filter((r) => !gone.has(r.id));
      total = Math.max(0, total - done.length);
    }

    const tv = new Map(await Promise.all(shows.map(async (id) => [id, await getTv(id).catch(() => null)] as const)));
    const mv = new Map(await Promise.all(movies.map(async (id) => [id, await getMovie(id).catch(() => null)] as const)));
    const seasonKeys = [...new Set(rows.filter((r) => r.media_type === "tv" && tv.get(r.tmdb_id)).map((r) => `${r.tmdb_id}:${r.season}`))];
    const seasons = new Map(
      await Promise.all(
        seasonKeys.map(async (k) => {
          const [id, s] = k.split(":").map(Number);
          return [k, await getSeason(id, s).catch(() => null)] as const;
        }),
      ),
    );

    const items: StremioSignal[] = [];
    for (const r of rows) {
      if (r.media_type === "tv") {
        const show = tv.get(r.tmdb_id);
        if (!show) continue;
        const still = seasons.get(`${r.tmdb_id}:${r.season}`)?.episodes?.find((e) => e.episode_number === r.episode)?.still_path ?? null;
        items.push({
          id: r.id,
          kind: "tv",
          tmdb_id: r.tmdb_id,
          title: show.name,
          image_path: still ?? show.backdrop_path ?? show.poster_path ?? null,
          season: r.season,
          episode: r.episode,
          seen_at: r.seen_at,
        });
      } else {
        const m = mv.get(r.tmdb_id);
        if (!m) continue;
        items.push({
          id: r.id,
          kind: "movie",
          tmdb_id: r.tmdb_id,
          title: m.title,
          image_path: m.backdrop_path ?? m.poster_path ?? null,
          season: null,
          episode: null,
          seen_at: r.seen_at,
        });
      }
    }
    const state: StremioState = { plus, linked: !!link, linked_at: link?.linked_at ?? null, items, count: Math.max(total, items.length) };
    return ok(state);
  });
}
