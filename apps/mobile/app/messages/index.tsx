import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessagesScreen } from "../../src/messages/MessagesScreen";
import { originOf } from "../../src/messages/common";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/**
 * `/messages` — «الرسائل والإشعارات» أصليّةً (Phase 11-M · M4): تُدفع فوق الجذور لا تبويباً (خطّة §٥)، من ظرف الرئيسيّة
 * وجرسها ومن «مراسلة» في أدوات المجتمع ومن روابط الويب (`native {route:"messages"}`). البديلُ عند الانهيار صفحتُها الويبيّة.
 */
export default function Messages() {
  const router = useRouter();
  const { tab, from } = useLocalSearchParams<{ tab?: string; from?: string }>();
  const origin = originOf(from);
  const initial = tab === "alerts" ? "alerts" : "inbox";
  return (
    <ErrorBoundary screen="messages" webPath={initial === "alerts" ? "/messages?tab=alerts" : "/messages"} returnTo={origin === "web" ? undefined : origin} onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <MessagesScreen initialTab={initial} from={origin} />
    </ErrorBoundary>
  );
}
