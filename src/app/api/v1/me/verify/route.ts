import type { NextRequest } from "next/server";
import { getVerificationScreen, requestVerification } from "@/lib/actions";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { VerifyBody, VerifyPayload } from "@/core/contracts/settings";

/**
 * `GET /api/v1/me/verify` — شاشةُ التوثيق (D-1107): الأهليّةُ والطلبُ والحساباتُ المرتبطة من
 * `getVerificationScreen` نفسِها (ثلاثُ دوالّ في القاعدة، `157_verification_requests.sql`).
 */
export async function GET() {
  return handle<VerifyPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    return ok(await getVerificationScreen());
  });
}

/**
 * `POST /api/v1/me/verify` — الطلبُ بـ`requestVerification` نفسِها، ويعود بالشاشة بعده (الحالةُ
 * صارت «قيد المراجعة»). نصوصُ الفعل الثلاثة تُترجم إلى مفاتيح — لا تُعرض كما هي (ثنائيّةُ اللغة).
 */
export async function POST(req: NextRequest) {
  return handle<VerifyPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let b: VerifyBody;
    try {
      b = (await req.json()) as VerifyBody;
    } catch {
      return fail("invalid_input");
    }
    if (!b || typeof b !== "object") return fail("invalid_input");
    try {
      await requestVerification({
        kind: String(b.kind ?? ""),
        links: Array.isArray(b.links) ? b.links.map(String) : [],
        website: String(b.website ?? ""),
        sources: String(b.sources ?? ""),
        reason: String(b.reason ?? ""),
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (m.includes("Requirements not met")) return fail("forbidden", { message_key: "apiVerifyNotEligible" });
      if (m.includes("cannot apply")) return fail("forbidden", { message_key: "apiVerifyCannotApply" });
      if (m.includes("clear reason")) return fail("invalid_input", { field: "reason", message_key: "apiVerifyReason" });
      throw e;
    }
    return ok(await getVerificationScreen());
  });
}
