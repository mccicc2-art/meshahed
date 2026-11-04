/**
 * ====== 🆕 استيرادُ Plex — تاريخُ المشاهدة من سيرفر البيت إلى سجلّات الاستيراد (أحمد ٤ نوفمبر «٣ أ») ======
 *
 * 🔑 **كلُّه في جهاز العضو، ودخولُه في Plex لا يصل خادمَنا**: التطبيقُ يطلب رمزاً قصيراً من plex.tv (`/api/v2/pins`)، والعضوُ
 * يكتبه في plex.tv/link، فيعود للتطبيق مفتاحٌ يقرأ به سيرفرَه **مرّةً واحدة** ثمّ يُنسى (لا يُحفظ في الجهاز ولا عندنا).
 * والسيرفرُ في البيت غالباً لا يصله الإنترنت أصلاً — والجوّالُ في البيت نفسِه يصله. فهذه الوحدةُ النقيّةُ تفهم ردودَ Plex،
 * وما تُخرجه سجلّاتُ الاستيراد نفسُها (`RawRecord`) يمرّ في المسار الواحد (`importRecords`) كملفِّ IMDb أو Letterboxd.
 *
 * ⚖️ **ما شوهد وحده**: `viewCount > 0`. وتاريخُه `lastViewedAt` (ثوانٍ) — آخرُ مشاهدةٍ لا أوّلُها، وهو ما يحفظه Plex.
 * ⚖️ **المطابقة**: رقمُ TMDB في `Guid` (`tmdb://`) يدخل بلا رحلة خادم؛ وبدونه IMDb للفيلم، والاسمُ والسنةُ لما سواه.
 * التقييمُ `userRating` من عشرة — مقياسُنا.
 */
import type { RawRecord } from "./importParse.ts";

export type PlexItem = {
  ratingKey?: string | number;
  type?: string;
  title?: string;
  year?: number;
  viewCount?: number;
  lastViewedAt?: number;
  userRating?: number;
  Guid?: { id?: string }[];
  grandparentRatingKey?: string | number;
  grandparentTitle?: string;
  parentIndex?: number;
  index?: number;
};

export type PlexServer = { name: string; token: string; uris: string[] };

