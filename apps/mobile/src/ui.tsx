import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "./state";
import { radius, space } from "./theme";
import { posterUrl } from "@/core/media";

/**
 * ====== العائلاتُ الأساسيّة — مصنعُ زرٍّ واحد، نصٌّ واحد، ملصقٌ واحد ======
 *
 * نفسُ قاعدةِ الويب (القاعدة ٣ في المشروع): **مصنعُ زرٍّ واحدٌ** بثلاثة
 * أشكالٍ لا ثلاثةُ أزرار؛ ونصٌّ واحدٌ يحمل الثيمَ فلا يُكتب لونٌ في شاشة.
 */

export function Screen({ children, style, ...rest }: ViewProps) {
  const { tokens } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View
      {...rest}
      style={[
        { flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Text({
  style,
  muted,
  size = 15,
  weight = "400",
  ...rest
}: TextProps & { muted?: boolean; size?: number; weight?: "400" | "600" | "700" }) {
  const { tokens } = useApp();
  return (
    <RNText
      {...rest}
      style={[
        { color: muted ? tokens.muted : tokens.fg, fontSize: size, fontWeight: weight, textAlign: "left" },
        style,
      ]}
    />
  );
}

export function Button({
  label,
  variant = "primary",
  busy,
  style,
  ...rest
}: PressableProps & { label: string; variant?: "primary" | "ghost" | "danger"; busy?: boolean }) {
  const { tokens } = useApp();
  const bg =
    variant === "primary" ? tokens.accent : variant === "danger" ? tokens.error : "transparent";
  const fg = variant === "primary" ? tokens.onAccent : variant === "danger" ? "#fff" : tokens.fg;
  return (
    <Pressable
      {...rest}
      disabled={busy || rest.disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === "ghost" ? tokens.border : bg,
          opacity: pressed || busy ? 0.7 : 1,
        },
        typeof style === "function" ? undefined : style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <RNText style={{ color: fg, fontWeight: "600", fontSize: 15 }}>{label}</RNText>}
    </Pressable>
  );
}

export function Poster({ path, width = 96 }: { path: string | null; width?: number }) {
  const { tokens } = useApp();
  const uri = posterUrl(path, width > 120 ? "w342" : "w185");
  return (
    <View style={{ width, aspectRatio: 2 / 3, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2 }}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} /> : null}
    </View>
  );
}

export function Loading() {
  const { tokens } = useApp();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={tokens.accent} />
    </View>
  );
}

export function Card({ children, style, ...rest }: ViewProps) {
  const { tokens } = useApp();
  return (
    <View
      {...rest}
      style={[{ backgroundColor: tokens.surface, borderRadius: radius.lg, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: tokens.border }, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
});

/**
 * 🆕 D-919 — **صفٌّ أفقيٌّ بعنوان**: الوحدةُ التي تُبنى منها الرئيسيةُ
 * و«اكتشف». عنوانٌ واحدٌ وشكلٌ واحد (القاعدة ٣) — لا صفٌّ لكلِّ شاشة.
 */
export function Rail<T>({
  title,
  data,
  keyOf,
  render,
  action,
}: {
  title: string;
  data: T[];
  keyOf: (item: T) => string;
  render: (item: T) => React.ReactElement;
  action?: React.ReactNode;
}) {
  if (data.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg }}>
        <Text size={20} weight="700" style={{ flex: 1 }}>{title}</Text>
        {action}
      </View>
      <FlatList
        horizontal
        data={data}
        keyExtractor={keyOf}
        renderItem={({ item }) => render(item)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
      />
    </View>
  );
}

/** ملصقٌ بعنوانٍ تحته — خليّةُ صفوف «اكتشف» و«ابدأ» */
export function PosterTile({
  path,
  title,
  subtitle,
  width = 110,
}: {
  path: string | null;
  title: string;
  subtitle?: string | null;
  width?: number;
}) {
  return (
    <View style={{ width, gap: 6 }}>
      <Poster path={path} width={width} />
      <Text size={13} weight="600" numberOfLines={2}>{title}</Text>
      {subtitle ? <Text muted size={12} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );
}
