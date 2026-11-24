import type { NextRequest } from "next/server";
import { handle, requireUser, fail, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { createClient } from "@/lib/supabase/server";
import { applyImportFixes, cleanFixPairs, findImportFixes } from "@/lib/importFix";

/**
 * `POST /api/v1/me/import/fix` — 🆕 T537 **تصحيحُ مطابقةٍ قديمة** (أحمد ٢٤ نوفمبر «١أ»).
 * `{ pairs, apply: false }` ⇐ ما يُعرض (`items`). `{ pairs, apply: true }` ⇐ يُصحَّح ما يمرّ الشروطَ من جديد (`fixed`).
 * الفعلُ فعلُ الويب نفسُه (`lib/importFix`)، والشروطُ تُعاد عند التصحيح — العميلُ لا يُصدَّق.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const gate = limited(`import-fix:${auth.user.id}`, 20, 10 * 60_000);
    if (gate) return gate;
    let body: { pairs?: unknown; apply?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    const pairs = cleanFixPairs(body?.pairs);
    const supabase = await createClient();
    if (body?.apply === true) {
      const done = await applyImportFixes(supabase, auth.user.id, pairs);
      return ok({ items: [], ...done }, ["home", "me:library", "me:stats", "me:ratings", "me:diary"]);
    }
    return ok({ items: await findImportFixes(supabase, auth.user.id, pairs), fixed: 0, failed: 0 }, []);
  });
}
