import React, { useEffect, useState } from "react";
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
 */
const SIZE = 150;
const LIGHT = require("../../assets/loopz-draw-light.webp");
const DARK = require("../../assets/loopz-draw-dark.webp");

export function Preparing({ label }: { label: string }) {
  const { tokens, themeId } = useApp();
  const [still, setStill] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setStill(on);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ flex: 1, backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center" }}>
      {still ? (
        <Logo size={SIZE} />
      ) : (
        <Image source={statusBarStyleOf(themeId) === "dark" ? DARK : LIGHT} style={{ width: SIZE, height: SIZE }} contentFit="contain" autoplay cachePolicy="memory" />
      )}
    </View>
  );
}
