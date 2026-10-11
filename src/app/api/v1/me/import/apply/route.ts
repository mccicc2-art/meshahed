import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { applyImportChunk } from "@/lib/actions";
import type { ImportPayload } from "@/core/importer";

/**
 * `POST /api/v1/me/import/apply` — **كتابةُ دفعةٍ مستوردةٍ في المكتبة** (🆕 D-1369 · V-C · C6).
 * 🔑 **الفعلُ فعلُ الويب نفسُه** (`applyImportChunk`): خمسةُ مسلسلاتٍ أو ستّون فيلماً في الطلب، وكلُّ كتابةٍ `upsert` —
 * فمن انقطع استيرادُه (خرج من التطبيق) يعيده من أوّله بلا صفٍّ مكرّر، وما كُتب قبل الانقطاع باقٍ.
 * ⚖️ **بلا وسوم**: الإبطالُ مرّةٌ واحدةٌ عند `…/finish`، لا مع كلِّ دفعةٍ من مئتين — وإلّا أُعيد جلبُ الرئيسيّة مئتي مرّة تحت شريط التقدّم.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: Partial<ImportPayload>;
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    if (!body || typeof body !== "object") return fail("invalid_input");
    const shows = Array.isArray(body.shows) ? body.shows : [];
    const movies = Array.isArray(body.movies) ? body.movies : [];
    const done = await applyImportChunk({ shows, movies });
    return ok(done, []);
  });
}
