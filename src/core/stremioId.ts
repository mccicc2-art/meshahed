/**
 * ====== 🆕 معرّفُ الفيديو في Stremio ⇢ عملٌ وحلقة (خطّةُ Stremio، ٢٢ أكتوبر) ======
 *
 * Stremio يطلب مصادرَ التشغيل بـ`/stream/{type}/{videoId}.json`. الفيلمُ `tt1234567`، وحلقةُ المسلسل
 * `tt1234567:{season}:{episode}` (Cinemeta — توثيقُ SDK الرسميّ: `tt3107288:1:1` الموسمُ ١ الحلقةُ ١).
 * 🔑 **وما سوى ذلك ليس لنا**: `tmdb:` ومعرّفاتُ الإضافات الأخرى تُرفض — رفضٌ لا تخمين، فلا تُسجَّل إشارةٌ على عملٍ خاطئ.
 * والحدودُ حدودُ `rateEpisode` نفسُها (٠–١٠٠٠ · ١–٢٠٠٠٠). و`kitsu:` (أنمي كتالوج Kitsu) له محلّلُه أدناه (`parseStremioRef`).
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
 * 🆕 **أنمي كتالوج Kitsu** (أحمد ٢٢ أكتوبر «نبني دعم كيتسو» — شغّل Bleach من المستكشف ولم يظهر سطرُنا): إضافةُ
 * «Anime Kitsu» تسمّي الفيلمَ `kitsu:{id}` والحلقةَ `kitsu:{id}:{episode}` — **ورقمُ الحلقة رقمُ Kitsu لا رقمُ الموسم**
 * (Kitsu يعطي كلَّ موسمٍ معرّفاً مستقلّاً تبدأ حلقاتُه من ١). فالمحلّلُ يقرأ الشكلَ وحدَه، والترجمةُ إلى عملٍ وحلقةٍ في TMDB
 * على الخادم (`resolveStremioRef`) — لأنها تحتاج بيانَ Kitsu وTMDB معاً.
 */
export type StremioRef = StremioVideo | { kind: "kitsu"; kitsu: number; episode: number | null };

const KITSU = /^kitsu:(\d{1,9})(?::(\d{1,5}))?$/;

export function parseStremioRef(type: string, rawId: string): StremioRef | null {
  const video = parseStremioVideo(type, rawId);
  if (video) return video;
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    return null;
  }
  const m = KITSU.exec(id.replace(/\.json$/i, ""));
  if (!m) return null;
  const kitsu = Number(m[1]);
  if (kitsu < 1) return null;
  /* الفيلمُ بلا حلقة، والمسلسلُ بحلقة — والعكسُ رفض: لا نخمّن أيَّ حلقةٍ قصدها.
     🆕 R71 — **Stremio يطلب أنمي كتالوج Kitsu بالنوع `anime`** لا `series` (Torrentio يعلن `anime` لهذا؛ R70 لم يُعلنه فلم
     يُسأل قطّ — تجربةُ أحمد). وفي `anime` الشكلُ وحدَه يفرّق: بحلقةٍ مسلسل، وبلا حلقةٍ فيلم */
  if (type === "anime") return m[2] === undefined ? { kind: "kitsu", kitsu, episode: null } : episodeRef(kitsu, m[2]);
  if (type === "movie") return m[2] === undefined ? { kind: "kitsu", kitsu, episode: null } : null;
  if (type !== "series" || m[2] === undefined) return null;
  return episodeRef(kitsu, m[2]);
}

function episodeRef(kitsu: number, raw: string): StremioRef | null {
  const episode = Number(raw);
  return episode >= 1 && episode <= 20_000 ? { kind: "kitsu", kitsu, episode } : null;
}

/**
 * 🆕 **طلبُ الترجمة** (`/subtitles/{type}/{id}[/{extra}].json`): التوثيقُ يقول المعرّفُ معرّفُ الفيديو في SDK الحديث، وبصمةُ
 * OpenSubtitles في وصف البروتوكول القديم — ومعه `videoID` في الإضافات. فنجرّب المعرّفَ أوّلاً ثمّ `videoID`، وما سواهما رفض.
 */
export function parseSubtitlesVideo(type: string, parts: string[]): StremioRef | null {
  if (!parts.length || parts.length > 2) return null;
  const strip = (x: string) => x.replace(/\.json$/i, "");
  const direct = parseStremioRef(type, strip(parts[0]));
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
  return vid ? parseStremioRef(type, vid) : null;
}

/** رمزُ ربط Stremio: `ls_` + ٤٣ محرفاً (٣٢ بايتاً base64url) — يُفحص شكلُه قبل أيِّ نداءٍ للقاعدة */
export const STREMIO_TOKEN_RE = /^ls_[A-Za-z0-9_-]{43}$/;
