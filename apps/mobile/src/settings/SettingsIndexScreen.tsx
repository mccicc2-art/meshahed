import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { IdentityBadges, identityFlags, type IdentityFlags } from "../IdentityBadges";
import { HOME_KEY } from "../home/useHome";
import type { HomePayload } from "../contracts";
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
  /**
   * 🆕 D-1142 — **البطاقةُ لا تنتظر الإعدادات** (أحمد بتسجيل: «بطء في ظهور صفحة البروفايل في الإعدادات» —
   * هيكلٌ ~٥ث): `/api/v1/me/settings` شخصيٌّ ينتظر الرمزَ من الـWebView، والبطاقةُ لا تحتاج منه شيئاً لا
   * تملكه الرئيسيّة — والإعداداتُ لا تُفتح إلّا منها، ورأسُها محفوظٌ على القرص (`cachePersist`). فتُرسم من
   * رأس الرئيسيّة فوراً، ومتى وصلت الإعداداتُ صارت هي المصدر (الاسمُ المستعارُ قد تغيّر في هذه الأثناء).
   */
  const qc = useQueryClient();
  const h = qc.getQueryData<HomePayload>(HOME_KEY)?.header;
  const card: { name: string; username: string | null; avatar: string | null; pos: number; flags: IdentityFlags } | null = a
    ? { name: a.nickname || a.username || "", username: a.username, avatar: a.avatar_url, pos: a.avatar_pos, flags: { partner: a.partner, plus: a.plus, founder: a.founder, verified: a.verified } }
    : h
      ? { name: h.display_name, username: h.username, avatar: h.avatar_url, pos: h.avatar_pos ?? 50, flags: identityFlags(h) }
      : null;
  const cardPath = card?.username ? `/u/${card.username}` : "/profile";
  const go = (section: string) => router.push({ pathname: "/settings/[section]", params: { section } });

  return (
    <SettingsScreen title={t.settingsNavHeading}>
      {!card ? (
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
              {card.avatar ? <Image source={{ uri: card.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${card.pos}%`, left: "50%" }} cachePolicy="memory-disk" /> : <Icon name="people" size={22} color={tokens.muted} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text size={15} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{card.name}</Text>
                {/* 🔴 D-1142 — شاراتُ الرئيسيّة نفسُها (`IdentityBadges`): قرصُ الخطّة ثمّ الختمُ الذهبيّ — لا ✓ رفيعٌ ولا «+» */}
                <IdentityBadges flags={card.flags} nameSize={15} />
              </View>
              {card.username ? <Text size={12} weight="500" muted numberOfLines={1}>@{card.username}</Text> : null}
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
