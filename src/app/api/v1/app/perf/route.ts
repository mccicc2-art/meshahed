import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { handle, requireUser, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { APP_UA_TAG } from "@/core/platform";

/**
 * ====== `POST /api/v1/app/perf` — علاماتُ أداء الشاشات الأصليّة (D-1024 · Phase 11-F · F0) ======
 *
 * **لماذا**: Phase 11-F كلُّها مبنيّةٌ على قراءة الكود — لا رقمَ واحداً من جهاز.
 * الحاويةُ لا تصل الهاتف و`logcat` يحتاج USB، فالتطبيقُ يقيس نفسَه
 * (`apps/mobile/src/perfMarks.ts`) ويرسل دفعةً كلَّ ٣٠ ثانية على الأكثر.
 *
 * 🔑 **في `runtime_errors` عبر `log_runtime_error` نفسِها** (D-668) بنوع `perf` — لا
 * جدولَ ثانياً ولا هجرة، على نهج `AppCrash` (D-974) و`NativeGate`.
 * **صفٌّ واحدٌ للدفعة لا صفٌّ للعلامة**: لوحةُ الإدارة تعدّ صفوفَ هذا الجدول
 * «أخطاءَ خادم»، فكلُّ صفٍّ هنا يرفع ذلك العدّاد — والدفعةُ تُبقي الأثرَ صغيراً.
 *
 * ⚖️ **صفرُ هويّةٍ وصفرُ نصٍّ حرّ** (نهجُ D-881): الاسمُ من قائمةٍ مغلقة، والقيمةُ رقم،
 * ومفاتيحُ `extra` من قائمةٍ مغلقة وقيمُها رقمٌ أو كلمةٌ من `[\w.-]{1,16}`. المستخدمُ
 * يُطلب للحدّ فقط ولا يُكتب. الردُّ `{done:true}` دائماً — قياسٌ ضاع لا يُقلق أحداً.
 *
 * القراءة:
 *   select at, route, message from public.runtime_errors
 *   where kind = 'perf' order by at desc limit 50;
 */
const NAMES = new Set(["library.open", "library.shelf.open", "library.flatgrid", "tab.arm", "discover.open", "coldstart.library"]);
const EXTRA_KEYS = new Set(["count", "screen", "tab", "cached"]);
const MAX_MARKS = 40;
const WORD = /^[\w.-]{1,16}$/;
const ROW_CHARS = 380;

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:app:perf:${auth.user.id}`, 6, 60_000);
    if (lim) return lim;
    let body: { marks?: unknown; version?: unknown; model?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    if (!Array.isArray(body.marks)) return fail("invalid_input");
    const version = typeof body.version === "string" ? (/^[\w.]{1,16}$/.exec(body.version)?.[0] ?? "?") : "?";
    /* طرازُ الجهاز يحمل مسافاتٍ («SM-S918B» · «Pixel 7») — تُطوى ولا يُقبل غيرُ الحروف والأرقام */
    const model = typeof body.model === "string" ? body.model.replace(/[^\w-]+/g, "_").slice(0, 24) || "?" : "?";

    const parts: string[] = [];
    for (const raw of body.marks.slice(0, MAX_MARKS)) {
      const m = raw as { name?: unknown; ms?: unknown; extra?: unknown };
      if (typeof m?.name !== "string" || !NAMES.has(m.name)) continue;
      if (typeof m.ms !== "number" || !Number.isFinite(m.ms) || m.ms < 0 || m.ms > 600_000) continue;
      const extra: string[] = [];
      if (m.extra && typeof m.extra === "object") {
        for (const [k, v] of Object.entries(m.extra as Record<string, unknown>)) {
          if (!EXTRA_KEYS.has(k)) continue;
          if (typeof v === "number" && Number.isFinite(v)) extra.push(`${k}=${Math.round(v)}`);
          else if (typeof v === "string" && WORD.test(v)) extra.push(`${k}=${v}`);
        }
      }
      parts.push(`${m.name}=${Math.round(m.ms)}${extra.length ? `(${extra.join(",")})` : ""}`);
    }
    if (parts.length === 0) return ok({ done: true }, []);

    /* القاعدةُ تقصّ النصَّ عند ٤٠٠ — فالدفعةُ تُقسَّم صفوفاً لا تُقصّ علامةٌ من وسطها */
    const head = `${APP_UA_TAG}${version} ${model} |`;
    const rows: string[] = [];
    let cur = head;
    for (const p of parts) {
      if (cur.length + 1 + p.length > ROW_CHARS && cur !== head) {
        rows.push(cur);
        cur = head;
      }
      cur += ` ${p}`;
    }
    rows.push(cur);
    try {
      const supabase = await createServiceClient();
      for (const message of rows.slice(0, 4))
        await supabase.rpc("log_runtime_error", { p_route: "/app/perf", p_digest: `perf:${version}`, p_kind: "perf", p_message: message });
    } catch {
      /* السجلُّ ليس شرطاً للردّ */
    }
    return ok({ done: true }, []);
  });
}
