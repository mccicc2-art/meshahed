import { useLayoutEffect, useSyncExternalStore } from "react";
import type { Animated } from "react-native";
import type { NavKey } from "./BottomNav";

/**
 * ====== ما يعطيه كلُّ جذرٍ للشريط السفليّ الواحد (D-1277) ======
 *
 * **بلاغُ أحمد بتسجيلين (٤ أكتوبر ٢٠٢٦)**: «خضخضة ورمشة على الدوك إذا كنت تو داخل التطبيق». المقيسُ إطاراً
 * بإطار: أوّلُ دخولٍ لتبويبٍ في الجلسة تختفي فيه رموزُ الشريط الخمسةُ وتبقى الكلمات — ٩٣ms عند «المجتمع» و٢٣٥ms
 * عند «اكتشف». تحميلُ الرموز إلى الذاكرة (D-1276) قصّرها إلى إطارٍ وإطارين (١٦ و٣٣ms) ولم يُزلها («لسى»):
 * **كلُّ جذرٍ كان يرسم شريطَه**، فأوّلُ دخولٍ يركّب شريطاً جديداً، والصورةُ توضع في الإطار الذي يلي التركيب
 * مهما كانت جاهزة. **العلاجُ علاجُ السبب**: شريطٌ واحدٌ يرسمه المتنقّلُ نفسُه (`TabDock` في `tabBar`) ولا يُعاد
 * تركيبُه عند التبديل — فلا يبقى ما يرمش.
 *
 * 🔑 **والشريطُ هو `BottomNav` نفسُه** (القاعدة ٣): لا شكلَ ثانياً ولا منطقَ ضغطٍ ثانياً. الذي انتقل مكانُ رسمه؛
 * وما كان كلُّ جذرٍ يعطيه إيّاه بقي عنده ويُسجَّل هنا بـ`DockLink` حيث كان الشريطُ يُرسم:
 *  - `onGo` — سلوكُ الضغط الخاصُّ بالجذر (ضغطةٌ ثانيةٌ على «بحث» تفتح اللوحة، وعلى «الرئيسيّة» تصعد للقمّة،
 *    وبابُ الويب في المكتبة واكتشف…). **يُقرأ لحظةَ الضغط** فلا يشيخ ولا يعيد رسمَ الشريط.
 *  - `hidden` — قيمةُ الكسوة الذكيّة (D-966): الشريطُ يهبط بارتفاعه مع النزول في المكتبة واكتشف والمجتمع.
 *  - `locked` — الجذرُ في طريقه إلى باب (حجابُ D-951): لا ضغطةَ ثانية على الشريط.
 *
 * مخزنٌ خارج React كـ`rowSight`: تبدّلُ `onGo` مع كلِّ رسمٍ لا يُعلِم أحداً؛ يُعلَم الشريطُ حين تتبدّل `hidden`
 * أو `locked` وحدَهما.
 */
export type Dock = {
  onGo: (key: NavKey) => void;
  hidden?: Animated.Value;
  locked?: boolean;
};

const docks = new Map<NavKey, Dock>();
const subs = new Set<() => void>();
let version = 0;
const tell = () => {
  version += 1;
  subs.forEach((fn) => fn());
};

/** ما سجّله الجذرُ الظاهر — يُقرأ لحظةَ الضغط */
export const dockOf = (key: NavKey): Dock | undefined => docks.get(key);

/** الشريطُ يشترك في تبدّل `hidden`/`locked` (لا في `onGo`) */
export function useDockVersion(): number {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => version,
  );
}

/**
 * يوضع حيث كان الجذرُ يرسم `BottomNav`: لا يرسم شيئاً، ويسجّل ما يخصّ الجذرَ للشريط الواحد.
 * التسجيلُ في أثر التخطيط — قبل أوّل رسمٍ للشاشة، فأوّلُ ضغطةٍ تجد سلوكَها.
 */
export function DockLink({ k, onGo, hidden, locked = false }: { k: NavKey } & Dock) {
  useLayoutEffect(() => {
    const prev = docks.get(k);
    docks.set(k, { onGo, hidden, locked });
    if (!prev || prev.hidden !== hidden || !!prev.locked !== locked) tell();
  });
  useLayoutEffect(
    () => () => {
      docks.delete(k);
      tell();
    },
    [k],
  );
  return null;
}
