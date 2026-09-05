import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "../src/auth";
import { AppStateProvider, useApp } from "../src/state";
import { queryClient } from "../src/api";
import { applyDirection, deviceLocale } from "../src/i18n";

/**
 * الجذر: الاستعلامات ⇢ الجلسة ⇢ الحالة ⇢ الغلاف (D-922: شاشةٌ واحدة `/web`).
 * **الاتّجاهُ يُطبَّق قبل أوّل رسمة**: RTL قرارُ إقلاعٍ في React Native.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});
applyDirection(deviceLocale());

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppStateProvider>
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
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
