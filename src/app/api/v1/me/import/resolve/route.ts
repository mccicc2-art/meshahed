import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { resolveImportItems } from "@/lib/actions";
import type { ResolveRequest } from "@/core/importer";

/**
 * `POST /api/v1/me/import/resolve` — **مطابقةُ دفعةٍ من الأعمال بمعرّفات TMDB** (🆕 D-1369 · V-C · C6).
 * 🔑 **الفعلُ فعلُ الويب نفسُه** (`resolveImportItems`): سقفُ الأربعين وحدُّ المعدّل (٩٠ في الدقيقة) فيه، ومفتاحُ TMDB لا يغادر الخادم.
 * ⚖️ **ملفُّ التصدير لا يُرفع**: يُقرأ في الجهاز كما في الويب، ويصل هنا الاسمُ والمعرّفُ الخارجيُّ وحدَهما.
 * الردُّ بترتيب الطلب — العميلُ يقرن كلَّ نتيجةٍ بمفتاحها بالموضع.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: { requests?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    if (!body || !Array.isArray(body.requests)) return fail("invalid_input", { field: "requests" });
    const results = await resolveImportItems(body.requests as ResolveRequest[]);
    return ok({ results }, []);
  });
}
