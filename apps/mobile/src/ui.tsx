import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "./state";
import { radius, space } from "./theme";
import { ARABIC_RE, familyOf, type Weight } from "./fonts";
import { deviceLocale } from "./i18n";
import { isRtl } from "@/core/i18n";

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

/**
 * 🆕 Phase 11 · B2 — **الخطُّ يتبع الحرفَ لا الشاشة** (D-454): الويبُ يكتب
 * `Poppins, Tajawal` فيحلّ المتصفّحُ كلَّ حرفٍ من عائلته. RN لا يملك سلسلةَ
 * سقوطٍ، **فالنصُّ يُقسَّم إلى مقاطعَ عربيّةٍ ولاتينيّة** كلٌّ بعائلته
 * ووزنه — عنوانٌ مثل «Breaking Bad — الموسم ٣» يُرسم بخطّين كما في الصفحة.
 * وقبل تحميل الخطوط يُرسم بخطّ النظام بالوزن نفسِه، لا فراغاً.
 */
function runsOf(text: string): { s: string; ar: boolean }[] {
  const out: { s: string; ar: boolean }[] = [];
  let cur = "";
  let curAr: boolean | null = null;
  for (const ch of text) {
    /* المسافاتُ وعلاماتُ الترقيم المشتركة تتبع المقطعَ الجاري فلا تُقطّعه */
    const ar: boolean | null = ARABIC_RE.test(ch) ? true : /[A-Za-z0-9]/.test(ch) ? false : curAr;
    if (curAr === null || ar === null || ar === curAr) {
      cur += ch;
      if (curAr === null && ar !== null) curAr = ar;
    } else {
      out.push({ s: cur, ar: curAr });
      cur = ch;
      curAr = ar;
    }
  }
  if (cur) out.push({ s: cur, ar: curAr ?? isRtl(deviceLocale()) });
  return out;
}

export function Text({
  style,
  muted,
  size = 15,
  weight = "400",
  color,
  children,
  ...rest
}: TextProps & { muted?: boolean; size?: number; weight?: Weight; color?: string }) {
  const { tokens, fontsReady } = useApp();
  const base = {
    color: color ?? (muted ? tokens.muted : tokens.fg),
    fontSize: size,
    fontWeight: weight,
    textAlign: "left" as const,
  };
  if (!fontsReady || typeof children !== "string") {
    return <RNText {...rest} style={[base, style]}>{children}</RNText>;
  }
  const runs = runsOf(children);
  const family = (ar: boolean) => ({ fontFamily: familyOf(ar, weight), fontWeight: undefined });
  if (runs.length === 1) {
    return <RNText {...rest} style={[base, family(runs[0].ar), style]}>{children}</RNText>;
  }
  return (
    <RNText {...rest} style={[base, family(runs[0].ar), style]}>
      {runs.map((r, i) => (
        <RNText key={i} style={family(r.ar)}>{r.s}</RNText>
      ))}
    </RNText>
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

export function Loading() {
  const { tokens } = useApp();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={tokens.accent} />
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

/* 🗑️ D-944: `Poster` · `Card` · `Rail` · `PosterTile` حُذفت — كانت وحداتِ الشاشات
   الأصليّة التسع (D-919) التي أُلغيت بـD-922، وبقيت بلا قارئٍ منذ ٥ سبتمبر (دَينُ
   `05` رقم ٢١/٢٩). بطاقةُ المكتبة الأصليّة لها `library/PosterCard.tsx` بقيم الويب. */
