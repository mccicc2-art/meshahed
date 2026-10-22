import "server-only";
import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";

/**
 * 🆕 **ردودُ إضافة Stremio** (خطّةُ Stremio، ٢٢ أكتوبر) — بروتوكولُ Stremio لا غلافُ `/api/v1`: JSON عارٍ،
 * CORS لكلِّ أصل (شرطُ SDK: Stremio Web يسأل من `app.strem.io`)، و`no-store` — كلُّ فتحٍ يصلنا ليُسجَّل، وكاشٌ
 * وسيطٌ يعيد ردَّ رمزٍ لرمزٍ آخر لا يقع لأنّ الرمز في المسار أصلاً.
 */
export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export function addonJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

export function addonOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
}

/** صفحةُ الإعداد على الويب — زرُّ «Configure» في Stremio يفتحها من البيانين كليهما */
export const CONFIGURE_PAGE = `${SITE_URL}/stremio`;

/**
 * 🆕 **بيانُ الإضافة الواحد** (D-1512، ٢٢ أكتوبر «١ أ ٢ أ ٣ أ»): العامُّ (قائمةُ Community Addons) والشخصيُّ يفترقان
 * في سطرٍ واحد — `configurationRequired`: العامُّ لا يُثبَّت بلا إعداد، فيفتح Stremio صفحتَنا بدل التثبيت.
 *  - **الوصفُ إنجليزيٌّ وحدَه**: Stremio يرسم العربيَّ والإنجليزيَّ في سطرٍ واحدٍ ملتصقين (لقطةُ أحمد) — والقائمةُ عالميّة.
 *  - **الشعارُ علامةُ Loopz المربّعة والخلفيّةُ غلافُها** — لا علامةَ لـStremio في شيء (شروطُه).
 */
export function addonManifest(opts: { configurationRequired: boolean }) {
  return {
    id: "com.loopztv.signals",
    version: "1.2.0",
    name: "Loopz",
    description:
      "Mark what you watch in Loopz. Adds one entry, “✓ Mark it in Loopz”, under each episode and movie; anything you play is asked about on your Loopz home. Streams nothing. For Loopz+ members.",
    logo: `${SITE_URL}/loopz-mark.png`,
    background: `${SITE_URL}/loopz-cover.jpg`,
    resources: ["stream", "subtitles"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: [],
    behaviorHints: { configurable: true, configurationRequired: opts.configurationRequired },
  };
}
