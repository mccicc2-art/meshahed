import type { NextRequest } from "next/server";
import { handle, requireUser, fail, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { traktAuthorizeUrl, traktConfigured, traktToken, TRAKT_APP_STATE, TRAKT_REDIRECT } from "@/lib/trakt";
import { runTraktImport } from "@/lib/traktRun";

// الاستيرادُ نفسُه الذي في عودة الموقع — قد يكتب عشرات الآلاف من الصفوف
export const maxDuration = 300;

/* حروفُ base64url وحدَها، بطولٍ تقبله PKCE — ما سواها لا يُمرَّر إلى Trakt */
const B64URL = /^[A-Za-z0-9_-]{43,128}$/;

/**
 * 🆕 R281 — **Trakt من داخل التطبيق** (أحمد ١٩ نوفمبر: «نبغى نضبطها فالتطبيق»).
 *
 * `GET ?challenge=…&state=app.…` ⇐ عنوانُ موافقة Trakt. **المُتحقِّقُ يولد في التطبيق ويبقى فيه** — الخادمُ لا يرى إلّا بصمتَه،
 * كما في دخول Google (`linkGoogle.ts`). والمفتاحُ (`TRAKT_CLIENT_ID`) يبقى هنا: التطبيقُ لا يحمل إعداداتِ Trakt فلا يحتاج
 * تحديثاً إن تبدّل التطبيقُ عند Trakt.
 *
 * `POST { code, verifier }` ⇐ يُصرف المفتاحُ ويجري الاستيرادُ الذي يجريه الموقع (`runTraktImport`) بجلسة العضو (Bearer)،
 * ويعود بالأعداد.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    if (!traktConfigured()) return fail("not_found");
    const challenge = req.nextUrl.searchParams.get("challenge") ?? "";
    const state = req.nextUrl.searchParams.get("state") ?? "";
    if (!B64URL.test(challenge) || !state.startsWith(TRAKT_APP_STATE) || state.length > 80) return fail("invalid_input");
    return ok({ url: traktAuthorizeUrl(TRAKT_REDIRECT, state, challenge) }, []);
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    if (!traktConfigured()) return fail("not_found");
    const gate = limited(`trakt-import:${auth.user.id}`, 5, 10 * 60_000);
    if (gate) return gate;
    let body: { code?: unknown; verifier?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    const code = typeof body?.code === "string" ? body.code : "";
    const verifier = typeof body?.verifier === "string" ? body.verifier : "";
    if (!code || code.length > 512 || !B64URL.test(verifier)) return fail("invalid_input");

    const token = await traktToken(code, TRAKT_REDIRECT, verifier);
    if (!token) return fail("upstream");
    const done = await runTraktImport(token, auth.user.id, "app");
    if (!done.ok) return fail("upstream");
    return ok(
      { shows: done.shows, episodes: done.episodes, movies: done.movies, reviews: done.reviews, unmatched: done.unmatched.slice(0, 200) },
      ["home", "me:library", "me:stats", "me:ratings", "me:diary"],
    );
  });
}
