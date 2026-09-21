import { useSyncExternalStore } from "react";

/**
 * ====== ما أُخفي بـ«غير مهتمّ» في هذه الجلسة — مخزنٌ واحدٌ للشاشات (D-1053) ======
 *
 * **لماذا**: الإخفاءُ الفوريّ كان `useState` داخل «اكتشف»، ثمّ صارت «الكلّ ←» شاشةً مستقلّة (D-1046) فحملت
 * نسختَها — فمن قال «غير مهتمّ» في «الكلّ» عاد إلى «اكتشف» فوجد البطاقةَ في صفّها حتّى الجلب التالي (انحرافٌ
 * أعلنتُه مع F5). الخادمُ يُسقطها دائماً؛ هذا المخزنُ يغطّي **الفجوةَ بين الضغطة والجلب** للشاشتين معاً.
 * 🔑 يعيش بعمر العمليّة لا أكثر (لا ملفَّ ولا كاش): بعد أيِّ جلبٍ الخادمُ هو الحقيقة. والمجموعةُ تُستبدل ولا
 * تُعدَّل، فمرجعُها يتبدّل فقط حين تتغيّر — وهو ما يعتمد عليه `useMemo` عند القرّاء.
 */
let hidden: ReadonlySet<string> = new Set();
const subs = new Set<() => void>();
const set = (next: ReadonlySet<string>) => {
  hidden = next;
  subs.forEach((fn) => fn());
};

export const dismissed = {
  add(key: string) {
    if (!hidden.has(key)) set(new Set(hidden).add(key));
  },
  /** الكتابةُ فشلت — البطاقةُ تعود */
  restore(key: string) {
    if (!hidden.has(key)) return;
    const next = new Set(hidden);
    next.delete(key);
    set(next);
  },
};

export function useDismissed(): ReadonlySet<string> {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => hidden,
  );
}
