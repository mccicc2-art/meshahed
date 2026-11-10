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
import { SupportersScreen } from "../../src/settings/SupportersScreen";
import { HomeServersScreen } from "../../src/settings/HomeServersScreen";
import { HomeDeviceScreen, KodiDeviceScreen, StremioDeviceScreen } from "../../src/links/DeviceScreens";
import { LinkIntroScreen } from "../../src/links/LinkIntroScreen";
import { LinksScreen } from "../../src/links/LinksScreen";
import { useLinks } from "../../src/links/api";

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
  /* 🆕 D-gold-perks — لوحةُ داعمي لوبز (أعضاء Gold)، يفتحها زرُّ «اللوحة» في صفحة الاشتراك وسطرُ «داعم لوبز منذ» في الملفّ */
  supporters: SupportersScreen,
  /* 🆕 هجرة ٢٣٧ — صفحةٌ لكلِّ جهازٍ برابطه (وقبل الهجرة تعرض كلٌّ منها الشاشةَ القديمة)، و«اربط أجهزتك» قبل الاشتراك */
  stremio: StremioDeviceScreen,
  plex: () => <HomeDeviceScreen kind="plex" />,
  jellyfin: () => <HomeDeviceScreen kind="jellyfin" />,
  emby: () => <HomeDeviceScreen kind="emby" />,
  kodi: KodiDeviceScreen,
  "link-intro": LinkIntroScreen,
  /* «سيرفرات البيت» (هجرة ٢٣٥) — رابطٌ قديمٌ قد يفتحها: قبل الهجرة شاشتُها، وبعدها المدار */
  "home-servers": HomeServersEntry,
} as const;

/** بابُ «سيرفرات البيت» القديم: الشاشةُ نفسُها قبل الهجرة، والمدارُ بعدها */
function HomeServersEntry() {
  const links = useLinks();
  if ((links.data && !links.data.ready) || (!links.data && links.isError)) return <HomeServersScreen />;
  return <LinksScreen />;
}

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
