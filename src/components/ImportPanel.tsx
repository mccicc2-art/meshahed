"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDict, num, type Locale } from "@/core/i18n";
import { parseTvTimeFiles } from "@/core/tvtime";
import { parseLetterboxdFiles } from "@/core/letterboxd";
import { parseTrackerExport } from "@/core/trackerExport";
import { parseImdbFiles } from "@/core/imdb";
import { parseMalFiles } from "@/core/mal";
import { parseBingersFiles } from "@/core/bingers";
import { groupForResolve, type ParseOutcome, type RawRecord } from "@/core/importParse";
import { autoRecords, readAuto, runHeaders, type AutoOptions, type AutoTable, type KnownSource } from "@/core/importAuto";
import { buildImport, IMPORT_CHUNK } from "@/core/importBuild";
import type { ImportRun, ImportRunSource, ImportRunSummary, ResolveResult } from "@/core/importer";
import { resolveImportItems, applyImportChunk, finishImport, listImportRuns } from "@/lib/actions";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { Icon } from "./Icon";
import { SettingsGroup } from "./settings/SettingsGroup";
import { SettingsRow } from "./settings/SettingsRow";
import { SettingsBottomSheet } from "./settings/SettingsBottomSheet";
import { sheetScroll } from "./ui/controls";
import { webWords } from "./webWords";
import { ImportAutoReview } from "./ImportAutoReview";
import { ImportHistorySheet } from "./ImportHistorySheet";
import { importRunCounts, importRunTitle, importRunWhen } from "@/core/importer";

type Phase = "idle" | "reading" | "matching" | "writing" | "done";

/**
 * مصادر الملفات — **سجلٌّ لا فرعُ شرط** (D-153).
 *
 * كل مصدرٍ سطرٌ واحد هنا: اسمُه ومحلّلُه وما يقبله من امتدادات. وإضافة
 * الخدمة القادمة سطرٌ في هذا السجلّ، لا نسخةٌ ثانية من مسار الاستيراد
 * كلِّه — فالمراحل الثلاث (قراءة · مطابقة · كتابة) واحدةٌ للجميع.
 */
type SourceId = "imdb" | "mal" | "tvtime" | "letterboxd" | "simkl" | "bingers";
/** 🆕 T507 — **رفعٌ واحدٌ يقبل صيغَ المصادر كلِّها**: الخانةُ لا تعرف من أين جاء الملفّ قبل أن تقرأه */
const ACCEPT_ALL = ".zip,.csv,.tsv,.txt,.json,.gz,.xml";

const SOURCES: Record<
  SourceId,
  { parse: (f: { name: string; buf: ArrayBuffer }[]) => Promise<ParseOutcome>; accept: string }
> = {
  /* 🆕 IMDb — ملفّاتٌ عدّة (التقييمات · قائمة المشاهدة · القوائم) تُرفع معاً */
  imdb: { parse: parseImdbFiles, accept: ".csv,.zip" },
  /* 🆕 MyAnimeList — `animelist_….xml.gz` كما نزل */
  mal: { parse: parseMalFiles, accept: ".gz,.xml,.zip" },
  tvtime: { parse: parseTvTimeFiles, accept: ".zip,.csv,.json" },
  letterboxd: { parse: parseLetterboxdFiles, accept: ".zip,.csv" },
  simkl: { parse: parseTrackerExport, accept: ".zip,.json,.csv" },
  /* 🆕 Bingers — zip الأربعة كما نزل (أحمد ٢٠ نوفمبر) */
  bingers: { parse: parseBingersFiles, accept: ".zip,.csv" },
};

