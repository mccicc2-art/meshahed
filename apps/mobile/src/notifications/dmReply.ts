import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { CONFIG } from "../config";
import { GATE_HEADERS, NO_COOKIES, queryClient } from "../api";
import { session } from "../session";
import { own } from "../ownSession";
import { currentLocale, dictFor } from "../i18n";
import type { Dict } from "@/core/i18n";
import type { MsgPeerBody, MsgTextBody } from "@/core/contracts/messages";

/**
 * ====== الردُّ من الإشعار — كالواتس (D-1406، إصدار 1.12.6) ======
 *
 * 🔑 **نوعُ إشعارٍ واحد «dm» بزرّين** (تسجيلُ أحمد ١٥ أكتوبر، والصورةُ المعتمدة): «رد» يفتح خانةَ كتابةٍ داخل الإشعار
 * نفسِه (أندرويد: تحت الإشعار؛ الآيفون: بضغطةٍ مطوّلة — شكلُ النظام)، و«تمييز كمقروءة». الخادمُ يرسل `categoryId: "dm"`
 * مع إشعار الرسالة وحدَه (`src/lib/push.ts`)، والأزرارُ تُعرَّف هنا بلغة الجهاز عند كلِّ إقلاع.
 *
 * 🔑 **الردُّ يُرسل بلا فتح التطبيق**: مسارُ الرسائل نفسُه (`/api/v1/me/messages/text`) برمز الجلسة المملوكة
 * (`own.ensure()` — لا جسرَ في الخلفيّة، كمهمّة الودجت). ثمّ يُستبدل الإشعارُ بنفسه (المعرّفُ ذاتُه) وتحت الرسالة
 * «أنت: …» على قناةٍ صامتة — لا رنينَ ثانياً على ردّك أنت. **والفشلُ لا يضيع صامتاً**: الإشعارُ يقول «تعذّر الإرسال»
 * ويبقى بزرّيه فيُعاد.
 *
 * 🔑 **طريقان للوصول، ومعالجةٌ واحدة**: أندرويد والتطبيقُ في الخلفيّة أو مقفول ⇒ مهمّةٌ بلا شاشة (`expo-task-manager`،
 * تُعرَّف في نطاق الوحدة)؛ والتطبيقُ أمامك، أو الآيفون (يُقلع التطبيقَ في الخلفيّة ويسلّم الردَّ للمستمع) ⇒ مستمعُ الردود.
 * أندرويد قد يسلّم الردَّ الواحدَ للطريقين (المهمّة، ثمّ طابورُ المستمع عند الفتح التالي) — **فكلُّ ردٍّ يُعالَج مرّةً**
 * بمفتاحه (معرّفُ الإشعار + الزرّ + النصّ) محفوظاً.
 *
 * 🔑 **جاهزٌ للقروبات**: الوجهةُ تُقرأ من رابط الإشعار (`targetOf`) — اليوم `/messages?with=<شخص>` وحدَه، والقروبُ يضيف
 * شكلَه هناك ويعمل بالزرّين نفسيهما بتحديثٍ هوائيّ (قرارُ أحمد ١٥ أكتوبر: القروباتُ بعد الإصدار).
 */
export const DM_CATEGORY = "dm";
const ACTION_REPLY = "reply";
const ACTION_READ = "read";
const TASK = "loopz-dm-reply";
const REPLIES_CHANNEL = "replies";
const DONE_KEY = "loopz.push.handled";
const DONE_MAX = 30;

type Target = { kind: "dm"; peer: string };
type Parsed = { key: string; action: string; text: string; id: string; title: string; body: string; url: string; target: Target };

