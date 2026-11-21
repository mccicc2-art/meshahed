import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { File, Paths } from "expo-file-system";
import { inflateSync } from "fflate";
import { useApp } from "../state";
import { Text, Button } from "../ui";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { downloadTo, ApiError } from "../api";
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
import { autoRecords, readAuto, type AutoOptions, type AutoTable } from "@/core/importAuto";
import { ImportAutoReview } from "./ImportAutoReview";
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
 */
setInflateRaw((data) => inflateSync(data));

type SourceId = "imdb" | "mal" | "letterboxd" | "simkl" | "bingers" | "tvtime";
/** 🆕 T500 — «من تطبيق آخر» ليس قارئاً في السجلّ: يتعرّف على الملفّ فيسلّمه لقارئه، أو يقرؤه بأعمدته بعد مراجعة صاحبه (`core/importAuto`) */
type PanelId = SourceId | "auto";
const AUTO_EXT = [".zip", ".csv", ".tsv", ".txt", ".json", ".gz", ".xml"] as const;
type Phase = "idle" | "reading" | "matching" | "writing" | "done";
type Result = ImportResult;

/** سجلٌّ لا فرعُ شرط (D-153): مصدرٌ جديدٌ سطرٌ هنا لا نسخةٌ من المسار */
const SOURCES: Record<SourceId, { parse: (f: { name: string; buf: ArrayBuffer }[]) => Promise<ParseOutcome>; ext: readonly string[] }> = {
  /* 🆕 IMDb — ملفّاتٌ عدّة (التقييمات · قائمة المشاهدة · القوائم) تُختار معاً */
  imdb: { parse: parseImdbFiles, ext: [".csv", ".zip"] },
  /* 🆕 MyAnimeList — `animelist_….xml.gz` كما نزل (يُفكّ بالفاكّ المسجَّل أعلاه) */
  mal: { parse: parseMalFiles, ext: [".gz", ".xml", ".zip"] },
  letterboxd: { parse: parseLetterboxdFiles, ext: [".zip", ".csv"] },
  simkl: { parse: parseTrackerExport, ext: [".zip", ".json", ".csv"] },
  /* 🆕 Bingers — zip الأربعة كما نزل (أحمد ٢٠ نوفمبر) */
  bingers: { parse: parseBingersFiles, ext: [".zip", ".csv"] },
  tvtime: { parse: parseTvTimeFiles, ext: [".zip", ".csv", ".json"] },
};

