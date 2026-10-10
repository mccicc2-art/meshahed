import { CONFIG } from "./config";
import { doorLeft } from "./rootsState";
import type { StackEntry } from "./nativeStack";
import { webLayer } from "./webDoor";

/**
 * بابُ الشاشات الأصليّة إلى الـWebView (Phase 11 · B1): الشاشةُ الأصليّةُ لا
 * تملك متصفّحاً — حين تريد فتحَ عملٍ تطلب من الغلاف أن يوجّه الـWebView
 * **بحقن `location.href` لا بتبديل المصدر** (حجّةُ `flush` في `web.tsx`:
 * تبديلُ المصدر يُعيد التركيبَ ويفقد تاريخَ الرجوع).
 */
/** جذورُ الشاشات الأصليّة التي يعود إليها الرجوعُ من صفحةٍ ويبيّة (D-949 · D-998) — Phase 11-H أضافت `home` */
/* 🆕 11-M · M1 — و`community`: بابٌ ويبيٌّ فُتح من «المجتمع» الأصليّ يعود رجوعُه إليه */
export type NativeRoot = "library" | "discover" | "search" | "home" | "community";
/**
 * 🆕 D-1101 — **ما يعود إليه الرجوعُ: جذرٌ أو الإعداداتُ بقسمها** (بلاغُ أحمد بتسجيل على 1.11.11:
 * «تعديل الملف» ← رجوع ← الرئيسيّة). الإعداداتُ ليست جذراً (لا خانةَ لها)، لكنّ الويبَ يعيد
 * «تعديلَ الملف» إلى الإعدادات لا إلى الرئيسيّة — والإيماءاتُ من الويب (D-1067).
 * `settings` = الفهرس · `settings/account` = قسمُه.
 */
export type ReturnTo = NativeRoot | "settings" | `settings/${string}`;

/** قيمةُ رجوعٍ صالحة؟ — تُفحص كلُّ قيمةٍ تأتي من الصفحة قبل أن تُدفع بها شاشة */
export function isReturnTo(v: unknown): v is ReturnTo {
  return typeof v === "string" && (v === "library" || v === "discover" || v === "search" || v === "home" || v === "community" || /^settings(\/[a-z-]+)?$/.test(v));
}

/** الخانةُ المضيئةُ للصفحة المفتوحة: الإعداداتُ بلا خانة فتضيء الرئيسيّةُ التي فُتحت منها */
export function rootOf(r: ReturnTo | null): NativeRoot | null {
  if (!r) return null;
  return r.startsWith("settings") ? "home" : (r as NativeRoot);
}

/** 🆕 K3b — المسارُ كما يقرؤه الغلافُ من عنوان الصفحة (`new URL().pathname`: الحروفُ العربيّة مرمَّزة) — كي تطابق مرساةُ الباب
    صفحتَه حين يعود منها (`/u/أحمد` في الطلب و`/u/%D8%A3…` في العنوان) */
function pathnameOf(path: string): string {
  try {
    return new URL(CONFIG.apiBase + path).pathname;
  } catch {
    return path.split("?")[0];
  }
}

let inject: ((js: string) => void) | null = null;
/* 🆕 D-1156 — من يرسل نموذجَ POST من الغلاف (`web.tsx`)، وطلبٌ ينتظره إن لم تُركَّب الـWebView بعد */
let poster: ((path: string) => void) | null = null;
let pendingPost: string | null = null;

/**
 * 🆕 D-951 — **الشاشةُ الأصليّة لا تُغلق قبل أن تصل الصفحة** (بلاغُ أحمد
 * بتسجيل: «أوّل ما أدخل الإحصائيات يظهر لي الهوم لجزءٍ من الثانية»): الـWebView
 * تحت الشاشة ما زالت ترسم الرئيسيّةَ حتّى يكتمل تحميلُ المستند الجديد، **فإغلاقُ
 * الشاشة فورَ الحقن يكشفها**. فـ`open` تعِد، والوعدُ يُحلّ حين يبلّغ الغلافُ
 * وصولَ العنوان (`arrived`) **أو بعد مهلةٍ** — شبكةٌ بطيئةٌ لا تحبس المستخدم
 * في شاشةٍ لا تستجيب؛ وميضٌ عند البطء الشديد أهونُ من انتظارٍ بلا نهاية.
 */
