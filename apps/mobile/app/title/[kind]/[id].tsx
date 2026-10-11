import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TitleScreen } from "../../../src/title/TitleScreen";
import { ErrorBoundary } from "../../../src/ErrorBoundary";
import { TitleFailure } from "../../../src/title/TitleFailure";

/**
 * `/title/[kind]/[id]` — صفحةُ العمل أصليّةً (Phase 11-D · D1، D-956). تُدفع في
 * المكدّس من المكتبة و«اكتشف» الأصليّتين (`from` يقرّر إلى أين يعود بابُ الويب)،
 * والرجوعُ يعود إليهما بلا جسر.
 * V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Title() {
  const router = useRouter();
  const { kind, id, from } = useLocalSearchParams<{ kind: string; id: string; from?: string }>();
  const k = kind === "movie" ? "movie" : "tv";
  const origin = from === "discover" ? "discover" : from === "search" ? "search" : from === "home" ? "home" : from === "community" ? "community" : from === "web" ? "web" : "library";
  return (
    <ErrorBoundary screen="title">
      <TitleScreen kind={k} id={Number(id)} from={origin} />
      {/* 🆕 D-1232 — فشلُ الجلب يُقال بزرّ «حاول مجدداً» بدل هيكلٍ لا ينتهي (`TitleFailure`) */}
      <TitleFailure kind={k} id={Number(id)} onClose={() => (router.canGoBack() ? router.back() : router.replace("/web"))} />
    </ErrorBoundary>
  );
}
