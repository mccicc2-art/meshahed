import { after, type NextRequest } from "next/server";
import { stremioOwner } from "@/lib/stremio";
import { STREMIO_TOKEN_RE } from "@/core/stremioId";
import { addonJson, addonManifest, addonOptions } from "../../addon";

export const dynamic = "force-dynamic";

/**
 * `GET /api/v1/stremio/{token}/manifest.json` — بيانُ إضافة Loopz **الشخصيّ**.
 * 🔑 **الردُّ لا ينتظر القاعدة**: Stremio يجلب البيانَ عند التثبيت وعند كلِّ تشغيل، والرمزُ يُفحص شكلُه وحده قبل الردّ — رمزٌ ملغىً
 * يثبّت إضافةً لا تسجّل شيئاً (مسارُ `stream` يحكم). و«Configure» يفتح صفحةَ الربط (`/stremio`) لرابطٍ جديدٍ أو إلغاء.
 * 🆕 **وجلبُ البيان دليلُ الربط** (أحمد ٥ نوفمبر: «ما نقدر نعرف انه تم الربط قبل لا يشاهد حلقة؟» ثمّ «نفذ»): بعد الردّ يُلمس الرابطُ
 * (`stremioOwner` يكتب «آخر استعمال» للرابط النشِط، مرّةً في الساعة) — فصفحةُ الربط تقول «مربوط» لحظةَ التثبيت لا بعد أوّل حلقة.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!STREMIO_TOKEN_RE.test(token)) return addonJson({ error: "not_found" }, 404);
  after(() => stremioOwner(token).catch(() => null));
  return addonJson(addonManifest({ configurationRequired: false }));
}

export const OPTIONS = addonOptions;
