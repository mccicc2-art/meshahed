import { createPrivateKey, sign } from "node:crypto";

/**
 * ====== 🆕 D-1350 — «سرُّ العميل» عند أبل: رمزٌ نوقّعه نحن (Phase 11-U · U4) ======
 *
 * أبل لا تعطي سرّاً ثابتاً: كلُّ نداءٍ لخادمها (`/auth/token` · `/auth/revoke`) يحمل رمزاً قصيرَ العمر موقَّعاً بمفتاح
 * الفريق الخاصّ (ES256) يقول «أنا هذا التطبيق». هنا بناؤه وحدَه — **بلا `server-only` وبلا بيئة** كي يُختبر
 * (`appleSecret.test.ts` يتحقّق من التوقيع بالمفتاح العامّ)؛ قراءةُ المفتاح من البيئة والنداءاتُ في `apple.ts`.
 *
 * 🔑 **خمسُ دقائق لا ستّةُ أشهر**: أبل تسمح بعمرٍ حتى ستّة أشهر، وذاك لمن يخزّن السرَّ عند طرفٍ ثالث (مزوّدُ أبل على
 * الويب في Supabase — ولسنا نستعمله، القرار ٣). نحن نوقّع عند كلِّ نداء، فالعمرُ بقدر النداء.
 *
 * 🔑 **`ieee-p1363`**: JWT يريد التوقيعَ `r‖s` خاماً (٦٤ بايتاً)، و`crypto.sign` يعطي DER افتراضاً — توقيعٌ بالصيغة
 * الخطأ ترفضه أبل بـ`invalid_client` بلا سببٍ يُقرأ.
 */
export type AppleKey = {
  /** معرّفُ الفريق (عشرةُ أحرف) — `iss` */
  teamId: string;
  /** معرّفُ المفتاح — `kid` */
  keyId: string;
  /** محتوى ملفّ `.p8` (PEM) */
  privateKey: string;
  /** معرّفُ الحزمة — `sub`، وهو `client_id` في النداء */
  clientId: string;
};

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function appleClientSecret(key: AppleKey, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: key.keyId, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: key.teamId, iat: nowSec, exp: nowSec + 300, aud: "https://appleid.apple.com", sub: key.clientId }));
  const input = `${header}.${payload}`;
  const sig = sign("sha256", Buffer.from(input), { key: createPrivateKey(key.privateKey), dsaEncoding: "ieee-p1363" });
  return `${input}.${b64url(sig)}`;
}

/**
 * `sub` من رمز هويّةٍ أعادته أبل **في ردِّ نداءٍ منّا إليها** — فكٌّ بلا تحقّقٍ من التوقيع: القناةُ نفسُها (TLS إلى
 * `appleid.apple.com`) هي الضمان. لا يُستعمل لرمزٍ جاء من عميل.
 */
export function appleIdTokenSub(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const sub = (JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { sub?: unknown }).sub;
    return typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}

/** مفتاحٌ لُصق في متغيّر بيئةٍ بسطرٍ واحد (`\n` حرفيّةً) يعود أسطراً */
export function normalizePem(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n").trim() : raw.trim();
}

/**
 * ====== النداءان إلى أبل — بناقلٍ يُحقن (فيُختبران بلا شبكة) ======
 * `post` يرسل نموذجاً (`application/x-www-form-urlencoded`) ويعيد الحالةَ والجسم؛ الحقيقيُّ في `apple.ts`.
 */
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
export type ApplePost = (url: string, fields: Record<string, string>) => Promise<{ status: number; json: Record<string, unknown> | null }>;

export type AppleExchange = { ok: true; refresh: string } | { ok: false; why: "rejected" | "mismatch"; detail: string };

/**
 * رمزُ التفويض ⇒ رمزُ تجديد. **الرمزُ المُعاد يجب أن يحمل `appleSub`** (معرّفُ العضو عند أبل كما في هويّته عندنا):
 * رمزُ تفويضٍ لحساب أبل آخر لا يُعلَّق على هذا العضو.
 */
export async function appleExchange(key: AppleKey, code: string, appleSub: string, post: ApplePost, nowSec?: number): Promise<AppleExchange> {
  const r = await post(APPLE_TOKEN_URL, { client_id: key.clientId, client_secret: appleClientSecret(key, nowSec), code, grant_type: "authorization_code" });
  const refresh = r.json?.refresh_token;
  if (r.status !== 200 || typeof refresh !== "string" || !refresh)
    return { ok: false, why: "rejected", detail: `${r.status} ${typeof r.json?.error === "string" ? r.json.error.slice(0, 40) : ""}`.trim() };
  if (appleIdTokenSub(r.json?.id_token) !== appleSub) return { ok: false, why: "mismatch", detail: "" };
  return { ok: true, refresh };
}

/** إلغاءُ الإذن برمز التجديد — أبل تردّ `200` بجسمٍ فارغ عند النجاح */
export async function appleRevoke(key: AppleKey, refresh: string, post: ApplePost, nowSec?: number): Promise<{ ok: boolean; detail: string }> {
  const r = await post(APPLE_REVOKE_URL, { client_id: key.clientId, client_secret: appleClientSecret(key, nowSec), token: refresh, token_type_hint: "refresh_token" });
  return { ok: r.status === 200, detail: `${r.status} ${typeof r.json?.error === "string" ? r.json.error.slice(0, 40) : ""}`.trim() };
}
