import React, { useState } from "react";
import { useApp } from "../state";
import { ReviewSheet } from "../title/TitleCommunity";
import { write, ApiError } from "../api";
import type { ListReviewBody, ListReviewDeleteBody } from "../contracts";

/**
 * ====== رأيي في قائمةٍ — نسخةُ `ListRateStar` + `ListReviewForm` (الويب) ======
 * (D-948 — البندُ الأوّل من الثلاثة: «تقييم القائمة»)
 *
 * الورقةُ نفسُها (`Sheet`) بعنوان القائمة، ثمّ: سطرُ «رأيي» `text-12
 * font-semibold text-muted` · **عشرُ نجومٍ** (`StarRatingRow`: كلٌّ `w-7 h-8`،
 * نجمةٌ ٢٠، ممتلئةٌ بلون التمييز حتى المختارة، وإلّا `--disabled`) والرقمُ في
 * الطرف `text-14 font-bold text-accent` · حقلُ الرأي (`rows=7`، `rounded-control
 * bg-surface-2 border p-3 text-15`، ٢٠٠٠ حرفاً) · رقاقةُ «يحرق» بعينٍ
 * مفتوحة/مغلقة · «حفظ» أساسيٌّ معطَّلٌ بلا نجمة أو بلا تغيير · «حذف» شبحيٌّ
 * لمن له رأيٌ قائم.
 *
 * 🔑 **الكتابةُ `saveListReview`/`deleteListReview` نفسُهما** عبر
 * `/api/v1/lists/review*` — الحدُّ (٢٠/دقيقة) والتعقيمُ (١–١٠ · ٢٠٠٠ حرفاً)
 * في الفعل. **والتفاؤلُ بيد المستدعي** (`onSaved` يعدّل الكاش).
 */
export type MyReview = { rating: number; body: string | null; has_spoiler: boolean };

export function ListReviewSheet({
  listId,
  listName,
  mine,
  onClose,
  onSaved,
  onError,
}: {
  listId: string;
  listName: string;
  mine: MyReview | null;
  onClose: () => void;
  onSaved: (next: MyReview | null) => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);

  const submit = async (v: { rating: number; review: string | null; has_spoiler: boolean }) => {
    if (!v.rating || busy) return;
    setBusy(true);
    try {
      await write<{ done: true }>("/api/v1/lists/review", { listId, rating: v.rating, body: v.review, hasSpoiler: v.has_spoiler } satisfies ListReviewBody);
      onSaved({ rating: v.rating, body: v.review, has_spoiler: v.has_spoiler });
    } catch (e) {
      onError(e instanceof ApiError ? e : new Error("apiInternal"));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await write<{ done: true }>("/api/v1/lists/review-delete", { listId } satisfies ListReviewDeleteBody);
      onSaved(null);
    } catch (e) {
      onError(e instanceof ApiError ? e : new Error("apiInternal"));
    } finally {
      setBusy(false);
    }
  };

  /* 🔴 D-1052 — **التقييمُ شكلٌ واحدٌ أينما فُتح**: كانت هذه ورقةً سفليّةً بصفِّ نجومٍ خاصٍّ بها، بينما تقييمُ العمل
     والحلقة انبثاقٌ وسطيٌّ (D-1033) — شكلان لسؤالٍ واحد، دَينٌ بُلِّغ عنه مرّتين. الآن هذا الملفُّ **يملك الكتابةَ
     وحدَها** (`lists/review*`) ويرسم `ReviewSheet` نفسَها: النجومُ والرقمُ الكبير والتعليقُ و«فيها حرق» و«حذف
     تقييمي» تأتي منها، فلا صفَّ نجومٍ ثانياً ولا حقلاً ثانياً. الرأسُ اسمُ القائمة بلا ملصق (القائمةُ لا ملصقَ لها). */
  return (
    <ReviewSheet
      title={t.listReviewMine}
      head={{ name: listName }}
      initial={{ rating: mine?.rating ?? null, review: mine?.body ?? null, has_spoiler: mine?.has_spoiler ?? false }}
      busy={busy}
      onClose={onClose}
      onSave={(v) => void submit(v)}
      onRemove={mine ? () => void remove() : undefined}
    />
  );
}
