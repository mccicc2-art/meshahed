import { AppState } from "react-native";
import { launchT0 } from "./perf";
import { api, queryClient } from "./api";
import { session } from "./session";
import { BUILD_TAG } from "./ota";
import { MODEL } from "./device";
import { own } from "./ownSession";
import { uiFramesStart, type UiWindow } from "./uiFrames";

/**
 * ====== علاماتُ الأداء في الشاشات الأصليّة — Phase 11-F · F0 (D-1024) ======
 *
 * **لماذا**: كلُّ ما في Phase 11-F مبنيٌّ على قراءة الكود لا على قياس — الحاويةُ
 * لا تصل الهاتف، و`perfMs` لا يُنادى إلّا في `web.tsx` وبـ`console.log`. فالتطبيقُ
 * يقيس نفسَه على هاتف صاحبه ويرسل الأرقام، **فنعرف ما قبل F1 وما بعدها** بدل
 * أن نخمّن.
 *
 * 🔑 **ملفٌّ ثانٍ لا `perf.ts` نفسُه**: `perf.ts` يُستورد أوّلاً في `index.ts` كي
 * يكون صفرُ الساعة أوّلَ كودٍ يُقيَّم — واستيرادُ `api` هناك كان سيقيّم العميلَ
 * و`auth` وSupabase **قبل** أخذ الصفر فيكذب الرقم.
 *
 * ⚖️ **صفرُ هويّةٍ وصفرُ نصٍّ حرّ** (نهجُ D-881): الاسمُ من قائمةٍ ثابتةٍ يتحقّق
 * منها الخادم، والقيمُ أرقامٌ، و`tab`/`screen` من قوائمَ مغلقة. والإرسالُ مجمَّعٌ:
 * مرّةً كلَّ ٣٠ ثانية على الأكثر وعند نزول التطبيق إلى الخلفيّة — **قياسٌ يثقل
 * ما يقيسه قياسٌ فاسد.** وضياعُ دفعةٍ لا يُقلق أحداً.
 */
export type PerfName =
  | "library.open"
  | "library.shelf.open"
  | "library.flatgrid"
  | "tab.arm"
  | "discover.open"
  | "coldstart.library"
  /* 🆕 D-1118 — بطءُ صفحة العمل والمواسم يُقاس لا يُخمَّن */
  | "title.open"
  /* 🆕 D-1224 — من لمس البطاقة إلى أوّل التزامٍ لصفحة العمل */
  | "title.tap"
  | "season.open"
  /* Phase 11-K · K1 — خطُّ الأساس قبل نقل الإيماءات والتبويبات */
  | "home.open"
  | "coldstart.home"
  | "search.open"
  | "tab.switch"
  | "boot.fresh"
  /* 🆕 D-1128 — «قبل» K2: إطاراتُ السحب الضائعة · وعمرُ الرمز لحظةَ استلامه (ثوانٍ) */
  | "gesture.jank"
  | "token.life"
  /* 🆕 D-1141 — انتظارُ الرمز من الصفحة: مدّتُه ونتيجتُه (`result=ok|none`) وجاهزيّةُ الصفحة (`ready=0|1`) */
  | "token.wait"
  /* 🆕 K4b — سكُّ جلسة التطبيق وتجديدُها بنفسه: المدّةُ ونتيجتُها (`result`/`why`) */
  | "session.mint"
  | "session.renew"
  /* 🆕 D-1152 — مراحلُ الدخول: نتيجةُ Google وتبادلِ الرمز (`auth.login`)، ثمّ وصولُ التسليم إلى الويب أو ارتدادُه
     إلى الترحيب (`auth.handoff`) — لتشخيص «أوّلُ محاولةٍ ترجع للترحيب» (ثلاثُ مرّاتٍ في تسجيلات ٢٧ سبتمبر) */
  | "auth.login"
  | "auth.handoff"
  /* 🆕 11-M · M1 — من تركيب «المجتمع» إلى أوّل رسمٍ فيه حمولة (`cached` كالرئيسيّة) */
  | "community.open"
  /* 🆕 11-M · M3 — شاشةُ النقاش ومنتقي الـGIF (خطّة §٥) */
  | "thread.open"
  | "gif.open"
  /* 🆕 M3-fix — رفعُ صورة النقاش: المدّةُ والنتيجةُ ومرحلةُ الفشل (بلاغُ خالد: السببُ كان يضيع) */
  | "thread.image"
  /* 🆕 11-N · N1 — من تركيب ملفّ الشخص الأصليّ إلى أوّل رسمٍ فيه حمولة (`cached`) */
  | "profile.open"
  /* 🆕 11-N · N4 — إحصاءاتُ العضو الأصليّة: من التركيب إلى أوّل رسمٍ فيه حمولة (`cached`) */
  | "stats.open"
  /* 🆕 11-M · M4 — «الرسائل» الأصليّة: من التركيب إلى أوّل رسمٍ فيه حمولة (`cached` · `tab`)، وقناةُ Realtime من الطلب
     إلى `SUBSCRIBED` أو سقوطِها (`result` · `why` حالُ القناة) — «تظهر خلال ثانيتين» يُقاس لا يُصدَّق (خطّة §٩) */
  | "messages.open"
  | "messages.live";

