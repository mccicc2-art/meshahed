import { File, Paths } from "expo-file-system";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient, write } from "../../api";
import { LINKS_KEY } from "../api";
import {
  buildShahidRecords,
  chunks,
  cwSnapshot,
  parsePlaylist,
  parseProgram,
  parseProgress,
  parseSeasonPlaylists,
  parseWatchingItems,
  programsToRead,
  SHAHID_EP,
  type ShahidBuild,
  type ShahidCwItem,
  type ShahidEpisode,
  type ShahidProgram,
  type ShahidProgress,
} from "@/core/shahid";
import type { DeviceLinksState, NetflixAddedList, NetflixLinkBody, PlatformLinkInfo, PlatformLinkResult } from "@/core/contracts/deviceLinks";
import type { NfxAdded, NfxLocal, SyncOutcome, SyncPhase } from "../netflix/sync";
import { platformAdded, importOrAsk } from "../netflix/sync";
import type { ShahidWebRef } from "./bridge";

/**
 * ====== 🆕 مزامنةُ شاهد — القراءةُ ثمّ المطابقةُ ثمّ الكتابة (المهمّة ٥٦٧) ======
 *
 * أختُ `osn/sync.ts` بقواعدها: مسارُ الاستيراد الواحد (`importRecords`، المصدرُ `shahid`)، وما قبل آخر مزامنة لا يُقرأ، وما دون ٩٠٪
 * «بدأته ولم تكمله». والفرقُ في القراءة وحدها (الفحص S0):
 * ١. «تابع المشاهدة» — الأعمالُ التي بدأها الملفّ. **بلا وقت**، فلقطتُها تُحفظ هنا (`cw`) ويُقرأ ما تغيّر منذها وحده.
 * ٢. كلُّ عملٍ يُقرأ ⇐ مواسمُه حتى موسم «تابع المشاهدة» ⇐ قوائمُ حلقات كلِّ موسم ⇐ معرّفاتُ الحلقات.
 * ٣. تقدُّمُ كلِّ حلقةٍ وفيلم (`event-logs`) مئةً مئة — وفيه وقتُ آخر مشاهدة، فيُطبَّق حدُّ آخر مزامنة.
 * طلبٌ بعد طلبٍ بفاصلٍ قصير — لا نُثقل على شاهد في الاستيراد الأوّل.
 */
const KEEP = 100;
const GAP_MS = 120;
/** أعمالٌ تُقرأ في المزامنة الواحدة على الأكثر — «تابع المشاهدة» قد يحمل أربعمئة */
const MAX_PROGRAMS = 150;

export type ShahidLocal = NfxLocal & { cw?: Record<string, string> };

const fileOf = (uid: string) => new File(Paths.document, `shahid-${uid.replace(/[^a-z0-9-]/gi, "")}.json`);

export function readShahidLocal(uid: string): ShahidLocal {
  try {
    const f = fileOf(uid);
    return f.exists ? (JSON.parse(f.textSync()) as ShahidLocal) : {};
  } catch {
    return {};
  }
}

export function writeShahidLocal(uid: string, patch: Partial<ShahidLocal>): ShahidLocal {
  const next = { ...readShahidLocal(uid), ...patch };
  try {
    const f = fileOf(uid);
    if (!f.exists) f.create();
    f.write(JSON.stringify(next));
  } catch {
    /* الملفُّ لصفوف «السجلّ» ولقطة «تابع المشاهدة» — فشلُه يعني قراءةً أوسعَ في المرّة القادمة، لا أكثر */
  }
  return next;
}

export function clearShahidLocal(uid: string): void {
  try {
    const f = fileOf(uid);
    if (f.exists) f.delete();
  } catch {
    /* لا شيء */
  }
}

export const SHAHID_ADDED_KEY = [...LINKS_KEY, "shahid-added"] as const;

export function useShahidAdded(enabled: boolean) {
  return useQuery({
    queryKey: SHAHID_ADDED_KEY,
    queryFn: async () => (await api<NetflixAddedList>("/api/v1/me/links/shahid")).data,
    enabled,
    staleTime: 30_000,
  });
}

export function shahidOf(d: DeviceLinksState | null | undefined): PlatformLinkInfo | null {
  return d?.platforms?.find((p) => p.platform === "shahid") ?? null;
}

const pause = () => new Promise((r) => setTimeout(r, GAP_MS));
const req = (o: object) => `request=${encodeURIComponent(JSON.stringify(o))}&country=SA`;

