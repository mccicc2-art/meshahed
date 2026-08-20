import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getT, getWatchRegion, getTabPrefs } from "@/lib/locale";
import { getLibState } from "@/lib/libState";
import {
  listWatchProviders,
  topByFilter,
  nowPlayingMovies,
  type DiscoverFilter,
  type SearchResult,
} from "@/lib/tmdb";
import { buildSection } from "@/lib/sections";
import { railGuard } from "@/lib/topChart";
import { attachImdbRatings, withImdbRatings, rankByImdb } from "@/lib/omdb";
import { localizeRows } from "@/lib/localize";
import { getSuggestions } from "@/lib/suggest";

export const dynamic = "force-dynamic";

/**
 * 🔬 **قياسٌ مؤقّت لجولة /news (P1-2) — يُحذف بنهايتها.**
 *
 * يعيد أزمنةَ اعتماديّات صفحة اكتشف واحدةً واحدة، بنفس ترتيب الصفحة
 * ونفس دوالّها، ليُعرف أين تذهب الثانيتان قبل أن يُغيَّر سطر.
 *
 * السياج:
 *  - **للإداريّ وحده** (`profiles.is_admin`) — غيرُه يرى 404.
 *  - **لا يُرجِع ولا يُسجِّل أيَّ قيمةٍ شخصية**: أزمنةٌ وأعدادُ صفوفٍ
 *    وأحجامُ JSON فقط.
 *  - `?probe=N` يزيح مدى `to` أيّاماً فيولّد استعلامات discover غيرَ
 *    مخبّأة — **قياسُ المسار البارد بلا مساسٍ بما يراه مستخدم.**
 */

type Timing = {
  name: string;
  ms: number;
  rows?: number;
  bytes?: number;
  error?: boolean;
};

async function timed<T>(
  out: Timing[],
  name: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  const t0 = performance.now();
  try {
    const v = await fn();
    const bytes = (() => {
      try {
        return JSON.stringify(v)?.length;
      } catch {
        return undefined;
      }
    })();
    out.push({
      name,
      ms: Math.round(performance.now() - t0),
      rows: Array.isArray(v) ? v.length : undefined,
      bytes,
    });
    return v;
  } catch {
    out.push({ name, ms: Math.round(performance.now() - t0), error: true });
    return null;
  }
}

