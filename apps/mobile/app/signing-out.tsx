import React, { useEffect, useRef } from "react";
import { BackHandler } from "react-native";
import { useApp } from "../src/state";
import { session } from "../src/session";
import { shell } from "../src/shell";
import { Preparing } from "../src/welcome/Preparing";

/**
 * ====== الخروج — شاشةُ التجهيز حتى يكتمل رسمُ الشعار، ثمّ شاشةُ الدخول (🆕 D-1371) ======
 *
 * تسجيلُ خالد (١١ أكتوبر، بعد V-D): الضغطُ على «خروج» يُنزل الإعدادات فتنكشف الرئيسيّةُ ربعَ ثانيةٍ قبل أن تُرفع شاشةُ
 * الدخول — لأنّها كانت لا تُرفع إلّا حين يبلّغ المتصفّحُ الداخليُّ وصولَ عنوان الخروج. اقتراحُ أحمد: «شاشة جاري الانتظار
 * الخاصة بلوبز وقت تسجيل الخروج»، ثمّ «12 أ» (للجميع) والمدّةُ حتى يكتمل الرسم (قرارُه في الدخول: «الشعار يكمل رسمه
 * دائماً ثم يدخل» — D-1350)، **و«بدّل الحساب» في الترحيب كما هو** («خله نفس ما هو افضل»).
 *
 * 🔑 **الترتيب**: تُدفع هذه فوق ما تحتها (بلا حركة — لا شيءَ ينكشف)، فيُرسل طلبُ الخروج بطريقه المجرَّب (`shell.post` —
 * D-1156) **وتُمسح جلسةُ التطبيق محلّيّاً الآن**: إن فشل الطلب (بلا شبكة) يخرج صاحبُه من جهازه كما طلب، بدل ضغطةٍ لا تفعل
 * شيئاً؛ وجلسةُ الويب الباقيةُ يستبدلها الدخولُ التالي. `leaveHold` يُسكت رفعَ شاشة الدخول من أحداث المتصفّح حتى يكتمل
 * الرسم — وإلّا قطعته في منتصفه. الرسمُ يُعلن اكتمالَه دائماً (مؤقّتُ `Preparing` لا ينتظر الصورة أكثر من ٠٫٦ث).
 */
export default function SigningOut() {
  const { t } = useApp();
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      shell.leaveHold = true;
      /* الطلبُ قبل المسح: `WebLayer` يعلّم «خروجٌ من الغلاف» عنده، فلا يُقرأ سقوطُ الجلسة المملوكة بعده «جلسةٌ ضاعت» (V-D) */
      shell.post("/auth/signout");
      session.signOut();
    }
    /* لا رجوعَ من منتصف الخروج */
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);
  return <Preparing label={t.signOut} once onDrawn={() => shell.leaveDone()} />;
}
