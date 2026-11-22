import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { createClient } from "@/lib/supabase/server";
import { readImportRuns } from "@/lib/importRuns";

/**
 * `GET /api/v1/me/import/runs` — 🆕 T507 · **«استيراداتك»**: آخرُ خمسين استيراداً لصاحبها (`import_runs`، هجرة ٢٥٧).
 * القراءةُ بجلسة العضو (Bearer) فتحرسها سياسةُ القراءة أيضاً. والتطبيقُ يعيد طلبها بعد كلِّ استيراد — لا وسمَ يُبطلها.
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const supabase = await createClient();
    return ok({ runs: await readImportRuns(supabase, auth.user.id) }, []);
  });
}
