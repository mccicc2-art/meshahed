import { File, Paths } from "expo-file-system";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient, write } from "../../api";
import { importRecords } from "../../settings/importPipeline";
import { LINKS_KEY } from "../api";
import {
  buildOsnRecords,
  chunks,
  OSN_EP,
  parseBookmarks,
  parseMovies,
  parseSeasonEpisodes,
  parseSeries,
  seriesToRead,
  type OsnBookmark,
  type OsnBuild,
  type OsnEpisode,
  type OsnMovie,
  type OsnSeries,
} from "@/core/osn";
import type { DeviceLinksState, NetflixAddedList, NetflixLinkBody, PlatformLinkInfo, PlatformLinkResult } from "@/core/contracts/deviceLinks";
import type { NfxAdded, NfxLocal, SyncOutcome, SyncPhase } from "../netflix/sync";
import type { OsnWebRef } from "./bridge";

/**
 * ====== 🆕 مزامنةُ OSN+ — القراءةُ ثمّ المطابقةُ ثمّ الكتابة (المهمّة ٥٥٧) ======
 *
 * أختُ `netflix/sync.ts` بقواعدها: **مسارُ الاستيراد الواحد** (`importRecords`، «ما في Loopz يبقى»، المصدرُ `osn`)، وما قبل آخر
 * مزامنة لا يُقرأ، وما دون ٩٠٪ «بدأته ولم تكمله». والفرقُ في القراءة وحدها (الفحص S0):
 * ١. علاماتُ ما بدأه الملفّ (`get-latest-bookmarks`) — مسلسلاتٌ وأفلام.
 * ٢. المسلسلاتُ التي فيها جديدٌ ⇐ مواسمُها (`get-series`) ⇐ حلقاتُ كلِّ موسم (`get-episodes-by-season`) ⇐ علامةُ كلِّ حلقة (`get-bookmarks`).
 * ٣. الأفلامُ ⇐ أسماؤها وسنواتُها (`get-movies`).
 * خمسون معرّفاً في الطلب، واحداً بعد الآخر بفاصلٍ قصير — لا نُثقل على OSN+ في الاستيراد الأوّل.
 */
const KEEP = 100;
const GAP_MS = 120;

const fileOf = (uid: string) => new File(Paths.document, `osn-${uid.replace(/[^a-z0-9-]/gi, "")}.json`);

export function readOsnLocal(uid: string): NfxLocal {
  try {
    const f = fileOf(uid);
    return f.exists ? (JSON.parse(f.textSync()) as NfxLocal) : {};
  } catch {
    return {};
  }
}

export function writeOsnLocal(uid: string, patch: Partial<NfxLocal>): NfxLocal {
  const next = { ...readOsnLocal(uid), ...patch };
  try {
    const f = fileOf(uid);
    if (!f.exists) f.create();
    f.write(JSON.stringify(next));
  } catch {
    /* الملفُّ لصفوف «السجلّ» وحدها — فشلُه لا يوقف المزامنة */
  }
  return next;
}

export function clearOsnLocal(uid: string): void {
  try {
    const f = fileOf(uid);
    if (f.exists) f.delete();
  } catch {
    /* لا شيء */
  }
}

export const OSN_ADDED_KEY = [...LINKS_KEY, "osn-added"] as const;

export function useOsnAdded(enabled: boolean) {
  return useQuery({
    queryKey: OSN_ADDED_KEY,
    queryFn: async () => (await api<NetflixAddedList>("/api/v1/me/links/osn")).data,
    enabled,
    staleTime: 30_000,
  });
}

export function osnOf(d: DeviceLinksState | null | undefined): PlatformLinkInfo | null {
  return d?.platforms?.find((p) => p.platform === "osn") ?? null;
}

const pause = () => new Promise((r) => setTimeout(r, GAP_MS));