const PEER_URL = /^\/messages\?with=([0-9a-fA-F-]{36})$/;
function targetOf(url: string): Target | null {
  const m = PEER_URL.exec(url);
  return m ? { kind: "dm", peer: m[1] } : null;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const rec = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** الردُّ من المستمع (كائنُ `NotificationResponse`) أو من المهمّة (حزمةُ أندرويد نفسُها مسلسَلةً — `data` أو `dataString`) */
function parse(raw: unknown): Parsed | null {
  const r = rec(raw);
  const action = str(r.actionIdentifier);
  if (action !== ACTION_REPLY && action !== ACTION_READ) return null;
  const req = rec(rec(r.notification).request);
  const content = rec(req.content);
  let data = rec(content.data);
  if (!str(data.url) && str(content.dataString)) {
    try {
      data = rec(JSON.parse(str(content.dataString)));
    } catch {
      data = {};
    }
  }
  const url = str(data.url);
  const target = targetOf(url);
  if (!target) return null;
  const id = str(req.identifier);
  const text = str(r.userText).trim().slice(0, 2000);
  if (action === ACTION_REPLY && !text) return null;
  return { key: `${id}|${action}|${text}`, action, text, id, title: str(content.title), body: str(content.body), url, target };
}

/* ——— كلُّ ردٍّ مرّةً ——— */
const doneMem = new Set<string>();
function seenBefore(key: string): boolean {
  if (doneMem.has(key)) return true;
  try {
    const list = JSON.parse(SecureStore.getItem(DONE_KEY) ?? "[]") as unknown;
    return Array.isArray(list) && list.includes(key);
  } catch {
    return false;
  }
}
function markDone(key: string) {
  doneMem.add(key);
  try {
    const list = JSON.parse(SecureStore.getItem(DONE_KEY) ?? "[]") as unknown;
    const next = [...(Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : []), key].slice(-DONE_MAX);
    SecureStore.setItem(DONE_KEY, JSON.stringify(next));
  } catch {
    /* لا شيء — الذاكرةُ تكفي في هذا الإقلاع */
  }
}

/** نداءٌ بلا جسر: رمزُ الجلسة الحاليّ أو المملوكةُ تجدّد نفسها — وبلا رمزٍ لا نداء (الإشعارُ يقول «تعذّر») */
async function post(path: string, body: unknown): Promise<boolean> {
  const token = session.get() ?? (await own.ensure());
  if (!token) return false;
  try {
    const res = await fetch(`${CONFIG.apiBase}${path}`, {
      credentials: NO_COOKIES,
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Language": currentLocale(),
        Authorization: `Bearer ${token}`,
        ...GATE_HEADERS,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return res.ok && !!json && "data" in json;
  } catch {
    return false;
  }
}

/** الإشعارُ نفسُه (المعرّفُ ذاتُه يستبدله) بسطرٍ تحت الرسالة — على القناة الصامتة، وبالزرّين ليُردَّ ثانيةً */
async function rewrite(p: Parsed, line: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id || undefined,
      content: {
        title: p.title,
        body: p.body ? `${p.body}\n${line}` : line,
        data: { url: p.url },
        categoryIdentifier: DM_CATEGORY,
        sound: false,
      },
      trigger: Platform.OS === "android" ? { channelId: REPLIES_CHANNEL } : null,
    });
  } catch {
    /* لا شيء */
  }
}

async function handle(raw: unknown): Promise<void> {
  const p = parse(raw);
  if (!p || seenBefore(p.key)) return;
  markDone(p.key);
  const t: Dict = dictFor(currentLocale());
  if (p.action === ACTION_READ) {
    const body: MsgPeerBody = { person_id: p.target.peer };
    await post("/api/v1/me/messages/read", body);
    if (p.id) await Notifications.dismissNotificationAsync(p.id).catch(() => {});
  } else {
    const body: MsgTextBody = { recipient_id: p.target.peer, body: p.text };
    const ok = await post("/api/v1/me/messages/text", body);
    /* المرسَلُ ردٌّ على ما فيه ⇒ ما قبله مقروء (كالواتس)؛ والفشلُ يبقي الإشعارَ ويقول ما حدث */
    if (ok) void post("/api/v1/me/messages/read", { person_id: p.target.peer } satisfies MsgPeerBody);
    await rewrite(p, ok ? `${t.convYou}: ${p.text}` : `⚠️ ${t.pushReplyFailed}`);
  }
  /* التطبيقُ مفتوح ⇒ القائمةُ والشاراتُ لا تنتظر الاستطلاع */
  if (AppState.currentState === "active") {
    void queryClient.invalidateQueries({ queryKey: ["me:messages"] });
    void queryClient.invalidateQueries({ queryKey: ["me:badges"] });
  }
}

/**
 * 🆕 D-1408 — **الرسالةُ تصل «بيانات» والتطبيقُ يرسم إشعارَها** (أندرويد): إشعارُ Expo العاديُّ يعرضه النظامُ بنفسه والتطبيقُ
 * في الخلفية فيسقط الزرّان (تجربةُ أحمد ١٥ أكتوبر: «داخل التطبيق تظهر… فالخلفية لا»). الخادمُ يرسل بالبيانات لجهازٍ قال إنّه
 * يقدر (`caps: ["dm-data"]` — `dmDataCaps`)، والمهمّةُ نفسُها هنا تستلمها في الخلفية والأمام وترسم الإشعارَ بصوته وزرّيه.
 * والتطبيقُ أمامك ⇒ مُعالجُ العرض في `push.ts` يحجبه إن كانت المحادثةُ نفسُها مفتوحة، كما كان.
 */
