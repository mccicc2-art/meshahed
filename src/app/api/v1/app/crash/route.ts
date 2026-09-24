import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handle, requireUser, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { APP_UA_TAG } from "@/core/platform";

/**
 * ====== `POST /api/v1/app/crash` — سقوطُ شاشةٍ أصليّة يُكتب في السجلّ (D-974) ======
 *
 * **بلاغُ أحمد بتسجيل على 1.8.5: «ضغطت على فلم ما دخلني صفحته، الشاشة صارت
 * سوداء، ثمّ رجعت للخلف وخرجني من التطبيق».** لا حارسَ أخطاءٍ كان في التطبيق،
 * فخطأُ رسمٍ واحد يُسقط الشجرةَ كلَّها — ولا أحدَ يعرف أيَّ سطرٍ سقط: الحاويةُ لا
 * تصل الهاتف، و`logcat` يحتاج USB (A0 محجوبٌ بالهاتف). **فالتطبيقُ يبلّغ سقوطَه
 * بنفسه** من `ErrorBoundary` (`apps/mobile/src/ErrorBoundary.tsx`) إلى
 * `runtime_errors` عبر `log_runtime_error` نفسِها (D-668) — بنوع `AppCrash`.
 *
 * ⚖️ **بمستخدمٍ مسجَّل وبحدّ** (١٠ في الدقيقة): ليس إشارةً مجهولة كـ`native-signal`
 * — الحمولةُ نصٌّ حرٌّ (رسالةُ الخطأ ومقطعٌ من المكدّس) **مقصوصٌ على ٦٠٠ حرف**،
 * ونسخةُ التطبيق من الجسم لأنّ `fetch` الأصليّ لا يحمل وسمَ `LoopzApp/` (هو وسمُ
 * الـWebView وحدَها). الردُّ `{done:true}` دائماً — سقوطٌ لا يُسجَّل لا يُخفي شاشةً.
 */
const MAX_MESSAGE = 600;
/* الرئيسيّةُ والبحثُ والإعداداتُ أصليّةٌ منذ 11-G/H/I وكانت أعطالُها تُسجَّل «unknown» */
const SCREENS = new Set(["library", "discover", "title", "person", "list", "shell", "home", "search", "settings"]);

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:app:crash:${auth.user.id}`, 10, 60_000);
    if (lim) return lim;
    let body: { screen?: unknown; message?: unknown; stack?: unknown; version?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    const screen = typeof body.screen === "string" && SCREENS.has(body.screen) ? body.screen : "unknown";
    const message = typeof body.message === "string" ? body.message.slice(0, MAX_MESSAGE) : "";
    const stack = typeof body.stack === "string" ? body.stack.slice(0, MAX_MESSAGE) : "";
    const version = typeof body.version === "string" ? (/^[\w.]{1,16}$/.exec(body.version)?.[0] ?? "?") : "?";
    if (!message) return fail("invalid_input");
    /* البصمةُ من الرسالة والشاشة — الأخطاءُ المتشابهة تتجمّع صفّاً واحداً (D-668) */
    const digest = `${screen}:${message.slice(0, 80)}`;
    try {
      const supabase = await createServiceClient();
      await supabase.rpc("log_runtime_error", {
        p_route: `/app/${screen}`,
        p_digest: digest,
        p_kind: "AppCrash",
        p_message: `${APP_UA_TAG}${version} ${screen}: ${message}${stack ? `\n${stack}` : ""}`,
      });
    } catch {
      /* السجلُّ ليس شرطاً للردّ */
    }
    return ok({ done: true }, []);
  });
}