type Extra = Record<string, number | string>;
type Mark = { name: PerfName; ms: number; extra?: Extra };

const FLUSH_MS = 30_000;
const MAX_BUFFER = 40;

let buffer: Mark[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let lastFlush = 0;

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (buffer.length === 0) return;
  const marks = buffer;
  buffer = [];
  lastFlush = Date.now();
  /* 🔴 D-1141 — **يُرسل بلا رمزٍ إن غاب** (كان ينتظره): الدفعةُ كانت تبقى في الذاكرة حتى يصل رمز، والذاكرةُ
     ٤٠ علامةً يُرمى أقدمُها — فجهازُ خالد لم يرسل شيئاً ١٣ ساعةً وهو يستخدم التطبيق، و«٧ سحبات» كانت ما نجا
     لا ما حدث. **والقياسُ المفقودُ منحاز**: ينجو ما وقع والرمزُ حاضر، وتلك أسرعُ اللحظات. العلاماتُ بلا هويّة
     أصلاً (D-881)، والخادمُ يحدّ الزائرَ بعنوانه. ولا يطلب رمزاً لأجل قياس (`auth` = ما في الذاكرة الآن). */
  void api("/api/v1/app/perf", { method: "POST", body: { marks, version: BUILD_TAG, model: MODEL }, auth: session.has() }).catch(() => {});
}

export function mark(name: PerfName, ms: number, extra?: Extra) {
  if (!Number.isFinite(ms) || ms < 0) return;
  /* 🆕 D-1229 — «اكتشف» المركَّبةُ مخفيّةً تقيس `discover.open` بلا عينٍ تنتظر: تُعلَّم كي لا تُخلط بفتحٍ ظاهر */
  if (name === "discover.open" && preloaded.has("news") && !landedOnce.has("news")) extra = { ...extra, pre: 1 };
  /* 🆕 D-1246 — و«المكتبة» المركَّبةُ مسبقاً كذلك */
  if (name === "library.open" && preloaded.has("library") && !landedOnce.has("library")) extra = { ...extra, pre: 1 };
  if (buffer.length >= MAX_BUFFER) buffer.shift();
  buffer.push({ name, ms: Math.round(ms), ...(extra ? { extra } : {}) });
  if (!timer) timer = setTimeout(flush, Math.max(2_000, FLUSH_MS - (Date.now() - lastFlush)));
}

/** علامةٌ بطرفين: تُفتح الآن وتُغلق مرّةً واحدة — نداءٌ ثانٍ للإغلاق لا يكتب شيئاً */
export function span(name: PerfName, extra?: Extra): (more?: Extra) => void {
  const t0 = performance.now();
  let done = false;
  return (more) => {
    if (done) return;
    done = true;
    mark(name, performance.now() - t0, extra || more ? { ...extra, ...more } : undefined);
  };
}

