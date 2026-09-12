import React from "react";
import { Pressable, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";

/**
 * ====== الرقاقةُ — عائلةُ `chipClass` (الويب) بالبكسل ======
 * (D-948)
 *
 * 🔑 **عائلةٌ واحدة** (القاعدة ٣): `rounded-full border font-semibold` —
 * مختارةً `bg-accent text-on-accent border-accent`، وإلّا `bg-surface
 * text-muted border-border`. المقاسان `sm` (`px-2.5 py-1 text-12`) و`md`
 * (`px-3.5 py-2 text-sm` ١٤). **رقاقةٌ بشكلٍ آخر عيبٌ يُبلَّغ.**
 */
export function Chip({
  label,
  active,
  size = "sm",
  onPress,
  leading,
}: {
  label: string;
  active: boolean;
  size?: "sm" | "md";
  onPress: () => void;
  leading?: React.ReactNode;
}) {
  const { tokens } = useApp();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: size === "sm" ? 10 : 14,
        paddingVertical: size === "sm" ? 4 : 8,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? tokens.accent : tokens.border,
        backgroundColor: active ? tokens.accent : tokens.surface,
      }}
    >
      {leading ? <View>{leading}</View> : null}
      <Text size={size === "sm" ? 12 : 14} weight="600" color={active ? tokens.onAccent : tokens.muted} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
