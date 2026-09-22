import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ListScreen } from "../../src/list/ListScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/** D-1036 — صفحةُ القائمة الأصليّة؛ البديلُ الويبيُّ عند الانهيار صفحتُها نفسُها (نهجُ `title`/D-981) */
export default function List() {
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const origin = from === "discover" ? "discover" : from === "search" ? "search" : "library";
  return (
    <ErrorBoundary screen="list" webPath={`/lists/${String(id)}`} returnTo={origin} onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <ListScreen id={String(id)} from={origin} />
    </ErrorBoundary>
  );
}
