import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import { noteChrome, noteScroll } from "./perfMarks";

/**
 * ====== الكسوةُ الذكيّة في الشاشات الأصليّة — D-966 (١٤ سبتمبر ٢٠٢٦) ======
 *
 * **بلاغُ أحمد بتسجيل**: «في الهوم إذا نزلت تحت، الدوك واللي فوق يختفي، وإذا
 * طلعت فوق يرجع. في المكتبة لا يختفي، وفي الديسكفر أيضاً — أبغى المكتبة
 * واكتشف نفس الشيء». **والفرقُ في التسجيل ظاهر**: الويبُ يحمل `ChromeAutoHide`
 * منذ ١٩ أغسطس، **والشاشتان الأصليّتان ثابتتا الكسوة** — فتطبيقٌ يخفي ترويستَه
 * في صفحةٍ ويثبّتها في التي تليها يُقرأ مكسوراً (درسُ D-961 نفسُه).
 *
 * 🔑 **الحدودُ الخمسةُ حدودُ `ChromeAutoHide.tsx` حرفاً لا اجتهادٌ ثانٍ** (D-145):
 * ١ · **عتبةُ اتّجاهٍ لا حركة**: المسافةُ تتراكم في اتّجاهٍ واحد وتغييرُه يصفّرها —
 *     النزولُ ٢٨px متّصلة، والرجوعُ ١٢ (أرخص: المستخدم يطلب أدواتِه).
 * ٢ · **قربَ القمّة (≤ ٢٤) ظاهرةٌ دائماً** — لا تُفتح شاشةٌ وترويستُها غائبة.
 * ٣ · **الارتدادُ لا يُقرأ**: `y` تُقصّ إلى `[0, أقصى تمرير]` قبل حساب الفرق.
 * ٤ · **قربَ القاع (≤ ٢٤) كذلك** (D-506): دوكٌ مختبئٌ يترك مقعدَه فراغاً.
 * ٥ · **الإخفاءُ `transform` خالص** بمحرّك الحركة الأصليّ — لا يتغيّر ارتفاعُ
 *     شيءٍ فلا يقفز المحتوى ولا يتحرّك موضعُ التمرير. والمدّةُ ٢٠٠م.ث `ease`
 *     كما في `globals.css`، **وصفرٌ حين يطلب النظامُ تقليلَ الحركة** (`08`).
 *
 * 🔑 **والقيمةُ واحدةٌ لكسوتين**: `hidden` (٠..١) يقرؤها الرأسُ صاعداً بارتفاعه
 * والشريطُ هابطاً بارتفاعه — **مالكٌ واحدٌ وحقيقةٌ واحدة** (D-524)، **وبابُ
 * `reveal()` يُنادى عند قلب التبويب** كما ينادي الويبُ `revealChrome()` عند سحبة
 * التبويبات — وإلّا انزلقت الكسوةُ بعد أن استقرّ كلُّ شيء (الرمشةُ التي بلّغ عنها).
 */
