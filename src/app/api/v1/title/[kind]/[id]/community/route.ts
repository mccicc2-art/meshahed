import type { NextRequest } from "next/server";
import { getMyRating, getTitleReviews, getTitleReplies, getTitleThread, getTitleLoopzNews, getUserId } from "@/lib/data";
import { displayNameOf } from "@/core/people";
import { bulletinLine } from "@/core/bulletinLine";
import { newsLine } from "@/core/newsLine";
import { getDict } from "@/core/i18n";
import { getLocale } from "@/lib/locale";
import { handle, limited, fail, positiveInt } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { TitleCommunityPayload } from "@/core/contracts/title";

/**
 * `GET /api/v1/title/{kind}/{id}/community` — تبويبُ المجتمع للقراءة (Phase 11-D ·
 * D3 · D-956): الآراءُ (بردودها عدّاً) · نشراتُ لوبز وأخبارُه مصوغةً بلغة القارئ
 * (`bulletinLine`/`newsLine` — الدوالُّ نفسُها التي تصوغها للصفحة) · رأيي.
 * **الكتابةُ (رأيٌ نصّيٌّ، ردٌّ، نقاش) في الويب**: `/talk/{kind}/{id}` بابٌ، ورأيي
 * عبر `track/rate` بحقل `review`.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  return handle(async () => {
    const { kind, id } = await ctx.params;
    const tmdbId = positiveInt(id);
    if (!tmdbId || (kind !== "tv" && kind !== "movie")) return fail("invalid_input");
    const uid = await getUserId();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const lim = limited(`v1:title:community:${uid ?? ip}`, 60, 60_000);
    if (lim) return lim;
    const [locale, my, reviews, replies, thread, news] = await Promise.all([
      getLocale(),
      uid ? getMyRating(tmdbId, kind).catch(() => null) : null,
      getTitleReviews(tmdbId, kind).catch(() => []),
      getTitleReplies(tmdbId, kind).catch(() => []),
      getTitleThread(tmdbId, kind).catch(() => []),
      getTitleLoopzNews(tmdbId, kind).catch(() => []),
    ]);
    const t = getDict(locale);
    const loc = locale === "en" ? ("en" as const) : ("ar" as const);
    const replyCounts = new Map<string, number>();
    for (const r of replies) replyCounts.set(r.reviewUserId, (replyCounts.get(r.reviewUserId) ?? 0) + 1);
    const kids = new Map<string, number>();
    for (const p of thread) if (p.parentId) kids.set(p.parentId, (kids.get(p.parentId) ?? 0) + 1);
    const payload: TitleCommunityPayload = {
      my_review: my ? { rating: my.rating, review: my.review, has_spoiler: !!my.has_spoiler } : null,
      reviews: reviews
        .filter((r) => r.review?.trim() || replyCounts.has(r.id))
        .map((r) => ({
          user_id: r.id,
          name: displayNameOf(r, t.anonymousUser),
          username: r.username,
          avatar_url: r.avatar_url,
          rating: r.rating,
          review: r.review,
          has_spoiler: !!r.has_spoiler,
          updated_at: r.updated_at,
          likes: r.likes,
          replies: replyCounts.get(r.id) ?? 0,
          mine: r.isMine,
        })),
      bulletins: [
        ...thread
          .filter((p) => !p.parentId && p.kind)
          .map((p) => ({ line: bulletinLine(p.kind, p.data, t, locale), at: p.createdAt, replies: kids.get(p.postId) ?? 0 }))
          .filter((x): x is { line: string; at: string; replies: number } => !!x.line),
        ...news.map((n) => ({ line: newsLine(n, t, loc), at: n.published_at, replies: 0 })).filter((x): x is { line: string; at: string; replies: number } => !!x.line),
      ].sort((a, b) => b.at.localeCompare(a.at)),
      talk_path: `/talk/${kind}/${tmdbId}`,
    };
    return ok(payload);
  });
}
