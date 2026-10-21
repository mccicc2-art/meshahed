import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ThreadRouteScreen } from "../../../src/thread/route";

/** `/talk/[kind]/[id]` — غرفةُ نقاش العمل أصليّةً (Phase 11-M · M3)؛ و`?r=` صفحةُ منشورٍ أو ردٍّ فيها (R55) */
export default function Talk() {
  const { kind, id, from, r } = useLocalSearchParams<{ kind: string; id: string; from?: string; r?: string }>();
  /* 🆕 R58 — «النقاش العام»: `/talk/general/0` */
  const k = kind === "movie" ? "movie" : kind === "general" ? "general" : "tv";
  return <ThreadRouteScreen route={{ t: "talk", kind: k, id: k === "general" ? 0 : Number(id) }} from={from} focus={r ?? null} />;
}
