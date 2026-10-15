import { AppState, Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { LoopzWidget } from "../../modules/loopz-widget";
import { api } from "../api";
import { BUILD_TAG } from "../ota";
import { session } from "../session";
import { own } from "../ownSession";
import { backdropUrl, posterUrl } from "@/core/media";
import type { WidgetFeed } from "@/core/contracts/widget";
import { resolveWidget, type WidgetSectionKey } from "@/core/widgetLayout";
import { sanitizeWidgetLook } from "@/core/widgetLook";

/**
 * 🆕 هل يقدر رسّامُ أندرويد أن يغيّر مقاسَ عنصر (`setViewLayoutHeight` — أندرويد 12، API 31)؟ إن لم يقدر يُحسم له كما كان
 * (لا تكبيرَ أسطر W50، ولا أربعةَ بوسترات W54) — فما يحسبه المحرّكُ هنا يطابق ما يرسمه هو. والشرطُ نفسُه في `LoopzWidgets.kt`.
 */
export const ANDROID_RESIZE = Platform.OS !== "android" || (typeof Platform.Version === "number" && Platform.Version >= 31);

/**
 * ====== 🆕 بياناتُ الودجتات — يكتبها التطبيقُ والودجتُ يقرأ (خطّةُ الودجتات §2.1) ======
 *
 * 🔑 **الودجتُ بلا جلسةٍ ولا شبكة** (D-929 باقية): التطبيقُ يجلب `me/widget` بجلسته، ينزّل الملصقات، ويكتب
 * `feed.json` في المجلّد المشترك عبر الجسر — والودجتُ يرسم آخرَ ما كُتب. **ونسخةُ الجلسة لا تخرج من التطبيق**:
 * ✓ في الدفعة الثانية برمزٍ خاصٍّ لا يقدر إلّا على تعليم حلقة (W14) — لا برمز الجلسة الذي يُبدَّل مع كلّ تجديد.
 *
 * 🔑 **متى يُكتب** (W13 «١ ب»): بعد كلِّ تحميلٍ للرئيسيّة (وكلُّ فعلٍ يبطلها يعيد تحميلها)، وحين يذهب التطبيقُ
 * إلى الخلفيّة (آخرُ ما رآه الشخصُ قبل أن يرى شاشتَه الرئيسيّة)، وفي مهمّةٍ خلفيّةٍ يشغّلها النظامُ بين حينٍ وآخر.
 * وعند الخروج يُكتب فارغاً — ودجتٌ يعرض «أكمل المشاهدة» لصاحبٍ خرج يكشف مكتبتَه لمن يمسك الجهاز.
 */

const FEED = "feed.json";
/** 🆕 W14 — رمزُ ✓ الخاصّ: يقرؤه الودجتُ (`CheckReceiver.kt` · `Intents.swift`) ولا يقدر إلّا على تعليم حلقة */
const TOKEN = "token";
/** 🆕 سجلُّ لمسات الودجت (`CheckReceiver.kt` · `Intents.swift`): التطبيقُ يرسله للتشخيص ثمّ يفرغه */
const DIAG = "diag.json";
/** 🆕 W40 — ما يرسمه ودجتُ الآيفون (الحجمُ|التخطيط)؛ يكتبه الملحقُ ويقرؤه «على شاشتك الآن» — لا يُحذف مع الملصقات */
const PLACED = "placed.json";
/** 🆕 W40 — تخطيطُ ودجتِ أندرويد بعينه: `aw-<رقمه>` (لا يظهر في تخطيطات الآيفون) */
export const ANDROID_WIDGET_LAYOUT = (id: number) => `aw-${id}`;
export const isAndroidWidgetLayout = (id: string) => /^aw-\d+$/.test(id);
/** طلبُ رمزٍ فشل (الجدولُ لم يُنشأ بعد، أو لا شبكة) لا يُعاد مع كلِّ جلب — مرّةً كلَّ نصف ساعةٍ تكفي */
const TOKEN_RETRY_MS = 30 * 60_000;
const TASK = "loopz-widget-refresh";
/** أقلُّ فاصلٍ بين كتابتين — الرئيسيّةُ تُبطَل كثيراً، والملصقاتُ لا تتغيّر كلَّ ثانية */
const MIN_GAP_MS = 45_000;
/** النظامُ يقرّر الموعدَ الفعليّ؛ هذا أدناه بالدقائق (أندرويد يحترمه تقريباً، iOS أقلُّ انتظاماً) */
const BG_MINUTES = 180;

let last = 0;
let tokenTried = 0;
let running: Promise<void> | null = null;
let again: Promise<void> | null = null;

/** اسمُ ملفِّ الملصق في المجلّد المشترك — من مسار TMDB نفسِه، فالملصقُ لا يُنزَّل مرّتين */
function posterName(path: string): string | null {
  const base = path.replace(/^\/+/, "").replace(/[^A-Za-z0-9._-]/g, "");
  return base ? `p_${base}` : null;
}

/**
 * 🆕 W17/W18 — **صورُ الرسم بجودة التطبيق**: الصورةُ العريضة لبطاقة «أكمل المشاهدة» `w780` كبطاقة الرئيسيّة نفسِها،
 * والملصقُ `w500` — الودجتُ الصغيرُ على S24 Ultra نحو ٣٥٠px عرضاً، و`w342` أصغرُ منه فيُمَطّ ويَغبَش.
 * المفتاحُ مسارُ TMDB والقيمةُ نوعُه؛ ومسارٌ واحدٌ لا يُنزَّل مرّتين.
 */
type Art = "poster" | "backdrop";

function collectArt(feed: WidgetFeed): Map<string, Art> {
  const out = new Map<string, Art>();
  const add = (p: string | null | undefined, kind: Art = "poster") => {
    if (p && !out.has(p)) out.set(p, kind);
  };
  feed.continue.items.forEach((x) => {
    add(x.backdrop_path, "backdrop");
    add(x.poster_path);
  });
  feed.towatch_series.forEach((x) => add(x.poster_path));
  feed.towatch_all.forEach((x) => add(x.poster_path));
  feed.upcoming.items.forEach((x) => add(x.poster_path));
  feed.tonight.forEach((x) => {
    add(x.poster_path);
    /* 🆕 v2 — هيدرُ بطاقة فيلم الليلة العريضة */
    add(x.backdrop_path, "backdrop");
  });
  feed.lists.forEach((l) => l.items.forEach((x) => add(x.poster_path)));
  const v2 = feed.v2;
  if (v2) {
    v2.trending.forEach((x) => add(x.poster_path));
    v2.towatch.forEach((x) => add(x.poster_path));
    v2.upcoming.items.forEach((x) => add(x.poster_path));
    v2.friends.forEach((x) => add(x.title.poster_path));
    v2.activity.forEach((x) => add(x.title.poster_path));
  }
  return out;
}

/** اسمُ ملفِّ الصورة على الجهاز — الاسمُ يحمل المقاسَ (ملفّاتُ `w342` القديمةُ من البناء الأوّل لا تُعاد على أنّها الجديدة) */
function artName(path: string, kind: Art): string | null {
  const base = posterName(path);
  return base ? `${kind === "backdrop" ? "b780" : "p500"}_${base}` : null;
}

async function ensureArt(path: string, kind: Art): Promise<string | null> {
  const w = LoopzWidget;
  const name = artName(path, kind);
  if (!w || !name) return null;
  if (w.exists(name)) return name;
  const url = kind === "backdrop" ? backdropUrl(path, "w780") : posterUrl(path, "w500");
  if (!url) return null;
  const tmp = new File(Paths.cache, `wp-${name}`);
  try {
    if (tmp.exists) tmp.delete();
    const got = await File.downloadFileAsync(url, tmp);
    w.importFile(got.uri, name);
    return name;
  } catch {
    /* ملصقٌ لم يصل ⇒ الودجتُ يرسم خانةً بلا صورة، لا شيءَ يسقط */
    return null;
  } finally {
    try {
      if (tmp.exists) tmp.delete();
    } catch {
      /* لا شيء */
    }
  }
}

/**
 * 🆕 W14 — رمزُ ✓ لهذا الجهاز، يُطلب **بالجلسة** مرّةً ويُكتب ملفّاً في مجلّد الودجت. نسخةُ الجلسة لا تخرج من التطبيق
 * (D-929) — والرمزُ لا يقدر إلّا على «علّم حلقة». يُطلب قبل الخلاصة: الخادمُ يكتب `check: true` حين يجد للعضو رمزاً،
 * فأوّلُ خلاصةٍ بعد التحديث ترسم ✓ ومعها الرمزُ الذي يشغّله. وعند الخروج يمحوه `prune` مع غيره.
 */
/**
 * 🆕 **تشخيصُ أزرار الودجت** (تسجيلُ أحمد ١٤ أكتوبر، بناء 77: «الازرار ما تنضغط» — ولا رمزَ استُعمل على الخادم):
 * كلُّ لمسةٍ يكتب الودجتُ ما جرى لها (وصلت · لا رمز · ردُّ الخادم · خطأ الشبكة) في `diag.json`، والتطبيقُ يرسله هنا
 * إلى `runtime_errors` بالمسار الذي تُرسَل به أعطالُ الشاشات (`/api/v1/app/crash`، الشاشة `widget`) ثمّ يفرغه.
 * ومعه هل ملفُّ الرمز موجودٌ على الجهاز — الاحتمالُ الأوّل.
 */
async function sendDiag(w: NonNullable<typeof LoopzWidget>): Promise<void> {
  try {
    const raw = w.readText?.(DIAG);
    if (!raw) return;
    const rows = JSON.parse(raw) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) return;
    const lines = rows.slice(-30).map((r) => JSON.stringify(r));
    await api("/api/v1/app/crash", {
      method: "POST",
      body: {
        screen: "widget",
        message: `widget taps: ${rows.length} · token file ${w.exists(TOKEN) ? "yes" : "no"}`,
        stack: lines.join("\n"),
        version: BUILD_TAG,
      },
    });
    w.writeText(DIAG, "[]");
  } catch {
    /* التشخيصُ ليس شرطاً لشيء */
  }
}

