import type React from "react";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import {
  getCommunityRating,
  getFollowGenresOf,
  getFollowsOf,
  getMovieStatsOf,
  getProfileByUsername,
  getPublicList,
  getWatchStatsOf,
} from "@/lib/data";
import { getMovieIn, getTvIn } from "@/lib/tmdb";
import { backdropUrl, posterUrl } from "@/core/media";
import { displayNameOf } from "@/core/people";
import { countedUnit, yearPersona } from "@/core/yearPersona";
import { tallyGenres } from "@/components/LibraryAnalysis";
import { ogFonts } from "@/lib/og";
import { dataUrl } from "@/lib/fetchableImage";
import { SITE_URL } from "@/lib/site";
import { inviterById, ownerOfCode } from "@/lib/referral";
import { limited } from "@/lib/v1";
import { invitePreview, listPreview, PREVIEW, profilePreview, workPreview } from "@/lib/linkPreview";

export const runtime = "nodejs";

/**
 * `GET /api/og/{kind}/{id}?l=ar|en` — 🆕 **صورُ معاينة الروابط** (ن٨): `tv`/`movie` صفحةُ العمل، `u` الملفّ، `list` القائمة،
 * `invite` الدعوة. تضعها `generateMetadata` في `og:image` بلغة نصّ المعاينة نفسِها (`l`) فلا تختلف الصورةُ عن السطر تحتها.
 *
 * - **بلا جلسة عمداً**: برنامجُ المعاينة لا يحمل جلسة — والقراءاتُ الشخصيّةُ تمرّ بـ`can_view_profile` كالصفحة، **فالحسابُ الخاصُّ
 *   يعطي اسمَه وصورتَه فقط** ولا أرقامَ ولا ذوق. ومن أخفى اسمَه يظهر بمعرّفه (`displayNameOf`)، والدعوةُ بلا اسمه.
 * - **ولا صورةَ لما لا يُرى**: قائمةٌ خاصّةٌ أو ملفٌّ غيرُ موجود ⇒ ٤٠٤، فتعود المعاينةُ إلى صورة لوبز العامّة.
 */
const lang = (req: NextRequest): "ar" | "en" => (req.nextUrl.searchParams.get("l") === "en" ? "en" : "ar");
const abs = (u: string | null | undefined) => (!u ? null : u.startsWith("/") ? `${SITE_URL}${u}` : u);
const img = (u: string | null) => (u?.startsWith(SITE_URL) ? Promise.resolve(u) : dataUrl(u));

const SHOW = { one: "مسلسل واحد", two: "مسلسلان", few: "مسلسلات", many: "مسلسلاً", hundred: "مسلسل", en1: "show", enN: "shows" };
const FILM = { one: "فيلم واحد", two: "فيلمان", few: "أفلام", many: "فيلماً", hundred: "فيلم", en1: "movie", enN: "movies" };
const DAY = { one: "يوم واحد من المشاهدة", two: "يومان من المشاهدة", few: "أيام من المشاهدة", many: "يوماً من المشاهدة", hundred: "يوم من المشاهدة", en1: "day watched", enN: "days watched" };
const SEASON = { one: "موسم واحد", two: "موسمان", few: "مواسم", many: "موسماً", hundred: "موسم", en1: "season", enN: "seasons" };
const said = (u: { value: string | null; unit: string }) => (u.value ? `${u.value} ${u.unit}` : u.unit);

async function work(kind: "tv" | "movie", id: number, l: "ar" | "en") {
  type D = { name?: string; title?: string; original_language?: string; original_name?: string; original_title?: string; backdrop_path?: string | null; first_air_date?: string; release_date?: string; number_of_seasons?: number; runtime?: number | null; genres?: { name: string }[] };
  const fetchIn = (lg: "ar-SA" | "en-US") => (kind === "tv" ? getTvIn(id, lg) : getMovieIn(id, lg)) as Promise<D>;
  const en = await fetchIn("en-US").catch(() => null);
  if (!en) return null;
  const local = l === "ar" ? await fetchIn("ar-SA").catch(() => en) : en;
  /* قاعدةُ لوبز: الاسمُ إنجليزيٌّ إلّا العربيَّ الأصل */
  const title = en.original_language === "ar" ? (en.original_name ?? en.original_title ?? local.name ?? local.title ?? "") : (en.name ?? en.title ?? "");
  const date = en.first_air_date || en.release_date || "";
  const facts: string[] = [];
  if (/^\d{4}/.test(date)) facts.push(date.slice(0, 4));
  if (kind === "tv" && en.number_of_seasons) facts.push(said(countedUnit(en.number_of_seasons, SEASON, l)));
  if (kind === "movie" && en.runtime) facts.push(l === "ar" ? `${en.runtime} دقيقة` : `${en.runtime} min`);
  const genres = (local.genres ?? []).slice(0, 2).map((g) => g.name);
  if (genres.length) facts.push(genres.join(l === "ar" ? "، " : ", "));
  const [art, rating] = await Promise.all([dataUrl(backdropUrl(en.backdrop_path ?? null, "w1280")), getCommunityRating(id, kind)]);
  return workPreview({ lang: l, kind, title: title || "Loopz", facts: facts.join(" · "), rating, art });
}

