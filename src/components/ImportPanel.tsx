"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDict, num, type Locale } from "@/core/i18n";
import { parseTvTimeFiles } from "@/core/tvtime";
import { parseLetterboxdFiles } from "@/core/letterboxd";
import { parseTrackerExport } from "@/core/trackerExport";
import { parseImdbFiles } from "@/core/imdb";
import { parseMalFiles } from "@/core/mal";
import { parseBingersFiles } from "@/core/bingers";
import { groupForResolve, type ParseOutcome, type RawRecord } from "@/core/importParse";
import { autoRecords, readAuto, type AutoOptions, type AutoTable } from "@/core/importAuto";
import { buildImport, IMPORT_CHUNK } from "@/core/importBuild";
import type { ResolveResult } from "@/core/importer";
import { resolveImportItems, applyImportChunk, finishImport } from "@/lib/actions";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { Icon } from "./Icon";
import { SettingsGroup } from "./settings/SettingsGroup";
import { SettingsRow } from "./settings/SettingsRow";
import { SettingsBottomSheet } from "./settings/SettingsBottomSheet";
import { sheetScroll } from "./ui/controls";
import { webWords } from "./webWords";
import { ImportAutoReview } from "./ImportAutoReview";

type Phase = "idle" | "reading" | "matching" | "writing" | "done";

/**
 * مصادر الملفات — **سجلٌّ لا فرعُ شرط** (D-153).
 *
 * كل مصدرٍ سطرٌ واحد هنا: اسمُه ومحلّلُه وما يقبله من امتدادات. وإضافة
 * الخدمة القادمة سطرٌ في هذا السجلّ، لا نسخةٌ ثانية من مسار الاستيراد
 * كلِّه — فالمراحل الثلاث (قراءة · مطابقة · كتابة) واحدةٌ للجميع.
 */
