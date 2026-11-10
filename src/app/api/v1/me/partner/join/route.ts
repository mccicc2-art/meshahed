import type { NextRequest } from "next/server";
import { handle, requireUser, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { createClient } from "@/lib/supabase/server";

/**
 * `POST /api/v1/me/partner/join` — **عضو Gold ينضمّ لبرنامج الشركاء مباشرة** (🆕 D-gold-perks، أحمد ١٠ نوفمبر «٢ أ»: «القولد يقدر
 * ينضم مباشرة، البلس يقدر يرفع طلب، الغير مشترك لا يستطيع»). بلا مراجعة ولا نموذج — الموافقةُ على الشروط في الواجهة، والحارسُ في
 * جسم `join_partner_gold` (Gold فعّال). ضغطتان تعيدان الكودَ نفسَه. بلس يبقى على `apply` (حسابُ X + مراجعة).
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    /* 🔴 الموافقةُ على الشروط حزامُ الخادم كما في `apply` — الواجهةُ تعطّل الزرَّ، وهذا لمن يطلب المسارَ مباشرة */
    let body: { terms?: unknown } | null;
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    if (!body || body.terms !== true) return fail("invalid_input", { field: "terms" });
    const lim = limited(`v1:partner-join:${auth.user.id}`, 5, 60_000);
    if (lim) return lim;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("join_partner_gold");
    if (error) {
      if ((error.message ?? "").includes("partner_gold_required")) return fail("forbidden", { message_key: "apiPartnerGoldRequired" });
      return fail("upstream");
    }
    return ok({ code: typeof data === "string" ? data : null });
  });
}
