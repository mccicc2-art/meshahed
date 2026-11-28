import { File, Paths } from "expo-file-system";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient, write } from "../../api";
import { LINKS_KEY } from "../api";
import { buildPrimeRecords, parsePrimeDetail, parsePrimeHistory, primePagesToRead, PRIME_HISTORY_PATH, type PrimeBuild, type PrimeDetail, type PrimeHistoryItem } from "@/core/prime";
import type { DeviceLinksState, NetflixAddedList, NetflixLinkBody, PlatformLinkInfo, PlatformLinkResult } from "@/core/contracts/deviceLinks";
import type { NfxAdded, NfxLocal, SyncOutcome, SyncPhase } from "../netflix/sync";
import { platformAdded, importOrAsk } from "../netflix/sync";
import type { PrimeWebRef } from "./bridge";

/**
 * ====== 🆕 مزامنةُ برايم فيديو — القراءةُ ثمّ المطابقةُ ثمّ الكتابة (المهمّة ٦٠٤) ======
 *
 * أختُ `shahid/sync.ts` بقواعدها: مسارُ الاستيراد الواحد (`importOrAsk`، المصدرُ `prime`)، وما قبل آخر مزامنة لا يُقرأ، وما دون ٩٠٪
 * «بدأته ولم تكمله». والفرقُ في القراءة وحدها (الفحص S0، `core/prime.ts`):
 * ١. صفحةُ «سجلّ المشاهدة» — أعمالٌ بحلقاتها وأوقاتها. **الوقتُ فيها** فلا لقطةَ تُحفظ: ما بعد آخر مزامنة وحدَه يُقرأ.
 * ٢. صفحةُ كلِّ عملٍ فيه جديد ⇒ اسمُ المسلسل والموسم والسنة، ولكلِّ حلقةٍ رقمُها وحالُ تشغيلها (اكتملت · بنسبتها).
 * صفحةٌ بعد صفحةٍ بفاصلٍ قصير — لا نُثقل على برايم في الاستيراد الأوّل.
 */
const KEEP = 100;
const GAP_MS = 250;
/** صفحاتُ أعمالٍ تُقرأ في المزامنة الواحدة على الأكثر */
const MAX_PAGES = 60;

export type PrimeLocal = NfxLocal;

const fileOf = (uid: string) => new File(Paths.document, `prime-${uid.replace(/[^a-z0-9-]/gi, "")}.json`);

export function readPrimeLocal(uid: string): PrimeLocal {
  try {
    const f = fileOf(uid);
    return f.exists ? (JSON.parse(f.textSync()) as PrimeLocal) : {};
  } catch {
    return {};
  }
}

export function writePrimeLocal(uid: string, patch: Partial<PrimeLocal>): PrimeLocal {
  const next = { ...readPrimeLocal(uid), ...patch };
  try {
    const f = fileOf(uid);
    if (!f.exists) f.create();
    f.write(JSON.stringify(next));
  } catch {
    /* الملفُّ لصفوف «السجلّ» على الجهاز — فشلُه يعني صفوفاً أقلّ هناك، لا أكثر */
  }
  return next;
}

export function clearPrimeLocal(uid: string): void {
  try {
    const f = fileOf(uid);
    if (f.exists) f.delete();
  } catch {
    /* لا شيء */
  }
}

export const PRIME_ADDED_KEY = [...LINKS_KEY, "prime-added"] as const;

export function usePrimeAdded(enabled: boolean) {
  return useQuery({
    queryKey: PRIME_ADDED_KEY,
    queryFn: async () => (await api<NetflixAddedList>("/api/v1/me/links/prime")).data,
    enabled,
    staleTime: 30_000,
  });
}

export function primeOf(d: DeviceLinksState | null | undefined): PlatformLinkInfo | null {
  return d?.platforms?.find((p) => p.platform === "prime") ?? null;
}

const pause = () => new Promise((r) => setTimeout(r, GAP_MS));

type LocalPartial = NonNullable<NfxLocal["partial"]>[number] & { id?: string; path?: string };

export type PrimeRead = { items: PrimeHistoryItem[]; pages: Map<string, PrimeDetail>; recheck: Set<string> };

/**
 * يقرأ السجلَّ ثمّ صفحاتِ ما فيه جديدٌ بعد `after` (وصفحاتِ ما كان «بدأته ولم تكمله» ليُعاد فحصُه). `null`: الصفحةُ لم تُجب؛
 * `"auth"`: انتهت الجلسة. صفحةُ عملٍ لم تُجب تُسقط أعمالَها من هذه المزامنة وحدها (تُقرأ في التالية).
 */
