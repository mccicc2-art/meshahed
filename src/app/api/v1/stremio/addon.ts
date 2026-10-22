import "server-only";
import { NextResponse } from "next/server";

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
