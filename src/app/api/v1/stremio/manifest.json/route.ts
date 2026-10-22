import { addonJson, addonManifest, addonOptions } from "../addon";

export const dynamic = "force-dynamic";

/**
 * 🆕 `GET /api/v1/stremio/manifest.json` — **البيانُ العامّ** لقائمة Community Addons (D-1512 «٣ أ»).
 * لا رمزَ فيه ولا يسجّل شيئاً: `configurationRequired` يجعل Stremio يفتح `…/configure` ⇢ صفحةَ الربط على Loopz،
 * وهناك يأخذ العضوُ رابطَه الشخصيّ. لا مسارَ `stream` تحته — إضافةٌ غيرُ مُعدّةٍ لا تُسأل.
 */
export function GET() {
  return addonJson(addonManifest({ configurationRequired: true }));
}

export const OPTIONS = addonOptions;
