import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ListScreen } from "../../src/list/ListScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/** D-1036 — صفحةُ القائمة الأصليّة. V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة */
export default function List() {
  const { id, from, copied } = useLocalSearchParams<{ id: string; from?: string; copied?: string }>();
  const origin = from === "discover" ? "discover" : from === "search" ? "search" : from === "home" ? "home" : from === "community" ? "community" : "library";
  return (
    <ErrorBoundary screen="list">
      {/* 🆕 233 — `copied=1`: فُتحت لأنّها نُسخت الآن، فتقول ذلك مرّةً (`justCopied`) */}
      <ListScreen id={String(id)} from={origin} justCopied={copied === "1"} />
    </ErrorBoundary>
  );
}
