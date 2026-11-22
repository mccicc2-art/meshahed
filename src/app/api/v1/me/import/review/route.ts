import type { NextRequest } from "next/server";
import { handle, requireUser, fail, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { createClient } from "@/lib/supabase/server";
import { writeImportedReviews } from "@/lib/importRuns";
import { cleanReviewText, reviewDate } from "@/core/importParse";

/**
 * `POST /api/v1/me/import/review` — 🆕 T516 **تعليقٌ مستوردٌ اختار صاحبُه نجومَه**.
 *
 * تعليقُه في Trakt بلا تقييم لا يُكتب وقتَ الاستيراد (`ratings.rating` إلزاميّ)، فيعود إلى التطبيق بنصّه (`pending`) وتسأله
 * ورقةٌ عن نجومه (أحمد ٢٢ نوفمبر «٢أ»). والكتابةُ هنا **بالطريق نفسِه** (`writeImportedReviews`): بيوم كتابته لا «الآن»
 * وموسومٌ `imported_from` فلا يدخل نشاطَ الأصدقاء ولا «أفضل الأسبوع» — كما كان سيُكتب لو حمل تقييماً. وما في Loopz يبقى:
 * رأيٌ موجودٌ لا يُكتب فوقه. والنصُّ والتاريخُ يُنقّيان هنا كما يُنقّى رأيُ الملفّات — الجسمُ لا يُصدَّق.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const gate = limited(`import-review:${auth.user.id}`, 60, 10 * 60_000);
    if (gate) return gate;
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return fail("invalid_input");
    }
    const kind = body?.kind === "tv" || body?.kind === "movie" ? body.kind : null;
    const tmdbId = Number(body?.tmdbId);
    const rating = Number(body?.rating);
    const text = cleanReviewText(typeof body?.text === "string" ? body.text : "");
    const at = reviewDate(typeof body?.at === "string" ? body.at : null, Date.now());
    const title = typeof body?.title === "string" ? body.title.slice(0, 300) : "";
    const posterPath = typeof body?.posterPath === "string" ? body.posterPath : null;
    if (!kind || !Number.isInteger(tmdbId) || tmdbId <= 0 || !Number.isInteger(rating) || rating < 1 || rating > 10 || !text || !at) {
      return fail("invalid_input");
    }

    const supabase = await createClient();
    const stamp = new Date().toISOString();
    const done = await writeImportedReviews(
      supabase,
      auth.user.id,
      [{ kind, tmdbId, rating, title, posterPath, review: { text, at, spoiler: body?.spoiler === true } }],
      stamp,
      "trakt",
    );
    return ok({ saved: done.reviews > 0, kept: done.reviewsKept > 0 }, ["me:ratings", "me:library"]);
  });
}
