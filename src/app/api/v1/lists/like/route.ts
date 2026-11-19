import { likeList } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { LikeListBody } from "@/core/contracts/library";
import { listTag } from "@/core/contracts/tags";

/** 🆕 249 — `POST /api/v1/lists/like` — إعجابٌ بقائمةِ غيري أو سحبُه (القلبُ صار إعجاباً منفصلاً عن الحفظ) */
export const POST = bodyRoute<LikeListBody, { liked: boolean }>(
  async (b) => {
    await likeList(String(b.listId ?? ""), !!b.like);
    return { liked: !!b.like };
  },
  /* وصفحةُ القائمة نفسُها تُبطَل مع «قوائمي» — فيكفي التطبيقَ إبطالُ `write()` وحدَه */
  (b) => ["me:lists", listTag(String(b.listId ?? ""))],
);
