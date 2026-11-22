import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ThreadRouteScreen } from "../../src/thread/route";

/** `/post/[key]` — منشورُ لوبز وردودُه أصليّاً (Phase 11-M · M3) */
export default function Post() {
  /* 🆕 T509 — `r`: الردُّ الذي جاء من أجله الإشعار — الشاشةُ تنزل إليه وتُضيئه */
  const { key, from, r } = useLocalSearchParams<{ key: string; from?: string; r?: string }>();
  return <ThreadRouteScreen route={{ t: "post", key: String(key) }} from={from} focus={r ?? null} />;
}
