import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ConversationScreen } from "../../src/messages/ConversationScreen";
import { originOf } from "../../src/messages/common";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/** `/messages/[peer]` — خيطُ محادثةٍ أصليّاً (Phase 11-M · M4)؛ `?with=` الويب يصل هنا. V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة */
export default function Conversation() {
  const { peer, from } = useLocalSearchParams<{ peer: string; from?: string }>();
  const origin = originOf(from);
  return (
    <ErrorBoundary screen="messages">
      <ConversationScreen peer={String(peer)} from={origin} />
    </ErrorBoundary>
  );
}
