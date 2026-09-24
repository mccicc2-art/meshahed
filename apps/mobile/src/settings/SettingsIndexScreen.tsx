import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { shell } from "../shell";
import { haptic } from "../haptics";
import { SettingsScreen, Group, Row, Chevron, RowsSkeleton } from "./ui";
import { useSettings, useOpenWeb } from "./api";

/**
 * ====== الإعداداتُ — الفهرسُ أصليّاً (Phase 11-I · I1) ======
 *
 * فهرسُ `profile/settings/page.tsx` صفّاً بصفّ وبترتيبه (D-462: فهرسٌ لا لوحة؛
 * D-555: لا بحثَ في الترويسة ولا بطاقةَ خطّة). **ما صار أصليّاً يُدفع شاشةً،
 * وما بقي ويباً بابٌ يفتح صفحتَه نفسَها** (D-932: الحساب/الحذف · الدعوات ·
 * الاستيراد · الفوترة · التوثيق · تعديلُ الملفّ · تخصيصُ الرئيسيّة — إلى I3).
 *
 * الخروجُ في صفٍّ وحدَه (مواصفةُ أحمد) — والفعلُ نفسُه: نموذجُ `POST /auth/signout`
 * من الصفحة (`shell.post`)؛ `web.tsx` يرى العنوانَ فيمسح الجلسةَ ويُنزل الشاشات.
 */
export function SettingsIndexScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const openWeb = useOpenWeb();
  const q = useSettings();
  const s = q.data;
  const a = s?.account;
  const displayName = a ? a.nickname || a.username || "" : "";
  const cardPath = a?.username ? `/u/${a.username}` : "/profile";
  const go = (section: string) => router.push({ pathname: "/settings/[section]", params: { section } });

  return (
    <SettingsScreen title={t.settingsNavHeading}>
      {!s ? (
        q.isError ? <Text muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.apiInternal}</Text> : <RowsSkeleton rows={3} />
      ) : (
        <Group>
          {/* بطاقةُ الحساب — بابٌ واحدٌ إلى ملفّك كما يراه الناس (D-849) */}
          <Pressable
            onPress={() => openWeb(cardPath)}
            accessibilityRole="link"
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: pressed ? tokens.surface2 : "transparent" }]}
          >
            <View style={{ width: 52, height: 52, borderRadius: 26, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
              {a?.avatar_url ? <Image source={{ uri: a.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${a.avatar_pos}%`, left: "50%" }} cachePolicy="memory-disk" /> : <Icon name="people" size={22} color={tokens.muted} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text size={15} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{displayName}</Text>
                {/* الشاراتُ كما في رأس الرئيسيّة (D-773ب): توثيقٌ ثمّ «+» للمشترك */}
                {a?.verified ? <Icon name="check-line" size={16} color={tokens.verified} /> : null}
                {a?.plus ? (
                  <View style={{ paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
                    <Text size={10} weight="700" color={tokens.onAccent}>+</Text>
                  </View>
                ) : null}
              </View>
              {a?.username ? <Text size={12} weight="500" muted numberOfLines={1}>@{a.username}</Text> : null}
            </View>
            <Chevron busy={openWeb.busy === cardPath} />
          </Pressable>
        </Group>
      )}

      <Group label={t.setGroupAccount}>
        <Row icon="edit" title={t.setEditProfile} onPress={() => go("profile")} />
        <Row icon="person-check" title={t.setAccount} onPress={() => go("account")} />
        <Row icon="card" title={t.setBilling} value={s?.account.plan_label} onPress={() => openWeb("/profile/settings/billing")} busy={openWeb.busy === "/profile/settings/billing"} />
        <Row icon="share" title={t.setInvites} onPress={() => openWeb("/profile/settings/invites")} busy={openWeb.busy === "/profile/settings/invites"} />
      </Group>

      <Group label={t.setGroupPersonalize}>
        <Row icon="home" title={t.setHomeProfile} onPress={() => go("home")} />
        <Row icon="palette" title={t.setAppearance} onPress={() => go("appearance")} />
        <Row icon="film" title={t.setContent} onPress={() => go("content")} />
      </Group>

      <Group label={t.setGroupData}>
        <Row icon="shield" title={t.setPrivacy} onPress={() => go("privacy")} />
        <Row icon="bell" title={t.setNotifications} onPress={() => go("notifications")} />
        <Row icon="download" title={t.setImport} onPress={() => openWeb("/profile/settings/import")} busy={openWeb.busy === "/profile/settings/import"} />
      </Group>

      <Group label={t.setGroupSupport}>
        <Row icon="comment" title={t.setHelp} onPress={() => go("help")} />
        <Row icon="info" title={t.setAbout} onPress={() => go("about")} />
      </Group>

      <Group>
        <Row
          icon="close"
          title={t.signOut}
          danger
          onPress={() => {
            haptic.pick();
            shell.post("/auth/signout");
            if (router.canDismiss()) router.dismissAll();
            else router.replace("/web");
          }}
        />
      </Group>
    </SettingsScreen>
  );
}
