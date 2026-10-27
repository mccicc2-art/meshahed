import type { NativeRoot } from "../shell";

/**
 * ====== 🆕 D-1505 — حالةُ القائمة الجانبيّة: مخزنٌ خارج React ======
 *
 * تُفتح من صورة الحساب في رأس الرئيسيّة ومن صورة الحساب في طرف ترويسات التبويبات الأخرى (`HeaderEnd`) — **صورتان لبابٍ
 * واحد** — وتُرسم مرّةً فوق المكدّس (`DrawerHost` في `_layout`). مخزنٌ لا سياق: الفاتحان في شجرتين مختلفتين، وتبدّلُه لا
 * يعيد رسمَ إلّا المضيف (نهجُ `tourStore`).
 */
let from: NativeRoot | null = null;
const subs = new Set<() => void>();

export const drawerStore = {
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
  /** من أيِّ جذرٍ فُتحت — `null` = مغلقة. الوجهاتُ تُدفع بـ`from` هذا فيعرف الرجوعُ إلى أين */
  get: () => from,
  open(root: NativeRoot) {
    from = root;
    subs.forEach((f) => f());
  },
  close() {
    if (from === null) return;
    from = null;
    subs.forEach((f) => f());
  },
};
