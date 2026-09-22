import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PersonScreen } from "../../src/person/PersonScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/**
 * `/person/[id]` — صفحةُ الشخص أصليّةً (Phase 11-E · E1، D-983). تُدفع من صفّ الطاقم في
 * `TitleScreen`، وأعمالُها تدفع `TitleScreen` — والحارسُ (D-974) يفتح `/person/[id]`
 * الويبيّةَ إن سقطت.
 */
export default function Person() {
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const origin = from === "discover" ? "discover" : from === "search" ? "search" : "library";
  return (
    <ErrorBoundary screen="person" webPath={`/person/${Number(id)}`} returnTo={origin} onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <PersonScreen id={Number(id)} from={origin} />
    </ErrorBoundary>
  );
}
