import type { NextRequest } from "next/server";
import { getProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getMovie, getSeason, getTv } from "@/lib/tmdb";
import { stremioLinkOf } from "@/lib/stremio";
import { handle, requireUser, limited } from "@/lib/v1";
import { isPlus } from "@/core/plan";
import { ok } from "@/core/contracts/result";
import { signalSourceOf, type StremioSignal, type StremioState } from "@/core/contracts/stremio";

const PAGE = 50;

type Row = { id: number; source?: string | null; media_type: "tv" | "movie"; tmdb_id: number; season: number | null; episode: number | null; seen_at: string; auto?: boolean };

/** ما سُجّل تلقائياً يبقى في البطاقة أسبوعين إن لم يُرَ — بعدها لم يعد خبراً */
const AUTO_DAYS = 14;

/**
 * `GET /api/v1/me/stremio` — حالةُ الربط والإشاراتُ المنتظرةُ **المشغَّلة** (`played_at`) (بطاقةُ الرئيسيّة وقائمةُ «عرض الكل» وشاشةُ الربط).
 *
 * 🔑 **ما شوهد منذ الفتح لا يُسأل عنه**: عضوٌ فتح E5 في Stremio ثمّ علّمها في Loopz بيده — الإشارةُ تُغلق هنا صامتةً
 * (`watched`) بدل سؤالٍ عن شيءٍ أجاب عنه (قرار ٩). والصورةُ 16:9: لقطةُ الحلقة، وإلّا خلفيّةُ العمل، وإلّا الملصق (قرار ٧).
 * ⚖️ أسماءُ الأعمال من TMDB بوضع أسماء العضو (`tmdb()`) ومخبَّأةٌ ساعة — خمسون إشارةً أقصى ما يُرسم.
 * 🆕 **ومصدرُها** (`source`، هجرة ٢٣٥): Stremio أو سيرفرٌ في البيت — البطاقةُ واحدةٌ «من أجهزتك» والمصدرُ سطرٌ فيها.
 */
/**
 * 🆕 T361 — `?auto=1` (التطبيقُ الجديدُ وحدَه): **وما سجّله Loopz بنفسه ولم يره صاحبُه** (`auto_at` · `noticed_at`، هجرة ٢٤٢) يدخل
 * القائمةَ نفسَها بعلامة `auto` — البطاقةُ تعرضه «أضفناه لمكتبتك» بنجومٍ أو «حسناً» لا بـ✓/✕. نسخةٌ أقدمُ لا تطلبه فلا تسأل عمّا
 * عُلِّم. قبل الهجرة لا عمود: القراءةُ تفشل صامتةً والقائمةُ كما كانت.
 */
/**
 * 🆕 T415 (أحمد ١٨ نوفمبر: «يعرض بعد اخر حلقة من المسلسل بحيث يقيم المسلسل كامل» · «أ» · «واذا كان اخر موسم متوفر حاليا ايضا
 * يظهر له تقييم») — هل هذه الحلقةُ نهايةٌ تستحقّ تقييمَ المسلسل؟
 * - يجب أن تكون **آخرَ ما عُرض** (`last_episode_to_air`): نهايةُ موسمٍ قديمٍ ليست نهاية، ولا حلقةٌ وسطَ موسمٍ ما زال يُعرض.
 * - و**آخرَ حلقات موسمها**: عددُ حلقاته كما يعدّها TMDB، أو وسمُه `finale` — موسمٌ أُعلنت حلقاتُه ولم تُعرض كلُّها لم يكتمل.
 * - ولا حلقةَ قادمةً في الموسم نفسِه (`next_episode_to_air`) — توقّفُ منتصف الموسم ليس نهايتَه.
 * مسلسلٌ انتهى عرضُه (`Ended` · `Canceled`) ⇒ `show`، وإلّا ⇒ `season`. والخاصّةُ (موسم ٠) لا تُحسب.
 */
function endOf(
  show: { status?: string; seasons?: { season_number: number; episode_count: number }[]; last_episode_to_air: { season_number: number; episode_number: number; episode_type?: string | null } | null; next_episode_to_air: { season_number: number } | null },
  season: number | null,
  episode: number | null,
): "show" | "season" | null {
  const last = show.last_episode_to_air;
  if (!last || season == null || episode == null || season < 1) return null;
  if (last.season_number !== season || last.episode_number !== episode) return null;
  const count = show.seasons?.find((x) => x.season_number === season)?.episode_count ?? 0;
  if (episode !== count && last.episode_type !== "finale") return null;
  if (show.next_episode_to_air && show.next_episode_to_air.season_number === season) return null;
  return show.status === "Ended" || show.status === "Canceled" ? "show" : "season";
}

