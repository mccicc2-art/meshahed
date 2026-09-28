import { AppState } from "react-native";
import { launchT0 } from "./perf";
import { api, queryClient } from "./api";
import { session } from "./session";
import { BUILD_TAG } from "./ota";
import { MODEL } from "./device";
import { own } from "./ownSession";

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
  /* 🆕 K3a-diag — مسارُ الرجوع من الأبواب الويبيّة وكيف وُلدت مجموعةُ الجذور (انظر `navTrace`) */
  | "nav.back"
  | "nav.enter";

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
 * ====== K3a-diag — أين ذهب زرُّ الرجوع؟ (`nav.back` · `nav.enter`) ======
 *
 * **لماذا**: تسجيلُ خالد على K3a (٢٨ سبتمبر): الرجوعُ من «المجتمع» المفتوح من «اكتشف» هبط على الرئيسيّة، ومن
 * الرئيسيّة كانت الضغطةُ الأولى بلا أثرٍ والثانيةُ خرجت من التطبيق. محاكاةُ الموجِّه (expo-router + jest) تقول إنّ
 * الطريقَ المكتوب صحيح — فالعطبُ في حالةٍ لا تُرى من الكود: مَن استلم الضغطة، وهل كان `shell.returnTo` حيّاً، وهل
 * طابق `doorPath` المسار، وهل وصل الباب أم انتهت مهلتُه. **لا نصلح ما لم نره.** كلُّ حدثٍ علامةٌ بلا هويّة، وقيمتُها
 * زمنُه منذ آخر بابٍ فُتح (فالترتيبُ يُقرأ من الرقم)، والحقولُ كلماتٌ من الكود لا نصٌّ حرّ. تُزال مع الإصلاح.
 */
let doorT0 = 0;
/** `shell.open` — صفرُ الساعة لما بعده */
export function doorOpened() {
  doorT0 = performance.now();
}
/* الخادمُ يقبل كلمةً من ١٦ حرفاً (`WORD`): المسارُ بلا شَرطته الأولى، وما سوى الحروف `_` */
const word = (s: string | null | undefined) =>
  s == null || s === "" ? "none" : s.replace(/^\//, "").replace(/[^\w.-]/g, "_").slice(0, 16) || "root";
export function navTrace(
  name: "nav.back" | "nav.enter",
  f: { screen: string; why: string; tab?: string | null; result?: string | null; ready?: boolean; src?: string | null },
) {
  mark(name, doorT0 ? performance.now() - doorT0 : 0, {
    screen: word(f.screen),
    why: word(f.why),
    tab: word(f.tab),
    result: word(f.result),
    ready: f.ready ? 1 : 0,
    src: word(f.src),
  });
}

/**
 * ====== ضغطةُ تبويب ⇒ الشاشةُ مرسومة (`tab.switch`) ======
 * الشريطُ يسجّل الوجهةَ ووقتَها، والشاشةُ الجذرُ تعلن وصولَها بعد أوّل رسم. وصولٌ لا
 * يطابق الوجهة (رجوعٌ، أو بابٌ ويبيّ) لا يُكتب — ولا ضغطةٌ أقدمُ من ١٠ ثوانٍ.
 */
let pendingTab: { to: string; t0: number } | null = null;
export function tabPressed(to: string) {
  pendingTab = { to, t0: performance.now() };
}
export function tabLanded(key: string) {
  const p = pendingTab;
  if (!p || p.to !== key) return;
  pendingTab = null;
  afterPaint(() => {
    const ms = performance.now() - p.t0;
    if (ms < 10_000) mark("tab.switch", ms, { tab: key });
  });
}

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
