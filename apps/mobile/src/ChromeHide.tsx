import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

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
const MS = 200;

export function useChromeHide() {
  const hidden = useRef(new Animated.Value(0)).current;
  const st = useRef({ lastY: 0, acc: 0, hidden: false });
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setReduce(v); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => { live = false; sub.remove(); };
  }, []);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  const set = useCallback(
    (h: boolean) => {
      const s = st.current;
      if (s.hidden === h) return;
      s.hidden = h;
      Animated.timing(hidden, { toValue: h ? 1 : 0, duration: reduceRef.current ? 0 : MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
    },
    [hidden],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const s = st.current;
      /* قصُّ الارتداد — الحدّ ٣ */
      const max = Math.max(0, contentSize.height - layoutMeasurement.height);
      const y = Math.min(Math.max(contentOffset.y, 0), max);
      /* بعد `reveal()` لا مرجعَ للفرق (لوحٌ آخر بموضعه هو) — أوّلُ حدثٍ يثبّت المرجعَ فقط */
      const d = Number.isNaN(s.lastY) ? 0 : y - s.lastY;
      s.lastY = y;
      /* القمّةُ والقاع — الحدّان ٢ و٤ */
      if (y <= EDGE || max - y <= EDGE) {
        s.acc = 0;
        set(false);
        return;
      }
      if (d === 0) return;
      /* تراكمُ اتّجاهٍ واحد — الحدّ ١ */
      if (d > 0 !== s.acc > 0) s.acc = 0;
      s.acc += d;
      if (s.acc > HIDE_DX) set(true);
      else if (s.acc < -SHOW_DX) set(false);
    },
    [set],
  );

  /** «عُد إلى حال الرأس الآن» — يُصفّر التراكمَ أيضاً وإلّا عاد الإخفاءُ ببكسلاتٍ متبقّية */
  const reveal = useCallback(() => {
    st.current.acc = 0;
    st.current.lastY = NaN;
    set(false);
  }, [set]);

  return useMemo(() => ({ hidden, onScroll, reveal }), [hidden, onScroll, reveal]);
}
