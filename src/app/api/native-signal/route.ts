import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { allow } from "@/core/ratelimit";
import { APP_UA_TAG, isLoopzApp } from "@/core/platform";

/**
 * ====== إشارةُ بوّابة الشاشات الأصليّة (تشخيصٌ · ١٤ سبتمبر ٢٠٢٦) ======
 *
 * **بلاغُ أحمد على الغلاف 1.6.0: «المكتبة» و«اكتشف» تفتحان الصفحةَ لا الشاشة.**
 * المراجعةُ الساكنةُ للويب والغلاف لم تجد شيئاً، والمحاكاةُ في المتصفّح صحيحة —
 * **فالجوابُ على الجهاز وحدَه**: أيُّ شرطٍ من شروط `openNative` الثلاثة يسقط؟
 * (سمةُ `data-native-library` · جسرُ `ReactNativeWebView` · حقنُ `LoopzNative`).
 *
 * **تُسجَّل في `runtime_errors` عبر `log_runtime_error` نفسِها** (D-668) — لا سجلٌّ
 * ثانٍ — **بنوع `NativeGate`**، على نهج `trailer-signal` (D-881): **صفرُ معرّفٍ
 * وصفرُ نصٍّ حرّ** — منطقيّاتٌ من قائمةٍ ثابتة، والمسارُ من اثنين، ونسخةُ الغلاف
 * تُقرأ من رأس UA خادميّاً (مقصوصةً على `[\w.]{1,16}`) لا من الحمولة.
 *
 * ⚠️ **تشخيصٌ مؤقّت**: يُزال مع إصلاح السبب. الردُّ `204` دائماً.
 */
const MAX_BODY = 256;
const ROUTES = new Set(["library", "discover"]);
const FLAGS = ["attr", "rnwv", "ln", "lib", "disc"] as const;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allow(`native:${ip}`, 20, 600_000)) return new NextResponse(null, { status: 204 });
    const ua = req.headers.get("user-agent") ?? "";
    /* من خارج الغلاف لا معنى للإشارة — الرابطُ هناك رابطٌ بقرار */
    if (!isLoopzApp(ua)) return new NextResponse(null, { status: 204 });

    const raw = await req.text().catch(() => "");
    if (!raw || raw.length > MAX_BODY) return new NextResponse(null, { status: 204 });
    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      body = null;
    }
    const route = typeof body?.route === "string" && ROUTES.has(body.route) ? body.route : null;
    if (!route) return new NextResponse(null, { status: 204 });
    const flags = FLAGS.map((f) => `${f}=${body?.[f] === true ? 1 : 0}`).join(" ");
    const ver = new RegExp(`${APP_UA_TAG}([\\w.]{1,16})`).exec(ua)?.[1] ?? "?";

    const supabase = await createServiceClient();
    await supabase.rpc("log_runtime_error", {
      p_route: `/native-gate#${route}`,
      p_digest: `${route}:${flags.replace(/[a-z]+=/g, "")}`,
      p_kind: "NativeGate",
      p_message: `route=${route} ${flags} shell=${ver}`,
    });
  } catch {
    /* إشارةٌ ضاعت لا تُقلق أحداً — ولا تعطّل صفحة */
  }
  return new NextResponse(null, { status: 204 });
}
