import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { nowPlayingMovies, resultsByIds, searchMovieTitles, type SearchResult } from "@/lib/tmdb";
import { cinemaFresh, cinemaOrigin, cinemaStatus, pickCinemaMatch, riyadhToday } from "@/core/cinema";
import { titleOf } from "@/core/media";
import { railGuard } from "@/lib/topChart";
import { getContentPrefs } from "@/lib/data";
import { EMPTY_CONTENT_PREFS, isExcludedLanguage } from "@/core/contentPrefs";
import type { CinemaCard, CinemaPayload } from "@/core/contracts/discover";

/**
 * ====== قسمُ السينما — القراءة والمطابقة (T512) ======
 *
 * الجدولُ `cinema_titles` (هجرة ٢٦٠) يملؤه وكيلٌ أسبوعيٌّ (الأربعاء ٧:٣٠ بتوقيت الرياض) من مواقع الصالات الثلاث.
 * **وهنا يُقرأ ويُطابَق**: كلُّ اسمٍ بلا رقم TMDB يُبحث عنه بالإنجليزيّة **بعد إرسال الردّ** (`after`) ويُكتب رقمُه —
 * فلا ينتظر القارئُ بحثاً، والفيلمُ المطابَقُ يظهر من الطلب التالي. والرسمُ كلُّه من TMDB بلغة القارئ (ملصقٌ واسمٌ
 * ومنشأ)، **ولا اسمَ صالةٍ يخرج من هنا** (حكمُ أحمد حتى نحصل على إذنها).
 *
 * 🔑 **الجدولُ فارغٌ أو غائب ⇒ قائمةُ TMDB القديمة** (`/movie/now_playing` للسعودية) — القسمُ لا يفرغ يومَ يتعثّر الوكيل.
 */

type Row = {
  id: number;
  title: string;
  status: "now" | "soon";
  release_date: string | null;
  langs: string[];
  tmdb_id: number | null;
  match_checked_at: string | null;
  first_seen: string;
  last_seen: string;
};

/** سقفُ ما يُطابَق في الطلب الواحد — نداءُ بحثٍ لكلِّ اسم، والباقي في الطلبات التالية */
const MATCH_PER_REQUEST = 12;
/** اسمٌ لم يُطابَق يُعاد البحثُ عنه بعد ثلاثة أيّام — TMDB يضيف الأفلامَ العربيّةَ والهنديّةَ متأخّراً */
const MATCH_RETRY_MS = 3 * 86_400_000;

async function readRows(): Promise<Row[]> {
  try {
    const sb = await createServiceClient();
    const { data, error } = await sb
      .from("cinema_titles")
      .select("id,title,status,release_date,langs,tmdb_id,match_checked_at,first_seen,last_seen")
      .order("last_seen", { ascending: false })
      .limit(400);
    if (error || !data) return [];
    return data as Row[];
  } catch {
    return [];
  }
}

/** البحثُ عن رقم TMDB للأسماء غير المطابَقة — يجري بعد الردّ، وفشلُه صامت (يُعاد في الطلب التالي) */
async function matchPending(rows: Row[], today: string): Promise<void> {
  const now = Date.now();
  const pending = rows
    .filter((r) => r.tmdb_id === null && (!r.match_checked_at || now - Date.parse(r.match_checked_at) > MATCH_RETRY_MS))
    .slice(0, MATCH_PER_REQUEST);
  if (pending.length === 0) return;
  const sb = await createServiceClient();
  for (const r of pending) {
    const year = Number((r.release_date ?? today).slice(0, 4));
    try {
      const hits = await searchMovieTitles(r.title);
      const hit = pickCinemaMatch(hits, r.title, year);
      await sb
        .from("cinema_titles")
        .update({ tmdb_id: hit?.id ?? null, match_checked_at: new Date().toISOString() })
        .eq("id", r.id)
        .is("tmdb_id", null);
    } catch {
      /* شبكةٌ تعثّرت — يُعاد في طلبٍ لاحق */
    }
  }
}

function card(r: SearchResult, extra: Pick<CinemaCard, "origin" | "sa_date">): CinemaCard {
  const date = r.release_date ?? null;
  return {
    kind: "movie",
    id: r.id,
    title: titleOf(r),
    poster_path: r.poster_path,
    vote_average: r.vote_average ?? 0,
    year: date ? date.slice(0, 4) : null,
    imdb_rating: null,
    date: extra.sa_date ?? date,
    backdrop_path: r.backdrop_path ?? null,
    ...extra,
  };
}

/** احتياطُ الجدول الفارغ — قائمةُ TMDB للسعودية كما كانت قبل T512 */
async function fallback(): Promise<CinemaPayload> {
  const c = await nowPlayingMovies(["SA"]).catch(() => null);
  return {
    now: (await keepFor(c?.results ?? [])).map((r) => card(r, { origin: cinemaOrigin(r), sa_date: null })),
    soon: [],
  };
}

