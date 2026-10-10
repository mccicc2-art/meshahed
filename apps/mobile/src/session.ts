import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { own } from "./ownSession";

/**
 * ====== رمزُ الوصول للشاشات الأصليّة — ذاكرةٌ فقط، وطلبٌ بـnonce ======
 * (Phase 11 · B1، D-936 — عقدُ الأمان §٢.٢-ب في `PHASE_11_APP_PERFORMANCE_AND_NATIVE_LIBRARY.md`)
 *
 * 🔑 **الجلسةُ ملكُ الـWebView** (D-922 · D-932): الغلافُ لا يحمل رمزَ
 * تجديدٍ **إطلاقاً**، ولا يُجدّد، ولا ينادي `/token` ولا `/logout`. يحمل
 * **رمزَ الوصول وحدَه** (ساعةً) في متغيّرِ وحدةٍ — **لا SecureStore، لا
 * AsyncStorage، لا `console.*`** — ويطلبه من الصفحة حين يحتاجه، والصفحةُ
 * تجدّده عبر كوكيها إن لزم. **عميلان يدوّران رمزَ تجديدٍ واحداً** هو عطلُ
 * `refresh_token_already_used` الذي أسقط الدخولَ في ٧ سبتمبر — ولن يعود.
 *
 * 🔑 **الطلبُ قبل العطاء، وبـ`nonce`** (المراجع ٩ §٦-ب): جسرُ
 * `react-native-webview` على أندرويد يُحقن في **كلِّ الإطارات**، فرسالةُ
 * `session` قد تأتي من iframe. **و`injectJavaScript` يعمل في الإطار
 * الرئيسيّ وحدَه** — فالحدثُ الذي نحقنه بـ`nonce` عشوائيٍّ (١٦ بايت،
 * `expo-crypto`) لا يراه إلا سياقُ صفحتنا، **ولا يُقبل ردٌّ بلا `nonce`
 * مطابقٍ غيرِ منتهٍ (٣٠ ث) وغيرِ مستعمَل.** والـURL يُفحص أيضاً (`INSIDE`)
 * دفاعاً في عمق، لا دليلاً وحدَه.
 *
 * 🔑 **والمسحُ في ثلاثة مواضع**: رسالةُ `session:clear` من الصفحة (خروجٌ أو
 * تبدّلُ مستخدم) · عنوانُ `/auth/signout` أو `/login` في تاريخ الـWebView
 * (حزامٌ ثانٍ لا يعتمد على JS الصفحة) · **خلفيّةٌ تجاوزت ٥ دقائق** — وعند
 * العودة يُطلب رمزٌ جديد قبل أوّل نداء، لا نداءَ برمزٍ قد يكون شاخ.
 */

/** الرمزُ ولحظةُ انتهائه — الوحدةُ كلُّها تعيش في هذا الإغلاق */
let access: string | null = null;
let exp = 0; // ثوانٍ منذ الحقبة، كما يعيدها Supabase
/** الطلبُ المعلَّق: `nonce` واحدٌ في كلِّ لحظة، ومن ردّ بغيره يُهمل */
let pending: { nonce: string; at: number; resolve: (t: string | null) => void; acked?: boolean } | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
/** من يحقن في الصفحة — يسجّله `web.tsx` عند تركيب الـWebView */
let inject: ((js: string) => void) | null = null;
/**
 * D-1075 — **الصفحةُ جاهزةٌ للطلب؟** الإقلاعُ صار إلى الرئيسيّة الأصليّة فوق الـWebView قبل أن
 * تُحمَّل صفحتُها؛ وطلبُ الرمز قبل التحميل كان يُحقن في فراغٍ ويعود `null` بعد ٨ث فيفشل أوّلُ
 * نداء. الآن يصطفّ الطلبُ حتى يبلّغ الغلافُ `onLoadEnd` (أو فشلَ التحميل — فيُصرف بـ`null`
 * كما كان). الجلسةُ ما زالت ملكَ الـWebView؛ ما تغيّر هو التوقيتُ لا المصدر.
 */
