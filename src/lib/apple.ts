import "server-only";
import { createServiceClient, hasServiceKey } from "@/lib/supabase/service";
import { appleExchange, appleRevoke, normalizePem, type AppleKey, type ApplePost } from "@/lib/appleSecret";

/**
 * ====== 🆕 D-1350 — رمزُ أبل: يُحفظ عند الدخول ويُلغى عند حذف الحساب (Phase 11-U · U4) ======
 *
 * **لماذا**: أبل تشترط على كلِّ تطبيقٍ فيه «الدخول بأبل» أن يُلغي إذنَه عندها حين يحذف العضوُ حسابَه (يختفي التطبيقُ
 * من قائمة «الدخول بأبل» في حسابه). الإلغاءُ يحتاج رمزَ تجديدٍ لا تعطيه أبل إلّا مقابلَ رمز التفويض الذي يعود مع
 * الدخول — **صالحٌ خمسَ دقائق ولا يُعطى ثانيةً**. فإن لم يُحفظ عند أوّل دخولٍ لم يبقَ ما يُلغى به لاحقاً؛ ولهذا شُحن
 * هذا مع الدخول نفسِه لا بعده.
 *
 * 🔒 **أين يعيش الرمز**: `public.apple_tokens` (الهجرة ١٩٩) — RLS مفعّلةٌ بلا سياسة، والمنحُ مسحوبةٌ عن `anon`
 * و`authenticated`: لا يقرؤه ولا يكتبه إلّا الخادمُ بمفتاح الخدمة. الصفُّ يُحذف مع صاحبه (`on delete cascade`).
 *
 * ⚖️ **كلُّه «إن أمكن» ولا يحبس أحداً**: مفتاحُ أبل غائبٌ من البيئة، أو مفتاحُ الخدمة، أو أبل لا تردّ ⇒ الدخولُ
 * يمضي والحذفُ يمضي. النتيجةُ كلمةٌ تعود للمنادي وتُكتب في السجلّ — بلا رمزٍ ولا بريد.
 *
 * البيئة: `APPLE_KEY_ID` و`APPLE_PRIVATE_KEY` (محتوى `.p8`) سرّان يضعهما المالك؛ `APPLE_TEAM_ID` و`APPLE_CLIENT_ID`
 * اختياريّان (الفريقُ ومعرّفُ الحزمة ليسا سرّين — قيمتاهما الافتراضيّتان هنا).
 */
const TIMEOUT_MS = 6000;

function appleKey(): AppleKey | null {
  const keyId = process.env.APPLE_KEY_ID?.trim();
  const pem = process.env.APPLE_PRIVATE_KEY;
  if (!keyId || !pem) return null;
  return {
    teamId: process.env.APPLE_TEAM_ID?.trim() || "GZFYZ4FGW4",
    keyId,
    privateKey: normalizePem(pem),
    clientId: process.env.APPLE_CLIENT_ID?.trim() || "com.loopztv.app",
  };
}

const post: ApplePost = async (url, fields) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
};

export type KeepResult = "stored" | "unconfigured" | "rejected" | "mismatch" | "failed";

/**
 * رمزُ التفويض ⇒ رمزُ تجديدٍ محفوظ. `appleSub`: معرّفُ العضو عند أبل كما في هويّته عندنا — **الرمزُ الذي تعيده أبل
 * يجب أن يكون له هو**، وإلّا لا يُحفظ (`appleExchange` — منطقُ النداءين في `appleSecret.ts` حيث يُختبر).
 */
export async function keepAppleToken(userId: string, appleSub: string, code: string): Promise<KeepResult> {
  const key = appleKey();
  if (!key || !hasServiceKey()) return "unconfigured";
  try {
    const x = await appleExchange(key, code, appleSub, post);
    if (!x.ok) {
      if (x.why === "rejected") console.warn(`[apple] token exchange refused: ${x.detail}`);
      return x.why;
    }
    const admin = await createServiceClient();
    const { error } = await admin.from("apple_tokens").upsert({ user_id: userId, refresh_token: x.refresh, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) {
      console.error("[apple] token store", error.message);
      return "failed";
    }
    return "stored";
  } catch (e) {
    console.error("[apple] token exchange", e instanceof Error ? e.name : "error");
    return "failed";
  }
}

export type RevokeResult = "revoked" | "none" | "unconfigured" | "failed";

/** قبل حذف الحساب: إن كان للعضو رمزُ أبل محفوظٌ يُلغى عندها. **لا يرمي أبداً** — الحذفُ لا ينتظر أبل. */
export async function revokeAppleFor(userId: string): Promise<RevokeResult> {
  try {
    if (!hasServiceKey()) return "unconfigured";
    const admin = await createServiceClient();
    const { data, error } = await admin.from("apple_tokens").select("refresh_token").eq("user_id", userId).maybeSingle();
    if (error) {
      console.error("[apple] token read", error.message);
      return "failed";
    }
    const token = (data as { refresh_token?: string } | null)?.refresh_token;
    if (!token) return "none";
    const key = appleKey();
    if (!key) return "unconfigured";
    const r = await appleRevoke(key, token, post);
    if (!r.ok) {
      console.warn(`[apple] revoke refused: ${r.detail}`);
      return "failed";
    }
    return "revoked";
  } catch (e) {
    console.error("[apple] revoke", e instanceof Error ? e.name : "error");
    return "failed";
  }
}
