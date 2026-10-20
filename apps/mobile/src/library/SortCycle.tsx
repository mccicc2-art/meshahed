import React from "react";
import { Pressable } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";

/**
 * ====== زرُّ الترتيب الدوّار — «الأحدث ⌄» (🆕 D-1493) ======
 *
 * أحمد ٢٠ أكتوبر بلقطة: «الخيار الي يسار يكون مثل كذا الأحدث وفيه سهم اضغطه وابدل بينهم». كلمةٌ واحدةٌ ظاهرة —
 * المختارُ وحدَه — وكلُّ ضغطةٍ تنقل إلى التالي وتدور. حلّ محلَّ الخيارين الظاهرين تحت خطّ (D-1234).
 * 🔑 **نسخةٌ واحدةٌ لكلِّ ترتيبٍ من هذا النوع** (القاعدة ٣): النقاشاتُ والنشاطُ وداخلُ النقاش؛ ونظيرُه في الويب
 * `components/ui/SortCycle.tsx` بالشكل نفسِه.
 */
export function SortCycle<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (next: K) => void;
  /** وصفُ قارئ الشاشة («ترتيب») */
  label: string;
}) {
  const { tokens } = useApp();
  const i = Math.max(0, options.findIndex((o) => o.key === value));
  const cur = options[i];
  const next = options[(i + 1) % options.length];
  return (
    <Pressable
      onPress={() => (next && next.key !== value ? onChange(next.key) : undefined)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${cur?.label ?? ""}`}
      accessibilityHint={next?.label}
      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
    >
      <Text size={13} weight="600">{cur?.label ?? ""}</Text>
      <Icon name="chevron-down" size={14} color={tokens.muted} />
    </Pressable>
  );
}