type SourceId = "imdb" | "mal" | "tvtime" | "letterboxd" | "simkl" | "bingers";
/** 🆕 T500 — «من تطبيق آخر» ليس قارئاً في السجلّ: يتعرّف على الملفّ فيسلّمه لقارئه، أو يقرؤه بأعمدته بعد مراجعة صاحبه */
type PanelId = SourceId | "auto";

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
 * ومقياس التقدّم بالنسبة لا بالعدّاد: من عنده أربعون مسلسلاً ومن عنده
 * أربعمئة يريان الشريط نفسه يمتلئ، والرقم الخام لا يعني شيئاً لمن لا
 * يعرف مقامه.
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
  const tvtimeRef = useRef<HTMLInputElement>(null);
  const letterboxdRef = useRef<HTMLInputElement>(null);
  const simklRef = useRef<HTMLInputElement>(null);
  const bingersRef = useRef<HTMLInputElement>(null);
  const imdbRef = useRef<HTMLInputElement>(null);
  const malRef = useRef<HTMLInputElement>(null);
  const autoRef = useRef<HTMLInputElement>(null);
  const stop = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  /** أيُّ مصدرٍ يعمل الآن — الشريط والنتيجة يظهران تحت قسمه وحده */
  const [active, setActive] = useState<PanelId | null>(null);
  /** 🆕 T500 — جداولُ ملفٍّ لا نعرفه تنتظر مراجعةَ صاحبها، و«تعرّفنا على ملفّك» حين يكون من مصدرٍ نعرفه */
  const [review, setReview] = useState<{ tables: AutoTable[]; skipped: string[]; back: boolean } | null>(null);
  const [known, setKnown] = useState<string | null>(null);
  /** أيُّ مصدرٍ ورقتُه مفتوحة — والمصادرُ صفوفٌ لا بطاقات (D-555) */
  /* **وتُفتح على Trakt إن عاد الرابطُ برسالة**: المستخدمُ عاد للتوّ من
     موقعٍ خارجيّ — **ونتيجةُ رحلته لا يجوز أن تكون خلف صفٍّ يُضغط.** */
  const [open, setOpen] = useState<PanelId | "trakt" | null>(() =>
    params.get("trakt") ? "trakt" : null,
  );
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    shows: number;
    episodes: number;
    movies: number;
    lists: number;
    listsSkipped: number;
    unmatched: string[];
  } | null>(null);

  // رسالة العودة من Trakt — تُقرأ من الرابط الذي أعاده مسار الاستدعاء
  const trakt = params.get("trakt");
  const traktMsg =
    trakt === "ok"
      ? t.importDoneBody(Number(params.get("sh") ?? 0) || 0, Number(params.get("ep") ?? 0) || 0, Number(params.get("mv") ?? 0) || 0)
      : trakt === "off"
        ? t.importTraktOff
        : trakt === "denied"
          ? t.importTraktDenied
          : trakt === "failed"
            ? t.importTraktFailed
            : null;

  async function run(files: FileList, source: PanelId) {
    stop.current = false;
    setActive(source);
    setError(null);
    setResult(null);
    setKnown(null);
    setPct(0);
    setPhase("reading");
    try {
      const bufs = await Promise.all(
        [...files].map(async (f) => ({ name: f.name, buf: await f.arrayBuffer() })),
      );
      if (source !== "auto") return void (await importParsed((await SOURCES[source].parse(bufs)).records));
      /* 🆕 T500 — ملفٌّ من مصدرٍ نعرفه يذهب لقارئه هو؛ وما سواه تُخمَّن أعمدتُه ثمّ ينتظر المراجعة */
      const got = await readAuto(bufs);
      if (got.kind === "known") {
        setKnown(t.importAutoKnown(sources.find((x) => x.id === got.source)?.title ?? got.source));
        return void (await importParsed((await SOURCES[got.source].parse(bufs)).records));
      }
      setPhase("idle");
      if (got.kind === "tables") {
        /* ورقةٌ واحدةٌ في كلِّ مرّة: ورقةُ المصدر (الجوال) تُغلق والمراجعةُ تُفتح، ثمّ تعود لتُري التقدّم */
        setReview({ tables: got.tables, skipped: got.skipped, back: open === "auto" });
        return void setOpen(null);
      }
      setError(got.skipped.length ? `${t.importNothing} ${t.importAutoSkipped(got.skipped.join(" · "))}` : t.importNothing);
    } catch (e) {
      setPhase("idle");
      setError((e as Error).message);
    }
  }

  /** 🆕 T500 — بعد المراجعة: الصفوفُ بالمعاني التي أقرّها ⇐ سجلّاتٌ في المسار نفسِه */
  async function runReviewed(tables: AutoTable[], opts: AutoOptions) {
    /* الحاسوبُ يرى التقدّمَ في بطاقته — والورقةُ تعود لمن جاء منها */
    if (review?.back) setOpen("auto");
    setReview(null);
    setError(null);
    setResult(null);
    setPhase("reading");
    try {
      await importParsed(autoRecords(tables, opts));
    } catch (e) {
      setPhase("idle");
      setError((e as Error).message);
    }
  }

  /** المطابقةُ ثمّ التجميعُ ثمّ الكتابة — لكلِّ مصدر، و«من تطبيق آخر» بعد مراجعته. الأخطاءُ لمناديها */
  async function importParsed(records: RawRecord[]) {
    stop.current = false;
    {
      if (!records.length) {
        setPhase("idle");
        setError(t.importNothing);
        return;
      }

      // ===== المطابقة =====
      /* ما وصل بمعرّف TMDB لا يمرّ من هنا إطلاقاً (D-154): لا رحلةَ
         خادمٍ له ولا بحثَ اسم. ولهذا مكتبة Simkl تدخل في ثوانٍ بينما
         مثلُها من TV Time يحتاج مئات الطلبات. */
      setPhase("matching");
      const { requests, keys } = groupForResolve(records);
      const resolved = new Map<string, ResolveResult>();

      for (let i = 0; i < requests.length; i += 40) {
        if (stop.current) return void setPhase("idle");
        const slice = requests.slice(i, i + 40);
        const out = await resolveImportItems(slice);
        out.forEach((r, n) => resolved.set(keys[i + n], r));
        setPct(Math.round(((i + slice.length) / requests.length) * 100));
      }

      // ===== التجميع: من سجلاتٍ متفرّقة إلى أعمالٍ بحلقاتها =====
      /* 🆕 D-1369 — **في `core/importBuild` لا هنا**: الاستيرادُ الأصليُّ يقرأ القواعدَ نفسَها بحرفها */
      const { shows, movies, lists, favorites, unmatched } = buildImport(records, resolved);
      /* 🆕 **«ما في Loopz يبقى» لكلِّ ملف** (أحمد ٢٠ نوفمبر «١ أ»، قاعدةُ Trakt): العملُ الموجودُ يبقى باسمه وحاله، والمشاهدةُ
         بتاريخها، وتقييمُ Loopz لا يُدهس — يُضاف الناقصُ وحدَه. كان الملفُّ يكتب فوق ما سجّله صاحبُه بيده */
      const keep = true;

      // ===== الكتابة =====
      setPhase("writing");
      setPct(0);
      let sC = 0;
      let eC = 0;
      let mC = 0;
      let lC = 0;
      let lSkip = 0;
      const steps =
        Math.ceil(shows.length / IMPORT_CHUNK.shows) +
          Math.ceil(movies.length / IMPORT_CHUNK.movies) +
          Math.ceil(lists.length / IMPORT_CHUNK.lists) +
          Math.ceil(favorites.length / IMPORT_CHUNK.favorites) || 1;
      let step = 0;

      for (let i = 0; i < shows.length; i += 5) {
        if (stop.current) break;
        const r = await applyImportChunk({ shows: shows.slice(i, i + 5), movies: [], keep });
        sC += r.shows;
        eC += r.episodes;
        setPct(Math.round((++step / steps) * 100));
      }
      for (let i = 0; i < movies.length; i += 60) {
        if (stop.current) break;
        const r = await applyImportChunk({ shows: [], movies: movies.slice(i, i + 60), keep });
        mC += r.movies;
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

      await finishImport();
      setResult({ shows: sC, episodes: eC, movies: mC, lists: lC, listsSkipped: lSkip, unmatched: unmatched.slice(0, 60) });
      setPhase("done");
      router.refresh();
    }
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

  const sources = [
    /* IMDb أوّلاً: أوسعُ الأربعة جمهوراً، وأدقُّها مطابقةً (بالمعرّف لا بالاسم) */
    {
      id: "imdb" as const,
      title: t.importImdbTitle,
      hint: t.importImdbHint,
      fileHint: t.importImdbFileHint,
    },
    {
      id: "mal" as const,
      title: t.importMalTitle,
      hint: t.importMalHint,
      fileHint: t.importMalFileHint,
    },
    {
      id: "letterboxd" as const,
      title: t.importLetterboxdTitle,
      hint: t.importLetterboxdHint,
      fileHint: t.importLetterboxdFileHint,
    },
    {
      id: "simkl" as const,
      title: t.importSimklTitle,
      hint: t.importSimklHint,
      fileHint: t.importSimklFileHint,
    },
    {
      id: "bingers" as const,
      title: t.importBingersTitle,
      hint: t.importBingersHint,
      fileHint: t.importBingersFileHint,
    },
    {
      id: "tvtime" as const,
      title: t.importTvTimeTitle,
      hint: t.importTvTimeHint,
      fileHint: t.importFileHint,
    },
    /* 🆕 T500 — آخرُها: من جاء من تطبيقٍ بعينه يجده فوقه، ومن لا يجده هنا يجد الباب */
    {
      id: "auto" as const,
      title: t.importAutoTitle,
      hint: t.importAutoHint,
      fileHint: t.importAutoFileHint,
    },
  ];

  const refOf = (id: PanelId) =>
    id === "auto" ? autoRef : id === "imdb" ? imdbRef : id === "mal" ? malRef : id === "letterboxd" ? letterboxdRef : id === "simkl" ? simklRef : id === "bingers" ? bingersRef : tvtimeRef;
  /* 🆕 R273 — حالُ الاستيراد (التقدّم · الخطأ · الحصيلة) دالّةٌ واحدةٌ تقرؤها الورقةُ على الجوال وبطاقةُ الحاسوب — لا نسختان */
  const status = (id: PanelId) => {
    const mine = active === id;
    return (
      <>
              {busy && mine && (
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

              {known && mine && (
                <div className="mt-3">
                  <Alert tone="info">{known}</Alert>
                </div>
              )}
              {error && mine && (
                <div className="mt-3">
                  <Alert tone="error">{error}</Alert>
                </div>
              )}

              {phase === "done" && result && mine && (
                <div className="mt-4 space-y-3">
                  <Alert tone="success">
                    <b className="block">{t.importDone}</b>
                    {t.importDoneBody(result.shows, result.episodes, result.movies)}
                    {result.lists > 0 && <> {t.importDoneLists(num(result.lists, locale))}</>}
                  </Alert>
                  {result.listsSkipped > 0 && <Alert tone="info">{t.importListsFull}</Alert>}

                  {result.unmatched.length > 0 && (
                    <div className="rounded-control border border-border bg-surface-2 p-3">
                      <p className="text-12 font-bold mb-1">
                        {t.importUnmatchedTitle(num(result.unmatched.length, locale))}
                      </p>
                      <p className="text-12 text-muted mb-2">{t.importUnmatchedHint}</p>
                      <p className="text-12 text-muted leading-relaxed break-words">
                        {result.unmatched.join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
              )}
      </>
    );
  };
  const w = webWords(locale);
  const FILES: Record<PanelId, string> = { imdb: "csv", mal: "xml · gz", letterboxd: "zip · csv", simkl: "zip · json · csv", bingers: "zip · csv", tvtime: "zip", auto: "zip · csv · json" };

  return (
    <>
      {/* ===== المصادرُ صفوفٌ ===== */}
      {/* 🆕 R273 — حقولُ الملفّات خارج الأوراق: الورقةُ لا تُرسم مغلقةً، وزرُّ بطاقة الحاسوب يحتاج حقلَه حاضراً */}
      {sources.map((src) => (
        <input
          key={`f-${src.id}`}
          ref={refOf(src.id)}
          type="file"
          multiple
          accept={src.id === "auto" ? ".zip,.csv,.tsv,.txt,.json,.gz,.xml" : SOURCES[src.id].accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files;
            if (f && f.length) run(f, src.id);
            e.target.value = "";
          }}
        />
      ))}

      {/* 🆕 R273 — **الاستيرادُ على الحاسوب بطاقات** (أحمد ١٩ نوفمبر — «أ»): كلُّ مصدرٍ بطاقةٌ فيها طريقةُ التصدير وزرُّ رفع الملف
          ظاهرين، والتقدّمُ والحصيلةُ داخلها — من يفتح الصفحةَ جاء من تطبيقٍ بعينه فيجده ويرفع بضغطة. وتحت ١٢٨٠ الصفوفُ والأوراقُ كما هي. */}
      <section className="hidden desk:block">
        <h2 className="mb-2.5 text-15 font-bold">{t.importSection}</h2>
        <div className="grid grid-cols-3 gap-3.5">
          {sources.map((src) => (
            <div key={`c-${src.id}`} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <b className="text-15 font-bold">{src.title}</b>
                <span className="ms-auto rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-muted" dir="ltr">{FILES[src.id]}</span>
              </div>
              <p className="flex-1 text-12 leading-relaxed text-muted">{src.hint}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => refOf(src.id).current?.click()}
                className={buttonClass({ variant: "primary", size: "md", className: "w-full justify-center" })}
              >
                <Icon name="download" size={16} />
                {t.importPickFile}
              </button>
              {busy && active === src.id ? (
                <button type="button" onClick={() => { stop.current = true; }} className={buttonClass({ variant: "ghost", size: "sm", className: "self-center" })}>
                  {t.importCancel}
                </button>
              ) : null}
              {status(src.id)}
            </div>
          ))}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4">
            <b className="text-15 font-bold">{t.importTraktTitle}</b>
            <div className="flex-1">
              <p className="text-12 leading-relaxed text-muted">{traktReady ? w.traktHint : w.traktOff}</p>
              {traktReady && <p className="mt-2 text-[11px] leading-relaxed text-muted">{w.traktNotice}</p>}
            </div>
            {traktReady ? (
              <a href="/api/trakt/start" className={buttonClass({ variant: "primary", size: "md", className: "w-full justify-center" })}>
                <Icon name="share" size={16} />
                {t.importTraktConnect}
              </a>
            ) : (
              <span className={buttonClass({ variant: "surface", size: "md", className: "w-full justify-center opacity-50 pointer-events-none" })}>{t.settingsSoonTitle}</span>
            )}
            {traktMsg ? <Alert tone={trakt === "ok" ? "success" : "error"}>{traktMsg}</Alert> : null}
          </div>
        </div>
        <p className="mt-2.5 text-12 leading-relaxed text-muted">{t.importHint}</p>
      </section>

      <div className="desk:hidden space-y-4">
      <SettingsGroup label={t.importSection}>
        {sources.map((src) => (
          <SettingsRow
            key={src.id}
            icon="download"
            title={src.title}
            subtitle={src.hint}
            onClick={() => setOpen(src.id)}
          />
        ))}
        {/* **وTrakt صفٌّ في السجلِّ نفسِه** — **وبابٌ مغلقٌ في مكانه
            أصدقُ من بابٍ محذوف** (D-155). **ويُعطَّل حين لا مفاتيح**
            فلا يُفتح ليُقال له «غير متاح». */}
        <SettingsRow
          icon="share"
          title={t.importTraktTitle}
          subtitle={traktReady ? w.traktHint : w.traktOff}
          onClick={traktReady || traktMsg ? () => setOpen("trakt") : undefined}
          value={traktReady ? undefined : t.settingsSoonTitle}
        />
      </SettingsGroup>
      <p className="px-1 text-12 text-muted leading-relaxed">{t.importHint}</p>
      </div>

      {/* ===== ورقةُ كلِّ مصدر — **مصنعٌ واحدٌ يرسمها الثلاث** (D-153) ===== */}
      {sources.map((src) => {
        const mine = active === src.id;
        /* **المرجعُ يُختار هنا لا يُخزَّن في السجلّ**: مرجعٌ داخل مصفوفةٍ
           تُبنى في كلِّ رسمة يقرؤه المدقّقُ «قراءةَ مرجعٍ أثناء الرسم» */
        const inputRef = refOf(src.id);
        return (
          <SettingsBottomSheet
            key={src.id}
            open={open === src.id}
            title={src.title}
            onCancel={() => setOpen(null)}
            onDone={() => setOpen(null)}
            cancelLabel={t.cancelLabel}
            doneLabel={t.doneLabel}
          >
            <div className={`${sheetScroll} px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
              <p className="text-12 text-muted leading-relaxed mb-3">{src.hint}</p>


              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  className={buttonClass({ variant: "surface", size: "md", className: "h-11" })}
                >
                  <Icon name="download" size={16} />
                  {t.importPickFile}
                </button>
                {busy && mine && (
                  <button
                    type="button"
                    onClick={() => {
                      stop.current = true;
                    }}
                    className={buttonClass({ variant: "ghost", size: "md", className: "h-11" })}
                  >
                    {t.importCancel}
                  </button>
                )}
              </div>
              <p className="text-12 text-muted mt-2">{src.fileHint}</p>

              {status(src.id)}
            </div>
          </SettingsBottomSheet>
        );
      })}

      {/* 🆕 T500 — مراجعةُ ملفٍّ لا نعرفه قبل أن يُكتب منه شيء */}
      {review && (
        <ImportAutoReview
          locale={locale}
          tables={review.tables}
          skipped={review.skipped}
          onCancel={() => setReview(null)}
          onImport={(tables, opts) => void runReviewed(tables, opts)}
        />
      )}

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
          {/* D-155: الوصفُ يتبع الحال. حين لا مفاتيح، وعدُ «نجلب مشاهداتك
              مباشرةً» كذبٌ يقرؤه المستخدم فوق سطرٍ يقول إنه غير متاح. */}
          <p className="text-12 text-muted leading-relaxed mb-3">
            {traktReady ? w.traktHint : w.traktOff}
          </p>
          {traktReady && <p className="-mt-1 mb-3 text-[11px] leading-relaxed text-muted">{w.traktNotice}</p>}

          {traktReady ? (
            /* رابطٌ لا زرّ فعل: الوجهة خارجية ويجب أن تُرى في شريط العنوان
               ويقبل الفتح في تبويبٍ جديد كأي رابط */
            <a
              href="/api/trakt/start"
              className={buttonClass({ variant: "surface", size: "md", className: "h-11" })}
            >
              <Icon name="share" size={16} />
              {t.importTraktConnect}
            </a>
          ) : (
            <>
              <Alert tone="info">{t.importTraktOff}</Alert>
              {/* البابُ المغلق يُشار منه إلى بابٍ يفتح: قارئ D-154 يقرأ تصدير
                  تراكت نفسه إن حمل `tmdb` — بلا سطرٍ إضافي في الشيفرة. */}
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
