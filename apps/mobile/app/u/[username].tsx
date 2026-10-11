import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ProfileScreen } from "../../src/member/ProfileScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";
import { originOf } from "../../src/thread/route";

/**
 * `/u/[username]` — ملفُّ الشخص أصليّاً (Phase 11-N · N1). يُدفع من كلِّ صورةِ شخصٍ واسمِه في التطبيق (`member/open.ts`) ومن
 * روابط `/u/…` في الويب (`from=web`). V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Member() {
  const { username, from } = useLocalSearchParams<{ username: string; from?: string }>();
  const origin = originOf(from);
  const handle = String(username ?? "");
  return (
    <ErrorBoundary screen="profile">
      <ProfileScreen username={handle} from={origin} />
    </ErrorBoundary>
  );
}
