import { CONFIG } from "./config";

/**
 * بابُ الشاشات الأصليّة إلى الـWebView (Phase 11 · B1): الشاشةُ الأصليّةُ لا
 * تملك متصفّحاً — حين تريد فتحَ عملٍ تطلب من الغلاف أن يوجّه الـWebView
 * **بحقن `location.href` لا بتبديل المصدر** (حجّةُ `flush` في `web.tsx`:
 * تبديلُ المصدر يُعيد التركيبَ ويفقد تاريخَ الرجوع).
 */
/** جذورُ الشاشات الأصليّة التي يعود إليها الرجوعُ من صفحةٍ ويبيّة (D-949 · D-998) — Phase 11-H أضافت `home` */
export type NativeRoot = "library" | "discover" | "search" | "home";
/**
 * 🆕 D-1101 — **ما يعود إليه الرجوعُ: جذرٌ أو الإعداداتُ بقسمها** (بلاغُ أحمد بتسجيل على 1.11.11:
 * «تعديل الملف» ← رجوع ← الرئيسيّة). الإعداداتُ ليست جذراً (لا خانةَ لها)، لكنّ الويبَ يعيد
 * «تعديلَ الملف» إلى الإعدادات لا إلى الرئيسيّة — والإيماءاتُ من الويب (D-1067).
 * `settings` = الفهرس · `settings/account` = قسمُه.
 */
export type ReturnTo = NativeRoot | "settings" | `settings/${string}`;

/** قيمةُ رجوعٍ صالحة؟ — تُفحص كلُّ قيمةٍ تأتي من الصفحة قبل أن تُدفع بها شاشة */
export function isReturnTo(v: unknown): v is ReturnTo {
  return typeof v === "string" && (v === "library" || v === "discover" || v === "search" || v === "home" || /^settings(\/[a-z-]+)?$/.test(v));
}

/** الخانةُ المضيئةُ للصفحة المفتوحة: الإعداداتُ بلا خانة فتضيء الرئيسيّةُ التي فُتحت منها */
export function rootOf(r: ReturnTo | null): NativeRoot | null {
  if (!r) return null;
  return r.startsWith("settings") ? "home" : (r as NativeRoot);
}

let inject: ((js: string) => void) | null = null;

/**
 * 🆕 D-951 — **الشاشةُ الأصليّة لا تُغلق قبل أن تصل الصفحة** (بلاغُ أحمد
 * بتسجيل: «أوّل ما أدخل الإحصائيات يظهر لي الهوم لجزءٍ من الثانية»): الـWebView
 * تحت الشاشة ما زالت ترسم الرئيسيّةَ حتّى يكتمل تحميلُ المستند الجديد، **فإغلاقُ
 * الشاشة فورَ الحقن يكشفها**. فـ`open` تعِد، والوعدُ يُحلّ حين يبلّغ الغلافُ
 * وصولَ العنوان (`arrived`) **أو بعد مهلةٍ** — شبكةٌ بطيئةٌ لا تحبس المستخدم
 * في شاشةٍ لا تستجيب؛ وميضٌ عند البطء الشديد أهونُ من انتظارٍ بلا نهاية.
 */
const ARRIVAL_TIMEOUT_MS = 4000;
let waiter: { path: string; settle: () => void } | null = null;

export const shell = {
  attach(fn: ((js: string) => void) | null) {
    inject = fn;
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
  /** 🆕 D-1103 — يُنادى لحظةَ وصول الصفحة المطلوبة (قبل نزول الشاشة الأصليّة) — `web.tsx` يرفع درعَ اللمس */
  onArrive: null as (() => void) | null,
  open(path: string, opts?: { returnTo?: ReturnTo }): Promise<void> {
    if (!inject || !path.startsWith("/")) return Promise.resolve();
    shell.returnTo = opts?.returnTo ?? null;
    shell.doorPath = opts?.returnTo ? path.split("?")[0] : null;
    const arm = opts?.returnTo ? `try{sessionStorage.setItem("loopz:return",${JSON.stringify(opts.returnTo)})}catch(e){}` : "";
    /* 🆕 D-951 — الوعدُ يُهيَّأ **قبل** الحقن: `onNavigationStateChange` قد يصل
       في الدورة نفسِها على الأجهزة السريعة، فلا يجد من ينتظره. */
    const done = new Promise<void>((resolve) => {
      waiter?.settle();
      const timer = setTimeout(() => waiter?.settle(), ARRIVAL_TIMEOUT_MS);
      waiter = {
        path,
        settle() {
          clearTimeout(timer);
          waiter = null;
          shell.onArrive?.();
          resolve();
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
   * Phase 11-I — **نموذجُ POST من الصفحة نفسِها** (تسجيلُ الخروج): `/auth/signout` يقبل
   * `POST` من نطاقنا وحدَه (فحصُ `origin`)، فالغلافُ لا يناديه بـ`fetch` بل يجعل الصفحةَ
   * تُرسله — ويبقى `onNavigationStateChange` في `web.tsx` هو من يرى `/auth/signout`
   * ويُنزل الشاشاتِ الأصليّة ويمسح الجلسة (D-1026). **الجلسةُ ما زالت ملكَ الـWebView** (D-932).
   */
  /** 🆕 D-1102 — العودةُ سُلِّمت من الغلاف لا من الصفحة: يُنزع سلاحُ الصفحة كي لا يُطلق رجوعاً ثانياً */
  disarm() {
    shell.returnTo = null;
    shell.doorPath = null;
    inject?.(`try{sessionStorage.removeItem("loopz:armed")}catch(e){};true;`);
  },
  post(path: string) {
    if (!inject || !path.startsWith("/")) return;
    inject(`(function(){var f=document.createElement("form");f.method="post";f.action=${JSON.stringify(CONFIG.apiBase + path)};document.body.appendChild(f);f.submit();})();true;`);
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
