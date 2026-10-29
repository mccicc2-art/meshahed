import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUser, getUserId, getOnboardInfo, type OnboardState } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { allow, retryAfter } from "@/core/ratelimit";
import {
  err,
  httpStatus,
  type Err,
  type ErrorCode,
  type Result,
} from "@/core/contracts/result";
import type { Dict } from "@/core/i18n";
import { traced } from "@/lib/reqTrace";

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

/**
 * ====== 🆕 D-1341 — بوّابةُ الترحيب على `/api/v1` (Phase 11-U · U0) ======
 *
 * قرارُ أحمد ١٧: «الخطوات اجبارية .. محد يقدر يتصفح الا اذا خلصها». الشاشاتُ الأصليّةُ تقرأ من هنا،
 * فتطبيقٌ لم يأخذ تحديثَه — أو نداءٌ مباشر — **بابٌ خلفيٌّ** ما لم يرفض الخادمُ نفسُه (D-821).
 *
 * 🔑 **في `handle` لا في `requireUser`**: مساراتُ القراءة (اكتشف · العمل · البحث) تقبل الزائرَ ولا
 * تنادي `requireUser` — والحارسُ هناك كان سيتركها مفتوحةً لمن دخل ولم يُتمّ. الزائرُ (بلا رمز) يمرّ
 * كما كان؛ المسؤولُ عنه «الدخول أوّلاً» (U1/U2) لا هذا.
 *
 * 🔑 **والثمنُ قراءةٌ واحدةٌ لكلِّ عضوٍ لكلِّ نسخةِ خادم**: الختمُ يُكتب مرّةً ولا يُمحى، فمن ثبت أنّه
 * أتمّ يُحفظ معرّفُه في ذاكرة النسخة ولا يُسأل عنه ثانيةً. لا يُحفظ «لم يُتمّ» — ذاك يتبدّل.
 *
 * ⚠️ **يفتح عند الشكّ**: خطأُ قاعدةٍ، عمودٌ غائب (شيفرةٌ سبقت هجرتَها)، صفٌّ لم يُقرأ ⇒ يمرّ.
 * حارسٌ لا يعرف لا يقفل عضواً خارج حسابه.
 */
const WELCOME_DONE = new Set<string>();
const WELCOME_DONE_MAX = 20_000;
/* 🆕 D-1354 — من خُتم له ولم يُسمَّ بعد: يكفي تطبيقاً قديماً (يُحكم له بالختم وحدَه) ولا يكفي غيرَه */
const WELCOME_STAMPED = new Set<string>();

/**
 * 🆕 D-1354 — **هل يفهم السائلُ بوّابةَ «اسم المستخدم»؟** التطبيقُ الذي أخذ تحديثَها يقول ذلك بترويسة
 * `x-loopz-gate: 2` (`apps/mobile/src/api.ts`). من لا يقولها — تطبيقٌ على تحديثٍ أقدم، أو بناءٌ أصليٌّ لا تصله
 * التحديثاتُ بعد اليوم — لا يملك إلّا الترحيبَ بخطواته الخمس، **فيُحكم له بالختم وحدَه كما كان**: رفضُه هنا كان
 * سيرفع ذلك الترحيبَ فوق مكتبةٍ قائمة (يضيف أعمالاً ويكتب حلقات). صفحاتُ الويب حارسُها `proxy.ts`.
 */
export const GATE_HEADER = "x-loopz-gate";
export async function gateAware(): Promise<boolean> {
  try {
    return Number((await headers()).get(GATE_HEADER)) >= 2;
  } catch {
    return false;
  }
}

/**
 * 🆕 D-1565 — **هل يعرف السائلُ مراجعاتِ شخصيّات لوبز؟** التطبيقُ الذي أخذ تحديثَها يقول ذلك بترويسة `x-loopz-personas: 1`
 * (`apps/mobile/src/api.ts`). تطبيقٌ أقدم (أو بناءٌ أصليٌّ لا تصله التحديثات) **لا يرى الشخصيّاتِ أصلاً**: نسختُه ترسم الدرجةَ بلا
 * تحقّق (انهارت شاشةُ المجتمع بـ«حاول مجدداً» يوم ٢٩ أكتوبر)، ولا تعرف شارةَ «AI» فكانت سترسم الشخصيّةَ عضواً عادياً — وقرارُ
 * أحمد أنّ الشارةَ في كلِّ مكان. صفحاتُ الويب تُبنى بالخادم نفسِه فتراها دائماً.
 */
export const PERSONAS_HEADER = "x-loopz-personas";
export async function personasAware(): Promise<boolean> {
  try {
    return (await headers()).get(PERSONAS_HEADER) === "1";
  } catch {
    return false;
  }
}

/** حالُ البوّابة كما يفهمها هذا السائل — لـ`/me` و`/welcome` (التطبيقُ يقرّر بها أيرفع الترحيب) */
export async function clientOnboard(): Promise<{ state: OnboardState; mode: "full" | "username" }> {
  const [i, aware] = await Promise.all([getOnboardInfo(), gateAware()]);
  if (!i) return { state: "unknown", mode: "full" };
  if (!i.stamped) return { state: "pending", mode: "full" };
  if (aware && !i.named) return { state: "pending", mode: "username" };
  return { state: "done", mode: "full" };
}

async function welcomePending(): Promise<boolean> {
  try {
    const uid = await getUserId();
    if (!uid || WELCOME_DONE.has(uid)) return false;
    const aware = await gateAware();
    if (!aware && WELCOME_STAMPED.has(uid)) return false;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarded_at, username")
      .eq("id", uid)
      .maybeSingle();
    if (error || !data) return false;
    const row = data as { onboarded_at: string | null; username: string | null };
    const stamped = !!row.onboarded_at;
    const named = !!(row.username ?? "").trim();
    if (stamped) {
      const set = named ? WELCOME_DONE : WELCOME_STAMPED;
      if (set.size >= WELCOME_DONE_MAX) set.clear();
      set.add(uid);
    }
    return aware ? !(stamped && named) : !stamped;
  } catch {
    return false;
  }
}

/** يلتقط أيَّ استثناءٍ في المسار ويردّه شكلاً واحداً — **بلا تسريبِ نصّه**. */
export async function handle<T>(
  fn: () => Promise<Result<T>>,
  /* `open`: مسارٌ يحتاجه من لم يُتمّ الترحيب (الجلسة · «من أنا» · قياساتُ التطبيق) — لا يُسأل عن الختم */
  init?: { cacheControl?: string; open?: boolean },
): Promise<NextResponse> {
  try {
    if (!init?.open && (await welcomePending()))
      return respond(fail("forbidden", { message_key: "apiFinishWelcome" }));
    /* D-1336 — المعالجُ يجري تحت أثر الطلب البطيء (`reqTrace.ts`): قياسٌ لا يغيّر ردّاً */
    return respond(await traced(fn), init);
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
