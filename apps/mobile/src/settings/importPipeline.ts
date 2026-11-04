import { api, write } from "../api";
import { groupForResolve, type RawRecord } from "@/core/importParse";
import { buildImport, IMPORT_CHUNK } from "@/core/importBuild";
import type { ImportPayload, ResolveRequest, ResolveResult } from "@/core/importer";

/**
 * ====== 🆕 مسارُ الاستيراد بعد القراءة — المطابقةُ ثمّ التجميعُ ثمّ الكتابة ======
 *
 * 🔑 **قارئان لمسارٍ واحد** (D-145): شاشةُ الاستيراد (ملفّاتُ التصدير) واستيرادُ Plex (تاريخُ المشاهدة من سيرفر البيت، هجرة ٢٣٥).
 * كان المسارُ داخل `ImportScreen` بحرفه؛ ونسخةٌ ثانيةٌ منه في شاشة Plex كانت ستفترق عند أوّل إصلاحٍ في الدفعات أو الختام.
 * ⚖️ **المطابقةُ على الخادم** (مفتاحُ TMDB لا يغادره) **والكتابةُ دفعاتٍ صغيرة** يتقدّم بها الشريط، وما كُتب قبل «إيقاف» باقٍ —
 * والختامُ (`finish`) يُنادى حتى بعد الإيقاف: ما كُتب في المكتبة فعلاً والشاشاتُ يجب أن تراه.
 */
export type ImportPhase = "matching" | "writing";
export type ImportResult = { shows: number; episodes: number; movies: number; lists: number; listsSkipped: number; unmatched: string[] };

export async function importRecords(
  records: RawRecord[],
  hooks: { stopped: () => boolean; phase: (p: ImportPhase) => void; pct: (n: number) => void },
): Promise<ImportResult | null> {
  // ===== المطابقة — ما وصل بمعرّف TMDB لا يمرّ من هنا (D-154) =====
  hooks.phase("matching");
  const { requests, keys } = groupForResolve(records);
  const resolved = new Map<string, ResolveResult>();
  for (let i = 0; i < requests.length; i += IMPORT_CHUNK.resolve) {
    if (hooks.stopped()) return null;
    const slice: ResolveRequest[] = requests.slice(i, i + IMPORT_CHUNK.resolve);
    /* `api` لا `write`: المطابقةُ قراءةٌ بجسم — لا وسومَ تُبطَل */
    const out = (await api<{ results: ResolveResult[] }>("/api/v1/me/import/resolve", { method: "POST", body: { requests: slice } })).data.results;
    out.forEach((r, n) => resolved.set(keys[i + n], r));
    hooks.pct(Math.round(((i + slice.length) / requests.length) * 100));
  }

  const { shows, movies, lists, unmatched } = buildImport(records, resolved);

  // ===== الكتابة =====
  hooks.phase("writing");
  hooks.pct(0);
  let sC = 0;
  let eC = 0;
  let mC = 0;
  let lC = 0;
  let lSkip = 0;
  const steps =
    Math.ceil(shows.length / IMPORT_CHUNK.shows) + Math.ceil(movies.length / IMPORT_CHUNK.movies) + Math.ceil(lists.length / IMPORT_CHUNK.lists) || 1;
  let step = 0;
  /* `lists*` اختياريّان في الردّ: خادمٌ أقدمُ من هذا التطبيق لا يعيدهما (ولن تصله قوائم أصلاً) */
  const apply = async (payload: ImportPayload) =>
    (await api<{ shows: number; episodes: number; movies: number; lists?: number; listsSkipped?: number }>("/api/v1/me/import/apply", { method: "POST", body: payload })).data;
  for (let i = 0; i < shows.length; i += IMPORT_CHUNK.shows) {
    if (hooks.stopped()) break;
    const r = await apply({ shows: shows.slice(i, i + IMPORT_CHUNK.shows), movies: [] });
    sC += r.shows;
    eC += r.episodes;
    hooks.pct(Math.round((++step / steps) * 100));
  }
  for (let i = 0; i < movies.length; i += IMPORT_CHUNK.movies) {
    if (hooks.stopped()) break;
    const r = await apply({ shows: [], movies: movies.slice(i, i + IMPORT_CHUNK.movies) });
    mC += r.movies;
    hooks.pct(Math.round((++step / steps) * 100));
  }
  /* قوائمُ IMDb بعد المكتبة — قائمةٌ في الطلب */
  for (let i = 0; i < lists.length; i += IMPORT_CHUNK.lists) {
    if (hooks.stopped()) break;
    const r = await apply({ shows: [], movies: [], lists: lists.slice(i, i + IMPORT_CHUNK.lists) });
    lC += r.lists ?? 0;
    lSkip += r.listsSkipped ?? 0;
    hooks.pct(Math.round((++step / steps) * 100));
  }
  /* `write`: الختامُ يحمل الوسوم — الرئيسيّةُ والمكتبةُ والإحصاءاتُ تُعاد مرّةً واحدةً لا مع كلِّ دفعة */
  await write<{ done: true }>("/api/v1/me/import/finish", {});
  return { shows: sC, episodes: eC, movies: mC, lists: lC, listsSkipped: lSkip, unmatched: unmatched.slice(0, 60) };
}
