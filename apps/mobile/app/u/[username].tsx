import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ProfileScreen } from "../../src/member/ProfileScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";
import { originOf } from "../../src/thread/route";

/**
 * `/u/[username]` — ملفُّ الشخص أصليّاً (Phase 11-N · N1). يُدفع من كلِّ صورةِ شخصٍ واسمِه في التطبيق (`member/open.ts`) ومن
 * روابط `/u/…` في الويب (`from=web`). والحارسُ (D-974) يفتح الصفحةَ الويبيّةَ إن سقطت الشاشة.
 */
export default function Member() {
  const router = useRouter();
  const { username, from } = useLocalSearchParams<{ username: string; from?: string }>();
  const origin = originOf(from);
  const handle = String(username ?? "");
  return (
    <ErrorBoundary
      screen="profile"
      webPath={`/u/${encodeURIComponent(handle)}`}
      returnTo={origin === "web" ? undefined : origin}
      onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}
    >
      <ProfileScreen username={handle} from={origin} />
    </ErrorBoundary>
  );
}
