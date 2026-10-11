import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { Image } from "expo-image";
import { Logo } from "../Logo";
import { useApp } from "../state";
import { statusBarStyleOf } from "../theme";

/**
 * ====== شاشةُ التجهيز — الشعارُ يُرسم على مساره (D-1348) ======
 *
 * طلبُ أحمد ١٠ أكتوبر (بخمس معايناتٍ حتى اعتمدها): «بدل جاري التجهيز شعار لوبز وانميشن للشعار» ← «ابغاه يتحرك
 * على شكل الشعار» ← «وتكتمل» ← «طابق الشعار بشكل ممتاز وخلي يبدا الخط البارز بعدين المدسوس».
 *
 * 🔑 **صورةٌ متحرّكةٌ جاهزة لا رسمٌ في التطبيق**: الحركةُ مولَّدةٌ من بكسلات `loopz-mark.png` نفسِها
 * (`scripts/logo-draw/`: لكلِّ بكسلٍ موضعُه على المسار — البارزُ فالحلقةُ اليمنى فالمدسوسُ فاليسرى)، فما اعتُمد في
 * المعاينة هو ما يُعرض حرفاً. رسمُها حيّاً يحتاج قناعاً أو مكتبةَ متّجهاتٍ ليستا في التطبيق (بناءٌ أصليّ)، وبنقاطٍ
 * متراصّةٍ لا يطابق حوافَّ الشعار. الدورةُ ٣٫١٨ث: رسمٌ ١٫٥ · ثباتٌ ٠٫٥ · محوٌ ١٫٠ بالترتيب نفسِه.
 *
 * ⚖️ **نسختان لا تلوين**: `tintColor` على صورةٍ متحرّكةٍ غيرُ مجرَّبٍ على المنصّتين — بيضاءُ للثيمات الداكنة وداكنةٌ
 * للنهاريّ، والاختيارُ بسؤال شريط الحالة نفسِه (`statusBarStyleOf`). ومن أطفأ الحركةَ في جهازه يرى الشعارَ ثابتاً.
 *
 * 🆕 D-1350 — **`once`: يُرسم مرّةً ثمّ يثبت** (بعد الدخول، قرارُ أحمد ١١ أكتوبر: «الشعار يكمل رسمه دائماً ثم يدخل»).
 * الصورةُ المتحرّكةُ دورةٌ تمحو ما رسمته، ولا تقول متى اكتمل الرسم — فمؤقّتٌ يبدأ من ظهورها (`onDisplay`) يبدّلها في
 * نافذة الثبات (١٫٥–٢٫٠ث، في وسطها) بالرمز الثابت في الصندوق نفسِه، ثمّ ينادي `onDrawn`. **الرمزُ هنا صورةٌ بقياس
 * الصندوق لا `Logo`**: ذاك يحجز مكانَ الزائدة عن يمينه فينزاح مركزُه عن مركز الحركة.
 */
const SIZE = 150;
const LIGHT = require("../../assets/loopz-draw-light.webp");
const DARK = require("../../assets/loopz-draw-dark.webp");
const MARK = require("../../assets/loopz-mark.png");
/** الرسمُ ١٫٥ث والثباتُ بعده ٠٫٥ث: التبديلُ في وسط الثبات يحتمل ربعَ ثانيةٍ من فرق التوقيت في الاتّجاهين */
const DRAWN_MS = 1750;
/** الصورةُ لم تُعلن ظهورَها (مفكِّكٌ تعثّر) ⇒ لا ننتظرها أكثر من هذا قبل بدء العدّ */
const DISPLAY_WAIT_MS = 600;

export function Preparing({ label, once = false, onDrawn }: { label: string; once?: boolean; onDrawn?: () => void }) {
  const { tokens, themeId } = useApp();
  const [still, setStill] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const drawnRef = useRef(onDrawn);
  drawnRef.current = onDrawn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);
  /* العدُّ يبدأ مرّةً: من ظهور الصورة، أو من مهلة انتظارها إن لم تُعلن */
  const start = (ms: number) => {
    if (!once || started.current) return;
    started.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDrawn(true);
      drawnRef.current?.();
    }, ms);
  };
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (!alive) return;
        setStill(on);
        /* بلا حركة: الشعارُ كاملٌ من أوّل رسمة — «اكتمل» فوراً */
        if (on && once && !started.current) {
          started.current = true;
          drawnRef.current?.();
        }
      })
      .catch(() => {});
    if (once) timer.current = setTimeout(() => start(DRAWN_MS), DISPLAY_WAIT_MS);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dark = statusBarStyleOf(themeId) === "dark";
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ flex: 1, backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center" }}>
      {still ? (
        <Logo size={SIZE} />
      ) : drawn ? (
        <Image source={MARK} style={{ width: SIZE, height: SIZE, tintColor: dark ? "#050505" : "#FFFFFF" }} contentFit="contain" />
      ) : (
        <Image source={dark ? DARK : LIGHT} style={{ width: SIZE, height: SIZE }} contentFit="contain" autoplay cachePolicy="memory" onDisplay={() => start(DRAWN_MS)} />
      )}
    </View>
  );
}
