import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "./state";

/**
 * ====== شعارُ Loopz في رؤوس الشاشات الأصليّة — D-1022 (١٨ سبتمبر ٢٠٢٦) ======
 *
 * طلبُ أحمد: «فوق يسار أبغى شعار لوبز مثل ما هو ظاهر في الويب… وفي اكتشف والمكتبة أيضاً».
 * **الرمزُ نفسُه** (`public/loopz-mark.png` منسوخاً إلى الأصول — لا رسمٌ ثانٍ، D-145)
 * **والزائدةُ نفسُها**: مربّعان متقاطعان بعد الحافّة اليمنى وفوق أعلى الحلقات، بأبعاد
 * `Logo.tsx` الويب (`MARK_H` · `MARK_RIGHT` · `MARK_TOP`) — تظهر لمن هو Plus أو شريك.
 */
const MARK_H = 0.422;
const MARK_RIGHT = 0.918;
const MARK_TOP = 0.287;

export function Logo({ size = 28 }: { size?: number }) {
  const { me, tokens } = useApp();
  const plus = !!(me?.plus || me?.partner);
  const H = size * MARK_H;
  const side = H * 0.3;
  const gap = H * 0.07;
  const rise = H * 0.08;
  const left = size * MARK_RIGHT + gap;
  const top = size * MARK_TOP - rise;
  const bar = side * 0.24;
  return (
    <View style={{ width: left + side, height: size }}>
      <Image source={require("../assets/loopz-mark.png")} style={{ width: size, height: size, tintColor: tokens.fg }} contentFit="contain" />
      {plus ? (
        <View style={{ position: "absolute", left, top, width: side, height: side }}>
          <View style={{ position: "absolute", left: (side - bar) / 2, top: 0, width: bar, height: side, backgroundColor: tokens.accent }} />
          <View style={{ position: "absolute", top: (side - bar) / 2, left: 0, width: side, height: bar, backgroundColor: tokens.accent }} />
        </View>
      ) : null}
    </View>
  );
}
