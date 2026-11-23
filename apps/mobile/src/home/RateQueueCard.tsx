import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { write } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { posterFor } from "../poster";
import { haptic } from "../haptics";
import { useRateQueueSummary } from "../member/rateQueue";
import { PAGE_PAD } from "./Section";
import { num } from "@/core/i18n";

/**
 * ====== 🆕 T530 — بطاقةُ «بانتظار تقييمك» في الرئيسيّة (أحمد ٢٣ نوفمبر: «٢» البطاقةُ المدمجة) ======
 *
 * ملصقان صغيران متراكبان (آخرُ ما شاهده) · «N بانتظار تقييمك» وتحته «آخرها …» · زرُّ «قيّم» · ✕ يُخفيها أسبوعاً في كلِّ
 * أجهزته (`ui_state.rateCard`). **تظهر حين ينتظر عشرةُ أعمالٍ فأكثر** (`card` من الخادم — القاعدةُ واحدةٌ هناك). ارتفاعُها
 * نحو ٨٤ — كانت الأولى كبيرةً فرفضها أحمد («شكل ب كبير»).
 */
export function RateQueueCard() {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const q = useRateQueueSummary();
  const [hidden, setHidden] = useState(false);
  const d = q.data;
  if (!d?.card || hidden || !d.items.length) return null;
  const open = () => {
    haptic.pick();
    router.push({ pathname: "/rate-queue", params: { from: "home" } });
  };
  const hide = () => {
    haptic.pick();
    setHidden(true);
    /* فشلُ الحفظ يعيدها — إخفاءٌ لا يُحفظ يرجع في الفتحة التالية، فلا نَعِد بأسبوعٍ لم يُكتب */
    write("/api/v1/me/rate-queue/hide-card", {}).catch(() => setHidden(false));
  };
  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel={t.rateQueueCardTitle(num(d.total, locale))}
      style={({ pressed }) => ({ marginHorizontal: PAGE_PAD, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.card, backgroundColor: tokens.surface, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ flexDirection: "row" }}>
        {d.items.slice(0, 2).map((it, i) => {
          const u = posterFor(it.poster_path, 40);
          return (
            <View key={`${it.kind}-${it.id}`} style={{ width: 40, height: 60, borderRadius: radius.sm, overflow: "hidden", borderWidth: 2, borderColor: tokens.surface, backgroundColor: tokens.surface2, marginStart: i > 0 ? -16 : 0, zIndex: 2 - i }}>
              {u ? <Image source={{ uri: u }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
            </View>
          );
        })}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={15} weight="800" numberOfLines={1}>{t.rateQueueCardTitle(num(d.total, locale))}</Text>
        <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{t.rateQueueCardLast(d.items[0].title)}</Text>
      </View>
      <View style={{ paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
        <Text size={14} weight="800" color={tokens.onAccent}>{t.rateQueueCardCta}</Text>
      </View>
      <Pressable onPress={hide} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.rateQueueHideCard} style={{ paddingHorizontal: 2 }}>
        <Icon name="close" size={16} color={tokens.muted} />
      </Pressable>
    </Pressable>
  );
}