export async function GET(req: NextRequest) {
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
      .select("id, source, media_type, tmdb_id, season, episode, seen_at", { count: "exact" })
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

    if (req.nextUrl.searchParams.get("auto") === "1") {
      const { data: autos, error } = await supabase
        .from("watch_signals")
        .select("id, source, media_type, tmdb_id, season, episode, auto_at")
        .eq("user_id", uid)
        .eq("state", "watched")
        .not("auto_at", "is", null)
        .is("noticed_at", null)
        .gte("auto_at", new Date(Date.now() - AUTO_DAYS * 86_400_000).toISOString())
        .order("auto_at", { ascending: false })
        .limit(20);
      if (!error && autos?.length) {
        const extra = (autos as (Omit<Row, "seen_at"> & { auto_at: string })[]).map((r) => ({ ...r, seen_at: r.auto_at, auto: true }));
        rows = [...rows, ...extra].sort((a, b) => (a.seen_at < b.seen_at ? 1 : a.seen_at > b.seen_at ? -1 : 0));
        total += extra.length;
        for (const r of extra) (r.media_type === "tv" ? shows : movies).push(r.tmdb_id);
      }
    }

    const tv = new Map(await Promise.all([...new Set(shows)].map(async (id) => [id, await getTv(id).catch(() => null)] as const)));
    const mv = new Map(await Promise.all([...new Set(movies)].map(async (id) => [id, await getMovie(id).catch(() => null)] as const)));
    const seasonKeys = [...new Set(rows.filter((r) => r.media_type === "tv" && tv.get(r.tmdb_id)).map((r) => `${r.tmdb_id}:${r.season}`))];
    const seasons = new Map(
      await Promise.all(
        seasonKeys.map(async (k) => {
          const [id, s] = k.split(":").map(Number);
          return [k, await getSeason(id, s).catch(() => null)] as const;
        }),
      ),
    );

    /* 🆕 T415 — ما قيّمه صاحبُه لا تُعرض له نجومٌ بعد «شفتها» (لا يُستبدل تقييمٌ قديمٌ بلا قصد) */
    const allIds = [...new Set(rows.map((r) => r.tmdb_id))];
    const { data: ratedRows } = allIds.length
      ? await supabase.from("ratings").select("tmdb_id, media_type").eq("user_id", uid).in("tmdb_id", allIds)
      : { data: [] };
    const rated = new Set(((ratedRows ?? []) as { tmdb_id: number; media_type: string }[]).map((x) => `${x.media_type}-${x.tmdb_id}`));

    const items: StremioSignal[] = [];
    for (const r of rows) {
      if (r.media_type === "tv") {
        const show = tv.get(r.tmdb_id);
        if (!show) continue;
        const still = seasons.get(`${r.tmdb_id}:${r.season}`)?.episodes?.find((e) => e.episode_number === r.episode)?.still_path ?? null;
        const end = rated.has(`tv-${r.tmdb_id}`) ? null : endOf(show, r.season, r.episode);
        items.push({
          id: r.id,
          kind: "tv",
          tmdb_id: r.tmdb_id,
          title: show.name,
          image_path: still ?? show.backdrop_path ?? show.poster_path ?? null,
          season: r.season,
          episode: r.episode,
          seen_at: r.seen_at,
          source: signalSourceOf(r.source),
          ...(r.auto ? { auto: true } : {}),
          rate: end,
          ...(end ? { poster_path: show.poster_path ?? null } : {}),
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
          source: signalSourceOf(r.source),
          ...(r.auto ? { auto: true } : {}),
          ...(r.auto ? { poster_path: m.poster_path ?? null } : {}),
          ...(rated.has(`movie-${r.tmdb_id}`) ? { rate: null } : { rate: "movie" as const, poster_path: m.poster_path ?? null }),
        });
      }
    }
    const state: StremioState = { plus, linked: !!link, linked_at: link?.linked_at ?? null, items, count: Math.max(total, items.length) };
    return ok(state);
  });
}
