import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import type { FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { mark } from "./perfMarks";
import type { ScrollJankProps } from "./scrollJank";

/**
 * ====== حالُ الصفِّ الأفقيّ لحظةَ ظهور لوحه (`rail.state`) — D-1337 ======
 *
 * **لماذا**: ١٠ أكتوبر ٢٠٢٦، آيفون أحمد بالعربيّة بعد فتحٍ بارد: «مقترحٌ لك» مليءٌ قبل زيارة «القوائم»، وفارغٌ
 * (طرفُ ملصقٍ واحدٍ عند الحافّة) بعد الرجوع منها بالسحب — وأندرويد بالعربيّة سليمٌ بالحركة نفسِها، والآيفون
 * بالإنجليزيّة سليم. التسجيلُ يقول **ماذا** ولا يقول **أين**: أهي نافذةُ `FlatList` رسمت بطاقاتٍ في غير موضع
 * العين، أم موضعُ التمرير الأصليُّ أُزيح، أم كلاهما سليمٌ والعطلُ تحتهما؟ وأحمد: «ما أبغى استنتاجات».
 *
 * 🔑 **قياسٌ لا إصلاح**: لا يغيّر موضعاً ولا نافذةً ولا رسماً. لكلِّ صفٍّ يحفظ ما **قاله النظامُ الأصليّ** (آخرُ
 * `contentOffset.x` وعرضُ المحتوى من حدث التمرير، وكم حدثاً وصل والإصبعُ ليس على الصفّ) ويقرأ ما **تعتقده القائمة**
 * (موضعُها ونافذةُ ما ركّبته). بعد ظهور اللوح بـ`AFTER_MS` تخرج علامةٌ لكلٍّ من أعلى `TOP` صفوف:
 * - القيمة — عرضُ الصفّ على الشاشة · `y` — موضعُه في العمود (هويّتُه: «مقترحٌ لك» أصغرُها).
 * - `x` — آخرُ موضعٍ أعلنه النظام (**غائبٌ = لم يصل حدثُ تمريرٍ واحد**) · `cw` — عرضُ المحتوى.
 * - `jx` — الموضعُ الذي تعتقده القائمة · `first`/`last` — نافذةُ البطاقات المركّبة.
 * - `ev` — أحداثُ تمريرٍ وصلت بلا إصبع · `drag` — ١ إن سحب المستخدمُ هذا الصفَّ في عمره.
 *
 * ⚖️ **ما لا يراه**: موضعٌ أصليٌّ تغيّر **بلا حدث** لا يصل JS بأيِّ طريق — فإن خرجت الأرقامُ كلُّها سليمةً والصفُّ
 * فارغ، فالعطلُ تحت JS وهذا القياسُ قال ذلك وانتهى دورُه.
 *
 * ⚖️ **سقفٌ للعمليّة** (`MAX_REPORTS`): تشخيصٌ لا مراقبةٌ دائمة — لا يطرد علاماتِ الأداء من الدفعة. يُحذف مع الإصلاح.
 * وقراءةُ دواخل القائمة (`_listRef`) محاطةٌ بـ`try`: إن تغيّرت في إصدارٍ قادمٍ غابت الخانةُ ولم ينكسر شيء.
 */
const AFTER_MS = 700;
const RETRY_MS = 2_500;
const TOP = 4;
const MAX_REPORTS = 30;

type Probe = {
  list: FlatList | null;
  y: number;
  lw: number;
  cw: number;
  x: number | null;
  ev: number;
  dragging: boolean;
  touched: boolean;
};
const rails = new Map<string, Set<Probe>>();
let reports = 0;

/** تبويبُ اللوح الذي يحمل الصفّ — نصٌّ ثابتٌ لكلِّ لوح فلا يعيد رسمَ أحد */
export const RailTab = createContext<string | null>(null);

type Internals = {
  _listRef?: {
    _scrollMetrics?: { offset?: number };
    state?: { cellsAroundViewport?: { first?: number; last?: number } };
  };
};

function sample(tab: string): boolean {
  const set = rails.get(tab);
  if (!set || set.size === 0) return false;
  const top = [...set].filter((p) => p.lw > 0).sort((a, b) => a.y - b.y).slice(0, TOP);
  if (top.length === 0) return false;
  for (const p of top) {
    const extra: Record<string, number | string> = { tab, y: Math.round(p.y), cw: Math.round(p.cw), ev: p.ev, drag: p.touched ? 1 : 0 };
    if (p.x !== null) extra.x = Math.round(p.x);
    try {
      const inner = (p.list as unknown as Internals | null)?._listRef;
      const jx = inner?._scrollMetrics?.offset;
      const win = inner?.state?.cellsAroundViewport;
      if (typeof jx === "number") extra.jx = Math.round(jx);
      if (typeof win?.first === "number") extra.first = win.first;
      if (typeof win?.last === "number") extra.last = win.last;
    } catch {
      /* دواخلُ القائمة تغيّرت — الخانةُ تغيب */
    }
    mark("rail.state", p.lw, extra);
  }
  return true;
}

/** اللوحُ صار ظاهراً: تُؤخذ اللقطةُ بعد أن يستقرّ (ومرّةً ثانيةً إن لم تكن صفوفُه وصلت بعد) */
export function useRailReport(tab: string, on: boolean) {
  useEffect(() => {
    if (!on || reports >= MAX_REPORTS) return;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const first = setTimeout(() => {
      if (sample(tab)) reports += 1;
      else
        retry = setTimeout(() => {
          if (sample(tab)) reports += 1;
        }, RETRY_MS - AFTER_MS);
    }, AFTER_MS);
    return () => {
      clearTimeout(first);
      if (retry) clearTimeout(retry);
    };
  }, [tab, on]);
}

/**
 * خصائصُ الصفّ: مرجعُ القائمة وآذانُها، **فوق** خصائص `scrollJank` (يُنادى أصلُها كما هو).
 * خارج لوحٍ يعلن تبويبَه (`RailTab`) لا يُسجَّل الصفّ ولا يُكتب عنه شيء.
 */
export function useRailProbe(jank: ScrollJankProps) {
  const tab = useContext(RailTab);
  const probe = useRef<Probe>({ list: null, y: 0, lw: 0, cw: 0, x: null, ev: 0, dragging: false, touched: false });
  useEffect(() => {
    if (!tab) return;
    const p = probe.current;
    let set = rails.get(tab);
    if (!set) rails.set(tab, (set = new Set()));
    set.add(p);
    return () => {
      set.delete(p);
    };
  }, [tab]);
  const ref = useCallback((list: FlatList | null) => {
    probe.current.list = list;
  }, []);
  const onWrapLayout = useCallback((e: LayoutChangeEvent) => {
    probe.current.y = e.nativeEvent.layout.y;
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    probe.current.lw = e.nativeEvent.layout.width;
  }, []);
  const onContentSizeChange = useCallback((w: number) => {
    probe.current.cw = w;
  }, []);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = probe.current;
    p.x = e.nativeEvent.contentOffset.x;
    p.cw = e.nativeEvent.contentSize.width;
    if (!p.dragging) p.ev += 1;
  }, []);
  const onScrollBeginDrag = useCallback(() => {
    probe.current.dragging = true;
    probe.current.touched = true;
    jank.onScrollBeginDrag();
  }, [jank]);
  const settle = useCallback(() => {
    probe.current.dragging = false;
  }, []);
  /* الانزلاقُ بعد رفع الإصبع من فعل المستخدم: `dragging` يبقى حتى يقف (أو حتى رفعٍ بلا انزلاق) */
  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const v = e.nativeEvent.velocity;
      if (!v || Math.abs(v.x) < 0.05) settle();
      jank.onScrollEndDrag();
    },
    [jank, settle],
  );
  const onMomentumScrollEnd = useCallback(() => {
    settle();
    jank.onMomentumScrollEnd();
  }, [jank, settle]);
  return {
    onWrapLayout,
    list: { ref, onLayout, onContentSizeChange, onScroll, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollBegin: jank.onMomentumScrollBegin, onMomentumScrollEnd },
  };
}
