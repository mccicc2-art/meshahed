import React from "react";
import { Pressable, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { notePress } from "../perfMarks";

/**
 * ====== الرقاقةُ — عائلةُ `chipClass` (الويب) بالبكسل ======
 * (D-948)
 *
 * 🔑 **عائلةٌ واحدة** (القاعدة ٣): `rounded-full border font-semibold` —
 * مختارةً `bg-accent text-on-accent border-accent`، وإلّا `bg-background
 * text-muted border-border` (كانت `bg-surface` حتى D-1082). المقاسان `sm` (`px-2.5 py-1 text-12`) و`md`
 * (`px-3.5 py-2 text-sm` ١٤). **رقاقةٌ بشكلٍ آخر عيبٌ يُبلَّغ.**
 *
 * 🆕 D-1535 — **`lg` + `block` + `ink="accent"`** (أحمد ٢٢ أكتوبر «د» على صورته: «أضف فيلماً أو مسلسلاً» في القلم أكبرَ
 * وبالأصفر): مقاسٌ ثالثٌ في العائلة نفسِها (ارتفاعٌ ٤٦ · نصٌّ ١٦) بعرض الحاوية ومحتواه في الوسط، والحبرُ لونُ الهويّة
 * لغير المختارة (`accent` — ذهبيٌّ غامقٌ في النهاري فيُقرأ). ليس زرّاً ثانياً: الإطارُ والخلفيّةُ والضغطُ كما هي.
 */
export function Chip({
  label,
  active,
  size = "sm",
  onPress,
  onLongPress,
  leading,
  trailing,
  block,
  ink,
}: {
  label: string;
  active: boolean;
  size?: "sm" | "md" | "lg";
  onPress: () => void;
  /** D-993 — ضغطةٌ مطوّلة (حذفُ فلترٍ محفوظ) */
  onLongPress?: () => void;
  leading?: React.ReactNode;
  /** 🆕 D-1495 — سهمُ المنتقي في نهاية الرقاقة (منتقي الموسم والحلقة) — الرقاقةُ نفسُها لا عائلةٌ ثانية */
  trailing?: React.ReactNode;
  /** 🆕 D-1535 — بعرض الحاوية والمحتوى في الوسط */
  block?: boolean;
  /** 🆕 D-1535 — حبرُ غير المختارة: `accent` بدل الخافت */
  ink?: "accent";
}) {
  const { tokens } = useApp();
  const pad = size === "lg" ? { h: 18, v: 12 } : size === "md" ? { h: 14, v: 8 } : { h: 10, v: 4 };
  const fs = size === "lg" ? 16 : size === "md" ? 14 : 12;
  const color = active ? tokens.onAccent : ink === "accent" ? tokens.accent : tokens.muted;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={notePress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: size === "lg" ? 8 : 6,
        paddingHorizontal: pad.h,
        paddingVertical: pad.v,
        ...(size === "lg" ? { minHeight: 46 } : null),
        ...(block ? { alignSelf: "stretch" as const, justifyContent: "center" as const } : null),
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
      <Text size={fs} weight="600" color={color} numberOfLines={1}>
        {label}
      </Text>
      {trailing ? <View>{trailing}</View> : null}
    </Pressable>
  );
}
