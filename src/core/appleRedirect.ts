/**
 * ====== 🆕 T538 — «الدخول بأبل» في المتصفّح (أحمد ٢٤ نوفمبر «٢أ»: كلُّ المتصفّحات) ======
 *
 * **لماذا هكذا**: أبل على الويب لا تعطي رمزاً في جزء `#` حين نطلب الاسمَ والبريد — تشترط `form_post`، أي أنّها **ترسل
 * نموذجاً من `appleid.apple.com` إلى عنواننا**. والنموذجُ القادمُ من موقعٍ آخر لا يحمل كوكيز `Lax` ولا يرى `sessionStorage`
 * صفحةٍ لم تُفتح بعد؛ فالطلبُ يبدأ من الخادم (`/auth/apple/start`) ويحفظ `state` و`nonce` الخام في كوكي `SameSite=None`
 * قصيرِ العمر مقصورٍ على `/auth/apple`، وأبل ترسل النموذجَ إلى `/auth/apple` فيُطابَق ويُسلَّم الرمزُ لـSupabase.
 *
 * 🔑 **معرّفُ الويب غيرُ معرّف التطبيق**: `com.loopztv.web` (Services ID، مُسجَّلٌ ٢٤ نوفمبر، مجموعٌ تحت `com.loopztv.app`)،
 * ومُضافٌ في Supabase إلى «Client IDs» لمزوّد أبل بجانب معرّف التطبيق — فالرمزان كلاهما مقبولان.
 * 🔑 **عنوانا العودة المسجّلان عند أبل**: `https://loopztv.com/auth/apple` و`https://www.loopztv.com/auth/apple` وحدهما؛ ومن
 * بدأ من أصلٍ آخر (`meshahed.vercel.app`) يُحوَّل أوّلاً إلى `loopztv.com` كي يكون الكوكي على الأصل الذي تعود إليه أبل.
 *
 * دوالُّ صافية هنا (تُختبر)؛ الخادمُ في `app/auth/apple`.
 */

export const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
export const APPLE_WEB_CLIENT_ID = "com.loopztv.web";
export const APPLE_RETURN_PATH = "/auth/apple";
export const APPLE_COOKIE = "loopz_apple";
/** عشرُ دقائق — ما بعدها طلبٌ قديمٌ لا يُصرف */
export const APPLE_COOKIE_MAX_AGE_S = 600;
/** الأصلان اللذان سُجّل لهما عنوانُ العودة عند أبل */
export const APPLE_ORIGINS = ["https://loopztv.com", "https://www.loopztv.com"] as const;
export const APPLE_HOME_ORIGIN = "https://loopztv.com";

export type ApplePending = { s: string; n: string; next: string };

export function appleOriginFor(origin: string): string | null {
  return (APPLE_ORIGINS as readonly string[]).includes(origin) ? origin : null;
}

export function appleAuthUrl(o: { origin: string; state: string; hashedNonce: string; locale: string }): string {
  const q = new URLSearchParams({
    client_id: APPLE_WEB_CLIENT_ID,
    redirect_uri: `${o.origin}${APPLE_RETURN_PATH}`,
    response_type: "code id_token",
    response_mode: "form_post",
    scope: "name email",
    state: o.state,
    nonce: o.hashedNonce,
    locale: o.locale === "en" ? "en_US" : "ar_SA",
  });
  return `${APPLE_AUTH_URL}?${q.toString()}`;
}

/** الكوكي المحفوظ عند البدء — بشكله وإلّا فلا شيء */
export function readApplePending(raw: string | undefined | null): ApplePending | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ApplePending>;
    if (typeof v.s !== "string" || v.s.length < 16 || typeof v.n !== "string" || v.n.length < 16 || typeof v.next !== "string") return null;
    return { s: v.s, n: v.n, next: v.next };
  } catch {
    return null;
  }
}

/**
 * الاسمُ الذي ترسله أبل **في أوّل دخولٍ وحده** (حقلُ `user` في النموذج: `{"name":{"firstName","lastName"}}`) — مسافاتٌ مطويّة،
 * بلا محارف تحكّم، وبطول حقل الاسم في تعديل الملفّ (٤٠)، كما يفعل `api/v1/session/apple` للتطبيق.
 */
export function appleNameOf(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 2000) return "";
  try {
    const v = JSON.parse(raw) as { name?: { firstName?: unknown; lastName?: unknown } };
    const parts = [v?.name?.firstName, v?.name?.lastName].filter((p): p is string => typeof p === "string");
    return parts.join(" ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  } catch {
    return "";
  }
}
