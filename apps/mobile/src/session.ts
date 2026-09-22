import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

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
let pending: { nonce: string; at: number; resolve: (t: string | null) => void } | null = null;
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

const NONCE_TTL_MS = 30_000;
const REPLY_TIMEOUT_MS = 8_000;
/** بعد خلفيّةٍ أطولَ من هذا يُمسح الرمز (§٦-ج) */
export const BACKGROUND_CLEAR_MS = 5 * 60_000;

const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** D-1026 (F2) — من يسمع **الخروج** (لا مجرّدَ شيخوخة الرمز): كاشُ الملفّ يُمسح هنا وحدَه */
const signOutListeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const session = {
  /** الرمزُ الحاليُّ إن كان صالحاً لثلاثين ثانيةً أخرى على الأقلّ */
  get(): string | null {
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
  /** D-1075 — هل رأى هذا الجهازُ جلسةً ولم يخرج منها؟ */
  seen(): boolean {
    try {
      return SecureStore.getItem(SEEN_KEY) === "1";
    } catch {
      return false;
    }
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
    try {
      SecureStore.deleteItemAsync(SEEN_KEY).catch(() => {});
    } catch {
      /* لا شيء */
    }
    for (const l of signOutListeners) l();
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
    if (had) emit();
  },
  /**
   * يطلب رمزاً من الصفحة ويعود به (أو `null`). **محاولةٌ واحدةٌ في كلِّ
   * نداء** — المستدعي (`api.ts`) يحدّ المحاولاتِ باثنتين ثمّ يعود إلى
   * الـWebView برسالة. طلبٌ متزامنٌ ثانٍ ينتظر الأوّلَ نفسَه.
   */
  request(): Promise<string | null> {
    if (pending) {
      return new Promise((resolve) => {
        const prev = pending!.resolve;
        pending!.resolve = (t) => {
          prev(t);
          resolve(t);
        };
      });
    }
    if (!inject) return Promise.resolve(null);
    /* D-1075 — الصفحةُ لم تُحمَّل بعد: اصطفّ، ثمّ أعد المحاولةَ من أوّلها (قد يكون غيرُك سبقك) */
    if (!pageReady) return new Promise<void>((r) => waiters.push(r)).then(() => (inject ? session.request() : null));
    const nonce = bytesToHex(Crypto.getRandomBytes(16));
    return new Promise((resolve) => {
      pending = { nonce, at: Date.now(), resolve };
      pendingTimer = setTimeout(() => {
        if (pending?.nonce === nonce) {
          pending.resolve(null);
          pending = null;
        }
      }, REPLY_TIMEOUT_MS);
      inject!(
        `window.dispatchEvent(new CustomEvent("loopz:session-request",{detail:{nonce:${JSON.stringify(nonce)}}}));true;`,
      );
    });
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
      session.signOut();
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
      return true;
    }
    access = msg.access as string;
    exp = msg.exp as number;
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
    return true;
  },
};

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += (b < 16 ? "0" : "") + b.toString(16);
  return s;
}
