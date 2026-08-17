"use client";

import { useEffect, useState } from "react";

/**
 * **كم يحجب الكيبوردُ من الشاشة الآن؟** (D-359 — مُخرَجٌ من `KeyboardDock`
 * عند قارئه الثاني).
 *
 * ================= لماذا خرج =================
 *
 * وُلد هذا القياسُ داخل `ThreadReplies` لمرسى صندوق الكتابة (D-320)،
 * **وجاء قارئُه الثاني ببلاغ أحمد**: «إذا ضغطت على خيار رد ليه يطلع
 * الدوك الي تحت الى فوق الكيبورد» — **فشريطُ التنقّل والقلمُ العائم
 * يحتاجان الجوابَ نفسَه.** **ومكوّنٌ يُخرَج عند قارئه الثاني لا قبله**
 * (D-002)، **ونسخُ القياس كان سيعني رقمين يفترقان يوماً** (D-145).
 *
 * ================= ولماذا `visualViewport` لا غيرُها =================
 *
 * **عناصرُ `fixed` مربوطةٌ بنافذة التخطيط، والكيبوردُ يقصّ النافذة
 * المرئيّة وحدَها** — فحتى `fixed bottom-0` يغرق خلفه على iOS. **والفرق
 * هو الحقيقة**: `innerHeight − visualViewport.height − offsetTop`.
 *
 * ⚠️ **وعتبةُ ٦٠px تُسقط تنفُّسَ أشرطة المتصفّح** (شريطُ العنوان يطول
 * ويقصر مع التمرير فيُنتج فرقاً صغيراً دائماً) — **ورقمٌ يتبدّل مع كلِّ
 * تمريرةٍ ليس «كيبورداً مفتوحاً»**.
 *
 * ⚠️ **والانتظارُ حدثٌ لا مؤقّت** (D-250): `resize` و`scroll` على النافذة
 * المرئيّة، **ولا استطلاعَ دوريّ.**
 *
 * ⚠️ **ويبدأ صفراً على الخادم وعند أوّل رسمة** — فلا فرقَ بين رسمة
 * الخادم ورسمة العميل يكسر الترطيب، **والحالةُ الابتدائيّة هي السلوكُ
 * القائم** (D-152).
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const read = () => {
      const vv = window.visualViewport;
      setInset(vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0);
    };
    read();
    const vv = window.visualViewport;
    window.addEventListener("resize", read);
    vv?.addEventListener("resize", read);
    vv?.addEventListener("scroll", read);
    return () => {
      window.removeEventListener("resize", read);
      vv?.removeEventListener("resize", read);
      vv?.removeEventListener("scroll", read);
    };
  }, []);
  return inset;
}

/** العتبةُ التي تفصل كيبورداً مفتوحاً عن تنفُّس أشرطة المتصفّح */
export const KEYBOARD_MIN = 60;

/**
 * **هل الكيبوردُ مفتوحٌ الآن؟**
 *
 * **وقارئوه يُخفون أنفسَهم به**: شريطُ التنقّل والقلمُ العائم — **وأداةٌ
 * لا تُستعمل الآن تُزاحم ما يُستعمل** (D-138 من جهتها الثانية): الكيبوردُ
 * يأكل نصفَ الشاشة، **وما يبقى يجب أن يكون ما تكتب فيه وأدواتِه لا
 * وجهاتِ سفرٍ لن تُضغط الآن.**
 */
export function useKeyboardOpen(): boolean {
  return useKeyboardInset() > KEYBOARD_MIN;
}
