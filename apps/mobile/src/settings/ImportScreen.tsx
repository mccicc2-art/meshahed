import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { File, Paths } from "expo-file-system";
import { inflateSync } from "fflate";
import { useApp } from "../state";
import { Text, Button } from "../ui";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { api, write, downloadTo, ApiError } from "../api";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, Row } from "./ui";
import { messageOf } from "./api";
import { num } from "@/core/i18n";
import { parseTvTimeFiles } from "@/core/tvtime";
import { parseLetterboxdFiles } from "@/core/letterboxd";
import { parseTrackerExport } from "@/core/trackerExport";
import { groupForResolve, setInflateRaw, type ParseOutcome } from "@/core/importParse";
import { buildImport, IMPORT_CHUNK } from "@/core/importBuild";
import type { ImportPayload, ResolveRequest, ResolveResult } from "@/core/importer";

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
 * ⚖️ **Trakt صفٌّ مغلقٌ بسببه** («9 أ»): بابٌ مغلقٌ في مكانه أصدقُ من بابٍ محذوف (D-155)، ومسارُه الأصليُّ لا يُبنى لخدمةٍ مطفأة.
 */
setInflateRaw((data) => inflateSync(data));

type SourceId = "letterboxd" | "simkl" | "tvtime";
type Phase = "idle" | "reading" | "matching" | "writing" | "done";
type Result = { shows: number; episodes: number; movies: number; unmatched: string[] };

/** سجلٌّ لا فرعُ شرط (D-153): مصدرٌ جديدٌ سطرٌ هنا لا نسخةٌ من المسار */
const SOURCES: Record<SourceId, { parse: (f: { name: string; buf: ArrayBuffer }[]) => Promise<ParseOutcome>; ext: readonly string[] }> = {
  letterboxd: { parse: parseLetterboxdFiles, ext: [".zip", ".csv"] },
  simkl: { parse: parseTrackerExport, ext: [".zip", ".json", ".csv"] },
  tvtime: { parse: parseTvTimeFiles, ext: [".zip", ".csv", ".json"] },
};

