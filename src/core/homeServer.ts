/**
 * ====== 🆕 سيرفراتُ البيت — ما يرسله Plex وJellyfin وEmby حين تنتهي حلقةٌ أو فيلم (هجرة ٢٣٥) ======
 *
 * 🔑 **رابطٌ واحدٌ يقبله الثلاثة** (`/api/v1/home-server/<token>`): لكلٍّ شكلُه، فيُعرف من الجسم نفسِه لا من الرابط —
 * - **Plex** (Plex Pass): `multipart/form-data` حقلُه `payload` (JSON)، وحدثُ الانتهاء `media.scrobble` (٩٠٪).
 *   `Metadata.Guid` معرّفاتُ **العنصر نفسِه**: للفيلم فيلمُه، وللحلقة حلقتُها (`imdb://` · `tvdb://` · `tmdb://` للحلقة لا للمسلسل).
 * - **Jellyfin** (إضافة Webhook المجانيّة): JSON **بالقالب الذي نعطيه** (`JELLYFIN_TEMPLATE`)، وحدثُ الانتهاء
 *   `PlaybackStop` مع `PlayedToCompletion`. ويُقبل أيضاً بأسماء متغيّراتها نفسِها لمن كتب قالبَه بيده.
 * - **Emby** (Premiere): JSON — أو `multipart` حقلُه `data` في الإصدارات الأقدم — وحدثُه `playback.stop` مع
 *   `PlaybackInfo.PlayedToCompletion`، أو `item.markplayed` (علّمها في Emby بيده).
 *
 * ⚖️ **«انتهى» وحده يُسجَّل** (`finished`) — والتسجيلُ سؤالٌ لا تعليم («٢ أ»): العضوُ يجيب «شفتها؟» في الرئيسيّة.
 * ⚖️ **وحدةٌ نقيّة** بلا شبكة: المطابقةُ مع TMDB في `lib/homeServer.ts`.
 */

export type HomeServer = "plex" | "jellyfin" | "emby";
export const HOME_SERVERS: readonly HomeServer[] = ["plex", "jellyfin", "emby"];

/** رمزُ رابط سيرفرات البيت: `lh_` + ٤٣ محرفاً (٣٢ بايتاً base64url) — شكلُ رمز Stremio بسابقةٍ أخرى */
export const HOME_SERVER_TOKEN_RE = /^lh_[A-Za-z0-9_-]{43}$/;

export type HomeIds = { tmdb?: number; imdb?: string; tvdb?: number };

export type HomeEvent = {
  server: HomeServer;
  kind: "movie" | "episode";
  finished: boolean;
  /** اسمُ الفيلم، أو اسمُ المسلسل للحلقة — للبحث بالاسم حين لا معرّف */
  title: string;
  year?: number;
  /** معرّفاتُ العنصر نفسِه (الفيلم أو الحلقة) */
  ids: HomeIds;
  season?: number;
  episode?: number;
};

/**
 * 🔑 **قالبُ Jellyfin الذي ينسخه العضو** إلى «Generic Destination» — متغيّراتُ إضافة Webhook كما تسمّيها.
 * والمفتاحُ `server` يجعل الجسمَ يعرّف نفسه.
 */
export const JELLYFIN_TEMPLATE =
  '{"server":"jellyfin","event":"{{NotificationType}}","completed":"{{PlayedToCompletion}}","type":"{{ItemType}}","name":"{{Name}}","series":"{{SeriesName}}","year":"{{Year}}","season":"{{SeasonNumber}}","episode":"{{EpisodeNumber}}","tmdb":"{{Provider_tmdb}}","imdb":"{{Provider_imdb}}","tvdb":"{{Provider_tvdb}}"}';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const int = (v: unknown): number | undefined => {
  const t = str(v);
  if (!t) return undefined; // «{{Provider_tmdb}}» فارغاً ليس صفراً
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= 1_000_000_000 ? n : undefined;
};
/** معرّفٌ خارجيٌّ: موجبٌ وحده — الصفرُ «لا معرّف» */
const extId = (v: unknown) => {
  const n = int(v);
  return n && n > 0 ? n : undefined;
};
const yes = (v: unknown) => v === true || /^(true|1|yes)$/i.test(str(v));
const imdbOf = (v: unknown) => {
  const s = str(v);
  return /^tt\d{5,12}$/.test(s) ? s : undefined;
};
/** مفتاحٌ بلا اعتبارٍ لحالة الحروف — قوالبُ Jellyfin يكتبها الناسُ بأيديهم */
const pick = (o: Obj, ...keys: string[]) => {
  const lower = new Map(Object.keys(o).map((k) => [k.toLowerCase(), k]));
  for (const k of keys) {
    const hit = lower.get(k.toLowerCase());
    const v = hit != null ? o[hit] : undefined;
    if (v != null && !(typeof v === "string" && v.trim() === "")) return v;
  }
  return undefined;
};

