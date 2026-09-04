import React from "react";
import { Tabs } from "expo-router";
import { Text as RNText, type ColorValue } from "react-native";
import { useApp } from "../../src/state";

/**
 * ثلاثةُ تبويباتٍ لا أكثر في النسخة الأولى: **العمل (مكتبتي) · البحث · الملف**.
 * القصدُ تطبيقٌ **يُستعمل** كلَّ يومٍ لا تطبيقٌ كامل — عدّادُ Play يقيس
 * الاستعمالَ الحقيقيّ، وشاشاتُ الاكتشاف والنشاط تأتي والساعةُ تدور.
 */
export default function TabsLayout() {
  const { t, tokens } = useApp();
  const icon = (glyph: string) => ({ color }: { color: ColorValue }) => (
    <RNText style={{ color, fontSize: 18 }}>{glyph}</RNText>
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: tokens.surface, borderTopColor: tokens.border },
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.muted,
      }}
    >
      <Tabs.Screen name="home" options={{ title: t.navLibrary, tabBarIcon: icon("▦") }} />
      <Tabs.Screen name="search" options={{ title: t.navSearch, tabBarIcon: icon("⌕") }} />
      <Tabs.Screen name="profile" options={{ title: t.profile, tabBarIcon: icon("◉") }} />
    </Tabs>
  );
}
