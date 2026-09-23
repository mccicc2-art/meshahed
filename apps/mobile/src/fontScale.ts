import { useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
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
