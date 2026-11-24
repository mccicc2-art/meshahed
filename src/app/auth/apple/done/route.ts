import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safeNext";

/**
 * 🆕 T538 — آخرُ خطوةٍ في «الدخول بأبل» على الويب، بـ`GET` كي تصل كوكيز `Lax` (انظر `auth/apple/route.ts`): ما يفعله
 * `auth/callback` بعد الدخول — تفضيلاتُ الزائر ونسبةُ الدعوة، وسقوطُهما لا يُسقط الدخول — ثمّ الوجهةُ على الأصل نفسِه.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const { absorbGuestContentPrefs, claimReferralFromCookie } = await import("@/lib/actions");
  await absorbGuestContentPrefs().catch(() => {});
  await claimReferralFromCookie().catch(() => {});
  /* الأصلُ من القائمة الموثوقة لا من الترويسات (D-623، كما في `auth/callback`) */
  const { resolveAuthBase } = await import("@/core/siteOrigin");
  const res = NextResponse.redirect(`${resolveAuthBase(url.origin)}${next}`, 303);
  res.headers.set("cache-control", "no-store");
  return res;
}
