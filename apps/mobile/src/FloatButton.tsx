import React from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
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
 * - **بلا كلمة** ⇒ دائرةٌ ٥٦ والكلمةُ للقارئ الآليّ وحدَه (المجتمع).
 * المكانُ (`style`: الارتفاعُ عن الأسفل) للشاشة — فوق شريط التبويب أو فوق حافّة الهاتف.
 */
export function FloatButton({ icon, label, showLabel = true, onPress, style }: { icon: IconName; label: string; showLabel?: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const { tokens } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          position: "absolute",
          end: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          height: showLabel ? 50 : 56,
          width: showLabel ? undefined : 56,
          paddingHorizontal: showLabel ? 20 : 0,
          borderRadius: radius.pill,
          backgroundColor: tokens.accent,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
        style,
      ]}
    >
      <Icon name={icon} size={showLabel ? 18 : 22} color={tokens.onAccent} />
      {showLabel ? <Text size={14} weight="700" color={tokens.onAccent}>{label}</Text> : null}
    </Pressable>
  );
}
