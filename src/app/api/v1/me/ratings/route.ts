import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale } from "@/lib/locale";
import { getMyRatings } from "@/lib/data";
import { localizeRows } from "@/lib/localize";
import type { MyRatingsPayload } from "@/core/contracts/profile";

/**
 * `GET /api/v1/me/ratings` — **تقييماتي وتعليقاتي** (🆕 D-1357 · Phase 11-V · V-C · C1، قرارُ أحمد ١١ أكتوبر: «نفذ»). كان عنوانُ
 * «التقييمات — من الأعلى» و«الكلّ» في الرئيسيّة الأصليّة يفتحان صفحةَ الويب طبقةً — آخرُ بابٍ ويبيٍّ في أقسام الرئيسيّة.
 * **الحمولةُ ما ترسمه `/ratings` حرفاً**: `getMyRatings` نفسُها (الأعلى تقييماً ثمّ الأحدث · سقفُ ٢٠٠) و`localizeRows` نفسُها
 * (D-048: لا يُطلب TMDB إلّا لما خالف خطُّ اسمه لغةَ الواجهة). قراءةٌ لصاحبها وحدَه — لا معرّفَ في الطلب يُسأل عنه.
 * «مع تعليق» فرزٌ في الشاشة لا طلبٌ ثانٍ: التعليقُ نصٌّ داخل التقييم (حجّةُ الصفحة)، فالصفوفُ هي هي.
 */
export async function GET() {
  return handle<MyRatingsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:ratings:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
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