/** «بعد أن تُرسم»: إطاران بعد الالتزام — الأوّلُ يُنهي التخطيط والثاني يصل الشاشة */
export function afterPaint(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/** الإقلاعُ البارد إلى أوّل شاشةٍ أصليّة — يُكتب مرّةً في عمر العمليّة */
let coldDone = false;
export function coldStartOnce(name: "coldstart.library" | "coldstart.home") {
  if (coldDone) return;
  coldDone = true;
  mark(name, performance.now() - launchT0);
}
/** شاشةٌ أصليّةٌ أخرى فُتحت أوّلاً ⇒ الإقلاعُ لم يعد «إلى المكتبة» فلا يُسجَّل */
export function coldStartVoid() {
  coldDone = true;
}

/* D-1125 — الدفعةُ لا تُرسل بلا رمز (القياسُ لا يستحقّ طلبَ رمزٍ من الـWebView)، فكانت تبقى معلّقةً
   إلى علامةٍ تالية — ولم تصل من 1.11.15 علامةٌ واحدة. تُرسل الآن لحظةَ يعود الرمز. */
session.subscribe(() => {
  /* D-1128 — عمرُ الرمز الذي وصل للتوّ (إن وصل): الرقمُ في خانة `ms` وهو ثوانٍ، والسالبُ لا يُكتب */
  const life = session.takeLife();
  if (life !== null) mark("token.life", Math.max(0, life));
  if (buffer.length > 0 && session.has()) flush();
});
/* 🆕 D-1141 — كلُّ طلبِ رمزٍ مرّةً: كم انتظر، وهل وصل، وهل كانت الصفحةُ جاهزة */
session.onWait((ms, extra) => mark("token.wait", ms, extra));
/* 🆕 K4b — الجلسةُ المملوكة: كلُّ سكٍّ وكلُّ تجديدٍ مرّةً (بلا رمزٍ في العلامة — مدّةٌ ونتيجةٌ وسبب) */
own.onEvent((name, ms, extra) => mark(name, ms, extra));

/**
 * ====== إطاراتُ السحب الضائعة (`gesture.jank`) — D-1128، «قبل» K2 ======
 * من قفل الإيماءة إلى رفع الإصبع — **المرحلةُ التي يحرّكها JS اليوم** (`pos.setValue` في كلِّ حركة)؛
 * الطيرانُ بعد الرفع على السائق الأصليّ فلا يُعدّ. كلُّ إطارٍ على خيط JS تجاوز ١٫٥ ضعفِ **ميزانيّة
 * 60Hz** (١٦٫٧ms) يُحسب بما فاته: فجوةُ ٥٠ms = إطاران ضائعان. الميزانيّةُ ثابتةٌ لا تُقاس من الشاشة
 * كي تبقى الأرقامُ قابلةً للمقارنة بين الأجهزة والإصدارات.
 * القيمةُ في خانة `ms` هي **عددُ الإطارات**، و`dur` مدّةُ السحب. بعد K2 يُقاس الشيءُ نفسُه على خيط
 * الواجهة (الخيطُ الذي يحرّك اللوحَ حينها) بالاسم نفسِه — فالمقارنةُ «إطارٌ رآه الإصبعُ ضاع».
 */
const FRAME_MS = 1000 / 60;
export function jankStart(extra: Extra): () => void {
  let raf = 0;
  let last = performance.now();
  const t0 = last;
  let dropped = 0;
  let live = true;
  const tick = (now: number) => {
    if (!live) return;
    const gap = now - last;
    last = now;
    if (gap > FRAME_MS * 1.5) dropped += Math.round(gap / FRAME_MS) - 1;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    if (!live) return;
    live = false;
    cancelAnimationFrame(raf);
    const dur = performance.now() - t0;
    /* نقرةٌ قُفلت ثمّ رُفعت فوراً لا تقول شيئاً عن السحب */
    if (dur >= 120) mark("gesture.jank", dropped, { ...extra, dur: Math.round(dur) });
  };
}

/**
 * ====== ضغطةُ تبويب ⇒ الشاشةُ مرسومة (`tab.switch`) ======
 * الشريطُ يسجّل الوجهةَ ووقتَها، والشاشةُ الجذرُ تعلن وصولَها بعد أوّل رسم. وصولٌ لا
 * يطابق الوجهة (رجوعٌ، أو بابٌ ويبيّ) لا يُكتب — ولا ضغطةٌ أقدمُ من ١٠ ثوانٍ.
 *
 * 🆕 D-1208 — **الرقمُ مقسومٌ على مراحله** (قياسٌ لا يغيّر سلوكاً): بعد K3a بقي الوسيطُ ١٢٠–٢٥٠ms بدل ~٢٠
 * المتوقَّعة، وحتى «البحث» — أخفُّ الجذور — لا ينزل عن ~١٠٠. كلفةٌ ثابتةٌ في كلِّ تبديل لا نعرف مكانَها،
 * وإصلاحٌ قبل معرفته تخمين (D-152). فالعلامةُ نفسُها تحمل الآن:
 * - `from` — التبويبُ المتروك: تجميدُه وآثارُ مغادرته جزءٌ من الثمن، وقد يكون «من اكتشف» هو الثقيل لا «إلى اكتشف».
 * - `go` — من الضغطة إلى عودة نداء التنقّل: عملُ JS المتزامن في الضغطة نفسِها.
 * - `focus` — من الضغطة إلى تأثير الظهور في الوجهة: فكُّ التجميد ورسمُ ما تراكم وهو مخفيّ والالتزام.
 *   والباقي (`ms − focus`) إطارا الرسم بعد الظهور ومعهما ما أطلقه الظهورُ نفسُه (التجديدُ عند العودة).
 * - `drop` — إطاراتٌ ضاعت على خيط JS في النافذة كلِّها (ميزانيّةُ 60Hz كـ`gesture.jank`): رقمٌ كبير = الخيطُ
 *   مشغول، وصفرٌ مع زمنٍ طويل = الانتظارُ خارج JS (الجسر أو خيطُ الواجهة) — والعلاجان مختلفان.
 * - `cached` — ١ إن سبق أن وصل هذا التبويبُ في عمر العمليّة (يُفكّ تجميدُه)، و٠ لأوّل وصول (يُركَّب من الصفر
 *   بـ`lazy`) — كي لا يختلط التركيبُ الأوّل بكلفة التبديل. (مجموعةٌ أُعيد تركيبُها تحت بابٍ ويبيّ تُقرأ `1` خطأً — نادرةٌ بعد K3b.)
 * - 🆕 D-1235 — `ud` · `ug` · `ut` · `uf`: الشيءُ نفسُه على **خيط الواجهة** (`uiFrames.ts`) — `drop` صفرٌ و`ud` كبير =
 *   الانتظارُ في لصق العروض الأصليّة لا في كودنا. العلامةُ تُكتب حين يعود رقمُ ذلك الخيط (أو بعد مهلته)، و`ms` محسوبٌ قبله.
 * الساعةُ تبدأ من `onPress` (رفعُ الإصبع) كما كانت، فالأرقامُ تُقارن بما قبلها.
 */
let pendingTab: { to: string; from: string; t0: number; go?: number; focus?: number; tally: Record<string, number>; stopFrames: () => number; ui: UiWindow } | null = null;
/**
 * 🆕 D-1218 — **عدّاداتُ الرسم في نافذة التبديل** (تشخيصُ «⇐ اكتشف»: `focus` ٨٥–١٠٠ بارداً ومدفّأً معاً — ضعفُ
 * المكتبة، ولا `useIsFocused` فيها). السؤالُ الذي تجيبه: **هل الوقتُ قبل أوّل رسمٍ للشاشة (فكُّ التجميد والتنقّل)
 * أم في الرسم نفسِه؟ وكم مكوّناً يُعاد رسمُه؟**
 * - `first` — ms من الضغطة إلى أوّل رسمٍ لجذر الوجهة.
 * - `roots` · `panes` · `rails` · `cards` — كم مرّةً رُسم الجذرُ واللوحُ والصفُّ والبطاقةُ من الضغطة إلى ما بعد
 *   الإطارين (لا إلى `focus` وحدَه: التجديدُ عند العودة يقع بعده).
 * - `live` — بطاقاتُ الصفوف المركَّبةُ لحظةَ الوصول («اكتشف» وحدَها): حجمُ الشجرة التي فُكّ تجميدُها.
 * **عدٌّ في جسم الرسم بلا حالةٍ ولا أثر** — زيادةُ رقمٍ في كائن.
 */
let counting: { tally: Record<string, number>; first?: number; t0: number; to: string } | null = null;
export function tabTick(k: "roots" | "panes" | "rails" | "cards" | "marq", screen?: string) {
  const c = counting;
  if (!c) return;
  if (k === "roots" && screen === c.to && c.first === undefined) c.first = performance.now() - c.t0;
  c.tally[k] = (c.tally[k] ?? 0) + 1;
}
/**
 * 🆕 D-1231 — **حدودُ مرحلة الالتزام في نافذة التبديل** (`CommitProbe` في ملفّات المسارات): بعد D-1230 بقيت «اكتشف» أبطأَ
 * الجذور (~١١٥ms) وعدّاداتُ الرسم فيها صفر — فالوقتُ ليس رسماً. فكُّ التجميد يعيد تركيبَ **تأثيرات التخطيط** لكلِّ مكوّنٍ في
 * الشجرة المكشوفة (React يعامل الكشفَ كظهورٍ جديد) ولو لم يُرسم شيء. مسبارٌ قبل الشاشة وآخرُ بعدها بين إخوتها:
 * - `cs` — ms من الضغطة إلى بدء مرحلة التخطيط (الرسمُ والتعديلاتُ انتهت).
 * - `ce` — ms إلى نهايتها: `ce − cs` = كلفةُ تأثيرات التخطيط التي أُعيد تركيبُها في الشجرة كلِّها.
 * - `qc` — تحديثاتُ كاش الاستعلامات في النافذة (تجديدٌ وصل، أو كتابة).
 */
export function tabCommit(edge: "cs" | "ce", screen: string) {
  const c = counting;
  if (!c || c.to !== screen || c.tally[edge] !== undefined) return;
  c.tally[edge] = Math.round(performance.now() - c.t0);
}
queryClient.getQueryCache().subscribe((e) => {
  const c = counting;
  if (c && e.type === "updated") c.tally.qc = (c.tally.qc ?? 0) + 1;
});
let liveCards = 0;
export function cardLive(d: 1 | -1) {
  liveCards += d;
}

/** عدّادُ إطاراتٍ ضائعة يعمل حتى يُطلب رقمُه — نسخةُ `jankStart` بلا حدِّ مدّةٍ ولا علامة */
function frameCounter(): () => number {
  let raf = 0;
  let last = performance.now();
  let dropped = 0;
  let live = true;
  const tick = (now: number) => {
    if (!live) return;
    const gap = now - last;
    last = now;
    if (gap > FRAME_MS * 1.5) dropped += Math.round(gap / FRAME_MS) - 1;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    if (live) {
      live = false;
      cancelAnimationFrame(raf);
    }
    return dropped;
  };
}

/**
 * 🆕 D-1230 — **آخرُ تبويبٍ غادره الشريط** (لا يُمسح عند الوصول كـ`pendingTab`): غيابُ الشاشة بتبديل تبويبٍ غيرُ غيابها
 * تحت صفحةٍ مدفوعة — الأوّلُ يجمّدها المتنقّلُ بنفسه (`freezeOnBlur`)، والثاني لا. `rowSight` يسأل هنا كي لا يُطفئ ويُشعل
 * أسماءَ المكتبة الماشية مع كلِّ تبديل.
 */
let lastLeft: { from: string; at: number } | null = null;
export function tabLeaving(key: string): boolean {
  return !!lastLeft && lastLeft.from === key && performance.now() - lastLeft.at < 1000;
}

export function tabPressed(to: string, from: string) {
  pendingTab?.stopFrames();
  pendingTab?.ui.cancel();
  if (to !== from) lastLeft = { from, at: performance.now() };
  /* ضغطةُ التبويب الظاهر لا تنقل ولا تُعلن وصولاً — لا شيءَ يُقاس، ولا عدّادٌ يدور بلا نهاية */
  if (to === from) {
    pendingTab = null;
    counting = null;
    return;
  }
  const t0 = performance.now();
  const tally: Record<string, number> = {};
  pendingTab = { to, from, t0, tally, stopFrames: frameCounter(), ui: uiFramesStart() };
  counting = { tally, t0, to };
}
/** نداءُ التنقّل عاد (الشريطُ يستدعيها بعد `onGo`/`navigate`) */
export function tabGone() {
  const p = pendingTab;
  if (p && p.go === undefined) p.go = performance.now() - p.t0;
}
const landedOnce = new Set<string>();
/** 🆕 D-1229 — تبويباتٌ رُكّبت مسبقاً في الخلفيّة قبل أوّل زيارة: أوّلُ وصولٍ لها يُعلَّم `pre:1` ليُقارَن بالبارد الحقيقيّ */
const preloaded = new Set<string>();
export function tabPreloaded(key: string) {
  preloaded.add(key);
}
/** التبويبُ زِيرَ في هذه الجلسة؟ (لا معنى لتركيبٍ مسبقٍ لشاشةٍ رُكّبت) */
export const tabSeen = (key: string) => landedOnce.has(key);
export function tabLanded(key: string) {
  const p = pendingTab;
  const seen = landedOnce.has(key);
  landedOnce.add(key);
  if (!p || p.to !== key) return;
  pendingTab = null;
  p.focus = performance.now() - p.t0;
  const c = counting;
  const live = key === "news" ? liveCards : undefined;
  afterPaint(() => {
    const ms = performance.now() - p.t0;
    const drop = p.stopFrames();
    if (counting === c) counting = null;
    if (ms >= 10_000) return p.ui.cancel();
    const extra: Extra = {
      tab: key,
      from: p.from,
      ...(p.go !== undefined ? { go: Math.round(p.go) } : {}),
      focus: Math.round(p.focus ?? ms),
      drop,
      cached: seen ? 1 : 0,
      ...(!seen && preloaded.has(key) ? { pre: 1 } : {}),
      ...(c?.first !== undefined ? { first: Math.round(c.first) } : {}),
      ...(c?.tally ?? {}),
      ...(live !== undefined ? { live } : {}),
    };
    /* 🆕 D-1235 — رقمُ خيط الواجهة يعود بعد إطارٍ منه: العلامةُ تنتظره (أو مهلتَه) و`ms` لا يتغيّر */
    p.ui.stop((u) => mark("tab.switch", ms, u ? { ...extra, ...u } : extra));
  });
}
/* ضغطةٌ لم تصل (بابٌ ويبيّ اعترضها، أو رجوع) لا تُبقي عدّادَ الإطارات حيّاً: يُطفأ بعد ١٠ ثوانٍ كحدِّ العلامة */
setInterval(() => {
  const p = pendingTab;
  if (p && performance.now() - p.t0 > 10_000) {
    p.stopFrames();
    p.ui.cancel();
    pendingTab = null;
    counting = null;
  }
}, 10_000);

/**
 * ====== من الإقلاع إلى أوّل بياناتٍ حيّة (`boot.fresh`) ======
 * الكاشُ المحفوظ يرسم الشاشةَ قبل الشبكة، فـ`home.open` وحدَه لا يقول متى صارت
 * البياناتُ حقيقيّة. أوّلُ استعلامٍ ينجح من الشبكة (لا من الاستعادة — تلك `setState`
 * لا `success`) هو اللحظة — وهو المقياسُ الذي تُحكم به K4.
 */
let freshDone = false;
const unsubFresh = queryClient.getQueryCache().subscribe((e) => {
  if (freshDone || e.type !== "updated" || e.action.type !== "success" || e.action.manual) return;
  freshDone = true;
  mark("boot.fresh", performance.now() - launchT0);
  queueMicrotask(unsubFresh);
});

AppState.addEventListener("change", (s) => {
  if (s !== "active") flush();
});
