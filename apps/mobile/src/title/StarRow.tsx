import React from "react";
import { Pressable, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";

/**
 * 🆕 D-1006 — **التقييمُ نجومٌ ورقمُه إلى جانبها** (طلبُ أحمد بلقطتين: «أبغى في التطبيق نفس
 * القديم: نجمات ويظهر بعد التقييم كم تقييمي على اليمين»): كانت رقاقاتٍ مرقّمة ١..١٠ — وصفةٌ
 * ثانية لعنصرٍ له وصفةٌ في الويب (`StarRating`: عشرُ نجومٍ من `star`/`star-filled` و`n/10`
 * بعدها). صفٌّ واحد يستعمله رأسُ صفحة العمل وورقةُ المراجعة. الضغطُ على النجمة النشطة
 * يرفع التقييمَ حين يُسمح (`clearable`) — كما تفعل الصفحة.
 */
export function StarRow({
  value,
  onChange,
  clearable = false,
  size = 22,
  spread = false,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  clearable?: boolean;
  size?: number;
  /** D-1032 — النجومُ تملأ العرضَ بالتساوي **وبلا `n/10` بعدها**: في انبثاق التقييم الرقمُ كبيرٌ فوقها،
      والصندوقُ أضيقُ من الشاشة فلا يتّسع لعشر نجومٍ ورقمٍ على هاتفٍ صغير */
  spread?: boolean;
}) {
  const { tokens, locale } = useApp();
  const v = value ?? 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={spread ? { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" } : { flexDirection: "row", alignItems: "center", gap: 2 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <Pressable
            key={n}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityState={{ selected: v === n }}
            accessibilityLabel={`${n}/10`}
            onPress={() => onChange(clearable && v === n ? null : n)}
            style={({ pressed }) => ({ padding: spread ? 0 : 2, paddingVertical: 2, opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name={n <= v ? "star-filled" : "star"} size={size} color={n <= v ? tokens.accent : tokens.muted} />
          </Pressable>
        ))}
      </View>
      {v > 0 && !spread ? (
        <Text size={13} weight="600" muted style={{ writingDirection: "ltr" }}>{locale === "ar" ? `${v}/١٠` : `${v}/10`}</Text>
      ) : null}
    </View>
  );
}