export function ImportScreen() {
  const { t, tokens, locale } = useApp();
  const toast = useRef<ToastHostRef>(null);
  const dict = t as unknown as Record<string, unknown>;
  const stop = useRef(false);
  /* من غادر الشاشةَ والاستيرادُ يعمل يوقفه: حلقةٌ تكتب في الخلفيّة بلا شريطٍ يُرى ولا زرِّ إيقاف أسوأُ من توقّفٍ يُعاد (وكلُّ كتابةٍ `upsert`) */
  useEffect(() => () => void (stop.current = true), []);

  const [open, setOpen] = useState<PanelId | null>(null);
  const [active, setActive] = useState<PanelId | null>(null);
  /** 🆕 T500 — جداولُ ملفٍّ لا نعرفه تنتظر المراجعة، و«تعرّفنا على ملفّك» لمصدرٍ نعرفه */
  const [review, setReview] = useState<{ tables: AutoTable[]; skipped: string[] } | null>(null);
  const [known, setKnown] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const busy = phase === "reading" || phase === "matching" || phase === "writing";

  async function pick(source: PanelId) {
    if (busy) return;
    haptic.pick();
    setError(null);
    try {
      /* تُحمَّل عند الحاجة: أوّلُ استعمالٍ لمنتقي الملفّات (في البناء منذ 1.12.5، D-1350) — وإن غاب في ثنائيٍّ ما فرسالةٌ في الورقة لا سقوطُ الشاشة */
      const Picker = await import("expo-document-picker");
      /* `*‎/*`: أنواعُ MIME للـcsv والـzip تختلف بين مديري الملفّات على أندرويد، وفلترٌ بها يُخفي الملفَّ الصحيح؛ الامتدادُ يُفحص هنا */
      const got = await Picker.getDocumentAsync({ type: "*/*", multiple: true, copyToCacheDirectory: true });
      if (got.canceled || !got.assets?.length) return;
      const ext = source === "auto" ? AUTO_EXT : SOURCES[source].ext;
      const files = got.assets.filter((a) => ext.some((x) => a.name.toLowerCase().endsWith(x)));
      if (!files.length) {
        setActive(source);
        setResult(null);
        setPhase("idle");
        setError(t.importNothing);
        return;
      }
      await run(files.map((a) => ({ name: a.name, uri: a.uri })), source);
    } catch {
      setActive(source);
      setPhase("idle");
      setError(t.apiInternal);
    }
  }

  async function run(files: { name: string; uri: string }[], source: PanelId) {
    stop.current = false;
    setActive(source);
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
      let records: RawRecord[];
      if (source !== "auto") records = (await SOURCES[source].parse(bufs)).records;
      else {
        /* 🆕 T500 — ملفٌّ من مصدرٍ نعرفه يذهب لقارئه هو؛ وما سواه تُخمَّن أعمدتُه ثمّ ينتظر المراجعة */
        const got = await readAuto(bufs);
        if (got.kind === "tables") {
          setPhase("idle");
          /* ورقتان أصليّتان لا تُعرضان معاً (iOS لا يقدّم نافذتين في آنٍ): ورقةُ المصدر تُغلق والمراجعةُ تُفتح بعد انغلاقها */
          setOpen(null);
          setTimeout(() => setReview({ tables: got.tables, skipped: got.skipped }), 350);
          return;
        }
        if (got.kind === "none") {
          setPhase("idle");
          return void setError(got.skipped.length ? `${t.importNothing} ${t.importAutoSkipped(got.skipped.join(" · "))}` : t.importNothing);
        }
        setKnown(t.importAutoKnown(sources.find((x) => x.id === got.source)?.title ?? got.source));
        records = (await SOURCES[got.source].parse(bufs)).records;
      }
      parsed = true;
      await importParsed(records);
    } catch (e) {
      setPhase("idle");
      setError(e instanceof ApiError ? messageOf(e, dict, t.apiInternal) : parsed ? t.apiInternal : t.importNothing);
    }
  }

  /** 🆕 T500 — بعد المراجعة: الصفوفُ بالمعاني التي أقرّها ⇐ سجلّاتٌ في المسار نفسِه */
  async function runReviewed(tables: AutoTable[], opts: AutoOptions) {
    setReview(null);
    /* والتقدّمُ في ورقة المصدر كما لكلِّ مصدر — تُفتح بعد انغلاق المراجعة */
    setTimeout(() => setOpen("auto"), 350);
    setError(null);
    setResult(null);
    setPhase("reading");
    try {
      await importParsed(autoRecords(tables, opts));
    } catch (e) {
      setPhase("idle");
      setError(e instanceof ApiError ? messageOf(e, dict, t.apiInternal) : t.apiInternal);
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

      /* 🆕 المطابقةُ والتجميعُ والكتابةُ في `importPipeline.ts` — قارئُها الثاني استيرادُ Plex (هجرة ٢٣٥) */
      const done = await importRecords(
        records,
        { stopped: () => stop.current, phase: setPhase, pct: setPct },
        /* 🆕 «ما في Loopz يبقى» لكلِّ ملفٍّ كما في الويب (أحمد ٢٠ نوفمبر «١ أ») — يُضاف الناقصُ ولا يُدهس الموجود */
        { keep: true, favoritesName: t.favListName },
      );
      if (!done) return void setPhase("idle");
      setResult(done);
      setPhase("done");
      haptic.success();
    }
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
        toast.current?.say(`${t.importDone} — ${t.importDoneBody(r.shows, r.episodes, r.movies)}`);
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

  const sources: { id: PanelId; title: string; hint: string; fileHint: string }[] = [
    /* IMDb أوّلاً كما في الويب: أوسعُ الأربعة جمهوراً وأدقُّها مطابقة */
    { id: "imdb", title: t.importImdbTitle, hint: t.importImdbHint, fileHint: t.importImdbFileHint },
    { id: "mal", title: t.importMalTitle, hint: t.importMalHint, fileHint: t.importMalFileHint },
    { id: "letterboxd", title: t.importLetterboxdTitle, hint: t.importLetterboxdHint, fileHint: t.importLetterboxdFileHint },
    { id: "simkl", title: t.importSimklTitle, hint: t.importSimklHint, fileHint: t.importSimklFileHint },
    { id: "bingers", title: t.importBingersTitle, hint: t.importBingersHint, fileHint: t.importBingersFileHint },
    { id: "tvtime", title: t.importTvTimeTitle, hint: t.importTvTimeHint, fileHint: t.importFileHint },
    /* 🆕 T500 — آخرُها كما في الويب */
    { id: "auto", title: t.importAutoTitle, hint: t.importAutoHint, fileHint: t.importAutoFileHint },
  ];
  const src = sources.find((s) => s.id === open);
  const mine = !!src && active === src.id;
  const phaseLabel = phase === "reading" ? t.importReading : phase === "matching" ? t.importMatching : phase === "writing" ? t.importWriting : "";

  return (
    <SettingsScreen title={t.setImport} toast={toast}>
      <View>
        <Group label={t.importSection}>
          {sources.map((s) => (
            <Row key={s.id} icon="download" title={s.title} subtitle={busy && active === s.id ? `${phaseLabel} ${num(pct, locale)}%` : s.hint} onPress={() => setOpen(s.id)} />
          ))}
          <Row icon="share" title={t.importTraktTitle} subtitle={traktBusy ? t.importTraktWorking : t.importTraktHint} busy={traktBusy} onPress={() => void connectTrakt()} />
        </Group>
        <Text size={12} muted style={{ paddingHorizontal: 4, marginTop: 8, lineHeight: 19 }}>{t.importHint}</Text>
      </View>
      <Group>
        <Row icon="download" title={t.dataExportTitle} value={exporting ? t.dataExportBusy : undefined} busy={exporting} onPress={() => void exportData()} />
      </Group>

      {src ? (
        <Sheet title={src.title} onClose={() => setOpen(null)}>
          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            <Text size={12} muted style={{ lineHeight: 19, marginBottom: 12 }}>{src.hint}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Button label={t.importPickFile} variant="ghost" disabled={busy} onPress={() => void pick(src.id)} style={{ borderWidth: 1, borderColor: tokens.border, opacity: busy ? 0.5 : 1 }} />
              {busy && mine ? <Button label={t.importCancel} variant="ghost" onPress={() => void (stop.current = true)} /> : null}
            </View>
            <Text size={12} muted style={{ marginTop: 8 }}>{src.fileHint}</Text>

            {busy && mine ? (
              <View style={{ marginTop: 16 }}>
                <Text size={12} muted style={{ marginBottom: 6 }}>{phaseLabel}</Text>
                {/* العرضُ بالنسبة والاتّجاهُ من الصفّ: في العربيّة يمتلئ من اليمين كما في الويب (`rtl:origin-right`) */}
                <View style={{ height: 6, borderRadius: 3, backgroundColor: tokens.surface2, overflow: "hidden", flexDirection: "row" }}>
                  <View style={{ width: `${Math.max(2, pct)}%`, backgroundColor: tokens.accent }} />
                </View>
              </View>
            ) : null}

            {known && mine ? <Text size={12} muted style={{ marginTop: 12 }}>{known}</Text> : null}
            {error && mine ? <Note tone="error" body={error} /> : null}

            {phase === "done" && result && mine ? (
              <>
                <Note
                  tone="success"
                  title={t.importDone}
                  body={`${t.importDoneBody(result.shows, result.episodes, result.movies)}${result.lists > 0 ? ` ${t.importDoneLists(num(result.lists, locale))}` : ""}`}
                />
                {result.listsSkipped > 0 ? <Note tone="error" body={t.importListsFull} /> : null}
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
      {review ? <ImportAutoReview tables={review.tables} skipped={review.skipped} onCancel={() => setReview(null)} onImport={(tables, opts) => void runReviewed(tables, opts)} /> : null}
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