let pageReady = false;
let waiters: (() => void)[] = [];
/**
 * D-1075 — **أثرُ جلسةٍ سابقة** (لا رمزٌ ولا سرّ): «١» بعد أوّل رمزٍ مقبول، وتُمحى عند الخروج.
 * بها يقرّر الغلافُ عند الإقلاع أن يرفع الرئيسيّةَ الأصليّةَ فوراً؛ وبدونها (أوّلُ تثبيتٍ أو بعد
 * خروج) يُترك الويبُ يعرض الدخولَ كما كان. الكوكي في مخزن الـWebView لا يراه RN، فهذا بديلُ السؤال.
 */
const SEEN_KEY = "loopz.session.seen";
const listeners = new Set<() => void>();
/**
 * 🆕 D-1128 — **الأثرُ في الذاكرة أيضاً**: `seen()` صار يُقرأ في كلِّ رسمةٍ لـ«من أنا» (`state.tsx`)،
 * وقراءةُ SecureStore نداءٌ أصليٌّ متزامن — فتُقرأ مرّةً وتُحفظ هنا، ويبدّلها الاستلامُ والخروجُ ويُبلغان.
 */
let seenMem: boolean | null = null;
/**
 * 🆕 D-1128 — **عمرُ الرمز لحظةَ استلامه** (ثوانٍ): المسبارُ أثبت `token=0` بعد حفظٍ ناجح بثانيتين،
 * والفرضيّةُ أنّ الصفحةَ تسلّم رمزاً باقيه أقلُّ من ٣٠ث فيُقبل هنا ثمّ يرفضه `has()` فوراً. يُقرأ مرّةً
 * لكلِّ استلام (`takeLife`) ويُرسل علامةَ أداء `token.life` — رقمٌ لا رمز.
 */
let lastLife: number | null = null;

/**
 * 🆕 D-1341 (Phase 11-U · U0) — **«لم يُتمّ الترحيب»: علامةٌ على الجهاز** (لا سرّ — «١» أو لا شيء).
 *
 * قرارُ أحمد ١٧ (بتسجيلٍ تجاوز فيه الترحيبَ بحسابٍ جديد): «الخطوات اجبارية .. محد يقدر يتصفح الا اذا خلصها».
 * بابان في التطبيق: الشريطُ الأصليُّ فوق `/welcome`، والإقلاعُ الذي يرفع الرئيسيّةَ الأصليّةَ لكلِّ جهازٍ رأى
 * جلسة (D-1075) **قبل أيِّ شبكة** — فلا يُسأل الخادمُ ساعتَها، ولا بدّ من شيءٍ محفوظٍ يُقرأ.
 *
 * 🔑 **تُكتب من مصدرين لا يخطئان**: صفحةُ الويب وصلت `/welcome` (الحارسُ في الخادم هو من حوّلها)، أو
 * `/api/v1` ردّ `apiFinishWelcome`. **وتُمحى من ثلاثة**: رسالةُ «انتهى الترحيب» من الصفحة · `/api/v1/me`
 * يقول `onboarded` (أتمّه على جهازٍ آخر) · الخروج. **وغيابُها يعني «كما كان»**: العضوُ القائمُ لا يتغيّر
 * عليه شيء، ومن لم يُتمّ ولا علامةَ له بعدُ يرفضه الخادمُ عند أوّل نداء فتُكتب.
 */
const WELCOME_KEY = "loopz.welcome.pending";
let welcomeMem: boolean | null = null;
const welcomeListeners = new Set<(pending: boolean) => void>();

/**
 * 🆕 D-1141 — **كم انتظرنا الرمزَ، وبأيِّ نتيجة** (`token.wait`): صفحةُ العمل انتظرت ٦ث والحلقاتُ ١٠ث
 * أخرى في تسجيل خالد (٢٦ سبتمبر)، ولم يصل من جهازه قياسٌ واحدٌ ١٣ ساعة — **والسببُ المرجَّح صفحةٌ لا تردّ**.
 * كلُّ طلبٍ يُبلَّغ مرّةً: مدّتُه، ونتيجتُه (`ok` · `none`)، وهل كانت الصفحةُ جاهزةً لحظةَ الطلب (`ready`).
 * المستمعُ في `perfMarks.ts` (الاتّجاهُ من هناك إلى هنا — استيرادُه من هنا دائرة).
 */