async function ensureToken(w: NonNullable<typeof LoopzWidget>): Promise<void> {
  if (w.exists(TOKEN)) return;
  if (Date.now() - tokenTried < TOKEN_RETRY_MS) return;
  tokenTried = Date.now();
  try {
    const { data } = await api<{ token: string }>("/api/v1/widget/token", { method: "POST", body: {} });
    if (typeof data?.token === "string" && data.token.startsWith("lw_")) w.writeText(TOKEN, data.token);
  } catch {
    /* بلا رمزٍ يبقى ✓ مخفيّاً (`check: false`) — لا شيءَ آخرُ يتغيّر */
  }
}

/** يكتب ودجتاً فارغاً «سجّل الدخول» — عند الخروج وحين لا جلسة */
export function clearWidgets() {
  const w = LoopzWidget;
  if (!w) return;
  try {
    w.writeText(FEED, JSON.stringify({ v: 1, signed_out: true }));
    w.prune([FEED]);
    w.reload();
  } catch {
    /* لا شيء */
  }
}

async function run(): Promise<void> {
  const w = LoopzWidget;
  if (!w) return;
  if (!session.seen()) {
    clearWidgets();
    return;
  }
  /* 🔑 **لا جسرَ في الخلفيّة**: الرمزُ من الجلسة المملوكة وحدَها — وإلّا لا شيءَ يُكتب (يبقى آخرُ ما كُتب) */
  if (!session.has() && !(await own.ensure())) return;
  let lists: string[] = [];
  try {
    lists = w.configuredLists().filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 4);
  } catch {
    lists = [];
  }
  const query = lists.length ? `?lists=${lists.join(",")}` : "";
  await ensureToken(w);
  await sendDiag(w);
  const { data } = await api<WidgetFeed>("/api/v1/me/widget" + query);
  const art = [...collectArt(data)];
  const names = new Map<string, string>();
  /* 🆕 **الودجتُ أوّلاً ثمّ الصور** (تسجيلُ أحمد ١٤ أكتوبر: «حفظت الإعدادات وأروح لسطح المكتب متأخرة ما تجي»): كان الودجتُ
     ينتظر تنزيلَ كلِّ الصور (عشراتٌ، أربعٌ أربع) قبل أن يُكتب. الآن يُكتب فوراً بما على الجهاز من صور، ثمّ يُكتب ثانيةً
     حين تكتمل الناقصة — والإعدادُ الجديدُ يظهر في ثانية */
  for (const [p, kind] of art) {
    const name = artName(p, kind);
    if (name && w.exists(name)) names.set(p, name);
  }
  const missing = art.filter(([p]) => !names.has(p));
  writeFeed(w, data, names, missing.length === 0);
  if (!missing.length) return;
  /* أربعةٌ أربعة — لا عشرون طلباً في لحظةٍ واحدة على شبكةٍ قد تكون ضعيفة */
  for (let i = 0; i < missing.length; i += 4) {
    const batch = missing.slice(i, i + 4);
    const chunk = batch.map(([p]) => p);
    const got = await Promise.all(batch.map(([p, kind]) => ensureArt(p, kind)));
    chunk.forEach((p, n) => {
      const name = got[n];
      if (name) names.set(p, name);
    });
  }
  writeFeed(w, data, names, true);
}

