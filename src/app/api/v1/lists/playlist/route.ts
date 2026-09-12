import { setListPlaylist } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { ListPlaylistBody } from "@/core/contracts/library";

/** `POST /api/v1/lists/playlist` — رايةُ التشغيل على قائمةٍ (لي أو محفوظة، D-674) */
export const POST = bodyRoute<ListPlaylistBody, { on: boolean }>(
  async (b) => {
    await setListPlaylist(String(b.listId ?? ""), !!b.on);
    return { on: !!b.on };
  },
  () => ["me:lists", "home"],
);
