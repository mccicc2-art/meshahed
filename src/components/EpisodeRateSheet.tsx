"use client";

import { useState, useTransition } from "react";
import { rateEpisode } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";

export interface EpisodeTarget {
  season: number;
  episode: number;
  name: string;
  runtime: number | null;
  rating: number | null;
  review: string | null;
}

/**
 * ورقة تقييم حلقة (D-139).
 *
 * **نجوم `RatingBox` نفسها بنفس المقاس والسلوك** — لا عائلة تقييمٍ ثانية
 * (قاعدة ٣ في `00`). والفرق أنها في ورقةٍ لا في صندوقٍ داخل الصفحة:
 * صندوقٌ لكل حلقة يعني اثني عشر صندوقاً في الموسم الواحد، والصفّ يجب أن
 * يبقى صفّاً.
 *
 * **وحقل الرأي هنا ثلاثة أسطر لا خمسة عمداً:** رأيٌ في حلقةٍ واحدة سطران
 * غالباً، وحقلٌ طويل يوحي بأن المطلوب مقال فيُحجم من لا يريد كتابته.
 */
export function EpisodeRateSheet({
  showTmdbId,
  target,
  locale,
  onClose,
  onSaved,
}: {
  showTmdbId: number;
  /** `null` = الورقة مغلقة */
  target: EpisodeTarget | null;
  locale: Locale;
  onClose: () => void;
  /** يُبلَّغ بالنتيجة كي يحدّث الصفّ تفاؤلياً — و`null` تعني «سُحب التقييم» */
  onSaved: (season: number, episode: number, rating: number | null, review: string | null) => void;
}) {
  const t = getDict(locale);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /* الورقة تُعاد تهيئتها كلّما تغيّرت الحلقة — بلا `useEffect`: مقارنةُ
     مفتاحٍ أثناء الرسم هي النمط الذي توصي به React لحالةٍ مشتقّة من
     الخصائص، و`useEffect` هنا يرسم إطاراً بقيم الحلقة السابقة أولاً */
  const key = target ? `${target.season}-${target.episode}` : "";
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setRating(target?.rating ?? 0);
    setReview(target?.review ?? "");
    setError(null);
  }

  const shown = hover || rating;

  function save() {
    if (!target) return;
    if (rating < 1) {
      setError(t.ratePickFirst);
      return;
    }
    tap(10);
    setError(null);
    const body = review.trim();
    start(async () => {
      try {
        await rateEpisode({
          showTmdbId,
          season: target.season,
          episode: target.episode,
          rating,
          review: body || null,
          runtime: target.runtime,
        });
        onSaved(target.season, target.episode, rating, body || null);
        onClose();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function remove() {
    if (!target) return;
    tap(10);
    setError(null);
    start(async () => {
      try {
        await rateEpisode({
          showTmdbId,
          season: target.season,
          episode: target.episode,
          rating: null,
        });
        onSaved(target.season, target.episode, null, null);
        onClose();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <Sheet open={!!target} onClose={onClose} closeLabel={t.closeLabel} labelledBy="ep-rate-title">
      {target && (
        <>
          <SheetHeader title={t.epRateTitle} closeLabel={t.closeLabel} onClose={onClose} id="ep-rate-title">
            <span className="truncate">
              {t.epLabel(target.season, target.episode)} · {target.name}
            </span>
          </SheetHeader>

          <div className="px-5 pb-5 pt-3 space-y-3">
            {/* «التقييم يعني المشاهدة» يُقال للمستخدم لا يُترك ليُكتشف:
                من يقيّم حلقةً لم يؤشّرها سيجدها مؤشَّرة، ومفاجأةٌ صغيرة
                في سجلٍّ يثق به أسوأ من سطرٍ يشرح */}
            <p className="text-xs text-muted leading-relaxed">{t.epRateHint}</p>

            <div className="flex items-center gap-0.5 flex-wrap" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onFocus={() => setHover(n)}
                  onClick={() => setRating(n)}
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
                <span className="text-[12px] text-muted ms-2 tabular-nums">
                  {t.rateOutOf(rating)}
                </span>
              )}
            </div>

            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t.epReviewPlaceholder}
              className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed outline-none focus:border-accent/60 transition resize-none"
            />

            {error && <Alert>{error}</Alert>}

            <div className="flex items-center gap-3">
              <button onClick={save} disabled={pending} className={buttonClass()}>
                {pending ? t.saving : t.saveChanges}
              </button>
              {target.rating !== null && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="text-[12px] text-muted hover:text-foreground transition"
                >
                  {t.epRateRemove}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
