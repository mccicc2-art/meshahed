"use client";

import { useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { SpoilerText } from "./SpoilerText";
import { reportListReview } from "@/lib/actions";
import { ListReviewForm } from "./ListReviewForm";
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
  const [reported, setReported] = useState<ReadonlySet<string>>(new Set());
  const [, start] = useTransition();

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
    /* **صار القسمُ لوحَ تبويبٍ** (D-333) — فسقطت مرساةُ D-332 وهامشُ
       القاع: لوحُ `DetailTabs` يعطي المسافةَ، **ومرساةٌ إلى لوحٍ مخفيٍّ
       رابطٌ ميّت** */
    <section className="space-y-4">
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
        /* 🔧 **الصندوقُ خرج مكوّناً عند قارئه الثاني** (D-352):
            النجمةُ على بطاقة القائمة تفتحه ورقةً، **ونسخُه كان سيعني
            سلّمين يفترقان يوماً** (القاعدة ٦). */
        <div className="rounded-card border border-border bg-surface p-4">
          <ListReviewForm listId={listId} locale={locale} mine={mine} />
        </div>
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
