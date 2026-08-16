import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { displayNameOf } from "@/lib/people";
import type { ReviewReply, TitleReview } from "@/lib/data";
import { timeAgoShort } from "@/lib/when";
import { dirOf, alignOf } from "@/lib/dir";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LikeButton } from "./LikeButton";
import { SpoilerText } from "./SpoilerText";

/**
 * **صفحةُ كلامِ العمل — خطٌّ لا شجرة** (D-193، وأُعيد تشريحُها في D-242).
 *
 * ================= ما تغيّر، وبأيّ حجّة =================
 *
 * **طلبُ أحمد بلقطةٍ من تويتر:** «صفحة التعليقات على الفلم… تكون مثل
 * تويتر. ما أبغى أخترع شي، أبغى شي مألوف للناس ويفهمه بسرعة».
 *
 * كان كلُّ رأيٍ يحمل **ردودَه مطويّةً تحته** وصندوقَ كتابةٍ خاصّاً به.
 * **وثلاثةُ أعطالٍ يكشفها الاستعمال:**
 *
 * **١ · القائمةُ لم تعد قائمة.** رأيٌ عليه عشرون ردّاً يدفع الرأيَ
 * الثاني خارج الشاشة — **فمن جاء ليقرأ الآراء وجد حواراً واحداً.**
 * **٢ · والعمودُ يضيق كلَّما عمُق الحوار**: إزاحةٌ للخيط وأخرى للردّ على
 * ردّ، **فثلاثُ كلماتٍ في السطر على هاتف.**
 * **٣ · وصندوقُ كتابةٍ لكلِّ رأيٍ يعني عشرةَ أبوابٍ مفتوحة** في صفحةٍ
 * سؤالُها «ماذا قالوا؟» لا «ماذا أقول أنا؟».
 *
 * **وتويتر يحلّها بحلٍّ واحد: الخطُّ يعرض، والصفحةُ تُحاور.** فصار الصفُّ
 * هنا **يُقرأ ويُضغط** — والردودُ والكتابةُ في `‎/review/…`.
 *
 * ⚠️ **وهذا يغيّر سطحين لا سطحاً:** `CommunityReviews` (تبويب الآراء في
 * صفحة العمل) يرسم بهذا المكوّن نفسِه. **وهو الصواب لا أثرٌ جانبيّ:**
 * الرأيُ الواحد لا يُقرأ بشكلين في التطبيق (نفسُ حجّة D-193).
 *
 * **وصار المكوّنُ خادماً بعد أن كان عميلاً** — لا حالةَ فيه بعد اليوم:
 * **جافاسكربت أقلّ على هاتفٍ يقرأ نصّاً**، وهو مكسبٌ لم يكن مقصوداً.
 */
