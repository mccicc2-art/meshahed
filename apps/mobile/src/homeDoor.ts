import { useCallback } from "react";
import { useNavigation, useRouter } from "expo-router";
import { haptic } from "./haptics";

/**
 * ====== 🆕 D-1611 — بابُ «الرئيسيّة» بضغطةٍ واحدة ======
 *
 * أحمد ٣١ أكتوبر بتسجيل: مراجعة ← عمل ← ملفُّ شخصيّة ← عمل ← ملفُّها… ثمّ «رجوع» مرّةً بعد مرّة — «احتاج طريقة ارجع الهوب بسرعه
 * بظغطة زر». البابُ **شعارُ لوبز في رأس الصفحة + الضغطُ المطوّل على زرّ الرجوع** («٢ أ»).
 * 🆕 D-1611b — **إلى الرئيسيّة دائماً** (أحمد بعد التجربة: «لا أنا ابغاه يرجعني للهوم فقط» — نقضُ «١ أ»: التبويبُ الذي بدأ منه).
 * 🔑 **لا `dismissAll`**: قاعدةُ المكدّس `/web` (طبقةُ الويب، `app/web.tsx`) لا مجموعةُ التبويبات — `dismissAll` كان يكشفها هي.
 *   فنُنزل ما فوق مجموعة التبويبات وحدَه (`dismiss(n)` بعددهم من حالة المكدّس الجذر) ثمّ ننتقل إلى تبويب الرئيسيّة؛ وإن لم تكن
 *   المجموعةُ في المكدّس (صفحةٌ فُتحت من الويب) فالانتقالُ وحدَه يرفعها على الرئيسيّة.
 *   نقرةُ الاهتزاز تقول إنّ الضغطة المطوّلة فُهمت (D-1043: الضغطُ المطوّلُ لا يكون صامتاً).
 */
export function useHomeDoor(): () => void {
  const router = useRouter();
  const navigation = useNavigation();
  return useCallback(() => {
    haptic.pick();
    const st = navigation.getState();
    const at = st ? st.routes.findIndex((r) => r.name === "(tabs)") : -1;
    const above = st && at >= 0 ? st.index - at : 0;
    if (above > 0) router.dismiss(above);
    router.navigate("/home");
  }, [router, navigation]);
}
