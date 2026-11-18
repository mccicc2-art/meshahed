"use client";

import { useEffect } from "react";
import { rememberRoom, type RecentRoom } from "./recentRooms";

/** 🆕 R264 — يسجّل الغرفةَ المفتوحة في «زرتها مؤخراً» (لا يرسم شيئاً) — ما يكتبه التطبيقُ عند فتح غرفة */
export function RememberRoom(props: RecentRoom) {
  const { kind, id, title, poster } = props;
  useEffect(() => {
    if (title) rememberRoom({ kind, id, title, poster });
  }, [kind, id, title, poster]);
  return null;
}
