import { File, Paths } from "expo-file-system";
import { api, queryClient, write } from "../../api";
import { importRecords, type ImportPhase } from "../../settings/importPipeline";
import { LINKS_KEY } from "../api";
import {
  buildNetflixRecords,
  historyRequest,
  mergeSeasonPages,
  moviesRequest,
  moviesToFetch,
  NETFLIX_MOVIES_PER_REQUEST,
  parseMovieProgress,
  parseSeasonEpisodes,
  parseViewingHistory,
  seasonRequest,
  seasonsToFetch,
  type NetflixMovieProgress,
  type NetflixPartial,
  type NetflixSeason,
  type NetflixViewing,
} from "@/core/netflix";
import { useQuery } from "@tanstack/react-query";
import type { DeviceLinksState, NetflixAddedList, NetflixLinkBody, PlatformLinkInfo, PlatformLinkResult } from "@/core/contracts/deviceLinks";
import type { NetflixWebRef, NfxReady } from "./bridge";

/**
 * ====== 🆕 مزامنةُ نتفليكس — القراءةُ ثمّ المطابقةُ ثمّ الكتابة (خطّة `PLAN-NETFLIX-SYNC.md`) ======
 *
 * 🔑 **مسارُ الاستيراد الواحد** (D-145): السجلُّ يُقرأ صفحةً صفحة من الأحدث، ويتوقّف عند آخر مزامنة (أو «من الآن فقط»)، والمواسمُ
 * تُطلب مرّةً لكلِّ موسم (ثلاثةً معاً — لا نُثقل على نتفليكس في الاستيراد الأوّل الطويل)، ثمّ `importRecords` كملفّات IMDb وPlex
 * بحرفها: «ما في Loopz يبقى» (`keep`) والمصدرُ `netflix`. ثمّ يُختم الربطُ على الخادم بأحدث مشاهدةٍ قُرئت.
 *
 * ما يبقى على الجهاز وحده (`netflix-<id>.json`): انتهاءُ الجلسة (الخادمُ لا يعرف جلسةَ نتفليكس أصلاً)، وآخرُ ما دخل، وما لم
 * يُطابَق، وما لم يبلغ ٩٠٪ — لصفوف «السجلّ» في صفحة نتفليكس. مئةٌ من كلٍّ على الأكثر.
 */
export const SYNC_EVERY_MS = 6 * 3_600_000;
const PAGE = 100;
const MAX_PAGES = 60;
const SEASON_PAGE = 50;
const SEASON_PAR = 3;
const KEEP = 100;

export type NfxAdded = { title: string; season: number | null; episode: number | null; at: string };
export type NfxLocal = {
  expired?: boolean;
  /** 🆕 T552 — نتفليكس سألت «مَن يشاهد؟» بدل السجلّ: لا ملفَّ مختاراً — «اختر ملفك من جديد» في صفحة نتفليكس */
  profile?: boolean;
  added?: NfxAdded[];
  unmatched?: string[];
  partial?: NetflixPartial[];
};

const fileOf = (uid: string) => new File(Paths.document, `netflix-${uid.replace(/[^a-z0-9-]/gi, "")}.json`);

export function readLocal(uid: string): NfxLocal {
  try {
    const f = fileOf(uid);
    return f.exists ? (JSON.parse(f.textSync()) as NfxLocal) : {};
  } catch {
    return {};
  }
}

export function writeLocal(uid: string, patch: Partial<NfxLocal>): NfxLocal {
  const next = { ...readLocal(uid), ...patch };
  try {
    const f = fileOf(uid);
    if (!f.exists) f.create();
    f.write(JSON.stringify(next));
  } catch {
    /* الملفُّ لصفوف «السجلّ» وحدها — فشلُه لا يوقف المزامنة */
  }
  return next;
}

export function clearLocal(uid: string): void {
  try {
    const f = fileOf(uid);
    if (f.exists) f.delete();
  } catch {
    /* لا شيء */
  }
}

/** 🆕 T552 — «ما دخل» من الخادم. المفتاحُ تحت `me:links` فيُسقطه كلُّ ما يُسقط حالَ الربط (مزامنةٌ · ربطٌ · فكّ) */
export const NETFLIX_ADDED_KEY = [...LINKS_KEY, "netflix-added"] as const;