export function TalkThread({
  reviews,
  replies,
  tmdbId,
  mediaType,
  locale,
  signedIn,
}: {
  reviews: TitleReview[];
  /** ردودُ العمل كلِّه — **تُستعمل عدّاداً لا قائمةً** بعد D-242 */
  replies: ReviewReply[];
  tmdbId: number;
  mediaType: "tv" | "movie";
  locale: Locale;
  signedIn: boolean;
}) {
  const t = getDict(locale);

  /* عدُّ الردود لكل رأيٍ مرّةً واحدة — **ولو بحث كلُّ صفٍّ في المصفوفة
     كلِّها صار العملُ حاصلَ ضرب** (نفسُ حارس `byReview` القديم) */
  const counts = new Map<string, number>();
  for (const r of replies) counts.set(r.reviewUserId, (counts.get(r.reviewUserId) ?? 0) + 1);

  /* الرأيُ يظهر إن كان مكتوباً — **أو إن كان له ردود**: خيطٌ برأسٍ
     محذوفِ النصِّ يقرأ كحوارٍ مع فراغ */
  const shown = reviews.filter((r) => r.review?.trim() || counts.has(r.id));

  if (!shown.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
        <p className="text-2xl mb-2" aria-hidden>
          💬
        </p>
        <p className="text-sm text-muted leading-relaxed">{t.noReviews}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[color:var(--divider)]">
      {shown.map((r) => {
        const who = displayNameOf(r, t.anonymousUser);
        const href = `/review/${mediaType}/${tmdbId}/${r.id}`;
        const n = counts.get(r.id) ?? 0;
        return (
          /* **صفُّ خطّ النشاط نفسُه** (D-232): وجهٌ يجاور الترويسة، والنصُّ
             يمرّ تحته بعرض العمود، والذيلُ في القاع. **عائلةٌ واحدة لصفّ
             الكلام في التطبيق كلِّه.** */
          <article key={r.id} id={`review-${r.id}`} className="py-4 first:pt-0 flex gap-3">
            <Link href={href} prefetch={false} className="shrink-0 active:opacity-80 transition">
              <Avatar src={r.hide_name ? null : r.avatar_url} name={who} size={44} alt="" />
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Link
                  href={r.username ? `/u/${r.username}` : href}
                  prefetch={false}
                  className="min-w-0 truncate font-bold text-[14px] leading-tight hover:text-accent transition"
                >
                  <bdi>{who}</bdi>
                </Link>
                <span aria-hidden className="shrink-0 text-muted text-[12px]">
                  ·
                </span>
                {/* **العمرُ بابٌ إلى الخيط** — عادةُ تويتر (D-239/D-242) */}
                <Link
                  href={href}
                  prefetch={false}
                  className="shrink-0 text-[12px] text-muted tabular-nums hover:text-accent transition"
                >
                  {timeAgoShort(r.updated_at, t)}
                </Link>
                {/* **والتقييمُ بشكلٍ واحد في التطبيق** (D-241): `10.0`
                    لا `10/10` — **والمقامُ يُكتب حيث يتغيّر لا حيث يثبت.** */}
                <span
                  className="ms-auto shrink-0 text-[13px] font-bold text-accent tabular-nums"
                  title={t.rateOutOf(r.rating)}
                >
                  ★ <span dir="ltr">{r.rating.toFixed(1)}</span>
                </span>
              </div>

              {r.review?.trim() &&
                /* 🆕 **إعلانُ الحرق يحجب المتنَ نفسَه** (D-315، الهجرة
                   ١٠٠) — **والحاجبُ خارج الرابط**: زرُّ الكشف داخلَ رابطٍ
                   هو عطلُ D-155 بعينه، **ومن ضغط «اعرض الحرق» لم يقصد أن
                   يفتح صفحة.** */
                (r.has_spoiler ? (
                  /* **ولا سطرَ شرحٍ بجانب الزرّ** — حكمُ D-287/D-289 قائم */
                  <SpoilerText text={r.review} locale={locale} />
                ) : (
                  /* **اتّجاهُ الرأي من الرأي** (D-241)، **ولونُه لون المتن**:
                     أخفتُ نصٍّ في صفحةٍ لا يصحّ أن يكون سببَ وجودها. */
                  <Link
                    href={href}
                    prefetch={false}
                    /* **الاتّجاه على الرابط لا على المقصوص** — D-282 */
                    dir={dirOf(r.review)}
                    className={`block mt-2 ${alignOf(r.review)}`}
                  >
                    <p className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-line line-clamp-6">
                      {r.review}
                    </p>
                  </Link>
                ))}

              {/* **الذيل: إعجابٌ · عدّادُ ردودٍ يفتح الخيط** — وشكلُه شكلُ
                  ذيلِ خطّ النشاط حرفاً (D-234): بإزاحة `-mx-0.5` نفسِها.
                  **ولا بلاغَ هنا**: البلاغُ فعلٌ نادرٌ يسكن صفحةَ الكلام،
                  **وقائمةٌ من عشرة صفوفٍ فيها عشرةُ أزرارِ بلاغ تُخيف.** */}
              <div className="mt-2 -mx-0.5 flex items-center gap-1">
                <LikeButton
                  reviewUserId={r.id}
                  tmdbId={tmdbId}
                  mediaType={mediaType}
                  likes={r.likes}
                  likedByMe={r.likedByMe}
                  isMine={r.isMine}
                  /* **الزائرُ يقرأ الرقم ولا يضغطه** (D-221) */
                  readOnly={!signedIn}
                  locale={locale}
                />
                <Link
                  href={href}
                  prefetch={false}
                  aria-label={t.talkReply}
                  title={t.talkReply}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] tabular-nums text-muted hover:text-accent transition"
                >
                  <Icon name="comment" size={15} />
                  {/* **والصفرُ لا يُرسم** (D-222) */}
                  {n > 0 && n}
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
