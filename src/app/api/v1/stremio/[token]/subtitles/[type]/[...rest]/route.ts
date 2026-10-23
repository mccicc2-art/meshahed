import { after, type NextRequest } from "next/server";
import { resolveStremioRef, traceRejected } from "@/lib/stremioResolve";
import { recordStremioSignal, stremioOwner } from "@/lib/stremio";
import { allow } from "@/core/ratelimit";
import { STREMIO_TOKEN_RE, parseSubtitlesVideo } from "@/core/stremioId";
import { addonJson, addonOptions } from "../../../../addon";

export const dynamic = "force-dynamic";

const EMPTY = { subtitles: [] as unknown[] };

/**
 * `GET /api/v1/stremio/{token}/subtitles/{type}/{id}[/{extra}].json` — 🆕 **«شغّلها»** (أحمد ٢٢ أكتوبر «أ مع ج»).
 *
 * 🔑 Stremio يطلب الترجماتِ من إضافاتها حين يبدأ المشغّلُ تشغيلَ مصدر — لا حين تُفتح صفحةُ الحلقة. فطلبٌ هنا يختم الإشارةَ
 * بـ`played_at`، والرئيسيّةُ لا تسأل إلّا عن المختومة. **لا نقدّم ترجمةً واحدة** (`{subtitles: []}`): المشغّلُ يأخذ ترجماتِ
 * إضافاته الأخرى كأنّنا لم نكن. وتمامُ المشاهدة لا يصلنا — Stremio لا يُخبر الإضافاتِ به — فالسؤالُ «شفتها؟» باقٍ.
 * ⚖️ صمتٌ لكلِّ ما ليس لنا، والتسجيلُ بعد الردّ (`after`) كمسار المصادر.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string; type: string; rest: string[] }> }) {
  const { token, type, rest } = await ctx.params;
  if (!STREMIO_TOKEN_RE.test(token)) return addonJson(EMPTY);
  if (!allow(`stremio-sub:${token.slice(0, 16)}`, 60, 60_000)) return addonJson(EMPTY);
  const ref = parseSubtitlesVideo(type, rest ?? []);
  if (!ref) return traceRejected(type, (rest ?? []).join("/")), addonJson(EMPTY);
  /* A-17 (المدقّق ٢٣ أكتوبر) — المالكُ أوّلاً ثمّ الترجمة: رمزٌ مجهولٌ أو غيرُ مشتركٍ لا يكلّفنا طلباً واحداً لـTMDB أو Kitsu.
     كانا متوازيَين فصار كلُّ رمزٍ صحيحِ الشكل يُطلق عملاً خارجيّاً؛ والثمنُ على العضو المشترك استعلامُ قاعدةٍ واحدٌ قبل الترجمة */
  const owner = await stremioOwner(token);
  if (!owner?.plus) return addonJson(EMPTY);
  const hit = await resolveStremioRef(ref);
  if (!hit) return addonJson(EMPTY);
  after(() => recordStremioSignal(owner.userId, hit.video, hit.tmdbId, true));
  return addonJson(EMPTY);
}

export const OPTIONS = addonOptions;
