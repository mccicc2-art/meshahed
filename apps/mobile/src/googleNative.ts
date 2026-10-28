import * as Crypto from "expo-crypto";
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";

/**
 * ====== 🆕 D-1555 — دخولُ Google الأصليّ (Universal Sign In، ترخيصُ Small Team) ======
 *
 * **لماذا**: نافذةُ المتصفّح كانت تقول «to continue to uvgmvrdrxzpudoldjxaa.supabase.co» — لأنّ Google يعرض نطاقَ عنوان
 * الرجوع، والرجوعُ إلى Supabase. **الورقةُ الأصليّة لا عنوانَ رجوعٍ فيها**: تعرض اسمَ التطبيق من شاشة الموافقة («Loopz»)
 * وتعيد رمزَ هويّةٍ موقَّعاً نسلّمه لـSupabase (`signInWithIdToken`) — طريقُ أبل نفسُه (D-1350).
 *
 * 🔑 **الرقمُ العشوائيّ (nonce)**: Google يضع في الرمز **ما نعطيه حرفاً** (Credential Manager على أندرويد وGIDSignIn على
 * iOS كلاهما)، وSupabase يطابق `sha256(raw)` بما في الرمز — فنعطي Google **البصمةَ** ونعطي Supabase **الأصل**. فحصُ
 * الـnonce في Supabase يبقى مفعَّلاً (لا «Skip nonce checks»).
 *
 * 🔑 **المعرّفات ليست أسراراً**: `webClientId` هو عميلُ الويب القائم (عليه يُصدَر الرمزُ على أندرويد، وهو الأوّلُ في
 * «Client IDs» عند Supabase)، و`iosClientId` عميلُ iOS (الثاني هناك). عملاءُ أندرويد لا معرّفَ لهم في الكود: Google
 * يتحقّق من التطبيق بالحزمة وبصمة SHA-1 (أربعُ بصماتٍ مسجّلة — كلُّ شهادات مفتاح التوقيع ومفتاحُ الرفع).
 *
 * ⚖️ **«unavailable» يعيد المتصلَ إلى المتصفّح** — جهازٌ بلا Play Services، أو بناءٌ قديمٌ بلا الوحدة الأصليّة (تحديثٌ عبر
 * الهواء وصل نسخةً لم تُبنَ بها)، أو خطأٌ لا نعرفه: الدخولُ لا ينكسر، يعود إلى طريقه القديم.
 */
const WEB_CLIENT_ID = "751080411743-f6vcbmsbp0224n5d0iajd5vejtu87h6h.apps.googleusercontent.com";
const IOS_CLIENT_ID = "751080411743-kbpar9g9kil8k1sccd1qcapni7o0oh6c.apps.googleusercontent.com";

export type NativeGoogle =
  | { kind: "token"; idToken: string; nonce: string }
  | { kind: "cancel" }
  | { kind: "unavailable"; reason: string };

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleOneTapSignIn.configure({ webClientId: WEB_CLIENT_ID, iosClientId: IOS_CLIENT_ID });
  configured = true;
}

const HEX = "0123456789abcdef";
function randomHex(bytes: number): string {
  let out = "";
  for (const b of Crypto.getRandomBytes(bytes)) out += HEX[b >> 4] + HEX[b & 15];
  return out;
}

/**
 * ورقةُ Google الأصليّة ⇢ رمزُ هويّة + الـnonce الأصليّ. الترتيبُ ترتيبُ المكتبة: حسابٌ دخل قبلاً (`signIn`) ⇢ اختيارُ حساب
 * (`createAccount`) ⇢ الحوارُ الصريح (`presentExplicitSignIn` — جهازٌ بلا حساب Google يضيفه منه). مع nonce تعرض `signIn`
 * الورقةَ دائماً (لا دخولَ صامت) — وهذا ما نريد: الضغطُ على الزرّ اختيارٌ صريح.
 */
export async function nativeGoogleIdToken(): Promise<NativeGoogle> {
  try {
    ensureConfigured();
    await GoogleOneTapSignIn.checkPlayServices(false);
    const raw = randomHex(16);
    const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);

    let res = await GoogleOneTapSignIn.signIn({ nonce });
    if (isNoSavedCredentialFoundResponse(res)) res = await GoogleOneTapSignIn.createAccount({ nonce });
    if (isNoSavedCredentialFoundResponse(res)) res = await GoogleOneTapSignIn.presentExplicitSignIn({ nonce });

    if (isCancelledResponse(res)) return { kind: "cancel" };
    if (isSuccessResponse(res) && res.data.idToken) return { kind: "token", idToken: res.data.idToken, nonce: raw };
    return { kind: "unavailable", reason: "no token" };
  } catch (e) {
    /* المكتبةُ لا تُصدّر هذا الرمزَ في `statusCodes` (٢٤٫١) — يُقارن نصّاً كما توصي وثائقُها */
    if (isErrorWithCode(e) && e.code === "SIGN_IN_CANCELLED") return { kind: "cancel" };
    const reason = isErrorWithCode(e) ? String(e.code) : e instanceof Error ? e.message : "unknown";
    return { kind: "unavailable", reason };
  }
}
