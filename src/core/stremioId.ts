/**
 * ====== 🆕 معرّفُ الفيديو في Stremio ⇢ عملٌ وحلقة (خطّةُ Stremio، ٢٢ أكتوبر) ======
 *
 * Stremio يطلب مصادرَ التشغيل بـ`/stream/{type}/{videoId}.json`. الفيلمُ `tt1234567`، وحلقةُ المسلسل
 * `tt1234567:{season}:{episode}` (Cinemeta — توثيقُ SDK الرسميّ: `tt3107288:1:1` الموسمُ ١ الحلقةُ ١).
 * 🔑 **وما سوى ذلك ليس لنا**: `kitsu:` (أنمي) و`tmdb:` ومعرّفاتُ الإضافات الأخرى تُرفض في النسخة الأولى — رفضٌ لا تخمين،
 * فلا تُسجَّل إشارةٌ على عملٍ خاطئ. والحدودُ حدودُ `rateEpisode` نفسُها (٠–١٠٠٠ · ١–٢٠٠٠٠).
 */
export type StremioVideo =
  | { kind: "movie"; imdb: string }
  | { kind: "tv"; imdb: string; season: number; episode: number };

const IMDB = /^tt\d{5,10}$/;

export function parseStremioVideo(type: string, rawId: string): StremioVideo | null {
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    return null;
  }
  id = id.replace(/\.json$/i, "");
  if (id.length > 40) return null;
  if (type === "movie") return IMDB.test(id) ? { kind: "movie", imdb: id } : null;
  if (type !== "series") return null;
  const parts = id.split(":");
  if (parts.length !== 3 || !IMDB.test(parts[0])) return null;
  if (!/^\d{1,5}$/.test(parts[1]) || !/^\d{1,5}$/.test(parts[2])) return null;
  const season = Number(parts[1]);
  const episode = Number(parts[2]);
  if (season > 1000 || episode < 1 || episode > 20_000) return null;
  return { kind: "tv", imdb: parts[0], season, episode };
}

/**
 * 🆕 **طلبُ الترجمة** (`/subtitles/{type}/{id}[/{extra}].json`): التوثيقُ يقول المعرّفُ معرّفُ الفيديو في SDK الحديث، وبصمةُ
 * OpenSubtitles في وصف البروتوكول القديم — ومعه `videoID` في الإضافات. فنجرّب المعرّفَ أوّلاً ثمّ `videoID`، وما سواهما رفض.
 */
export function parseSubtitlesVideo(type: string, parts: string[]): StremioVideo | null {
  if (!parts.length || parts.length > 2) return null;
  const strip = (x: string) => x.replace(/\.json$/i, "");
  const direct = parseStremioVideo(type, strip(parts[0]));
  if (direct) return direct;
  if (parts.length !== 2) return null;
  let extra = "";
  try {
    extra = decodeURIComponent(strip(parts[1]));
  } catch {
    return null;
  }
  if (extra.length > 2000) return null;
  const vid = new URLSearchParams(extra).get("videoID") ?? new URLSearchParams(extra).get("videoId");
  return vid ? parseStremioVideo(type, vid) : null;
}

/** رمزُ ربط Stremio: `ls_` + ٤٣ محرفاً (٣٢ بايتاً base64url) — يُفحص شكلُه قبل أيِّ نداءٍ للقاعدة */
export const STREMIO_TOKEN_RE = /^ls_[A-Za-z0-9_-]{43}$/;
