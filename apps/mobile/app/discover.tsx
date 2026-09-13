import React from "react";
import { DiscoverScreen } from "../src/discover/DiscoverScreen";

/**
 * `/discover` — الشاشةُ الأصليّةُ الثانية (Phase 11-C · C1، D-955). تُدفع فوق
 * `/web` برسالة `native {route:"discover"}` من خانة «اكتشف» (للإدارة داخل
 * الغلاف)؛ الـWebView تبقى تحتها، والرجوعُ يعود إليها كما في المكتبة.
 */
export default function Discover() {
  return <DiscoverScreen />;
}
