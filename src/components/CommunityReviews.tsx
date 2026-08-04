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
  if (count === 0) return null;

  const rounded = Math.round(avg * 10) / 10;
  const written = reviews.filter((r) => r.review?.trim());

  return (
    <section className="mt-6 max-w-xl">
      <div className="flex items-baseline gap-3 flex-wrap mb-3">
        <h3 className="font-bold">{t.communityRating}</h3>
        <span className="text-accent text-sm">
          ★ {rounded} <span className="text-muted">/ 5</span>
        </span>
        <span className="text-xs text-muted">{t.communityCount(count)}</span>
      </div>

      {written.length === 0 ? (
        <p className="text-sm text-muted">{t.noReviews}</p>
      ) : (
        <div className="space-y-3">
          {written.map((r) => (
            <article
              key={`${r.id}-${r.updated_at}`}
              className="bg-surface border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <PersonName person={r} t={t} size={30} sub={formatDate(r.updated_at, t)} />
                <span className="text-sm shrink-0" title={t.rateOutOf(r.rating)}>
                  <span className="text-accent">{"★".repeat(r.rating)}</span>
                  <span className="text-muted/40">{"★".repeat(5 - r.rating)}</span>
                </span>
              </div>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{r.review}</p>
              <div className="mt-3 pt-2.5 border-t border-border/60">
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
