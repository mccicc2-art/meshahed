import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { frameCounter, jankStart, mark, span } from "./perfMarks";
import { Animated, Easing, I18nManager, PanResponder, useWindowDimensions, View, type ViewStyle } from "react-native";
import { afterInteractions } from "./afterInteractions";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, { cancelAnimation, Easing as REasing, makeMutable, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { flag } from "./flags";
import { gestureProbe, useAppAway } from "./appActive";

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
 * 🔴 **D-972 — المسارُ بعرض كلِّ الألواح، لا بعرض الشاشة** (بلاغُ أحمد بتسجيل على
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
  /* 🆕 K3b — «المجتمع» و«الرسائل» يُسمَّيان: سحبُهما كان بلا رقم (`gesture.jank`/`tab.arm`)، فلم يُعرف إن أسقطا إطاراتٍ
     كأخواتهما. الخادمُ يقبل الاسمَ كما هو (`screen` كلمةٌ من `[\w.-]`) — لا تغييرَ هناك */
  perfScreen?: "library" | "discover" | "community" | "messages" | "profile";
  /**
   * 🆕 11-M · M1-fix — **الوجهةُ لحظةَ رفع الإصبع** (تسجيلُ أحمد ٢٨ سبتمبر: خطُّ التبويب يلحق اللوحَ بنصف ثانية —
   * اللوحُ استقرّ على «الناس» والخطُّ ما زال تحت «الأعمال»). القلبُ نفسُه (`onTab`) يبقى بعد الطيران (D-526: لا إطارَ
   * وسيطاً)، لكنّ الشريطَ يعرف الوجهةَ الآن فيُضيئها مع بدء الطيران كما في الويب. سحبٌ ارتدّ لا يُعلن شيئاً.
   */
  onAim?: (next: K) => void;
  /**
   * 🆕 D-1544 — **الجارُ الذي بدأ الإصبعُ يسحبه** (أوّلَ القفل، قبل أن يظهر منه شيء). ملفُّ الشخص يضبط به موضعَ اللوح القادم على
   * الرأس الحاليّ قبل أن ينزلق — كان يُضبط عند القلب (`onTab`) بعد الطيران، فيظهر نصفَ ثانيةٍ بموضعه القديم. مسارُ K2 وحدَه.
   */
  onArm?: (next: K) => void;
  /**
   * 🆕 11-N · N1-fix5 — **كلُّ التبويبات مجهَّزةٌ لا الجاران وحدَهما** (ملفُّ الشخص؛ أحمد ٢٩ سبتمبر: «الإيماءات ممتازة.. لكن ضغط الزر
   * لا»). ضغطةٌ على تبويبٍ بعيدٍ كانت تطير فوق ألواحٍ غير مركّبة وتصل لوحاً بارداً — فراغٌ أسودُ حتى يُرسم. ألواحُ الملفّ من حمولةٍ
   * واحدةٍ محمّلةٍ أصلاً وعددُها خمسةٌ على الأكثر، فتُركَّب كلُّها بعد أن تهدأ الحركة الأولى (المهلةُ نفسُها `WARM_MS`) ولا يُنزع منها
   * شيء. **لا يُستعمل حيث تجلب الألواحُ بياناتِها بنفسها** (المكتبة · اكتشف) — هناك «ثلاثةُ ألواحٍ حدٌّ أعلى» (K2) تبقى. مسارُ K2 وحدَه.
   */
  warmAll?: boolean;
  /**
   * 🆕 D-1540 — **ما زرتَه يبقى** (تسجيلُ أحمد ٢٣ أكتوبر في «اكتشف»: «اذا بتنقل بسرعة ما يمدي يكون الادء افضل واسلس؟»، ثمّ «أ»): حدُّ
   * الألواح الثلاثة (K2) كان ينزع التبويبَ البعيد، فالتنقّلُ السريع يعيد بناءَه من الصفر — تسعُ تركيباتٍ في دقيقة (`tab.arm` ٧٦–٥٥٤ms
   * لكلٍّ) وخيطُ JS مشغولٌ والملصقاتُ مربّعاتٌ فارغة. الآن كلُّ لوحٍ ظهر مرّةً يبقى مركّباً لعمر الشاشة (والجاران كما كانا)؛ ما لم يُزَر
   * لا يُبنى، فلا جلبَ للبيانات كلِّها دفعةً. لشاشةٍ تبويباتُها قليلة (اكتشف أربعة). مسارُ K2 وحدَه.
   */
  keepVisited?: boolean;
};

/**
 * ====== K2 — أيُّ المسارين يرسم (D-1140) ======
 * المفتاحُ يُقرأ **مرّةً عند التركيب** ويثبت لعمر الشاشة: لا تبديلَ آليّةٍ والإصبعُ على
 * اللوح. `k2` من الخادم (`flags.ts`) — مطفأٌ ⇒ المسارُ القائم حرفاً (`TabSlideJS`).
 */
/**
 * ====== 🆕 D-1497 — السحبُ بين التبويبات لا يفتح ما تحت الإصبع ======
 *
 * بلاغُ أحمد بتسجيلين (٢١ أكتوبر): سحبةٌ من «النقاشات» إلى «النشاط» تفتح النقاشَ الذي بدأ عليه الإصبع، وفي المكتبة تفتح
 * ورقةَ ترتيب «للمشاهدة». مسارُ K2 يسحب على خيط الواجهة (RNGH)، **والضغطةُ في `Pressable` على خيط JS لا تُلغى حين تُقفل
 * السحبة** على الآيفون — فرفعُ الإصبع في آخر السحبة يُقرأ ضغطة. (رأسُ `TabSlideUI` كان يفترض الإلغاءَ ولم يُختبر على آيفون.)
 * 🔑 **العلاجُ في اللوح نفسِه لا في كلِّ بطاقة**: ما دامت السحبةُ حيّةً يطالب غلافُ الألواح بالمستجيب عند أوّل حركة
 * (`onMoveShouldSetResponderCapture`) — فتُنهى ضغطةُ البطاقة قبل الرفع ولا يُفتح شيء ولا يومض. ولمسةٌ تبدأ خلال
 * `SWIPE_QUIET_MS` بعد السحبة لا تفتح شيئاً: `tabSwipeBlocksPress` حارسٌ ثانٍ في أبواب الفتح (والسحبةُ الخاطفةُ ترفع قبل أن تصل JS حركة).
 */
const SWIPE_QUIET_MS = 300;
let swipeLive = false;
let swipeEndAt = 0;
export function tabSwipeBlocksPress(): boolean {
  return swipeLive || Date.now() - swipeEndAt < SWIPE_QUIET_MS;
}
function swipeOn() {
  swipeLive = true;
}
function swipeOff() {
  swipeLive = false;
  swipeEndAt = Date.now();
}
const captureWhileSwiping = () => swipeLive;
const noop = () => {};

export function TabSlide<K extends string>(props: Props<K>) {
  const [k2] = useState(() => flag("k2"));
  return k2 ? <TabSlideUI {...props} /> : <TabSlideJS {...props} />;
}

/** المسارُ القائمُ منذ D-970/D-972: `PanResponder` على خيط JS — يبقى كما هو حتى تثبت K2 */
function TabSlideJS<K extends string>({ order, tab, onTab, onAim, render, style, perfScreen }: Props<K>) {
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
  const onAimRef = useRef(onAim);
  onAimRef.current = onAim;
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
            onAimRef.current?.(next);
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
     في أثناء سحبٍ حيٍّ (رسمةُ تسليح الجار) كانت ستقفز بالإصبع. */
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
      {/* D-972 — المسارُ يتّسع لكلِّ الألواح فتبقى داخل حدوده؛ `start` لا `left` كي
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
 * يتبع الإصبعَ ولو انشغل JS بالتركيب كلّه. **وما يحتاج React وحدَه يعبر إلى JS**: تركيبُ الجار
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

/**
 * 🆕 K2 — **الجاران يُجهَّزان قبل أن يسأل الإصبع** (تسجيلُ خالد ٢٨ سبتمبر: السحبُ إلى «أفلام» في المكتبة يكشف
 * صناديقَ فارغةً ثمّ تتلاشى الملصقاتُ إليها). التسليحُ عند القفل (D-523) يعني أنّ لوحَ الجار **يُركَّب والإصبعُ
 * يسحب** — فصورُه تبدأ التحميلَ وهي تدخل الشاشة. الآن بعد أن يستقرّ التبويبُ وتهدأ الحركة يُركَّب الجاران
 * (السابقُ والتالي) خارجَ الشاشة، فتكون صورُهما جاهزةً قبل السحب. **ومفتاحُ اللوح ثابت**: من سحب إلى جارٍ
 * لا يُعاد تركيبُ شيء — والتبويبُ الذي غادره صار جاراً فيبقى كما هو.
 * ⚖️ **الثمنُ معلَن**: ثلاثةُ ألواحٍ مركّبةٌ بعد الاستقرار بدل واحد (والجارُ `active=false` — لا مشغّلَ يحمى،
 * D-975). التركيبُ بعد `WARM_MS` وبعد التفاعلات، لا مع أوّل رسمٍ للشاشة ولا في أثناء الحركة.
 * `tab.arm` لجارٍ جاهزٍ يُسجَّل `0` بـ`cached=1` — فتُقرأ نسبةُ السحبات التي وجدت جارَها حاضراً.
 */
const WARM_MS = FLY_MS + 180;
/** 🆕 K2 — بعد **سحبٍ** اكتمل: التبويبُ يتبدّل بعد الطيران لا قبله، فلا حركةَ تُنتظر — الهامشُ وحدَه. قياسُ خالد
    (٢٨ سبتمبر): السحباتُ المتتالية كانت تسبق مهلةَ `WARM_MS` فتجد الجارَ بارداً — وهي وحدَها التي بقي فيها تقطيع */
const WARM_AFTER_SWIPE_MS = 180;
/* 🆕 D-1241 — `warmAll`: الألواحُ البعيدةُ تُركَّب **واحداً واحداً** بهذه الفاصلة لا دفعةً. عدّادُ D-1240 على ملفّ الشخص
   (SM-S928B): تركيبُ أربعة ألواحٍ معاً يوقف خيطَ الواجهة ٢٠٠–٣١٦ms بعد الظهور بنحو ثانية — واللمسُ في تلك اللحظة لا يُجاب
   («ما أقدر أتحكّم على طول»). لوحٌ في كلِّ مرّة يقسم الوقفةَ إلى قصيراتٍ بينها إطاراتٌ تجيب الإصبع. */
const WARM_STEP_MS = 320;
/* D-1335 — عمرُ حسمِ سحبٍ ينتظر رسمتَه (انظر `pending`) */
const PENDING_MS = 1000;

/**
 * 🆕 D-1242 — **لوحٌ يُجهَّز في الخلفيّة يُركَّب مخفيّاً ثمّ يُكشف** (تسجيلُ أحمد ٣ أكتوبر على ملفّ الشخص: بعد نحو نصف ثانيةٍ
 * من الاستقرار على «النشاط» تظهر عناوينُ من تبويبٍ آخر فوق القائمة إطارين ثمّ تختفي). السببُ تدريجُ D-1241: كلُّ لوحٍ
 * يُركَّب الآن والعينُ على الشاشة، ومحتواه يُرسم أوّلَ إطارٍ أو اثنين في غير موضعه قبل أن يستقرّ خارجها — وكان ذلك
 * يقع مرّةً واحدةً داخل وقفة التركيب القديمة فلا يُرى. **لماذا يُرسم في غير موضعه لم يُحدَّد** — فالعلاجُ لا يتّكل عليه:
 * شفافيّةُ صفرٍ حتى يُقاس اللوحُ وتمرَّ مهلة، وأندرويد لا يرسم ما شفافيّتُه صفر.
 * الحالةُ في هذا الغلاف وحدَه: كشفُه لا يعيد رسمَ ما بداخله (الأبناءُ عنصرٌ ثابتُ الهويّة من رسمة الأب).
 */
const VEIL_MS = 150;
/**
 * 🆕 D-1547 — **قياسٌ مؤقّت: ثقلُ تجهيز لوحٍ في الخلفيّة** (`pane.warm`؛ أحمد ٢٣ أكتوبر، خيار «ج»: نخفّف ألواحَ الملفّ بدل أن نؤخّر
 * الظهور). لكلِّ لوحٍ يُركَّب بـ`warmAll`: القيمةُ ms من طلب التركيب إلى أوّل `onLayout` له (عملُ JS + التركيبُ الأصليّ)،
 * و`drop`/`worst` إطاراتُ خيط الواجهة الضائعة وأطولُ فجوةٍ فيه خلال `WARM_PROBE_MS`، و`jsd` ما ضاع على JS. نافذةٌ واحدةٌ في
 * المرّة (الألواحُ بينها `WARM_STEP_MS`). كلُّ فشلٍ صمت. يُزال مع بقيّة المسابر حين يُطلب.
 */
/* D-1547 — أقصرُ من `WARM_STEP_MS` (٣٢٠): نافذةٌ أطولُ كانت تمسحها نافذةُ اللوح التالي فلا يصل إلّا آخرُها («المفضّلة» وحدَها) */
const WARM_PROBE_MS = 300;
type WarmUi = { start: (id: number) => void };
let warmUi: WarmUi | null | undefined;
let warmSeq = 0;
const warmLive = new Map<number, { screen: string; tab: string; t0: number; laid: number; stopJs: () => number }>();
function warmUiDone(id: number, dropped: number, worstGap: number, dur: number) {
  const w = warmLive.get(id);
  if (!w) return;
  warmLive.delete(id);
  mark("pane.warm", w.laid >= 0 ? w.laid - w.t0 : -1, { screen: w.screen, tab: w.tab, drop: dropped, worst: Math.round(worstGap), dur: Math.round(dur), jsd: w.stopJs() });
}
function buildWarmUi(): WarmUi {
  const sid = makeMutable(0);
  const t0 = makeMutable(-1);
  const last = makeMutable(-1);
  const drop = makeMutable(0);
  const worst = makeMutable(0);
  const start = (id: number) => {
    "worklet";
    sid.value = id;
    t0.value = -1;
    last.value = -1;
    drop.value = 0;
    worst.value = 0;
    const tick = (ts: number) => {
      if (sid.value !== id) return;
      if (t0.value < 0) t0.value = ts;
      else {
        const gap = ts - last.value;
        if (gap > worst.value) worst.value = gap;
        if (gap > UI_FRAME_MS * 1.5) drop.value += Math.round(gap / UI_FRAME_MS) - 1;
      }
      last.value = ts;
      if (ts - t0.value >= WARM_PROBE_MS) {
        sid.value = 0;
        scheduleOnRN(warmUiDone, id, drop.value, worst.value, ts - t0.value);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  return { start };
}
/** يبدأ نافذةَ القياس للوح `tab` ويعيد رقمَها (أو 0 إن انطفأ القياس) */
function warmProbe(screen: string, tab: string): number {
  if (warmUi === null) return 0;
  try {
    if (warmUi === undefined) warmUi = buildWarmUi();
    const id = ++warmSeq;
    warmLive.set(id, { screen, tab, t0: performance.now(), laid: -1, stopJs: frameCounter() });
    scheduleOnUI(warmUi.start, id);
    if (warmLive.size > 6) warmLive.delete(warmLive.keys().next().value as number);
    return id;
  } catch {
    warmUi = null;
    return 0;
  }
}
function warmLaid(id: number) {
  const w = warmLive.get(id);
  if (w && w.laid < 0) w.laid = performance.now();
}

function PaneBox({ veil, onLaid, style, children }: { veil: boolean; onLaid?: () => void; style: ViewStyle; children: React.ReactNode }) {
  /* لوحٌ رُكّب ظاهراً (النشط) لا يُخفى أبداً ولو صار جاراً بعدها */
  const [settled, setSettled] = useState(!veil);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <View
      onLayout={() => {
        onLaid?.();
        if (!settled && !timer.current) timer.current = setTimeout(() => setSettled(true), VEIL_MS);
      }}
      style={veil && !settled ? [style, { opacity: 0 }] : style}
    >
      {children}
    </View>
  );
}

function TabSlideUI<K extends string>({ order, tab, onTab, onAim, onArm, render, style, perfScreen, warmAll = false, keepVisited = false }: Props<K>) {
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
  /* 🆕 D-1604 — الخروجُ من التطبيق يُطفئ السحبةَ فتُلغى إن كانت جارية، و«إصبعٌ عليها» يُقرأ لحظةَ الخروج (`appActive.ts`) */
  const away = useAppAway();
  const down = useSharedValue(0);
  useEffect(() => gestureProbe(`tab:${perfScreen ?? "?"}`, () => down.value === 1), [perfScreen, down]);
  /* 🆕 D-1335 — السحبةُ تقطع الطيران (الشرحُ عند `gesture`): وجهةُ الطيران الجاري (`-1` = لا طيران)، ورقمُه (ردُّ طيرانٍ
     قُطع لا يمسّ ما بعده)، وموضعُ اللوح لحظةَ التقاطه منسوباً إلى مستقرِّ وجهته، وإزاحةُ الإصبع التي تُبقيه هناك */
  const fly = useSharedValue(-1);
  const gen = useSharedValue(0);
  const grab = useSharedValue(0);
  const grabRel = useSharedValue(0);
  const carry = useSharedValue(0);
  /* عدّادُ إطارات خيط الواجهة */
  const jLive = useSharedValue(0);
  const jT0 = useSharedValue(-1);
  const jLast = useSharedValue(-1);
  const jDrop = useSharedValue(0);

  const [side, setSide] = useState<K | null>(null);
  const sideRef = useRef<K | null>(null);
  const mount = useCallback((k: K | null) => {
    if (sideRef.current === k) return;
    sideRef.current = k;
    setSide(k);
  }, []);
  const orderRef = useRef(order);
  orderRef.current = order;
  /* 🆕 K2 — الجاران المجهَّزان (انظر `WARM_MS`) */
  const [warm, setWarm] = useState<K[]>([]);
  /* D-1547 — رقمُ نافذة قياس `pane.warm` لكلِّ لوحٍ طُلب تجهيزُه ولم يُرسم بعد */
  const probeOf = useRef(new Map<K, number>());
  const warmRef = useRef<K[]>([]);
  warmRef.current = warm;
  /* التبويبُ الذي استقرّ عليه اللوحُ آخرَ مرّة — في رسمة القلب هو الذي غادرناه للتوّ */
  const lastTab = useRef(tab);
  const onTabRef = useRef(onTab);
  onTabRef.current = onTab;
  const onAimRef = useRef(onAim);
  onAimRef.current = onAim;
  const onArmRef = useRef(onArm);
  onArmRef.current = onArm;
  const perfRef = useRef(perfScreen);
  perfRef.current = perfScreen;
  /* تبويباتٌ حسمها السحبُ على خيط الواجهة ولم يرسمها React بعد — بالترتيب (كانت واحداً؛ قطعُ الطيران يجعلها أكثر) */
  const pending = useRef<{ k: K; at: number }[]>([]);
  /* حسمٌ لم تأتِ رسمتُه خلال ثانيةٍ لن تأتي (React جمع تبديلين عادا إلى التبويب نفسِه) — يُرمى كي لا يُقرأ لاحقاً سبقاً */
  const livePending = useCallback(() => {
    const now = performance.now();
    const p = pending.current;
    if (p.length > 0 && now - p[0]!.at >= PENDING_MS) pending.current = p.filter((e) => now - e.at < PENDING_MS);
    return pending.current;
  }, []);
  /* الهندسةُ والنشطُ تصل خيطَ الواجهة قبل الرسم — سحبةٌ تبدأ بعد القلب تقرأ التبويبَ الجديد */
  useLayoutEffect(() => {
    /* 🆕 D-1335 — **خيطُ الواجهة قد يسبق React**: سحبةٌ قطعت الطيران حسمت تبويباً لم تُرسم رسمتُه بعد (`pending`)، وهذا
       التأثيرُ يعمل مع كلِّ رسمة (`order` مصفوفةٌ جديدةٌ كلَّ مرّة) — فكتابةُ التبويب المرسوم الآن فوق المحسوم تُرجع
       الموضعَ لوحاً كاملاً تحت الإصبع. يُكتب حين لا حسمَ ينتظر، أو حين هذه رسمةُ آخرِ ما حُسم. */
    const pend = livePending();
    if (pend.length === 0 || pend[pend.length - 1]!.k === tab) idx.value = order.indexOf(tab);
    count.value = order.length;
    w.value = width;
    ph.value = phys;
  }, [order, tab, width, phys, idx, count, w, ph, livePending]);

  /* آخرُ تبدّلٍ للتبويب جاء من سحبٍ مكتمل (لا من ضغطة) — يقصّر مهلةَ التجهيز */
  const bySwipe = useRef(false);
  const armEnd = useRef<(() => void) | null>(null);
  const jsJank = useRef<(() => void) | null>(null);

  /* ——— ما يعبر إلى JS ——— */
  const arm = useCallback(
    (i: number) => {
      const k = orderRef.current[i];
      if (!k) return;
      onArmRef.current?.(k);
      if (sideRef.current !== k && perfRef.current) {
        /* 🆕 K2 — جارٌ مجهَّزٌ مسبقاً: لا تركيبَ ينتظره الإصبع */
        if (warmRef.current.includes(k)) mark("tab.arm", 0, { screen: perfRef.current, tab: k, k2: 1, cached: 1 });
        else armEnd.current = span("tab.arm", { screen: perfRef.current, tab: k, k2: 1 });
      }
      mount(k);
    },
    [mount],
  );
  const unmountSide = useCallback(() => mount(null), [mount]);
  const aim = useCallback((i: number) => {
    const k = orderRef.current[i];
    if (k) onAimRef.current?.(k);
  }, []);
  const commit = useCallback((i: number) => {
    const k = orderRef.current[i];
    if (!k) return;
    pending.current.push({ k, at: performance.now() });
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
        .enabled(!away)
        .manualActivation(true)
        .onTouchesDown((e, m) => {
          down.value = 1;
          const t = e.changedTouches[0];
          if (t) {
            x0.value = t.absoluteX;
            y0.value = t.absoluteY;
          }
          grab.value = 0;
          carry.value = 0;
          /* طيرانُ ضغطةِ تبويبٍ (٢) لا يُقطع: لوحان يتبادلان الموضعَ ولا «وجهةَ» يُكمل منها الإصبع */
          if (busy.value === 2) m.fail();
        })
        .onTouchesMove((e, m) => {
          if (busy.value === 2) {
            m.fail();
            return;
          }
          const t = e.allTouches[0];
          if (!t) return;
          const dx = t.absoluteX - x0.value;
          const dy = t.absoluteY - y0.value;
          /* عتباتُ D-953 حرفاً: لا نسأل قبل ٢٠px، والأفقُ يغلب العمودَ بـ١٫٦ */
          if (!(Math.abs(dx) > LOCK_DX && Math.abs(dx) > TILT * Math.abs(dy))) return;
          if (busy.value === 1) {
            /* 🆕 D-1335 — **السحبةُ التاليةُ تقطع الطيران** (بلاغُ أحمد بتسجيل، ٩ أكتوبر ٢٠٢٦: «إذا كنت في المسلسلات وبروح
               للأنمي، ليش لازم يوقف في الفلم لثانية؟»). كان كلُّ لمسٍ يُرفض ما دام اللوحُ يطير (٥٢٠ms)، والمنحنى يُبطئ
               بقوّةٍ في آخره: العينُ ترى اللوحَ واقفاً منذ ~٢٥٠ms والسحبُ ما زال مرفوضاً.
               الآن سحبةٌ قُفلت واللوحُ يطير **تلتقطه حيث هو**: وجهتُه تُحسم نشطةً فوراً (على خيط الواجهة، وReact يلحق)،
               والإصبعُ يكمل من موضع اللوح نفسِه بلا قفزة — كأيِّ مصفّحِ تبويباتٍ أصليّ. القفلُ بالعتبات نفسِها، فالتمريرُ
               العموديُّ والصفوفُ الأفقيّةُ يكسبان إن تحرّكا أوّلاً كما كانا. */
            const target = fly.value;
            const W = w.value;
            const P = ph.value;
            const cur = pos.value;
            gen.value += 1;
            cancelAnimation(pos);
            pos.value = cur;
            grabRel.value = cur - -Math.max(0, target) * W * P;
            grab.value = 1;
            busy.value = 0;
            armed.value = -1;
            fly.value = -1;
            if (target >= 0 && target !== idx.value) {
              idx.value = target;
              scheduleOnRN(commit, target);
            }
          }
          m.activate();
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
          scheduleOnRN(swipeOn);
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
          /* D-1335 — لوحٌ التُقط طائراً: أوّلُ حركةٍ تحسب الإزاحةَ التي تُبقيه حيث التُقط (`carry` صفرٌ في السحب العاديّ) */
          if (grab.value) {
            grab.value = 0;
            carry.value = grabRel.value - (has ? e.translationX : e.translationX * RUBBER);
          }
          const c = carry.value;
          pos.value = base + (has ? Math.max(-W, Math.min(W, c + e.translationX)) : c + e.translationX * RUBBER);
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
          grab.value = 0;
          /* D-1335 — رقمُ هذا الطيران: ردُّه لا يعمل إن قُطع (السحبةُ التي قطعته حسمت كلَّ شيءٍ بنفسها) */
          gen.value += 1;
          const g = gen.value;
          if (success && has && (Math.abs(e.translationX) >= COMMIT_DX || Math.abs(e.velocityX) >= COMMIT_VX * 1000)) {
            /* الطيرانُ ثمّ القلب (D-526/D-970): النشطُ يُحدَّث على خيط الواجهة أوّلاً — سحبةٌ تالية
               قبل أن يرسم React تقرأ الموضعَ الصحيح */
            scheduleOnRN(aim, ni);
            fly.value = ni;
            pos.value = withTiming(base - dir * P * W, { duration: FLY_MS, easing: REASE }, (fin) => {
              if (gen.value !== g) return;
              if (busy.value === 1) busy.value = 0;
              armed.value = -1;
              fly.value = -1;
              if (fin) {
                idx.value = ni;
                scheduleOnRN(commit, ni);
              }
            });
            return;
          }
          /* عودةٌ إلى النشط — تُقطع هي أيضاً (وجهتُها النشطُ نفسُه فلا حسمَ جديد) */
          fly.value = i;
          pos.value = withTiming(base, { duration: SNAP_MS, easing: REASE }, (fin) => {
            if (gen.value !== g) return;
            if (busy.value === 1) busy.value = 0;
            armed.value = -1;
            fly.value = -1;
            if (fin) scheduleOnRN(unmountSide);
          });
        })
        .onTouchesUp((e) => {
          if (e.numberOfTouches === 0) down.value = 0;
        })
        .onTouchesCancelled(() => {
          down.value = 0;
        })
        .onFinalize(() => {
          down.value = 0;
          if (jLive.value) {
            jLive.value = 0;
            const dur = jT0.value >= 0 ? jLast.value - jT0.value : 0;
            scheduleOnRN(uiJankReport, jDrop.value, dur, armed.value);
            /* D-1497 — نهايةُ سحبةٍ قُفلت فعلاً وحدَها (`jLive` يُرفع في `onStart`) — لمسةٌ عاديّةٌ لا تبدأ «هدوءاً» يحجب ضغطتَها */
            scheduleOnRN(swipeOff);
          }
          scheduleOnRN(jsJankOff);
        }),
    [away, down, x0, y0, busy, idx, w, ph, count, armed, pos, fly, gen, grab, grabRel, carry, jLive, jT0, jLast, jDrop, arm, aim, commit, unmountSide, jsJankOn, jsJankOff, uiJankReport],
  );

  /* تبدّلُ `tab` — كما في `TabSlideJS`: من سحبٍ مكتمل ⇒ يُنزع الجار؛ من ضغطة ⇒ ينزلق القديمُ والجديدُ معاً */
  const prev = useRef(tab);
  useLayoutEffect(() => {
    if (prev.current === tab) return;
    const old = prev.current;
    prev.current = tab;
    /* D-1335 — تبويبٌ حسمه السحب (هو وما سبقه في الطابور يخرجان). الجارُ يُنزع **إن كان هو الذي صار نشطاً**: سحبةٌ
       قطعت الطيران قد سلّحت جاراً جديداً قبل أن تصل هذه الرسمة — ونزعُه هنا يُفرغ ما تحت الإصبع */
    const pend = livePending();
    let at0 = -1;
    for (let n = pend.length - 1; n >= 0 && at0 < 0; n -= 1) if (pend[n]!.k === tab) at0 = n;
    bySwipe.current = at0 >= 0;
    if (at0 >= 0) {
      pending.current = pend.slice(at0 + 1);
      if (sideRef.current === tab) mount(null);
      return;
    }
    /* ضغطةُ تبويبٍ (أو تبديلٌ من الخارج) تُبطل ما لم يُرسم من حسم السحب */
    pending.current = [];
    const to = order.indexOf(tab);
    if (order.indexOf(old) < 0 || to < 0) {
      cancelAnimation(pos);
      pos.value = at(tab);
      mount(null);
      return;
    }
    mount(old);
    /* ٢ = طيرانُ ضغطة — لا يُقطع (D-1335) */
    busy.value = 2;
    fly.value = -1;
    pos.value = withTiming(at(tab), { duration: FLY_MS, easing: REASE }, (fin) => {
      busy.value = 0;
      if (fin) scheduleOnRN(unmountSide);
    });
  }, [tab, order, at, pos, busy, fly, mount, unmountSide, livePending]);

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

  /* 🆕 K2 — بعد كلِّ استقرار: يبقى من المجهَّز ما زال جاراً (والتبويبُ الذي غادرناه منه) فلا يُنزع ثمّ يُعاد،
     ويُركَّب الناقصُ بعد أن تهدأ الحركة. الأبعدُ يُنزع فوراً — ثلاثةُ ألواحٍ حدٌّ أعلى */
  const ti = order.indexOf(tab);
  /* 🆕 D-1540 — ما ظهر نشطاً مرّةً (يُسجَّل في الرسم: `near` تُحسب بعده في الرسمة نفسِها) */
  const visited = useRef(new Set<K>());
  if (keepVisited) visited.current.add(tab);
  const near = useMemo(
    () => {
      if (ti < 0) return [];
      if (warmAll) return order.filter((k) => k !== tab);
      const side2 = [order[ti - 1], order[ti + 1]].filter((k): k is K => !!k);
      return keepVisited ? order.filter((k) => k !== tab && (side2.includes(k) || visited.current.has(k))) : side2;
    },
    [order, ti, tab, warmAll, keepVisited],
  );
  useLayoutEffect(() => {
    const left = lastTab.current;
    lastTab.current = tab;
    setWarm((w) => {
      const keep = near.filter((k) => w.includes(k) || k === left);
      return keep.length === w.length && keep.every((k) => w.includes(k)) ? w : keep;
    });
    if (!near.length) return;
    const wait = bySwipe.current && left !== tab ? WARM_AFTER_SWIPE_MS : WARM_MS;
    bySwipe.current = false;
    let cancelled = false;
    let job: { cancel: () => void } | null = null;
    let timer: ReturnType<typeof setTimeout>;
    if (warmAll) {
      /* D-1241 — الأقربُ فالأبعد (الجاران أوّلاً كما في غير `warmAll`)، وما هو مجهَّزٌ أصلاً لا يأخذ دوراً */
      const queue = near.filter((k) => !warmRef.current.includes(k)).sort((a, b) => Math.abs(order.indexOf(a) - ti) - Math.abs(order.indexOf(b) - ti));
      let i = 0;
      const step = () => {
        job = afterInteractions(() => {
          if (cancelled) return;
          const k = queue[i];
          i += 1;
          if (k) {
            /* D-1547 — القياسُ يبدأ مع طلب التركيب */
            if (perfRef.current && !warmRef.current.includes(k)) probeOf.current.set(k, warmProbe(perfRef.current, k));
            setWarm((w) => (w.includes(k) ? w : [...w, k]));
          }
          if (i < queue.length) timer = setTimeout(step, WARM_STEP_MS);
        });
      };
      timer = setTimeout(step, wait);
    } else {
      timer = setTimeout(() => {
        job = afterInteractions(() => {
          if (!cancelled) setWarm(near);
        });
      }, wait);
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
      job?.cancel();
    };
  }, [tab, near, warmAll, order, ti]);

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value }] }));
  /* النشطُ · الخارجُ أو المسلَّح · الجاران المجهَّزان — بترتيب المسار، وكلٌّ بمفتاحه فلا يُعاد تركيبُ لوحٍ حاضر */
  const leaving = lastTab.current !== tab ? lastTab.current : null;
  const panes: K[] = order.filter((k) => k === tab || k === side || (near.includes(k) && (warm.includes(k) || k === leaving)));

  return (
    <GestureHandlerRootView style={[{ flex: 1, overflow: "hidden" }, style]}>
      <GestureDetector gesture={gesture}>
        <View
          style={{ flex: 1 }}
          collapsable={false}
          /* D-1497 — السحبةُ الحيّةُ تأخذ اللمسَ من البطاقة تحت الإصبع. ⚠️ ولا التقاطَ عند بدء لمسةٍ بعدها: مستجيبُ JS يحجب
             تمريرَ القائمة الأصليّ لتلك اللمسة — فاللمسةُ التالية يحرسها `tabSwipeBlocksPress` في أبواب الفتح لا هنا */
          onMoveShouldSetResponderCapture={captureWhileSwiping}
          onResponderGrant={noop}
          onResponderTerminationRequest={() => !swipeLive}
        >
          <Reanimated.View style={[{ position: "absolute", top: 0, bottom: 0, start: 0, width: Math.max(1, order.length) * width }, track]}>
            {panes.map((k) => {
              const on = k === tab;
              return (
                <PaneBox
                  key={k}
                  /* D-1242 — المجهَّزُ في الخلفيّة وحدَه يُخفى؛ النشطُ والمسلَّحُ تحت الإصبع ظاهران دائماً */
                  veil={warmAll && !on && k !== side}
                  onLaid={on ? undefined : () => {
                    armEnd.current?.();
                    armEnd.current = null;
                    const pid = probeOf.current.get(k);
                    if (pid) {
                      probeOf.current.delete(k);
                      warmLaid(pid);
                    }
                  }}
                  /* 🆕 D-1546 — **كلُّ لوحٍ مركَّبٍ يأخذ اللمس، لا النشطُ وحدَه** (أحمد ٢٣ أكتوبر بتسجيل: «اذا لفيت يمين بطلع فوق وانزل
                     مباشرة ما اقدر لازم تمر نص ثانية او ثانية»). `on` يتبع `tab`، و`tab` يتبدّل بعد الطيران (٥٢٠ms) ثمّ بعد أن يفرغ
                     خيطُ JS — فاللوحُ الواصلُ كان ظاهراً تحت الإصبع ومقفولاً عن اللمس كلَّ تلك المدّة. الموضعُ وحدَه يقرّر من يُلمس: ما خارج
                     الشاشة لا يبلغه إصبع، وفي الطيران تحرس `tabSwipeBlocksPress` أوّلَ `SWIPE_QUIET_MS` من ضغطاتِ ما يخرج (D-1497) */
                  style={{ position: "absolute", top: 0, bottom: 0, width, start: Math.max(0, order.indexOf(k)) * width }}
                >
                  {render(k, on)}
                </PaneBox>
              );
            })}
          </Reanimated.View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

/**
 * 🆕 D-1541 — **وجهةُ السحب لا يمسحها سحبٌ أقدم** (تسجيلُ أحمد ٢٣ أكتوبر في «اكتشف»: «الاشارة … تلخبط لثانية وترجع»، ثمّ «ب»): الخطُّ
 * يُضيء الوجهةَ لحظةَ رفع الإصبع (`onAim`) ويُمسح حين يتبدّل التبويب. سحبتان متتاليتان قبل أن يستقرّ طيرانُ الأولى: الأولى تستقرّ على
 * «أفلام» والثانيةُ أضاءت «مسلسلات» — فكان المسحُ يعيد الخطَّ إلى «أفلام» ثلثَ ثانيةٍ ثمّ يقفز (ثانية ٤١ من التسجيل). الآن يُمسح
 * إذا بلغ التبويبُ الوجهةَ نفسَها وحدَها؛ ووجهةٌ لم تُبلغ (طيرانٌ قُطع) تسقط وحدَها بعد `AIM_TTL_MS`. الشاشاتُ الأربع منه لا نسخٌ أربع.
 */
const AIM_TTL_MS = 900;
export function useTabAim<K extends string>(tab: K | null): [K | null, (k: K | null) => void] {
  const [aim, setAimState] = useState<K | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setAim = useCallback((k: K | null) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = k === null ? null : setTimeout(() => setAimState(null), AIM_TTL_MS);
    setAimState(k);
  }, []);
  useEffect(() => {
    setAimState((a) => (a === tab ? null : a));
  }, [tab]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return [aim, setAim];
}
