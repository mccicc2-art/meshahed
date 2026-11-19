import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ListScreen } from "../../src/list/ListScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/** D-1036 — صفحةُ القائمة الأصليّة. V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة */
export default function List() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const origin = from === "discover" ? "discover" : from === "search" ? "search" : from === "home" ? "home" : from === "community" ? "community" : "library";
  return (
    <ErrorBoundary screen="list">
      <ListScreen id={String(id)} from={origin} />
    </ErrorBoundary>
  );
}