export async function readPrime(
  web: PrimeWebRef,
  after: number | null,
  stopped: () => boolean,
  pct?: (n: number) => void,
  partial: LocalPartial[] = [],
): Promise<PrimeRead | null | "auth"> {
  const first = await web.page(PRIME_HISTORY_PATH);
  if (first === "auth") return "auth";
  if (!first || first.kind !== "history") return null;
  const items = parsePrimeHistory(first.groups);
  const again = partial.map((p) => p.path).filter((p): p is string => typeof p === "string");
  const toRead = primePagesToRead(items, after, again).slice(0, MAX_PAGES);
  const pages = new Map<string, PrimeDetail>();
  for (let i = 0; i < toRead.length; i++) {
    if (stopped()) return null;
    const r = await web.page(toRead[i]);
    if (r === "auth") return "auth";
    const d = r && r.kind === "detail" ? parsePrimeDetail(r) : null;
    if (d) pages.set(toRead[i], d);
    pct?.(Math.round(((i + 1) / Math.max(1, toRead.length)) * 100));
    await pause();
  }
  const recheck = new Set(partial.map((p) => p.id).filter((x): x is string => typeof x === "string"));
  return { items, pages, recheck };
}

export function buildPrime(read: PrimeRead, after: number | null): PrimeBuild {
  return buildPrimeRecords(read.items, read.pages, { after, recheck: read.recheck });
}

/** مزامنةٌ كاملة: يقرأ، ويطابق، ويكتب، ويختم — كـ`runOsnSync` */
export async function runPrimeSync(
  web: PrimeWebRef,
  uid: string,
  after: number | null,
  hooks: { stopped: () => boolean; phase: (p: SyncPhase) => void; pct: (n: number) => void; auto?: boolean; ask?: boolean },
): Promise<SyncOutcome> {
  hooks.phase("reading");
  hooks.pct(0);
  const local = readPrimeLocal(uid);
  /* لا حدَّ (أوّلُ مزامنةٍ أو «استيراد الكل») ⇐ السجلُّ كلُّه؛ وإلّا ما بعد آخر مزامنة */
  const read = await readPrime(web, after, hooks.stopped, hooks.pct, (local.partial ?? []) as LocalPartial[]);
  if (read === "auth") return { ok: false, reason: "signed-out" };
  if (!read) return { ok: false, reason: "unreadable" };
  if (hooks.stopped()) return { ok: false, reason: "stopped" };
  const built = buildPrime(read, after);
  let episodes = 0;
  let movies = 0;
  let shows = 0;
  let unmatched: string[] = [];
  /* 🆕 T579 — المفتاحُ مطفأ (`hooks.ask`) ⇒ ما في السجلّ أسئلةُ «شاهدتها؟» لا كتابةٌ في المكتبة */
  let asked = 0;
  if (built.records.length) {
    const res = await importOrAsk("prime", built.records, hooks);
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
    await write<PlatformLinkResult>("/api/v1/me/links/prime", {
      action: "sync",
      last_item_at: newest != null && (after == null || newest > after) ? new Date(newest).toISOString() : null,
      ...(summary ? { added: summary } : {}),
    } satisfies NetflixLinkBody);
  } catch {
    return { ok: false, reason: "server" };
  }
  const prev = readPrimeLocal(uid);
  writePrimeLocal(uid, {
    expired: false,
    profile: false,
    added: [...added, ...(prev.added ?? [])].slice(0, KEEP),
    unmatched: [...new Set([...unmatched, ...(prev.unmatched ?? [])])].slice(0, KEEP),
    /* ما دخل المكتبة يخرج من «بدأته ولم تكمله»، وما أُعيد فحصُه ولم يكتمل لا يتكرّر */
    partial: [
      ...built.partial,
      ...((prev.partial ?? []) as LocalPartial[]).filter((p) => !p.id || (!built.recorded.includes(p.id) && !built.partial.some((x) => x.id === p.id))),
    ].slice(0, KEEP),
  });
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
  return { ok: true, episodes, movies, shows, newest, added: summary, asked, stats: { items: read.items.length, rec: built.records.length, part: built.partial.length, skip: built.skipped, unm: unmatched.length } };
}

export async function linkPrime(profileLabel: string, importAll: boolean): Promise<void> {
  await write<PlatformLinkResult>("/api/v1/me/links/prime", { action: "link", profile_label: profileLabel, import_all: importAll } satisfies NetflixLinkBody);
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
}

export async function unlinkPrime(): Promise<void> {
  await write<PlatformLinkResult>("/api/v1/me/links/prime", { action: "revoke" } satisfies NetflixLinkBody);
  await queryClient.invalidateQueries({ queryKey: LINKS_KEY });
}
