import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MyActivityScreen } from "../src/member/MyActivityScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/activity` — «النشاط» أصليّاً (🆕 D-1213). يُدفع من خانة «الإحصائيات · النشاط» في المكتبة ومن «حصيلة الأسبوع» في الرئيسيّة.
 * والحارسُ (D-974) يفتح صفحةَ `/activity` الويبيّةَ إن سقطت الشاشة.
 */
export default function Activity() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = originOf(from);
  return (
    <ErrorBoundary
      screen="profile"
      webPath="/activity"
      returnTo={origin === "web" ? undefined : origin}
      onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}
    >
      <MyActivityScreen from={origin} />
    </ErrorBoundary>
  );
}
