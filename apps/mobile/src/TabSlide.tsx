import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { jankStart, mark, span } from "./perfMarks";
import { Animated, Easing, I18nManager, PanResponder, useWindowDimensions, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, { cancelAnimation, Easing as REasing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { flag } from "./flags";

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
 *
 * 🔴 **D-972 — المسارُ بعرض كلِّ الألواح، لا بعرض الشاشة** (بلاغُ أحمد بتسجيل على
 * 1.8.5: «الأنمي والأفلام والقوائم ما أقدر أتصفّح فيها، كأنّها صورة»): D-970 وضع
 * لوحَ التبويب الثاني عند `width` والثالثَ عند `2×width` **داخل مسارٍ عرضُه عرضُ
 * الشاشة** — فكلُّ لوحٍ غيرِ الأوّل يقع **خارج حدود أبيه**، وأندرويد لا يوصل
 * اللمسَ إلى ابنٍ خارج حدود أبيه وإن أعادته الإزاحةُ إلى الشاشة: يُرسم ولا
 * يُلمَس. **فالمسارُ صار بعرض `n × width`** والألواحُ كلُّها داخله من جهة
 * البداية (`start`) — والإزاحةُ نفسُها، والاستمراريّةُ نفسُها، ولا وميض.
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

type Props<K extends string> = {
  /** مفاتيحُ التبويبات بترتيب ظهورها — المخفيُّ لا يُذكر فلا يُزار */
  order: readonly K[];
  tab: K;
  onTab: (next: K) => void;
  /** لوحُ تبويبٍ — يُنادى للنشط، وللجار حين يُسلَّح، وللقديم في أثناء خروجه.
      `active` يقول إن كان هذا هو اللوحَ النشط (D-975: الجارُ لا يحمّي مشغّلاً) */
  render: (key: K, active: boolean) => React.ReactNode;
  style?: ViewStyle;
  /** F0 (D-1024) — اسمُ الشاشة لعلامة `tab.arm`؛ بلا اسمٍ لا قياس */
  perfScreen?: "library" | "discover";
};

/**
 * ====== K2 — أيُّ المسارين يرسم (D-1140) ======
 * المفتاحُ يُقرأ **مرّةً عند التركيب** ويثبت لعمر الشاشة: لا تبديلَ آليّةٍ والإصبعُ على
 * اللوح. `k2` من الخادم (`flags.ts`) — مطفأٌ ⇒ المسارُ القائم حرفاً (`TabSlideJS`).
 */
export function TabSlide<K extends string>(props: Props<K>) {
  const [k2] = useState(() => flag("k2"));
  return k2 ? <TabSlideUI {...props} /> : <TabSlideJS {...props} />;
}

/** المسارُ القائمُ منذ D-970/D-972: `PanResponder` على خيط JS — يبقى كما هو حتى تثبت K2 */
function TabSlideJS<K extends string>({ order, tab, onTab, render, style, perfScreen }: Props<K>) {
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
  /* F0 (D-1024) — `tab.arm`: من تسليح الجار عند قفل الإيماءة إلى أوّل تخطيطٍ للوحه. هذا
     أثقلُ تركيبٍ في الشاشة ويقع والإصبعُ يتحرّك — رقمُه يحسم F6 (نُبقي `TabSlide` أم نبدّله). */
  const armEnd = useRef<(() => void) | null>(null);
  const perfRef = useRef(perfScreen);
  perfRef.current = perfScreen;
  /* 🆕 D-1128 — عدّادُ إطارات السحب: يبدأ مع أوّل حركةٍ بعد القفل ويُغلق عند الرفع أو الانتزاع */
  const jankEnd = useRef<(() => void) | null>(null);
  const jankStop = useCallback(() => {
    jankEnd.current?.();
    jankEnd.current = null;
  }, []);

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
          if (next && sideRef.current !== next && perfRef.current) armEnd.current = span("tab.arm", { screen: perfRef.current, tab: next, k2: 0 });
          if (next) mount(next);
          if (!jankEnd.current && perfRef.current) jankEnd.current = jankStart({ screen: perfRef.current, ...(next ? { tab: next } : {}), thread: "js", k2: 0 });
          pos.setValue(base + (next ? Math.max(-s.width, Math.min(s.width, g.dx)) : g.dx * RUBBER));
        },
        onPanResponderRelease: (_, g) => {
          jankStop();
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
          jankStop();
          const s = st.current;
          glide(-Math.max(0, s.order.indexOf(s.tab)) * s.width * s.phys, SNAP_MS, () => mount(null));
        },
      }),
    [pos, glide, mount, jankStop],
  );
  /* اللوحُ نُزع والإصبعُ عليه: العدّادُ لا يبقى يدور بلا صاحب */
  useEffect(() => jankStop, [jankStop]);

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
      {/* D-972 — المسارُ يتّسع لكلِّ الألواح فتبقى داخل حدوده؛ `start` لا `left` كي
          يعمل الاتّجاهان بالرقم نفسِه (في RTL يمتدّ المسارُ يساراً من حافّة البداية) */}
      <Animated.View style={{ position: "absolute", top: 0, bottom: 0, start: 0, width: Math.max(1, order.length) * width, transform: [{ translateX: pos }] }}>
        {panes.map((k) => {
          const on = k === tab;
          return (
            <View
              key={k}
              onLayout={on ? undefined : () => { armEnd.current?.(); armEnd.current = null; }}
              style={{ position: "absolute", top: 0, bottom: 0, width, start: Math.max(0, order.indexOf(k)) * width, pointerEvents: on ? "auto" : "none" }}
            >
              {render(k, on)}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

/**
 * ====== K2 — السحبُ على خيط الواجهة (D-1140 · Phase 11-K) ======
 *
 * **لماذا**: `gesture.jank` على 1.12.0 (٢٦ سبتمبر): **«اكتشف» تُسقط ١٣ إطاراً من سحبةٍ مدّتُها
 * ~٤١٠ms (p50) — نحو نصف الإطارات — على جهازٍ رائد.** السببُ في `TabSlideJS`: كلُّ حركةٍ
 * للإصبع تمرّ بخيط JS (`pos.setValue`)، وخيطُ JS في تلك اللحظة نفسِها يركّب لوحَ الجار
 * (`tab.arm` ~٩٠ms). فاللوحُ يقف حيث يمشي الإصبع.
 *
 * 🔑 **هنا الإيماءةُ والحركةُ كلتاهما على خيط الواجهة** (`Gesture.Pan` + Reanimated): اللوحُ
 * يتبع الإصبعَ ولو انشغل JS بالتركيب كلَّه. **وما يحتاج React وحدَه يعبر إلى JS**: تركيبُ الجار
 * (`arm`) وقلبُ التبويب بعد الطيران (`commit`) — وتأخّرُهما لا يوقف اللوح.
 *
 * 🔑 **والأرقامُ أرقامُ `TabSlideJS` حرفاً** — لا اجتهادَ ثانياً: `FLY_MS` · `SNAP_MS` · المنحنى ·
 * `RUBBER` · وعتباتُ D-953 بتفعيلٍ يدويّ (`manualActivation`) يطبّق القاعدةَ نفسَها: القفلُ حين
 * يتجاوز الإصبعُ ٢٠px أفقاً **و**١٫٦ ضعفَ ما قطعه عموداً — لا `failOffsetY` أضيق منها. والحسمُ
 * ٥٦px أو ٠٫٤px/ms (= ٤٠٠ في وحدة RNGH: px/s).
 *
 * 🔑 **والتنازعُ مع الصفوف والتمرير كما كان** (مقروءٌ في المصدر قبل الكتابة — درسُ D-1138):
 * `RNGestureHandlerRootHelper.requestDisallowInterceptTouchEvent` يُلغي الإيماءةَ ما دامت
 * لم تُقفل — فالصفُّ الأفقيُّ والقائمةُ العموديّة **يكسبان إن تحرّكا أوّلاً**، وهو ما حرسه
 * D-953. و`Pressable` لا يُلغيها (`blockNativeResponder` افتراضُه `false`)، فالسحبُ من فوق
 * بطاقةٍ يعمل. وبعد القفل يعترض الجذرُ اللمسَ فتُلغى الضغطةُ تحت الإصبع — كما كان.
 *
 * ⚖️ **`GestureHandlerRootView` محلّيٌّ هنا لا في الجذر**: مطفأٌ ⇒ لا جذرَ جديدَ في التطبيق كلِّه؛
 * والجذرُ المتداخلُ مدعومٌ (يتعطّل وحدَه إن وجد جذراً فوقه — `hasGestureHandlerEnabledRootView`).
 *
 * 📏 **القياسُ على الخيط الذي يحرّك اللوح**: `gesture.jank` بـ`thread=ui` يُعدّ بإطارات خيط
 * الواجهة (حلقةُ `requestAnimationFrame` في وقت تشغيل Reanimated) من القفل إلى الرفع — **وهو ما
 * يقابل `thread=js` في `TabSlideJS`**: إطارٌ رآه الإصبعُ ضاع. ويبقى عدّادُ JS هنا أيضاً (`thread=js`
 * `k2=1`) — ليقول كم ينشغل JS في أثناء السحب وإن لم يعد يُرى.
 */
const REASE = REasing.bezier(0.32, 0.72, 0, 1);
const UI_FRAME_MS = 1000 / 60;

function TabSlideUI<K extends string>({ order, tab, onTab, render, style, perfScreen }: Props<K>) {
  const { width } = useWindowDimensions();
  const phys = I18nManager.isRTL ? -1 : 1;
  const at = useCallback((k: K, w = width) => -Math.max(0, order.indexOf(k)) * w * phys, [order, width, phys]);

  /* ما يقرؤه خيطُ الواجهة: الموضع · الانشغال · الهندسة · النشط · الجارُ المسلَّح */
  const pos = useSharedValue(at(tab));
  const busy = useSharedValue(0);
  const idx = useSharedValue(order.indexOf(tab));
  const count = useSharedValue(order.length);
  const w = useSharedValue(width);
  const ph = useSharedValue(phys);
  const armed = useSharedValue(-1);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);
  /* عدّادُ إطارات خيط الواجهة */
  const jLive = useSharedValue(0);
  const jT0 = useSharedValue(-1);
  const jLast = useSharedValue(-1);
  const jDrop = useSharedValue(0);

  /* الهندسةُ والنشطُ تصل خيطَ الواجهة قبل الرسم — سحبةٌ تبدأ بعد القلب تقرأ التبويبَ الجديد */
  useLayoutEffect(() => {
    idx.value = order.indexOf(tab);
    count.value = order.length;
    w.value = width;
    ph.value = phys;
  }, [order, tab, width, phys, idx, count, w, ph]);

  const [side, setSide] = useState<K | null>(null);
  const sideRef = useRef<K | null>(null);
  const mount = useCallback((k: K | null) => {
    if (sideRef.current === k) return;
    sideRef.current = k;
    setSide(k);
  }, []);
  const orderRef = useRef(order);
  orderRef.current = order;
  const onTabRef = useRef(onTab);
  onTabRef.current = onTab;
  const perfRef = useRef(perfScreen);
  perfRef.current = perfScreen;
  const settled = useRef<K | null>(null);
  const armEnd = useRef<(() => void) | null>(null);
  const jsJank = useRef<(() => void) | null>(null);

  /* ——— ما يعبر إلى JS ——— */
  const arm = useCallback(
    (i: number) => {
      const k = orderRef.current[i];
      if (!k) return;
      if (sideRef.current !== k && perfRef.current) armEnd.current = span("tab.arm", { screen: perfRef.current, tab: k, k2: 1 });
      mount(k);
    },
    [mount],
  );
  const unmountSide = useCallback(() => mount(null), [mount]);
  const commit = useCallback((i: number) => {
    const k = orderRef.current[i];
    if (!k) return;
    settled.current = k;
    onTabRef.current(k);
  }, []);
  const jsJankOn = useCallback(() => {
    if (!jsJank.current && perfRef.current) jsJank.current = jankStart({ screen: perfRef.current, thread: "js", k2: 1 });
  }, []);
  const jsJankOff = useCallback(() => {
    jsJank.current?.();
    jsJank.current = null;
  }, []);
  const uiJankReport = useCallback((dropped: number, dur: number, i: number) => {
    const s = perfRef.current;
    if (!s || dur < 120) return;
    const k = i >= 0 ? orderRef.current[i] : undefined;
    mark("gesture.jank", dropped, { screen: s, ...(k ? { tab: k } : {}), dur: Math.round(dur), thread: "ui", k2: 1 });
  }, []);
  useEffect(
    () => () => {
      jLive.value = 0;
      jsJankOff();
    },
    [jLive, jsJankOff],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((e, m) => {
          const t = e.changedTouches[0];
          if (t) {
            x0.value = t.absoluteX;
            y0.value = t.absoluteY;
          }
          if (busy.value) m.fail();
        })
        .onTouchesMove((e, m) => {
          if (busy.value) {
            m.fail();
            return;
          }
          const t = e.allTouches[0];
          if (!t) return;
          const dx = t.absoluteX - x0.value;
          const dy = t.absoluteY - y0.value;
          /* عتباتُ D-953 حرفاً: لا نسأل قبل ٢٠px، والأفقُ يغلب العمودَ بـ١٫٦ */
          if (Math.abs(dx) > LOCK_DX && Math.abs(dx) > TILT * Math.abs(dy)) m.activate();
        })
        .onStart(() => {
          /* عدّادُ إطارات خيط الواجهة: حلقةٌ على وقت تشغيل Reanimated، تُعدّ الفجواتُ فوق ١٫٥ إطار */
          jLive.value = 1;
          jT0.value = -1;
          jLast.value = -1;
          jDrop.value = 0;
          const tick = (ts: number) => {
            if (!jLive.value) return;
            if (jT0.value < 0) jT0.value = ts;
            else {
              const gap = ts - jLast.value;
              if (gap > UI_FRAME_MS * 1.5) jDrop.value += Math.round(gap / UI_FRAME_MS) - 1;
            }
            jLast.value = ts;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          scheduleOnRN(jsJankOn);
        })
        .onUpdate((e) => {
          const i = idx.value;
          const W = w.value;
          const P = ph.value;
          const base = -Math.max(0, i) * W * P;
          const dir = e.translationX * P < 0 ? 1 : -1;
          const ni = i >= 0 ? i + dir : -1;
          const has = ni >= 0 && ni < count.value;
          /* التسليحُ عند القفل (D-523) — التركيبُ على JS، واللوحُ لا ينتظره */
          if (has && armed.value !== ni) {
            armed.value = ni;
            scheduleOnRN(arm, ni);
          }
          pos.value = base + (has ? Math.max(-W, Math.min(W, e.translationX)) : e.translationX * RUBBER);
        })
        .onEnd((e, success) => {
          const i = idx.value;
          const W = w.value;
          const P = ph.value;
          const base = -Math.max(0, i) * W * P;
          const dir = e.translationX * P < 0 ? 1 : -1;
          const ni = i >= 0 ? i + dir : -1;
          const has = ni >= 0 && ni < count.value;
          busy.value = 1;
          if (success && has && (Math.abs(e.translationX) >= COMMIT_DX || Math.abs(e.velocityX) >= COMMIT_VX * 1000)) {
            /* الطيرانُ ثمّ القلب (D-526/D-970): النشطُ يُحدَّث على خيط الواجهة أوّلاً — سحبةٌ تالية
               قبل أن يرسم React تقرأ الموضعَ الصحيح */
            pos.value = withTiming(base - dir * P * W, { duration: FLY_MS, easing: REASE }, (fin) => {
              busy.value = 0;
              armed.value = -1;
              if (fin) {
                idx.value = ni;
                scheduleOnRN(commit, ni);
              }
            });
            return;
          }
          pos.value = withTiming(base, { duration: SNAP_MS, easing: REASE }, (fin) => {
            busy.value = 0;
            armed.value = -1;
            if (fin) scheduleOnRN(unmountSide);
          });
        })
        .onFinalize(() => {
          if (jLive.value) {
            jLive.value = 0;
            const dur = jT0.value >= 0 ? jLast.value - jT0.value : 0;
            scheduleOnRN(uiJankReport, jDrop.value, dur, armed.value);
          }
          scheduleOnRN(jsJankOff);
        }),
    [x0, y0, busy, idx, w, ph, count, armed, pos, jLive, jT0, jLast, jDrop, arm, commit, unmountSide, jsJankOn, jsJankOff, uiJankReport],
  );

  /* تبدّلُ `tab` — كما في `TabSlideJS`: من سحبٍ مكتمل ⇒ يُنزع الجار؛ من ضغطة ⇒ ينزلق القديمُ والجديدُ معاً */
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
      cancelAnimation(pos);
      pos.value = at(tab);
      mount(null);
      return;
    }
    mount(old);
    busy.value = 1;
    pos.value = withTiming(at(tab), { duration: FLY_MS, easing: REASE }, (fin) => {
      busy.value = 0;
      if (fin) scheduleOnRN(unmountSide);
    });
  }, [tab, order, at, pos, busy, mount, unmountSide]);

  /* دورانٌ أو ترتيبٌ جديد: المسارُ يُثبَّت على النشط بلا حركة (مقيسٌ بالمحتوى — كما في `TabSlideJS`) */
  const geom = `${width}|${order.join(",")}`;
  const geomRef = useRef(geom);
  useEffect(() => {
    if (geomRef.current === geom) return;
    geomRef.current = geom;
    cancelAnimation(pos);
    pos.value = at(tab);
    if (side && !order.includes(side)) mount(null);
  }, [geom, order, at, tab, pos, side, mount]);

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value }] }));
  const panes: K[] = side && side !== tab ? [tab, side] : [tab];

  return (
    <GestureHandlerRootView style={[{ flex: 1, overflow: "hidden" }, style]}>
      <GestureDetector gesture={gesture}>
        <View style={{ flex: 1 }} collapsable={false}>
          <Reanimated.View style={[{ position: "absolute", top: 0, bottom: 0, start: 0, width: Math.max(1, order.length) * width }, track]}>
            {panes.map((k) => {
              const on = k === tab;
              return (
                <View
                  key={k}
                  onLayout={on ? undefined : () => { armEnd.current?.(); armEnd.current = null; }}
                  style={{ position: "absolute", top: 0, bottom: 0, width, start: Math.max(0, order.indexOf(k)) * width, pointerEvents: on ? "auto" : "none" }}
                >
                  {render(k, on)}
                </View>
              );
            })}
          </Reanimated.View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