/**
 * قرارُ أحمد «ب» (١٤ أكتوبر): القسمُ الذي لا محتوى له الآن يختفي ويأخذ ما بعده مكانَه — يُحسم بالبيانات نفسِها.
 * 🆕 ومعاينةُ «ودجت لوبز» تقرؤه من الخلاصة المكتوبة نفسِها، فلا ترسم قسماً لن يظهر (تسجيلُ أحمد: «القادم» بثلاثة بوسترات)
 */
export function emptySections(data: WidgetFeed): WidgetSectionKey[] {
  const v2 = data.v2;
  if (!v2) return [];
  const today = new Date().toISOString().slice(0, 10);
  return (
    [
      ["up", v2.upcoming.items.every((u) => u.date != null && u.date < today)],
      ["friends", v2.friends.length === 0],
      ["tw", v2.towatch.length === 0],
      ["act", v2.activity.length === 0],
      ["tonight", data.tonight.length === 0],
    ] as const
  )
    .filter(([, e]) => e)
    .map(([k]) => k);
}

/** ما كُتب للودجت آخرَ مرّة — `null` إن لم يُكتب بعد */
export function writtenFeed(): WidgetFeed | null {
  try {
    const raw = LoopzWidget?.readText?.(FEED);
    return raw ? (JSON.parse(raw) as WidgetFeed) : null;
  } catch {
    return null;
  }
}