/* 🆕 D-1344 — الدخولُ يملكه `WebLayer` (يحمل مصدرَ الـWebView والتسليم)؛ شاشةُ الدخول الأصليّة تناديه من هنا */
export type SignInResult = { ok: true; access: string } | { ok: false; cancelled: boolean };
let signer: (() => Promise<SignInResult>) | null = null;
/* 🆕 D-1347 — من يرفع الترحيبَ الأصليّ (`WebLayer.showWelcome`) ما دام مركَّباً */
let welcomer: (() => void) | null = null;
const ARRIVAL_TIMEOUT_MS = 4000;
let waiter: { path: string; settle: (own?: boolean) => void } | null = null;

export const shell = {
  attach(fn: ((js: string) => void) | null) {
    inject = fn;
  },
  /** 🆕 D-1344 — `WebLayer` يسجّل دالّةَ دخوله (`doLogin`) ما دام مركَّباً */
  attachSignIn(fn: (() => Promise<SignInResult>) | null) {
    signer = fn;
  },
  /** 🆕 D-1344 — دخولُ Google ثمّ التسليمُ للويب — الطريقُ نفسُه الذي كانت تسلكه رسالةُ `login` من الصفحة */
  signIn(): Promise<SignInResult> {
    return signer ? signer() : Promise.resolve({ ok: false, cancelled: false });
  },
  /**
   * 🆕 D-1344 — لغةُ الويب تتبع ما اختير في شاشة الدخول الأصليّة: كوكي `lang` (اسمُه في `core/i18n`) يُكتب في
   * الصفحة قبل أن يُعاد تحميلُ التطبيق. حقنٌ قد لا يُنفَّذ والطبقةُ مخفيّة (D-1144) — عندها يبقى الويبُ على لغته
   * حتى يدخل صاحبُه، ولغةُ الحساب تسوّيها بعد الدخول.
   */
  setWebLang(lang: "ar" | "en") {
    inject?.(`try{document.cookie="lang=${lang};path=/;max-age=31536000;samesite=lax"}catch(e){};true;`);
  },
  attachWelcome(fn: (() => void) | null) {
    welcomer = fn;
  },
  /**
   * 🆕 D-1347 — ارفع الترحيبَ الأصليّ. العلامةُ (`session.setWelcomePending`) ترفعه **عند تبدّلها وحدَه**؛ من يعرف أنّ
   * صاحبَ الجلسة لم يُتمّ (شاشةُ الدخول سألت الخادم) ينادي هذه فلا يعتمد على أنّ العلامةَ لم تكن مكتوبةً من قبل.
   */
  showWelcome() {
    welcomer?.();
  },
  /**
   * 🆕 D-1347 — **الصفحةُ تحت الشاشات الأصليّة تُنقل بلا أن تُفتح**: الترحيبُ الأصليُّ ختم، وصفحةُ ترحيب الويب ما
   * زالت محمَّلةً تحته — تُبدَّل إلى الرئيسيّة (`replace`: لا تدخل التاريخ) كي لا يجدها أوّلُ بابٍ يكشف الطبقة.
   * حقنٌ والطبقةُ مخفيّةٌ قد يتأخّر حتى تعود إلى العرض (D-1144) — والخادمُ عندها يحوّل من أتمّ عن `/welcome` بنفسه.
   */
  webReplace(path: string) {
    if (!path.startsWith("/")) return;
    inject?.(`location.replace(${JSON.stringify(CONFIG.apiBase + path)});true;`);
  },
  /**
   * مسارٌ نسبيٌّ على نطاق Loopz (`/show/123`) — ما سواه يُهمل.
   *
   * 🆕 D-949 — **الرجوعُ يعود إلى المكتبة الأصليّة** (بلاغُ أحمد بتسجيل: «إذا
   * دخلت الإحصائيات وأرجع يودّيني للهوم»): الشاشةُ الأصليّة تُغلق عند فتح صفحةٍ
   * ويبيّة، **فتاريخُ الـWebView لا يعرفها** — والرجوعُ يهبط على ما قبلها
   * (الرئيسيّة). الحلُّ علامةٌ في `sessionStorage` تُقرأ عند وصول الصفحة
   * (`SessionBridge`): أوّلُ رجوعٍ يتجاوز صفحةَ الوصول يبثّ `native:library`
   * فيُعاد فتحُ الشاشة. **`sessionStorage` لا `history.state`** لأنّ
   * `location.href` تحميلُ مستندٍ جديد والحالةُ لا تعبره.
   */
  /**
   * 🔴 D-998 — **الغلافُ يعرف إلى أين يعود** (بلاغُ أحمد بتسجيل على 1.9.0: «إذا سوّيت رجوع
   * داخل وحدة من اللستات يطلع خارج التطبيق»): علامةُ `sessionStorage` تعمل حين يستطيع
   * الـWebView الرجوعَ مستنداً (فيُقرأ الوصولُ `back_forward`)؛ أمّا حين تكون الصفحةُ
   * الويبيّةُ أوّلَ ما في تاريخه — كما بعد جولةٍ سابقة — فـ`canGoBack` كاذب، ورجوعُ
   * النظام يهبط على جذر المكدّس **فيخرج من التطبيق**. الغلافُ نفسُه يحفظ `returnTo`
   * ويعيد فتحَ الشاشة الأصليّة حين لا رجوعَ في الـWebView. تُمحى عند تسليم `native`.
   */
  returnTo: null as ReturnTo | null,
  /**
   * 🆕 D-1102 — **مسارُ صفحة الوصول** (بلاغُ أحمد بتسجيل: وميضُ هيكلٍ رماديّ عند الرجوع من «تعديل
   * الملف»). ما دام الـWebView على هذه الصفحة فرجوعُ النظام عودةٌ إلى الشاشة الأصليّة **مباشرةً** —
   * لا `goBack()` يحمّل الصفحةَ السابقةَ في تاريخه (ملفُّك من زيارةٍ قبلها) ويرسم هيكلَ تحميلها
   * ثمّ يُسلِّم. يُمحى مع `returnTo`.
   */
  doorPath: null as string | null,
  /**
   * 🆕 M3-fix — **الشاشاتُ الأصليّةُ فوق الجذر لحظةَ الخروج** (`nativeStack.ts`): العودةُ من صفحة الباب تدفعها ثانيةً بعد
   * الجذر فيعود المستخدمُ إلى الغرفة لا إلى «المجتمع». تُستهلك مرّةً، وتُمحى مع كلِّ بابٍ جديد.
   */
  resume: null as { root: ReturnTo; path: string; stack: StackEntry[] } | null,
  /** يُنادى من `goNative` بعد دفع الجذر: ما يُعاد فوقه — **إن كانت العودةُ من صفحة الباب نفسِها** إلى جذرها نفسِه */
  takeResume(root: ReturnTo, path: string): StackEntry[] {
    const r = shell.resume;
    shell.resume = null;
    return r && r.root === root && r.path === path ? r.stack : [];
  },
  /** 🆕 D-1103 — يُنادى لحظةَ وصول الصفحة المطلوبة (قبل نزول الشاشة الأصليّة) — `web.tsx` يرفع درعَ اللمس */
  onArrive: null as (() => void) | null,
  /**
   * 🆕 K3b — **الوعدُ يقول إن ظهرت الصفحةُ طبقةً** (`true`): بابٌ بوجهة عودة، والطبقةُ مركَّبة ⇒ تظهر فوق الشاشة التي
   * فتحته **ولا يُنزل المستدعي شيئاً** — العودةُ تُخفيها فتبقى الشاشةُ كما تُركت (`webDoor.ts`). `false` ⇒ الطريقُ القديم
   * (`dismissAll` لتنكشف الصفحةُ تحت المكدّس) — بابٌ بلا وجهة عودة (صفحةٌ فُتحت من الويب) أو طبقةٌ لم تُركَّب.
   */
  open(path: string, opts?: { returnTo?: ReturnTo; resume?: StackEntry[] }): Promise<boolean> {
    if (!inject || !path.startsWith("/")) return Promise.resolve(false);
    shell.returnTo = opts?.returnTo ?? null;
    shell.doorPath = opts?.returnTo ? path.split("?")[0] : null;
    shell.resume = opts?.returnTo && opts.resume?.length ? { root: opts.returnTo, path: path.split("?")[0], stack: opts.resume } : null;
    /* 🆕 K3a-fix — جذرٌ يخرج إلى الويب ويعود: تُحفظ حالةُ مجموعته لتُكملها العودة (`rootsState.doorBack`) */
    if (opts?.returnTo) doorLeft();
    const arm = opts?.returnTo ? `try{sessionStorage.setItem("loopz:return",${JSON.stringify(opts.returnTo)})}catch(e){}` : "";
    /* 🆕 D-951 — الوعدُ يُهيَّأ **قبل** الحقن: `onNavigationStateChange` قد يصل
       في الدورة نفسِها على الأجهزة السريعة، فلا يجد من ينتظره. */
    const returnTo = opts?.returnTo;
    const done = new Promise<boolean>((resolve) => {
      waiter?.settle(false);
      const timer = setTimeout(() => waiter?.settle(), ARRIVAL_TIMEOUT_MS);
      waiter = {
        path,
        /* `own=false`: بابٌ أحدثُ حلّ محلَّه — لا يُرسى هذا (صفحتُه لن تصل) */
        settle(own = true) {
          clearTimeout(timer);
          waiter = null;
          shell.onArrive?.();
          resolve(own && !!returnTo && webLayer.canLayer() && webLayer.openDoor(returnTo, pathnameOf(path)));
        },
      };
    });
    inject(`${arm}location.href=${JSON.stringify(CONFIG.apiBase + path)};true;`);
    return done;
  },
  /**
   * 🆕 D-951 — **الغلافُ يبلّغ وصولَ الـWebView** (من `onNavigationStateChange`):
   * حين ينتهي تحميلُ العنوان المطلوب يُحلّ وعدُ `open` فتُغلق الشاشةُ الأصليّة
   * **على صفحةٍ مرسومة**. المقارنةُ بالمسار وحدَه (`/stats`) لأنّ الويبَ قد
   * يضيف استعلاماً أو يزيل آخر، والمهمّ أنّ الرئيسيّةَ لم تعد ما يُعرض.
   */
  /**
   * Phase 11-I — **تسجيلُ الخروج تنقّلٌ في الـWebView لا `fetch`**: `/auth/signout` يقبل `POST` من نطاقنا
   * وحدَه (فحصُ `origin`، ومعه `null` من الغلاف — D-1156)، ويبقى `onNavigationStateChange` في `web.tsx` هو
   * من يرى `/auth/signout` ويُنزل الشاشاتِ الأصليّة ويمسح الجلسة (D-1026). **الجلسةُ ما زالت ملكَ الـWebView** (D-932).
   */
  /** 🆕 D-1102 — العودةُ سُلِّمت من الغلاف لا من الصفحة: يُنزع سلاحُ الصفحة كي لا يُطلق رجوعاً ثانياً */
  disarm() {
    shell.returnTo = null;
    shell.doorPath = null;
    inject?.(`try{sessionStorage.removeItem("loopz:armed")}catch(e){};true;`);
  },
  /**
   * 🔴 D-1156 — **يُرسله الغلافُ لا الصفحة**: كان نموذجاً يُحقن في الصفحة، والصفحةُ تحت الإعدادات الأصليّة
   * منزوعةٌ من العرض فيضيع الحقن — الضغطةُ الأولى على «خروج» تُنزل الشاشاتِ وتبقى مسجَّلاً، والثانيةُ تُخرج
   * (تسجيلُ خالد ٢٧ سبتمبر). الآن `web.tsx` يبدّل المصدرَ إلى POST (`postUrl` أصليّ)؛ وإن لم تُركَّب الـWebView
   * بعد (`router.replace("/web")`) يُحفظ الطلبُ ويُرسل لحظةَ تركيبها.
   */
  post(path: string) {
    if (!path.startsWith("/")) return;
    if (poster) poster(path);
    else pendingPost = path;
  },
  attachPost(fn: ((path: string) => void) | null) {
    poster = fn;
    if (fn && pendingPost) {
      const p = pendingPost;
      pendingPost = null;
      fn(p);
    }
  },
  arrived(url: string, loading: boolean) {
    if (!waiter || loading) return;
    let pathname = url;
    try {
      pathname = new URL(url).pathname;
    } catch {
      /* عنوانٌ غيرُ قابلٍ للتحليل — لا نحكم به */
      return;
    }
    if (pathname === waiter.path.split("?")[0]) waiter.settle();
  },
};
