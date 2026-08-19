import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/data";
import { traktAuthorizeUrl, traktConfigured } from "@/lib/trakt";

/**
 * بداية ربط Trakt.
 *
 * `state` عشوائيٌّ يُحفظ في كوكي قصيرة العمر ويُقارَن عند العودة: بدونه
 * يستطيع موقعٌ آخر أن يدفع بمتصفّحك إلى رابط العودة بشِفرته هو، فتُستورد
 * مكتبةُ غيرك في حسابك. الكوكي `httpOnly` فلا تُقرأ من جافاسكربت.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!traktConfigured()) {
    return NextResponse.redirect(new URL("/profile/settings/import?trakt=off", request.url));
  }

  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/trakt/callback", request.url).toString();

  const store = await cookies();
  store.set("trakt_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(traktAuthorizeUrl(redirectUri, state));
}
