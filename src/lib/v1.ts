import "server-only";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { allow, retryAfter } from "@/core/ratelimit";
import {
  err,
  httpStatus,
  type Err,
  type ErrorCode,
  type Result,
} from "@/core/contracts/result";
import type { Dict } from "@/core/i18n";

/**
 * ====== غلافُ `/api/v1` — رقيقٌ عمداً (Phase 9 §4.3) ======
 *
 * 🔑 **الـAPI لا يحمل منطقاً، يحمل ترجمة**: من طلبِ HTTP إلى استدعاءٍ، ومن
 * `Result` إلى ردّ. المنطقُ نفسُه الذي يخدم الويب (`data.ts`/`actions.ts`)
 * يخدم التطبيق، **لأنّ `createClient()` صار يقرأ `Bearer` كما يقرأ الكوكي** —
 * فلا نسخةَ ثانيةً من ١٦٤ كتابةً و١٢١ قراءة.
 *
 * 🔑 **الأخطاءُ بمفتاحٍ لا نصّ** (القاعدة ٥): `message_key` من `Dict` نفسِه،
 * **ومحقَّقٌ بالنوع** — مفتاحٌ لا يوجد في القاموس خطأُ ترجمة لا خطأُ تشغيل.
 *
 * 🔑 **والإبطالُ في الجسم** (القاعدة ٤): `invalidates` تعود كما هي، والتطبيقُ
 * يُسقط استعلاماتِه المحلّية بها. لا `revalidatePath` هنا — لا مقابلَ له.
 *
 * ⚠️ **ولا `throw` يعبر إلى العميل**: `handle` يلتقط كلَّ استثناءٍ ويردّه
 * `internal` **بلا نصِّ الاستثناء** — رسالةُ Postgres أو TMDB ليست للناس.
 */

/** مفاتيحُ القاموس المسموحُ بها كرسائلِ خطأ — الأنواعُ تحرس الاسم. */
type MessageKey = Extract<keyof Dict, `api${string}`>;

const DEFAULT_KEY: Record<ErrorCode, MessageKey> = {
  unauthenticated: "apiUnauthenticated",
  forbidden: "apiForbidden",
  not_found: "apiNotFound",
  invalid_input: "apiInvalidInput",
  rate_limited: "apiRateLimited",
  conflict: "apiConflict",
  upstream: "apiUpstream",
  internal: "apiInternal",
};

export const fail = (
  code: ErrorCode,
  extra?: { field?: string; retry_after_ms?: number; message_key?: MessageKey },
): Err => err(code, extra?.message_key ?? DEFAULT_KEY[code], extra);

/** `Result` ⇢ ردُّ HTTP بالرمز الصحيح والشكل الواحد. */
export function respond<T>(
  r: Result<T>,
  init?: { cacheControl?: string },
): NextResponse {
  if (!r.ok) {
    const headers: Record<string, string> = { Vary: "Authorization, Cookie", "Cache-Control": "private, no-store" };
    if (r.error.retry_after_ms)
      headers["Retry-After"] = String(Math.ceil(r.error.retry_after_ms / 1000));
    return NextResponse.json(
      { error: r.error },
      { status: httpStatus[r.error.code], headers },
    );
  }
  const headers: Record<string, string> = {
    // الافتراضُ: لا كاشَ وسيط — الردودُ شخصيّةٌ أو متغيّرة؛ المسارُ يرفع
    // `cacheControl` صراحةً حين يعرف أنّ ردَّه عامٌّ وثابتٌ لدقائق
    "Cache-Control": init?.cacheControl ?? "private, no-store",
    /* 🔴 **مقيسٌ على الإنتاج (٤ سبتمبر)**: الردُّ نفسُه بعنوانٍ واحدٍ يختلف
       بالهويّة — زائرٌ ثمّ Bearer — **فأعاد كاشُ المتصفّح ردَّ الزائر لصاحب
       الرمز** (`watched_count: 0` وهو ٧٣). المفتاحُ الذي يميّز الردَّ ليس
       العنوان بل الترويسة، **ويجب أن يقال ذلك للكاش صراحةً.** */
    Vary: "Authorization, Cookie",
  };
  return NextResponse.json({ data: r.data, invalidates: r.invalidates }, { headers });
}

/** يلتقط أيَّ استثناءٍ في المسار ويردّه شكلاً واحداً — **بلا تسريبِ نصّه**. */
export async function handle<T>(
  fn: () => Promise<Result<T>>,
  init?: { cacheControl?: string },
): Promise<NextResponse> {
  try {
    return respond(await fn(), init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    /* الأفعالُ القائمة (`actions.ts`) ترمي نصوصاً عربيّةً ثابتةً لثلاثِ
       حالاتٍ معروفة — تُترجم هنا مرّةً واحدةً إلى رمزها، **فلا يُعاد
       كتابةُ حارسٍ في ١٦٤ فعلاً لأجل الـAPI.** ما سواها خللٌ عندنا. */
    if (msg.includes("غير مسجّل")) return respond(fail("unauthenticated"));
    if (msg.includes("طلبات كثيرة")) return respond(fail("rate_limited"));
    if (msg.includes("مدخل غير صالح")) return respond(fail("invalid_input"));
    // استثناءٌ آخر = خللٌ عندنا لا عند المستخدم. يُسجَّل بلا هويّة.
    console.error("[api/v1]", msg || "unknown");
    return respond(fail("internal"));
  }
}

/** الجلسةُ الكاملة (تحقُّقٌ بلا اختصار) — للكتابات وكلِّ ما هو شخصيّ. */
export async function requireUser(): Promise<
  { ok: true; user: NonNullable<Awaited<ReturnType<typeof getUser>>> } | Err
> {
  const user = await getUser();
  if (!user) return fail("unauthenticated");
  return { ok: true, user };
}

/** حدُّ المعدّل بنفس أرقام المسارات القائمة (القاعدة ٧) — لكلِّ مستخدمٍ أو عنوان. */
export function limited(key: string, limit: number, windowMs: number): Err | null {
  if (allow(key, limit, windowMs)) return null;
  return fail("rate_limited", { retry_after_ms: retryAfter(key) * 1000 });
}

/** عددٌ صحيحٌ موجبٌ من مقطعِ مسارٍ أو استعلام — أو `null`. */
export function positiveInt(raw: string | null | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
