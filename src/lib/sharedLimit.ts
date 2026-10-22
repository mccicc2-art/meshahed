import "server-only";
import { createServiceClient, hasServiceKey } from "@/lib/supabase/service";
import { fail, limited } from "@/lib/v1";
import type { Err } from "@/core/contracts/result";

/**
 * ====== 🆕 حدٌّ مشتركٌ بين نسخ الخادم — لأبواب الجلسة (A-14 · المدقّق ٢٢ أكتوبر) ======
 *
 * 🔴 **العلّة**: `limited` (`core/ratelimit.ts`) يعدّ في ذاكرة النسخة الواحدة — وVercel يشغّل نسخاً كثيرةً تبرد وتولد،
 * فحدُّ «٦ في الساعة» على سكّ الجلسة كان ٦ لكلِّ نسخة. يكفي ذلك لحصّة TMDB (الغرضُ الذي كُتب له)، ولا يكفي لبابٍ يصنع
 * جلسات. هنا العدّاد في القاعدة (`rate_hit`، الهجرة ٢٢١): نافذةٌ ثابتةٌ لكلِّ مفتاح، وزيادةٌ ذرّيّةٌ في صفٍّ واحد.
 *
 * ⚖️ **للأبواب الحسّاسة وحدها** (السكّ · أبل · رمزُ الودجت): نداءٌ للقاعدة في كلِّ طلب ثمنٌ لا يُدفع على كلِّ مسار.
 *
 * ⚠️ **الفشلُ يرجع للذاكرة لا يفتح الباب**: قبل الهجرة ٢٢١ (أو بلا مفتاح الخدمة، أو القاعدةُ لم تُجب) يعمل الحدُّ القديم
 * نفسُه — فالكودُ يسبق الهجرة بلا ثغرةٍ جديدة، وعطلُ القاعدة لا يُسقط الدخول.
 */
export async function sharedLimited(key: string, limit: number, windowMs: number): Promise<Err | null> {
  if (hasServiceKey()) {
    try {
      const db = await createServiceClient();
      const { data, error } = await db.rpc("rate_hit", {
        p_key: key,
        p_limit: limit,
        p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
      });
      const r = data as { allowed?: unknown; retry_after_s?: unknown } | null;
      if (!error && r && typeof r.allowed === "boolean") {
        if (r.allowed) return null;
        const s = typeof r.retry_after_s === "number" && r.retry_after_s > 0 ? r.retry_after_s : 1;
        return fail("rate_limited", { retry_after_ms: s * 1000 });
      }
    } catch {
      /* يرجع للذاكرة أدناه */
    }
  }
  return limited(key, limit, windowMs);
}

/**
 * 🆕 A-04 — **سطرٌ لكلِّ جلسةٍ سُكّت** (`session_mints`، الهجرة ٢٢١): من، ومن أيِّ جلسة ويب، وبأيِّ باب، وكم كان عمرُ الرمز.
 * عمرُ الرمز يُقاس قبل أن يُشترط: حدٌّ على العمر بلا قياسٍ يُسقط سكّاً مشروعاً (الـWebView يجدّد رمزَه كلَّ ساعة).
 * فشلُه صمت — السجلُّ ليس شرطاً للسكّ.
 */
export async function logSessionMint(row: { userId: string; sessionId: string | null; via: "bearer" | "cookie"; tokenAgeS: number | null }): Promise<void> {
  if (!hasServiceKey()) return;
  try {
    const db = await createServiceClient();
    await db.from("session_mints").insert({
      user_id: row.userId,
      session_id: row.sessionId,
      via: row.via,
      token_age_s: row.tokenAgeS,
    });
  } catch {
    /* لا شيء */
  }
}
