import React from "react";
import { LibraryScreen } from "../src/library/LibraryScreen";

/**
 * `/library` — الشاشةُ الأصليّةُ الوحيدة (Phase 11 · B1/B2، D-936). تُدفع فوق
 * `/web` برسالة `native` من زرّ المكتبة (للإدارة داخل الغلاف)؛ الـWebView تبقى
 * تحتها مركَّبةً، والرجوعُ يعود إليها كما كانت.
 */
export default function Library() {
  return <LibraryScreen />;
}
