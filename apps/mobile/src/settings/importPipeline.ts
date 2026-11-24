import { fixPairsFrom, type FixPair } from "@/core/importFix";
import { api, write } from "../api";
import { groupForResolve, type RawRecord } from "@/core/importParse";
import { buildImport, IMPORT_CHUNK } from "@/core/importBuild";
import type { ImportPayload, ImportRunSource, ResolveRequest, ResolveResult } from "@/core/importer";

/**
 * ====== 🆕 مسارُ الاستيراد بعد القراءة — المطابقةُ ثمّ التجميعُ ثمّ الكتابة ======
 *
 * 🔑 **قارئان لمسارٍ واحد** (D-145): شاشةُ الاستيراد (ملفّاتُ التصدير) واستيرادُ Plex (تاريخُ المشاهدة من سيرفر البيت، هجرة ٢٣٥).
 * كان المسارُ داخل `ImportScreen` بحرفه؛ ونسخةٌ ثانيةٌ منه في شاشة Plex كانت ستفترق عند أوّل إصلاحٍ في الدفعات أو الختام.
 * ⚖️ **المطابقةُ على الخادم** (مفتاحُ TMDB لا يغادره) **والكتابةُ دفعاتٍ صغيرة** يتقدّم بها الشريط، وما كُتب قبل «إيقاف» باقٍ —
 * والختامُ (`finish`) يُنادى حتى بعد الإيقاف: ما كُتب في المكتبة فعلاً والشاشاتُ يجب أن تراه.
 */
export type ImportPhase = "matching" | "writing";
export type ImportResult = {
  shows: number;
  episodes: number;
  movies: number;
  lists: number;
  listsSkipped: number;
  /** 🆕 T507 — مراجعاتٌ كُتبت، وما لم يُكتب منها (بلا تقييم · بلا يوم · تقييمٌ مختلف) */
  reviews: number;
  reviewsSkipped: number;
  unmatched: string[];
  /** 🆕 T537 — أفلامٌ اختارتها المطابقةُ القديمة غيرَ ما تختاره اليوم: تُعرض على الخادم بشروطها لتُصحَّح بتأكيده */
  fixPairs: FixPair[];
};