async function profile(handle: string, l: "ar" | "en") {
  const p = await getProfileByUsername(handle);
  if (!p) return null;
  const name = displayNameOf(p, "Loopz");
  const initial = (p.username ?? "L").replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "L";
  const av = p.hide_name ? null : await img(abs(p.avatar_url));
  /* الحسابُ الخاصُّ: الاسمُ والصورةُ فقط — القراءاتُ أدناه تعود فارغةً له أصلاً، والشرطُ هنا صريحٌ فلا نداءَ بلا داعٍ */
  if (p.is_private) return profilePreview({ lang: l, name, initial, avatar: av, persona: null, stats: null });
  const [follows, genres, ep, mv] = await Promise.all([getFollowsOf(p.id), getFollowGenresOf(p.id), getWatchStatsOf(p.id), getMovieStatsOf(p.id)]);
  const { bySlug } = tallyGenres(
    follows.map((f) => genres.get(`${f.media_type}-${f.tmdb_id}`) ?? null),
    l,
  );
  const total = [...bySlug.values()].reduce((a, b) => a + b, 0);
  const ranked = [...bySlug.entries()].sort((a, b) => b[1] - a[1]).map(([slug, n]) => ({ slug, pct: total ? Math.round((n / total) * 100) : 0 }));
  const persona = follows.length ? yearPersona({ genres: ranked, animePct: ranked.find((g) => g.slug === "animation")?.pct ?? 0, thin: follows.length < 5 }, l, "all") : null;
  const shows = follows.filter((f) => f.media_type === "tv").length;
  const days = Math.floor((ep.minutes + mv.minutes) / 1440);
  const parts = [shows ? said(countedUnit(shows, SHOW, l)) : null, mv.watched ? said(countedUnit(mv.watched, FILM, l)) : null, days ? said(countedUnit(days, DAY, l)) : null].filter(Boolean);
  return profilePreview({ lang: l, name, initial, avatar: av, persona, stats: parts.length ? parts.join(" · ") : null });
}

async function list(id: string, l: "ar" | "en") {
  const ls = await getPublicList(id);
  if (!ls) return null;
  const items = [...ls.items].sort((a, b) => (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9));
  const [posters, art] = await Promise.all([
    Promise.all(items.slice(0, 4).map((i) => dataUrl(posterUrl(i.poster_path, "w342")))),
    dataUrl(backdropUrl(ls.cover_backdrop ?? null, "w1280")),
  ]);
  return listPreview({
    lang: l,
    owner: ls.owner_nickname?.trim() || ls.owner_username || null,
    count: ls.items.length,
    name: ls.name,
    subtitle: ls.subtitle,
    posters,
    ranked: ls.kind === "ranked" || ls.kind === "watch_order",
    art,
  });
}

async function invite(code: string, l: "ar" | "en", ip: string) {
  /* حدُّ المعاينة العامّة نفسُه في صفحة الدعوة — الصورةُ تكشف ما تكشفه الصفحة */
  const owner = !limited(`v1:refog:${ip}`, 20, 60_000) ? await ownerOfCode(code) : null;
  const inviter = owner && owner.source !== "campaign" ? await inviterById(owner.userId) : null;
  const follows = owner && inviter?.name ? await getFollowsOf(owner.userId, { firstPageOnly: true }).catch(() => []) : [];
  const posters = await Promise.all(follows.filter((f) => f.poster_path).slice(0, 4).map((f) => dataUrl(posterUrl(f.poster_path, "w342"))));
  return invitePreview({ lang: l, name: inviter?.name ?? null, posters });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const l = lang(req);
  let el: React.ReactElement | null = null;
  if (kind === "tv" || kind === "movie") {
    const n = Number(id);
    if (Number.isInteger(n) && n > 0) el = await work(kind, n, l);
  } else if (kind === "u") el = await profile(decodeURIComponent(id), l);
  else if (kind === "list") el = await list(id, l);
  else if (kind === "invite") el = await invite(id, l, req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon");
  if (!el) return new Response("not found", { status: 404 });
  return new ImageResponse(el, {
    ...PREVIEW,
    fonts: await ogFonts(),
    /* المفتاحُ بحروفٍ صغيرة (درسُ بطاقة المراجعة): يحلّ محلَّ سنةِ `ImageResponse` لا يُضاف إليها — الملفُّ والقائمةُ يتغيّران */
    headers: { "cache-control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400" },
  });
}