const HIDE_DX = 28;
const SHOW_DX = 12;
const EDGE = 24;
/**
 * 🆕 D-1432 — **الكسوةُ تتبع الإصبع** (أحمد ١٦ أكتوبر بتسجيلٍ يقارن لوبز بـX: «سريع في الظهور… ماهو مثل تطبيق اكس ناعم
 * و مرن و تحسه يمشي معك»؛ وحكمُه «٢ أ»: كلُّ الشاشات). كانت عتبةً ثمّ حركةً جاهزة: ٢٨px فتختفي الكسوةُ كلُّها في ٢٠٠م.ث
 * مهما كانت سرعةُ الإصبع — فتُرى قفزة. الآن كلُّ بكسلٍ تمرّره يُخفي من الكسوة بقدره (`FOLLOW_PX` لاختفائها كاملة)،
 * وإن وقف التمريرُ في المنتصف وقفت معه، ثمّ تكمل إلى أقرب حالٍ بنابضٍ ناعم بعد `SETTLE_MS` بلا حدث.
 * - **لا تُخفى أكثرَ ممّا مُرِّر من القمّة** (`off ≤ y`): قربَ القمّة تظهر بقدر ما بقي — الحدُّ ٢ صار تدرّجاً لا قفزة.
 * - **القاعُ (الحدّ ٤) والارتدادُ (٣) كما كانا**؛ و**«تقليلُ الحركة» يعيد السلوكَ القديم بلا مدّة** (`08`).
 * - ⚖️ يجري على خيط JS مع كلِّ حدث تمرير (`scrollEventThrottle` ١٦) لا على الخيط الأصليّ: الألواحُ في ثلاث شاشاتٍ
 *   مكوّناتٌ كثيرةٌ تمرّر `onScroll` عاديّة، ونقلُها كلِّها إلى `Animated.event` تغييرٌ واسعٌ لا تحتاجه الخطوةُ الأولى.
 *   النابضُ وحده على الخيط الأصليّ. إن ظهر تأخّرٌ على أندرويد تحت الحمل فهذا هو المكانُ الذي يُنقل.
 */
const FOLLOW_PX = 72;
const SETTLE_MS = 120;
/**
 * 🆕 D-1629 — **الكسوةُ على محرّكٍ واحد: Reanimated** (تسجيلا خالد ٢ نوفمبر، S24U، وقياسُ T304).
 * **الشرطُ المثبت** (٤ من ٤ في التسجيلين): يُفتح عملٌ والرأسُ والدوكُ مخفيّان بالتمرير ⇒ بعد الرجوع **الرأسُ (بتبويباته) والدوكُ
 * ميّتان** والبطاقاتُ والتمريرُ بينهما حيّة؛ ويعودان بفتح عملٍ والكسوةُ ظاهرة ثمّ الرجوع. ونفى `T304` قفلَ السحب والسحباتِ
 * المعلّقة ومستجيبَ الألواح (`sw=0 pd=0 rh=0`)، **وقاس الدوكَ عند ٨٨٨ من ٨٩١ وهو مرسومٌ ظاهراً** (موضعُه ٨١٤): ما يُرسم غيرُ ما
 * تُحسب عليه اللمسة. **والسببُ في هذا الملفّ**: قيمةٌ واحدةٌ (`Animated.Value`) يكتبها JS مع كلِّ بكسل (D-1432) ويحرّكها النابضُ
 * على المحرّك الأصليّ — والمحرّكُ الأصليّ في المعماريّة الجديدة يحرّك المنظرَ ولا يكتب في شجرة التخطيط التي تُحسب عليها اللمسات
 * والقياس. (أنّ هذا هو مسارُ التفرّق بالضبط داخل React Native استنتاجٌ؛ الشرطُ والمناطقُ الميتةُ وقراءةُ ٨٨٨ مثبتة.)
 * 🔑 **الآن قيمةٌ مشتركةٌ (`SharedValue`) يكتبها التمريرُ والنابضُ معاً**، وReanimated يُثبت كلَّ إطارٍ في شجرة التخطيط نفسِها
 * (`ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` مطفأ) — كما تفعل ألواحُ التبويبات (`TabSlide`) التي لم تمت لمستُها قطّ. الحدودُ
 * الخمسةُ وتتبّعُ الإصبع والنابضُ بأرقامه كما هي حرفاً: الإحساسُ لا يتغيّر، تغيّر المحرّكُ وحده.
 */
const SPRING = { damping: 26, stiffness: 260, mass: 1, overshootClamping: true } as const;

export type ChromeHidden = SharedValue<number>;

