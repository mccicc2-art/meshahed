import React from "react";
import { useRouter } from "expo-router";
import { CommunityScreen } from "../../src/community/CommunityScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/**
 * `/community` — «المجتمع» أصليّاً (Phase 11-M · M1، D-1168): الجذرُ الخامسُ في مجموعة التبويبات، وخانتُه
 * في مكانها من الشريط (D-1171). D-974 — وإن سقطت فصفحةُ `/people` الويبيّةُ بديلُها، لا شاشةٌ سوداء.
 */
export default function Community() {
  const router = useRouter();
  return (
    <ErrorBoundary screen="community" webPath="/people" onLeave={() => (router.canGoBack() ? router.back() : router.replace("/web"))}>
      <CommunityScreen />
    </ErrorBoundary>
  );
}
