import React from "react";
import { ErrorBoundary } from "../../src/ErrorBoundary";
import { SettingsIndexScreen } from "../../src/settings/SettingsIndexScreen";

/** `/settings` — فهرسُ الإعدادات أصليّاً (Phase 11-I). V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة */
export default function Settings() {
  return (
    <ErrorBoundary screen="settings">
      <SettingsIndexScreen />
    </ErrorBoundary>
  );
}
