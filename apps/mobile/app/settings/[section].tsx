import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ErrorBoundary } from "../../src/ErrorBoundary";
import { AppearanceScreen } from "../../src/settings/AppearanceScreen";
import { ContentScreen } from "../../src/settings/ContentScreen";
import { PrivacyScreen } from "../../src/settings/PrivacyScreen";
import { NotificationsScreen, HelpScreen, AboutScreen, AccountScreen } from "../../src/settings/SmallScreens";
import { ProfileScreen } from "../../src/settings/ProfileScreen";
import { VerifyScreen } from "../../src/settings/VerifyScreen";
import { CustomizeScreen } from "../../src/settings/CustomizeScreen";
import { InvitesScreen } from "../../src/settings/InvitesScreen";
import { ImportScreen } from "../../src/settings/ImportScreen";
import { WidgetScreen } from "../../src/settings/WidgetScreen";
import { FeaturesScreen } from "../../src/settings/FeaturesScreen";
import { PlusScreen } from "../../src/settings/PlusScreen";
import { StremioScreen } from "../../src/settings/StremioScreen";

/**
 * `/settings/[section]` — صفحةٌ لكلِّ قسم كما في الويب (D-462: الرابطُ يقول أين أنت،
 * والرجوعُ يعني الرجوع). V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
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
  /* 🆕 D-1112 — «الرئيسيّة والملفّ» صارت أصليّة */
  home: CustomizeScreen,
  /* 🆕 D-1360 (V-C · C4) — «الدعوات والمكافآت»: تبويبُ الأصدقاء أصليّ؛ الشركاءُ بابٌ ويبيٌّ من داخله */
  invites: InvitesScreen,
  /* 🆕 D-1369 (V-C · C6) — «الاستيراد والتصدير» أصليّة */
  import: ImportScreen,
  /* 🆕 ودجت لوبز (خطّةُ v2) — الإعدادُ والمعاينةُ والتخطيطات أصليّةٌ من أوّل يوم */
  widget: WidgetScreen,
  /* 🆕 «لا ويب في التطبيق» ١ — «المميزات» أصليّةٌ من سجلِّ النواة نفسِه (كانت بابَ `/features`) */
  features: FeaturesScreen,
  /* 🆕 «لا ويب في التطبيق» ٤ — Loopz+ والاشتراك شاشةٌ واحدة (كلُّ أبواب `/plus` والفوترة عبر `shell.nativeDoor`) */
  plus: PlusScreen,
  /* 🆕 «اربط Stremio» (٢٢ أكتوبر) — رابطُ الإضافة وإلغاؤه؛ والإشاراتُ نفسُها في الرئيسيّة و`/stremio` */
  stremio: StremioScreen,
} as const;

export default function SettingsSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const key = String(section) as keyof typeof SCREENS;
  const Screen = SCREENS[key] ?? AppearanceScreen;
  return (
    <ErrorBoundary screen="settings">
      <Screen />
    </ErrorBoundary>
  );
}
