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
 * مختارةً `bg-accent text-on-accent border-accent`، وإلّا `bg-background
 * text-muted border-border` (كانت `bg-surface` حتى D-1082). المقاسان `sm` (`px-2.5 py-1 text-12`) و`md`
 * (`px-3.5 py-2 text-sm` ١٤). **رقاقةٌ بشكلٍ آخر عيبٌ يُبلَّغ.**
 */
export function Chip({
  label,
  active,
  size = "sm",
  onPress,
  onLongPress,
  leading,
}: {
  label: string;
  active: boolean;
  size?: "sm" | "md";
  onPress: () => void;
  /** D-993 — ضغطةٌ مطوّلة (حذفُ فلترٍ محفوظ) */
  onLongPress?: () => void;
  leading?: React.ReactNode;
}) {
  const { tokens } = useApp();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
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
        /* D-1082 — غيرُ المختارة بلون الصفحة (أسود) لا السطحِ الرماديّ، والمختارةُ صفراءُ كما هي —
           بلاغُ أحمد على رقاقات «قوائم» في اكتشف. العائلةُ واحدة (القاعدة ٣)، فالتغييرُ في كلِّ رقاقة:
           رقاقتان بلونين لغير المختار عيبٌ لا خيار */
        backgroundColor: active ? tokens.accent : tokens.bg,
      }}
    >
      {leading ? <View>{leading}</View> : null}
      <Text size={size === "sm" ? 12 : 14} weight="600" color={active ? tokens.onAccent : tokens.muted} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
