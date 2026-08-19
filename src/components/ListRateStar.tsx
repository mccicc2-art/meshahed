"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { ListReviewForm } from "./ListReviewForm";
import { getDict, num, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";

/**
 * **النجمةُ على بطاقة القائمة: تُظهِر الحكمَ وتفتحُ بابَه** (D-352، طلبُ
 * أحمد: «النجمة خلّها يسار القلب وظاهرة ٢٤ ساعة، بحيث أقدر أضغطها وأقيّم
 * وأكتب تعليق مباشرة — شاشة منبثقة»).
 *
 * ================= وهذا يحلّ توتّراً قائماً لا ينقض قاعدة =================
 *
 * **D-219 تمنع طباعةَ صفرٍ** — «★ ٠» تحت قائمةٍ جديدة **تُقرأ حكماً لا
 * فراغاً**. **والطلبُ هنا ليس أن يُطبع الصفر، بل أن يبقى البابُ مفتوحاً.**
 * **فالنجمةُ صارت زرّاً دائماً، والرقمُ بجانبها يبقى محكوماً بقاعدته**:
 * **يظهر إن وُجد ويغيب إن لم يوجد** — **زرٌّ دائمٌ ورقمٌ صادق**، ولا
 * تعارض.
 *
 * ================= ولماذا ورقةٌ لا انتقالٌ إلى الصفحة =================
 *
 * **لأن الفعلَ لا يستحقّ مغادرةَ الصفّ**: من يتصفّح رفّاً ويريد أن يقيّم
 * قائمةً **لا يريد أن يفقد موضعَه** — وهو نفسُ سببِ وجود الضغط المطوّل
 * (D-229). **والورقةُ تحمل عنوانَ القائمة** فلا تسأل «أيَّ قائمةٍ
 * أقيّم؟» (نصُّ `PosterHold` معكوساً: هناك المنسدلةُ أصحُّ لأن الملصقَ
 * ظاهر، وهنا الورقةُ أصحُّ لأنها تحمل صندوقَ كتابةٍ ولوحةَ مفاتيح —
 * D-018).
 *
 * ⚠️ **ولا تُرسم لصاحب القائمة ولا لقائمةٍ خاصّة ولا لزائر**: القاعدةُ
 * ترفض الثلاثة في `with check` (D-327)، **وزرٌّ يفشل عند الضغط وعدٌ
 * كاذب** (D-217) — فالمستدعي يمرّرها فقط حين تصحّ.
 *
 * ⚠️ **والبطاقةُ رابطٌ** فالضغطةُ تُوقَف عند الزرّ (وصفةُ `ListSaveHeart`).
 */
export function ListRateStar({
  listId,
  listName,
  rating,
  mine,
  locale,
}: {
  listId: string;
  listName: string;
  /** متوسّطُ الناس — يُطبع إن وُجد، **ويغيب إن لم يوجد** (D-219) */
  rating?: number | null;
  /** رأيي القائم — يملأ الورقة فيكون التعديلُ تعديلاً */
  mine?: { rating: number; body: string | null; hasSpoiler: boolean } | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t.listReviewsTitle}
        title={t.listReviewsTitle}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          tap(8);
          setOpen(true);
        }}
        className={`shrink-0 flex items-center gap-1 h-8 -mt-0.5 rounded-full px-1 text-12 font-bold tabular-nums transition active:scale-90 ${
          mine ? "text-accent" : "text-muted hover:text-accent"
        }`}
        dir="ltr"
      >
        <Icon
          name="star"
          size={16}
          strokeWidth={2}
          className={mine ? "fill-current" : ""}
        />
        {(rating ?? null) !== null && <span>{num(rating as number, locale)}</span>}
      </button>

      <Sheet
        open={open}
        variant="bottom"
        onClose={() => setOpen(false)}
        closeLabel={t.closeLabel}
        labelledBy="list-rate-title"
      >
        <SheetHeader
          id="list-rate-title"
          title={listName}
          closeLabel={t.closeLabel}
          onClose={() => setOpen(false)}
        />
        <div className="px-5 pb-5">
          <ListReviewForm
            listId={listId}
            locale={locale}
            mine={mine ?? null}
            onSaved={() => setOpen(false)}
          />
        </div>
      </Sheet>
    </>
  );
}
