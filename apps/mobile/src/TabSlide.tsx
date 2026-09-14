import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, I18nManager, PanResponder, useWindowDimensions, View, type ViewStyle } from "react-native";

/**
 * ====== انزلاقُ التبويبات — D-961 → D-965 (١٤ سبتمبر ٢٠٢٦) ======
 *
 * **بلاغُ أحمد بتسجيل** (D-961): «اجعل الموشن في التنقّل بين الأفلام والمسلسلات…
 * داخل المكتبة واكتشف مثل التنقّل في المجتمع». **ثمّ بتسجيلٍ ثانٍ** (D-965):
 * «أنا رايح للشيء أشوف الأشياء اللي موجودة فيه قبل ما أروح فيه — انتقال سلس»:
 * الجارُ الهيكليُّ الرماديُّ الذي رسمته D-961 تحت الإصبع ليس ما يراه في المجتمع.
 *
 * 🔑 **الوصفةُ وصفةُ `TabPager` الويب حرفاً** (D-522 → D-533): **ألواحٌ جنباً إلى
 * جنب، كلُّ لوحٍ بمفتاحه الثابت في موضعه** `(idx − activeIdx) × width`، والجارُ
 * **يُركَّب لحظةَ قفل الإيماءة** (تسليحُ D-523: لا قبل أن يسأل الإصبع) ويُنزع عند
 * الاستقرار. **وعند القلب يبقى اللوحُ الجديد بعنصره نفسِه** — يتبدّل موضعُه من
 * `±width` إلى `0` والمسارُ يعود إلى `0` في اللحظة نفسِها — **فلا إعادةَ تركيبٍ
 * ولا وميضَ صور** (درسُ D-526). والضغطةُ على تبويبٍ تكسب أيضاً: القديمُ يخرج
 * والجديدُ يدخل **معاً**، لا يختفي القديمُ فوراً كما كان.
 *
 * ⚖️ **الثمن معلَن**: لوحان مركّبان في أثناء السحب أو الطيران فقط؛ بعد
 * الاستقرار لوحٌ واحد. **والقياسُ (A0) لم يُؤخذ بعد** — إن ثقُل السحب فالتراجعُ
 * أن يرسم `render` هيكلاً لغير النشط.
 *
 * 🔑 **والأرقامُ أرقامُ `TabPager` نفسُها لا اجتهادٌ ثانٍ** (D-145): `FLY_MS`
 * ٥٢٠ · `SNAP_MS` ٣٦٠ · `cubic-bezier(.32,.72,0,1)` — **مضبوطةٌ على هاتف أحمد
 * ولا تُعاد معايرتُها من حاسوب** (تحذيرُ `06` في موضعه). وعتباتُ الالتقاط
 * (٢٠px قبل السؤال · ١٫٦ ميلاً · ٥٦px أو ٠٫٤ سرعةً للحسم) **هي عتباتُ D-953
 * حرفاً** — الآليّةُ التي أثبتت أنّها لا تسرق سحبَ الصفوف الأفقيّة.
 *
 * 🔑 **والضغطةُ على تبويبٍ تنزلق أيضاً**: التغييرُ من الخارج (`tab` تتبدّل)
 * يدخل اللوحَ الجديد من جهة اتّجاهه — **وإلّا كان السحبُ يتحرّك والضغطُ يقفز،
 * وهما بابان لفعلٍ واحد** (D-150).
 */
const FLY_MS = 520;
const SNAP_MS = 360;
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
/** عتباتُ D-953: لا نسأل قبل ٢٠px، والميلُ ١٫٦، والحسمُ ٥٦px أو ٠٫٤ */
const LOCK_DX = 20;
const TILT = 1.6;
const COMMIT_DX = 56;
const COMMIT_VX = 0.4;
/** الحافّةُ تُشدّ ولا تنفتح — سحبٌ إلى حيث لا تبويب */
const RUBBER = 0.28;