export async function GET(request: Request) {
  const t00 = performance.now();
  const timings: Timing[] = [];

  // ===== بوّابة الإداريّ (وقياسُ getUser نفسِه — فهو بوّابة الصفحة أيضاً)
  const user = await timed(timings, "getUser", () => getUser());
  if (!user) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.is_admin) return new NextResponse(null, { status: 404 });

  const url = new URL(request.url);
  const probe = Math.max(0, Math.min(999, Number(url.searchParams.get("probe") ?? 0) || 0));

  // ===== رأسُ الصفحة كما هو: getT ← tabPrefs ← providers+region
  const tRes = await timed(timings, "getT", () => getT());
  const locale = tRes?.locale ?? "ar";
  await timed(timings, "getTabPrefs", () => getTabPrefs("discover"));
  const [, region] = (await timed(timings, "providers+region (Promise.all)", () =>
    Promise.all([listWatchProviders("movie"), getWatchRegion()]),
  )) ?? [[], "SA"];

  await timed(timings, "getLibState (3 supabase readers)", () => getLibState());

  // ===== موجةُ CuratedRails الثمانية — كلُّ عضوٍ يُقاس وحده وتجري معاً
  const y = new Date().getFullYear();
  // `probe` يزيح نهاية المدى فيكسر كاشَ discover — مسارٌ بارد حقيقيّ
  const probeTo = new Date(Date.now() - probe * 86400000).toISOString().slice(0, 10);
  const base: DiscoverFilter = {
    lang: null,
    country: null,
    provider: null,
    watchRegion: region,
    from: null,
    to: probe ? probeTo : null,
    minRate: null,
    status: null,
  };

  const bestOfYear = async (kind: "movie" | "tv") => {
    const sub: Timing[] = [];
    const rows =
      (await timed(sub, `bestOfYear/${kind}: topByFilter(60)`, () =>
        topByFilter(kind, { ...base, from: `${y}-01-01`, to: probe ? probeTo : `${y}-12-31` }, 60, "vote_count.desc"),
      )) ?? [];
    const rated = (await timed(sub, `bestOfYear/${kind}: withImdbRatings(${rows.length})`, () =>
      withImdbRatings(rows),
    )) ?? [];
    const ranked = rankByImdb(rated, { want: 25 });
    await timed(sub, `bestOfYear/${kind}: localizeRows(${ranked.length})`, () =>
      localizeRows(
        ranked.map((r) => ({
          tmdb_id: r.id,
          media_type: (r.media_type === "tv" ? "tv" : "movie") as "tv" | "movie",
          title: r.title ?? r.name ?? null,
          poster_path: r.poster_path,
        })),
        locale,
        ranked.length,
      ),
    );
    timings.push(...sub);
    return ranked;
  };

  const topTen = async (mt: "movie" | "tv") => {
    const sub: Timing[] = [];
    const rows =
      (await timed(sub, `top10/${mt}: buildSection(top-ten)`, () =>
        buildSection("top-ten", { media: mt, base, genreIds: undefined, active: !!probe, win: "week", winRange: null }, 10),
      )) ?? [];
    const guarded = railGuard(rows as SearchResult[], { unmute: false });
    await timed(sub, `top10/${mt}: withImdbRatings(${guarded.length})`, () =>
      withImdbRatings(guarded),
    );
    timings.push(...sub);
  };

  const waveT0 = performance.now();
  await Promise.all([
    topTen("movie"),
    topTen("tv"),
    (async () => {
      const sub: Timing[] = [];
      const rows =
        (await timed(sub, "popular: buildSection(most-popular,20)", () =>
          buildSection("most-popular", { media: "movie", base, genreIds: undefined, active: !!probe, sample: true, locale }, 20),
        )) ?? [];
      await timed(sub, `popular: attachImdbRatings(${rows.length})`, () =>
        attachImdbRatings(rows as SearchResult[]),
      );
      timings.push(...sub);
    })(),
    (async () => {
      const sub: Timing[] = [];
      const [rows] = (await timed(sub, "cinemas: buildSection+nowPlaying", () =>
        Promise.all([
          buildSection("in-cinemas", { media: "movie", base, genreIds: undefined, active: !!probe }, 20),
          nowPlayingMovies().catch(() => null),
        ]),
      )) ?? [[]];
      await timed(sub, `cinemas: attachImdbRatings(${(rows as SearchResult[]).length})`, () =>
        attachImdbRatings((rows as SearchResult[]) ?? []),
      );
      timings.push(...sub);
    })(),
    timed(timings, "upcoming/movie: buildSection(20)", () =>
      buildSection("upcoming", { media: "movie", base, genreIds: undefined, active: !!probe }, 20),
    ),
    timed(timings, "upcoming/tv: buildSection(20)", () =>
      buildSection("upcoming", { media: "tv", base, genreIds: undefined, active: !!probe }, 20),
    ),
    bestOfYear("movie"),
    bestOfYear("tv"),
  ]);
  const waveMs = Math.round(performance.now() - waveT0);

  // ===== الصفّان الشخصيّان (Suspense مستقلّ في الصفحة — يُقاس لاكتمالها)
  await timed(timings, "personal: getSuggestions(300)", () => getSuggestions(300, locale));
  await timed(timings, "personal: from-artists buildSection(20)", () =>
    buildSection("from-artists", { media: "movie", base: {}, active: false }, 20),
  );

  return NextResponse.json({
    probe,
    curatedWaveWallMs: waveMs,
    totalMs: Math.round(performance.now() - t00),
    timings,
  });
}
