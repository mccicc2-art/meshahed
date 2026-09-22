import { CONFIG } from "./config";

/**
 * بابُ الشاشات الأصليّة إلى الـWebView (Phase 11 · B1): الشاشةُ الأصليّةُ لا
 * تملك متصفّحاً — حين تريد فتحَ عملٍ تطلب من الغلاف أن يوجّه الـWebView
 * **بحقن `location.href` لا بتبديل المصدر** (حجّةُ `flush` في `web.tsx`:
 * تبديلُ المصدر يُعيد التركيبَ ويفقد تاريخَ الرجوع).
 */
/** جذورُ الشاشات الأصليّة التي يعود إليها الرجوعُ من صفحةٍ ويبيّة (D-949 · D-998) — Phase 11-H أضافت `home` */
export type NativeRoot = "library" | "discover" | "search" | "home";

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
  returnTo: null as NativeRoot | null,
  open(path: string, opts?: { returnTo?: NativeRoot }): Promise<void> {
    if (!inject || !path.startsWith("/")) return Promise.resolve();
    shell.returnTo = opts?.returnTo ?? null;
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