export function ImportScreen() {
  const { t, tokens, locale } = useApp();
  const toast = useRef<ToastHostRef>(null);
  const dict = t as unknown as Record<string, unknown>;
  const stop = useRef(false);
  /* من غادر الشاشةَ والاستيرادُ يعمل يوقفه: حلقةٌ تكتب في الخلفيّة بلا شريطٍ يُرى ولا زرِّ إيقاف أسوأُ من توقّفٍ يُعاد (وكلُّ كتابةٍ `upsert`) */
  useEffect(() => () => void (stop.current = true), []);

  const [open, setOpen] = useState<SourceId | null>(null);
  const [active, setActive] = useState<SourceId | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const busy = phase === "reading" || phase === "matching" || phase === "writing";

  async function pick(source: SourceId) {
    if (busy) return;
    haptic.pick();
    setError(null);
    try {
      /* تُحمَّل عند الحاجة: أوّلُ استعمالٍ لمنتقي الملفّات (في البناء منذ 1.12.5، D-1350) — وإن غاب في ثنائيٍّ ما فرسالةٌ في الورقة لا سقوطُ الشاشة */
      const Picker = await import("expo-document-picker");
      /* `*‎/*`: أنواعُ MIME للـcsv والـzip تختلف بين مديري الملفّات على أندرويد، وفلترٌ بها يُخفي الملفَّ الصحيح؛ الامتدادُ يُفحص هنا */
      const got = await Picker.getDocumentAsync({ type: "*/*", multiple: true, copyToCacheDirectory: true });
      if (got.canceled || !got.assets?.length) return;
      const ext = SOURCES[source].ext;
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

  async function run(files: { name: string; uri: string }[], source: SourceId) {
    stop.current = false;
    setActive(source);
    setError(null);
    setResult(null);
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
      const { records } = await SOURCES[source].parse(bufs);
      parsed = true;
      if (!records.length) {
        setPhase("idle");
        setError(t.importNothing);
        return;
      }

      // ===== المطابقة — ما وصل بمعرّف TMDB لا يمرّ من هنا (D-154) =====
      setPhase("matching");
      const { requests, keys } = groupForResolve(records);
      const resolved = new Map<string, ResolveResult>();
      for (let i = 0; i < requests.length; i += IMPORT_CHUNK.resolve) {
        if (stop.current) return void setPhase("idle");
        const slice: ResolveRequest[] = requests.slice(i, i + IMPORT_CHUNK.resolve);
        /* `api` لا `write`: المطابقةُ قراءةٌ بجسم — لا وسومَ تُبطَل */
        const out = (await api<{ results: ResolveResult[] }>("/api/v1/me/import/resolve", { method: "POST", body: { requests: slice } })).data.results;
        out.forEach((r, n) => resolved.set(keys[i + n], r));
        setPct(Math.round(((i + slice.length) / requests.length) * 100));
      }

      const { shows, movies, unmatched } = buildImport(records, resolved);

      // ===== الكتابة =====
      setPhase("writing");
      setPct(0);
      let sC = 0;
      let eC = 0;
      let mC = 0;
      const steps = Math.ceil(shows.length / IMPORT_CHUNK.shows) + Math.ceil(movies.length / IMPORT_CHUNK.movies) || 1;
      let step = 0;
      const apply = async (payload: ImportPayload) =>
        (await api<{ shows: number; episodes: number; movies: number }>("/api/v1/me/import/apply", { method: "POST", body: payload })).data;
      for (let i = 0; i < shows.length; i += IMPORT_CHUNK.shows) {
        if (stop.current) break;
        const r = await apply({ shows: shows.slice(i, i + IMPORT_CHUNK.shows), movies: [] });
        sC += r.shows;
        eC += r.episodes;
        setPct(Math.round((++step / steps) * 100));
      }
      for (let i = 0; i < movies.length; i += IMPORT_CHUNK.movies) {
        if (stop.current) break;
        const r = await apply({ shows: [], movies: movies.slice(i, i + IMPORT_CHUNK.movies) });
        mC += r.movies;
        setPct(Math.round((++step / steps) * 100));
      }
      /* `write`: الختامُ يحمل الوسوم — الرئيسيّةُ والمكتبةُ والإحصاءاتُ تُعاد مرّةً واحدةً لا مع كلِّ دفعة.
         ويُنادى حتى بعد «إيقاف»: ما كُتب قبله في المكتبة فعلاً، والشاشاتُ يجب أن تراه */
      await write<{ done: true }>("/api/v1/me/import/finish", {});
      setResult({ shows: sC, episodes: eC, movies: mC, unmatched: unmatched.slice(0, 60) });
      setPhase("done");
      haptic.success();
    } catch (e) {
      setPhase("idle");
      setError(e instanceof ApiError ? messageOf(e, dict, t.apiInternal) : parsed ? t.apiInternal : t.importNothing);
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

  const sources: { id: SourceId; title: string; hint: string; fileHint: string }[] = [
    { id: "letterboxd", title: t.importLetterboxdTitle, hint: t.importLetterboxdHint, fileHint: t.importLetterboxdFileHint },
    { id: "simkl", title: t.importSimklTitle, hint: t.importSimklHint, fileHint: t.importSimklFileHint },
    { id: "tvtime", title: t.importTvTimeTitle, hint: t.importTvTimeHint, fileHint: t.importFileHint },
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
          <Row icon="share" title={t.importTraktTitle} subtitle={t.importTraktWhy} value={t.settingsSoonTitle} disabled />
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

            {error && mine ? <Note tone="error" body={error} /> : null}

            {phase === "done" && result && mine ? (
              <>
                <Note tone="success" title={t.importDone} body={t.importDoneBody(num(result.shows, locale), num(result.episodes, locale), num(result.movies, locale))} />
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
    </SettingsScreen>
  );
}

/** سطرُ حالٍ داخل الورقة — لونُ النجاح الواحد ولونُ الخطأ الواحد من الرموز (القاعدة ٣)، لا مضيفَ إشعارٍ ثانياً تحت ورقة */
function Note({ tone, title, body }: { tone: "error" | "success"; title?: string; body: string }) {
  const { tokens } = useApp();
  const c = tone === "error" ? tokens.error : tokens.success;
  return (
    <View style={{ marginTop: 12, borderRadius: radius.control, borderWidth: 1, borderColor: `${c}55`, backgroundColor: `${c}1A`, padding: 12 }}>
      {title ? <Text size={13} weight="700" style={{ marginBottom: 2 }}>{title}</Text> : null}
      <Text size={13} style={{ lineHeight: 20 }}>{body}</Text>
    </View>
  );
}