function writeFeed(w: NonNullable<typeof LoopzWidget>, data: WidgetFeed, names: Map<string, string>, prune: boolean): void {
  /* `posters`: مسارُ TMDB ⇐ اسمُ الملفّ المحلّيّ — الودجتُ يقرأ الصورةَ من المجلّد ولا يعرف الشبكة */
  /* 🆕 الودجت الواحد (§11.2) — **المحرّكُ هنا مرّةً** والرسّامان يرسمان ما يُكتب: صفوفُ كلِّ حجمٍ لأندرويد، ولكلِّ تخطيطٍ في الآيفون */
  const v2 = data.v2;
  const empty = emptySections(data);
  /* 🆕 شكلُ الودجت من الخلاصة (مُصلَحاً) — المحرّكُ يحسم به، ويُكتب معه فيقرؤه الرسّامان بالأرقام نفسِها */
  const look = sanitizeWidgetLook(v2?.look);
  const androidOpts = { look, resize: ANDROID_RESIZE };
  const iosOpts = { look, resize: true };
  /* 🆕 W40 — أندرويد: الإعدادُ الافتراضيُّ لكلِّ ودجت، و`byId` لما خُصّص لودجتٍ بعينه (`aw-<رقمه>`)؛ والآيفون تخطيطاتُه وحدَها */
  const w2 = v2
    ? {
        android: {
          ...resolveWidget(v2.config, v2.plus, "android", empty, androidOpts),
          byId: Object.fromEntries(
            v2.layouts.filter((l) => isAndroidWidgetLayout(l.id)).map((l) => [l.id, resolveWidget(l.config, v2.plus, "android", empty, androidOpts)]),
          ),
        },
        ios: v2.layouts
          .filter((l) => !isAndroidWidgetLayout(l.id))
          .map((l) => ({ id: l.id, name: l.name, resolved: resolveWidget(l.config, v2.plus, "ios", empty, iosOpts) })),
        look,
      }
    : null;
  const out = { ...data, w2, posters: Object.fromEntries(names), written_at: new Date().toISOString() };
  w.writeText(FEED, JSON.stringify(out));
  /* الكتابةُ الأولى (قبل الصور) لا تمحو شيئاً: ملفُّ صورةٍ لم يُذكر بعدُ قد يكون في طريقه */
  if (prune) w.prune([FEED, TOKEN, DIAG, PLACED, ...names.values()]);
  w.reload();
}

