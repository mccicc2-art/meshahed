import type { NextRequest } from "next/server";
import { STREMIO_TOKEN_RE } from "@/core/stremioId";
import { addonJson, addonManifest, addonOptions } from "../../addon";

export const dynamic = "force-dynamic";

/**
 * `GET /api/v1/stremio/{token}/manifest.json` — بيانُ إضافة Loopz **الشخصيّ**.
 * 🔑 **لا يلمس القاعدة**: Stremio يجلب البيانَ عند التثبيت وعند كلِّ تشغيل، والرمزُ يُفحص شكلُه وحده هنا — رمزٌ ملغىً
 * يثبّت إضافةً لا تسجّل شيئاً (مسارُ `stream` يحكم). و«Configure» يفتح صفحةَ الربط (`/stremio`) لرابطٍ جديدٍ أو إلغاء.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!STREMIO_TOKEN_RE.test(token)) return addonJson({ error: "not_found" }, 404);
  return addonJson(addonManifest({ configurationRequired: false }));
}

export const OPTIONS = addonOptions;
