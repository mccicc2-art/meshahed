import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { allow } from "@/core/ratelimit";

/**
 * ====== إشارةُ مشغّل الترايلر (D-881 · `LOOPZ-AUD-0023`) ======
 *
 * **فشلٌ يتبدّل بالبيئة لا يُصلَح بالتخمين**: المراجعُ رأى «spinner ثمّ زرَّ
 * تشغيل» على Production ولم يُعد إنتاجُه في بيئتنا (Baseline §3، `P10-06`).
 * **فيُسجَّل ما يقوله يوتيوب نفسُه** — رمزُ الخطأ وحالةُ المشغّل — **في
 * `runtime_errors` عبر الدالّة نفسِها التي يكتب فيها الخادمُ أخطاءَه**
 * (`instrumentation.ts` · D-668)، **لا سجلٌّ ثانٍ ولا جدولٌ ثانٍ.**
 *
 * 🔒 **صفرُ معرّف**: لا مفتاحَ فيديو ولا معرّفَ عمل ولا مستخدم ولا عنوان —
 * **نوعُ الإشارة ورقمُها وحالةُ المشغّل ومزوّدُه** لا غير — **وكلُّ حقلٍ
 * يصل الدالّةَ من قائمةٍ ثابتة أو رقمٍ مقصوص** (لا نصَّ حرٌّ يعبر).
 *
 * ⚠️ **قياسٌ احتياطيٌّ (best-effort telemetry) لا حمايةٌ**: **الحاجزُ
 * `allow` ذاكرةُ نسخةٍ واحدة من الدالّة**، **وفي Serverless تتعدّد النسخُ
 * فيتضاعف السقفُ بعددها** — **فهو يخفّف الحلقاتِ ولا يمنع المتعمِّد**،
 * **والجدولُ له سقفُ احتفاظٍ مسجَّلٌ في `LOOPZ-AUD-0058`.** **وسقفُ الحمولة
 * ٢٥٦ بايتاً**: الحمولةُ الصحيحةُ دون المئة، وما زاد يُسقَط قبل أن يُفكّ.
 * **والردُّ `204` دائماً**: **الإشارةُ لا تُغيّر ما يراه المستخدم.**
 */
const MAX_BODY = 256;
const KINDS = new Set(["yt-error", "autoplay-blocked", "blocked", "stalled", "retry-failed"]);
const PHASES = new Set(["idle", "loading", "playing", "paused", "blocked", "stalled"]);

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allow(`trailer:${ip}`, 20, 600_000)) return new NextResponse(null, { status: 204 });

    const raw = await req.text().catch(() => "");
    if (!raw || raw.length > MAX_BODY) return new NextResponse(null, { status: 204 });
    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      body = null;
    }
    const kind = typeof body?.kind === "string" && KINDS.has(body.kind) ? body.kind : null;
    /* **الرمزُ عددٌ صحيحٌ مقصوصٌ على مدى يوتيوب** (2 · 5 · 100 · 101 · 150 · 153 …) — وما سواه `-1` */
    const rawCode = Number.isInteger(body?.code) ? Number(body!.code) : -1;
    const code = rawCode >= 0 && rawCode <= 999 ? rawCode : -1;
    const phase = typeof body?.phase === "string" && PHASES.has(body.phase) ? body.phase : "idle";
    const provider = body?.provider === "file" ? "file" : "youtube";
    if (!kind) return new NextResponse(null, { status: 204 });

    // عميلُ الخدمة (D-898): بابُ السجلّ هذا المسارُ وحاجزُه، لا PostgREST مباشرةً
    const supabase = await createServiceClient();
    await supabase.rpc("log_runtime_error", {
      p_route: "/trailers#player",
      p_digest: `${kind}:${code}`,
      p_kind: "TrailerSignal",
      p_message: `kind=${kind} code=${code} phase=${phase} provider=${provider}`,
    });
  } catch {
    /* إشارةٌ ضاعت لا تُقلق أحداً — ولا تعطّل صفحة */
  }
  return new NextResponse(null, { status: 204 });
}
