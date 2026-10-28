import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { CONFIG } from "./config";
import { session } from "./session";
import { nativeGoogleIdToken } from "./googleNative";

/**
 * ====== 🆕 D-1350 — «ربط حساب Google» (Phase 11-U · U3، القرار ٥) ======
 *
 * **لماذا**: من دخل بأبل لا يدخل من أندرويد ولا من الويب (القرار ٣: أبل على الآيفون وحدَه) — وكثيرٌ منهم بريدُ أبل
 * عنده ليس Gmail، أو أخفاه («إخفاء بريدي») فلا يطابق شيئاً أبداً؛ فالربطُ التلقائيُّ بالبريد لا يصلهم، وهذا مخرجُهم.
 * بعد الربط حسابٌ واحدٌ ببابَين.
 *
 * 🔑 **الطريق**: التطبيقُ يطلب من Supabase عنوانَ الربط برمز العضو نفسِه (`/user/identities/authorize`)، ويفتحه في
 * متصفّح النظام كما يفتح دخولَ Google (المتصفّحُ المضمَّن يرفضه Google). **الربطُ يتمّ عند Supabase لحظةَ يعود Google
 * إليه** — قبل أن يرجع المتصفّحُ إلى التطبيق؛ فما يعود (`code`) علامةُ نجاحٍ لا رمزٌ نبدّله: تبديلُه يسكّ جلسةً ثالثةً
 * لا يحتاجها أحد. والتحدّي (PKCE) يُرسَل لأنّ بدونه يعود Supabase بالرموز في العنوان نفسِه.
 *
 * ⚖️ **لا دمج**: حسابُ Google المختارُ لعضوٍ آخر ⇒ Supabase يرفض (`identity_already_exists`) ونقولها للعضو بنصّها
 * — حسابان فيهما بياناتٌ لا يُدمجان من زرّ (مخاطرُ الخطّة).
 */
export type LinkOutcome = "linked" | "cancel" | "taken" | "failed";

const HEX = "0123456789abcdef";

function param(url: string, name: string): string | null {
  /* Supabase يعيد الخطأ في الاستعلام، وبعضُ المسارات في الجزء بعد `#` — يُقرأ الاثنان */
  const m = new RegExp(`[?&#]${name}=([^&#]*)`).exec(url);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    return m[1];
  }
}

/**
 * 🆕 «لا ويب في التطبيق» ٣ (١٩ أكتوبر ٢٠٢٦) — **الطريقُ نفسُه لكلِّ مزوّد ويب**: Google (D-1350) ثمّ X (Facebook حُذف — ١٩ أكتوبر) — كان
 * باباً إلى صفحتي الويب (`/profile/edit` · `/profile/settings/verify`) لأنّ `linkIdentity` كانت تعمل في جلسة الويب وحدَها
 * (D-932). عنوانُ الربط برمز العضو يعمل من أيِّ مكان؛ فالربطُ صار هنا. ⚠️ **المفتاحُ `x` لا `twitter`** (OAuth 2.0 —
 * حكمُ `XLinkRow`). مزوّدٌ غيرُ مفعَّلٍ في Supabase ⇒ لا عنوان ⇒ «failed» ونصُّه، لا انكسار.
 */
export type WebProvider = "google" | "x";

/**
 * 🆕 D-1555 — **Google بلا متصفّح أوّلاً**: الورقةُ الأصليّة تعيد رمزَ هويّة ويُرسَل برمز العضو ومع `link_identity` — طريقُ
 * `linkApple` حرفاً (الردُّ يحمل جلسةً لا نأخذها). الورقةُ غيرُ متاحة ⇒ عنوانُ الربط في المتصفّح كما كان.
 */
export async function linkGoogle(): Promise<LinkOutcome> {
  const g = await nativeGoogleIdToken();
  if (g.kind === "cancel") return "cancel";
  if (g.kind === "unavailable") return linkProvider("google");
  return linkIdToken("google", g.idToken, g.nonce);
}

