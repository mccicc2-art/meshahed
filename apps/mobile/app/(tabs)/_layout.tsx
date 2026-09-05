import React from "react";
import { Tabs } from "expo-router";
import { Text as RNText, type ColorValue } from "react-native";
import { useApp } from "../../src/state";

/**
 * كانت ثلاثةَ تبويباتٍ في النسخة الأولى (مكتبتي · البحث · الملف) — والساعةُ
 * تدور. 🆕 D-919 (حكمُ أحمد بعد أوّل تثبيت: «ناقص جدّاً»): **الرئيسيةُ
 * و«اكتشف» انضمّتا** — الرئيسيةُ أوّلاً لأنها ما يُفتح التطبيقُ لأجله.
 */
export default function TabsLayout() {
  const { t, tokens } = useApp();
  const icon = (glyph: string) => ({ color }: { color: ColorValue }) => (
    <RNText style={{ color, fontSize: 18 }}>{glyph}</RNText>
  );
  return (
    <Tabs
      initialRouteName="today"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: tokens.surface, borderTopColor: tokens.border },
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.muted,
      }}
    >
      <Tabs.Screen name="today" options={{ title: t.navHome, tabBarIcon: icon("⌂") }} />
      <Tabs.Screen name="home" options={{ title: t.navLibrary, tabBarIcon: icon("▦") }} />
      <Tabs.Screen name="discover" options={{ title: t.newsTitle, tabBarIcon: icon("✦") }} />
      <Tabs.Screen name="search" options={{ title: t.navSearch, tabBarIcon: icon("⌕") }} />
      <Tabs.Screen name="profile" options={{ title: t.profile, tabBarIcon: icon("◉") }} />
    </Tabs>
  );
}
