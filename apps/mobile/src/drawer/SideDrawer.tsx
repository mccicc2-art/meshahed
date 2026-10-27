import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BackHandler, I18nManager, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { haptic } from "../haptics";
import { notePress } from "../perfMarks";
import { Chevron } from "../settings/ui";
import { useAppearanceActs } from "../settings/appearanceActs";
import { HOME_KEY, fetchHome } from "../home/useHome";
import { openProfile } from "../member/open";
import { num } from "@/core/i18n";
import { drawerStore } from "./store";

/**
 * ====== 🆕 D-1505 — القائمةُ الجانبيّة (تصميمُ أحمد، ٢٢–٢٧ أكتوبر · «نفذ» ٢٧ أكتوبر) ======
 *
 * بابُ ما لا مكانَ له في الشريط السفليّ، وبابُ الاشتراك. **كلُّ وجهةٍ فيها شاشةٌ أصليّةٌ قائمة** — القائمةُ لا تبني شيئاً،
 * تختصر الطريق: الملفُّ · سجلُّ المشاهدة (`/activity?scope=watch`، D-1504) · ربطُ المنصّات (`settings/stremio`) ·
 * التخصيص (`settings/home`) · الدعوات · الإعدادات · المساعدة · Plus.
 *
 * - **من صورة الحساب** (الرئيسيّة وطرفُ ترويسات التبويبات) كقائمة X التي أرسلها أحمد — والملفُّ أوّلُ ما فيها. وخطوةُ
 *   «ملفك» في الجولة تُبقي الصورةَ بابَ الملفّ (جملتُها «اضغط صورتك لتفتح ملفك») — `HomeScreen`.
 * - **تنزلق من طرف البداية** (يمينٌ في العربيّة، يسارٌ في الإنجليزيّة) وتُغلق بالحجاب أو بسحبها نحو طرفها أو بزرّ الرجوع.
 * - **الوجهةُ تُدفع بعد أن تُغلق**: `Modal` فوق المكدّس، وشاشةٌ تُدفع تحته تبقى مغطّاةً حتى يُغلق.
 * - **المظهرُ زرٌّ واحدٌ رمزُه الحالُ** (قمرٌ للداكن، شمسٌ للفاتح) — وصفةُ مبدّل العرض في الرئيسيّة (D-1321) لا مبدّلٌ ثالث:
 *   التصميمُ رسم كبسولةً بزرّين، وهي عائلةُ تحكّمٍ ثالثةٌ تخالف القاعدة ٣. الداكنُ يعود إلى آخر ثيمٍ داكنٍ لبسه في الجلسة.
 * - **اللغةُ زرٌّ يبدّل إلى الأخرى** بفعل شاشة «المظهر» نفسِه (`useAppearanceActs`): الاتّجاهُ ينقلب فيُعاد تحميلُ JS.
 */
const PANEL_MAX = 296;
const DUR = 220;
/** آخرُ ثيمٍ داكنٍ قبل «الفاتح» — يُعاد إليه بـ«الداكن» (ثيمُ بلس الملوّن لا يضيع بضغطتين) */
let lastDark: string | null = null;

export function DrawerHost() {
  const from = useSyncExternalStore(drawerStore.subscribe, drawerStore.get, drawerStore.get);
  if (!from) return null;
  return <SideDrawer from={from} />;
}

