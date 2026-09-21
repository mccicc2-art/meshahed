import { renameList, setListKind } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { listTag } from "@/core/contracts/tags";
import type { ListUpdateBody } from "@/core/contracts/library";

/**
 * 🆕 D-1037 — اسمُ قائمتي ونبذتُها وخصوصيّتُها ونوعُها
 * غلافٌ رقيقٌ فوق دالّة الويب القائمة (`renameList` · `setListKind`): الحراسةُ والتحقّقُ والحدودُ فيها لا هنا —
 * **قارئٌ/كاتبٌ واحدٌ للسطحين**، فلا يفترق التطبيقُ عن الويب عند أوّل إصلاح.
 */
export const POST = bodyRoute<ListUpdateBody, { done: true }>(
  async (b) => {
    const id = String(b.listId ?? "");
    await renameList(id, String(b.name ?? ""), !!b.isPublic, b.subtitle === undefined ? undefined : b.subtitle);
    if (b.kind) await setListKind(id, b.kind);
    return { done: true as const };
  },
  (b) => [listTag(String(b.listId ?? "")), "me:lists"],
);
