import { getTitleReplies, getTitleReviews } from "@/lib/data";
import { num, type Locale } from "@/core/i18n";

/**
 * 🆕 D-1566 — عددُ المراجعات بجانب اسم التبويب (أحمد ٢٩ أكتوبر: «هنا احتاج يظهر عدد المراجعات الموجودة» — «١أ ٢أ ٣أ»).
 *
 * 🔑 **العدُّ هو ما يرسمه التبويبُ نفسُه**: رأيٌ مكتوبٌ أو رأيٌ له ردود — حارسُ `TitleCommunityTab` وحارسُ مسار التطبيق
 * (`/api/v1/title/…/community`) حرفاً — فالرقمُ الذي فوق هو عددُ الصفوف التي تحت. والشخصيّاتُ منها (صفحاتُ الويب تراها).
 * **خلف `Suspense` بلا هيكل**: لا يؤخّر رسمَ الشريط، ويغيب عند الصفر. `getTitleReviews` مخبّأةٌ للطلب فلا تُقرأ مرّتين.
 */
export async function TitleReviewsCount({ tmdbId, mediaType, locale }: { tmdbId: number; mediaType: "tv" | "movie"; locale: Locale }) {
  const [reviews, replies] = await Promise.all([
    getTitleReviews(tmdbId, mediaType).catch(() => []),
    getTitleReplies(tmdbId, mediaType).catch(() => []),
  ]);
  const replied = new Set(replies.map((r) => r.reviewUserId));
  const n = reviews.filter((r) => r.review?.trim() || replied.has(r.id)).length;
  if (!n) return null;
  return <span className="text-13 font-semibold text-muted tabular-nums">{num(n, locale)}</span>;
}
