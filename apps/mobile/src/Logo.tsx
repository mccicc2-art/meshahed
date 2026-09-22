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

/** الكلمة `loopz-wordmark.png` ٧٢٠×٢٤٧: القامةُ ٠٫٧٦٩ من الارتفاع (أرقامُ `Logo.tsx` الويب المقيسة) */
const WORD_RATIO = 720 / 247;
const WORD_CAP = 0.769;

/**
 * `variant="wordmark"` — قرارُ أحمد (٢٢ سبتمبر ٢٠٢٦): **الكلمةُ في رأس الرئيسيّة كالويب، والرمزُ في بقيّة الشاشات.**
 * ارتفاعُ الكلمة `0.72 × size` كالويب فيبقى مركزُ الشريط واحداً. `onArt`: فوق الغلاف بيضاءُ دائماً لا تتبع الثيم (D-405).
 */
export function Logo({ size = 28, variant = "mark", onArt = false }: { size?: number; variant?: "mark" | "wordmark"; onArt?: boolean }) {
  const { me, tokens } = useApp();
  const plus = !!(me?.plus || me?.partner);
  const mark = variant === "mark";
  const h = mark ? size : Math.round(size * 0.72);
  const w = mark ? size : Math.round(h * WORD_RATIO);
  const H = mark ? size * MARK_H : h * WORD_CAP;
  const side = H * (mark ? 0.3 : 0.27);
  const gap = H * (mark ? 0.07 : 0.08);
  const rise = H * (mark ? 0.08 : 0.06);
  const left = (mark ? size * MARK_RIGHT : w) + gap;
  const top = (mark ? size * MARK_TOP : 0) - rise;
  const bar = side * 0.24;
  return (
    <View style={{ width: left + side, height: h }}>
      <Image source={mark ? require("../assets/loopz-mark.png") : require("../assets/loopz-wordmark.png")} style={{ width: w, height: h, tintColor: onArt ? "#FFFFFF" : tokens.fg }} contentFit="contain" />
      {plus ? (
        <View style={{ position: "absolute", left, top, width: side, height: side }}>
          <View style={{ position: "absolute", left: (side - bar) / 2, top: 0, width: bar, height: side, backgroundColor: tokens.accent }} />
          <View style={{ position: "absolute", top: (side - bar) / 2, left: 0, width: side, height: bar, backgroundColor: tokens.accent }} />
        </View>
      ) : null}
    </View>
  );
}