type WaitWhy = "noack" | "slow" | "stall" | "host" | "jwt" | "exp" | "clear" | "noinject";
type WaitReport = (ms: number, extra: { result: "ok" | "none"; ready: 0 | 1; why?: WaitWhy; src?: "cookie" | "lib" | "own" }) => void;
/**
 * 🆕 D-1143 — **لماذا انتهى الطلبُ الأخير** (يُقرأ مرّةً عند التبليغ): `noack` لم يصل الحدثُ الصفحةَ أصلاً ·
 * `slow` وصل ولم يُجب في ٨ث · `stall` الصفحةُ قالت إنّ مكتبتَها علقت · `host`/`jwt`/`exp` ردٌّ رُفض ·
 * `clear` الصفحةُ بلا جلسة. ومع النجاح: `src` من الكوكي أم من المكتبة.
 */
let lastWhy: WaitWhy | undefined;
let lastSrc: "cookie" | "lib" | "own" | undefined;
const waitListeners = new Set<WaitReport>();
/** 🆕 D-1141 — طلبٌ واحدٌ في الطريق لكلِّ من يسأل — كان كلُّ نداءٍ في الطابور يرسل طلبَه بعد التحميل */
let inflight: Promise<string | null> | null = null;

const NONCE_TTL_MS = 30_000;
const REPLY_TIMEOUT_MS = 8_000;
/** بعد خلفيّةٍ أطولَ من هذا يُمسح الرمز (§٦-ج) */
/** D-1144 — لم يعد يُستعمل (زال مسحُ الخمس دقائق)؛ يبقى الاسمُ لأنّ التعليقاتَ والوثائقَ تشير إليه */
export const BACKGROUND_CLEAR_MS = 5 * 60_000;

const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** D-1026 (F2) — من يسمع **الخروج** (لا مجرّدَ شيخوخة الرمز): كاشُ الملفّ يُمسح هنا وحدَه */
const signOutListeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
/* 🆕 K4b — رمزٌ مملوكٌ وصل أو سقط ⇒ يُبلَغ من ينتظر الرمز (`useGuestUpgrade`…) كما يُبلَغ برمز الجسر */
own.onChange(emit);

