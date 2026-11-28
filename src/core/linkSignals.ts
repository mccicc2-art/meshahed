/**
 * ====== أسطرُ الجرس من الربوط — الجملةُ والوجهة، قاعدةٌ واحدةٌ للويب والتطبيق (المهمّة ٥٦١) ======
 *
 * 🔑 **لماذا ليست `SignalRow`**: سطرُ الجرس هناك فعلُ شخصٍ (صورتُه واسمُه في الجملة)، وهنا لا شخص — ما وصل من تطبيقٍ مربوط.
 * فالحمولةُ تحملها بجانب `rows` (`links`، الهجرة ٢٦٩ `my_link_signals`) والنسخةُ التي لا تعرفها لا تراها.
 *
 * نوعان (أحمد ٢٦ نوفمبر «١أ»):
 *  - `link_added` — ما دخل المكتبة: دفعةُ نتفليكس أو OSN+، أو ما سجّله Loopz بنفسه من Kodi وأخواته.
 *  - `link_ask` — سؤالٌ «شاهدتها؟» شُغِّل في Stremio أو Nuvio (أو سيرفرٍ لا يسجّل بلا سؤال) — يُجاب من الجرس نفسِه.
 */
import type { Dict } from "./i18n.ts";

export type LinkSource = "netflix" | "osn" | "shahid" | "prime" | "stremio" | "nuvio" | "plex" | "jellyfin" | "emby" | "kodi";
export type LinkSignalKind = "link_added" | "link_ask";

/** ⚠️ «OSN+» يتبعها LRM (U+200E): في جملةٍ عربيّة تُقرأ «+OSN» بلاه — «+» حرفٌ محايدٌ يلتصق بالعربيّ بعده */
export const LINK_SOURCE_NAME: Record<LinkSource, string> = {
  netflix: "Netflix",
  osn: "OSN+\u200E",
  /* 🆕 المهمّة ٥٦٧ — «شاهد» اسمٌ عربيّ: يُكتب بلغة القارئ (`linkSourceName`)، وهذا للإنجليزيّة */
  shahid: "Shahid",
  prime: "Prime Video",
  stremio: "Stremio",
  nuvio: "Nuvio",
  plex: "Plex",
  jellyfin: "Jellyfin",
  emby: "Emby",
  kodi: "Kodi",
};

const SOURCES = Object.keys(LINK_SOURCE_NAME) as LinkSource[];

/** اسمُ المصدر في الجملة — شاهد بلغة القارئ («شاهد» · «Shahid»)، والباقي أسماءُ منتجاتٍ لا تُترجم */
export function linkSourceName(source: LinkSource, t: Dict): string {
  return source === "shahid" ? t.shahidName : LINK_SOURCE_NAME[source];
}

export type LinkSignalRow = {
  kind: LinkSignalKind;
  source: LinkSource;
  mediaType: "tv" | "movie" | null;
  tmdbId: number | null;
  /** اسمُ العمل: من المنصّة (نتفليكس · OSN+) أو من المكتبة أو من TMDB — `null` إن غاب كلُّه */
  title: string | null;
  /** كم عملاً في الدفعة — «٤ حلقات، منها Dark» حين يزيد على واحد */
  works: number;
  season: number | null;
  episode: number | null;
  episodes: number;
  movies: number;
  /** معرّفُ السؤال في `watch_signals` — للجواب من الجرس (`link_ask` وحده) */
  signalId: number | null;
  at: string;
  isNew: boolean;
};

const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);

/** صفُّ `my_link_signals` ⇢ سطرٌ — وما لا يُعرف مصدرُه أو نوعُه يسقط (خادمٌ أحدث من هذه النسخة) */
export function parseLinkRow(raw: unknown): LinkSignalRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind === "link_added" || o.kind === "link_ask" ? o.kind : null;
  const source = SOURCES.find((s) => s === o.source) ?? null;
  if (!kind || !source || typeof o.at !== "string") return null;
  const signalId = int(o.signal_id);
  if (kind === "link_ask" && signalId == null) return null;
  return {
    kind,
    source,
    mediaType: o.media_type === "tv" || o.media_type === "movie" ? o.media_type : null,
    tmdbId: int(o.tmdb_id),
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 200) : null,
    works: Math.max(1, int(o.works) ?? 1),
    season: int(o.season),
    episode: int(o.episode),
    episodes: Math.max(0, int(o.episodes) ?? 0),
    movies: Math.max(0, int(o.movies) ?? 0),
    signalId,
    at: o.at,
    isNew: o.is_new === true,
  };
}

/** «S3 E4» — كما يكتبها إشعارُ «وصل من Kodi» وبطاقةُ «من أجهزتك» */
export function linkEpisodeLabel(season: number | null, episode: number | null): string {
  return season != null && episode != null ? `S${season} E${episode}` : "";
}

/** العددُ بالكلمات: «٤ حلقات وفيلم» */
export function linkCountText(r: Pick<LinkSignalRow, "episodes" | "movies">, t: Dict): string {
  const eps = r.episodes > 0 ? t.linkEpisodes(r.episodes) : "";
  const mvs = r.movies > 0 ? t.linkMovies(r.movies) : "";
  return eps && mvs ? t.linkAnd(eps, mvs) : eps || mvs;
}

/**
 * ما وصل بلا اسم المنصّة — للجرس («أُضيفت من X: …») ولإشعار الجوال («أضفنا … لمكتبتك»):
 *  - حلقةٌ واحدة: «Dark · S1 E3»
 *  - حلقاتٌ من عملٍ واحد: «٤ حلقات من Dark»
 *  - أكثرُ من عمل: «٤ حلقات وفيلم، منها Dark»
 *  - فيلمٌ واحد: «Dark»
 */
export function linkWhat(r: Pick<LinkSignalRow, "title" | "works" | "season" | "episode" | "episodes" | "movies">, t: Dict): string {
  const count = linkCountText(r, t);
  if (!r.title) return count;
  if (r.works > 1) return t.linkAmong(count, r.title);
  if (r.episodes + r.movies <= 1) {
    const ep = linkEpisodeLabel(r.season, r.episode);
    return ep && r.episodes === 1 ? `${r.title} · ${ep}` : r.title;
  }
  return t.linkCountOf(count, r.title);
}

/** جملةُ السطر كاملة */
export function linkSignalText(r: LinkSignalRow, t: Dict): string {
  const app = linkSourceName(r.source, t);
  if (r.kind === "link_ask") {
    if (!r.title) return t.linkAskUntitled(app);
    const ep = linkEpisodeLabel(r.season, r.episode);
    return r.mediaType === "movie" || !ep ? t.linkAskMovie(r.title, app) : t.linkAsk(r.title, ep, app);
  }
  return t.linkAdded(app, linkWhat(r, t));
}

/**
 * الوجهة: صفحةُ العمل حين يُعرف (سيرفرُ البيت · السؤال)، وإلّا لا وجهةَ في الويب — دفعةُ نتفليكس وOSN+ بلا معرّف عمل،
 * والتطبيقُ يفتح شاشةَ المنصّة نفسَها («ما وصل») بنفسه.
 */
export function linkSignalHref(r: LinkSignalRow): string | null {
  if (r.tmdbId && r.mediaType) return `/${r.mediaType === "tv" ? "show" : "movie"}/${r.tmdbId}`;
  return null;
}

/** بالأحدث أوّلاً — لدمج الأسطر مع أسطر الأشخاص في قائمةٍ واحدة */
export function mergeByTime<A extends { at: string }, B extends { at: string }>(a: A[], b: B[]): (A | B)[] {
  return [...a, ...b].sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
}
