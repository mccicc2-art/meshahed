import type { NextRequest } from "next/server";
import { handle, requireUser, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { createClient } from "@/lib/supabase/server";
import type { SupporterHideBody } from "@/core/contracts/supporters";

/**
 * `POST /api/v1/me/supporter` — **إخفاءُ اسمي من لوحة الداعمين أو إظهارُه** (🆕 D-gold-perks، «١ أ»). قرارٌ واحدٌ يُخفي الاسمَ من
 * اللوحة ومن سطر «داعم لوبز منذ» في ملفّي معاً. الكتابةُ في جسم `set_supporter_hidden` لصفّي وحدَه.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:supporter:${auth.user.id}`, 20, 60_000);
    if (lim) return lim;
    let body: Partial<SupporterHideBody>;
    try {
      body = (await req.json()) as Partial<SupporterHideBody>;
    } catch {
      return fail("invalid_input");
    }
    if (typeof body?.hidden !== "boolean") return fail("invalid_input", { field: "hidden" });
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_supporter_hidden", { p_hidden: body.hidden });
    if (error) return fail("upstream");
    return ok({ hidden: body.hidden });
  });
}