export function useNetflixAdded(enabled: boolean) {
  return useQuery({
    queryKey: NETFLIX_ADDED_KEY,
    queryFn: async () => (await api<NetflixAddedList>("/api/v1/me/links/netflix")).data,
    enabled,
    staleTime: 30_000,
  });
}

/** الحدُّ الذي لا يُقرأ ما قبله: «من الآن فقط» أو آخرُ مزامنة — أيُّهما أحدث */
export function afterOf(p: Pick<PlatformLinkInfo, "since_at" | "last_item_at"> | null | undefined): number | null {
  const a = p?.since_at ? Date.parse(p.since_at) : NaN;
  const b = p?.last_item_at ? Date.parse(p.last_item_at) : NaN;
  const v = Math.max(Number.isNaN(a) ? -Infinity : a, Number.isNaN(b) ? -Infinity : b);
  return Number.isFinite(v) ? v : null;
}

export function netflixOf(d: DeviceLinksState | null | undefined): PlatformLinkInfo | null {
  return d?.platforms?.find((p) => p.platform === "netflix") ?? null;
}

/** حانت المزامنةُ الصامتة؟ — مربوطٌ شغّال، وآخرُ مزامنةٍ قبل ستّ ساعات أو لم تكن */
export function syncDue(p: PlatformLinkInfo | null, now = Date.now()): boolean {
  if (!p || p.stopped) return false;
  const last = p.synced_at ? Date.parse(p.synced_at) : NaN;
  return Number.isNaN(last) || now - last >= SYNC_EVERY_MS;
}

/** السجلُّ من الأحدث، حتى الحدّ — وصفحاتُه مئةٌ مئة */
export async function readHistory(web: NetflixWebRef, ready: NfxReady, after: number | null): Promise<NetflixViewing[] | null> {
  if (!ready.historyId) return null;
  const out: NetflixViewing[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const json = await web.gql(historyRequest(ready.historyId, ready.guid, PAGE, cursor));
    if (!json) return i === 0 ? null : out;
    const page = parseViewingHistory(json);
    out.push(...page.items);
    const oldest = page.items.at(-1)?.at;
    if (!page.hasNext || !page.next || (after != null && oldest != null && oldest <= after)) break;
    cursor = page.next;
  }
  return out;
}

async function readSeason(web: NetflixWebRef, id: string, seasonId: number): Promise<NetflixSeason | null> {
  let season: NetflixSeason | null = null;
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const page = parseSeasonEpisodes(await web.gql(seasonRequest(id, seasonId, SEASON_PAGE, cursor)));
    if (!page) break;
    season = season ? mergeSeasonPages(season, page) : page;
    if (!page.hasNext || !page.next) break;
    cursor = page.next;
  }
  return season;
}

export async function readSeasons(web: NetflixWebRef, ready: NfxReady, items: NetflixViewing[], stopped: () => boolean): Promise<Map<number, NetflixSeason>> {
  const out = new Map<number, NetflixSeason>();
  if (!ready.seasonId) return out;
  const queue = seasonsToFetch(items);
  const worker = async () => {
    while (queue.length && !stopped()) {
      const id = queue.shift() as number;
      const s = await readSeason(web, ready.seasonId as string, id);
      if (s) out.set(id, s);
      await new Promise((r) => setTimeout(r, 120));
    }
  };
  await Promise.all(Array.from({ length: SEASON_PAR }, worker));
  return out;
}