type DmData = { title: string; body: string; url: string };
function dmDataOf(raw: unknown): DmData | null {
  const d = rec(rec(raw).data);
  let o: Record<string, unknown> = d;
  if (str(d.kind) !== "dm" && str(d.dataString)) {
    try {
      o = rec(JSON.parse(str(d.dataString)));
    } catch {
      return null;
    }
  }
  if (str(o.kind) !== "dm" || !targetOf(str(o.url))) return null;
  return { title: str(o.title).slice(0, 120), body: str(o.body).slice(0, 400), url: str(o.url) };
}

/**
 * 🔴 تجربةُ أحمد (١٥ أكتوبر، تسجيلٌ ٥:٠٨): الإشعارُ والتطبيقُ أمامه بزرّيه، ومقفولاً أو في الخلفية **بلا زرّين**. في الخلفية
 * يُقلع التطبيقُ بلا شاشةٍ لهذه المهمّة وحدَها — وتعريفُ النوع (`defineDmCategory`) يبدأ في اللحظة نفسِها عند تحميل الوحدة،
 * فيُرسم الإشعارُ قبل أن يُحفظ النوعُ فلا يجد أزراره. **الرسمُ ينتظر التعريف**، ثمّ يتحقّق أنّ الإشعار المرسوم يحمل نوعَه
 * ويكتب في سجلّ الأعطال ما وجد (مرّةً في الإقلاع) — فلا تخمينَ ثانٍ إن بقي.
 */
async function presentDm(m: DmData) {
  await categoryReady;
  trace(`draw state=${AppState.currentState}`);
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: m.title, body: m.body, data: { url: m.url }, categoryIdentifier: DM_CATEGORY, sound: "default" },
    trigger: Platform.OS === "android" ? { channelId: "default" } : null,
  });
  if (drawnReported) return;
  drawnReported = true;
  try {
    const shown = (await Notifications.getPresentedNotificationsAsync()).find((n) => n.request.identifier === id);
    const cats = (await Notifications.getNotificationCategoriesAsync()).map((c) => c.identifier).join(",");
    trace(`drawn shown=${shown ? "yes" : "no"} cat=${shown?.request.content.categoryIdentifier ?? "-"} cats=${cats || "-"}`);
    void post("/api/v1/app/crash", {
      screen: "messages",
      message: `dm drawn: state=${AppState.currentState} shown=${shown ? "yes" : "no"} cat=${shown?.request.content.categoryIdentifier ?? "-"} cats=${cats || "-"}`.slice(0, 300),
      version: Platform.OS,
    });
  } catch {
    /* التشخيصُ ليس شرطاً */
  }
}
let drawnReported = false;

/**
 * 🆕 أثرُ المهمّة في الخلفية **محفوظاً على الجهاز** ويُرسل في الإقلاع التالي: التطبيقُ بلا شاشةٍ قد لا يملك رمزاً يرسل به
 * (السجلُّ بقي فارغاً بعد تجربة ٥:٢٠ — لا نعرف هل جرت المهمّةُ أصلاً). سطرٌ لكلِّ حدث، آخرُ عشرة.
 */
const TRACE_KEY = "loopz.push.trace";
function trace(line: string) {
  try {
    const list = JSON.parse(SecureStore.getItem(TRACE_KEY) ?? "[]") as unknown;
    const prev = Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
    SecureStore.setItem(TRACE_KEY, JSON.stringify([...prev, `${new Date().toISOString().slice(11, 19)} ${line}`].slice(-10)));
  } catch {
    /* لا شيء */
  }
}
async function flushTrace() {
  try {
    const raw = SecureStore.getItem(TRACE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(list) || !list.length) return;
    const sent = await post("/api/v1/app/crash", { screen: "messages", message: `dm trace: ${list.join(" | ")}`.slice(0, 590), version: Platform.OS });
    if (sent) SecureStore.setItem(TRACE_KEY, "[]");
  } catch {
    /* لا شيء */
  }
}

/** المهمّةُ مسجَّلةٌ لإشعارات البيانات ⇒ الجهازُ يقدر يرسم الرسالةَ بنفسه — يقوله التسجيلُ للخادم */
let taskReady: Promise<boolean> = Promise.resolve(false);
export function dmDataCaps(): Promise<"dm-data"[]> {
  return taskReady.then((ok) => (ok && Platform.OS === "android" ? ["dm-data"] : []));
}