export async function importRecords(
  records: RawRecord[],
  hooks: { stopped: () => boolean; phase: (p: ImportPhase) => void; pct: (n: number) => void },
  /** 🆕 Bingers — `keep`: «ما في Loopz يبقى» (`ImportPayload.keep`)، و`favoritesName`: اسمُ «المفضّلة» إن وُلدت بالاستيراد.
   *  🆕 T507 — `source`: مصدرُ الملفّ لسطر «استيراداتك» (غيابُه ⇐ لا سطر، كاستيراد Plex اليوم)، و`headers`: أسماءُ أعمدة الملفّ المجهول */
  opts: { keep?: boolean; favoritesName?: string; source?: ImportRunSource; headers?: string[] } = {},
): Promise<ImportResult | null> {
  /* 🆕 T507 — الختامُ يحمل الحصيلة: الخادمُ يكتب منها سطرَ «استيراداتك» والسطحُ `app` من طريقه. `write`: الختامُ يحمل الوسوم —
     الرئيسيّةُ والمكتبةُ والإحصاءاتُ تُعاد مرّةً واحدةً لا مع كلِّ دفعة */
  const finish = (summary: { status: "done" | "cancelled"; shows: number; episodes: number; movies: number; reviews: number; unmatched: number }) =>
    write<{ done: true }>(
      "/api/v1/me/import/finish",
      opts.source ? { ...summary, source: opts.source, ...(opts.headers?.length ? { headers: opts.headers } : {}) } : {},
    );
  /* 🆕 T507 — آراءُ Letterboxd وعمودُ «المراجعة» وحدهما (`ratings.imported_from`، هجرة ٢٥٨) */
  const reviewFrom = opts.source === "letterboxd" ? "letterboxd" : opts.source === "auto" ? "auto" : undefined;
  // ===== المطابقة — ما وصل بمعرّف TMDB لا يمرّ من هنا (D-154) =====
  hooks.phase("matching");
  const { requests, keys } = groupForResolve(records);
  const resolved = new Map<string, ResolveResult>();
  for (let i = 0; i < requests.length; i += IMPORT_CHUNK.resolve) {
    if (hooks.stopped()) {
      /* 🆕 T507 — إيقافٌ قبل الكتابة يُسجَّل «أُوقف» أيضاً (مراجعةُ الوكيل، البند ٧) */
      if (opts.source) await finish({ status: "cancelled", shows: 0, episodes: 0, movies: 0, reviews: 0, unmatched: 0 });
      return null;
    }
    const slice: ResolveRequest[] = requests.slice(i, i + IMPORT_CHUNK.resolve);
    /* `api` لا `write`: المطابقةُ قراءةٌ بجسم — لا وسومَ تُبطَل */
    const out = (await api<{ results: ResolveResult[] }>("/api/v1/me/import/resolve", { method: "POST", body: { requests: slice } })).data.results;
    out.forEach((r, n) => resolved.set(keys[i + n], r));
    hooks.pct(Math.round(((i + slice.length) / requests.length) * 100));
  }

  const { shows, movies, lists, favorites, unmatched } = buildImport(records, resolved);
  const keep = opts.keep === true;

  // ===== الكتابة =====
  hooks.phase("writing");
  hooks.pct(0);
  let sC = 0;
  let eC = 0;
  let mC = 0;
  let lC = 0;
  let lSkip = 0;
  let rC = 0;
  let rSkip = 0;
  const steps =
    Math.ceil(shows.length / IMPORT_CHUNK.shows) + Math.ceil(movies.length / IMPORT_CHUNK.movies) + Math.ceil(lists.length / IMPORT_CHUNK.lists) + Math.ceil(favorites.length / IMPORT_CHUNK.favorites) || 1;
  let step = 0;
  /* `lists*` اختياريّان في الردّ: خادمٌ أقدمُ من هذا التطبيق لا يعيدهما (ولن تصله قوائم أصلاً) */
  const apply = async (payload: ImportPayload) =>
    (await api<{ shows: number; episodes: number; movies: number; lists?: number; listsSkipped?: number; reviews?: number; reviewsSkipped?: number }>("/api/v1/me/import/apply", { method: "POST", body: payload })).data;
  /* 🆕 T507 — خطأٌ في منتصف الكتابة يُختم «أُوقف» بما كُتب قبله (مراجعةُ الوكيل الثاني، البند ٨)، ثمّ يعود لمناديه كما كان */
  try {
    for (let i = 0; i < shows.length; i += IMPORT_CHUNK.shows) {
      if (hooks.stopped()) break;
      const r = await apply({ shows: shows.slice(i, i + IMPORT_CHUNK.shows), movies: [], keep, reviewFrom });
      sC += r.shows;
      eC += r.episodes;
      rC += r.reviews ?? 0;
      rSkip += r.reviewsSkipped ?? 0;
      hooks.pct(Math.round((++step / steps) * 100));
    }
    for (let i = 0; i < movies.length; i += IMPORT_CHUNK.movies) {
      if (hooks.stopped()) break;
      const r = await apply({ shows: [], movies: movies.slice(i, i + IMPORT_CHUNK.movies), keep, reviewFrom });
      mC += r.movies;
      rC += r.reviews ?? 0;
      rSkip += r.reviewsSkipped ?? 0;
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
    /* 🆕 مفضّلةُ Bingers بعد القوائم — تُضاف إلى «المفضّلة» الواحدة ولا تُقلَب */
    for (let i = 0; i < favorites.length; i += IMPORT_CHUNK.favorites) {
      if (hooks.stopped()) break;
      await apply({ shows: [], movies: [], favorites: favorites.slice(i, i + IMPORT_CHUNK.favorites), favoritesName: opts.favoritesName });
      hooks.pct(Math.round((++step / steps) * 100));
    }
  } catch (e) {
    await finish({ status: "cancelled", shows: sC, episodes: eC, movies: mC, reviews: rC, unmatched: unmatched.length }).catch(() => undefined);
    throw e;
  }
  await finish({ status: hooks.stopped() ? "cancelled" : "done", shows: sC, episodes: eC, movies: mC, reviews: rC, unmatched: unmatched.length });
  return {
    shows: sC,
    episodes: eC,
    movies: mC,
    lists: lC,
    listsSkipped: lSkip,
    reviews: rC,
    reviewsSkipped: rSkip,
    unmatched: unmatched.slice(0, 60),
    fixPairs: fixPairsFrom(resolved.values()),
  };
}
