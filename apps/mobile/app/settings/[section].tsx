import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ErrorBoundary } from "../../src/ErrorBoundary";
import { AppearanceScreen } from "../../src/settings/AppearanceScreen";
import { ContentScreen } from "../../src/settings/ContentScreen";
import { PrivacyScreen } from "../../src/settings/PrivacyScreen";
import { NotificationsScreen, HelpScreen, AboutScreen, AccountScreen } from "../../src/settings/SmallScreens";

/**
 * `/settings/[section]` — صفحةٌ لكلِّ قسم كما في الويب (D-462: الرابطُ يقول أين أنت،
 * والرجوعُ يعني الرجوع). القسمُ المجهولُ يسقط إلى الويب على صفحته.
 */
const SCREENS = {
  appearance: AppearanceScreen,
  content: ContentScreen,
  privacy: PrivacyScreen,
  notifications: NotificationsScreen,
  help: HelpScreen,
  about: AboutScreen,
  account: AccountScreen,
} as const;

export default function SettingsSection() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const key = String(section) as keyof typeof SCREENS;
  const Screen = SCREENS[key] ?? AppearanceScreen;
  return (
    <ErrorBoundary screen="settings" webPath={`/profile/settings/${String(section)}`} returnTo="home" onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <Screen />
    </ErrorBoundary>
  );
}
