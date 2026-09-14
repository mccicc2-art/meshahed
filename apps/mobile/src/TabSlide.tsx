import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, I18nManager, PanResponder, useWindowDimensions, View, type ViewStyle } from "react-native";

/**
 * ====== انزلاقُ التبويبات — D-961 (١٤ سبتمبر ٢٠٢٦) ======
 *
 * **بلاغُ أحمد بتسجيل**: «اجعل الموشن في التنقّل بين الأفلام والمسلسلات… داخل
 * المكتبة واكتشف مثل التنقّل في المجتمع». **والفرقُ في التسجيل ظاهرٌ بالعين**:
 * تبويبا المجتمع (ويب) ينزلقان تحت الإصبع (`TabPager` — D-522 → D-533)،
 * **والشاشتان الأصليّتان تُبدّلان المحتوى بلا حركةٍ أصلاً** — السحبُ يعمل منذ
 * D-953 لكنّه **قفزةٌ لا انتقال**.
 *
 * 🔑 **والأرقامُ أرقامُ `TabPager` نفسُها لا اجتهادٌ ثانٍ** (D-145): `FLY_MS`
 * ٥٢٠ · `SNAP_MS` ٣٦٠ · `cubic-bezier(.32,.72,0,1)` — **مضبوطةٌ على هاتف أحمد
 * ولا تُعاد معايرتُها من حاسوب** (تحذيرُ `06` في موضعه). وعتباتُ الالتقاط
 * (٢٠px قبل السؤال · ١٫٦ ميلاً · ٥٦px أو ٠٫٤ سرعةً للحسم) **هي عتباتُ D-953
 * حرفاً** — الآليّةُ التي أثبتت أنّها لا تسرق سحبَ الصفوف الأفقيّة.
 *
 * ⚖️ **وما يفترق فيه عن الويب، ويُكتب فجوةً لا يُدَّعى** (D-063): **الويبُ
 * يُسلّح الجارَ عند قفل الإيماءة** (D-523) فيراه الإصبعُ محتوًى كاملاً؛ **وهنا
 * الجارُ هيكلٌ** (`peek`) لأنّ محتوى التبويب الأصليَّ لا يُبنى إلّا بنداءاته —
 * **ومَن يبني لوحين كاملين في شاشةٍ واحدةٍ يدفع ثمنَ ذلك في الأداء** (Phase 11،
 * والقياسُ A0 لم يُؤخذ بعد). **فالمعروضُ تحت الإصبع بنيةُ اللوح القادم، ومحتواه
 * يحلّ محلَّها لحظةَ الاستقرار.** ومن أراد الجارَ حيّاً فذاك تقسيمُ الشاشتين إلى
 * ألواحٍ لكلِّ تبويب — جولةٌ مستقلّةٌ تُطلب.
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
  peek,
  style,
  children,
}: {
  /** مفاتيحُ التبويبات بترتيب ظهورها — المخفيُّ لا يُذكر فلا يُزار */
  order: readonly K[];
  tab: K;
  onTab: (next: K) => void;
  /** هيكلُ اللوح القادم يُرسم تحت الإصبع (انظر الفجوةَ في رأس الملفّ) */
  peek?: React.ReactNode;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  /* الاتّجاهُ فيزيائيٌّ لا لغويّ: «التالي» في جهة النهاية — يساراً في LTR ويميناً في RTL */
  const phys = I18nManager.isRTL ? -1 : 1;
  const x = useRef(new Animated.Value(0)).current;
  const [peeking, setPeeking] = useState<0 | 1 | -1>(0);
  const peekRef = useRef<0 | 1 | -1>(0);
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

  const clearPeek = useCallback(() => {
    peekRef.current = 0;
    setPeeking(0);
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => !busy.current && Math.abs(g.dx) > LOCK_DX && Math.abs(g.dx) > TILT * Math.abs(g.dy),
        onPanResponderTerminationRequest: () => true,
        onPanResponderMove: (_, g) => {
          const s = st.current;
          const i = s.order.indexOf(s.tab);
          const dir: 1 | -1 = g.dx * s.phys < 0 ? 1 : -1;
          const has = i >= 0 && !!s.order[i + dir];
          if (has && peekRef.current !== dir) {
            peekRef.current = dir;
            setPeeking(dir);
          }
          x.setValue(has ? Math.max(-s.width, Math.min(s.width, g.dx)) : g.dx * RUBBER);
        },
        onPanResponderRelease: (_, g) => {
          const s = st.current;
          const i = s.order.indexOf(s.tab);
          const dir: 1 | -1 = g.dx * s.phys < 0 ? 1 : -1;
          const next = i >= 0 ? s.order[i + dir] : undefined;
          if (next && (Math.abs(g.dx) >= COMMIT_DX || Math.abs(g.vx) >= COMMIT_VX)) {
            /* الطيرانُ ثمّ القلب: **اللوحُ يخرج كاملاً قبل أن يتبدّل**، وإلّا رأى القارئُ
               محتوى التبويبين في إطارٍ واحد (درسُ D-526: القلبُ على نهاية الحركة). */
            rest(-dir * s.phys * s.width, FLY_MS, () => {
              skip.current = true;
              onTabRef.current(next);
              x.setValue(0);
              clearPeek();
            });
            return;
          }
          rest(0, SNAP_MS, clearPeek);
        },
        onPanResponderTerminate: () => rest(0, SNAP_MS, clearPeek),
      }),
    [x, rest, clearPeek],
  );

  /* الضغطةُ على تبويبٍ (أو أيُّ تبديلٍ من الخارج) تدخل اللوحَ من جهته */
  const prev = useRef(tab);
  useEffect(() => {
    if (prev.current === tab) return;
    const from = order.indexOf(prev.current);
    const to = order.indexOf(tab);
    prev.current = tab;
    if (skip.current) {
      skip.current = false;
      return;
    }
    if (from < 0 || to < 0) return;
    x.setValue((to > from ? 1 : -1) * phys * width);
    Animated.timing(x, { toValue: 0, duration: FLY_MS, easing: EASE, useNativeDriver: true }).start();
  }, [tab, order, phys, width, x]);

  return (
    <View style={[{ flex: 1, overflow: "hidden" }, style]} {...pan.panHandlers}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: x }] }}>
        {children}
        {peeking !== 0 && peek ? (
          <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, width, left: peeking * phys * width }}>
            {peek}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
