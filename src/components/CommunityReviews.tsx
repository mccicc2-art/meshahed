import { getDict, num, type Locale } from "@/lib/i18n";
import type { RatingRow } from "@/lib/data";

export function CommunityReviews({
  locale,
  avg,
  count,
  reviews,
}: {
  locale: Locale;
  avg: number;
  count: number;
  reviews: RatingRow[];
}) {
  const t = getDict(locale);
  if (count === 0) return null;

  const rounded = Math.round(avg * 10) / 10;

  return (
    <section className="mt-6 max-w-xl">
      <div className="flex items-baseline gap-3 flex-wrap mb-3">
        <h3 className="font-bold">{t.communityRating}</h3>
        <span className="text-accent text-sm">
          ★ {rounded} <span className="text-muted">/ 5</span>
        </span>
        <span className="text-xs text-muted">{t.communityCount(count)}</span>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted">{t.noReviews}</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <article
              key={`${r.user_id}-${r.tmdb_id}`}
              className="bg-surface border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-accent text-sm">{"★".repeat(r.rating)}</span>
                <span className="text-[11px] text-muted" dir="ltr">
                  {num(r.rating, locale)}/5
                </span>
              </div>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{r.review}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
