"use client";

import { useState, useTransition } from "react";
import { saveRating, deleteRating } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";
import { tap } from "@/lib/haptics";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { Icon } from "./Icon";
import { dirOf } from "@/lib/dir";

export function RatingBox({
  tmdbId,
  mediaType,
  title,
  posterPath,
  backdropPath,
  locale,
  initialRating,
  initialReview,
  initialHasSpoiler = false,
  variant = "stars",
  onSaved,
}: {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  /**
   * 🆕 **غلافُ العمل** (D-313) — يُكتب مع التقييم لبطاقة «أعلى
   * التعليقات». **اختياريٌّ**: سطحٌ لا يملكه لا يمسّ ما كتبه غيرُه.
   */
  backdropPath?: string | null;
  locale: Locale;
  initialRating: number | null;
  initialReview: string | null;
  /**
   * 🆕 **«رسالتي فيها حرق» — الدفعةُ الثانية** (D-315، الهجرة ١٠٠):
   * إعلانُ الكاتب كما في مؤلّف النقاش (D-271)، **ورقاقةُ الحرق نفسُها
   * لا عائلةٌ ثالثة** (D-002).
   */
  initialHasSpoiler?: boolean;
  /**
   * `stars` في تبويب التتبّع، و`review` في تبويب التعليقات.
   *
   * التقييم فعلٌ سريع يقع مع التأشير، والتعليق كتابةٌ تحتاج مساحة وسياقاً
   * — وضعهما في صندوق واحد كان يجعل تبويب التتبّع طويلاً ويدفن التعليقات.
   */
  variant?: "stars" | "review";
  /**
   * يُنادى بعد حفظٍ ناجح — تستعمله ورقةُ «قيّمه الآن» لتغلق نفسها (D-158).
   *
   * اختياريّ عمداً: الصندوق في تبويب التتبّع لا يُغلق شيئاً، فالغياب هو
   * السلوك القائم حرفاً بحرف (قاعدة D-152: التفضيل الجديد افتراضُه ما كان).
   */
  onSaved?: () => void;
}) {
  const t = getDict(locale);
  const [rating, setRating] = useState(initialRating ?? 0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState(initialReview ?? "");
  const [spoiler, setSpoiler] = useState(initialHasSpoiler);
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
        await saveRating({
          tmdbId,
          mediaType,
          rating,
          review,
          title,
          posterPath,
          backdropPath,
          hasSpoiler: spoiler,
        });
        onSaved?.();
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
        <span className="text-[12px] text-muted ms-2 tabular-nums">{t.rateOutOf(rating)}</span>
      )}
    </div>
  );

  if (variant === "review") {
    /**
     * 🔴 🆕 **سطحُ كتابةٍ لا حقلٌ في بطاقة** (D-411، حكمُ أحمد بأربع
     * لقطات: تجربتُنا مقابل Letterboxd — «فرق كبير جدًّا، شوفه واحكم»).
     *
     * ================= والفرقُ الذي رآه، بالأرقام =================
     *
     * **حقلُنا كان ثلاثةَ أسطر** (`rows={3}`) داخل بطاقةٍ داخل تبويب.
     * **ومراجعتُه التي أرسلها ستُّ فقرات** — **فكان يكتبها في نافذةٍ
     * ترى منها ثلاثةَ أسطر**، وما كُتب يصعد خارج النظر كلَّما تابع.
     * **وLetterboxd يفتح ورقةً بارتفاع الشاشة**: الملصقُ والاسمُ فوق،
     * والنجومُ، **ثم مساحةُ كتابةٍ تملأ ما بقي.** **والفرقُ ليس ذوقاً:
     * الكتابةُ الطويلة تحتاج أن ترى ما كتبتَه.**
     *
     * **١ · فصار الحقلُ يملأ ما تحته** (`min-h-[38svh]` و`flex-1`):
     * **`svh` لا `vh`** — على الجوال يفتح لوحُ المفاتيح فيقصّ `vh`
     * ثلثَها، **والوحدةُ الصغرى هي الصادقةُ حين يكون اللوحُ مفتوحاً**
     * (نفسُ حجّة `Sheet`).
     *
     * **٢ · وصفُّ الأفعال يلتصق بالقاع** (`sticky bottom-0`): **زرُّ
     * الحفظ كان يهرب تحت لوح المفاتيح** كلَّما طال النصّ — **وفعلٌ لا
     * يُرى لا يقع** (D-142).
     *
     * **٣ · والعدّادُ يظهر عند الطرف وحدَه** (آخرُ ٢٠٠ حرف): **سقفُ
     * الألفين حقيقةٌ لا تُقال إلا حين تقترب** (D-222) — **وعدّادٌ يعدّ من
     * الحرف الأوّل يُشعر الكاتبَ أنه مراقَب.**
     *
     * ⚠️ **ولا قلبَ هنا وإن كان عند Letterboxd**: «أعجبني» فعلٌ له بابُه
     * في ترويسة العمل (D-130)، **وبابان لفعلٍ واحد هو ما تمنعه القاعدة
     * ٦** — **والنجمةُ والقلبُ ليسا شيئاً واحداً عندنا** (تقييمٌ ورأيٌ
     * في مقابل تفضيل).
     */
    const near = review.length > 1800;
    return (
      <div className="flex flex-col min-h-0">
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
          rows={8}
          /* 🆕 **والاتّجاهُ يتبع ما تكتبه** (D-421): `dirOf` تعدّ الحروفَ
             فتُقلَب الكتلةُ إلى اليمين متى غلبت العربية — **ولا
             `dir="auto"`** لأنها تقرأ أوّلَ حرفٍ قويٍّ وحدَه، **ونصٌّ
             يبدأ بكلمةٍ إنجليزيّة كان يبقى يساراً إلى آخره.** */
          dir={dirOf(review)}
          placeholder={t.reviewPlaceholder}
          className="w-full flex-1 min-h-[38svh] rounded-xl bg-surface-2 border border-border px-3.5 py-3 outline-none focus:border-accent transition text-[15px] leading-[1.9] resize-none"
        />

        {near && (
          <p className="mt-1 text-end text-[12px] text-muted tabular-nums" aria-live="polite">
            {2000 - review.length}
          </p>
        )}

        {error && (
          <Alert inline className="mt-2.5">
            {error}
          </Alert>
        )}

        <div className="sticky bottom-0 -mx-1 px-1 pt-2.5 pb-1 bg-[color:var(--elevated)] flex items-center gap-2 flex-wrap">
          <button
            onClick={save}
            disabled={pending}
            className={buttonClass({ size: "sm" })}
          >
            {pending ? t.saving : t.saveReview}
          </button>
          {/* 🆕 **رقاقةُ الحرق — وصفةُ مؤلّف النقاش حرفاً** (D-315/D-271):
              نفسُ العائلة ونفسُ الرمز، **ولا `checkbox` عارٍ** (D-016). */}
          <button
            type="button"
            onClick={() => {
              setSpoiler((v) => !v);
              setSaved(false);
            }}
            aria-pressed={spoiler}
            className={
              spoiler
                ? "inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-[12px] font-bold text-accent transition"
                : "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] text-muted transition hover:text-foreground"
            }
          >
            <Icon name={spoiler ? "eye-off" : "eye"} size={14} className="shrink-0" />
            <span>{t.spoilerMark}</span>
          </button>
          {initialRating != null && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="ms-auto text-[12px] text-muted hover:text-[color:var(--error)] px-2.5 py-2 rounded-lg hover:bg-surface-2 transition"
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
        <span className="text-[12px] text-muted">{t.reviewMovedHint}</span>
      </div>
    </div>
  );
}
