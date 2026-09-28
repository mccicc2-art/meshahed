import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ThreadRouteScreen } from "../../../src/thread/route";

/** `/talk/[kind]/[id]` — غرفةُ نقاش العمل أصليّةً (Phase 11-M · M3) */
export default function Talk() {
  const { kind, id, from } = useLocalSearchParams<{ kind: string; id: string; from?: string }>();
  return <ThreadRouteScreen route={{ t: "talk", kind: kind === "movie" ? "movie" : "tv", id: Number(id) }} from={from} />;
}
