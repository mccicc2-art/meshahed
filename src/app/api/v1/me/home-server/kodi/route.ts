import type { NextRequest } from "next/server";
import { issueKodiPairCode } from "@/lib/linkTokens";
import { revokeKodiToken } from "@/lib/homeServer";
import { linkGate } from "@/lib/deviceLinks";
import { sharedLimited } from "@/lib/sharedLimit";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok, type Result } from "@/core/contracts/result";
import type { KodiBody, KodiResult } from "@/core/contracts/homeServer";

/**
 * `POST /api/v1/me/home-server/kodi` `{action: "code" | "revoke"}` — رمزُ ربط Kodi وإلغاؤه (هجرة ٢٣٦).
 * 🔑 **الرمزُ بخانةٍ في المدار** (هجرة ٢٣٧؛ كان لـLoopz+ وحده «٣ أ»)، والإلغاءُ لكلِّ أحد (اشتراكٌ انتهى يقدر على قطع جهازه). ورمزٌ جديدٌ يُسقط الذي قبله.
 * والحدُّ في القاعدة (A-14): بابٌ يصنع رموزاً حيّة.
 */
export async function POST(req: NextRequest) {
  return handle(async (): Promise<Result<KodiResult>> => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: KodiBody;
    try {
      body = (await req.json()) as KodiBody;
    } catch {
      return fail("invalid_input");
    }
    if (body?.action === "revoke") {
      if (!(await revokeKodiToken(auth.user.id))) return fail("upstream");
      return ok<KodiResult>({ linked: false }, ["me:home-server", "me:links"]);
    }
    if (body?.action !== "code") return fail("invalid_input");
    /* 🆕 هجرة ٢٣٧ — خانةٌ في المدار بدل «بلس وحده» (ويُعاد الحكمُ عند تبديل الرمز برابطه) */
    const gate = await linkGate(auth.user.id, "kodi");
    if (gate) return gate;
    const rl = await sharedLimited(`kodi-code:${auth.user.id}`, 20, 60 * 60_000);
    if (rl) return rl;
    const c = await issueKodiPairCode(auth.user.id);
    if (!c) return fail("upstream");
    return ok<KodiResult>({ linked: false, code: c.code, expires_at: c.expires_at }, ["me:home-server", "me:links"]);
  });
}
