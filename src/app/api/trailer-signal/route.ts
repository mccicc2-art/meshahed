import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allow } from "@/lib/ratelimit";

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
 * **نوعُ الإشارة ورقمُها وحالةُ المشغّل ومزوّدُه** لا غير. **والحاجزُ
 * بالعنوان كنبضة اللغة** (`lang-ping`): ٢٠ إشارةً لكلِّ عشرِ دقائق —
 * **صفحةٌ تفشل مرّةً ترسل مرّةً، وحلقةٌ لا تُغرق الجدول.**
 * **والردُّ `204` دائماً**: **الإشارةُ لا تُغيّر ما يراه المستخدم.**
 */
const KINDS = new Set(["yt-error", "autoplay-blocked", "blocked", "stalled", "retry-failed"]);
const PHASES = new Set(["idle", "loading", "playing", "paused", "blocked", "stalled"]);

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allow(`trailer:${ip}`, 20, 600_000)) return new NextResponse(null, { status: 204 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const kind = typeof body?.kind === "string" && KINDS.has(body.kind) ? body.kind : null;
    const code = Number.isInteger(body?.code) ? Number(body!.code) : -1;
    const phase = typeof body?.phase === "string" && PHASES.has(body.phase) ? body.phase : "idle";
    const provider = body?.provider === "file" ? "file" : "youtube";
    if (!kind) return new NextResponse(null, { status: 204 });

    const supabase = await createClient();
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