/**
 * يجدّد الودجتات. `force` يتخطّى الفاصلَ الأدنى (الخروج إلى الخلفيّة · المهمّةُ الخلفيّة).
 * الفشلُ صمتٌ: ودجتٌ قديمةٌ خيرٌ من شاشةٍ تسقط — والطلبُ التالي يعيد المحاولة.
 */
export function refreshWidgets(force = false): Promise<void> {
  if (!LoopzWidget) return Promise.resolve();
  /* 🆕 تجديدٌ جارٍ بالإعداد القديم وطُلب تجديدٌ مُلزِم (حفظُ «ودجت لوبز») ⇒ يجري تجديدٌ ثانٍ بعده — كان الحفظُ يعود بالقديم */
  if (running) {
    if (!force) return running;
    if (!again) again = running.then(() => {
      again = null;
      return refreshWidgets(true);
    });
    return again;
  }
  if (!force && Date.now() - last < MIN_GAP_MS) return Promise.resolve();
  last = Date.now();
  running = run()
    .catch(() => {
      /* لا شيء */
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/* ——— المهمّةُ الخلفيّة: تُعرَّف في نطاق الوحدة لأنّ النظامَ يشغّلها بلا شاشة (expo-task-manager) ——— */
try {
  TaskManager.defineTask(TASK, async () => {
    try {
      await refreshWidgets(true);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
} catch {
  /* بناءٌ بلا الوحدة الأصليّة */
}

async function registerBackground() {
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(TASK)))
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: BG_MINUTES });
  } catch {
    /* لا شيء */
  }
}

async function unregisterBackground() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch {
    /* لا شيء */
  }
}

let started = false;
/** يُنادى مرّةً من الجذر: الخلفيّةُ والخروجُ والمهمّة */
export function startWidgetFeed() {
  if (started || !LoopzWidget) return;
  started = true;
  AppState.addEventListener("change", (s) => {
    if (s === "background") void refreshWidgets(true);
  });
  session.onSignOut(() => {
    clearWidgets();
    void unregisterBackground();
  });
  if (session.seen()) void registerBackground();
  session.subscribe(() => {
    if (session.seen()) void registerBackground();
  });
}
