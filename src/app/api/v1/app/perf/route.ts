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
 * القراءة — الخام:
 *   select at, route, message from public.runtime_errors
 *   where kind = 'perf' order by at desc limit 50;
 *
 * القراءة — p50/p75/p95 لكلِّ علامةٍ لكلِّ إصدار (K1). أسماءُ العلامات وحدَها فيها نقطة، فمفاتيحُ
 * `extra` (`count=3`) لا تُعدّ علامات. والإصدارُ بعد K0 قد يحمل هويّةَ تحديثٍ (`1.12.0_a1b2c3d4`):
 *   with r as (select split_part(split_part(message, 'LoopzApp/', 2), ' ', 1) ver, message
 *              from public.runtime_errors where kind = 'perf' and at > now() - interval '14 days'),
 *        m as (select ver, g[1] mark, g[2]::int ms
 *              from r, regexp_matches(message, '\s([a-z]+\.[a-z.]+)=(\d+)', 'g') g)
 *   select mark, ver, count(*) n,
 *          round(percentile_cont(.5)  within group (order by ms)) p50,
 *          round(percentile_cont(.75) within group (order by ms)) p75,
 *          round(percentile_cont(.95) within group (order by ms)) p95
 *   from m group by 1, 2 order by 1, 2 desc;
 */
/* 🆕 D-1118 — `title.open` (من فتح الشاشة إلى أوّل بيانات) · `season.open` (من فتح الموسم إلى حلقاته) */
/* Phase 11-K · K1 — خطُّ الأساس: الرئيسيّة (والإقلاعُ إليها) · البحث · ضغطةُ التبويب · أوّلُ بياناتٍ حيّة */
const NAMES = new Set([
  "library.open",
  "library.shelf.open",
  "library.flatgrid",
  "tab.arm",
  "discover.open",
  "coldstart.library",
  "title.open",
  "season.open",
  "home.open",
  "coldstart.home",
  "search.open",
  "tab.switch",
  "boot.fresh",
  /* 🆕 D-1128 — «قبل» K2: `gesture.jank` قيمتُه **عددُ إطاراتٍ** ضائعةٍ في سحب التبويبات (`dur` مدّتُه)،
     و`token.life` قيمتُه **ثوانٍ** باقيةٌ في رمز الوصول لحظةَ يستلمه التطبيق. الخانةُ واحدةٌ والوحدةُ
     من الاسم — استعلامُ النِّسب أعلاه يعمل عليهما كما هو، ويُقرأ رقمُهما بوحدته. */
  "gesture.jank",
  "token.life",
]);
/* 🆕 D-1140 — `k2` (0/1: أيُّ مسارٍ للسحب رسم هذه العلامة) و`thread` (js/ui: على أيِّ خيطٍ عُدَّت الإطارات) */
const EXTRA_KEYS = new Set(["count", "screen", "tab", "cached", "dur", "k2", "thread"]);
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
