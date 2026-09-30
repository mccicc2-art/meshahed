import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatsScreen } from "../../src/member/StatsScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";
import { originOf } from "../../src/thread/route";

/**
 * `/member-stats/[username]` — إحصاءاتُ العضو أصليّةً (Phase 11-N · N4 · D-1192). تُدفع من خانة «الإحصائيات» في ملفّ غيري
 * (`ProfileScreen`)؛ وإحصاءاتي أنا (`/stats` بمداها الكامل) تبقى صفحتَها. والحارسُ (D-974) يفتح الصفحةَ الويبيّةَ إن سقطت الشاشة.
 * ⚠️ **مسارٌ مستقلٌّ لا `u/[username]/stats`**: الملفُّ `u/[username].tsx` مسارٌ ورقيّ — ومجلّدٌ بالاسم نفسِه بجانبه يُربك الموجِّه.
 */
export default function MemberStats() {
  const router = useRouter();
  const { username, from } = useLocalSearchParams<{ username: string; from?: string }>();
  const origin = originOf(from);
  const handle = String(username ?? "");
  return (
    <ErrorBoundary
      screen="profile"
      webPath={`/u/${encodeURIComponent(handle)}/stats`}
      returnTo={origin === "web" ? undefined : origin}
      onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}
    >
      <StatsScreen username={handle} from={origin} />
    </ErrorBoundary>
  );
}