function SideDrawer({ from }: { from: NonNullable<ReturnType<typeof drawerStore.get>> }) {
  const { t, tokens, locale, me, themeId } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(PANEL_MAX, Math.round(width * 0.82));
  const rtl = I18nManager.isRTL;
  /* الإزاحةُ نحو طرف البداية: موجبةٌ في العربيّة (اليمين)، سالبةٌ في الإنجليزيّة */
  const sign = rtl ? 1 : -1;
  const x = useSharedValue(sign * W);
  const [closing, setClosing] = useState(false);
  const after = useRef<(() => void) | null>(null);

  const home = useQuery({ queryKey: HOME_KEY, queryFn: fetchHome, staleTime: 60_000 });
  const h = home.data?.header ?? null;
  const plus = me?.plus ?? false;
  const toastFail = useCallback(() => undefined, []);
  const { settings, busy, pickLocale, pickTheme } = useAppearanceActs(toastFail);

  const finish = useCallback(() => {
    drawerStore.close();
    const f = after.current;
    after.current = null;
    f?.();
  }, []);

  const close = useCallback(
    (then?: () => void) => {
      if (closing) return;
      setClosing(true);
      after.current = then ?? null;
      x.value = withTiming(sign * W, { duration: DUR, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) scheduleOnRN(finish);
      });
    },
    [closing, finish, sign, W, x],
  );

  useEffect(() => {
    x.value = withTiming(0, { duration: DUR, easing: Easing.out(Easing.cubic) });
  }, [x]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  /* السحبُ نحو طرف البداية يُغلق — أفقيٌّ وحده، فالتمريرُ العموديُّ (لو طالت القائمة) لا يُسرق */
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const d = e.translationX * sign;
      x.value = sign * Math.max(0, Math.min(W, d));
    })
    .onEnd((e) => {
      const d = e.translationX * sign;
      const v = e.velocityX * sign;
      if (d > W / 3 || v > 500) scheduleOnRN(close);
      else x.value = withTiming(0, { duration: 160 });
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.abs(x.value) / W }));

  const go = (href: Href) => close(() => router.push(href));
  const openMe = () => close(() => (me?.username ? openProfile(router, me.username, from) : router.push("/settings/profile")));

  const name = h?.display_name ?? me?.nickname ?? me?.username ?? "";
  const username = h?.username ?? me?.username ?? null;
  const avatar = h?.avatar_url ?? me?.avatar_url ?? null;
  const until = h?.plus_until ? new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { day: "numeric", month: "long" }).format(new Date(h.plus_until)) : null;

  const isLight = (themeId ?? settings?.appearance.theme) === "daylight";
  const toggleTheme = () => {
    if (busy) return;
    if (isLight) void pickTheme(lastDark ?? "loopz");
    else {
      lastDark = themeId ?? settings?.appearance.theme ?? null;
      void pickTheme("daylight");
    }
  };
  const langNow = locale === "ar" ? t.arabicLang : t.englishLang;
  const toggleLang = () => {
    if (busy || !settings) return;
    haptic.pick();
    void pickLocale(locale === "ar" ? "en" : "ar");
  };

  const row = (icon: IconName, label: string, onPress: () => void, opts?: { small?: boolean; tag?: boolean }) => (
    <Pressable
      key={label}
      onPress={onPress}
      onPressIn={notePress}
      accessibilityRole="link"
      style={({ pressed }) => ({ height: opts?.small ? 44 : 46, flexDirection: "row", alignItems: "center", gap: 16, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={opts?.small ? 22 : 24} color={tokens.fg} />
      <Text size={opts?.small ? 16 : 18} weight={opts?.small ? "500" : "700"} numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      {opts?.tag ? (
        <View style={{ borderWidth: 1.5, borderColor: tokens.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
          <Text size={10} weight="700" color={tokens.accent}>PLUS</Text>
        </View>
      ) : null}
    </Pressable>
  );
  const divider = <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 8 }} />;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={() => close()}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Reanimated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.62)" }, veilStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityRole="button" accessibilityLabel={t.closeLabel} />
        </Reanimated.View>
        <GestureDetector gesture={pan}>
          <Reanimated.View
            accessibilityViewIsModal
            accessibilityLabel={t.drawerLabel}
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                start: 0,
                width: W,
                backgroundColor: tokens.bg,
                borderEndWidth: StyleSheet.hairlineWidth,
                borderEndColor: tokens.border,
                paddingTop: insets.top + 20,
                paddingBottom: insets.bottom + 12,
                paddingHorizontal: 22,
              },
              panelStyle,
            ]}
          >
            {/* الحساب: الصورةُ بجوار الاسم (أحمد: «الصورة تكون كذا ماتكون فوق الاسم») ثمّ الرقمان */}
            <Pressable onPress={openMe} onPressIn={notePress} accessibilityRole="link" accessibilityLabel={`${t.drawerProfile} — ${name}`} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                  {avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${h?.avatar_pos ?? 50}%`, left: "50%" }} cachePolicy="memory-disk" /> : <Icon name="person" size={26} color={tokens.muted} />}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text size={20} weight="800" numberOfLines={1}>{name}</Text>
                  {username ? <Text size={13} muted numberOfLines={1} style={{ writingDirection: "ltr", textAlign: rtl ? "right" : "left" }}>@{username}</Text> : null}
                </View>
              </View>
              {h ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
                  <Text size={14} muted>
                    <Text size={14} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(h.following, locale)}</Text> {t.drawerFollowing}
                  </Text>
                  <View style={{ width: 1, height: 14, backgroundColor: tokens.divider }} />
                  <Text size={14} muted>
                    <Text size={14} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(h.followers, locale)}</Text> {t.drawerFollowers}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            {/* Plus: غيرُ المشترك يرى الدعوةَ ومزاياها، والمشتركُ سطراً واحداً (أحمد: «سطر واحد يكفي ومختصر جداً») */}
            <Pressable
              onPress={() => go("/settings/plus")}
              onPressIn={notePress}
              accessibilityRole="link"
              style={({ pressed }) => ({ marginTop: 22, borderRadius: 18, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 16, gap: 12, opacity: pressed ? 0.85 : 1 })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ backgroundColor: tokens.accent, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text size={11} weight="700" color={tokens.onAccent}>PLUS</Text>
                </View>
                <Text size={plus ? 16 : 17} weight="800" numberOfLines={1} style={{ flex: 1 }}>
                  {plus ? (until ? t.drawerPlusUntil(until) : t.drawerPlusActive) : t.drawerPlusCta}
                </Text>
                <Chevron />
              </View>
              {plus ? null : (
                <View style={{ gap: 6 }}>
                  {t.drawerPlusFeats.map((f) => (
                    <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Icon name="check" size={16} color={tokens.accent} />
                      <Text size={14} muted numberOfLines={1} style={{ flex: 1 }}>{f}</Text>
                    </View>
                  ))}
                  <Text size={13} weight="700" color={tokens.accent} style={{ paddingStart: 26 }}>{t.drawerPlusMore}</Text>
                </View>
              )}
            </Pressable>

            <View style={{ marginTop: 14 }}>
              {row("person", t.drawerProfile, openMe)}
              {row("history", t.drawerHistory, () => go({ pathname: "/activity", params: { from, scope: "watch" } }))}
              {row("link", t.drawerConnections, () => go("/settings/stremio"), { tag: !plus })}
              {row("sliders", t.drawerCustomize, () => go("/settings/home"))}
              {row("gift", t.drawerInvite, () => go("/settings/invites"))}
            </View>

            <View style={{ flex: 1 }} />
            {divider}
            {row("settings", t.drawerSettings, () => go("/settings"), { small: true })}
            {row("help", t.drawerHelp, () => go("/settings/help"), { small: true })}
            {divider}
            <View style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable onPress={toggleLang} onPressIn={notePress} disabled={busy} accessibilityRole="button" accessibilityLabel={t.drawerLangAria(langNow)} hitSlop={4} style={({ pressed }) => ({ height: 44, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed || busy ? 0.6 : 1 })}>
                <Icon name="globe" size={24} color={tokens.fg} />
                <Text size={16} weight="500">{langNow}</Text>
              </Pressable>
              <Pressable onPress={toggleTheme} onPressIn={notePress} disabled={busy} accessibilityRole="button" accessibilityLabel={isLight ? t.drawerToDark : t.drawerToLight} hitSlop={4} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, alignItems: "center", justifyContent: "center", opacity: pressed || busy ? 0.6 : 1 })}>
                <Icon name={isLight ? "sun" : "moon"} size={20} color={tokens.fg} />
              </Pressable>
            </View>
          </Reanimated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}
