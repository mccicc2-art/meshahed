import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SectionScreen } from "../src/discover/SectionScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";

/** D-1046 — «الكلّ ←» شاشةٌ كاملة؛ بديلُها الويبيُّ عند الانهيار صفحةُ القسم نفسُها */
export default function Section() {
  const router = useRouter();
  const { title, query, path } = useLocalSearchParams<{ title: string; query: string; path?: string }>();
  return (
    <ErrorBoundary screen="discover" webPath={String(path ?? "/news")} returnTo="discover" onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <SectionScreen title={String(title ?? "")} query={String(query ?? "")} />
    </ErrorBoundary>
  );
}