/**
 * استيراد المكتبة من خدمةٍ أخرى.
 *
 * ثلاث مراحل، وكلٌّ منها في مكانها الصحيح: **القراءة** في المتصفّح (ملفُ
 * المستخدم لا يغادر جهازه)، و**المطابقة** على الخادم (مفتاح TMDB لا
 * يغادره)، و**الكتابة** دفعاتٍ صغيرة متتابعة (طلبٌ واحد بعشرين ألف حلقة
 * ينهار بلا أثر، وبالدفعات يتقدّم الشريط وما كُتب يبقى).
 *
 * 🆕 T507 — **رفعٌ واحدٌ وأدلّةٌ ستّة** (أحمد ٢١–٢٢ نوفمبر «١أ»، والترتيبُ «تحت تراكت»): خانةُ الرفع في الأعلى تتعرّف على مصدر
 * الملفّ (`readAuto`) فتسلّمه لقارئه أو تقرؤه بأعمدته بعد مراجعة صاحبه؛ ثمّ Trakt؛ ثمّ «آخر استيراد» يفتح «استيراداتك»؛ ثمّ
 * التطبيقاتُ الستّة **أدلّةَ تصديرٍ** بلا رفعٍ فيها — صعوبةُ صاحبها في استخراج الملفّ لا في رفعه. ومن جاء من دليلٍ يُرفع ملفُّه
 * بقارئ ذلك الدليل أوّلاً (`hint`) فيبقى طريقُه كما كان قبل التوحيد.
 */
