import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ThreadRouteScreen } from "../../../../src/thread/route";

/** `/review/[kind]/[id]/[user]` — الرأيُ وخيطُه أصليّاً (Phase 11-M · M3) */
export default function Review() {
  const { kind, id, user, from, compose, r } = useLocalSearchParams<{ kind: string; id: string; user: string; from?: string; compose?: string; r?: string }>();
  /* 🆕 N2-fix — `compose=1`: جاء من «تعليق» — يُفتح حقلُ الردّ مباشرةً */
  return <ThreadRouteScreen route={{ t: "review", kind: kind === "movie" ? "movie" : "tv", id: Number(id), user: String(user) }} from={from} compose={compose === "1"} focus={r ?? null} />;
}
