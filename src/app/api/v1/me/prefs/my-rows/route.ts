import { setMyRows } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { serializeMyRows } from "@/core/myRows";
import type { MyRowsBody } from "@/core/contracts/discover";

/** `POST /api/v1/me/prefs/my-rows` — «صفوفك» في «اكتشف» (D-997): نفسُ `setMyRows` (كوكي)، بالتسلسل الذي يقرؤه الويب. */
export const POST = bodyRoute<MyRowsBody, { ok: boolean }>(
  async (b) => {
    const rows = Array.isArray(b.rows) ? b.rows.map((r) => ({ genre: String(r.genre), tag: r.tag ? String(r.tag) : null })) : [];
    await setMyRows(serializeMyRows(rows));
    return { ok: true };
  },
  () => ["news"],
);
