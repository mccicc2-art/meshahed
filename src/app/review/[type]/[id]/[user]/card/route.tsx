import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getTitleReviews } from "@/lib/data";
import { displayNameOf } from "@/core/people";
import { getMovieIn, getTvIn, posterUrl } from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { ogFonts } from "@/lib/og";
import { REVIEW_CARD_SIZE, reviewCardElement } from "@/lib/reviewCard";
import { SITE_URL } from "@/lib/site";

/**
 * `GET /review/{type}/{id}/{user}/card` — 🆕 T530 **صورةُ مشاركة المراجعة** (توضع في `og:image` من `generateMetadata`):
 * بلا `?card` المراجعةُ كاملة، و`?card=rating` التقييمُ وحده (أحمد «١أ»: من يشارك يختار). حلّت محلَّ `opengraph-image.tsx`
 * لأنّ صورةَ الملفّ الثابت لا ترى الاستعلامَ فلا تختار.
 *
 * - **اسمُ العمل بقاعدة لوبز** (أحمد ٢٣ نوفمبر): إنجليزيٌّ دائماً إلّا العربيَّ الأصل — من TMDB بالإنجليزيّة، والعربيُّ من اسمه
 *   الأصليّ وملصقِه العربيّ.
 * - **`hide_name` يُحترم كالصفحة** (`displayNameOf`)، ولا صورةَ لمن أخفى اسمَه.
 * - **ما فيه حرقٌ لا يُكتب نصُّه في البطاقة**: تُرسم بطاقةُ التقييم وحده (D-315 — الوصفُ يحجبه كذلك).
 * - **رأيٌ بلا نصّ** بطاقتُه التقييم وحده دائماً؛ وشخصيّةُ AI بلا درجةٍ لا بطاقةَ لها (تُورَّث بطاقةُ الجذر).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string; id: string; user: string }> }) {
  const { type, id, user } = await params;
  if (type !== "tv" && type !== "movie") return new Response("not found", { status: 404 });
  const tmdbId = Number(id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return new Response("not found", { status: 404 });

  const { t } = await getT();
  const reviews = await getTitleReviews(tmdbId, type).catch(() => []);
  const r = reviews.find((x) => x.id === user);
  if (!r || r.rating == null) return new Response("not found", { status: 404 });
  const said = r.review?.trim() || null;
  const mode = req.nextUrl.searchParams.get("card") === "rating" || !said || r.has_spoiler ? "rating" : "review";

  const en = await (type === "tv" ? getTvIn(tmdbId, "en-US") : getMovieIn(tmdbId, "en-US")).catch(() => null);
  const d = en as { name?: string; title?: string; original_language?: string; original_name?: string; original_title?: string; poster_path?: string | null; first_air_date?: string; release_date?: string } | null;
  const arabicWork = d?.original_language === "ar";
  const ar = arabicWork ? ((await (type === "tv" ? getTvIn(tmdbId, "ar-SA") : getMovieIn(tmdbId, "ar-SA")).catch(() => null)) as typeof d) : null;
  const work = arabicWork
    ? (d?.original_name ?? d?.original_title ?? ar?.name ?? ar?.title ?? "")
    : (d?.name ?? d?.title ?? "");
  const date = d?.first_air_date || d?.release_date || "";
  const year = /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;
  const avatar = r.hide_name || !r.avatar_url ? null : r.avatar_url.startsWith("/") ? `${SITE_URL}${r.avatar_url}` : r.avatar_url;

  const el = await reviewCardElement({
    mode,
    work: work || "Loopz",
    arabicWork,
    kind: type,
    year,
    poster: posterUrl((ar?.poster_path || d?.poster_path) ?? null, "w500"),
    name: displayNameOf(r, t.anonymousUser),
    initial: (!r.hide_name && r.username ? r.username : "L").replace(/[^A-Za-z0-9]/g, "").slice(0, 1) || "L",
    avatar,
    rating: r.rating,
    review: mode === "review" ? said : null,
  });
  return new ImageResponse(el, {
    ...REVIEW_CARD_SIZE,
    fonts: await ogFonts(),
    /* 🔴 مراجعةُ الوكيل (٢، البند ١): المفتاحُ بحروفٍ صغيرة — `ImageResponse` يكتب `cache-control` (سنةً كاملة)، ومفتاحٌ بحروفٍ
       كبيرةٍ يُضاف إليه ولا يحلّ محلّه، فتبقى بطاقةٌ حُذفت مراجعتُها أو وُسمت بالحرق في كاش X سنة. والرابطُ يحمل `v` (تاريخ
       التعديل) فالتعديلُ رابطٌ جديد */
    headers: { "cache-control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
