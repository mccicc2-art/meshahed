import { KODI_ZIP_NAME, kodiAddonZip } from "@/lib/kodiAddon";

export const dynamic = "force-static";
export const dynamicParams = false;

/** ملفٌّ واحدٌ يُبنى: الإصدارُ الحاليّ — وما سواه ٤٠٤ */
export function generateStaticParams() {
  return [{ file: KODI_ZIP_NAME }];
}

/** `GET /api/v1/kodi/service.loopz-<version>.zip` — الإضافةُ نفسُها (`lib/kodiAddon.ts`) */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (file !== KODI_ZIP_NAME) return new Response("Not found", { status: 404 });
  const body = kodiAddonZip();
  return new Response(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${KODI_ZIP_NAME}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
