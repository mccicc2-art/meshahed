import { useCallback, useMemo, useRef } from "react";
import { I18nManager, Platform, type FlatList, type StyleProp, type ViewStyle } from "react-native";

/**
 * ====== تثبيتُ الصفِّ الأفقيّ على أوّل بطاقة — الآيفون بالعربيّ (🆕 D-1478) ======
 *
 * **لماذا**: صفٌّ أفقيٌّ افتراضيّ (`FlatList` لا يرسم إلّا ما حول الإزاحة) يُبنى على الآيفون بالعربيّ فيقف في غير أوّله،
 * فلا يجد بطاقةً مرسومةً حيث يقف ويظهر فارغاً (مشعل في «اكتشف» D-1471، وأحمد في الملفّ الشخصيّ ١٩ أكتوبر).
 * الرجوعُ إلى الإزاحة صفر يعيده إلى أوّل بطاقة ويعيد حسابَ ما يُرسم — وفي صفٍّ سليمٍ لا يحرّك شيئاً.
 *
 * ⚠️ **صفرٌ لا `scrollToEnd`** (D-1476): في `ScrollView` الرئيسيّة تصير «النهاية» بدايةً بقلب Fabric (D-1459)،
 * أمّا هذه القائمةُ فنهايتُها نهايةٌ حقّاً — ونقلُ علاج الأولى إليها عرض الصفَّ مقلوباً.
 *
 * - مع كلِّ كِبَرٍ للمحتوى حتى يلمسه المستخدم (T606)، و`pin()` لمن يريد تثبيتاً آخر (اللوحُ الذي صار نشطاً في «اكتشف» — D-1475).
 * - **صفٌّ سحبه المستخدمُ لا يُعاد** إلى أوّله.
 * - **الأندرويدُ والإنجليزيُّ لا يمرّون هنا**: `props` فارغةٌ عندهما فالقائمةُ كما كانت حرفاً.
 *
 * نسخةٌ واحدةٌ لكلِّ الصفوف الافتراضيّة — صفٌّ جديدٌ يصيبه العطلُ يستعمل هذه، لا علاجاً ثانياً.
 */
export const IOS_RTL = Platform.OS === "ios" && I18nManager.isRTL;
const PIN_WINDOW_MS = 4000;

export function useRtlRailPin<T>(onDragStart?: () => void, onMomentumStart?: () => void) {
  const ref = useRef<FlatList<T>>(null);
  const touched = useRef(false);
  const sized = useRef(false);
  const drag = useRef(onDragStart);
  drag.current = onDragStart;
  const flick = useRef(onMomentumStart);
  flick.current = onMomentumStart;
  const pin = useCallback(() => {
    if (!touched.current && sized.current) ref.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);
  /* 🆕 T606 (أحمد ٢٨ نوفمبر بلقطة «اكتشف»: «القوائم أحياناً تبدأ من النص») — **التثبيتُ مع كلِّ كِبَرٍ للصفّ لا مرّةً واحدة**: صفوفٌ بلا
     `getItemLayout` (القوائم، والمجموعات، والمشابهات) تكبر بعد أوّل قياسٍ كلّما قيست بطاقة، والآيفونُ بالعربيّ يُبقي الإزاحةَ من
     اليسار فينزاح الصفُّ بطاقةً أو أكثر. الرجوعُ إلى الصفر لا يغيّر مقاسَ المحتوى فلا حلقة؛ وما لمسه المستخدمُ لا يُعاد */
  /* والإعادةُ في الثواني الأولى وحدَها (`PIN_WINDOW_MS`): فيها تُقاس البطاقاتُ وينزاح الصفّ؛ وبعدها كلُّ رجوعٍ يُطلق نهايةَ تمريرٍ
     تُربك قياسَ تقطّع الصفوف (`scrollJank` — مفتاحٌ واحدٌ لصفوف الشاشة) بلا فائدة (مراجعةُ وكيل الآيفون) */
  const firstAt = useRef(0);
  const onContentSizeChange = useCallback(
    (w: number) => {
      if (w <= 0) return;
      const now = Date.now();
      if (!sized.current) firstAt.current = now;
      else if (now - firstAt.current > PIN_WINDOW_MS) return;
      sized.current = true;
      pin();
    },
    [pin],
  );
  const onScrollBeginDrag = useCallback(() => {
    touched.current = true;
    drag.current?.();
  }, []);
  /* دفعةُ الإصبع لمسٌ أيضاً — لا يُعاد الصفُّ تحت يد من يمرّره (قارئُ الشاشة لا يُطلقها؛ نافذةُ الثواني الأولى تحدّ أثرَه) */
  const onMomentumScrollBegin = useCallback(() => {
    touched.current = true;
    flick.current?.();
  }, []);
  const props = useMemo(
    () => (IOS_RTL ? { ref, onContentSizeChange, onScrollBeginDrag, onMomentumScrollBegin } : null),
    [onContentSizeChange, onScrollBeginDrag, onMomentumScrollBegin],
  );
  return { pin, props };
}

/**
 * 🆕 T606 (تسجيلُ أحمد ٢٨ نوفمبر: عملٌ واحدٌ في «مسلسلات» يلتصق باليسار ثمّ يقفز) — **الصفُّ القصيرُ يبدأ من اليمين**.
 * على الآيفون بالعربيّ يوضع محتوى الصفِّ الأقصرُ من الشاشة في يسارها؛ `flexGrow: 1` يجعله بعرض الشاشة على الأقلّ فيبدأ من أوّله.
 * يُلفّ به `contentContainerStyle` لكلِّ صفّ (لا في `props` الخطّاف: ترتيبُ النشر يختلف بين الصفوف فيمحو أو يُمحى).
 * ⚠️ لا لصفٍّ بهوامش سالبة على محتواه (صفُّ الممثّلين): يكبر عن الشاشة فيُمرَّر بلا داعٍ.
 */
const GROW: ViewStyle = { flexGrow: 1 };
export function railGrow(base: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  return IOS_RTL ? [base, GROW] : base;
}
