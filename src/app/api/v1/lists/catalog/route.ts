import type { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { catalogPicker } from "@/lib/actions";
import type { CatalogPickerPayload } from "@/core/contracts/library";

/**
 * 🆕 T454 — `GET /api/v1/lists/catalog` — اختيارُ «قائمة جديدة» من الكتالوج كلِّه (شاشةُ التطبيق) فوق `catalogPicker`
 * نفسِها التي تناديها صفحةُ الويب (D-145). الحدُّ في الفعل (`preview` ٦٠/دقيقة)، والمعاملاتُ تُطهَّر هناك.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const sp = req.nextUrl.searchParams;
    const payload: CatalogPickerPayload = await catalogPicker({
      src: sp.get("src") ?? undefined,
      type: sp.get("type") ?? undefined,
      g: sp.get("g") ?? undefined,
      era: sp.get("era") ?? undefined,
      rate: sp.get("rate") ?? undefined,
      q: sp.get("q") ?? undefined,
      n: Number(sp.get("n")) || undefined,
    });
    return ok(payload);
  });
}
