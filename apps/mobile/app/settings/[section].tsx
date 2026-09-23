import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ErrorBoundary } from "../../src/ErrorBoundary";
import { AppearanceScreen } from "../../src/settings/AppearanceScreen";
import { ContentScreen } from "../../src/settings/ContentScreen";
import { PrivacyScreen } from "../../src/settings/PrivacyScreen";
import { NotificationsScreen, HelpScreen, AboutScreen, AccountScreen } from "../../src/settings/SmallScreens";
import { ProfileScreen } from "../../src/settings/ProfileScreen";
import { VerifyScreen } from "../../src/settings/VerifyScreen";

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
  /* 🆕 Phase 11-I · I3 — تعديلُ الملفّ (D-1106) والتوثيقُ (D-1107) صارا أصليّين */
  profile: ProfileScreen,
  verify: VerifyScreen,
} as const;

/** صفحةُ الويب البديلة عند الانهيار — «تعديل الملف» مسارُه `/profile/edit` لا تحت `settings` */
const WEB_OF: Partial<Record<keyof typeof SCREENS, string>> = { profile: "/profile/edit" };

export default function SettingsSection() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const key = String(section) as keyof typeof SCREENS;
  const Screen = SCREENS[key] ?? AppearanceScreen;
  return (
    <ErrorBoundary screen="settings" webPath={WEB_OF[key] ?? `/profile/settings/${String(section)}`} returnTo="home" onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <Screen />
    </ErrorBoundary>
  );
}
