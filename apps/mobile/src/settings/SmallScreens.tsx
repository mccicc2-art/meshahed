import React, { useRef } from "react";
import { Linking, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { write } from "../api";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, Row, RowsSkeleton } from "./ui";
import { useRouter } from "expo-router";
import { useSettings, useOpenWeb } from "./api";
import type { HintsResetBody } from "../contracts";

/**
 * ====== الشاشاتُ الصغيرة — الإشعارات · المساعدة · عن Loopz · الحساب (Phase 11-I · I2) ======
 * كلٌّ منها ترجمةُ صفحتها صفّاً بصفّ؛ جُمعت في ملفٍّ لأنّ كلَّ واحدةٍ أسطرٌ لا شاشة.
 */

/** `notifications/page.tsx` — ثلاثةُ صفوفٍ بلا أبواب: داخل التطبيق فعّالة، والجهازُ والبريدُ «قريباً» */
export function NotificationsScreen() {
  const { t } = useApp();
  return (
    <SettingsScreen title={t.setNotifications}>
      <Group>
        <Row icon="bell" title={t.setNotifInApp} subtitle={t.setNotifInAppSub} value={t.setPlanActive} />
        <Row icon="bell" title={t.setNotifPush} value={t.settingsSoonShort} />
        <Row icon="mail" title={t.setNotifEmail} value={t.settingsSoonShort} />
      </Group>
    </SettingsScreen>
  );
}

/**
 * `help/page.tsx` — الجولاتُ من سجلّها (تُعاد من الخادم بعناوينها)، وإعادةُ التلميحات،
 * ثمّ بريدُ الدعم. الجولةُ رحلةٌ عبر صفحات الويب فتُفتح الصفحةُ بـ`?tour=<id>`
 * (`TourMount` يترجمها إلى الحدث نفسِه). إعادةُ التلميحات تفرّغ الحساب — والتطبيقُ
 * يقرأ تلميحاتِه من `me:library` فيعيدها البابُ بإبطاله.
 */
export function HelpScreen() {
  const { t } = useApp();
  const q = useSettings();
  const s = q.data;
  const toast = useRef<ToastHostRef>(null);
  const openWeb = useOpenWeb();
  return (
    <SettingsScreen title={t.setHelp} toast={toast}>
      <Group label={t.helpLearnGroup}>
        {!s
          ? [<RowsSkeleton key="sk" rows={2} />]
          : [
              ...s.help.tours.map((tour) => <Row key={tour.id} icon="sparkles" title={tour.title} subtitle={tour.sub} onPress={() => openWeb(`/?tour=${encodeURIComponent(tour.id)}`)} busy={openWeb.busy === `/?tour=${encodeURIComponent(tour.id)}`} />),
              <Row
                key="hints"
                icon="eye"
                title={t.hintsResetRow}
                subtitle={t.hintsResetRowSub}
                onPress={() => {
                  haptic.pick();
                  void write<{ ok: boolean }>("/api/v1/me/settings/hints-reset", { reset: true } satisfies HintsResetBody).catch(() => {});
                  toast.current?.say(t.hintsResetDone);
                }}
              />,
            ]}
      </Group>
      <Group label={t.helpSupportGroup}>
        <Row icon="mail" title={t.setHelpContact} subtitle={t.setHelpContactSub} onPress={() => void Linking.openURL(`mailto:${s?.help.contact_email ?? ""}`).catch(() => {})} />
      </Group>
    </SettingsScreen>
  );
}

/** `about/page.tsx` — الوردماركُ ورقمُ البناء، ثلاثةُ أبوابٍ عامّة، وسطرا المصادر */
export function AboutScreen() {
  const { t, tokens } = useApp();
  const q = useSettings();
  const openWeb = useOpenWeb();
  return (
    <SettingsScreen title={t.setAbout}>
      <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }}>
        <Text size={20} weight="800">Loopz</Text>
        <Text size={12} muted style={{ marginTop: 4 }}>{`${t.setAboutBuild} ${q.data?.about.build ?? "…"}`}</Text>
      </View>
      <Group>
        <Row icon="sparkle-star" title={t.setAboutFeatures} onPress={() => openWeb("/features")} busy={openWeb.busy === "/features"} />
        <Row icon="book" title={t.setAboutTerms} onPress={() => openWeb("/terms")} busy={openWeb.busy === "/terms"} />
        <Row icon="shield" title={t.setAboutPrivacy} onPress={() => openWeb("/privacy")} busy={openWeb.busy === "/privacy"} />
      </Group>
      <View>
        <Text size={12} weight="600" muted style={{ paddingHorizontal: 4, marginBottom: 6 }}>{t.setAboutSources}</Text>
        <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface, padding: 14, gap: 6 }}>
          <Text size={12} color={tokens.muted + "CC"} style={{ lineHeight: 18 }}>{t.tmdbAttribution}</Text>
          <Text size={12} color={tokens.muted + "CC"} style={{ lineHeight: 18 }}>{t.justwatchAttribution}</Text>
        </View>
      </View>
    </SettingsScreen>
  );
}

/**
 * `account/page.tsx` — الاسمُ والمعرّف (باب تعديل الملفّ)، البريدُ، طلبُ التوثيق،
 * الاشتراكُ، ثمّ حذفُ الحساب في منطقة خطرٍ وحدَه. **الأربعةُ الأخيرةُ أبوابٌ للويب**
 * (D-932): هويّةٌ وجلسةٌ ودفع.
 */
export function AccountScreen() {
  const { t } = useApp();
  const q = useSettings();
  const s = q.data;
  const openWeb = useOpenWeb();
  const router = useRouter();
  /* D-1106/D-1107 — الاسمُ والتوثيقُ صارا شاشتين أصليّتين؛ الفوترةُ والحذفُ بابان (D-1096) */
  const go = (section: "profile" | "verify") => router.push({ pathname: "/settings/[section]", params: { section } });
  return (
    <SettingsScreen title={t.setAccount}>
      {!s ? (
        <RowsSkeleton rows={4} />
      ) : (
        <>
          <Group>
            <Row icon="edit" title={t.setNameHandle} value={s.account.username ? `@${s.account.username}` : undefined} onPress={() => go("profile")} />
            <Row icon="mail" title={t.emailSection} subtitle={s.account.email ?? ""} />
            <Row icon="shield" title={t.verifyTitle} subtitle={t.verifySub} onPress={() => go("verify")} />
            <Row icon="card" title={t.setBilling} value={s.account.plan_label} onPress={() => openWeb("/profile/settings/billing")} busy={openWeb.busy === "/profile/settings/billing"} />
          </Group>
          {/* الحذفُ ورقةٌ مسلَّحة (ضغطتان) في صفحة الحساب الويبيّة — البابُ يفتحها نفسَها */}
          <Group label={t.setDangerZone}>
            <Row icon="close" title={t.deleteAccountTitle} danger onPress={() => openWeb("/profile/settings/account")} busy={openWeb.busy === "/profile/settings/account"} />
          </Group>
        </>
      )}
    </SettingsScreen>
  );
}
