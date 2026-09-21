import { setListCover } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { listTag } from "@/core/contracts/tags";
import type { ListCoverBody } from "@/core/contracts/library";

/**
 * 🆕 D-1037 — غلافُ قائمتي: خلفيّةُ عملٍ منها، أو `null` للعودة إلى التلقائيّ
 * غلافٌ رقيقٌ فوق دالّة الويب القائمة (`setListCover`): الحراسةُ والتحقّقُ والحدودُ فيها لا هنا —
 * **قارئٌ/كاتبٌ واحدٌ للسطحين**، فلا يفترق التطبيقُ عن الويب عند أوّل إصلاح.
 */
export const POST = bodyRoute<ListCoverBody, { done: true }>(
  async (b) => {
    await setListCover({ listId: String(b.listId ?? ""), tmdbId: b.tmdbId ?? null, mediaType: b.mediaType ?? null, backdropPath: b.backdropPath ?? null, color: null });
    return { done: true as const };
  },
  (b) => [listTag(String(b.listId ?? "")), "me:lists"],
);
