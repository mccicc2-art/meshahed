import React from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Reanimated, { interpolate, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import type { ChromeHidden } from "./ChromeHide";
import { notePress } from "./perfMarks";
import { useApp } from "./state";
import { Text } from "./ui";
import { Icon, type IconName } from "./icons";
import { radius } from "./theme";

/**
 * ====== 🆕 D-1448 — الزرُّ العائم: واحدٌ للتطبيق ======
 *
 * وُلد في «الرسائل» («محادثة جديدة» — حبّةٌ ذهبيّةٌ برمزٍ وكلمة)، وطلب أحمد ١٧ أكتوبر مثلَه في «المجتمع» لنشر بوست
 * (قلمٌ وحدَه كما في لقطته). نسخةٌ ثانيةٌ في المجتمع كانت ستفترق عن الأولى في أوّل تعديل — فصار هنا:
 * - **بكلمة** ⇒ حبّةٌ بارتفاع ٥٠ (الرسائل).
 * - **بلا كلمة** ⇒ دائرةٌ ٤٨ والكلمةُ للقارئ الآليّ وحدَه (المجتمع) — 🆕 D-1451: كانت ٥٦، «صغّره شوي».
 * - 🆕 D-1451 — **`hidden`**: قيمةُ الكسوة الذكيّة نفسُها التي يقرؤها شريطُ التبويب (`useChromeHide`، ٠ ظاهر · ١ مخفيّ)، فيهبط
 *   الزرُّ معه بالنابض نفسِه ويصعد معه («خلّيه يختفي ويرجع مع الدوك»). `drop` = كم يهبط حتى يغيب تحت حافّة الشاشة.
 * المكانُ (`style`: الارتفاعُ عن الأسفل) للشاشة — فوق شريط التبويب أو فوق حافّة الهاتف.
 */
export function FloatButton({
  icon,
  label,
  showLabel = true,
  onPress,
  style,
  hidden,
  drop = 0,
}: {
  icon: IconName;
  label: string;
  showLabel?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  hidden?: ChromeHidden;
  drop?: number;
}) {
  const { tokens } = useApp();
  /* 🆕 D-1629 — يهبط مع الكسوة على Reanimated (`ChromeHide`) فموضعُ لمسه موضعُ رسمه؛ بلا كسوةٍ صفرٌ ثابت */
  const still = useSharedValue(0);
  const h = hidden ?? still;
  const motion = useAnimatedStyle(
    () => ({
      transform: [{ translateY: interpolate(h.value, [0, 1], [0, drop]) }],
      opacity: interpolate(h.value, [0, 0.6, 1], [1, 0.4, 0]),
    }),
    [h, drop],
  );
  return (
    <Reanimated.View pointerEvents="box-none" style={[{ position: "absolute", end: 20 }, style, motion]}>
      <Pressable
        onPress={onPress}
        onPressIn={notePress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          height: showLabel ? 50 : 48,
          width: showLabel ? undefined : 48,
          paddingHorizontal: showLabel ? 20 : 0,
          borderRadius: radius.pill,
          backgroundColor: tokens.accent,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <Icon name={icon} size={showLabel ? 18 : 20} color={tokens.onAccent} />
        {showLabel ? <Text size={14} weight="700" color={tokens.onAccent}>{label}</Text> : null}
      </Pressable>
    </Reanimated.View>
  );
}
