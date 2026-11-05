import "server-only";
import { issueLinkToken, linkOwner, linkStateOf, recordSignal, revokeLinkToken } from "@/lib/linkTokens";
import { findByExternalId, searchByName } from "@/lib/tmdb";
import { HOME_SERVER_TOKEN_RE, KODI_TOKEN_RE, type HomeEvent } from "@/core/homeServer";

/**
 * ====== 🆕 سيرفراتُ البيت — الرابطُ والمطابقةُ والتسجيل (هجرة ٢٣٥) ======
 *
 * 🔑 **رابطٌ واحدٌ لكلِّ عضو للسيرفرات الثلاثة** (`home_server_links`) بقواعد رابط Stremio نفسِها (`linkTokens.ts`):
 * يظهر مرّةً واحدة، و«رابطٌ جديد» يُسقط القديم، ويموت إن نام ٩٠ يوماً، ولـLoopz+ وحده («ونعم فقط للمشتركين»).
 *
 * ⚖️ **المطابقة بالمعرّف أوّلاً** ثمّ بالاسم:
 * - الفيلم: رقمُ TMDB كما هو ⇐ IMDb ⇐ الاسمُ والسنة.
 * - الحلقة: IMDb الحلقة ⇐ TVDB الحلقة (كلاهما يعيد المسلسلَ وموسمَ الحلقة ورقمَها في TMDB) ⇐ اسمُ المسلسل مع الموسم والحلقة
 *   كما أرسلهما السيرفر. ورقمُ TMDB للحلقة لا يُبحث به: `/find` لا يقبله.
 * والخطأُ هنا ثمنُه سؤالٌ يُجاب بـ✕ — لا حلقةٌ تُعلَّم (السؤالُ قبل التعليم، «٢ أ»).
 */

export async function issueHomeServerToken(userId: string) {
  return issueLinkToken("home_server_links", "lh_", userId);
}
export async function revokeHomeServerToken(userId: string) {
  return revokeLinkToken("home_server_links", userId);
}
export async function homeServerLinkOf(userId: string) {
  return linkStateOf("home_server_links", userId);
}
export async function homeServerOwner(token: string) {
  /* 🆕 هجرة ٢٣٦ — البابُ واحدٌ والجدولُ من سابقة الرمز: `lk_` رابطُ Kodi، و`lh_` رابطُ السيرفرات الثلاثة */
  if (KODI_TOKEN_RE.test(token)) return linkOwner("kodi_links", token, KODI_TOKEN_RE);
  return linkOwner("home_server_links", token, HOME_SERVER_TOKEN_RE);
}
export async function kodiLinkOf(userId: string) {
  return linkStateOf("kodi_links", userId);
}
export async function revokeKodiToken(userId: string) {
  return revokeLinkToken("kodi_links", userId);
}

export type HomeHit = { kind: "tv" | "movie"; tmdbId: number; season: number | null; episode: number | null };

export async function resolveHomeEvent(ev: HomeEvent): Promise<HomeHit | null> {
  if (ev.kind === "movie") {
    if (ev.ids.tmdb) return { kind: "movie", tmdbId: ev.ids.tmdb, season: null, episode: null };
    if (ev.ids.imdb) {
      const m = (await findByExternalId(ev.ids.imdb, "imdb_id"))?.movie_results?.[0];
      if (m) return { kind: "movie", tmdbId: m.id, season: null, episode: null };
    }
    if (!ev.title) return null;
    const hit = await searchByName(ev.title.slice(0, 200), "movie", ev.year);
    return hit ? { kind: "movie", tmdbId: hit.id, season: null, episode: null } : null;
  }

  /* 🆕 Kodi — مكتبتُه تعرف المسلسلَ نفسَه: رقمُه في TMDB مع موسم الحلقة ورقمها كما في المكتبة (ترقيمُ TMDB في سكرابر Kodi الافتراضيّ) */
  if (ev.series?.tmdb && ev.season != null && ev.episode) return { kind: "tv", tmdbId: ev.series.tmdb, season: ev.season, episode: ev.episode };
  for (const [id, source] of [
    [ev.series?.imdb, "imdb_id"],
    [ev.series?.tvdb, "tvdb_id"],
  ] as const) {
    if (!id || ev.season == null || !ev.episode) continue;
    const show = (await findByExternalId(String(id), source))?.tv_results?.[0];
    if (show) return { kind: "tv", tmdbId: show.id, season: ev.season, episode: ev.episode };
  }
  for (const [id, source] of [
    [ev.ids.imdb, "imdb_id"],
    [ev.ids.tvdb, "tvdb_id"],
  ] as const) {
    if (!id) continue;
    const ep = (await findByExternalId(String(id), source))?.tv_episode_results?.[0];
    if (ep?.show_id && Number.isInteger(ep.season_number) && Number.isInteger(ep.episode_number) && ep.episode_number >= 1) {
      return { kind: "tv", tmdbId: ep.show_id, season: ep.season_number, episode: ep.episode_number };
    }
  }
  if (!ev.title || ev.season == null || !ev.episode) return null;
  const show = await searchByName(ev.title.slice(0, 200), "tv");
  return show ? { kind: "tv", tmdbId: show.id, season: ev.season, episode: ev.episode } : null;
}

/** يُسجَّل «أنهاها في سيرفره» سؤالاً منتظراً (`played` = نعم: انتهى، فهو يُعرض فوراً) — صامتٌ إن فشل */
export async function recordHomeSignal(userId: string, ev: HomeEvent, hit: HomeHit) {
  return recordSignal(userId, ev.server, hit.kind, hit.tmdbId, hit.season, hit.episode, true);
}