export function ImportPanel({
  locale,
  traktReady,
}: {
  locale: Locale;
  traktReady: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const params = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  /** 🆕 T507 — قارئُ الدليل الذي جاء منه صاحبُ الملفّ (أو لا شيء: الخانةُ العليا) */
  const hintRef = useRef<SourceId | null>(null);
  const stop = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  /** جداولُ ملفٍّ لا نعرفه تنتظر مراجعةَ صاحبها — ومعها ملفّاتُه إن قال «هو من تطبيقٍ نعرفه» */
  const [review, setReview] = useState<{ tables: AutoTable[]; skipped: string[]; bufs: { name: string; buf: ArrayBuffer }[] } | null>(null);
  const [known, setKnown] = useState<string | null>(null);
  /** أيُّ ورقةٍ مفتوحة: دليلُ تطبيق، أو Trakt — **وتُفتح على Trakt إن عاد الرابطُ برسالة** (نتيجةُ رحلته لا تُخبّأ خلف صفّ) */
  const [open, setOpen] = useState<SourceId | "trakt" | null>(() => (params.get("trakt") ? "trakt" : null));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runs, setRuns] = useState<ImportRun[] | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    shows: number;
    episodes: number;
    movies: number;
    lists: number;
    listsSkipped: number;
    reviews: number;
    reviewsSkipped: number;
    spoilerNote: boolean;
    unmatched: string[];
  } | null>(null);

  /* 🆕 T507 — «استيراداتك»: تُقرأ عند الفتح وبعد كلِّ استيراد. فشلُ القراءة ⇐ لا صفّ (لا خطأَ فوق صفحةٍ تعمل) */
  const refreshRuns = useCallback(() => {
    listImportRuns()
      .then(setRuns)
      .catch(() => setRuns([]));
  }, []);
  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  // رسالة العودة من Trakt — تُقرأ من الرابط الذي أعاده مسار الاستدعاء
  const trakt = params.get("trakt");
  const traktReviews = Number(params.get("rv") ?? 0) || 0;
  const traktMsg =
    trakt === "ok"
      ? `${t.importDoneBody(Number(params.get("sh") ?? 0) || 0, Number(params.get("ep") ?? 0) || 0, Number(params.get("mv") ?? 0) || 0)}${traktReviews > 0 ? ` ${t.importDoneReviews(num(traktReviews, locale))}` : ""}`
      : trakt === "off"
        ? t.importTraktOff
        : trakt === "denied"
          ? t.importTraktDenied
          : trakt === "failed"
            ? t.importTraktFailed
            : null;

  /** يفتح منتقي الملفّات — من الخانة العليا (بلا دليل) أو من دليل تطبيق (`hint`). **في معالج الضغطة نفسِه**: المتصفّحُ لا يفتح المنتقي إلّا بفعل يد */
  function pick(hint: SourceId | null) {
    if (busy) return;
    hintRef.current = hint;
    setOpen(null);
    fileRef.current?.click();
  }

  async function run(files: FileList) {
    stop.current = false;
    setError(null);
    setResult(null);
    setKnown(null);
    setPct(0);
    setPhase("reading");
    const hint = hintRef.current;
    hintRef.current = null;
    try {
      const bufs = await Promise.all(
        [...files].map(async (f) => ({ name: f.name, buf: await f.arrayBuffer() })),
      );
      /* 🆕 T507 — من جاء من دليل تطبيقٍ يُقرأ ملفُّه بقارئ ذلك التطبيق أوّلاً (مراجعةُ الوكيل، البند ١٠): طريقُه قبل التوحيد بحرفه.
         وإن لم يُخرج القارئُ شيئاً (ملفٌّ من غيره) فالكاشفُ بعده */
      if (hint) {
        const records = (await SOURCES[hint].parse(bufs)).records;
        if (records.length) return void (await importParsed(records, hint));
      }
      const got = await readAuto(bufs);
      if (got.kind === "known") {
        setKnown(t.importAutoKnown(sourceTitle(got.source)));
        return void (await importParsed((await SOURCES[got.source].parse(bufs)).records, got.source));
      }
      setPhase("idle");
      if (got.kind === "tables") return void setReview({ tables: got.tables, skipped: got.skipped, bufs });
      setError(got.skipped.length ? `${t.importNothing} ${t.importAutoSkipped(got.skipped.join(" · "))}` : t.importNothing);
    } catch (e) {
      setPhase("idle");
      setError((e as Error).message);
    }
  }

  /** بعد المراجعة: الصفوفُ بالمعاني التي أقرّها ⇐ سجلّاتٌ في المسار نفسِه — وأسماءُ أعمدته لسجلّ الاستيراد */
  async function runReviewed(tables: AutoTable[], opts: AutoOptions) {
    setReview(null);
    setError(null);
    setResult(null);
    setPhase("reading");
    try {
      await importParsed(autoRecords(tables, opts), "auto", runHeaders(tables));
    } catch (e) {
      setPhase("idle");
      setError((e as Error).message);
    }
  }

  /** 🆕 T507 — «الملف من تطبيقٍ نعرفه؟» في ورقة المراجعة: الملفّاتُ نفسُها بقارئ ذلك التطبيق */
  async function runAs(source: KnownSource) {
    const bufs = review?.bufs ?? [];
    setReview(null);
    setError(null);
    setResult(null);
    setPhase("reading");
    try {
      await importParsed((await SOURCES[source].parse(bufs)).records, source);
    } catch (e) {
      setPhase("idle");
      setError((e as Error).message);
    }
  }

  /** المطابقةُ ثمّ التجميعُ ثمّ الكتابة — لكلِّ مصدر، و«من تطبيق آخر» بعد مراجعته. الأخطاءُ لمناديها */
  async function importParsed(records: RawRecord[], source: ImportRunSource, headers?: string[]) {
    stop.current = false;
    if (!records.length) {
      setPhase("idle");
      setError(t.importNothing);
      return;
    }
    /* 🆕 T507 — ختامٌ واحدٌ يكتب سطرَ «استيراداتك» — وللإيقاف في أيّ مرحلةٍ كما للاكتمال (مراجعةُ الوكيل، البند ٧) */
    const finish = async (summary: Omit<ImportRunSummary, "source" | "headers">) => {
      await finishImport({ ...summary, source, ...(headers?.length ? { headers } : {}) });
      refreshRuns();
    };

    // ===== المطابقة =====
    /* ما وصل بمعرّف TMDB لا يمرّ من هنا إطلاقاً (D-154): لا رحلةَ
       خادمٍ له ولا بحثَ اسم. ولهذا مكتبة Simkl تدخل في ثوانٍ بينما
       مثلُها من TV Time يحتاج مئات الطلبات. */
    setPhase("matching");
    const { requests, keys } = groupForResolve(records);
    const resolved = new Map<string, ResolveResult>();

    for (let i = 0; i < requests.length; i += 40) {
      if (stop.current) {
        await finish({ status: "cancelled", shows: 0, episodes: 0, movies: 0, reviews: 0, unmatched: 0 });
        return void setPhase("idle");
      }
      const slice = requests.slice(i, i + 40);
      const out = await resolveImportItems(slice);
      out.forEach((r, n) => resolved.set(keys[i + n], r));
      setPct(Math.round(((i + slice.length) / requests.length) * 100));
    }

    // ===== التجميع: من سجلاتٍ متفرّقة إلى أعمالٍ بحلقاتها =====
    /* 🆕 D-1369 — **في `core/importBuild` لا هنا**: الاستيرادُ الأصليُّ يقرأ القواعدَ نفسَها بحرفها */
    const { shows, movies, lists, favorites, unmatched } = buildImport(records, resolved);
    /* 🆕 **«ما في Loopz يبقى» لكلِّ ملف** (أحمد ٢٠ نوفمبر «١ أ»، قاعدةُ Trakt): العملُ الموجودُ يبقى باسمه وحاله، والمشاهدةُ
       بتاريخها، وتقييمُ Loopz لا يُدهس — يُضاف الناقصُ وحدَه */
    const keep = true;
    /* 🆕 T507 — آراءُ Letterboxd وعمودُ «المراجعة» وحدهما (`ratings.imported_from`، هجرة ٢٥٨) */
    const reviewFrom = source === "letterboxd" ? "letterboxd" : source === "auto" ? "auto" : undefined;

    // ===== الكتابة =====
    setPhase("writing");
    setPct(0);
    let sC = 0;
    let eC = 0;
    let mC = 0;
    let lC = 0;
    let lSkip = 0;
    let rC = 0;
    let rSkip = 0;
    const steps =
      Math.ceil(shows.length / IMPORT_CHUNK.shows) +
        Math.ceil(movies.length / IMPORT_CHUNK.movies) +
        Math.ceil(lists.length / IMPORT_CHUNK.lists) +
        Math.ceil(favorites.length / IMPORT_CHUNK.favorites) || 1;
    let step = 0;

    /* 🆕 T507 — خطأٌ في منتصف الكتابة يُختم «أُوقف» بما كُتب قبله (مراجعةُ الوكيل الثاني، البند ٨): ما دخل المكتبةَ دخلها، وسطرُه
       وإبطالُ الصفحات لا يضيعان مع الخطأ. ثمّ يعود الخطأُ لمناديه كما كان */
    try {
      for (let i = 0; i < shows.length; i += IMPORT_CHUNK.shows) {
        if (stop.current) break;
        const r = await applyImportChunk({ shows: shows.slice(i, i + IMPORT_CHUNK.shows), movies: [], keep, reviewFrom });
        sC += r.shows;
        eC += r.episodes;
        rC += r.reviews ?? 0;
        rSkip += r.reviewsSkipped ?? 0;
        setPct(Math.round((++step / steps) * 100));
      }
      for (let i = 0; i < movies.length; i += IMPORT_CHUNK.movies) {
        if (stop.current) break;
        const r = await applyImportChunk({ shows: [], movies: movies.slice(i, i + IMPORT_CHUNK.movies), keep, reviewFrom });
        mC += r.movies;
        rC += r.reviews ?? 0;
        rSkip += r.reviewsSkipped ?? 0;
        setPct(Math.round((++step / steps) * 100));
      }
      /* 🆕 قوائمُ IMDb بعد المكتبة — قائمةٌ في الطلب (حتى ٣٠٠ عمل) */
      for (let i = 0; i < lists.length; i += IMPORT_CHUNK.lists) {
        if (stop.current) break;
        const r = await applyImportChunk({ shows: [], movies: [], lists: lists.slice(i, i + IMPORT_CHUNK.lists) });
        lC += r.lists;
        lSkip += r.listsSkipped;
        setPct(Math.round((++step / steps) * 100));
      }
      /* 🆕 مفضّلةُ Bingers بعد القوائم — تُضاف إلى «المفضّلة» الواحدة، واسمُها بلغة الواجهة إن وُلدت الآن */
      for (let i = 0; i < favorites.length; i += IMPORT_CHUNK.favorites) {
        if (stop.current) break;
        await applyImportChunk({ shows: [], movies: [], favorites: favorites.slice(i, i + IMPORT_CHUNK.favorites), favoritesName: t.favListName });
        setPct(Math.round((++step / steps) * 100));
      }
    } catch (e) {
      await finish({ status: "cancelled", shows: sC, episodes: eC, movies: mC, reviews: rC, unmatched: unmatched.length }).catch(() => undefined);
      throw e;
    }

    await finish({
      status: stop.current ? "cancelled" : "done",
      shows: sC,
      episodes: eC,
      movies: mC,
      reviews: rC,
      unmatched: unmatched.length,
    });
    setResult({
      shows: sC,
      episodes: eC,
      movies: mC,
      lists: lC,
      listsSkipped: lSkip,
      reviews: rC,
      reviewsSkipped: rSkip,
      spoilerNote: source === "letterboxd" && rC > 0,
      unmatched: unmatched.slice(0, 60),
    });
    setPhase("done");
    router.refresh();
  }

  const busy = phase === "reading" || phase === "matching" || phase === "writing";
  const phaseLabel =
    phase === "reading"
      ? t.importReading
      : phase === "matching"
        ? t.importMatching
        : phase === "writing"
          ? t.importWriting
          : "";

  /* الأدلّةُ الستّة بترتيبها القديم — IMDb أوّلاً: أوسعُها جمهوراً وأدقُّها مطابقةً (بالمعرّف لا بالاسم) */
  const guides: { id: SourceId; title: string; hint: string; fileHint: string }[] = [
    { id: "imdb", title: t.importImdbTitle, hint: t.importImdbHint, fileHint: t.importImdbFileHint },
    { id: "mal", title: t.importMalTitle, hint: t.importMalHint, fileHint: t.importMalFileHint },
    { id: "letterboxd", title: t.importLetterboxdTitle, hint: t.importLetterboxdHint, fileHint: t.importLetterboxdFileHint },
    { id: "simkl", title: t.importSimklTitle, hint: t.importSimklHint, fileHint: t.importSimklFileHint },
    { id: "bingers", title: t.importBingersTitle, hint: t.importBingersHint, fileHint: t.importBingersFileHint },
    { id: "tvtime", title: t.importTvTimeTitle, hint: t.importTvTimeHint, fileHint: t.importFileHint },
  ];
  function sourceTitle(id: SourceId): string {
    return guides.find((g) => g.id === id)?.title ?? id;
  }
  const FILES: Record<SourceId, string> = { imdb: "csv", mal: "xml · gz", letterboxd: "zip · csv", simkl: "zip · json · csv", bingers: "zip · csv", tvtime: "zip" };
  const last = runs?.[0] ?? null;
  const lastLine = last ? `${importRunWhen(last.createdAt, locale === "en" ? "en" : "ar")} · ${importRunCounts(last, t, (n) => num(n, locale))}` : "";
  const w = webWords(locale);

  /* حالُ الاستيراد (التقدّم · الخطأ · الحصيلة) — في خانة الرفع وحدها: هي المكانُ الواحدُ الذي يبدأ منه كلُّ ملفّ */
  const status = (
    <>
      {busy && (
        <div className="mt-4">
          <p className="text-12 text-muted mb-1.5">{phaseLabel}</p>
          {/* `scaleX` لا `width` — انظر D-022 */}
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-accent origin-left rtl:origin-right transition-transform duration-300"
              style={{ transform: `scaleX(${Math.max(0.02, pct / 100)})` }}
            />
          </div>
        </div>
      )}
      {known && (
        <div className="mt-3">
          <Alert tone="info">{known}</Alert>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {phase === "done" && result && (
        <div className="mt-4 space-y-3">
          <Alert tone="success">
            <b className="block">{t.importDone}</b>
            {t.importDoneBody(result.shows, result.episodes, result.movies)}
            {result.lists > 0 && <> {t.importDoneLists(num(result.lists, locale))}</>}
            {result.reviews > 0 && <> {t.importDoneReviews(num(result.reviews, locale))}</>}
          </Alert>
          {result.listsSkipped > 0 && <Alert tone="info">{t.importListsFull}</Alert>}
          {result.reviewsSkipped > 0 && <Alert tone="info">{t.importReviewsSkipped(num(result.reviewsSkipped, locale))}</Alert>}
          {result.spoilerNote && <Alert tone="info">{t.importReviewsSpoiler}</Alert>}
          {result.unmatched.length > 0 && (
            <div className="rounded-control border border-border bg-surface-2 p-3">
              <p className="text-12 font-bold mb-1">{t.importUnmatchedTitle(num(result.unmatched.length, locale))}</p>
              <p className="text-12 text-muted mb-2">{t.importUnmatchedHint}</p>
              <p className="text-12 text-muted leading-relaxed break-words">{result.unmatched.join(" · ")}</p>
            </div>
          )}
        </div>
      )}
    </>
  );

  /* خانةُ الرفع — بطاقةٌ واحدةٌ يرسمها الحاسوبُ والجوالُ بعرضهما */
  const uploadCard = (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <Icon name="download" size={20} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <b className="block text-15 font-bold">{t.importUploadTitle}</b>
          <p className="mt-1 text-12 leading-relaxed text-muted">{t.importUploadHint}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => pick(null)}
          className={buttonClass({ variant: "primary", size: "md", className: "h-11 flex-1 justify-center desk:flex-none desk:px-6" })}
        >
          <Icon name="download" size={16} />
          {t.importUploadPick}
        </button>
        {busy && (
          <button type="button" onClick={() => void (stop.current = true)} className={buttonClass({ variant: "ghost", size: "md", className: "h-11" })}>
            {t.importCancel}
          </button>
        )}
      </div>
      {status}
    </div>
  );

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPT_ALL}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files;
          if (f && f.length) void run(f);
          e.target.value = "";
        }}
      />

      {/* ===== الحاسوب (≥١٢٨٠): الخانةُ عريضةٌ، ثمّ Trakt و«آخر استيراد»، ثمّ الأدلّةُ بطاقات ===== */}
      <section className="hidden desk:block space-y-3.5">
        <h2 className="text-15 font-bold">{t.importSection}</h2>
        {uploadCard}
        <div className="grid grid-cols-3 gap-3.5">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4">
            <b className="text-15 font-bold">{t.importTraktTitle}</b>
            <div className="flex-1">
              <p className="text-12 leading-relaxed text-muted">{traktReady ? w.traktHint : w.traktOff}</p>
              {traktReady && <p className="mt-2 text-[11px] leading-relaxed text-muted">{w.traktNotice}</p>}
            </div>
            {traktReady ? (
              <a href="/api/trakt/start" className={buttonClass({ variant: "surface", size: "md", className: "w-full justify-center" })}>
                <Icon name="share" size={16} />
                {t.importTraktConnect}
              </a>
            ) : (
              <span className={buttonClass({ variant: "surface", size: "md", className: "w-full justify-center opacity-50 pointer-events-none" })}>{t.settingsSoonTitle}</span>
            )}
            {traktMsg ? <Alert tone={trakt === "ok" ? "success" : "error"}>{traktMsg}</Alert> : null}
          </div>
          {last && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-4 text-start hover:bg-surface-2 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Icon name="clock" size={18} className="shrink-0" />
                <b className="text-15 font-bold truncate">{t.importLastRun(importRunTitle(last.source, t))}</b>
              </span>
              <span className="text-12 leading-relaxed text-muted">{lastLine}</span>
            </button>
          )}
        </div>
        <h2 className="pt-2 text-15 font-bold">{t.importGuidesLabel}</h2>
        <div className="grid grid-cols-3 gap-3.5">
          {guides.map((g) => (
            <div key={`c-${g.id}`} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <Icon name="book" size={16} className="shrink-0" />
                <b className="text-15 font-bold">{g.title}</b>
                <span className="ms-auto rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-muted" dir="ltr">{FILES[g.id]}</span>
              </div>
              <p className="flex-1 text-12 leading-relaxed text-muted">{g.hint}</p>
              <button type="button" disabled={busy} onClick={() => pick(g.id)} className={buttonClass({ variant: "surface", size: "md", className: "w-full justify-center" })}>
                {t.importGuideUpload}
              </button>
            </div>
          ))}
        </div>
        <p className="text-12 leading-relaxed text-muted">{t.importHint}</p>
      </section>

      {/* ===== الجوال: الخانةُ، ثمّ Trakt و«آخر استيراد» تحته (أحمد ٢٢ نوفمبر «مكانها تحت تراكت»)، ثمّ الأدلّة صفوفاً ===== */}
      <div className="desk:hidden space-y-4">
        <div>
          <p className="mb-2 px-1 text-12 font-semibold text-muted">{t.importSection}</p>
          {uploadCard}
        </div>
        <SettingsGroup>
          {/* **وTrakt صفٌّ في السجلِّ نفسِه** — **وبابٌ مغلقٌ في مكانه أصدقُ من بابٍ محذوف** (D-155). **ويُعطَّل حين لا مفاتيح** */}
          <SettingsRow
            icon="share"
            title={t.importTraktTitle}
            subtitle={traktReady ? w.traktHint : w.traktOff}
            onClick={traktReady || traktMsg ? () => setOpen("trakt") : undefined}
            value={traktReady ? undefined : t.settingsSoonTitle}
          />
          {last && (
            <SettingsRow icon="clock" title={t.importLastRun(importRunTitle(last.source, t))} subtitle={lastLine} onClick={() => setHistoryOpen(true)} />
          )}
        </SettingsGroup>
        <SettingsGroup label={t.importGuidesLabel}>
          {guides.map((g) => (
            /* 🆕 الاسمُ وحدَه (أحمد ٢٢ نوفمبر «٣ أ»): الخطواتُ كاملةً في الورقة، وسطرُها في الصفّ كان يُقصّ — وبطاقاتُ الشاشة
               العريضة تبقى بنصّها لأنّ فيها مكاناً له */
            <SettingsRow key={g.id} icon="book" title={g.title} onClick={() => setOpen(g.id)} />
          ))}
        </SettingsGroup>
        <p className="px-1 text-12 text-muted leading-relaxed">{t.importHint}</p>
      </div>

      {/* ===== ورقةُ كلِّ دليل — الشرحُ كاملاً وزرُّ «ارفع الملف الآن» يفتح الرفعَ الواحد بقارئ هذا التطبيق ===== */}
      {guides.map((g) => (
        <SettingsBottomSheet
          key={g.id}
          open={open === g.id}
          title={g.title}
          onCancel={() => setOpen(null)}
          onDone={() => setOpen(null)}
          cancelLabel={t.cancelLabel}
          doneLabel={t.doneLabel}
        >
          <div className={`${sheetScroll} px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
            <p className="text-12 text-muted leading-relaxed mb-3">{g.hint}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => pick(g.id)}
              className={buttonClass({ variant: "primary", size: "md", className: "h-11 w-full justify-center" })}
            >
              <Icon name="download" size={16} />
              {t.importGuideUpload}
            </button>
            <p className="text-12 text-muted mt-2">{g.fileHint}</p>
          </div>
        </SettingsBottomSheet>
      ))}

      {/* 🆕 T500 — مراجعةُ ملفٍّ لا نعرفه قبل أن يُكتب منه شيء — و🆕 T507: «الملف من تطبيقٍ نعرفه؟» */}
      {review && (
        <ImportAutoReview
          locale={locale}
          tables={review.tables}
          skipped={review.skipped}
          onCancel={() => setReview(null)}
          onImport={(tables, opts) => void runReviewed(tables, opts)}
          onPickSource={(src) => void runAs(src)}
        />
      )}

      <ImportHistorySheet locale={locale} open={historyOpen} runs={runs ?? []} onClose={() => setHistoryOpen(false)} />

      {/* ===== ورقةُ Trakt ===== */}
      <SettingsBottomSheet
        open={open === "trakt"}
        title={t.importTraktTitle}
        onCancel={() => setOpen(null)}
        onDone={() => setOpen(null)}
        cancelLabel={t.cancelLabel}
        doneLabel={t.doneLabel}
      >
        <div className={`${sheetScroll} px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
          {/* D-155: الوصفُ يتبع الحال. حين لا مفاتيح، وعدُ «نجلب مشاهداتك مباشرةً» كذبٌ يقرؤه المستخدم فوق سطرٍ يقول إنه غير متاح. */}
          <p className="text-12 text-muted leading-relaxed mb-3">{traktReady ? w.traktHint : w.traktOff}</p>
          {traktReady && <p className="-mt-1 mb-3 text-[11px] leading-relaxed text-muted">{w.traktNotice}</p>}

          {traktReady ? (
            /* رابطٌ لا زرّ فعل: الوجهة خارجية ويجب أن تُرى في شريط العنوان ويقبل الفتح في تبويبٍ جديد كأي رابط */
            <a href="/api/trakt/start" className={buttonClass({ variant: "surface", size: "md", className: "h-11" })}>
              <Icon name="share" size={16} />
              {t.importTraktConnect}
            </a>
          ) : (
            <>
              <Alert tone="info">{t.importTraktOff}</Alert>
              {/* البابُ المغلق يُشار منه إلى بابٍ يفتح: قارئ D-154 يقرأ تصدير تراكت نفسه إن حمل `tmdb` */}
              <p className="text-12 text-muted leading-relaxed mt-3">{t.importTraktAlt}</p>
            </>
          )}

          {traktMsg && (
            <div className="mt-3">
              <Alert tone={trakt === "ok" ? "success" : "error"}>{traktMsg}</Alert>
            </div>
          )}
        </div>
      </SettingsBottomSheet>
    </>
  );
}
