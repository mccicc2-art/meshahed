"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDict, num, type Locale } from "@/lib/i18n";
import { parseTvTimeFiles } from "@/lib/tvtime";
import { parseLetterboxdFiles } from "@/lib/letterboxd";
import { parseTrackerExport } from "@/lib/trackerExport";
import { groupForResolve, recordKey, type ParseOutcome, type RawRecord } from "@/lib/importParse";
import {
  IMPORT_CAPS,
  type ImportMovie,
  type ImportShow,
  type ResolveResult,
} from "@/lib/importer";
import { resolveImportItems, applyImportChunk, finishImport } from "@/lib/actions";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { Icon } from "./Icon";
import { SettingsGroup } from "./settings/SettingsGroup";
import { SettingsRow } from "./settings/SettingsRow";
import { SettingsBottomSheet } from "./settings/SettingsBottomSheet";
import { sheetScroll } from "./ui/controls";

type Phase = "idle" | "reading" | "matching" | "writing" | "done";

/**
 * مصادر الملفات — **سجلٌّ لا فرعُ شرط** (D-153).
 *
 * كل مصدرٍ سطرٌ واحد هنا: اسمُه ومحلّلُه وما يقبله من امتدادات. وإضافة
 * الخدمة القادمة سطرٌ في هذا السجلّ، لا نسخةٌ ثانية من مسار الاستيراد
 * كلِّه — فالمراحل الثلاث (قراءة · مطابقة · كتابة) واحدةٌ للجميع.
 */
type SourceId = "tvtime" | "letterboxd" | "simkl";

const SOURCES: Record<
  SourceId,
  { parse: (f: { name: string; buf: ArrayBuffer }[]) => Promise<ParseOutcome>; accept: string }
