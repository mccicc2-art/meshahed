import { deleteList } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { listTag } from "@/core/contracts/tags";
import type { ListDeleteBody } from "@/core/contracts/library";

/**
 * 🆕 D-1037 — حذفُ قائمتي (لا رجعةَ فيه — التأكيدُ في الشاشة)
 * غلافٌ رقيقٌ فوق دالّة الويب القائمة (`deleteList`): الحراسةُ والتحقّقُ والحدودُ فيها لا هنا —
 * **قارئٌ/كاتبٌ واحدٌ للسطحين**، فلا يفترق التطبيقُ عن الويب عند أوّل إصلاح.
 */
export const POST = bodyRoute<ListDeleteBody, { done: true }>(
  async (b) => {
    await deleteList(String(b.listId ?? ""));
    return { done: true as const };
  },
  (b) => [listTag(String(b.listId ?? "")), "me:lists", "home"],
);
