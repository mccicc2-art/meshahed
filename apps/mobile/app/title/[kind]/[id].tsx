import React from "react";
import { useLocalSearchParams } from "expo-router";
import { TitleScreen } from "../../../src/title/TitleScreen";

/**
 * `/title/[kind]/[id]` — صفحةُ العمل أصليّةً (Phase 11-D · D1، D-956). تُدفع في
 * المكدّس من المكتبة و«اكتشف» الأصليّتين (`from` يقرّر إلى أين يعود بابُ الويب)،
 * والرجوعُ يعود إليهما بلا جسر.
 */
export default function Title() {
  const { kind, id, from } = useLocalSearchParams<{ kind: string; id: string; from?: string }>();
  const k = kind === "movie" ? "movie" : "tv";
  return <TitleScreen kind={k} id={Number(id)} from={from === "discover" ? "discover" : "library"} />;
}
