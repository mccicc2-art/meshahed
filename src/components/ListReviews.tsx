"use client";

import { useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { SpoilerText } from "./SpoilerText";
import { buttonClass } from "./ui/Button";
import { chipClass, chipRow } from "./ui/controls";
import { saveListReview, deleteListReview, reportListReview } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, num, type Locale } from "@/lib/i18n";
import type { ListReviewRow } from "@/lib/data";

/**
 * **تقييمُ قائمةٍ ومراجعتُها** (D-327، طلبُ أحمد: «نفّذ المراجعات وتقييم
 * الليستات»).
 *
 * ================= مكوّنٌ واحدٌ لا سطحٌ جديد =================
 *
 * **ولا وصفةَ بصريّةً جديدة هنا**: الرقائقُ عائلةُ التحكّم الثانية
 * (D-016)، والحاجبُ `SpoilerText` نفسُه (D-315)، والوجهُ `Avatar`،
 * والزرُّ من مصنع `Button`. **وأيُّ عائلةٍ ثالثةٍ في سطحٍ رابع هي كيف
 * يتفكّك النظام** (D-002).
 *
 * ================= السلّمُ عشرةٌ كسلّم الأعمال =================
 *
 * **عملٌ يُقيَّم من عشرة وقائمةٌ من خمسة تُعلّم القارئَ سلّمين** — فالسلّم
 * واحد، **والرقائقُ عشرٌ تُختار منها واحدة** (سؤالٌ مغلقٌ من مجموعةٍ
 * معلومة).
 *
 * ================= والحالةُ تفاؤليّةٌ بحدّها =================
 *
 * **الحفظُ يكتب ثم يُبطل مسارَ الصفحة** (`revalidatePath` في الفعل) —
 * **ولا نرسم رأياً في الخطّ قبل أن يصل**: خطُّ الآراء يقرؤه غيرُك،
 * **ونسخةٌ تفاؤليّةٌ في سطحٍ عامٍّ تكذب على قارئٍ ثانٍ** (D-241 بحدّه).
 * الصندوقُ وحدَه يتفاءل: زرُّه يُقفل وتظهر رسالةُ النجاح.
 *
 * ⚠️ **وصاحبُ القائمة لا يُقيّمها**: القاعدةُ ترفضه في `with check`،
 * **والواجهةُ تقول له لماذا بدل أن تعرض له زرّاً يفشل** (D-217).
 */
