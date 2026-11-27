import type { NextRequest } from "next/server";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { GET as shareImage } from "@/app/api/share/route";

/* صورةُ البطاقة تُرسم بـ`ImageResponse` وتقرأ خطَّيها من القرص — كمسارها الأصل */
export const runtime = "nodejs";

/**
 * `GET /api/v1/me/report/image?p=week|month|year|all` — **صورةُ «شارك تقريرك»** (🆕 D-1368 · Phase 11-V · V-C · C5 · الدفعة ج).
 *
 * 🔑 **الراسمُ راسمُ الويب نفسُه** (`/api/share?kind=report` — D-810): هذا بابُه للتطبيق لا نسخةٌ منه. الخطّان و`dataUrl`
 * وحارسُ المشترك (`403` لغير Plus) والمدّةُ الفارغة (`409`: لا بطاقةَ تُظهر صفراً) كلُّها هناك — مسارٌ ثانٍ ينسخها يفترق عند
 * أوّل إصلاح (حجّةُ ذلك الملفّ، D-145). الجلسةُ تُقرأ من ترويسة الطلب الحاليّ (`Bearer`)، فالطلبُ المُمرَّر يحمل العنوانَ وحدَه.
 *  - **البوّابةُ هنا** (كنمط `…/me/export`): جلسةٌ وحدٌّ قبل رسمٍ مكلِف (ثلاثةُ ملصقاتٍ وصورةُ وجهٍ تُجلب ثمّ تُرسم) — ٨ في الدقيقة.
 *  - الردُّ ملفٌّ خامّ لا مغلَّف: التطبيقُ يكتبه على القرص ويسلّمه لورقة المشاركة (`downloadTo` — وصفةُ C3).
 */
export async function GET(req: NextRequest) {
  const gate = await handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:report-image:${auth.user.id}`, 8, 60_000);
    if (lim) return lim;
    return ok({ done: true });
  });
  if (!gate.ok) return gate;
  const raw = req.nextUrl.searchParams.get("p");
  const period = raw === "week" || raw === "year" || raw === "all" ? raw : "month";
  const target = new URL("/api/share", req.url);
  /* 🆕 «حصاد 2026» (أحمد ٢٦ نوفمبر «ق٧أ»): مشاركةُ «السنة» بطاقةُ القصّة ١٠٨٠×١٩٢٠ لا صورةُ التقرير العريضة */
  /* 🆕 حصاد 2026 — صورةُ صفحةٍ من القصّة (`&page=time|top|taste|loved`): كلُّ صفحةٍ تُشارَك («ن٦ · ق٧») */
  const page = req.nextUrl.searchParams.get("page");
  if (period === "year" && (page === "time" || page === "top" || page === "taste" || page === "loved")) {
    target.searchParams.set("kind", "yearpage");
    target.searchParams.set("page", page);
  } else if (period === "year") target.searchParams.set("kind", "year");
  else if (period === "all") {
    /* 🆕 آخرُ صفحةٍ في قصّة «إحصائياتك» (ت٤ «ج»): بطاقةُ كلِّ الأوقات بالراسم نفسِه */
    target.searchParams.set("kind", "year");
    target.searchParams.set("p", "all");
  } else {
    target.searchParams.set("kind", "report");
    target.searchParams.set("p", period);
  }
  return shareImage(new Request(target));
}
