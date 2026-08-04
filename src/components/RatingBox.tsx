"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRating, deleteRating } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";

export function RatingBox({
  tmdbId,
  mediaType,
  title,
  posterPath,
  locale,
  initialRating,
  initialReview,
}: {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  locale: Locale;
  initialRating: number | null;
  initialReview: string | null;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [rating, setRating] = useState(initialRating ?? 0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState(initialReview ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = hover || rating;

  function save() {
    if (rating < 1) {
      setError(t.ratePickFirst);
      return;
    }
    setError(null);
    start(async () => {
      try {
        await saveRating({ tmdbId, mediaType, rating, review, title, posterPath });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function remove() {
    setError(null);
    start(async () => {
      try {
        await deleteRating({ tmdbId, mediaType });
        setRating(0);
        setReview("");
        setSaved(false);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 mt-6 max-w-xl">
      <h3 className="font-bold mb-3">{t.rateTitle}</h3>

      <div className="flex items-center gap-2 mb-4" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => {
              setRating(n);
              setSaved(false);
            }}
            aria-label={t.rateStars(n)}
            aria-pressed={rating === n}
            className={`text-3xl leading-none p-1.5 -m-1 transition ${
              n <= shown ? "text-accent scale-110" : "text-muted/40 hover:text-muted"
            }`}
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <span className="text-sm text-muted ms-2">{t.rateOutOf(rating)}</span>
        )}
      </div>

      <textarea
        value={review}
        onChange={(e) => {
          setReview(e.target.value);
          setSaved(false);
        }}
        maxLength={2000}
        rows={4}
        placeholder={t.reviewPlaceholder}
        className="w-full rounded-xl bg-surface-2 border border-border px-4 py-3 outline-none focus:border-accent transition text-sm leading-relaxed resize-y"
      />

      {error && <p className="text-sm text-red-300 mt-3">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap mt-4">
        <button
          onClick={save}
          disabled={pending}
          className="px-5 py-2.5 rounded-xl bg-accent text-[color:var(--on-accent)] font-semibold text-sm hover:brightness-110 transition disabled:opacity-60"
        >
          {pending ? t.saving : t.saveRating}
        </button>
        {initialRating != null && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-sm text-muted hover:text-red-300 px-3 py-2 rounded-lg hover:bg-surface-2 transition"
          >
            {t.deleteRating}
          </button>
        )}
        {saved && <span className="text-sm text-accent-2">{t.savedOk}</span>}
      </div>
    </div>
  );
}