export type OsnRead = { latest: OsnBookmark[]; bookmarks: OsnBookmark[]; series: Map<string, OsnSeries>; episodes: Map<string, OsnEpisode>; movies: Map<string, OsnMovie>; recheck: Set<string> };

/** 🆕 المهمّة ٥٥٩ — صفُّ «بدأته ولم تكمله» بمعرّفه في OSN+ (الصفوفُ الأقدم بلا معرّفٍ تبقى للعرض وحده) */
type OsnLocalPartial = NfxLocal["partial"] extends (infer P)[] | undefined ? P & { id?: string } : never;
const idsOf = (rows: NfxLocal["partial"]): string[] => [...new Set((rows ?? []).map((p) => (p as OsnLocalPartial).id).filter((x): x is string => !!x))];

/**
 * يقرأ ما بعد الحدّ كلَّه. `null`: الواجهةُ لم تُجب أوّلَ طلب (صفحةٌ لم تجهز)؛ `"auth"`: انتهت الجلسة.
 * ⚖️ الحلقاتُ تُقرأ لكلِّ مسلسلٍ فيه جديد — لا آخرُ حلقةٍ وحدها: من شاهد خمس حلقاتٍ منذ آخر مزامنة تدخل الخمس.
 */
export async function readOsn(web: OsnWebRef, after: number | null, stopped: () => boolean, pct?: (n: number) => void, recheckIds: string[] = []): Promise<OsnRead | null | "auth"> {
  const first = await web.api(OSN_EP.latest, {});
  if (first === "auth") return "auth";
  if (!first) return null;
  const latest = parseBookmarks(first);
  /* 🆕 المهمّة ٥٥٩ — ما كان «بدأته ولم تكمله» يُسأل عنه من جديد بمعرّفه، فإن بلغ ٩٠٪ دخل — مهما كان وقتُ علامته */
  const recheck = new Set(recheckIds.slice(0, 100));
  const again: OsnBookmark[] = [];
  for (const part of chunks([...recheck])) {
    if (stopped()) break;
    again.push(...parseBookmarks(await web.api(OSN_EP.bookmarks, { contentIds: part })));
    await pause();
  }
  const keep = (b: OsnBookmark) => after == null || b.at > after || recheck.has(b.id);
  const fresh = latest.filter((b) => after == null || b.at > after);
  const seriesIds = [...new Set([...seriesToRead(latest, after), ...again.filter((b) => b.kind === "episode" && b.seriesId).map((b) => b.seriesId as string)])];
  const movieIds = [...new Set([...fresh, ...again].filter((b) => b.kind === "movie").map((b) => b.id))];
  const series = new Map<string, OsnSeries>();
  const episodes = new Map<string, OsnEpisode>();
  const movies = new Map<string, OsnMovie>();
  const bookmarks: OsnBookmark[] = [...fresh, ...again].filter((b) => b.kind === "movie");

  for (const part of chunks(seriesIds)) {
    if (stopped()) break;
    for (const [id, s] of parseSeries(await web.api(OSN_EP.series, { contentIds: part }))) series.set(id, s);
    await pause();
  }
  pct?.(15);
  const seasonIds = [...new Set([...series.values()].flatMap((s) => [...s.seasons.keys()]))];
  for (const part of chunks(seasonIds, 20)) {
    if (stopped()) break;
    for (const [id, e] of parseSeasonEpisodes(await web.api(OSN_EP.seasons, { seasonContentIds: part }))) episodes.set(id, e);
    await pause();
  }
  pct?.(35);
  const epIds = [...episodes.keys()];
  const parts = chunks(epIds);
  for (let i = 0; i < parts.length && !stopped(); i++) {
    bookmarks.push(...parseBookmarks(await web.api(OSN_EP.bookmarks, { contentIds: parts[i] })).filter(keep));
    pct?.(35 + Math.round(((i + 1) / parts.length) * 25));
    await pause();
  }
  for (const part of chunks(movieIds)) {
    if (stopped()) break;
    for (const [id, m] of parseMovies(await web.api(OSN_EP.movies, { contentIds: part }))) movies.set(id, m);
    await pause();
  }
  return { latest, bookmarks, series, episodes, movies, recheck };
}

