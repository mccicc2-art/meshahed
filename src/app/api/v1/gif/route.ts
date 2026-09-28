import type { NextRequest } from "next/server";
import { searchGifs, GIF_MAX_OFFSET } from "@/lib/gif";
import { getLocale } from "@/lib/locale";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { GifPayload } from "@/core/contracts/thread";

const PAGE = 24;

/**
 * `GET /api/v1/gif?q=&offset=` — منتقي الـGIF الأصليّ (Phase 11-M · M3 · خطّة §٣-أ).
 *
 * 🔑 **المفتاحُ في الخادم وحدَه** (القاعدة ١٤ — `GIPHY_API_KEY`) · `pg-13` · والعائدُ **معرّفاتٌ لا روابط** (D-362): التطبيقُ
 * يبني `200w.webp` من قالب `gifUrl`. **الحقلُ الفارغُ = الرائج**، والبحثُ بلغة القارئ، والترقيمُ بـ`offset` مسقوفٌ هنا
 * (`GIF_MAX_OFFSET`) — **والحدُّ حدُّ `findGifs` نفسُه** (٤٠ في الدقيقة) كي لا يكون للتطبيق بابٌ أوسعُ من الويب.
 */
export async function GET(req: NextRequest) {
  return handle<GifPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`gif:${auth.user.id}`, 40, 60_000);
    if (lim) return lim;
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").slice(0, 60);
    const offset = Math.min(Math.max(0, Number(sp.get("offset")) || 0), GIF_MAX_OFFSET);
    const locale = await getLocale();
    const hits = await searchGifs(q, PAGE, { offset, lang: locale === "ar" ? "ar" : "en" });
    const next = hits.length >= PAGE && offset + PAGE <= GIF_MAX_OFFSET ? offset + PAGE : null;
    return ok({ hits: hits.map((h) => ({ id: h.id, ratio: h.ratio, alt: h.alt })), next });
  });
}