/**
 * 🔑 **حارسُ رفوف «اكتشف» نفسُه** (مراجعةُ T512): الأنمي يغادر صفَّ الأفلام إلى تبويبه (قاعدةُ ١٢ أغسطس)، واللغاتُ التي
 * استبعدها القارئُ في تفضيلاته تسقط. **واللغاتُ المكتومةُ افتراضاً لا تُكتم هنا** (`unmute`): القسمُ «كلُّ ما في صالات
 * السعوديّة» — والفيلمُ الهنديُّ أو الكوريُّ المعروضُ هناك جزءٌ منه.
 */
async function keepFor(rows: SearchResult[]): Promise<SearchResult[]> {
  const guarded = railGuard(rows, { anime: "drop", unmute: true });
  const prefs = await getContentPrefs().catch(() => EMPTY_CONTENT_PREFS);
  return prefs.excludedLanguages.length > 0 ? guarded.filter((r) => !isExcludedLanguage(r, prefs)) : guarded;
}

/** قراءةٌ أقدمُ من هذا ⇒ الوكيلُ متوقّف: القائمةُ القديمةُ تكذب، فالاحتياط (مراجعةُ T512) */
const STALE_DAYS = 10;

/**
 * **الحالتان في نداءٍ واحد** — المعروضُ بالشعبيّة، والقادمُ بتاريخ نزوله ثمّ الشعبيّة. والفيلمُ الواحدُ بنسخٍ عدّة
 * (مدبلجٌ · عرضٌ أوّل) صفٌّ واحد: يكفي أن يكون أحدُها معروضاً ليكون معروضاً.
 * **و`cache` لطلبٍ واحد**: صفُّ «اكتشف» وصفحةُ «الكل» ومزجُ `buildSection` يقرؤونه في الطلب نفسه — رحلةٌ واحدة لا ثلاث.
 */
export const getCinema = cache(async function getCinema(): Promise<CinemaPayload> {
  const rows = await readRows();
  if (rows.length === 0) return fallback();
  const today = riyadhToday();
  const latest = rows[0].last_seen;
  if ((Date.parse(today) - Date.parse(latest)) / 86_400_000 > STALE_DAYS) return fallback();
  const live = rows.filter((r) => cinemaFresh(r.last_seen, latest));
  after(() => matchPending(live, today));

  type Agg = { now: boolean; soon: boolean; soonDate: string | null; langs: Set<string> };
  const byId = new Map<number, Agg>();
  for (const r of live) {
    if (r.tmdb_id === null) continue;
    const status = cinemaStatus(r, today);
    const a = byId.get(r.tmdb_id) ?? { now: false, soon: false, soonDate: null, langs: new Set<string>() };
    if (status === "now") a.now = true;
    else {
      /* «قريباً» بلا تاريخٍ معلَن يبقى في القائمة آخرَها وبلا شارة — لا يختفي حتى يُعلن موعده */
      a.soon = true;
      if (r.release_date && (!a.soonDate || r.release_date < a.soonDate)) a.soonDate = r.release_date;
    }
    for (const l of r.langs) a.langs.add(l);
    byId.set(r.tmdb_id, a);
  }
  if (byId.size === 0) return fallback();

  const details = await keepFor(await resultsByIds("movie", [...byId.keys()]));
  const now: (CinemaCard & { p: number })[] = [];
  const soon: (CinemaCard & { p: number })[] = [];
  for (const r of details) {
    const a = byId.get(r.id);
    if (!a) continue;
    const origin = cinemaOrigin(r, [...a.langs]);
    if (a.now) now.push({ ...card(r, { origin, sa_date: null }), p: r.popularity ?? 0 });
    else if (a.soon) soon.push({ ...card(r, { origin, sa_date: a.soonDate }), p: r.popularity ?? 0 });
  }
  now.sort((x, y) => y.p - x.p);
  /* بالتاريخ ثمّ الشعبيّة، وما لا تاريخَ له آخراً */
  soon.sort((x, y) => (x.sa_date ?? "9999").localeCompare(y.sa_date ?? "9999") || y.p - x.p);
  const strip = (c: CinemaCard & { p: number }): CinemaCard => {
    const { p, ...rest } = c;
    void p;
    return rest;
  };
  return { now: now.map(strip), soon: soon.map(strip) };
});

/**
 * **صفحةُ «الكل» تقرأ القائمةَ نفسَها** (D-199: ما يُضغط هو ما يُرى) — `buildSection("in-cinemas")` يأخذ منها
 * صفوفَ البحث بشكلها المعتاد، والحالةُ من رابط الصفّ (`cs=soon`).
 */
export async function cinemaSectionRows(state: "now" | "soon"): Promise<SearchResult[]> {
  const p = await getCinema();
  return (state === "soon" ? p.soon : p.now).map((c) => ({
    id: c.id,
    media_type: "movie" as const,
    title: c.title,
    poster_path: c.poster_path,
    backdrop_path: c.backdrop_path ?? null,
    overview: "",
    release_date: c.date ?? undefined,
    vote_average: c.vote_average,
  }));
}
