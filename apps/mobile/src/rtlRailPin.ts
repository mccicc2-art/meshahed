import { useCallback, useMemo, useRef } from "react";
import { I18nManager, Platform, type FlatList } from "react-native";

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
 * - مرّةً عند أوّل قياسٍ للمحتوى، و`pin()` لمن يريد تثبيتاً آخر (اللوحُ الذي صار نشطاً في «اكتشف» — D-1475).
 * - **صفٌّ سحبه المستخدمُ لا يُعاد** إلى أوّله.
 * - **الأندرويدُ والإنجليزيُّ لا يمرّون هنا**: `props` فارغةٌ عندهما فالقائمةُ كما كانت حرفاً.
 *
 * نسخةٌ واحدةٌ لكلِّ الصفوف الافتراضيّة — صفٌّ جديدٌ يصيبه العطلُ يستعمل هذه، لا علاجاً ثانياً.
 */
export const IOS_RTL = Platform.OS === "ios" && I18nManager.isRTL;

export function useRtlRailPin<T>(onDragStart?: () => void) {
  const ref = useRef<FlatList<T>>(null);
  const touched = useRef(false);
  const sized = useRef(false);
  const drag = useRef(onDragStart);
  drag.current = onDragStart;
  const pin = useCallback(() => {
    if (!touched.current && sized.current) ref.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);
  const onContentSizeChange = useCallback(
    (w: number) => {
      if (sized.current || w <= 0) return;
      sized.current = true;
      pin();
    },
    [pin],
  );
  const onScrollBeginDrag = useCallback(() => {
    touched.current = true;
    drag.current?.();
  }, []);
  const props = useMemo(() => (IOS_RTL ? { ref, onContentSizeChange, onScrollBeginDrag } : null), [onContentSizeChange, onScrollBeginDrag]);
  return { pin, props };
}
