import React from "react";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { StremioListScreen } from "../src/stremio/StremioListScreen";

/** `/stremio` — 🆕 «من Stremio»: كلُّ الإشارات المنتظرة («عرض الكل» من بطاقة الرئيسيّة، خطّةُ Stremio ٢٢ أكتوبر) */
export default function Stremio() {
  return (
    <ErrorBoundary screen="home">
      <StremioListScreen />
    </ErrorBoundary>
  );
}