export function ListReviews({
  listId,
  locale,
  isOwner,
  canReview,
  reviews,
  mine,
  stats,
}: {
  listId: string;
  locale: Locale;
  /** القائمةُ لي؟ — فلا صندوقَ، وسطرٌ يقول السبب */
  isOwner: boolean;
  /** قائمةٌ معلنةٌ ولستُ صاحبَها ولي حساب */
  canReview: boolean;
  reviews: ListReviewRow[];
  mine: { rating: number; body: string | null; hasSpoiler: boolean } | null;
  stats: { avg: number | null; count: number };
}) {
  const t = getDict(locale);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? "");
  const [spoiler, setSpoiler] = useState(mine?.hasSpoiler ?? false);
  const [saved, setSaved] = useState(!!mine);
  const [reported, setReported] = useState<ReadonlySet<string>>(new Set());
  const [, start] = useTransition();

  function submit() {
    if (!rating) return;
    tap([12, 30]);
    setSaved(true);
    start(async () => {
      try {
        await saveListReview({ listId, rating, body, hasSpoiler: spoiler });
        toast(t.listReviewSave, { tone: "success" });
      } catch (e) {
        setSaved(false);
        flashError((e as Error).message);
      }
    });
  }

  function removeMine() {
    tap(8);
    setSaved(false);
    setRating(0);
    setBody("");
    setSpoiler(false);
    start(async () => {
      try {
        await deleteListReview(listId);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  function report(userId: string) {
    tap(8);
    setReported((prev) => new Set(prev).add(userId));
    start(async () => {
      try {
        await reportListReview({ listId, reviewUserId: userId });
        toast(t.listReviewReported, { tone: "info" });
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    /* **المعرّفُ مرساةُ رقاقة الرأس** (D-332) — و`scroll-mt` يترك مسافةً
       للترويسة الملتصقة فلا يهبط العنوانُ تحتها */
    <section id="list-reviews" className="mt-8 space-y-4 scroll-mt-20">
      <div className="flex items-center gap-2">
        <Icon name="star" size={18} className="text-accent shrink-0" />
        <h2 className="text-[15px] font-bold">{t.listReviewsTitle}</h2>
        {/* **الرقمُ يجاور صاحبَه، والمقامُ معه** (D-216/D-219) — ولا يُرسم
            متوسّطٌ بلا رأيٍ واحد: **صفرٌ يُقرأ حكماً لا فراغاً.** */}
        {stats.count > 0 && stats.avg !== null && (
          <span className="ms-auto flex items-center gap-1.5 text-[13px] font-bold tabular-nums">
            <span dir="ltr">★ {num(stats.avg, locale)}</span>
            <span className="text-muted font-medium">
              {t.listReviewCount(num(stats.count, locale))}
            </span>
          </span>
        )}
      </div>

      {isOwner ? (
        <p className="text-[13px] text-muted">{t.listReviewOwn}</p>
      ) : canReview ? (
        <div className="rounded-card border border-border bg-surface p-4 space-y-3">
          <p className="text-[13px] font-semibold text-muted">{t.listReviewMine}</p>
          <div className={chipRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rating === n}
                onClick={() => {
                  tap(8);
                  setRating(n);
                  setSaved(false);
                }}
                className={chipClass(rating === n, "sm")}
              >
                <span dir="ltr">{num(n, locale)}</span>
              </button>
            ))}
          </div>

          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSaved(false);
            }}
            rows={3}
            maxLength={2000}
            placeholder={t.reviewPlaceholder}
            className="w-full rounded-control bg-surface-2 border border-border p-3 text-[15px] outline-none focus:border-accent/60"
          />

          <div className="flex items-center gap-2 flex-wrap">
            {/* **رقاقةُ الحرق بوصفة `Composer` حرفاً** (D-315) — عَلَمُ
                الحرق إعلانُ كاتبه لا حكمُنا عليه. */}
            <button
              type="button"
              aria-pressed={spoiler}
              onClick={() => {
                tap(8);
                setSpoiler((v) => !v);
                setSaved(false);
              }}
              className={chipClass(spoiler, "sm")}
            >
              <Icon name={spoiler ? "eye-off" : "eye"} size={14} strokeWidth={2.2} />
              <span className="ms-1.5">{t.spoilerMark}</span>
            </button>

            <button
              type="button"
              disabled={!rating || saved}
              onClick={submit}
              className={`ms-auto ${buttonClass({ variant: "primary", size: "md" })}`}
            >
              {t.listReviewSave}
            </button>
            {mine && (
              <button
                type="button"
                onClick={removeMine}
                className={buttonClass({ variant: "ghost", size: "md" })}
              >
                {t.listReviewDelete}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {reviews.length === 0 ? (
        <p className="text-[13px] text-muted">{t.listReviewsEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.userId} className="rounded-card border border-border bg-surface p-3">
              <div className="flex items-center gap-2">
                <Avatar src={r.avatarUrl} name={r.nickname ?? r.username ?? ""} size={28} />
                {/* **ومخفي الاسم بلا بديل** — الغيابُ أصدق (D-011) */}
                <span className="text-[13px] font-semibold truncate">
                  {r.hideName ? "" : (r.nickname ?? r.username ?? "")}
                </span>
                <span className="ms-auto text-[13px] font-bold tabular-nums" dir="ltr">
                  ★ {num(r.rating, locale)}
                </span>
              </div>
              {r.body && (
                <div className="mt-2 text-[15px] leading-relaxed">
                  {r.hasSpoiler ? (
                    <SpoilerText text={r.body} locale={locale} note={t.listReviewSpoilerNote} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{r.body}</p>
                  )}
                </div>
              )}
              {/* **بابُ البلاغ على كلِّ رأي** (D-193) — ويُقفل بعد الضغط
                  فلا يُبلَّغ مرّتين، **والقاعدةُ تمنع الثاني بمفتاحها.** */}
              <button
                type="button"
                disabled={reported.has(r.userId)}
                onClick={() => report(r.userId)}
                className="mt-2 text-[12px] text-muted hover:text-foreground disabled:opacity-50"
              >
                {reported.has(r.userId) ? t.listReviewReported : t.listReviewReport}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
