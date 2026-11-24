import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "@/lib/locale";
import { safeNext } from "@/lib/safeNext";
import { APPLE_COOKIE, APPLE_COOKIE_MAX_AGE_S, APPLE_HOME_ORIGIN, APPLE_RETURN_PATH, appleAuthUrl, appleOriginFor } from "@/core/appleRedirect";

/**
 * 🆕 T538 — بدايةُ «الدخول بأبل» في المتصفّح (`core/appleRedirect` يشرح لماذا يبدأ من الخادم).
 * `state` و`nonce` الخام في كوكي `HttpOnly` لا تقرؤه صفحة، `SameSite=None` لأنّ أبل تعيد النموذجَ من موقعها، مقصورٌ على
 * `/auth/apple` وعمرُه عشرُ دقائق. والمعمّى (`sha256`) وحده يذهب إلى أبل — Supabase تقارن الخامَ ببصمته في الرمز.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const origin = appleOriginFor(url.origin);
  /* أصلٌ لم يُسجَّل له عنوانُ عودةٍ عند أبل ⇐ البدايةُ نفسُها من `loopztv.com`، فيكون الكوكي حيث تعود أبل */
  if (!origin) return NextResponse.redirect(`${APPLE_HOME_ORIGIN}${APPLE_RETURN_PATH}/start?next=${encodeURIComponent(next)}`, 302);

  const state = randomBytes(24).toString("hex");
  const raw = randomBytes(32).toString("base64url");
  const hashed = createHash("sha256").update(raw).digest("hex");
  const res = NextResponse.redirect(appleAuthUrl({ origin, state, hashedNonce: hashed, locale: await getLocale() }), 302);
  res.cookies.set(APPLE_COOKIE, JSON.stringify({ s: state, n: raw, next }), {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: APPLE_RETURN_PATH,
    maxAge: APPLE_COOKIE_MAX_AGE_S,
  });
  res.headers.set("cache-control", "no-store");
  return res;
}
