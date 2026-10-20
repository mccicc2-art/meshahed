import { useSyncExternalStore } from "react";
import { Dimensions, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";
import { opening } from "./opening/opening";
import { FONT_SCALE_CONTENT, FONT_SCALE_UI, sanitizeFontSize, type FontSize } from "@/core/fontPrefs";

/**
 * ====== D-1105 — حجمُ الخطّ في الشاشات الأصليّة ======
 *
 * 🔑 **طلبُ أحمد (٢٣ سبتمبر، «نفّذ أ»)**: الإعدادُ كان يُحفظ ويكبّر صفحاتِ الويب وحدَها (D-1099)
 * — تغيّره من شاشة الإعدادات الأصليّة فلا يتغيّر شيءٌ أمامك، فيبدو معطَّلاً. الآن كلُّ نصٍّ يمرّ
 * من `Text` الواحد (`ui.tsx`) يُضرب بمعامل درجته، **كما يضرب الويبُ سلّمَه كلَّه بـ`--fs`**:
 * الدرجاتُ تكبر سويّةً بنسبها، والصناديقُ الثابتةُ (الترويسة · الشريط) تبقى بأرقامها.
 *
 * **مخزنٌ لا حقلٌ في «من أنا»**: `me` يصل بعد الإقلاع، فلو قُرئ منه لرُسمت الرئيسيّةُ المحفوظةُ
 * بالحجم الافتراضيّ ثمّ قفزت إلى الكبير أمام عينه في كلِّ فتح. القيمتان تُحفظان في SecureStore
 * (سطرٌ قصير، المخزنُ موجودٌ أصلاً — وصفةُ `webLocale` في `i18n.ts`) وتُقرآن تزامنيّاً عند الإقلاع؛
 * و«من أنا» ثمّ شاشةُ المظهر يصحّحانهما إن اختلفتا (اختيارٌ من الويب أو من جهازٍ آخر).
 */
/**
 * 🆕 D-1378 — **سقفُ خطِّ الجهاز ١٫٣×** (أحمد ١٢ أكتوبر، «أ»: الربطُ بخطّ الجهاز مع سقف). النصُّ يتبع حجمَ خطّ
 * النظام (سلوكُ React Native الافتراضيّ — لم يُطفأ قطّ) **ثمّ** يُضرب بدرجة Loopz أعلاه؛ والصناديقُ الثابتة (الرأس ٦٤،
 * بطاقةُ «تابِع»، خاناتُ الأسبوع) لا تكبر معه. بلا سقفٍ كان خطُّ سامسونج الأكبر يقصّ النصَّ فيها. **التصغيرُ بلا حدّ**
 * — لا يكسر شيئاً. يُقرأ في `Text` و`Button` (`ui.tsx`) وفي كلِّ `TextInput`.
 */
export const SYSTEM_FONT_CAP = 1.3;

const KEY = "loopz.font";

type Prefs = { ui: FontSize; content: FontSize };

let prefs: Prefs = (() => {
  try {
    const [ui, content] = (SecureStore.getItem(KEY) ?? "").split("|");
    return { ui: sanitizeFontSize(ui), content: sanitizeFontSize(content) };
  } catch {
    return { ui: "md", content: "md" };
  }
})();
const listeners = new Set<() => void>();

export const fontPrefs = {
  get(): Prefs {
    return prefs;
  },
  /** القيمُ تُفحص (`sanitizeFontSize`) — تأتي من الشبكة */
  set(ui: unknown, content: unknown) {
    const next = { ui: sanitizeFontSize(ui), content: sanitizeFontSize(content) };
    if (next.ui === prefs.ui && next.content === prefs.content) return;
    prefs = next;
    for (const l of listeners) l();
    SecureStore.setItemAsync(KEY, `${next.ui}|${next.content}`).catch(() => {});
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** المعاملُ الحيّ: الواجهةُ افتراضاً، و`content` لكلام الناس (مراجعات · ردود · منشورات) — صنفُ `fs-content` في الويب */
export function useFontScale(content?: boolean): number {
  const p = useSyncExternalStore(fontPrefs.subscribe, fontPrefs.get, fontPrefs.get);
  return content ? FONT_SCALE_CONTENT[p.content] : FONT_SCALE_UI[p.ui];
}

/**
 * 🆕 D-1484 — **خطُّ الآيفون تغيّر والتطبيقُ مفتوح ⇒ يُعاد تحميلُه** (تسجيلُ أحمد ٢٠ أكتوبر): الحروفُ كبرت والصناديقُ بقيت
 * بعرضها القديم، فقُصّ الكلامُ من جهتيه («المجتمع» ⇐ «حتمع»، و«بحث» في الدوك ⇐ «...»، و«5.0» ⇐ «5.(») — iOS يكبّر
 * الخطَّ حيّاً ولا يعيد قياسَ النصوص المقيسة. **وبعد إعادة الفتح انحلّ كلُّه** (لقطتُه ١١:٤٤) — فلا نقصَ مساحةٍ بل قياسٌ قديم.
 * فالعلاجُ ما فعله بيده: إعادةُ تحميل JS، بستار لوبز قبلها وبعدها كتبديل اللغة (D-1463). تغييرُ خطِّ الجهاز نادر،
 * والرجوعُ إلى الرئيسيّة أهونُ من شاشاتٍ مقصوصةٍ حتى يُغلق التطبيق. الأندرويدُ لم يُرَ فيه العطلُ فلا يمرّ هنا.
 * الفرقُ أصغرُ من ١٪ لا يُحسب (دقّةُ الكسور)؛ والفشلُ صمت (بيئةُ التطوير).
 */
if (Platform.OS === "ios") {
  const fontScale0 = Dimensions.get("window").fontScale;
  let reloading = false;
  Dimensions.addEventListener("change", ({ window }) => {
    if (reloading || Math.abs(window.fontScale - fontScale0) < 0.01) return;
    reloading = true;
    opening.skipNext();
    opening.cover();
    new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      .then(() => Updates.reloadAsync({ reloadScreenOptions: { backgroundColor: "#050505", spinner: { enabled: false }, fade: true } }))
      .catch(() => {
        reloading = false;
      });
  });
}
