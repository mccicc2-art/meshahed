import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarScreen } from "../src/home/CalendarScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/calendar` — تقويمُ أعمالك أصليّاً (🆕 D-1317). يُدفع من عنوان شريط الأسبوع في الرئيسيّة.
 * والحارسُ (D-974) يفتح الصفحةَ الويبيّةَ إن سقطت الشاشة.
 */
export default function Calendar() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = originOf(from);
  return (
    <ErrorBoundary
      screen="home"
      webPath="/calendar"
      returnTo={origin === "web" ? undefined : origin}
      onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}
    >
      <CalendarScreen from={origin} />
    </ErrorBoundary>
  );
}