/** رمزُ هويّةٍ أصليٌّ ⇢ هويّةٌ مضافةٌ إلى حساب العضو (`/token?grant_type=id_token` + `link_identity`) */
async function linkIdToken(provider: "google" | "apple", idToken: string, nonce: string): Promise<LinkOutcome> {
  try {
    const token = session.get() ?? (await session.request());
    if (!token) return "failed";
    const res = await fetch(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=id_token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", apikey: CONFIG.supabasePublishableKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ provider, id_token: idToken, nonce, link_identity: true }),
    });
    if (res.ok) return "linked";
    const err = (await res.json().catch(() => null)) as { error_code?: unknown; code?: unknown } | null;
    const code = String(err?.error_code ?? err?.code ?? "");
    return code === "identity_already_exists" ? "taken" : "failed";
  } catch {
    return "failed";
  }
}

export async function linkProvider(provider: WebProvider): Promise<LinkOutcome> {
  try {
    const token = session.get() ?? (await session.request());
    if (!token) return "failed";
    let verifier = "";
    for (const b of Crypto.getRandomBytes(32)) verifier += HEX[b >> 4] + HEX[b & 15];
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
    const challenge = digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const redirectTo = Linking.createURL("auth/callback");
    const q = `provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}&code_challenge=${challenge}&code_challenge_method=s256&skip_http_redirect=true`;
    const res = await fetch(`${CONFIG.supabaseUrl}/auth/v1/user/identities/authorize?${q}`, {
      headers: { Accept: "application/json", apikey: CONFIG.supabasePublishableKey, Authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => null)) as { url?: unknown } | null;
    if (!res.ok || typeof json?.url !== "string" || !json.url.startsWith("https://")) return "failed";

    const back = await WebBrowser.openAuthSessionAsync(json.url, redirectTo);
    if (back.type !== "success") return back.type === "cancel" || back.type === "dismiss" ? "cancel" : "failed";
    const code = param(back.url, "error_code") ?? param(back.url, "error");
    if (code) return code === "identity_already_exists" ? "taken" : code === "access_denied" ? "cancel" : "failed";
    return param(back.url, "code") ? "linked" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * 🆕 ربطُ Apple بحسابٍ قائم (قرارُ أحمد ١٩ أكتوبر: «نعم») — **على الآيفون وحدَه وبلا متصفّح**: ورقةُ النظام تعيد رمزَ هويّةٍ
 * موقَّعاً كما في الدخول (`signInWithApple`)، ويُرسَل إلى Supabase **برمز العضو ومع `link_identity`** فتُضاف الهويّةُ إلى
 * حسابه بدل أن يولد حسابٌ جديد (`/token?grant_type=id_token` — ما تفعله `linkIdentity({ token })` في auth-js).
 *
 * ⚖️ **الردُّ يحمل جلسةً جديدة ولا نأخذها**: جلسةُ التطبيق ملكُ `ownSession` ولا يستبدلها فعلٌ جانبيّ — المطلوبُ الربطُ
 * وحدَه، وقد تمّ لحظةَ قَبِل Supabase الرمز. والرقمُ العشوائيّ (nonce) كما في الدخول: أبل تضع بصمتَه في الرمز.
 * هويّةُ Apple لعضوٍ آخر ⇒ `identity_already_exists` ⇒ «taken» (لا دمج — مخاطرُ D-1350 نفسُها).
 */
export async function linkApple(): Promise<LinkOutcome> {
  try {
    let raw = "";
    for (const b of Crypto.getRandomBytes(16)) raw += HEX[b >> 4] + HEX[b & 15];
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
    const cred = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL], nonce: hashed });
    if (!cred.identityToken) return "failed";
    return linkIdToken("apple", cred.identityToken, raw);
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    return code === "ERR_REQUEST_CANCELED" ? "cancel" : "failed";
  }
}
