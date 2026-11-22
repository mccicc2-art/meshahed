import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { File, Paths } from "expo-file-system";
import { inflateSync } from "fflate";
import { useApp } from "../state";
import { Text, Button } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { api, downloadTo, ApiError } from "../api";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, Row } from "./ui";
import { messageOf } from "./api";
import { num } from "@/core/i18n";
import { parseTvTimeFiles } from "@/core/tvtime";
import { parseLetterboxdFiles } from "@/core/letterboxd";
import { parseTrackerExport } from "@/core/trackerExport";
import { parseImdbFiles } from "@/core/imdb";
import { parseMalFiles } from "@/core/mal";
import { parseBingersFiles } from "@/core/bingers";
import { setInflateRaw, type ParseOutcome, type RawRecord } from "@/core/importParse";
import { autoRecords, readAuto, runHeaders, type AutoOptions, type AutoTable, type KnownSource } from "@/core/importAuto";
import { importRunCounts, importRunTitle, importRunWhen, type ImportRun, type ImportRunSource } from "@/core/importer";
import { ImportAutoReview } from "./ImportAutoReview";
import { ImportHistorySheet } from "./ImportHistorySheet";
import { importRecords, type ImportResult } from "./importPipeline";
import { importFromTrakt } from "./trakt";

/**
 * ====== الاستيراد والتصدير (🆕 D-1369 · V-C · C6) — `settings/import/page.tsx` ======
 *
 * 🔑 **المراحلُ الثلاث في أماكنها كما في الويب** (`ImportPanel`): **القراءةُ في الجهاز** (الملفُّ لا يُرفع — المحلّلاتُ
 * الثلاثةُ من `core` بحرفها)، **والمطابقةُ على الخادم** (مفتاحُ TMDB لا يغادره)، **والكتابةُ دفعاتٍ صغيرة** يتقدّم بها الشريط
 * وما كُتب منها يبقى. والتجميعُ بينها `buildImport` الواحدة — لا نسخةَ ثانيةً من قواعده هنا.
 *
 * ⚖️ **الفكُّ بـ`fflate`**: محرّكُ التطبيق لا يحمل `DecompressionStream` التي يقرأ بها الويب، فيُسجَّل الفاكُّ مرّةً عند تحميل
 * هذا الملفّ (جافاسكربت خالص — لا يغيّر الثنائيّ).
 * ⚖️ **«تصدير بياناتك» هنا وحدَه** (قرارُ أحمد «7 أ»): انتقل من «الخصوصيّة» إلى حيث هو في الويب — بياناتُك داخلةً وخارجةً
 * في مكانٍ واحد (D-462)، و«الخصوصيّة» بقيت لمن يراك.
 * 🆕 **Trakt صفٌّ يعمل** (R281، أحمد ١٩ نوفمبر): كان مغلقاً («9 أ» · D-155) والخدمةُ مطفأة؛ صار الربطُ قائماً في الموقع
 * (R275–R280) فانتقل إلى هنا بنافذة الدخول نفسِها التي يربط بها Google (`trakt.ts`). والنتيجةُ إشعارٌ واحد من المضيف القائم.
 * 🆕 T507 — **رفعٌ واحدٌ وأدلّةٌ ستّة** (أحمد ٢١–٢٢ نوفمبر «١أ»، و«آخر استيراد» «تحت تراكت»): صفُّ الرفع يتعرّف على مصدر الملفّ،
 * والتطبيقاتُ الستّة أدلّةُ تصديرٍ تُفتح ورقتُها بشرحها وزرِّ «ارفع الملف الآن» (يُقرأ الملفُّ بقارئ ذلك التطبيق أوّلاً). والتقدّمُ
 * والحصيلةُ في ورقة الرفع الواحدة — كما في الويب.
 */
setInflateRaw((data) => inflateSync(data));

type SourceId = KnownSource;
/** 🆕 T507 — الرفعُ الواحدُ يقبل صيغَ المصادر كلِّها: لا يعرف من أين جاء الملفّ قبل أن يقرأه */
const ACCEPT_ALL = [".zip", ".csv", ".tsv", ".txt", ".json", ".gz", ".xml"] as const;
type Phase = "idle" | "reading" | "matching" | "writing" | "done";
type Result = ImportResult & { spoilerNote: boolean };

