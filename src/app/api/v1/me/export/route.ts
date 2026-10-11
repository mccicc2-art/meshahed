import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { exportMyData } from "@/lib/actions";

/**
 * `GET /api/v1/me/export` — **تصديرُ بياناتي من التطبيق** (🆕 D-1359 · Phase 11-V · V-C · C3، قرارُ أحمد ١١ أكتوبر: «نفذ»).
 * التصديرُ في الويب صفٌّ داخل صفحة «الاستيراد والتصدير»، وهي بابٌ ويبيٌّ في التطبيق والاستيرادُ موقوف — فلم يكن له طريقٌ أصليّ.
 *
 * 🔑 **الفعلُ فعلُ الويب نفسُه** (`exportMyData`): الجداولُ نفسُها تحت RLS بهويّة حامل الرمز، **وحدُّه معه** (٣ في الدقيقة).
 * 🔑 **الردُّ الناجحُ هو الملفُّ نفسُه لا غلافُ `{data}`**: التطبيقُ يكتبه من الشبكة إلى القرص مباشرةً (`File.downloadFileAsync`)
 * فلا يمرّ نصّاً بذاكرة JS (حتى ٥٠ ألف حلقة)، والملفُّ الناتجُ هو ملفُّ الويب حرفاً. **والفشلُ بغلاف الأخطاء ورمزِه كغيره**
 * (`handle`: ٤٠١ · ٤٢٩ · بوّابةُ الترحيب · ٥٠٠) — فالحراسةُ لا تُكتب مرّتين.
 */
export async function GET() {
  let json = "";
  const gate = await handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    json = await exportMyData();
    return ok({ done: true });
  });
  if (!gate.ok) return gate;
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="loopz-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
      Vary: "Authorization, Cookie",
    },
  });
}
