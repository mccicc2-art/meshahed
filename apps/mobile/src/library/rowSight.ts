import { useSyncExternalStore } from "react";

/**
 * ====== «أيُّ صفٍّ يُرى الآن» — مخزنٌ صغيرٌ خارج React (D-1025 · Phase 11-F · F1) ======
 *
 * **لماذا**: `MarqueeText` كان يقيس ويدير حلقةَ حركةٍ لا تنتهي **لكلِّ** اسمٍ طويل، ظاهراً
 * أو تحت الطيّ أو في شاشةٍ مغطّاة. الآن السطرُ يمشي في الصفوف الظاهرة وحدَها.
 *
 * 🔑 **مخزنٌ لا حالة**: تغيّرُ الرؤية يأتي من القائمة مع كلِّ تمريرة؛ لو كان `useState`
 * في اللوح لأعادت كلُّ تمريرةٍ رسمَ القائمة — وهو عينُ ما تزيله F1. هنا لا يُعاد رسمُ
 * إلّا الصفِّ الذي **تبدّلت** رؤيتُه (`useSyncExternalStore` يقارن اللقطة).
 * و`focused` يُطفئ الكلَّ حين تُغطّى الشاشةُ بصفحة عمل — حركةٌ لا يراها أحدٌ بطّاريّةٌ تُحرق.
 */
export type RowSight = {
  set: (keys: Iterable<string>) => void;
  setFocused: (on: boolean) => void;
  subscribe: (fn: () => void) => () => void;
  sees: (key: string) => boolean;
};

export function createRowSight(): RowSight {
  let seen = new Set<string>();
  let focused = true;
  const subs = new Set<() => void>();
  const tell = () => subs.forEach((fn) => fn());
  return {
    set(keys) {
      seen = new Set(keys);
      tell();
    },
    setFocused(on) {
      if (focused === on) return;
      focused = on;
      tell();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    sees: (key) => focused && seen.has(key),
  };
}

export function useRowSeen(sight: RowSight, key: string): boolean {
  return useSyncExternalStore(sight.subscribe, () => sight.sees(key));
}
