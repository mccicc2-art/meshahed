import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale } from "@/lib/locale";
import { getMyRatings, getMyRatingsPage } from "@/lib/data";
import { localizeRows } from "@/lib/localize";
import type { MyRatingsPayload } from "@/core/contracts/profile";
import type { NextRequest } from "next/server";

/**
 * `GET /api/v1/me/ratings` — **تقييماتي وتعليقاتي** (🆕 D-1357 · Phase 11-V · V-C · C1، قرارُ أحمد ١١ أكتوبر: «نفذ»). كان عنوانُ
 * «التقييمات — من الأعلى» و«الكلّ» في الرئيسيّة الأصليّة يفتحان صفحةَ الويب طبقةً — آخرُ بابٍ ويبيٍّ في أقسام الرئيسيّة.
 * **الحمولةُ ما ترسمه `/ratings` حرفاً**: `getMyRatings` نفسُها (الأعلى تقييماً ثمّ الأحدث · سقفُ ٢٠٠) و`localizeRows` نفسُها
 * (D-048: لا يُطلب TMDB إلّا لما خالف خطُّ اسمه لغةَ الواجهة). قراءةٌ لصاحبها وحدَه — لا معرّفَ في الطلب يُسأل عنه.
 * «مع تعليق» فرزٌ في الشاشة لا طلبٌ ثانٍ: التعليقُ نصٌّ داخل التقييم (حجّةُ الصفحة)، فالصفوفُ هي هي.
 */
/** 🆕 D-1596 — حجمُ الصفحة الأقصى: ٣٠ قرارُ أحمد («١ أ»)، والسقفُ يحمي الخادمَ من `limit` كبيرٍ يعيدنا إلى «الكلّ دفعةً» */
const PAGE_MAX = 60;

export async function GET(req: NextRequest) {
  return handle<MyRatingsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    /* 🆕 D-1596 — الصفحاتُ أكثرُ طلباتٍ من «الكلّ دفعةً»: الحدُّ يتّسع لتمريرٍ سريع (٣٠ صفحة × ٣٠ = ٩٠٠ تقييم في الدقيقة) */
    const lim = limited(`v1:ratings:${auth.user.id}`, 60, 60_000);
    if (lim) return lim;
    const p = req.nextUrl.searchParams;
    const rawLimit = p.get("limit");
    if (rawLimit !== null) {
      const limit = Math.min(PAGE_MAX, Math.max(1, Math.floor(Number(rawLimit)) || 30));
      const offset = Math.max(0, Math.floor(Number(p.get("offset") ?? 0)) || 0);
      const page = await getMyRatingsPage(offset, limit, p.get("comments") === "1");
      const rows = await localizeRows(page.rows, await getLocale());
      const shown = offset + rows.length;
      const of = p.get("comments") === "1" ? page.withComment : page.total;
      return ok({
        items: rows.map((r) => ({
          kind: r.media_type,
          id: r.tmdb_id,
          title: r.title,
          poster_path: r.poster_path,
          rating: r.rating,
          review: r.review?.trim() || null,
        })),
        total: page.total,
        with_comment: page.withComment,
        next_offset: rows.length === limit && shown < of ? shown : null,
      });
    }
    const rows = await localizeRows(await getMyRatings(), await getLocale());
    return ok({
      items: rows.map((r) => ({
        kind: r.media_type,
        id: r.tmdb_id,
        title: r.title,
        poster_path: r.poster_path,
        rating: r.rating,
        review: r.review?.trim() || null,
      })),
    });
  });
}
