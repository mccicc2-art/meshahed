/**
 * فكُّ كوكي جلسة Supabase محلياً — قراءةُ هويّةٍ، **لا تحقّق**.
 *
 * 🔴 حدُّ هذا الملفّ كلُّه: ما يخرج منه **تسميةٌ** تُستعمل للفلترة
 * والعرض وتقسيم الكاش — **ولا يُبنى عليه قرارُ صلاحياتٍ أبداً.**
 * التحقّقُ الحقيقيّ في ثلاثة مواضع لا غير: توقيعُ الـJWT يتحقّق منه
 * Postgres في RLS مع كلِّ صفّ، و`getUser()`/`requireUser` لِما يحتاج
 * كائنَ مستخدمٍ موثوقاً، وخادمُ Auth عند التجديد. `sub` مزوَّرٌ هنا
 * يعني استعلاماً يُفلتر بمعرّفٍ لا تملكه فتقاطعُه مع صفوف RLS **صفر
 * صفوف** — لا صفوفَ غيرك.
 *
 * القارئان: `getUserId()` في `data.ts` (معرّفُ القرّاء — D-508)،
 * و`proxy.ts` (تسميةُ مالك كاش الصفحات في الـsw — D-514). مستخرَجٌ
 * ملفّاً خالصاً بلا اعتماداتٍ ليصلح في Node وEdge معاً **وليُختبر
 * وحده**: `node scripts/test-session-cookie.mjs`.
 */

export interface SessionClaims {
  sub: string;
  exp: number | null;
}

/**
 * أجزاء كوكي الجلسة بترتيبها — Supabase قد يقسمها `auth-token.0/.1`
 * والترتيبُ الأبجديُّ يعيد تجميعها (`.0` قبل `.1`). كوكي مدقّق PKCE
 * (`code-verifier`) يُستبعد: يحمل الاسم نفسه تقريباً وليس جلسة.
 */
export function sessionCookieParts(
  all: { name: string; value: string }[],
): string[] {
  return all
    .filter(
      (c) =>
        c.name.startsWith("sb-") &&
        c.name.includes("auth-token") &&
        !c.name.includes("code-verifier"),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value);
}

/** base64/base64url → UTF-8 عبر TextDecoder: يعمل في Node وEdge،
    ويصون الحروفَ غير اللاتينية في الحمولة (atob وحدها تشوّهها) */
function b64ToUtf8(b64ish: string): string {
  const b64 = b64ish.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * يفكّ الأجزاء إلى `sub` و`exp` — أو `null` عند أيِّ تشوّه.
 * لا يرمي أبداً؛ المشوَّهُ والغائبُ سواء، والحكمُ على `exp` (منتهٍ أم
 * لا) مسؤوليةُ المستدعي لأن سياسة كلِّ مستدعٍ تختلف.
 */
/**
 * تسميةُ «مالك الكاش» من `sub` — SHA-256 كاملةً (D-514، تشديدُ أحمد:
 * «لا collision ولو كان منخفضًا»). كانت بادئةَ ثمانية أحرفٍ من `sub`
 * نفسِه؛ الآن بصمةٌ كاملةٌ ٢٥٦-بت: لا تصادمَ عمليّاً، ولا يُرى
 * المعرّفُ الخامُ في الترويسة أصلاً. `crypto.subtle` متوافرة في Edge
 * وNode معاً، **وبلا أيِّ رحلة شبكة** — وهي حتميّة: نفسُ `sub` نفسُ
 * التسمية في كلِّ طلبٍ وكلِّ نشرة، وإلا انمسح الكاشُ عبثاً كلَّ مرّة.
 */
export async function ownerHash(sub: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sub),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function decodeSessionCookie(
  orderedParts: string[],
): SessionClaims | null {
  try {
    if (orderedParts.length === 0) return null;
    let raw = orderedParts.join("");
    if (raw.startsWith("base64-")) raw = b64ToUtf8(raw.slice(7));
    const session: unknown = JSON.parse(raw);
    const token = (session as { access_token?: unknown })?.access_token;
    if (typeof token !== "string") return null;
    return decodeAccessToken(token);
  } catch {
    return null;
  }
}

/**
 * يفكّ رمزَ وصولٍ خاماً (JWT) إلى `sub` و`exp` — **الحمولةُ لا التوقيع**.
 *
 * 🆕 **فُصل عن الكوكي لأجل التطبيق** (Phase 9 §4.3): الجوّالُ لا يحمل
 * كوكي، بل `Authorization: Bearer <token>` — **والرمزُ داخل الكوكي هو
 * الرمزُ نفسُه**، فالقراءةُ واحدةٌ من مصدرين. وكما في الكوكي: القيمةُ
 * **للفلترة والعرض فقط**، والتحقّقُ الحقيقيُّ عند RLS مع كلِّ صفّ.
 */
export function decodeAccessToken(token: string): SessionClaims | null {
  try {
    const segments = token.split(".");
    if (segments.length !== 3) return null;
    const payload: unknown = JSON.parse(b64ToUtf8(segments[1]));
    const sub = (payload as { sub?: unknown })?.sub;
    if (typeof sub !== "string" || sub.length === 0) return null;
    const expRaw = (payload as { exp?: unknown })?.exp;
    const exp = typeof expRaw === "number" && Number.isFinite(expRaw) ? expRaw : null;
    return { sub, exp };
  } catch {
    return null;
  }
}