export function TabSlide<K extends string>({
  order,
  tab,
  onTab,
  render,
  style,
}: {
  /** مفاتيحُ التبويبات بترتيب ظهورها — المخفيُّ لا يُذكر فلا يُزار */
  order: readonly K[];
  tab: K;
  onTab: (next: K) => void;
  /** لوحُ تبويبٍ — يُنادى للنشط، وللجار حين يُسلَّح، وللقديم في أثناء خروجه */
  render: (key: K) => React.ReactNode;
  style?: ViewStyle;
}) {
  const { width } = useWindowDimensions();
  /* الاتّجاهُ فيزيائيٌّ لا لغويّ: «التالي» في جهة النهاية — يساراً في LTR ويميناً في RTL */
  const phys = I18nManager.isRTL ? -1 : 1;
  const x = useRef(new Animated.Value(0)).current;
  /** اللوحُ الثاني المركّب بجانب النشط (جارٌ مسلَّح أو قديمٌ يخرج) — واحدٌ لا أكثر */
  const [side, setSide] = useState<K | null>(null);
  const sideRef = useRef<K | null>(null);
  const mount = useCallback((k: K | null) => {
    if (sideRef.current === k) return;
    sideRef.current = k;
    setSide(k);
  }, []);
  /* آلةُ حالاتٍ أمريّة: المستجيبُ يُبنى مرّةً ويقرأ الحالةَ من مرجعٍ حيّ (عُرفُ D-953) */
  const busy = useRef(false);
  const skip = useRef(false);
  const st = useRef({ order, tab, width, phys });
  st.current = { order, tab, width, phys };
  const onTabRef = useRef(onTab);
  onTabRef.current = onTab;

  const rest = useCallback(
    (to: number, ms: number, then?: () => void) => {
      busy.current = true;
      Animated.timing(x, { toValue: to, duration: ms, easing: EASE, useNativeDriver: true }).start(({ finished }) => {
        busy.current = false;
        if (finished) then?.();
      });
    },
    [x],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => !busy.current && Math.abs(g.dx) > LOCK_DX && Math.abs(g.dx) > TILT * Math.abs(g.dy),
        onPanResponderTerminationRequest: () => true,
        onPanResponderMove: (_, g) => {
          const s = st.current;
          const i = s.order.indexOf(s.tab);
          const dir: 1 | -1 = g.dx * s.phys < 0 ? 1 : -1;
          const next = i >= 0 ? s.order[i + dir] : undefined;
          /* التسليحُ عند القفل (D-523): الجارُ يُركَّب حيّاً أوّلَ ما يسأل الإصبع عنه */
          if (next) mount(next);
          x.setValue(next ? Math.max(-s.width, Math.min(s.width, g.dx)) : g.dx * RUBBER);
        },
        onPanResponderRelease: (_, g) => {
          const s = st.current;
          const i = s.order.indexOf(s.tab);
          const dir: 1 | -1 = g.dx * s.phys < 0 ? 1 : -1;
          const next = i >= 0 ? s.order[i + dir] : undefined;
          if (next && (Math.abs(g.dx) >= COMMIT_DX || Math.abs(g.vx) >= COMMIT_VX)) {
            /* الطيرانُ ثمّ القلب: **اللوحُ يخرج كاملاً قبل أن يتبدّل** (درسُ D-526).
               القلبُ يبدّل مواضعَ الألواح ويعيد المسارَ إلى الصفر في تأثيرٍ واحد
               قبل الرسم (انظر `useLayoutEffect` أدناه) — فلا إطارَ يُرى فيه لوحان. */
            rest(-dir * s.phys * s.width, FLY_MS, () => {
              skip.current = true;
              onTabRef.current(next);
            });
            return;
          }
          rest(0, SNAP_MS, () => mount(null));
        },
        onPanResponderTerminate: () => rest(0, SNAP_MS, () => mount(null)),
      }),
    [x, rest, mount],
  );

  /* تبدّلُ `tab`: من سحبٍ مكتمل ⇒ استقرارٌ صامت؛ من ضغطةٍ ⇒ القديمُ يخرج والجديدُ يدخل معاً */
  const prev = useRef(tab);
  useLayoutEffect(() => {
    if (prev.current === tab) return;
    const old = prev.current;
    prev.current = tab;
    if (skip.current) {
      skip.current = false;
      x.setValue(0);
      mount(null);
      return;
    }
    const from = order.indexOf(old);
    const to = order.indexOf(tab);
    if (from < 0 || to < 0) {
      mount(null);
      return;
    }
    mount(old);
    x.setValue((to - from > 0 ? 1 : -1) * phys * width);
    rest(0, FLY_MS, () => mount(null));
  }, [tab, order, phys, width, x, rest, mount]);

  /* اللوحُ الجانبيُّ لا يبقى إن خرج تبويبُه من الترتيب (تبويبٌ أُخفي) */
  useEffect(() => {
    if (side && !order.includes(side)) mount(null);
  }, [side, order, mount]);

  const active = order.indexOf(tab);
  const panes: K[] = side && side !== tab ? [tab, side] : [tab];

  return (
    <View style={[{ flex: 1, overflow: "hidden" }, style]} {...pan.panHandlers}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: x }] }}>
        {panes.map((k) => {
          const off = (order.indexOf(k) - active) * phys * width;
          const on = k === tab;
          return (
            <View
              key={k}
              style={{ position: "absolute", top: 0, bottom: 0, width, left: off, pointerEvents: on ? "auto" : "none" }}
            >
              {render(k)}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}
