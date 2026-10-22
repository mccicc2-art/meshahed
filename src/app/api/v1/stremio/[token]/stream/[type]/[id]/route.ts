import { after, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site";
import { findByImdb } from "@/lib/tmdb";
import { recordStremioSignal, stremioOwner } from "@/lib/stremio";
import { allow } from "@/core/ratelimit";
import { STREMIO_TOKEN_RE, parseStremioVideo } from "@/core/stremioId";
import { addonJson, addonOptions } from "../../../../addon";

export const dynamic = "force-dynamic";

const EMPTY = { streams: [] as unknown[] };

/**
 * `GET /api/v1/stremio/{token}/stream/{type}/{id}.json` — Stremio يسأل عن مصادر حلقةٍ أو فيلمٍ فتحه العضو.
 *
 * 🔑 **نسجّل «فتحها» ونعيد مصدراً واحداً: «✓ علّمها في Loopz»** يفتح صفحةَ العمل (`externalUrl` ⇢ روابطُ التطبيق
 * D-1375 تفتح Loopz على الجوّال). **ولا يُعلَّم شيءٌ هنا ولا عند فتح الرابط** — GET لا يكتب في المكتبة؛ الإشارةُ سؤالٌ
 * في الرئيسيّة، والعضوُ يجيب (قرار «المكتبة مقدّسة»).
 *
 * ⚖️ **صمتٌ لا خطأ** لكلِّ ما ليس لنا (رمزٌ مجهول، غيرُ مشترك، معرّفٌ ليس IMDb، عملٌ لا يعرفه TMDB): `{streams: []}`
 * — Stremio يعرض مصادرَ الإضافات الأخرى كأنّنا لم نكن. والتسجيلُ بعد الردّ (`after`): Stremio لا ينتظر قاعدتنا.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string; type: string; id: string }> }) {
  const { token, type, id } = await ctx.params;
  if (!STREMIO_TOKEN_RE.test(token)) return addonJson(EMPTY);
  /* الحدُّ قبل القاعدة: Stremio قد يسأل عن الحلقة التالية مسبقاً، وستّون في الدقيقة فوق أيِّ تصفّحٍ بشريّ */
  if (!allow(`stremio:${token.slice(0, 16)}`, 60, 60_000)) return addonJson(EMPTY);
  const video = parseStremioVideo(type, id);
  if (!video) return addonJson(EMPTY);
  const [owner, tmdbId] = await Promise.all([stremioOwner(token), findByImdb(video.imdb, video.kind)]);
  if (!owner?.plus || !tmdbId) return addonJson(EMPTY);
  after(() => recordStremioSignal(owner.userId, video, tmdbId));
  const where = video.kind === "tv" ? `S${video.season} E${video.episode}` : "";
  return addonJson({
    streams: [
      {
        name: "Loopz",
        description: `✓ علّمها في Loopz\n✓ Mark it in Loopz${where ? `\n${where}` : ""}`,
        externalUrl: `${SITE_URL}/${video.kind === "tv" ? "show" : "movie"}/${tmdbId}`,
        behaviorHints: { notWebReady: true },
      },
    ],
  });
}

export const OPTIONS = addonOptions;
