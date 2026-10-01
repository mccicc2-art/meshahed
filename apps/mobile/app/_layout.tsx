import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { I18nManager } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "../src/auth";
import { AppStateProvider, useApp } from "../src/state";
import { queryClient } from "../src/api";
import { applyDirection, currentLocale } from "../src/i18n";
import { useAppFonts } from "../src/fonts";
import { startCachePersist } from "../src/cachePersist";
import { statusBarStyleOf } from "../src/theme";
import { WebLayer } from "../src/WebLayer";
/* يسجّلان مستمعَيهما عند الإقلاع لا عند أوّل شاشةٍ أصليّة: التحقّقُ من التحديث عند العودة، و`boot.fresh` */
import "../src/ota";
import "../src/perfMarks";
/* D-1140 — مفاتيحُ الخادم تُسأل من الإقلاع (بعد ثوانٍ) لا من أوّل «مكتبة»: القيمةُ تصل قبل أن تُحتاج */
import "../src/flags";

/**
 * الجذر: الاستعلامات ⇢ الجلسة ⇢ الحالة ⇢ الغلاف (D-922: شاشةٌ واحدة `/web`).
 * **الاتّجاهُ يُطبَّق قبل أوّل رسمة**: RTL قرارُ إقلاعٍ في React Native.
 * 🆕 D-946 — **ومن لغة الويب المحفوظة** لا لغةِ الجهاز حين تختلفان.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});
applyDirection(currentLocale());
/* D-1026 (F2) — الكاشُ المحفوظ يُعاد قبل أوّل شاشة: «المكتبة» تفتح على ما عُرض آخرَ مرّة */
startCachePersist();


