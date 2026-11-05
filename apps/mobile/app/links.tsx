import React from "react";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { LinksScreen } from "../src/links/LinksScreen";

/** `/links` — 🆕 «الربط»: مدارُ الأجهزة (هجرة ٢٣٧) — من صفِّ الإعدادات والقائمة الجانبيّة */
export default function Links() {
  return (
    <ErrorBoundary screen="settings">
      <LinksScreen />
    </ErrorBoundary>
  );
}
