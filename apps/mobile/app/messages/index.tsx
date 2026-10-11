import React from "react";
import { useLocalSearchParams } from "expo-router";
import { MessagesScreen } from "../../src/messages/MessagesScreen";
import { originOf } from "../../src/messages/common";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/**
 * `/messages` — «الرسائل والإشعارات» أصليّةً (Phase 11-M · M4): تُدفع فوق الجذور لا تبويباً (خطّة §٥)، من ظرف الرئيسيّة
 * وجرسها ومن «مراسلة» في أدوات المجتمع ومن روابط الويب (`native {route:"messages"}`). V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Messages() {
  const { tab, from } = useLocalSearchParams<{ tab?: string; from?: string }>();
  const origin = originOf(from);
  const initial = tab === "alerts" ? "alerts" : "inbox";
  return (
    <ErrorBoundary screen="messages">
      <MessagesScreen initialTab={initial} from={origin} />
    </ErrorBoundary>
  );
}