export function buildOsn(read: OsnRead, after: number | null): OsnBuild {
  return buildOsnRecords(read.bookmarks, read.series, read.episodes, read.movies, { after, recheck: read.recheck });
}

/** مزامنةٌ كاملة: يقرأ، ويطابق، ويكتب، ويختم — كـ`runNetflixSync` */
export async function runOsnSync(
  web: OsnWebRef,
  uid: string,
  after: number | null,
  hooks: { stopped: () => boolean; phase: (p: SyncPhase) => void; pct: (n: number) => void },
): Promise<SyncOutcome> {
  hooks.phase("reading");
  hooks.pct(0);
  const read = await readOsn(web, after, hooks.stopped, hooks.pct, idsOf(readOsnLocal(uid).partial));
  if (read === "auth") return { ok: false, reason: "signed-out" };
  if (!read) return { ok: false, reason: "unreadable" };
  if (hooks.stopped()) return { ok: false, reason: "stopped" };
  const built = buildOsn(read, after);
  let episodes = 0;
  let movies = 0;
  let shows = 0;
  let unmatched: string[] = [];
  if (built.records.length) {
    const res = await importRecords(built.records, hooks, { keep: true, writeSource: "osn" });
    if (!res) return { ok: false, reason: "stopped" };
    episodes = res.episodes;
    movies = res.movies;
    shows = res.shows;
    unmatched = res.unmatched;
  }
  const newest = built.newest ?? read.latest.reduce<number | null>((m, b) => (b.at > 0 && (m == null || b.at > m) ? b.at : m), null);
  try {
    await write<PlatformLinkResult>("/api/v1/me/links/osn", { action: "sync", last_item_at: newest != null && (after == null || newest > after) ? new Date(newest).toISOString() : null } satisfies NetflixLinkBody);
  } catch {
    return { ok: false, reason: "server" };
  }
  const prev = readOsnLocal(uid);
  const added: NfxAdded[] = built.records.flatMap((r): NfxAdded[] =>
    r.kind === "ep-name" ? [{ title: r.show, season: r.s, episode: r.e, at: r.at ?? "" }] : r.kind === "movie-name" ? [{ title: r.name, season: null, episode: null, at: r.at ?? "" }] : [],
  );
  writeOsnLocal(uid, {
    expired: false,
    profile: false,
    added: [...added, ...(prev.added ?? [])].slice(0, KEEP),
    unmatched: [...new Set([...unmatched, ...(prev.unmatched ?? [])])].slice(0, KEEP),
    /* 🆕 المهمّة ٥٥٩ — ما دخل المكتبة يخرج من القائمة، وما أُعيد فحصه ولم يكتمل لا يتكرّر */
    partial: [
      ...built.partial,
      ...(prev.partial ?? []).filter((p) => {
        const id = (p as OsnLocalPartial).id;
        return !id || (!built.recorded.includes(id) && !built.partial.some((x) => x.id === id));
      }),
    ].slice(0, KEEP),
  });
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
  return { ok: true, episodes, movies, shows, newest, stats: { items: read.bookmarks.length, rec: built.records.length, part: built.partial.length, skip: built.skipped, unm: unmatched.length } };
}

export async function linkOsn(profileLabel: string, importAll: boolean): Promise<void> {
  await write<PlatformLinkResult>("/api/v1/me/links/osn", { action: "link", profile_label: profileLabel, import_all: importAll } satisfies NetflixLinkBody);
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
}

export async function unlinkOsn(): Promise<void> {
  await write<PlatformLinkResult>("/api/v1/me/links/osn", { action: "revoke" } satisfies NetflixLinkBody);
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
}
