import { toggleInList } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { ListToggleItemBody } from "@/core/contracts/title";

/**
 * `POST /api/v1/lists/toggle-item` — عملٌ إلى قائمةٍ أو منها (D-956 · D2): الفعلُ
 * نفسُه الذي تستعمله ورقةُ «إلى قائمة» في `TitleActions` (`toggleInList`).
 */
export const POST = bodyRoute<ListToggleItemBody, { done: true }>(
  async (b) => {
    await toggleInList({ listId: String(b.listId), tmdbId: b.tmdbId, mediaType: b.mediaType, title: String(b.title ?? ""), posterPath: b.posterPath ?? null, add: !!b.add });
    return { done: true as const };
  },
  () => ["me:lists", "me:library"],
);
