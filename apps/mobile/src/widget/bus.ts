/**
 * ====== 🆕 ما يصل من الودجت إلى الرئيسيّة ======
 *
 * لمسةُ «الكل» تفتح ورقةَ القسم، ولمسةُ الخانة الباهتة تبدأ العملَ ثمّ يظهر توستُ «تراجع» — **وكلاهما على الرئيسيّة
 * وحدَها** (مضيفُ التوست وورقةُ «الكل» فيها). والرئيسيّةُ قد لا تكون رُكّبت بعد حين يصل الرابطُ من الصفر، فالحدثُ
 * الأخيرُ يُحفظ حتى يشترك أحد ثمّ يُصرف مرّةً.
 */
export type WidgetEvent =
  | { type: "all"; section: "continue" | "towatch" | "upcoming" }
  | { type: "started"; id: number; title: string; action: "start" | "unpause" };

type Listener = (e: WidgetEvent) => void;

let pending: WidgetEvent | null = null;
const listeners = new Set<Listener>();

export const widgetBus = {
  emit(e: WidgetEvent) {
    if (listeners.size === 0) {
      pending = e;
      return;
    }
    for (const l of listeners) l(e);
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    if (pending) {
      const e = pending;
      pending = null;
      l(e);
    }
    return () => listeners.delete(l);
  },
};
