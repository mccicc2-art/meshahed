import type { NextRequest } from "next/server";
import { handle, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { legalDoc, type LegalDocName } from "@/core/legal";
import { getLocale } from "@/lib/locale";

/**
 * ====== `GET /api/v1/legal/[doc]` — الوثيقتان القانونيّتان للتطبيق (شريحةُ «لا ويب في التطبيق» ٢، ١٩ أكتوبر ٢٠٢٦) ======
 *
 * 🔑 **قرارُ أحمد «شاشة تقرأ من الخادم»**: التطبيقُ يرسم الخصوصيّةَ والشروطَ أصليّاً من هذا الردّ، والموقعُ من المصدر نفسِه
 * (`@/core/legal`) — فنصٌّ يُعدَّل يصل الاثنين معاً **بلا تحديثٍ للتطبيق**، ولا نسخةَ ثانيةً تتأخّر.
 *
 * ⚖️ **عامٌّ بلا هويّة ومفتوحٌ قبل الترحيب** (`open`): شاشةُ الدخول تفتحه ممّن لم يسجّل بعد — كصفحتيه في الموقع.
 * واللغةُ من `?lang=` أوّلاً: المتصفّحُ المصغَّر كان يحتاجها في العنوان، والتطبيقُ لا يرسل كوكيز (`NO_COOKIES`).
 * والردُّ واحدٌ لكلِّ لغةٍ فيُخزَّن ساعةً.
 */
const DOCS: readonly LegalDocName[] = ["privacy", "terms"];

export async function GET(req: NextRequest, ctx: { params: Promise<{ doc: string }> }) {
  return handle(
    async () => {
      const { doc } = await ctx.params;
      if (!DOCS.includes(doc as LegalDocName)) return fail("not_found");
      const q = req.nextUrl.searchParams.get("lang");
      const locale = q === "ar" || q === "en" ? q : await getLocale();
      return ok(legalDoc(doc as LegalDocName, locale), []);
    },
    { cacheControl: "public, max-age=3600, s-maxage=3600", open: true },
  );
}
