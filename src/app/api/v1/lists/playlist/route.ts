import { setListPlaylist, setSavedListPlaylist } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { ListPlaylistBody } from "@/core/contracts/library";

/** `POST /api/v1/lists/playlist` — رايةُ التشغيل على قائمةٍ (لي أو محفوظة، D-674) */
export const POST = bodyRoute<ListPlaylistBody, { on: boolean }>(
  async (b) => {
    const id = String(b.listId ?? "");
    /* 🆕 T583 — **وقائمةٌ حفظتَها من غيرك**: مفتاحُ «⋯» يُرسل هنا للحالتين، وكاتبُ صفةِ القائمة لا يصيب إلّا قائمتك
       (D-674: لكلٍّ كاتبُه) — فإن لم تكن لك فهو صفُّ حفظِك أنت. وغيرُ المحفوظة يفشل بصوتِه هناك */
    try {
      await setListPlaylist(id, !!b.on);
    } catch {
      await setSavedListPlaylist(id, !!b.on);
    }
    return { on: !!b.on };
  },
  () => ["me:lists", "home"],
);
