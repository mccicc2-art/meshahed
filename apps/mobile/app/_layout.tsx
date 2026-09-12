import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "../src/auth";
import { AppStateProvider, useApp } from "../src/state";
import { queryClient } from "../src/api";
import { applyDirection, currentLocale } from "../src/i18n";
import { useAppFonts } from "../src/fonts";

/**
 * الجذر: الاستعلامات ⇢ الجلسة ⇢ الحالة ⇢ الغلاف (D-922: شاشةٌ واحدة `/web`).
 * **الاتّجاهُ يُطبَّق قبل أوّل رسمة**: RTL قرارُ إقلاعٍ في React Native.
 * 🆕 D-946 — **ومن لغة الويب المحفوظة** لا لغةِ الجهاز حين تختلفان.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});
applyDirection(currentLocale());


export default function RootLayout() {
  /* Phase 11 · B2 — الخطوطُ تُحمَّل في الجذر ولا تحبس الستارَ: الـWebView لا
     تحتاجها، والشاشةُ الأصليّةُ ترسم بخطّ النظام حتى تصل (`ui.tsx`). */
  const fontsReady = useAppFonts();
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppStateProvider fontsReady={fontsReady}>
            <Shell />
          </AppStateProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { loading } = useAuth();
  const { tokens } = useApp();
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tokens.bg },
          headerTintColor: tokens.fg,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: tokens.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="web" options={{ headerShown: false }} />
        {/* Phase 11 · B1 (D-936) — الشاشةُ الأصليّةُ الوحيدة، فوق الـWebView لا
            بدلَها: `Stack` يُبقي `web` مركَّبةً تحتها، فالرجوعُ يعود إليها
            بلا إعادة تحميل (عقدُ المالك: الحالةُ محفوظة). */}
        <Stack.Screen name="library" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
