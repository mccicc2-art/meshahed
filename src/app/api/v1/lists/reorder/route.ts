import { reorderList } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { listTag } from "@/core/contracts/tags";
import type { ListReorderBody } from "@/core/contracts/library";

/**
 * 🆕 D-1037 — ترتيبُ أعمال قائمتي بالسحب
 * غلافٌ رقيقٌ فوق دالّة الويب القائمة (`reorderList`): الحراسةُ والتحقّقُ والحدودُ فيها لا هنا —
 * **قارئٌ/كاتبٌ واحدٌ للسطحين**، فلا يفترق التطبيقُ عن الويب عند أوّل إصلاح.
 */
export const POST = bodyRoute<ListReorderBody, { done: true }>(
  async (b) => {
    await reorderList(String(b.listId ?? ""), Array.isArray(b.keys) ? b.keys : []);
    return { done: true as const };
  },
  (b) => [listTag(String(b.listId ?? "")), "me:lists"],
);
