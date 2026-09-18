import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, I18nManager, View, type TextProps } from "react-native";
import { Text } from "../ui";

/**
 * **السطرُ الذي يمشي** — نسخةُ `MarqueeText.tsx` (الويب، D-486/D-100) للبطاقة:
 * القصيرُ ساكنٌ تماماً، **والفائضُ وحدَه يذهب ويعود** (`note-marquee 6s
 * ease-in-out 1.5s infinite alternate`) فيُقرأ كاملاً بدل أن يُبتر بـ«…».
 * يُقاس النصُّ بعرضه الطبيعيّ (`onLayout` على نصٍّ بلا قصّ) مقابل صندوقه؛ فرقٌ
 * ≤ ٤ لا يتحرّك — كما في الويب. والاتّجاهُ من `I18nManager` (الويبُ يقرأ
 * `direction` المحسوب). يُغلق KNOWN_GAP-11.
 */
export function MarqueeText({
  text,
  size,
  weight,
  color,
  style,
  active = true,
}: {
  text: string;
  size?: number;
  weight?: "400" | "500" | "600" | "700" | "800";
  color?: string;
  style?: TextProps["style"];
  /** D-1025 (F1) — `false`: سطرٌ ساكنٌ بلا قياسٍ ولا حركة (بطاقةٌ خارج الشاشة). الافتراضيُّ
      `true` فكلُّ منادٍ قديمٍ على حاله. */
  active?: boolean;
}) {
  if (!active) return <StillLine text={text} size={size} weight={weight} color={color} style={style} />;
  return <MovingLine text={text} size={size} weight={weight} color={color} style={style} />;
}

type LineProps = { text: string; size?: number; weight?: "400" | "500" | "600" | "700" | "800"; color?: string; style?: TextProps["style"] };

/**
 * الساكن — القصُّ `clip` لا «…»: السطرُ الماشي يبدأ مقصوصاً من طرفه بلا نقاط، فالبطاقةُ
 * التي تدخل الشاشة لا يتبدّل شكلُ اسمها حين تُفعَّل (التصميمُ مجمَّد في Phase 11-F).
 */
function StillLine({ text, size, weight, color, style }: LineProps) {
  return (
    <View style={{ overflow: "hidden" }}>
      <Text size={size} weight={weight} color={color} numberOfLines={1} ellipsizeMode="clip" style={style}>
        {text}
      </Text>
    </View>
  );
}

/* مكوّنان لا فرعٌ داخل واحد: خطّافاتُ القياس والحركة لا تُركَّب أصلاً للساكن */
function MovingLine({ text, size, weight, color, style }: LineProps) {
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  const dist = textW - boxW;
  const moving = boxW > 0 && textW > 0 && dist > 4;

  useEffect(() => {
    x.setValue(0);
    if (!moving) return;
    const to = I18nManager.isRTL ? dist : -dist;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(x, { toValue: to, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [moving, dist, x, text]);

  return (
    <View style={{ overflow: "hidden" }} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: x }] }}>
        <Text
          size={size}
          weight={weight}
          color={color}
          numberOfLines={1}
          style={[{ flexShrink: 0 }, style]}
          onLayout={(e) => setTextW(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}
