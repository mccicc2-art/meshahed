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
    ready = true;
    for (const l of listeners) l();
    listeners.clear();
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
  /** هذا الإقلاعُ إعادةُ تحميلٍ من التطبيق نفسِه ⇒ لا أنميشن */
  skipped(): boolean {
    return skipped;
  },
  /** قبل `Updates.reloadAsync()` التي يطلبها التطبيق: الإقلاعُ التالي لا يعرض الأنميشن */
  skipNext() {
    try {
      SecureStore.setItem(SKIP_KEY, "1");
    } catch {
      /* المخزنُ تعذّر ⇒ يُعرض الأنميشنُ مرّةً زائدة — لا أكثر */
    }
  },
};
