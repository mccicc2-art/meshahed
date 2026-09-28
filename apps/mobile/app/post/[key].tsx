import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ThreadRouteScreen } from "../../src/thread/route";

/** `/post/[key]` — منشورُ لوبز وردودُه أصليّاً (Phase 11-M · M3) */
export default function Post() {
  const { key, from } = useLocalSearchParams<{ key: string; from?: string }>();
  return <ThreadRouteScreen route={{ t: "post", key: String(key) }} from={from} />;
}
