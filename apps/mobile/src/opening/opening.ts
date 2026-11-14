import * as SecureStore from "expo-secure-store";

/**
 * ====== 🆕 D-1350 — إشارةُ «التطبيقُ جاهز» لأنميشن الفتح ======
 *
 * أنميشنُ الفتح (`Opening.tsx`) يغطّي الشاشةَ حتى تقول الشاشةُ التي تحته إنّها رُسمت بمحتواها — الرئيسيّةُ حين تصلها
 * حمولتُها (من الكاش المحفوظ غالباً، فوراً)، وشاشةُ الدخول والترحيبُ حين يُركَّبان، وطبقةُ الويب حين تكون هي الشاشة
 * (رابطُ الودجت) وينتهي تحميلُها. من يسبق يكفي، والأنميشنُ يحمل سقفَه بنفسه (خمسُ ثوانٍ) فلا يُحبس أحدٌ خلفه.
 *
 * ⚖️ **بلا اعتماديّاتٍ على الشاشات**: هي تستورد هذا الملفّ لا العكس.
 */
const SKIP_KEY = "loopz.open.skip";

let ready = false;
const listeners = new Set<() => void>();
/* 🆕 1.14.1 — ممسكو الستار (`hold`) وجاهزيّةٌ وصلت وهم ممسكون */
let holds = 0;
let readyWaiting = false;

function fire() {
  ready = true;
  readyWaiting = false;
  for (const l of listeners) l();
  listeners.clear();
}
const coverListeners = new Set<() => void>();

/* يُقرأ مرّةً عند تحميل الوحدة ويُمحى: إعادةُ تحميلٍ طلبها التطبيقُ نفسُه (قلبُ اللغة) ليست «فتحةً جديدة» */
const skipped = (() => {
  try {
    if (SecureStore.getItem(SKIP_KEY) !== "1") return false;
    SecureStore.deleteItemAsync(SKIP_KEY).catch(() => {});
    return true;
  } catch {
    return false;
  }
})();

export const opening = {
  /** الشاشةُ تحت الستار رُسمت بمحتواها (أو عرفت أنّها لن تصل) — النداءُ الأوّلُ وحدَه يُحسب */
  ready() {
    if (ready) return;
    /* 🆕 1.14.1 — ممسوكٌ (`hold`) ⇐ تُحفظ الجاهزيّةُ وتُعلَن حين يُفلت آخرُ ممسك */
    if (holds > 0) {
      readyWaiting = true;
      return;
    }
    fire();
  },
  isReady(): boolean {
    return ready;
  },
  onReady(l: () => void): () => void {
    if (ready) {
      l();
      return () => {};
    }
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /**
   * 🆕 1.14.1 — **إمساكُ الستار** (`firstLaunchUpdate.tsx`): في أوّل فتحةٍ بعد التثبيت ينتظر الستارُ قرارَ التحديث الهوائيّ —
   * إعادةُ تحميلٍ خلفه أو لا — قبل أن ينكشف، فلا تُرى الشاشةُ ثمّ تُهدم. يُعيد دالّةَ الإفلات (مرّةً واحدة تُحسب)، وسقفُ
   * الأنميشن نفسُه (خمسُ ثوانٍ في `Opening.tsx`) يبقى فوق كلِّ إمساك فلا يُحبس أحد.
   */
  hold(): () => void {
    holds++;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      holds--;
      if (holds === 0 && readyWaiting && !ready) fire();
    };
  },
  /** هذا الإقلاعُ إعادةُ تحميلٍ من التطبيق نفسِه ⇒ لا أنميشن */
  skipped(): boolean {
    return skipped;
  },
  /**
   * 🆕 D-1463 — **ستارُ لوبز فوراً** (طلبُ أحمد ١٨ أكتوبر: «وقت تغيير اللغة… ترمش و شاشة بيضاء، الأفضل شاشة انتظار فيها علامة
   * لوبز»): يُنادى قبل إعادة التحميل التي يطلبها التطبيق، فيغطّي `Opening` الشاشةَ بالشعار الثابت قبل أن تُهدم.
   */
  cover() {
    for (const l of coverListeners) l();
  },
  onCover(l: () => void): () => void {
    coverListeners.add(l);
    return () => coverListeners.delete(l);
  },
  /** 🆕 1.14.1 — إعادةُ تحميلٍ طُلبت ثمّ رُفضت: الإقلاعُ التالي فتحةٌ عاديّةٌ بأنميشنها (عكسُ `skipNext`) */
  clearSkip() {
    SecureStore.deleteItemAsync(SKIP_KEY).catch(() => {});
  },
  /** قبل `Updates.reloadAsync()` التي يطلبها التطبيق: الإقلاعُ التالي لا يعرض الأنميشن — بل الستارَ الهادئ (D-1463) */
  skipNext() {
    try {
      SecureStore.setItem(SKIP_KEY, "1");
    } catch {
      /* المخزنُ تعذّر ⇒ يُعرض الأنميشنُ مرّةً زائدة — لا أكثر */
    }
  },
};