/** `Guid` في Plex: `[{id:"imdb://tt…"},{id:"tmdb://123"},{id:"tvdb://456"}]` */
function plexIds(guids: unknown): HomeIds {
  const out: HomeIds = {};
  for (const g of Array.isArray(guids) ? guids : []) {
    const id = str(isObj(g) ? g.id : g);
    const m = id.match(/^(imdb|tmdb|tvdb):\/\/(.+)$/);
    if (!m) continue;
    if (m[1] === "imdb") out.imdb ??= imdbOf(m[2]);
    else if (m[1] === "tmdb") out.tmdb ??= extId(m[2]);
    else out.tvdb ??= extId(m[2]);
  }
  return out;
}

function fromPlex(p: Obj): HomeEvent | null {
  const md = isObj(p.Metadata) ? p.Metadata : null;
  if (!md) return null;
  const type = str(md.type);
  if (type !== "episode" && type !== "movie") return null;
  const ev = str(p.event);
  return {
    server: "plex",
    kind: type,
    finished: ev === "media.scrobble",
    title: type === "episode" ? str(md.grandparentTitle) : str(md.title),
    year: type === "movie" ? int(md.year) : undefined,
    ids: plexIds(md.Guid),
    season: type === "episode" ? int(md.parentIndex) : undefined,
    episode: type === "episode" ? int(md.index) : undefined,
  };
}

function fromJellyfin(p: Obj): HomeEvent | null {
  const type = str(pick(p, "type", "ItemType")).toLowerCase();
  if (type !== "episode" && type !== "movie") return null;
  const ev = str(pick(p, "event", "NotificationType")).toLowerCase();
  return {
    server: "jellyfin",
    kind: type,
    finished: ev === "playbackstop" && yes(pick(p, "completed", "PlayedToCompletion")),
    title: type === "episode" ? str(pick(p, "series", "SeriesName")) : str(pick(p, "name", "Name")),
    year: type === "movie" ? int(pick(p, "year", "Year")) : undefined,
    ids: { tmdb: extId(pick(p, "tmdb", "Provider_tmdb")), imdb: imdbOf(pick(p, "imdb", "Provider_imdb")), tvdb: extId(pick(p, "tvdb", "Provider_tvdb")) },
    season: type === "episode" ? int(pick(p, "season", "SeasonNumber")) : undefined,
    episode: type === "episode" ? int(pick(p, "episode", "EpisodeNumber")) : undefined,
  };
}

function fromEmby(p: Obj): HomeEvent | null {
  const item = isObj(p.Item) ? p.Item : null;
  if (!item) return null;
  const type = str(item.Type).toLowerCase();
  if (type !== "episode" && type !== "movie") return null;
  const ev = str(p.Event).toLowerCase();
  const info = isObj(p.PlaybackInfo) ? p.PlaybackInfo : {};
  const prov = isObj(item.ProviderIds) ? item.ProviderIds : {};
  return {
    server: "emby",
    kind: type,
    finished: ev === "item.markplayed" || (ev === "playback.stop" && yes(info.PlayedToCompletion)),
    title: type === "episode" ? str(item.SeriesName) : str(item.Name),
    year: type === "movie" ? int(item.ProductionYear) : undefined,
    ids: { tmdb: extId(pick(prov, "Tmdb")), imdb: imdbOf(pick(prov, "Imdb")), tvdb: extId(pick(prov, "Tvdb")) },
    season: type === "episode" ? int(item.ParentIndexNumber) : undefined,
    episode: type === "episode" ? int(item.IndexNumber) : undefined,
  };
}

/** الجسمُ (بعد فكِّ JSON) ⇐ حدثٌ نفهمه، أو `null` لما ليس لنا (حدثُ تشغيلٍ لموسيقى، اختبارُ اتّصال، شكلٌ مجهول) */
export function parseHomeEvent(body: unknown): HomeEvent | null {
  if (!isObj(body)) return null;
  if (isObj(body.Metadata) && typeof body.event === "string") return fromPlex(body);
  if (isObj(body.Item) && typeof body.Event === "string") return fromEmby(body);
  if (str(body.server).toLowerCase() === "jellyfin" || pick(body, "NotificationType") != null) return fromJellyfin(body);
  return null;
}
