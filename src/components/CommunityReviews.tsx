import { getDict, type Locale } from "@/lib/i18n";
import { formatDate } from "@/lib/when";
import type { TitleReview } from "@/lib/data";
import { PersonName } from "./PersonRow";
import { LikeButton } from "./LikeButton";

export function CommunityReviews({
  locale,
  avg,
  count,
  reviews,
  tmdbId,
  mediaType,
}: {
  locale: Locale;
  avg: number;
  count: number;
  tmdbId: number;
  mediaType: "tv" | "movie";
  /** مراجعات مع أصحابها — الاسم يظهر إلا لمن أخفاه من الإعدادات */
  reviews: TitleReview[];
}) {
  const t = getDict(locale);

  const rounded = Math.round(avg * 10) / 10;
  const written = reviews.filter((r) => r.review?.trim());

  return (
    <section className="mt-6 max-w-xl">
      {count > 0 && (
        <div className="flex items-baseline gap-3 flex-wrap mb-3">
          <h3 className="font-bold text-[15px]">{t.communityRating}</h3>
          <span className="text-accent text-sm font-bold tabular-nums">
            ★ {rounded} <span className="text-muted font-normal">/ 10</span>
          </span>
          <span className="text-xs text-muted">{t.communityCount(count)}</span>
        </div>
      )}

      {written.length === 0 ? (
        /* حالة فارغة مرئية بدل الاختفاء الصامت — دعوة لا فراغ */
        <div className="rounded-2xl border border-dashed border-white/12 px-5 py-8 text-center">
          <p className="text-2xl mb-2" aria-hidden>
            💬
          </p>
          <p className="text-sm text-muted leading-relaxed">{t.noReviews}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {written.map((r) => (
            <article
              key={`${r.id}-${r.updated_at}`}
              className="bg-surface border border-border rounded-2xl p-4"
            >
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <PersonName person={r} t={t} size={32} sub={formatDate(r.updated_at, t)} />
                <span
                  className="text-[13px] shrink-0 font-bold text-accent tabular-nums bg-accent/10 border border-accent/25 px-2 py-1 rounded-full"
                  title={t.rateOutOf(r.rating)}
                >
                  ★ <span dir="ltr">{r.rating}/10</span>
                </span>
              </div>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{r.review}</p>
              <div className="mt-3 pt-2.5 border-t border-[color:var(--divider)]">
                <LikeButton
                  reviewUserId={r.id}
                  tmdbId={tmdbId}
                  mediaType={mediaType}
                  likes={r.likes}
                  likedByMe={r.likedByMe}
                  isMine={r.isMine}
                  locale={locale}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