/** سجلٌّ لا فرعُ شرط (D-153): مصدرٌ جديدٌ سطرٌ هنا لا نسخةٌ من المسار */
const SOURCES: Record<SourceId, { parse: (f: { name: string; buf: ArrayBuffer }[]) => Promise<ParseOutcome> }> = {
  /* 🆕 IMDb — ملفّاتٌ عدّة (التقييمات · قائمة المشاهدة · القوائم) تُختار معاً */
  imdb: { parse: parseImdbFiles },
  /* 🆕 MyAnimeList — `animelist_….xml.gz` كما نزل (يُفكّ بالفاكّ المسجَّل أعلاه) */
  mal: { parse: parseMalFiles },
  letterboxd: { parse: parseLetterboxdFiles },
  simkl: { parse: parseTrackerExport },
  /* 🆕 Bingers — zip الأربعة كما نزل (أحمد ٢٠ نوفمبر) */
  bingers: { parse: parseBingersFiles },
  tvtime: { parse: parseTvTimeFiles },
};

/** ورقةٌ واحدةٌ مفتوحةٌ في كلِّ مرّة (iOS لا يقدّم نافذتين في آنٍ): دليلُ تطبيق، أو الرفعُ (تقدّمُه وحصيلتُه)، أو «استيراداتك» */
type Open = SourceId | "upload" | "history" | null;

