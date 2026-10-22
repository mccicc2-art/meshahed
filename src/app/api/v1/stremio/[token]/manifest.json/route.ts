import type { NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site";
import { STREMIO_TOKEN_RE } from "@/core/stremioId";
import { addonJson, addonOptions } from "../../addon";

export const dynamic = "force-dynamic";

/**
 * `GET /api/v1/stremio/{token}/manifest.json` — بيانُ إضافة Loopz لـStremio.
 * 🔑 **لا يلمس القاعدة**: Stremio يجلب البيانَ عند التثبيت وعند كلِّ تشغيل، والرمزُ يُفحص شكلُه وحده هنا — رمزٌ ملغىً
 * يثبّت إضافةً لا تسجّل شيئاً (مسارُ `stream` يحكم). والإضافةُ لا تقدّم محتوى ولا روابطَ لمحتوى: مصدرٌ واحدٌ يفتح Loopz.
 * ⚖️ الاسمُ «Loopz» والوصفُ وصفيٌّ؛ لا شعارَ لـStremio ولا اسمُه في البيان (شروطُه: العلامةُ بإذن).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!STREMIO_TOKEN_RE.test(token)) return addonJson({ error: "not_found" }, 404);
  return addonJson({
    id: "com.loopztv.signals",
    version: "1.1.0",
    name: "Loopz",
    description:
      "Mark what you watch in Loopz. Adds one entry, «✓ Mark it in Loopz», under each episode and movie. Streams nothing. · علّم ما تشاهده في Loopz.",
    logo: `${SITE_URL}/icon-192.png`,
    /* `subtitles` لا نقدّم ترجمات: طلبُها يصل حين يبدأ التشغيل — فهو «شغّلها» لا «فتحها» (أحمد «أ مع ج») */
    resources: ["stream", "subtitles"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: [],
    behaviorHints: { configurable: false, configurationRequired: false },
  });
}

export const OPTIONS = addonOptions;
