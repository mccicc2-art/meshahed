import { kodiIndexHtml } from "@/lib/kodiAddon";

export const dynamic = "force-static";

/**
 * `GET /api/v1/kodi/` — **مصدرُ إضافة Kodi** (هجرة ٢٣٦): يضيفه العضو في Kodi (File manager ← Add source) ثمّ
 * «Install from zip file». قائمةٌ بملفٍّ واحد على شكل فهرس Apache الذي يقرؤه Kodi.
 * ⚖️ تحت `/api/v1/` لأن جدارَ Vercel يتحدّى Kodi في غيرها (D-945).
 */
export function GET() {
  return new Response(kodiIndexHtml(), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
