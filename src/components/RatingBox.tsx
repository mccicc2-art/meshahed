"use client";

import { useState, useTransition } from "react";
import { saveRating, deleteRating } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";
import { tap } from "@/lib/haptics";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";

export function RatingBox({
  tmdbId,
  mediaType,
  title,
  posterPath,
  locale,
  initialRating,
  initialReview,
  variant = "stars",
}: {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  locale: Locale;
  initialRating: number | null;
  initialReview: string | null;
  /**
   * `stars` في تبويب التتبّع، و`review` في تبويب التعليقات.
   *
   * التقييم فعلٌ سريع يقع مع التأشير، والتعليق كتابةٌ تحتاج مساحة وسياقاً
   * — وضعهما في صندوق واحد كان يجعل تبويب التتبّع طويلاً ويدفن التعليقات.
   */
  variant?: "stars" | "review";
}) {
  const t = getDict(locale);
  const [rating, setRating] = useState(initialRating ?? 0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState(initialReview ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = hover || rating;

  // الحفظ تفاؤلي كبقية الأفعال: «تم» يظهر فوراً ويتراجع إن فشلت الكتابة —
  // كان التقييم الفعل الرئيسي الوحيد الذي ينتظر الخادم ثم يجدّد الصفحة كلها
  function save() {
    if (rating < 1) {
      setError(t.ratePickFirst);
      return;
    }
    tap(10);
    setError(null);
    setSaved(true);
    start(async () => {
      try {
        await saveRating({ tmdbId, mediaType, rating, review, title, posterPath });
      } catch (e) {
        setSaved(false);
        setError((e as Error).message);
      }
    });
  }

  function remove() {
    tap(10);
    setError(null);
    const prev = { rating, review, saved };
    setRating(0);
    setReview("");
    setSaved(false);
    start(async () => {
      try {
        await deleteRating({ tmdbId, mediaType });
      } catch (e) {
        setRating(prev.rating);
        setReview(prev.review);
        setSaved(prev.saved);
        setError((e as Error).message);
      }
    });
  }

  const stars = (
    <div className="flex items-center gap-0.5 flex-wrap" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
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
          className={`text-[22px] leading-none px-0.5 py-1 transition ${
            n <= shown ? "text-accent scale-110" : "text-muted/40 hover:text-muted"
          }`}
        >
          ★
        </button>
      ))}
      {rating > 0 && (
        <span className="text-[13px] text-muted ms-2 tabular-nums">{t.rateOutOf(rating)}</span>
      )}
    </div>
  );

  if (variant === "review") {
    // مؤلّف مضغوط: كان صندوقاً بارتفاع شاشة — عنوان وسطران ونجوم كبيرة
    // وحقل بخمسة أسطر. صار سطرَ عنوانٍ ونجوماً وثلاثة أسطر كتابة.
    return (
      <div className="bg-surface border border-border rounded-2xl p-4">
        <div className="flex items-baseline justify-between gap-3 mb-2.5">
          <h3 className="font-bold text-[15px]">{t.reviewSectionTitle}</h3>
          {saved && (
            <span role="status" className="text-xs text-[color:var(--success)]">
              {t.savedOk}
            </span>
          )}
        </div>

        {/* النجوم هنا أيضاً: الحفظ يحتاج تقييماً، ومن يكتب تعليقه أولاً
            لا يجب أن يُرسل إلى تبويب آخر ليُكمل */}
        <div className="mb-2.5">{stars}</div>

        <textarea
          value={review}
          onChange={(e) => {
            setReview(e.target.value);
            setSaved(false);
          }}
          maxLength={2000}
          rows={3}
          placeholder={t.reviewPlaceholder}
          className="w-full rounded-xl bg-surface-2 border border-border px-3.5 py-2.5 outline-none focus:border-accent transition text-sm leading-relaxed resize-y"
        />

        {error && (
          <Alert inline className="mt-2.5">
            {error}
          </Alert>
        )}

        <div className="flex items-center gap-2 flex-wrap mt-2.5">
          <button
            onClick={save}
            disabled={pending}
            className={buttonClass({ size: "sm" })}
          >
            {pending ? t.saving : t.saveReview}
          </button>
          {initialRating != null && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="text-[13px] text-muted hover:text-red-300 px-2.5 py-2 rounded-lg hover:bg-surface-2 transition"
            >
              {t.deleteRating}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
      <h3 className="font-bold mb-3">{t.rateTitle}</h3>

      <div className="mb-1">{stars}</div>

      {error && (
        <Alert inline className="mt-3">
          {error}
        </Alert>
      )}

      <div className="flex items-center gap-3 flex-wrap mt-4">
        <button
          onClick={save}
          disabled={pending}
          className={buttonClass()}
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
        {saved && (
          <span role="status" className="text-sm text-[color:var(--success)]">
            {t.savedOk}
          </span>
        )}
        {/* التعليق انتقل إلى تبويب التعليقات — إشارة صغيرة تدلّ عليه */}
        <span className="text-[11px] text-muted">{t.reviewMovedHint}</span>
      </div>
    </div>
  );
}