> = {
  tvtime: { parse: parseTvTimeFiles, accept: ".zip,.csv,.json" },
  letterboxd: { parse: parseLetterboxdFiles, accept: ".zip,.csv" },
  simkl: { parse: parseTrackerExport, accept: ".zip,.json,.csv" },
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
  const stop = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  /** أيُّ مصدرٍ يعمل الآن — الشريط والنتيجة يظهران تحت قسمه وحده */
  const [active, setActive] = useState<SourceId | null>(null);
  /** أيُّ مصدرٍ ورقتُه مفتوحة — والمصادرُ صفوفٌ لا بطاقات (D-555) */
  /* **وتُفتح على Trakt إن عاد الرابطُ برسالة**: المستخدمُ عاد للتوّ من
     موقعٍ خارجيّ — **ونتيجةُ رحلته لا يجوز أن تكون خلف صفٍّ يُضغط.** */
  const [open, setOpen] = useState<SourceId | "trakt" | null>(() =>
    params.get("trakt") ? "trakt" : null,
  );
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    shows: number;
    episodes: number;
    movies: number;
    unmatched: string[];
  } | null>(null);

  // رسالة العودة من Trakt — تُقرأ من الرابط الذي أعاده مسار الاستدعاء
  const trakt = params.get("trakt");
  const traktMsg =
    trakt === "ok"
      ? t.importDoneBody(
          num(Number(params.get("sh") ?? 0), locale),
          num(Number(params.get("ep") ?? 0), locale),
          num(Number(params.get("mv") ?? 0), locale),
        )
      : trakt === "off"
        ? t.importTraktOff
        : trakt === "denied"
          ? t.importTraktDenied
          : trakt === "failed"
            ? t.importTraktFailed
            : null;

  async function run(files: FileList, source: SourceId) {
    stop.current = false;
    setActive(source);
    setError(null);
    setResult(null);
    setPct(0);
    setPhase("reading");

    try {
      const bufs = await Promise.all(
        [...files].map(async (f) => ({ name: f.name, buf: await f.arrayBuffer() })),
      );
      const { records } = await SOURCES[source].parse(bufs);
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
      const showMap = new Map<number, ImportShow>();
      const movieMap = new Map<number, ImportMovie>();
      const unmatched = new Set<string>();

      /* المفتاح من `importParse` نفسه لا نسخةً منه: لو انحرف أحدهما عن
         الآخر لفشلت كل مطابقةٍ بصمتٍ تامّ — لا خطأ، فقط نتيجةٌ فارغة */
      const keyOf = (r: RawRecord): string => recordKey(r);

      const addShow = (hit: NonNullable<ResolveResult>) => {
        let sh = showMap.get(hit.tmdbId);
        if (!sh) {
          sh = { tmdbId: hit.tmdbId, title: hit.title, posterPath: hit.posterPath, episodes: [] };
          showMap.set(hit.tmdbId, sh);
        }
        return sh;
      };

      for (const r of records) {
        /* المعرّف بيده — يُبنى مباشرةً. والعنوان من المصدر، والملصق
           يُترك فارغاً تملؤه `FollowMetaSync` عند أوّل زيارة (نفس قاعدة
           مستورد الخادم: مئاتُ طلبات TMDB داخل استيرادٍ واحد تُنهي المهلة) */
        if (r.kind === "tmdb-show") {
          const sh = showMap.get(r.tmdbId) ?? {
            tmdbId: r.tmdbId,
            title: r.title,
            posterPath: null,
            episodes: [],
          };
          sh.episodes.push(...r.episodes);
          if (r.rating != null) sh.rating = r.rating;
          showMap.set(r.tmdbId, sh);
          continue;
        }
        if (r.kind === "tmdb-movie") {
          const prev = movieMap.get(r.tmdbId);
          movieMap.set(r.tmdbId, {
            tmdbId: r.tmdbId,
            title: r.title,
            posterPath: null,
            /* «أنوي مشاهدته» لا يُختم مشاهَداً — ومشاهدةٌ سابقة تغلبه */
            watched: (prev?.watched ?? false) || !r.planned,
            at: prev?.at ?? r.at,
            rating: r.rating ?? prev?.rating,
          });
          continue;
        }

        const hit = resolved.get(keyOf(r));
        if (!hit) {
          const label =
            r.kind === "ep-name" || r.kind === "rating-show"
              ? r.show
              : r.kind === "movie-name" || r.kind === "movie-watchlist"
                ? r.name
                : "";
          if (label) unmatched.add(label);
          continue;
        }

        if (r.kind === "ep-name") {
          addShow(hit).episodes.push({ s: r.s, e: r.e, at: r.at });
        } else if (r.kind === "ep-tvdb") {
          // المطابقة أعادت المسلسل والموسم والحلقة معاً
          if (hit.season != null && hit.episode != null) {
            addShow(hit).episodes.push({ s: hit.season, e: hit.episode, at: r.at });
          }
        } else if (r.kind === "show-tvdb") {
          addShow(hit);
        } else if (r.kind === "rating-show") {
          addShow(hit).rating = r.rating;
        } else if (r.kind === "movie-watchlist") {
          /* لا يدهس مشاهدةً سبقته: من شاهد الفيلم ثم بقي في قائمته،
             المشاهدة هي الحقيقة الأقوى */
          if (!movieMap.has(hit.tmdbId)) {
            movieMap.set(hit.tmdbId, {
              tmdbId: hit.tmdbId,
              title: hit.title,
              posterPath: hit.posterPath,
              watched: false,
            });
          }
        } else if (r.kind === "movie-name") {
          const prev = movieMap.get(hit.tmdbId);
          movieMap.set(hit.tmdbId, {
            tmdbId: hit.tmdbId,
            title: hit.title,
            posterPath: hit.posterPath,
            watched: true,
            /* أقدمُ تاريخٍ يُحفظ: اليوميات تحمل يوم المشاهدة الحقيقي،
               وملفُّ «watched» يحمل يوم التسجيل — والأوّل أصدق */
            at: prev?.at && r.at ? (prev.at < r.at ? prev.at : r.at) : (prev?.at ?? r.at),
            rating: r.rating ?? prev?.rating,
          });
        }
      }

      // حلقةٌ واحدة مهما تكرّرت في التصدير (إعادة مشاهدةٍ أو خطأ تصدير)
      for (const sh of showMap.values()) {
        const seen = new Set<string>();
        sh.episodes = sh.episodes.filter((ep) => {
          const k = `${ep.s}-${ep.e}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }

      const shows = [...showMap.values()].slice(0, IMPORT_CAPS.shows);
      const movies = [...movieMap.values()].slice(0, IMPORT_CAPS.movies);

      // ===== الكتابة =====
      setPhase("writing");
      setPct(0);
      let sC = 0;
      let eC = 0;
      let mC = 0;
      const steps = Math.ceil(shows.length / 5) + Math.ceil(movies.length / 60) || 1;
      let step = 0;

      for (let i = 0; i < shows.length; i += 5) {
        if (stop.current) break;
        const r = await applyImportChunk({ shows: shows.slice(i, i + 5), movies: [] });
        sC += r.shows;
        eC += r.episodes;
        setPct(Math.round((++step / steps) * 100));
      }
      for (let i = 0; i < movies.length; i += 60) {
        if (stop.current) break;
        const r = await applyImportChunk({ shows: [], movies: movies.slice(i, i + 60) });
        mC += r.movies;
        setPct(Math.round((++step / steps) * 100));
      }

      await finishImport();
      setResult({ shows: sC, episodes: eC, movies: mC, unmatched: [...unmatched].slice(0, 60) });
      setPhase("done");
      router.refresh();
    } catch (e) {
      setPhase("idle");
      setError((e as Error).message);
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
      id: "tvtime" as const,
      title: t.importTvTimeTitle,
      hint: t.importTvTimeHint,
      fileHint: t.importFileHint,
    },
  ];

  return (
    <>
      {/* ===== المصادرُ صفوفٌ ===== */}
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
          subtitle={traktReady ? t.importTraktHint : t.importTraktWhy}
          onClick={traktReady || traktMsg ? () => setOpen("trakt") : undefined}
          value={traktReady ? undefined : t.settingsSoonTitle}
        />
      </SettingsGroup>
      <p className="px-1 -mt-4 text-12 text-muted leading-relaxed">{t.importHint}</p>

      {/* ===== ورقةُ كلِّ مصدر — **مصنعٌ واحدٌ يرسمها الثلاث** (D-153) ===== */}
      {sources.map((src) => {
        const mine = active === src.id;
        /* **المرجعُ يُختار هنا لا يُخزَّن في السجلّ**: مرجعٌ داخل مصفوفةٍ
           تُبنى في كلِّ رسمة يقرؤه المدقّقُ «قراءةَ مرجعٍ أثناء الرسم» */
        const inputRef =
          src.id === "letterboxd" ? letterboxdRef : src.id === "simkl" ? simklRef : tvtimeRef;
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

              <input
                ref={inputRef}
                type="file"
                multiple
                accept={SOURCES[src.id].accept}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files;
                  if (f && f.length) run(f, src.id);
                  e.target.value = "";
                }}
              />

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

              {error && mine && (
                <div className="mt-3">
                  <Alert tone="error">{error}</Alert>
                </div>
              )}

              {phase === "done" && result && mine && (
                <div className="mt-4 space-y-3">
                  <Alert tone="success">
                    <b className="block">{t.importDone}</b>
                    {t.importDoneBody(
                      num(result.shows, locale),
                      num(result.episodes, locale),
                      num(result.movies, locale),
                    )}
                  </Alert>

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
            </div>
          </SettingsBottomSheet>
        );
      })}

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
            {traktReady ? t.importTraktHint : t.importTraktWhy}
          </p>

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