/** موارد الحساب (`/api/v2/resources`) ⇐ سيراته بروابطها: المحلّيُّ أوّلاً (الجوّالُ في البيت)، ثمّ البعيد، ثمّ الوسيط (أبطأ) */
export function plexServersOf(resources: unknown): PlexServer[] {
  const out: PlexServer[] = [];
  for (const r of Array.isArray(resources) ? resources : []) {
    if (!r || typeof r !== "object") continue;
    const o = r as { name?: unknown; provides?: unknown; accessToken?: unknown; connections?: unknown };
    if (!String(o.provides ?? "").split(",").includes("server") || typeof o.accessToken !== "string") continue;
    const conns = (Array.isArray(o.connections) ? o.connections : []) as { uri?: unknown; local?: unknown; relay?: unknown }[];
    const rank = (c: { local?: unknown; relay?: unknown }) => (c.relay ? 2 : c.local ? 0 : 1);
    const uris = conns
      .filter((c) => typeof c.uri === "string" && /^https:\/\//.test(c.uri as string))
      .sort((a, b) => rank(a) - rank(b))
      .map((c) => String(c.uri).replace(/\/+$/, ""));
    if (uris.length) out.push({ name: String(o.name ?? "Plex"), token: o.accessToken, uris });
  }
  return out;
}

function guidsOf(item: PlexItem): { tmdb?: number; imdb?: string; tvdb?: number } {
  const out: { tmdb?: number; imdb?: string; tvdb?: number } = {};
  for (const g of item.Guid ?? []) {
    const m = String(g?.id ?? "").match(/^(tmdb|imdb|tvdb):\/\/(.+)$/);
    if (!m) continue;
    if (m[1] === "imdb" && /^tt\d{5,12}$/.test(m[2])) out.imdb ??= m[2];
    else if (m[1] !== "imdb") {
      const n = Number(m[2]);
      if (Number.isInteger(n) && n > 0) out[m[1] as "tmdb" | "tvdb"] ??= n;
    }
  }
  return out;
}

const atOf = (s: number | undefined) => (Number.isFinite(s) && (s as number) > 0 ? new Date((s as number) * 1000).toISOString() : undefined);
const ratingOf = (r: number | undefined) => (Number.isFinite(r) && (r as number) >= 1 ? Math.min(10, Math.round(r as number)) : undefined);
const seen = (i: PlexItem) => (i.viewCount ?? 0) > 0;

/** ما قرأه التطبيقُ من مكتبات السيرفر ⇐ سجلّاتُ الاستيراد */
export function plexRecordsOf(input: { movies: PlexItem[]; shows: PlexItem[]; episodes: PlexItem[] }): RawRecord[] {
  const out: RawRecord[] = [];

  for (const m of input.movies) {
    if (m.type && m.type !== "movie") continue;
    const rating = ratingOf(m.userRating);
    if (!seen(m) && rating == null) continue;
    const at = atOf(m.lastViewedAt);
    const g = guidsOf(m);
    const title = String(m.title ?? "").trim();
    if (g.tmdb) out.push({ kind: "tmdb-movie", tmdbId: g.tmdb, title, at, rating });
    else if (g.imdb) out.push({ kind: "imdb", imdb: g.imdb, media: "movie", name: title || g.imdb, role: "rated", rating, at });
    else if (title) out.push({ kind: "movie-name", name: title, year: m.year, at, rating });
  }

  const showByKey = new Map<string, PlexItem>();
  for (const s of input.shows) if (s.ratingKey != null) showByKey.set(String(s.ratingKey), s);

  /* الحلقاتُ تُجمع تحت مسلسلها — ومسلسلٌ برقم TMDB سجلٌّ واحدٌ بحلقاته (لا رحلةَ خادم) */
  const tmdbShows = new Map<number, Extract<RawRecord, { kind: "tmdb-show" }>>();
  const named = new Set<string>();
  for (const e of input.episodes) {
    if (!seen(e) || !Number.isInteger(e.parentIndex) || !Number.isInteger(e.index) || (e.index as number) < 1) continue;
    const show = e.grandparentRatingKey != null ? showByKey.get(String(e.grandparentRatingKey)) : undefined;
    const g = show ? guidsOf(show) : {};
    const ep = { s: e.parentIndex as number, e: e.index as number, at: atOf(e.lastViewedAt) };
    const title = String(show?.title ?? e.grandparentTitle ?? "").trim();
    if (g.tmdb) {
      const rec = tmdbShows.get(g.tmdb) ?? { kind: "tmdb-show" as const, tmdbId: g.tmdb, title, episodes: [], rating: ratingOf(show?.userRating) };
      rec.episodes.push(ep);
      tmdbShows.set(g.tmdb, rec);
    } else if (title) {
      out.push({ kind: "ep-name", show: title, year: show?.year, ...ep });
      named.add(title);
    }
  }
  out.push(...tmdbShows.values());

  /* تقييمُ مسلسلٍ بلا رقم TMDB — يُطابق بالاسم كأخيه في TV Time */
  for (const s of input.shows) {
    const rating = ratingOf(s.userRating);
    const title = String(s.title ?? "").trim();
    if (rating == null || !title || guidsOf(s).tmdb) continue;
    out.push({ kind: "rating-show", show: title, rating });
  }
  return out;
}

/** ترويساتُ Plex لكلِّ طلب — `Client-Identifier` ثابتٌ للجهاز (لا جهازٌ جديدٌ في حساب العضو مع كلِّ استيراد) */
export function plexHeaders(clientId: string, token?: string): Record<string, string> {
  return {
    Accept: "application/json",
    "X-Plex-Product": "Loopz",
    "X-Plex-Client-Identifier": clientId,
    ...(token ? { "X-Plex-Token": token } : {}),
  };
}