type LocalPartial = NonNullable<NfxLocal["partial"]>[number] & { id?: string; programId?: string };

export type ShahidRead = {
  cw: ShahidCwItem[];
  progress: ShahidProgress[];
  programs: Map<string, ShahidProgram>;
  episodes: Map<string, ShahidEpisode>;
  movieOf: Map<string, string>;
  recheck: Set<string>;
};

/**
 * يقرأ ما تغيّر منذ اللقطة السابقة (أو كلَّ «تابع المشاهدة» أوّلَ مرّة). `null`: الواجهةُ لم تُجب أوّلَ طلب؛ `"auth"`: انتهت الجلسة.
 * `prevCw`: لقطةُ آخر مزامنة — `null` تقرأ الكلّ. `partial`: ما كان «بدأته ولم تكمله»، تُعاد قراءةُ أعماله.
 */
export async function readShahid(
  web: ShahidWebRef,
  prevCw: Record<string, string> | null,
  stopped: () => boolean,
  pct?: (n: number) => void,
  partial: LocalPartial[] = [],
): Promise<ShahidRead | null | "auth"> {
  const first = await web.api(SHAHID_EP.watching, "page=0&size=400", true);
  if (first === "auth") return "auth";
  if (!first) return null;
  const cw = parseWatchingItems(first);
  const recheck = new Set(partial.map((p) => p.id).filter((x): x is string => !!x).slice(0, 100));
  const again = [...new Set(partial.map((p) => p.programId).filter((x): x is string => !!x))].slice(0, 30);
  const toRead = programsToRead(cw, prevCw, again).slice(0, MAX_PROGRAMS);
  const cwOf = new Map(cw.map((i) => [i.programId, i]));
  const programs = new Map<string, ShahidProgram>();
  const episodes = new Map<string, ShahidEpisode>();
  const movieOf = new Map<string, string>();

  for (let i = 0; i < toRead.length && !stopped(); i++) {
    const p = parseProgram(await web.api(SHAHID_EP.product, req({ id: toRead[i] }), false));
    await pause();
    if (!p) continue;
    programs.set(p.id, p);
    if (p.kind === "movie") {
      movieOf.set(p.id, p.id);
      const c = cwOf.get(p.id);
      if (c) movieOf.set(c.contentId, p.id);
      continue;
    }
    /* المواسمُ حتى موسم «تابع المشاهدة» — ما بعده لم يُبدأ */
    const upTo = cwOf.get(p.id)?.season ?? Math.max(0, ...p.seasons.map((s) => s.number));
    for (const s of p.seasons.filter((x) => x.number <= upTo)) {
      if (stopped()) break;
      const lists = parseSeasonPlaylists(await web.api(SHAHID_EP.product, req({ id: s.id }), false));
      await pause();
      /* القائمةُ الأولى تكفي حين تحمل الحلقات — الثانيةُ نسخةٌ (مجّانيّةٌ أو كاملة) للحلقات نفسِها */
      for (const list of lists) {
        let page = 0;
        let got = 0;
        for (;;) {
          const r = parsePlaylist(await web.api(SHAHID_EP.playlist, req({ pageNumber: page, pageSize: 100, playListId: list, sorts: [{ order: "ASC", type: "SORTDATE" }] }), false), p.id, s.number);
          await pause();
          for (const e of r.episodes) if (!episodes.has(e.assetId)) episodes.set(e.assetId, e);
          got += r.episodes.length;
          if (!r.more || stopped() || page > 20) break;
          page++;
        }
        if (got) break;
      }
    }
    pct?.(Math.round(((i + 1) / Math.max(1, toRead.length)) * 45));
  }

  const ids = [...new Set([...episodes.keys(), ...movieOf.keys()])];
  const progress: ShahidProgress[] = [];
  const parts = chunks(ids);
  for (let i = 0; i < parts.length && !stopped(); i++) {
    const r = await web.api(SHAHID_EP.progress, `request=${encodeURIComponent(JSON.stringify({ ids: parts[i].map(Number) }))}&pageNumber=0&pageSize=100&country=SAU`, true);
    if (r === "auth") return "auth";
    progress.push(...parseProgress(r).rows);
    pct?.(45 + Math.round(((i + 1) / parts.length) * 15));
    await pause();
  }
  return { cw, progress, programs, episodes, movieOf, recheck };
}

