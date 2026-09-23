import React from "react";
import { useRouter } from "expo-router";
import { ErrorBoundary } from "../../src/ErrorBoundary";
import { SettingsIndexScreen } from "../../src/settings/SettingsIndexScreen";

/** `/settings` — فهرسُ الإعدادات أصليّاً (Phase 11-I)؛ البديلُ عند الانهيار صفحتُه الويبيّة */
export default function Settings() {
  const router = useRouter();
  return (
    <ErrorBoundary screen="settings" webPath="/profile/settings" returnTo="home" onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <SettingsIndexScreen />
    </ErrorBoundary>
  );
}
