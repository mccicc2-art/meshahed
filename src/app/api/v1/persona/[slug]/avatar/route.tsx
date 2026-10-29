import { ImageResponse } from "next/og";
import { PERSONA_SVGS } from "@/lib/personaAvatars";

/**
 * `GET /api/v1/persona/{slug}/avatar` — صورةُ شخصيّةٍ من شخصيّات لوبز AI (D-1563)، PNG ‏192×192.
 *
 * 🔑 **تحت `/api/v1/` عمداً**: الجدارُ يمرّر هذه البادئةَ وحدَها لعميلٍ غيرِ متصفّح (D-945)، والتطبيقُ يجلب الصورَ بعميله
 * الأصليّ — فصورةٌ في `public/` كانت ستعود إليه صفحةَ تحدٍّ لا صورة. **ولا جلسةَ ولا قاعدة**: خمسةُ رسومٍ ثابتة تُرسم PNG
 * هنا، وتُخبَّأ سنةً لأنّ تغييرَها يغيّر رابطها (`?v=` في `profiles.avatar_url` يوم يُحتاج).
 */
const SIZE = 192;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const svg = Object.prototype.hasOwnProperty.call(PERSONA_SVGS, slug) ? PERSONA_SVGS[slug] : null;
  if (!svg) return new Response("not found", { status: 404 });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={SIZE} height={SIZE} alt="" />,
    {
      width: SIZE,
      height: SIZE,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