export function buildShahid(read: ShahidRead, after: number | null): ShahidBuild {
  return buildShahidRecords(read.progress, read.programs, read.episodes, read.movieOf, { after, recheck: read.recheck });
}

/** مزامنةٌ كاملة: يقرأ، ويطابق، ويكتب، ويختم — كـ`runOsnSync` */
export async function runShahidSync(
  web: ShahidWebRef,
  uid: string,
  after: number | null,
  hooks: { stopped: () => boolean; phase: (p: SyncPhase) => void; pct: (n: number) => void; auto?: boolean; ask?: boolean },
): Promise<SyncOutcome> {
  hooks.phase("reading");
  hooks.pct(0);
  const local = readShahidLocal(uid);
  /* لا حدَّ (أوّلُ مزامنةٍ أو «استيراد الكل») ⇐ كلُّ «تابع المشاهدة»؛ وإلّا ما تغيّر منذ لقطة آخر مزامنة */
  const read = await readShahid(web, after == null ? null : (local.cw ?? null), hooks.stopped, hooks.pct, (local.partial ?? []) as LocalPartial[]);
  if (read === "auth") return { ok: false, reason: "signed-out" };
  if (!read) return { ok: false, reason: "unreadable" };
  if (hooks.stopped()) return { ok: false, reason: "stopped" };
  const built = buildShahid(read, after);
  let episodes = 0;
  let movies = 0;
  let shows = 0;
  let unmatched: string[] = [];
  /* 🆕 T579 — المفتاحُ مطفأ (`hooks.ask`) ⇒ ما في السجلّ أسئلةُ «شاهدتها؟» لا كتابةٌ في المكتبة */
  let asked = 0;
  if (built.records.length) {
    const res = await importOrAsk("shahid", built.records, hooks);
    if (!res) return { ok: false, reason: "stopped" };
    episodes = res.episodes;
    movies = res.movies;
    shows = res.shows;
    unmatched = res.unmatched;
    asked = res.asked;
  }
  const newest = built.newest;
  /* ما سُئل عنه لم يدخل المكتبة — فلا سطرَ له في «ما دخل» */
  const added: NfxAdded[] = hooks.ask ? [] : built.records.flatMap((r): NfxAdded[] =>
    r.kind === "ep-name" ? [{ title: r.show, season: r.s, episode: r.e, at: r.at ?? "" }] : r.kind === "movie-name" ? [{ title: r.name, season: null, episode: null, at: r.at ?? "" }] : [],
  );
  const summary = platformAdded(added, episodes, movies, !!hooks.auto);
  try {
    await write<PlatformLinkResult>("/api/v1/me/links/shahid", {
      action: "sync",
      last_item_at: newest != null && (after == null || newest > after) ? new Date(newest).toISOString() : null,
      ...(summary ? { added: summary } : {}),
    } satisfies NetflixLinkBody);
  } catch {
    return { ok: false, reason: "server" };
  }
  const prev = readShahidLocal(uid);
  writeShahidLocal(uid, {
    expired: false,
    profile: false,
    cw: cwSnapshot(read.cw),
    added: [...added, ...(prev.added ?? [])].slice(0, KEEP),
    unmatched: [...new Set([...unmatched, ...(prev.unmatched ?? [])])].slice(0, KEEP),
    /* ما دخل المكتبة يخرج من «بدأته ولم تكمله»، وما أُعيد فحصُه ولم يكتمل لا يتكرّر */
    partial: [
      ...built.partial,
      ...((prev.partial ?? []) as LocalPartial[]).filter((p) => !p.id || (!built.recorded.includes(p.id) && !built.partial.some((x) => x.id === p.id))),
    ].slice(0, KEEP),
  });
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
  return { ok: true, episodes, movies, shows, newest, added: summary, asked, stats: { items: read.cw.length, rec: built.records.length, part: built.partial.length, skip: built.skipped, unm: unmatched.length } };
}

export async function linkShahid(profileLabel: string, importAll: boolean): Promise<void> {
  await write<PlatformLinkResult>("/api/v1/me/links/shahid", { action: "link", profile_label: profileLabel, import_all: importAll } satisfies NetflixLinkBody);
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
}

export async function unlinkShahid(): Promise<void> {
  await write<PlatformLinkResult>("/api/v1/me/links/shahid", { action: "revoke" } satisfies NetflixLinkBody);
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
}
