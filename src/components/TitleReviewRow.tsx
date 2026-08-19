import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import type { TitleReview } from "@/lib/data";
import { displayNameOf } from "@/lib/people";
import { timeAgoShort } from "@/lib/when";
import { dirOf, alignOf } from "@/lib/dir";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LikeButton } from "./LikeButton";
import { SpoilerText } from "./SpoilerText";

/**
 * **بطاقةُ الرأي في خطّ المجتمع** (D-407، لقطةُ أحمد بمستطيلين أحمرين:
 * «حسّن تصميم الصندوق وتصميم المنشور مثل كذا»).
 *
 * ================= ما تغيّر عن الصفّ الذي كان =================
 *
 * **كان صفّاً في قائمةٍ مفصولةٍ بخطوط** (`divide-y`) — **وهو الشكلُ
 * الصحيح لخيطٍ متّصلٍ كتويتر**، **والخطأُ لقائمةٍ عناصرُها مستقلّةٌ لا
 * يردّ بعضُها على بعض. فصار كلُّ رأيٍ بطاقةً**: سطحٌ وحدٌّ وزوايا،
 * **فيُقرأ وحدةً واحدةً تُضغط**، ويصير الفراغُ بين البطاقات هو الفاصل
 * لا خطٌّ يُرسم.
 *
 * **وسطرُ النوع تحت الاسم** (`REVIEW`): **الخطُّ فيه صنفان** — رأيُ
 * إنسانٍ ونشرةُ Loopz — **والوجهُ وحدَه لا يكفي** حين يمرّ القارئُ
 * سريعاً. **حروفٌ صغيرةٌ مرتفعةٌ بلون الهوية** لا شارةٌ ملوّنة: **تُقرأ
 * ولا تزاحم.**
 *
 * ⚠️ **والذيلُ لم يُبدَّل بكلمات**: `Reply | Like` في تصميم أحمد جميلةٌ
 * هنا، **لكن ذيلَ الفعل عائلةٌ واحدةٌ في التطبيق** (D-234): نفسُه في
 * `ListReviews` وفي خطّ النشاط. **فلو كتبناها كلماتٍ هنا وحدَه لافترق
 * ثلاثةُ أسطحٍ عن أخيها** (قاعدة ٦) — **والكلمةُ تُضاف للثلاثة معاً
 * بمعاملٍ واحد متى طلبها المالك**، وهو بندٌ في `05`.
 */
export function TitleReviewRow({
  r,
  count,
  tmdbId,
  mediaType,
  locale,
  signedIn,
}: {
  r: TitleReview;
  /** عددُ ردودِ هذا الرأي — **يُحسب مرّةً في القائمة لا في الصفّ** */
  count: number;
  tmdbId: number;
  mediaType: "tv" | "movie";
  locale: Locale;
  signedIn: boolean;
}) {
  const t = getDict(locale);
  const who = displayNameOf(r, t.anonymousUser);
  const href = `/review/${mediaType}/${tmdbId}/${r.id}`;

  return (
    <article
      id={`review-${r.id}`}
      className="rounded-2xl border border-border bg-surface p-3.5 flex gap-3"
    >
      <Link href={href} prefetch={false} className="shrink-0 active:opacity-80 transition">
        <Avatar src={r.hide_name ? null : r.avatar_url} name={who} size={44} alt="" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={r.username ? `/u/${r.username}` : href}
                prefetch={false}
                className="min-w-0 truncate font-bold text-14 leading-tight hover:text-accent transition"
              >
                <bdi>{who}</bdi>
              </Link>
              <span aria-hidden className="shrink-0 text-muted text-12">
                ·
              </span>
              {/* **العمرُ بابٌ إلى الخيط** — عادةُ تويتر (D-239/D-242) */}
              <Link
                href={href}
                prefetch={false}
                className="shrink-0 text-12 text-muted tabular-nums hover:text-accent transition"
              >
                {timeAgoShort(r.updated_at, t)}
              </Link>
            </div>
            <p className="mt-0.5 text-[10px] font-bold tracking-[0.08em] uppercase text-accent">
              {t.communityKindReview}
            </p>
          </div>

          {/* **والتقييمُ بشكلٍ واحد في التطبيق** (D-241): `10.0` لا
              `10/10` — **ولا خمسُ نجماتٍ تترجم عشرةً** فتصير للتقييم
              لغتان في شاشةٍ واحدة. */}
          <span
            className="ms-auto shrink-0 text-14 font-bold text-accent tabular-nums"
            title={t.rateOutOf(r.rating)}
          >
            ★ <span dir="ltr">{r.rating.toFixed(1)}</span>
          </span>
        </div>

        {r.review?.trim() &&
          /* **إعلانُ الحرق يحجب المتنَ نفسَه** (D-315) — **والحاجبُ خارج
             الرابط**: زرُّ الكشف داخلَ رابطٍ هو عطلُ D-155 بعينه. */
          (r.has_spoiler ? (
            <SpoilerText text={r.review} locale={locale} />
          ) : (
            <Link
              href={href}
              prefetch={false}
              /* **الاتّجاه على الرابط لا على المقصوص** — D-282 */
              dir={dirOf(r.review)}
              className={`block mt-2 ${alignOf(r.review)}`}
            >
              {/* 🆕 **ولا قصَّ هنا أيضاً** (D-429): **القاعدةُ واحدةٌ في
                  الأسطح الأربعة** — من رتّب متنَه يُقرأ مرتَّباً كاملاً،
                  **وستّةُ أسطرٍ هنا وثلاثةٌ في الخطّ حدّان لسببٍ واحد.** */}
              <p className="fs-content text-14 leading-relaxed text-foreground/90 whitespace-pre-line">
                {r.review}
              </p>
            </Link>
          ))}

        {/* **الذيل: إعجابٌ · عدّادُ ردودٍ يفتح الخيط** — شكلُ ذيلِ خطّ
            النشاط حرفاً (D-234). */}
        <div className="mt-2 -mx-0.5 flex items-center gap-1">
          <LikeButton
            reviewUserId={r.id}
            tmdbId={tmdbId}
            mediaType={mediaType}
            likes={r.likes}
            likedByMe={r.likedByMe}
            isMine={r.isMine}
            readOnly={!signedIn}
            locale={locale}
          />
          <Link
            href={href}
            prefetch={false}
            aria-label={t.talkReply}
            title={t.talkReply}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-12 tabular-nums text-muted hover:text-accent transition"
          >
            <Icon name="comment" size={15} />
            {/* **والصفرُ لا يُرسم** (D-222) */}
            {count > 0 && count}
          </Link>
        </div>
      </div>
    </article>
  );
}