export function ImportScreen() {
  const { t, tokens, locale } = useApp();
  const toast = useRef<ToastHostRef>(null);
  const dict = t as unknown as Record<string, unknown>;
  const stop = useRef(false);
  /* من غادر الشاشةَ والاستيرادُ يعمل يوقفه: حلقةٌ تكتب في الخلفيّة بلا شريطٍ يُرى ولا زرِّ إيقاف أسوأُ من توقّفٍ يُعاد (وكلُّ كتابةٍ `upsert`) */
  useEffect(() => () => void (stop.current = true), []);

  const [open, setOpen] = useState<Open>(null);
  /** جداولُ ملفٍّ لا نعرفه تنتظر المراجعة — ومعها ملفّاتُه إن قال «هو من تطبيقٍ نعرفه» */
  const [review, setReview] = useState<{ tables: AutoTable[]; skipped: string[]; bufs: { name: string; buf: ArrayBuffer }[] } | null>(null);
  const [known, setKnown] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const busy = phase === "reading" || phase === "matching" || phase === "writing";

  /* 🆕 T507 — «استيراداتك»: تُقرأ عند فتح الشاشة وبعد كلِّ استيراد. خادمٌ قبل T507 أو خطأ ⇐ لا صفّ */
  const refreshRuns = useCallback(() => {
    api<{ runs: ImportRun[] }>("/api/v1/me/import/runs")
      .then((r) => setRuns(Array.isArray(r.data?.runs) ? r.data.runs : []))
      .catch(() => setRuns([]));
  }, []);
  useEffect(() => {
    refreshRuns();
  }, [refreshRuns]);

  /** ورقتان أصليّتان لا تُعرضان معاً: تُغلق الأولى وتُفتح الثانية بعد انغلاقها */
  const swap = (next: () => void) => {
    setOpen(null);
    setTimeout(next, 350);
  };

  async function pick(hint: SourceId | null) {
    if (busy) return;
    haptic.pick();
    setError(null);
    /* 🆕 T507 — **ورقةٌ مفتوحةٌ تُغلق قبل المنتقي** (مراجعةُ الوكيل الثاني، البند ٥): المنتقي نافذةٌ أصليّةٌ ثالثة، وبعده تُفتح ورقةُ
       الرفع — ودليلٌ ما زال مفتوحاً تحتهما يجعل iOS يُسقط إحداهما فيمضي الاستيرادُ بلا شريطٍ ولا «إيقاف» */
    if (open) {
      setOpen(null);
      await new Promise((r) => setTimeout(r, 350));
    }
    try {
      /* تُحمَّل عند الحاجة: أوّلُ استعمالٍ لمنتقي الملفّات (في البناء منذ 1.12.5، D-1350) — وإن غاب في ثنائيٍّ ما فرسالةٌ في الورقة لا سقوطُ الشاشة */
      const Picker = await import("expo-document-picker");
      /* `*‎/*`: أنواعُ MIME للـcsv والـzip تختلف بين مديري الملفّات على أندرويد، وفلترٌ بها يُخفي الملفَّ الصحيح؛ الامتدادُ يُفحص هنا */
      const got = await Picker.getDocumentAsync({ type: "*/*", multiple: true, copyToCacheDirectory: true });
      if (got.canceled || !got.assets?.length) return;
      const files = got.assets.filter((a) => ACCEPT_ALL.some((x) => a.name.toLowerCase().endsWith(x)));
      setResult(null);
      if (!files.length) {
        setPhase("idle");
        setError(t.importNothing);
        return void setOpen("upload");
      }
      await run(files.map((a) => ({ name: a.name, uri: a.uri })), hint);
    } catch {
      setPhase("idle");
      setError(t.apiInternal);
      setOpen("upload");
    }
  }

  async function run(files: { name: string; uri: string }[], hint: SourceId | null) {
    stop.current = false;
    setOpen("upload");
    setError(null);
    setResult(null);
    setKnown(null);
    setPct(0);
    setPhase("reading");
    /* خطأٌ قبل اكتمال القراءة ملفٌّ لم يُفهم؛ وبعدها شبكةٌ أو خادم — رسالتان لا واحدة تقول «لم نتعرّف» عن انقطاع الاتصال */
    let parsed = false;
    try {
      const bufs = await Promise.all(files.map(async (f) => ({ name: f.name, buf: await new File(f.uri).arrayBuffer() })));
      /* نسخُ المنتقي في الكاش تُمسح بعد قراءتها: تصديرُ سنواتٍ قد يكون عشراتِ الميجابايت ولا قارئَ له بعد هذا السطر */
      /* 🔴 **الكاشُ وحدَه**: مسارٌ خارجَه هو ملفُّ صاحبه الأصليّ — لا يُمسّ مهما أعاد المنتقي */
      for (const f of files) {
        if (!f.uri.startsWith(Paths.cache.uri)) continue;
        try {
          new File(f.uri).delete();
        } catch {
          /* نسخةٌ لم تُحذف تبقى في كاشٍ يمسحه النظام — لا يوقف الاستيراد */
        }
      }
      /* 🆕 T507 — من جاء من دليل تطبيقٍ يُقرأ ملفُّه بقارئ ذلك التطبيق أوّلاً: طريقُه قبل التوحيد بحرفه (مراجعةُ الوكيل، البند ١٠) */
      if (hint) {
        const records = (await SOURCES[hint].parse(bufs)).records;
        if (records.length) {
          parsed = true;
          return void (await importParsed(records, hint));
        }
      }
      const got = await readAuto(bufs);
      if (got.kind === "tables") {
        setPhase("idle");
        return void swap(() => setReview({ tables: got.tables, skipped: got.skipped, bufs }));
      }
      if (got.kind === "none") {
        setPhase("idle");
        return void setError(got.skipped.length ? `${t.importNothing} ${t.importAutoSkipped(got.skipped.join(" · "))}` : t.importNothing);
      }
      setKnown(t.importAutoKnown(sourceTitle(got.source)));
      const records = (await SOURCES[got.source].parse(bufs)).records;
      parsed = true;
      await importParsed(records, got.source);
    } catch (e) {
      setPhase("idle");
      setError(e instanceof ApiError ? messageOf(e, dict, t.apiInternal) : parsed ? t.apiInternal : t.importNothing);
    }
  }

  /** بعد المراجعة: الصفوفُ بالمعاني التي أقرّها ⇐ سجلّاتٌ في المسار نفسِه — والتقدّمُ في ورقة الرفع بعد انغلاق المراجعة */
  async function runReviewed(tables: AutoTable[], opts: AutoOptions) {
    setReview(null);
    setTimeout(() => setOpen("upload"), 350);
    await guarded(() => importParsed(autoRecords(tables, opts), "auto", runHeaders(tables)));
  }

  /** 🆕 T507 — «الملف من تطبيقٍ نعرفه؟»: الملفّاتُ نفسُها بقارئ ذلك التطبيق */
  async function runAs(source: SourceId) {
    const bufs = review?.bufs ?? [];
    setReview(null);
    setTimeout(() => setOpen("upload"), 350);
    await guarded(async () => importParsed((await SOURCES[source].parse(bufs)).records, source));
  }

  async function guarded(fn: () => Promise<void>) {
    setError(null);
    setResult(null);
    setPhase("reading");
    try {
      await fn();
    } catch (e) {
      setPhase("idle");
      setError(e instanceof ApiError ? messageOf(e, dict, t.apiInternal) : t.apiInternal);
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
    /* 🆕 المطابقةُ والتجميعُ والكتابةُ في `importPipeline.ts` — قارئُها الثاني استيرادُ Plex (هجرة ٢٣٥) */
    const done = await importRecords(
      records,
      { stopped: () => stop.current, phase: setPhase, pct: setPct },
      /* «ما في Loopz يبقى» لكلِّ ملفٍّ كما في الويب (أحمد ٢٠ نوفمبر «١ أ») · 🆕 T507 — المصدرُ وأعمدةُ الملفّ المجهول لـ«استيراداتك» */
      { keep: true, favoritesName: t.favListName, source, headers },
    );
    refreshRuns();
    if (!done) return void setPhase("idle");
    setResult({ ...done, spoilerNote: source === "letterboxd" && done.reviews > 0 });
    setPhase("done");
    haptic.success();
  }

  /* 🆕 R281 — Trakt: لا ملفَّ ولا مراحل — نافذةُ موافقةٍ ثمّ طلبٌ واحدٌ على الخادم؛ الصفُّ يدور حتى يعود */
  const [traktBusy, setTraktBusy] = useState(false);
  async function connectTrakt() {
    if (traktBusy || busy) return;
    haptic.pick();
    setTraktBusy(true);
    try {
      const r = await importFromTrakt();
      if (r.kind === "done") {
        haptic.success();
        /* 🆕 نغمةُ النجاح صريحةً: الإشعارُ بلا نغمةٍ خطأٌ أحمر (D-1323) — فكان «تمّ الاستيراد» يظهر أحمرَ (أحمد ٢٢ نوفمبر) */
        toast.current?.say(
          `${t.importDone} — ${t.importDoneBody(r.shows, r.episodes, r.movies)}${r.reviews > 0 ? ` ${t.importDoneReviews(num(r.reviews, locale))}` : ""}`,
          undefined,
          undefined,
          "success",
        );
        refreshRuns();
      } else {
        toast.current?.say(r.kind === "cancel" ? t.importTraktDenied : t.importTraktFailed);
      }
    } finally {
      setTraktBusy(false);
    }
  }

  /** الوصفةُ في `PrivacyScreen` قبل D-1369 بحرفها (D-1359): كاشٌ ثمّ ورقةُ المشاركة، وتصديرٌ جديدٌ يمسح ما قبله */
  const [exporting, setExporting] = useState(false);
  async function exportData() {
    if (exporting) return;
    haptic.pick();
    setExporting(true);
    try {
      for (const f of Paths.cache.list()) {
        if (f instanceof File && f.name.startsWith("loopz-export-")) f.delete();
      }
      const file = new File(Paths.cache, `loopz-export-${new Date().toISOString().slice(0, 10)}.json`);
      await downloadTo("/api/v1/me/export", file);
      const Sharing = await import("expo-sharing");
      if (!(await Sharing.isAvailableAsync())) throw new Error("sharing unavailable");
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json", dialogTitle: t.dataExportTitle });
    } catch (e) {
      toast.current?.say(e instanceof ApiError && e.error.code === "rate_limited" ? t.deleteAccountBusyGate : t.dataExportFailed);
    } finally {
      setExporting(false);
    }
  }

  /* الأدلّةُ الستّة بترتيبها كما في الويب — IMDb أوّلاً: أوسعُها جمهوراً وأدقُّها مطابقة */
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
  const guide = guides.find((g) => g.id === open);
  const last = runs[0] ?? null;
  const phaseLabel = phase === "reading" ? t.importReading : phase === "matching" ? t.importMatching : phase === "writing" ? t.importWriting : "";

  return (
    <SettingsScreen title={t.setImport} toast={toast}>
      <View>
        <Group label={t.importSection}>
          {/* خانةُ الرفع الواحدة — 🆕 بطاقةٌ بزرٍّ أساسيّ لا صفٌّ بسهم (أحمد ٢٢ نوفمبر «١ أ»: هكذا اتّفقنا وهكذا هي في الويب؛
              صفٌّ كصفوف الأدلّة تحته لا يُفرَّق عنها). والتقدّمُ في سطرها حين تُغلق الورقة، والزرُّ يفتحها ما دام عملٌ جارياً */}
          <View style={{ padding: 14, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <Icon name="download" size={20} color={tokens.muted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={15} weight="600">{t.importUploadTitle}</Text>
                <Text size={12} weight="500" muted style={{ marginTop: 2, lineHeight: 18 }}>{t.importUploadHint}</Text>
              </View>
            </View>
            {/* أثناءَ العمل يحمل الزرُّ التقدّمَ ويبقى فعّالاً (لا `busy` الذي يعطّله): ضغطُه يفتح الورقةَ وفيها «إيقاف» */}
            <Button
              label={busy ? `${phaseLabel} ${num(pct, locale)}%` : t.importUploadPick}
              onPress={() => (busy || phase === "done" || error ? setOpen("upload") : void pick(null))}
            />
          </View>
          {/* **وTrakt صفٌّ في السجلِّ نفسِه**، و«آخر استيراد» تحته (أحمد ٢٢ نوفمبر «مكانها تحت تراكت»). 🆕 رمزُه الربطُ لا
              سهمُ المشاركة: السهمُ الصاعد يُقرأ «تصدير» */}
          <Row icon="link" title={t.importTraktTitle} subtitle={traktBusy ? t.importTraktWorking : t.importTraktHint} busy={traktBusy} onPress={() => void connectTrakt()} />
          {last ? (
            <Row
              icon="history"
              title={t.importLastRun(importRunTitle(last.source, t))}
              subtitle={`${importRunWhen(last.createdAt, locale === "en" ? "en" : "ar")} · ${importRunCounts(last, t, (n) => num(n, locale))}`}
              onPress={() => setOpen("history")}
            />
          ) : null}
        </Group>
      </View>
      <View>
        <Group label={t.importGuidesLabel}>
          {guides.map((g) => (
            /* 🆕 الاسمُ وحدَه (أحمد ٢٢ نوفمبر «٣ أ»): الخطواتُ كاملةً في الورقة، وسطرُها في الصفّ كان يُقصّ بـ«…» */
            <Row key={g.id} icon="book" title={g.title} onPress={() => setOpen(g.id)} />
          ))}
        </Group>
        <Text size={12} muted style={{ paddingHorizontal: 4, marginTop: 8, lineHeight: 19 }}>{t.importHint}</Text>
      </View>
      <Group>
        <Row icon="download" title={t.dataExportTitle} value={exporting ? t.dataExportBusy : undefined} busy={exporting} onPress={() => void exportData()} />
      </Group>

      {/* ===== ورقةُ الدليل: الشرحُ كاملاً وزرُّ «ارفع الملف الآن» (بقارئ هذا التطبيق أوّلاً) ===== */}
      {guide ? (
        <Sheet title={guide.title} onClose={() => setOpen(null)}>
          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            <Text size={12} muted style={{ lineHeight: 19, marginBottom: 12 }}>{guide.hint}</Text>
            <Button label={t.importGuideUpload} disabled={busy} onPress={() => void pick(guide.id)} style={{ opacity: busy ? 0.5 : 1 }} />
            <Text size={12} muted style={{ marginTop: 8 }}>{guide.fileHint}</Text>
          </ScrollView>
        </Sheet>
      ) : null}

      {/* ===== ورقةُ الرفع: التقدّمُ والإيقافُ والحصيلة ===== */}
      {open === "upload" ? (
        <Sheet title={t.importUploadTitle} onClose={() => setOpen(null)}>
          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            <Text size={12} muted style={{ lineHeight: 19, marginBottom: 12 }}>{t.importUploadHint}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Button label={t.importUploadPick} disabled={busy} onPress={() => void pick(null)} style={{ opacity: busy ? 0.5 : 1 }} />
              {busy ? <Button label={t.importCancel} variant="ghost" onPress={() => void (stop.current = true)} /> : null}
            </View>

            {busy ? (
              <View style={{ marginTop: 16 }}>
                <Text size={12} muted style={{ marginBottom: 6 }}>{phaseLabel}</Text>
                {/* العرضُ بالنسبة والاتّجاهُ من الصفّ: في العربيّة يمتلئ من اليمين كما في الويب (`rtl:origin-right`) */}
                <View style={{ height: 6, borderRadius: 3, backgroundColor: tokens.surface2, overflow: "hidden", flexDirection: "row" }}>
                  <View style={{ width: `${Math.max(2, pct)}%`, backgroundColor: tokens.accent }} />
                </View>
              </View>
            ) : null}

            {known ? <Text size={12} muted style={{ marginTop: 12 }}>{known}</Text> : null}
            {error ? <Note tone="error" body={error} /> : null}

            {phase === "done" && result ? (
              <>
                <Note
                  tone="success"
                  title={t.importDone}
                  body={`${t.importDoneBody(result.shows, result.episodes, result.movies)}${result.lists > 0 ? ` ${t.importDoneLists(num(result.lists, locale))}` : ""}${result.reviews > 0 ? ` ${t.importDoneReviews(num(result.reviews, locale))}` : ""}`}
                />
                {result.listsSkipped > 0 ? <Note tone="error" body={t.importListsFull} /> : null}
                {result.reviewsSkipped > 0 ? <Text size={12} muted style={{ marginTop: 12, lineHeight: 19 }}>{t.importReviewsSkipped(num(result.reviewsSkipped, locale))}</Text> : null}
                {result.spoilerNote ? <Text size={12} muted style={{ marginTop: 8, lineHeight: 19 }}>{t.importReviewsSpoiler}</Text> : null}
                {result.unmatched.length > 0 ? (
                  <View style={{ marginTop: 12, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, padding: 12 }}>
                    <Text size={12} weight="700" style={{ marginBottom: 4 }}>{t.importUnmatchedTitle(num(result.unmatched.length, locale))}</Text>
                    <Text size={12} muted style={{ marginBottom: 8 }}>{t.importUnmatchedHint}</Text>
                    <Text size={12} muted style={{ lineHeight: 19 }}>{result.unmatched.join(" · ")}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </Sheet>
      ) : null}

      {open === "history" ? <ImportHistorySheet runs={runs} onClose={() => setOpen(null)} /> : null}
      {review ? (
        <ImportAutoReview
          tables={review.tables}
          skipped={review.skipped}
          onCancel={() => setReview(null)}
          onImport={(tables, opts) => void runReviewed(tables, opts)}
          onPickSource={(src) => void runAs(src)}
        />
      ) : null}
    </SettingsScreen>
  );
}

/** سطرُ حالٍ داخل الورقة — لونُ النجاح الواحد ولونُ الخطأ الواحد من الرموز (القاعدة ٣)، لا مضيفَ إشعارٍ ثانياً تحت ورقة */
export function Note({ tone, title, body }: { tone: "error" | "success"; title?: string; body: string }) {
  const { tokens } = useApp();
  const c = tone === "error" ? tokens.error : tokens.success;
  return (
    <View style={{ marginTop: 12, borderRadius: radius.control, borderWidth: 1, borderColor: `${c}55`, backgroundColor: `${c}1A`, padding: 12 }}>
      {title ? <Text size={13} weight="700" style={{ marginBottom: 2 }}>{title}</Text> : null}
      <Text size={13} style={{ lineHeight: 20 }}>{body}</Text>
    </View>
  );
}
