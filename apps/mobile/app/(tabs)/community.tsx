import React from "react";
import { CommunityScreen } from "../../src/community/CommunityScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/**
 * `/community` — «المجتمع» أصليّاً (Phase 11-M · M1، D-1168): الجذرُ الخامسُ في مجموعة التبويبات، وخانتُه
 * في مكانها من الشريط (D-1171). V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Community() {
  return (
    <ErrorBoundary screen="community" root="/community">
      <CommunityScreen />
    </ErrorBoundary>
  );
}
