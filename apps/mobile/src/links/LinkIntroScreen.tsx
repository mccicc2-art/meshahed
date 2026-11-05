import React, { useCallback, useEffect } from "react";
import { BackHandler, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius, space } from "../theme";
import { PosterWall, useWallPosters } from "../PosterWall";
import { DeviceLabel, DeviceMark } from "./DeviceMark";
import { deviceName } from "./api";
import { DEVICE_KINDS } from "@/core/deviceLinks";

/**
 * ====== 🆕 «اربط أجهزتك» — قبل الاشتراك (خطّةُ Loopz+ v2؛ أحمد: «اللي اول فالمعمل افضل» ثمّ «خلها على نفس الخط») ======
 *
 * تُفتح حين يضغط المجانيُّ خانةً مقفلة أو يسحب جهازاً ثانياً أو «اعرف أكثر». الأجهزةُ الخمسة في المدار حول القلب وذيلٌ ذهبيّ،
 * وتحتها «ومنصات البث · قريباً» بأسمائها، **وجدارُ ملصقات الدخول خلفها** (`PosterWall` — لا نسخة). ثمّ العنوانُ بسطرَيه،
 * والسطرُ تحته، والرقائقُ الثلاث (الرمزُ والنصُّ على خطٍّ واحد)، و«اعرف عن Loopz+» (صفحةُ المميزات حتى يُفتح الشراء —
 * ثمّ «اعرض الاشتراك» مع المرحلة ٢)، و«ليس الآن».
 */
const PLATFORMS = ["Netflix", "Prime Video", "Disney+", "Apple TV", "HBO Max"] as const;
const CHIPS: { icon: IconName; key: "introChipSafe" | "introChipHistory" | "introChipAuto" }[] = [
  { icon: "lock", key: "introChipSafe" },
  { icon: "history", key: "introChipHistory" },
  { icon: "repeat", key: "introChipAuto" },
];
const MARK = require("../../assets/loopz-mark.png");
const R = 108;
const TILE = 52;
const HUB = 96;

export function LinkIntroScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wall = useWallPosters();
  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/links")), [router]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const W = width;
  const H = R * 2 + TILE + 36;
  const cx = W / 2;
  const cy = R + TILE / 2 + 8;
  const pos = DEVICE_KINDS.map((_, i) => {
    const a = (i / DEVICE_KINDS.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  /* ذيلُ المذنّب: قوسٌ ذهبيٌّ على الحلقة من الأسفل إلى اليمين، ينتهي بنقطة */
  const arc = (from: number, to: number) => {
    const p = (deg: number) => ({ x: cx + R * Math.cos((deg * Math.PI) / 180), y: cy + R * Math.sin((deg * Math.PI) / 180) });
    const a = p(from);
    const b = p(to);
    return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`;
  };
  const tip = { x: cx + R * Math.cos((60 * Math.PI) / 180), y: cy + R * Math.sin((60 * Math.PI) / 180) };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      {wall.data && wall.data.length >= 6 ? <PosterWall posters={wall.data} height={1} top /> : null}
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: space.lg }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.closeLabel} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.surface, alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={16} color={tokens.fg} />
          </Pressable>
        </View>

        {/* ───── الأجهزةُ في المدار ───── */}
        <View style={{ height: H, marginHorizontal: -space.lg }} accessible accessibilityLabel={DEVICE_KINDS.map(deviceName).join("، ")}>
          <Svg width={W} height={H} style={{ position: "absolute" }}>
            <Circle cx={cx} cy={cy} r={R + 34} fill="none" stroke={tokens.border} strokeOpacity={0.5} />
            <Circle cx={cx} cy={cy} r={R} fill="none" stroke={tokens.border} />
            <Path d={arc(-30, 60)} fill="none" stroke={tokens.accent} strokeWidth={3} strokeLinecap="round" strokeOpacity={0.85} />
            <Circle cx={tip.x} cy={tip.y} r={5} fill={tokens.accent} />
          </Svg>
          <View style={{ position: "absolute", left: cx - HUB / 2, top: cy - HUB / 2, width: HUB, height: HUB, borderRadius: HUB / 2, borderWidth: 2, borderColor: tokens.accent, backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center" }}>
            <Image source={MARK} style={{ width: HUB * 0.6, height: HUB * 0.6 }} contentFit="contain" />
          </View>
          {DEVICE_KINDS.map((k, i) => (
            <View key={k} style={{ position: "absolute", left: pos[i].x - TILE / 2, top: pos[i].y - TILE / 2, width: TILE, alignItems: "center" }}>
              <DeviceMark kind={k} size={TILE} state="idle" />
              <DeviceLabel name={deviceName(k)} />
            </View>
          ))}
        </View>

        {/* ───── ومنصات البث · قريباً ───── */}
        <View style={{ alignItems: "center", gap: 10, marginTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text size={13} weight="700" muted>{t.introPlatforms}</Text>
            <View style={{ borderRadius: radius.pill, backgroundColor: tokens.accent + "26", paddingHorizontal: 8, paddingVertical: 1 }}>
              <Text size={11} weight="700" color={tokens.accent}>{t.linksSoon}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {[...PLATFORMS, "…"].map((p) => (
              <View key={p} style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text size={12} weight="700" style={{ writingDirection: "ltr" }}>{p}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ───── العنوانُ والرقائق ───── */}
        <View style={{ alignItems: "center", gap: 10, marginTop: 40 }}>
          <Text size={28} weight="800" style={{ textAlign: "center", lineHeight: 40 }}>{`${t.introTitle1}\n${t.introTitle2}`}</Text>
          <Text size={15} muted style={{ textAlign: "center", lineHeight: 23 }}>{t.introSub}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10 }}>
            {CHIPS.map((c) => (
              <View key={c.key} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Icon name={c.icon} size={15} color={tokens.accent} />
                <Text size={13} weight="700" style={{ lineHeight: 18 }}>{t[c.key]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: 6, marginTop: 36 }}>
          <Button label={t.introCta} onPress={() => router.push({ pathname: "/settings/[section]", params: { section: "features" } })} />
          <Button label={t.introLater} variant="ghost" onPress={close} style={{ borderColor: "transparent" }} />
        </View>
      </ScrollView>
    </View>
  );
}
