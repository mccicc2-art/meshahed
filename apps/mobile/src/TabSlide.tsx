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
 *
 * 🔴 **D-970 — المسارُ قيمةٌ متّصلة لا تُقطع** (بلاغُ أحمد بتسجيل على 1.8.4: «إذا
 * لفّيت يجيك شيء يرمش» — في المكتبة و«اكتشف»): كانت D-965 تعيد المسارَ إلى الصفر
 * وتعيد ترتيبَ الألواح حول النشط في خطوتين — محرّكُ الحركة أوّلاً ثمّ React —
 * **وبينهما إطارٌ يُرى**. الآن **لكلِّ لوحٍ موضعٌ ثابتٌ دائم** `idx × width`،
 * **والمسارُ ينزلق بينها بقيمةٍ واحدةٍ لا تُصفَّر أبداً**: اكتمالُ السحب هو وصولُ
 * الحركة إلى موضع اللوح التالي، وتبدّلُ `tab` بعدها لا يحرّك شيئاً. **ما لا
 * يُعاد ضبطُه لا يرمش.**
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
  /** موضعُ المسار الذي يُظهر لوحَ `k` — ثابتٌ لكلِّ لوح (D-970) */
  const at = useCallback((k: K, w = width) => -Math.max(0, order.indexOf(k)) * w * phys, [order, width, phys]);
  const pos = useRef(new Animated.Value(at(tab))).current;
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
  const settled = useRef<K | null>(null);
  const st = useRef({ order, tab, width, phys });
  st.current = { order, tab, width, phys };
  const onTabRef = useRef(onTab);
  onTabRef.current = onTab;

  const glide = useCallback(
    (to: number, ms: number, then?: () => void) => {
      busy.current = true;
      Animated.timing(pos, { toValue: to, duration: ms, easing: EASE, useNativeDriver: true }).start(({ finished }) => {
        busy.current = false;
        if (finished) then?.();
      });
    },
    [pos],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => !busy.current && Math.abs(g.dx) > LOCK_DX && Math.abs(g.dx) > TILT * Math.abs(g.dy),
        onPanResponderTerminationRequest: () => true,
        onPanResponderMove: (_, g) => {
          const s = st.current;
          const i = s.order.indexOf(s.tab);
          const base = -Math.max(0, i) * s.width * s.phys;
          const dir: 1 | -1 = g.dx * s.phys < 0 ? 1 : -1;
          const next = i >= 0 ? s.order[i + dir] : undefined;
          /* التسليحُ عند القفل (D-523): الجارُ يُركَّب حيّاً أوّلَ ما يسأل الإصبع عنه */
          if (next) mount(next);
          pos.setValue(base + (next ? Math.max(-s.width, Math.min(s.width, g.dx)) : g.dx * RUBBER));
        },
        onPanResponderRelease: (_, g) => {
          const s = st.current;
          const i = s.order.indexOf(s.tab);
          const base = -Math.max(0, i) * s.width * s.phys;
          const dir: 1 | -1 = g.dx * s.phys < 0 ? 1 : -1;
          const next = i >= 0 ? s.order[i + dir] : undefined;
          if (next && (Math.abs(g.dx) >= COMMIT_DX || Math.abs(g.vx) >= COMMIT_VX)) {
            /* الطيرانُ إلى موضع الجار ثمّ القلب (درسُ D-526): تبدّلُ `tab` بعدها يجد
               المسارَ في مكانه فلا يحرّكه — ولا إطارَ وسيطاً (D-970). */
            glide(base - dir * s.phys * s.width, FLY_MS, () => {
              settled.current = next;
              onTabRef.current(next);
            });
            return;
          }
          glide(base, SNAP_MS, () => mount(null));
        },
        onPanResponderTerminate: () => {
          const s = st.current;
          glide(-Math.max(0, s.order.indexOf(s.tab)) * s.width * s.phys, SNAP_MS, () => mount(null));
        },
      }),
    [pos, glide, mount],
  );

  /* تبدّلُ `tab`: من سحبٍ مكتمل ⇒ المسارُ هناك أصلاً، يُنزع الجارُ فقط؛ من ضغطةٍ ⇒
     القديمُ يبقى مركّباً وينزلق المسارُ إلى موضع الجديد فيخرج ويدخل معاً */
  const prev = useRef(tab);
  useLayoutEffect(() => {
    if (prev.current === tab) return;
    const old = prev.current;
    prev.current = tab;
    if (settled.current === tab) {
      settled.current = null;
      mount(null);
      return;
    }
    const to = order.indexOf(tab);
    if (order.indexOf(old) < 0 || to < 0) {
      pos.setValue(at(tab));
      mount(null);
      return;
    }
    mount(old);
    glide(at(tab), FLY_MS, () => mount(null));
  }, [tab, order, at, pos, glide, mount]);

  /* تغيّرُ العرض (دوران) أو ترتيبِ التبويبات نفسِه: المسارُ يُثبَّت على النشط بلا حركة.
     ⚠️ يُقاس بالمحتوى لا بالمرجع — `order` مصفوفةٌ جديدةٌ في كلِّ رسمة، وإعادةُ الضبط
     في أثناء سحبٍ حيٍّ (رسمةُ تسليح الجار) كانت ستقفز بالإصبع. */
  const geom = `${width}|${order.join(",")}`;
  const geomRef = useRef(geom);
  useEffect(() => {
    if (geomRef.current === geom) return;
    geomRef.current = geom;
    pos.setValue(at(tab));
    if (side && !order.includes(side)) mount(null);
  }, [geom, order, at, tab, pos, side, mount]);

  const panes: K[] = side && side !== tab ? [tab, side] : [tab];

  return (
    <View style={[{ flex: 1, overflow: "hidden" }, style]} {...pan.panHandlers}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: pos }] }}>
        {panes.map((k) => {
          const on = k === tab;
          return (
            <View
              key={k}
              style={{ position: "absolute", top: 0, bottom: 0, width, left: Math.max(0, order.indexOf(k)) * width * phys, pointerEvents: on ? "auto" : "none" }}
            >
              {render(k)}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}
