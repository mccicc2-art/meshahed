import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { CONFIG } from "./config";
import { session } from "./session";

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

export async function linkGoogle(): Promise<LinkOutcome> {
  try {
    const token = session.get() ?? (await session.request());
    if (!token) return "failed";
    let verifier = "";
    for (const b of Crypto.getRandomBytes(32)) verifier += HEX[b >> 4] + HEX[b & 15];
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
    const challenge = digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const redirectTo = Linking.createURL("auth/callback");
    const q = `provider=google&redirect_to=${encodeURIComponent(redirectTo)}&code_challenge=${challenge}&code_challenge_method=s256&skip_http_redirect=true`;
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