export function useChromeHide() {
  const hidden = useSharedValue(0);
  const st = useRef({ lastY: 0, acc: 0, hidden: false, off: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setReduce(v); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => { live = false; sub.remove(); };
  }, []);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  useEffect(() => () => { if (st.current.timer) clearTimeout(st.current.timer); }, []);

  /** إلى حالٍ كاملة — نابضٌ على الخيط الأصليّ (أو فوراً مع تقليل الحركة) */
  const set = useCallback(
    (h: boolean) => {
      const s = st.current;
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
      s.hidden = h;
      s.off = h ? FOLLOW_PX : 0;
      /* 🩺 D-1536 — ما يطلبه JS للكسوة، ليُقارَن بما يراه أحمد في `edge.tap` */
      noteChrome(h ? 1 : 0);
      hidden.value = reduceRef.current ? (h ? 1 : 0) : withSpring(h ? 1 : 0, SPRING);
    },
    [hidden],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      /* 🩺 D-1505 — مسجّلُ التعليق يعرف أنّ الصفحةَ كانت تُمرَّر لحظةَ ضغطة الدوك */
      noteScroll();
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const s = st.current;
      /* قصُّ الارتداد — الحدّ ٣ */
      const max = Math.max(0, contentSize.height - layoutMeasurement.height);
      const y = Math.min(Math.max(contentOffset.y, 0), max);
      /* بعد `reveal()` لا مرجعَ للفرق (لوحٌ آخر بموضعه هو) — أوّلُ حدثٍ يثبّت المرجعَ فقط */
      const d = Number.isNaN(s.lastY) ? 0 : y - s.lastY;
      s.lastY = y;
      /* القاعُ — الحدّ ٤: دوكٌ مختبئٌ يترك مقعدَه فراغاً */
      if (max - y <= EDGE && max > EDGE) {
        s.acc = 0;
        if (s.hidden || s.off > 0) set(false);
        return;
      }
      if (reduceRef.current) {
        /* السلوكُ القديم بلا حركة: عتبةُ اتّجاهٍ ثمّ حالٌ كاملة */
        if (y <= EDGE) { s.acc = 0; if (s.hidden) set(false); return; }
        if (d === 0) return;
        if (d > 0 !== s.acc > 0) s.acc = 0;
        s.acc += d;
        if (s.acc > HIDE_DX && !s.hidden) set(true);
        else if (s.acc < -SHOW_DX && s.hidden) set(false);
        return;
      }
      if (d === 0 && s.off <= y) return;
      const off = Math.min(Math.max(s.off + d, 0), FOLLOW_PX, y);
      if (off !== s.off) {
        s.off = off;
        s.hidden = off >= FOLLOW_PX;
        hidden.value = off / FOLLOW_PX;
        noteChrome(off / FOLLOW_PX);
      }
      /* توقّف التمريرُ (إصبعٌ رُفع أو زخمٌ انتهى) والكسوةُ في المنتصف: تكمل إلى الأقرب */
      if (s.timer) clearTimeout(s.timer);
      s.timer = setTimeout(() => {
        s.timer = null;
        if (s.off > 0 && s.off < FOLLOW_PX) set(s.off > FOLLOW_PX / 2 && s.lastY > FOLLOW_PX);
      }, SETTLE_MS);
    },
    [hidden, set],
  );

  /** «عُد إلى حال الرأس الآن» — يُصفّر التراكمَ أيضاً وإلّا عاد الإخفاءُ ببكسلاتٍ متبقّية */
  const reveal = useCallback(() => {
    st.current.acc = 0;
    st.current.lastY = NaN;
    set(false);
  }, [set]);

  return useMemo(() => ({ hidden, onScroll, reveal }), [hidden, onScroll, reveal]);
}

/**
 * 🆕 D-1629 — **الرأسُ المختبئ** في الشاشات الثلاث (اكتشف · المكتبة · المجتمع): مطلقٌ فوق الألواح ويصعد بارتفاعه `lift` مع
 * الكسوة. واحدٌ للثلاث بدلَ ثلاث نسخٍ من `Animated.View` + `Animated.multiply` (القاعدة ٣).
 */
export function ChromeTop({
  hidden,
  lift,
  onLayout,
  style,
  children,
}: {
  hidden: ChromeHidden;
  lift: number;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: -hidden.value * lift }] }), [hidden, lift]);
  return (
    <Reanimated.View onLayout={onLayout} style={[style, motion]}>
      {children}
    </Reanimated.View>
  );
}