export default function RootLayout() {
  /* Phase 11 · B2 — الخطوطُ تُحمّل في الجذر ولا تحبس الستارَ: الـWebView لا
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
  const { tokens, themeId } = useApp();
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);
  return (
    <>
      {/* D-1125 — أيقوناتُ الشريط تتبع الثيم: البيضاءُ على «النهاري» لا تُرى */}
      <StatusBar style={statusBarStyleOf(themeId)} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tokens.bg },
          headerTintColor: tokens.fg,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: tokens.bg },
          /* 🆕 D-1220 — **حركةُ الدفع والرجوع قصيرة** (تسجيلُ أحمد ١ أكتوبر: «الخروج من البروفايل فيه بطء واضح»): بلا قيمةٍ هنا يأخذ
             أندرويد ١٣+ حركتَه الافتراضيّة من `react-native-screens` (`rns_default_exit_*`) — **٤٥٠ms** والشاشتان فوق بعضهما.
             ⚖️ D-1223 — **انزلاقٌ لا تلاشٍ** (حكمُ أحمد: «أبغاه انزلاق مو تلاشي في كل الشاشات»): `ios_from_*` = الصفحةُ تنزلق
             كاملةً والتي تحتها تتحرّك ٣٠٪ معها، بمدّة `config_shortAnimTime` (٢٠٠ms) — داخل دليل الحركة (`08`: الدخولُ والخروج
             ٢٠٠–٢٨٠). **والجهةُ من اتّجاه الواجهة**: `translate` في أندرويد لا ينقلب مع RTL، فالعربيّةُ تدخل من اليسار (جهةُ
             «التالي» فيها) والإنجليزيّةُ من اليمين. `I18nManager.isRTL` قرارُ إقلاعٍ (`applyDirection`) فلا يتبدّل والشاشةُ حيّة.
             و`slide_from_*` مدّتُه `config_mediumAnimTime` (٤٠٠ms) فاستُبعد. ما حدّد `none` بنفسه (`(tabs)` · `auth/callback`) كما هو. */
          animation: I18nManager.isRTL ? "ios_from_left" : "ios_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="web" options={{ headerShown: false }} />
        {/* Phase 11 · B1 (D-936) — الشاشةُ الأصليّةُ الوحيدة، فوق الـWebView لا
            بدلَها: `Stack` يُبقي `web` مركَّبةً تحتها، فالرجوعُ يعود إليها
            بلا إعادة تحميل (عقدُ المالك: الحالةُ محفوظة). */}
        {/* 🆕 K3 — الجذورُ الأربعة (الرئيسيّة · المكتبة · اكتشف · البحث) مجموعةُ تبويباتٍ ثابتة (`(tabs)/_layout.tsx`):
            تُدفع فوق الـWebView كما كانت، وبلا حركة — لكنّ التبديلَ بينها لم يعد يهدم شيئاً */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen name="title/[kind]/[id]" options={{ headerShown: false }} />
        {/* D-1036 — صفحةُ القائمة الأصليّة: تُدفع فوق «المكتبة»/«اكتشف» كصفحة العمل */}
        <Stack.Screen name="list/[id]" options={{ headerShown: false }} />
        {/* 🆕 11-M · M3 — «النقاش» أصليّاً: ثلاثةُ أبوابٍ إلى شاشةٍ واحدة، تُدفع فوق من فتحها (المجتمع · صفحةُ العمل) */}
        <Stack.Screen name="talk/[kind]/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="post/[key]" options={{ headerShown: false }} />
        <Stack.Screen name="review/[kind]/[id]/[user]" options={{ headerShown: false }} />
        {/* 🆕 11-M · M4 — «الرسائل والإشعارات» وخيطُ المحادثة: شاشتان مدفوعتان فوق الجذور لا تبويب */}
        <Stack.Screen name="messages/index" options={{ headerShown: false }} />
        <Stack.Screen name="messages/[peer]" options={{ headerShown: false }} />
        {/* 🆕 11-N · N1 — ملفُّ الشخص أصليّاً: يُدفع فوق من فتحه (صورةُ شخصٍ في أيِّ شاشة · رابطُ `/u/` في الويب) */}
        <Stack.Screen name="u/[username]" options={{ headerShown: false }} />
        {/* 🆕 11-N · N4 — إحصاءاتُ العضو أصليّةً: تُدفع فوق ملفّه */}
        <Stack.Screen name="member-stats/[username]" options={{ headerShown: false }} />
        {/* 🆕 D-1213 — «النشاط» أصليّاً: يُدفع فوق المكتبة أو الرئيسيّة */}
        <Stack.Screen name="activity" options={{ headerShown: false }} />
        {/* 🆕 D-1214 — «الإحصائيات» (إحصائياتي أنا) أصليّةً: تُدفع فوق المكتبة أو الرئيسيّة أو ملفّي */}
        <Stack.Screen name="stats" options={{ headerShown: false }} />
        {/* D-1046 — «الكلّ ←» شاشةٌ كاملة فوق «اكتشف» */}
        <Stack.Screen name="section" options={{ headerShown: false }} />
        {/* Phase 11-I — الإعداداتُ أصليّاً: الفهرسُ وصفحةٌ لكلِّ قسم، تُدفع فوق الرئيسيّة */}
        <Stack.Screen name="settings/index" options={{ headerShown: false }} />
        <Stack.Screen name="settings/[section]" options={{ headerShown: false }} />
        {/* D-1158 — بلا حركة: شاشةٌ تُدفع وتُسحب في اللحظة نفسِها لا يجب أن تُرى */}
        <Stack.Screen name="auth/callback" options={{ headerShown: false, animation: "none" }} />
      </Stack>
      {/* 🆕 K3b — الـWebView طبقةٌ فوق المكدّس لا جذرٌ تحته (`src/webDoor.ts`): تظهر للزائر وللباب، وتختفي فوق الشاشات
          الأصليّة وهي مركَّبة — فالبابُ لا يهدم ما تحته، والعودةُ لا تبني شيئاً */}
      <WebLayer />
    </>
  );
}
