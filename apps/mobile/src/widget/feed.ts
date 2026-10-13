import { AppState } from "react-native";
import { File, Paths } from "expo-file-system";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { LoopzWidget } from "../../modules/loopz-widget";
import { api } from "../api";
import { session } from "../session";
import { own } from "../ownSession";
import { posterUrl } from "@/core/media";
import type { WidgetFeed } from "@/core/contracts/widget";

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
const TASK = "loopz-widget-refresh";
/** أقلُّ فاصلٍ بين كتابتين — الرئيسيّةُ تُبطَل كثيراً، والملصقاتُ لا تتغيّر كلَّ ثانية */
const MIN_GAP_MS = 45_000;
/** النظامُ يقرّر الموعدَ الفعليّ؛ هذا أدناه بالدقائق (أندرويد يحترمه تقريباً، iOS أقلُّ انتظاماً) */
const BG_MINUTES = 180;

let last = 0;
let running: Promise<void> | null = null;

/** اسمُ ملفِّ الملصق في المجلّد المشترك — من مسار TMDB نفسِه، فالملصقُ لا يُنزَّل مرّتين */
function posterName(path: string): string | null {
  const base = path.replace(/^\/+/, "").replace(/[^A-Za-z0-9._-]/g, "");
  return base ? `p_${base}` : null;
}

function collectPosters(feed: WidgetFeed): string[] {
  const out = new Set<string>();
  const add = (p: string | null | undefined) => {
    if (p) out.add(p);
  };
  feed.continue.items.forEach((x) => add(x.poster_path));
  feed.towatch_series.forEach((x) => add(x.poster_path));
  feed.towatch_all.forEach((x) => add(x.poster_path));
  feed.upcoming.items.forEach((x) => add(x.poster_path));
  feed.tonight.forEach((x) => add(x.poster_path));
  feed.lists.forEach((l) => l.items.forEach((x) => add(x.poster_path)));
  return [...out];
}

async function ensurePoster(path: string): Promise<string | null> {
  const w = LoopzWidget;
  const name = posterName(path);
  if (!w || !name) return null;
  if (w.exists(name)) return name;
  const url = posterUrl(path, "w342");
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
  const { data } = await api<WidgetFeed>("/api/v1/me/widget" + query);
  const posters = collectPosters(data);
  const names = new Map<string, string>();
  /* أربعةٌ أربعة — لا عشرون طلباً في لحظةٍ واحدة على شبكةٍ قد تكون ضعيفة */
  for (let i = 0; i < posters.length; i += 4) {
    const chunk = posters.slice(i, i + 4);
    const got = await Promise.all(chunk.map((p) => ensurePoster(p)));
    chunk.forEach((p, n) => {
      const name = got[n];
      if (name) names.set(p, name);
    });
  }
  /* `posters`: مسارُ TMDB ⇐ اسمُ الملفّ المحلّيّ — الودجتُ يقرأ الصورةَ من المجلّد ولا يعرف الشبكة */
  const out = { ...data, posters: Object.fromEntries(names), written_at: new Date().toISOString() };
  w.writeText(FEED, JSON.stringify(out));
  w.prune([FEED, ...names.values()]);
  w.reload();
}

/**
 * يجدّد الودجتات. `force` يتخطّى الفاصلَ الأدنى (الخروج إلى الخلفيّة · المهمّةُ الخلفيّة).
 * الفشلُ صمتٌ: ودجتٌ قديمةٌ خيرٌ من شاشةٍ تسقط — والطلبُ التالي يعيد المحاولة.
 */
export function refreshWidgets(force = false): Promise<void> {
  if (!LoopzWidget) return Promise.resolve();
  if (running) return running;
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