/** 🆕 تقدّمُ الأفلام — أربعون فيلماً في الطلب، واحداً بعد الآخر. ما لم يُجب يبقى «بدأته» (`buildNetflixRecords`) لا يُخمَّن */
export async function readMovies(web: NetflixWebRef, ready: NfxReady, items: NetflixViewing[], stopped: () => boolean): Promise<Map<number, NetflixMovieProgress>> {
  const out = new Map<number, NetflixMovieProgress>();
  if (!ready.moviesId) return out;
  const ids = moviesToFetch(items);
  for (let i = 0; i < ids.length && !stopped(); i += NETFLIX_MOVIES_PER_REQUEST) {
    const part = parseMovieProgress(await web.gql(moviesRequest(ready.moviesId, ids.slice(i, i + NETFLIX_MOVIES_PER_REQUEST))));
    for (const [id, p] of part) out.set(id, p);
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}

export type SyncPhase = "reading" | ImportPhase;
export type SyncOutcome =
  | { ok: true; episodes: number; movies: number; shows: number; newest: number | null; stats?: SyncStats }
  | { ok: false; reason: "signed-out" | "profile" | "unreadable" | "server" | "stopped" };

/** 🆕 T552 — أعدادُ المزامنة لعلامة الأداء `nfx.sync`: ما قُرئ · ما بُني صفوفاً · بدأه ولم يكمله · لم يُفهم · لم يُطابَق */
export type SyncStats = { items: number; rec: number; part: number; skip: number; unm: number };

/**
 * مزامنةٌ كاملة على صفحة `/settings/viewed` الجاهزة: يقرأ، ويطابق، ويكتب، ويختم. `uid` لملفّ الجهاز.
 * ⚖️ ما بعد آخر مزامنة وحده — و«آخرُ مشاهدةٍ قُرئت» تُختم حتى إن لم يدخل شيء (مشاهداتٌ ناقصة): المزامنةُ التالية لا تعيد قراءتها.
 */
export async function runNetflixSync(
  web: NetflixWebRef,
  ready: NfxReady,
  uid: string,
  after: number | null,
  hooks: { stopped: () => boolean; phase: (p: SyncPhase) => void; pct: (n: number) => void },
): Promise<SyncOutcome> {
  hooks.phase("reading");
  hooks.pct(0);
  const items = await readHistory(web, ready, after);
  if (!items) return { ok: false, reason: "unreadable" };
  const fresh = after == null ? items : items.filter((i) => i.at > after);
  const seasons = await readSeasons(web, ready, fresh, hooks.stopped);
  const progress = await readMovies(web, ready, fresh, hooks.stopped);
  if (hooks.stopped()) return { ok: false, reason: "stopped" };
  const built = buildNetflixRecords(fresh, seasons, progress, { after });
  let episodes = 0;
  let movies = 0;
  let shows = 0;
  let unmatched: string[] = [];
  if (built.records.length) {
    const res = await importRecords(built.records, hooks, { keep: true, writeSource: "netflix" });
    if (!res) return { ok: false, reason: "stopped" };
    episodes = res.episodes;
    movies = res.movies;
    shows = res.shows;
    unmatched = res.unmatched;
  }
  const newest = built.newest ?? (items[0]?.at ?? null);
  try {
    await write<PlatformLinkResult>("/api/v1/me/links/netflix", { action: "sync", last_item_at: newest != null && (after == null || newest > after) ? new Date(newest).toISOString() : null } satisfies NetflixLinkBody);
  } catch {
    return { ok: false, reason: "server" };
  }
  /* صفوفُ «السجلّ» على الجهاز: الأحدثُ أوّلاً، مئةٌ من كلٍّ */
  const prev = readLocal(uid);
  const added: NfxAdded[] = built.records.flatMap((r): NfxAdded[] =>
    r.kind === "ep-name" ? [{ title: r.show, season: r.s, episode: r.e, at: r.at ?? "" }] : r.kind === "movie-name" ? [{ title: r.name, season: null, episode: null, at: r.at ?? "" }] : [],
  );
  writeLocal(uid, {
    expired: false,
    profile: false,
    added: [...added, ...(prev.added ?? [])].slice(0, KEEP),
    unmatched: [...new Set([...unmatched, ...(prev.unmatched ?? [])])].slice(0, KEEP),
    partial: [...built.partial, ...(prev.partial ?? [])].slice(0, KEEP),
  });
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
  return { ok: true, episodes, movies, shows, newest, stats: { items: fresh.length, rec: built.records.length, part: built.partial.length, skip: built.skipped, unm: unmatched.length } };
}

/** الربطُ على الخادم بعد سؤال الاستيراد — `import_all`: «استيراد الكل»؛ وإلّا «من الآن فقط» */
export async function linkNetflix(profileLabel: string, importAll: boolean): Promise<void> {
  await write<PlatformLinkResult>("/api/v1/me/links/netflix", { action: "link", profile_label: profileLabel, import_all: importAll } satisfies NetflixLinkBody);
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
}

export async function unlinkNetflix(): Promise<void> {
  await write<PlatformLinkResult>("/api/v1/me/links/netflix", { action: "revoke" } satisfies NetflixLinkBody);
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
}

/** حالُ الربط من الخادم مباشرةً — للمضيف خارج الشاشات (لا يعتمد على كاشٍ قد يكون قديماً) */
export async function fetchLinks(): Promise<DeviceLinksState | null> {
  try {
    return (await api<DeviceLinksState>("/api/v1/me/links")).data;
  } catch {
    return null;
  }
}
