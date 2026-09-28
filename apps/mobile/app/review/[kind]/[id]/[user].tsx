import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ThreadRouteScreen } from "../../../../src/thread/route";

/** `/review/[kind]/[id]/[user]` — الرأيُ وخيطُه أصليّاً (Phase 11-M · M3) */
export default function Review() {
  const { kind, id, user, from } = useLocalSearchParams<{ kind: string; id: string; user: string; from?: string }>();
  return <ThreadRouteScreen route={{ t: "review", kind: kind === "movie" ? "movie" : "tv", id: Number(id), user: String(user) }} from={from} />;
}
