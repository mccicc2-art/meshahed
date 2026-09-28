import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ConversationScreen } from "../../src/messages/ConversationScreen";
import { originOf } from "../../src/messages/common";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/** `/messages/[peer]` — خيطُ محادثةٍ أصليّاً (Phase 11-M · M4)؛ `?with=` الويب يصل هنا. البديلُ عند الانهيار الخيطُ نفسُه في الويب */
export default function Conversation() {
  const router = useRouter();
  const { peer, from } = useLocalSearchParams<{ peer: string; from?: string }>();
  const origin = originOf(from);
  return (
    <ErrorBoundary screen="messages" webPath={`/messages?with=${String(peer)}`} returnTo={origin === "web" ? undefined : origin} onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <ConversationScreen peer={String(peer)} from={origin} />
    </ErrorBoundary>
  );
}