export const session = {
  /** الرمزُ الحاليُّ إن كان صالحاً لثلاثين ثانيةً أخرى على الأقلّ */
  get(): string | null {
    /* 🆕 K4b — الجلسةُ المملوكةُ أوّلاً (والمفتاحُ مطفأٌ ⇒ `null` دائماً فيبقى كلُّ شيءٍ كما كان) */
    const mine = own.get();
    if (mine) return mine;
    if (!access) return null;
    if (exp * 1000 - Date.now() < 30_000) return null;
    return access;
  },
  has(): boolean {
    return session.get() !== null;
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  attach(fn: ((js: string) => void) | null) {
    inject = fn;
    if (!fn) session.ready(false);
  },
  /** D-1075 — الصفحةُ حُمِّلت (`true`: يُصرف الطابورُ فتُحقن الطلبات) أو تُعاد/تسقط (`false`) */
  ready(ok: boolean) {
    pageReady = ok;
    if (!ok) return;
    const w = waiters;
    waiters = [];
    for (const r of w) r();
  },
  /** D-1075 — التحميلُ فشل: من انتظر يُصرف الآن ويأخذ `null` كما لو انتهى وقتُه */
  abandon() {
    const w = waiters;
    waiters = [];
    for (const r of w) r();
  },
  /**
   * D-1075 — هل رأى هذا الجهازُ جلسةً ولم يخرج منها؟
   *
   * 🔴 D-1151 — **من مصدرين موثوقين لا من الجسر وحدَه** (نقاشُ ٢٧ سبتمبر: بعد خروجٍ ودخولٍ صار خالد «زائراً»
   * عند التطبيق — إقلاعٌ إلى الويب، والشريطُ يفتح صفحاتِ ويب (D-1115) — لأنّ الأثرَ لا يُكتب إلّا برمزٍ عبر الجسر،
   * والجسرُ لا يُجيب غالباً). الآن: الأثرُ المكتوب (بالجسر، أو لحظةَ الدخول الأصليّ — `markSeen`، الحلّ أ)،
   * **أو جلسةٌ مملوكةٌ محفوظة** (K4b — الحلّ ب): رمزُ تجديدٍ في SecureStore يعني دخولاً على هذا الجهاز لم يُخرج
   * منه. تُرفض عند الخادم ⇒ تُمسح (`own.clear`) ⇒ يسقط هذا المصدرُ معها ويُبلَّغ المشتركون.
   */
  seen(): boolean {
    if (seenMem === null) {
      try {
        seenMem = SecureStore.getItem(SEEN_KEY) === "1";
      } catch {
        seenMem = false;
      }
    }
    return seenMem || own.hasStored();
  },
  /**
   * 🆕 D-1151 (الحلّ أ) — **الأثرُ يُكتب لحظةَ نجاح الدخول الأصليّ بـGoogle**: التطبيقُ نفسُه أجرى الدخول فيعرفه
   * يقيناً، ولا ينتظر رمزاً عبر جسرٍ قد لا يُجيب. أثرٌ لا رمز، كما في `receive`.
   */
  markSeen() {
    seenMem = true;
    try {
      SecureStore.setItem(SEEN_KEY, "1");
    } catch {
      /* لا شيء */
    }
    emit();
  },
  /** 🆕 D-1341 — هل على هذا الجهاز حسابٌ دخل ولم يُتمّ الترحيب؟ (تُقرأ مرّةً من القرص ثمّ من الذاكرة) */
  welcomePending(): boolean {
    if (welcomeMem === null) {
      try {
        welcomeMem = SecureStore.getItem(WELCOME_KEY) === "1";
      } catch {
        welcomeMem = false;
      }
    }
    return welcomeMem;
  },
  /** 🆕 D-1341 — تُكتب/تُمحى، ويُبلَّغ من يسمع **عند التبدّل وحدَه** (الغلافُ يُنزل الشاشاتِ الأصليّةَ عندها) */
  setWelcomePending(on: boolean) {
    if (session.welcomePending() === on) return;
    welcomeMem = on;
    try {
      if (on) SecureStore.setItem(WELCOME_KEY, "1");
      else SecureStore.deleteItemAsync(WELCOME_KEY).catch(() => {});
    } catch {
      /* لا شيء — الذاكرةُ تكفي لهذه الجلسة، والخادمُ يرفض في التالية فتُكتب */
    }
    for (const l of welcomeListeners) l(on);
  },
  onWelcome(l: (pending: boolean) => void): () => void {
    welcomeListeners.add(l);
    return () => welcomeListeners.delete(l);
  },
  /** D-1128 — عمرُ آخر رمزٍ استُلم (ثوانٍ) — يُؤخذ مرّةً ثمّ يُمحى */
  takeLife(): number | null {
    const v = lastLife;
    lastLife = null;
    return v;
  },
  onSignOut(l: () => void): () => void {
    signOutListeners.add(l);
    return () => signOutListeners.delete(l);
  },
  /**
   * D-1026 (F2) — **خروجٌ أو تبدّلُ مستخدم**، لا رمزٌ شاخ: `clear()` تُنادى كلَّ ساعةٍ وبعد كلِّ
   * خلفيّةٍ طويلة ولا تعني أنّ صاحبَ الجهاز تغيّر؛ هذه تعنيه — فيُمسح معها ما حُفظ له.
   */
  signOut() {
    session.clear();
    /* 🆕 K4b — الخروجُ يمسح الجلسةَ المملوكةَ أيضاً — محلّيّاً؛ الويبُ خرج بـ`global` فأبطلها عند الخادم */
    own.clear();
    const hadSeen = seenMem !== false;
    seenMem = false;
    try {
      SecureStore.deleteItemAsync(SEEN_KEY).catch(() => {});
    } catch {
      /* لا شيء */
    }
    /* 🆕 D-1341 — العلامةُ لصاحب الجلسة: تخرج معه، والداخلُ بعده يحكم له الخادم */
    session.setWelcomePending(false);
    for (const l of signOutListeners) l();
    /* D-1128 — «من أنا» يُفعَّل بالأثر: يُبلَغ بزواله فيتوقّف */
    if (hadSeen) emit();
  },
  clear() {
    const had = !!access;
    access = null;
    exp = 0;
    if (pending) {
      pending.resolve(null);
      pending = null;
    }
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
    /* D-1141 — مسحٌ يليه طلبٌ جديدٌ فوراً (إعادةُ المحاولة عند 401): لا يعود الطلبُ الملغى نفسُه */
    inflight = null;
    /* 🆕 K4b — `401`: رمزُ الوصول المملوك يسقط أيضاً، ورمزُ تجديده يبقى فيُجدَّد في الطلب التالي */
    own.dropAccess();
    if (had) emit();
  },
  /**
   * يطلب رمزاً من الصفحة ويعود به (أو `null`). **محاولةٌ واحدةٌ في كلِّ
   * نداء** — المستدعي (`api.ts`) يحدّ المحاولاتِ باثنتين ثمّ يعود إلى
   * الـWebView برسالة. طلبٌ متزامنٌ ثانٍ ينتظر الأوّلَ نفسَه.
   */
  request(): Promise<string | null> {
    if (inflight) return inflight;
    const t0 = Date.now();
    const ready: 0 | 1 = pageReady ? 1 : 0;
    const p = session.requestOnce();
    /* يُصفَّر إن كان هو نفسُه الذي في الطريق — مسحٌ بينهما قد أطلق طلباً أحدث */
    const mine: Promise<string | null> = p.finally(() => {
      if (inflight === mine) inflight = null;
    });
    inflight = mine;
    void p.then((tok) => {
      const extra = { result: tok ? ("ok" as const) : ("none" as const), ready, ...(tok ? (lastSrc ? { src: lastSrc } : {}) : lastWhy ? { why: lastWhy } : {}) };
      lastWhy = undefined;
      lastSrc = undefined;
      for (const l of waitListeners) l(Date.now() - t0, extra);
    });
    return mine;
  },
  /** 🆕 D-1141 — مستمعُ `token.wait` */
  onWait(l: WaitReport): () => void {
    waitListeners.add(l);
    return () => waitListeners.delete(l);
  },
  /**
   * 🆕 K4b — **الجلسةُ المملوكةُ أوّلاً** (رمزٌ في الذاكرة أو تجديدٌ بنفسه)، والجسرُ بعدها كما كان. المفتاحُ
   * مطفأٌ ⇒ `ensure()` يعود `null` فوراً ⇒ الجسرُ وحدَه، حرفيّاً كما قبل K4b.
   */
  requestOnce(): Promise<string | null> {
    if (!own.enabled()) return session.bridgeOnce();
    return own.ensure().then((t) => {
      if (t) {
        lastSrc = "own";
        return t;
      }
      return session.bridgeOnce();
    });
  },
  /** المحاولةُ نفسُها كما كانت (D-1075) — `request()` يغلّفها بطلبٍ واحدٍ في الطريق وبالقياس */
  bridgeOnce(): Promise<string | null> {
    if (pending) {
      return new Promise((resolve) => {
        const prev = pending!.resolve;
        pending!.resolve = (t) => {
          prev(t);
          resolve(t);
        };
      });
    }
    if (!inject) {
      lastWhy = "noinject";
      return Promise.resolve(null);
    }
    /* D-1075 — الصفحةُ لم تُحمَّل بعد: اصطفّ، ثمّ أعد المحاولةَ من أوّلها (قد يكون غيرُك سبقك) */
    if (!pageReady) return new Promise<void>((r) => waiters.push(r)).then(() => (inject ? session.bridgeOnce() : null));
    lastWhy = undefined;
    lastSrc = undefined;
    const nonce = bytesToHex(Crypto.getRandomBytes(16));
    return new Promise((resolve) => {
      pending = { nonce, at: Date.now(), resolve };
      pendingTimer = setTimeout(() => {
        if (pending?.nonce === nonce) {
          lastWhy = pending.acked ? "slow" : "noack";
          pending.resolve(null);
          pending = null;
        }
      }, REPLY_TIMEOUT_MS);
      inject!(
        `window.dispatchEvent(new CustomEvent("loopz:session-request",{detail:{nonce:${JSON.stringify(nonce)}}}));true;`,
      );
    });
  },
  /** 🆕 D-1143 — إنهاءُ الطلب المعلَّق الآن بلا رمزٍ وبسببه (بدل انتظار المهلة) */
  settle(tok: null, why: WaitWhy) {
    if (!pending) return;
    lastWhy = why;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
    const p = pending;
    pending = null;
    p.resolve(tok);
  },
  /**
   * استلامُ رسالةٍ من الجسر. **يقبل `session` فقط إذا**: المضيفُ في القائمة
   * البيضاء **و**`access` نصٌّ بثلاثة مقاطع JWT **و**`exp` عددٌ مستقبليّ
   * **و**`nonce` هو المعلَّقُ نفسُه وغيرُ منتهٍ. أيُّ رسالةٍ أخرى تحمل حقلاً
   * اسمُه `access` تُهمل وتُعدّ خطأً برمجيّاً — **يُسجَّل النوعُ لا القيمة.**
   * يعود `true` إن كانت الرسالةُ من هذه الوحدة (استُهلكت).
   */
  receive(msg: Record<string, unknown>, hostOk: boolean): boolean {
    if (msg.type === "session:clear") {
      lastWhy = "clear";
      session.signOut();
      return true;
    }
    /* 🆕 D-1143 — «وصلني» من الصفحة: لا يُنهي الطلب، يوسمه فقط (المهلةُ بعده `slow` لا `noack`) */
    if (msg.type === "session:ack") {
      if (hostOk && pending && msg.nonce === pending.nonce) pending.acked = true;
      return true;
    }
    /* 🆕 D-1143 — الصفحةُ تقول إنّ مكتبتَها علقت: لا ننتظر بقيّةَ الثماني ثوانٍ */
    if (msg.type === "session:stall") {
      if (hostOk && pending && msg.nonce === pending.nonce) session.settle(null, "stall");
      return true;
    }
    if (msg.type !== "session") {
      if ("access" in msg) console.warn(`[session] ignored message with access field: type=${String(msg.type)}`);
      return false;
    }
    const p = pending;
    const okNonce = !!p && typeof msg.nonce === "string" && msg.nonce === p.nonce && Date.now() - p.at <= NONCE_TTL_MS;
    const okAccess = typeof msg.access === "string" && JWT.test(msg.access);
    const okExp = typeof msg.exp === "number" && Number.isFinite(msg.exp) && msg.exp * 1000 > Date.now();
    if (!hostOk || !okNonce || !okAccess || !okExp) {
      console.warn(`[session] rejected session message host=${hostOk} nonce=${okNonce} access=${okAccess} exp=${okExp}`);
      /* 🔴 D-1143 — ردٌّ لطلبنا الحاليّ رُفض ⇒ ينتهي الطلبُ الآن بسببه (كان ينتظر المهلةَ كاملةً بصمت).
         وردٌّ بـ`nonce` قديم (وصل بعد مهلته) لا يمسّ الطلبَ الحاليّ — يُهمل كما كان */
      if (okNonce) session.settle(null, !hostOk ? "host" : !okAccess ? "jwt" : "exp");
      return true;
    }
    lastSrc = msg.src === "cookie" ? "cookie" : "lib";
    access = msg.access as string;
    exp = msg.exp as number;
    lastLife = Math.round(exp - Date.now() / 1000);
    seenMem = true;
    try {
      SecureStore.setItem(SEEN_KEY, "1"); /* D-1075 — أثرٌ لا رمز */
    } catch {
      /* لا شيء */
    }
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
    pending = null;
    p!.resolve(access);
    emit();
    /* 🆕 K4b — أوّلُ رمزٍ عبر الجسر ⇒ تُسكّ منه جلسةٌ مملوكة (مرّةً؛ لا شيء إن كانت لصاحبه، أو والمفتاحُ مطفأ) */
    own.adopt(access);
    return true;
  },
};

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += (b < 16 ? "0" : "") + b.toString(16);
  return s;
}