/** هل الضغطةُ زرٌّ من زرّينا؟ — `PushGate` لا يفتح شاشةً لها (الردُّ يُرسل في مكانه) */
export function isDmAction(r: Notifications.NotificationResponse | null): boolean {
  return !!r && (r.actionIdentifier === ACTION_REPLY || r.actionIdentifier === ACTION_READ);
}

/**
 * 🔴 بلاغُ أحمد (١٥ أكتوبر، بناء 82): الإشعارُ وصل بلا زرّين. **أندرويد لا يرسم الزرَّ إلّا لنوعٍ عرّفه التطبيقُ قبل وصوله**،
 * والتعريفُ كان (١) خلف الجلسة والإذن في `sync` و(٢) **بعد** إنشاء القناة الصامتة في الدالّة نفسِها — فأيُّ رميةٍ في القناة
 * تُسقط الزرّين بصمت. الآن: النوعُ أوّلاً ووحدَه، عند تحميل الوحدة (بلا جلسةٍ ولا إذن — تعريفُه لا يطلب شيئاً)، والقناةُ
 * بعده مستقلّة، ثمّ تحقّقٌ أنّ النوعَ محفوظٌ فعلاً — وما فشل يُكتب في سجلّ الأعطال بسببه لا يُبلع.
 */
let reported = false;
function report(what: string, e: unknown) {
  if (reported) return;
  reported = true;
  const msg = e instanceof Error ? e.message : String(e);
  void post("/api/v1/app/crash", { screen: "messages", message: `dm category: ${what}: ${msg}`.slice(0, 300), version: Platform.OS });
}

/** الأزرارُ بلغة الجهاز — تُعاد في كلِّ إقلاع (تبدّلُ اللغة يصل للزرّين) */
export async function defineDmCategory() {
  const t = dictFor(currentLocale());
  try {
    await Notifications.setNotificationCategoryAsync(DM_CATEGORY, [
      {
        identifier: ACTION_REPLY,
        buttonTitle: t.msgReply,
        textInput: { submitButtonTitle: t.pushReplySend, placeholder: t.msgReplyPlaceholder },
        options: { opensAppToForeground: false },
      },
      { identifier: ACTION_READ, buttonTitle: t.pushMarkRead, options: { opensAppToForeground: false } },
    ]);
    const all = await Notifications.getNotificationCategoriesAsync();
    if (!all.some((c) => c.identifier === DM_CATEGORY)) report("missing after set", "not stored");
  } catch (e) {
    report("set", e);
  }
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync(REPLIES_CHANNEL, {
        name: t.pushRepliesChannel,
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        enableVibrate: false,
      });
    } catch (e) {
      report("channel", e);
    }
  }
}

/* ===== التسجيلُ عند تحميل الوحدة — المهمّةُ في نطاقها لأنّ أندرويد يشغّلها بلا شاشة ===== */
const categoryReady: Promise<void> = defineDmCategory().catch(() => {});
/* التطبيقُ أمام صاحبه ⇒ يُرسل ما حفظته المهمّةُ في الخلفية */
setTimeout(() => {
  if (AppState.currentState === "active") void flushTrace();
}, 6000);
try {
  TaskManager.defineTask(TASK, async ({ data }) => {
    try {
      const dm = dmDataOf(data);
      const keys = Object.keys(rec(rec(data).data)).slice(0, 8).join(",");
      trace(`task state=${AppState.currentState} dm=${dm ? "yes" : "no"} keys=${keys || "-"}`);
      if (dm) await presentDm(dm);
      else await handle(data);
    } catch {
      /* لا شيء */
    }
  });
  taskReady = Notifications.registerTaskAsync(TASK)
    .then(() => true)
    .catch(() => false);
  Notifications.addNotificationResponseReceivedListener((r) => {
    if (isDmAction(r)) void handle(r).catch(() => {});
  });
  /* إقلاعٌ من ضغطةِ زرّ (الآيفون غالباً): الردُّ ينتظر هنا قبل أن يوجد المستمع */
  const last = Notifications.getLastNotificationResponse();
  if (isDmAction(last)) {
    Notifications.clearLastNotificationResponse();
    void handle(last).catch(() => {});
  }
} catch {
  /* بناءٌ بلا الوحدة الأصليّة */
}
