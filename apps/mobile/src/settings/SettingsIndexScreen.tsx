import React, { useRef, useState } from "react";
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
import { haptic } from "../haptics";
import { SettingsScreen, Group, Row, Chevron, RowsSkeleton, StatusPill } from "./ui";
import { THEMES, themeName } from "@/core/themes";
import { useSettings, useOpenWeb } from "./api";
import { FeedbackSheet } from "./FeedbackSheet";
import type { ToastHostRef } from "../HoldHost";

/**
 * ====== الإعداداتُ — الفهرسُ أصليّاً (Phase 11-I · I1) ======
 *
 * فهرسُ `profile/settings/page.tsx` صفّاً بصفّ وبترتيبه (D-462: فهرسٌ لا لوحة؛
 * D-555: لا بحثَ في الترويسة ولا بطاقةَ خطّة). **ما صار أصليّاً يُدفع شاشةً،
 * وما بقي ويباً بابٌ يفتح صفحتَه نفسَها** (D-932: الحساب/الحذف · الدعوات ·
 * الاستيراد · الفوترة · التوثيق · تعديلُ الملفّ · تخصيصُ الرئيسيّة — إلى I3).
 *
 * الخروجُ في صفٍّ وحدَه (مواصفةُ أحمد) — والفعلُ نفسُه: `POST /auth/signout` يرسله الغلافُ
 * (`shell.post` — D-1156، كان نموذجاً في الصفحة)؛ `web.tsx` يرى العنوانَ فيمسح الجلسةَ ويُنزل الشاشات.
 */
export function SettingsIndexScreen() {
  const { t, tokens, locale, themeId } = useApp();
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
  /* 🆕 «لا ويب في التطبيق» ١ — **عضوٌ بلا معرّفٍ لا ملفَّ عامّاً له يُفتح**: كانت البطاقةُ تفتح `/profile` في الويب
     (صفحةُ «اختر اسمك»)، والآن «تعديل الملفّ» الأصليّ حيث يُكتب المعرّف. ومن له معرّفٌ يفتح ملفَّه الأصليَّ كما كان (N1). */
  const cardPath = card?.username ? `/u/${card.username}` : "/settings/profile";
  const go = (section: string) => router.push({ pathname: "/settings/[section]", params: { section } });
  /* «داكن · العربية» — الثيمُ الملبوسُ (مصدرُه الواحد `themeId` — D-1128) ولغةُ التطبيق */
  const theme = THEMES.find((x) => x.id === (themeId ?? s?.appearance.theme)) ?? THEMES[0];
  const appearance = `${themeName(theme, locale)} · ${locale === "ar" ? t.arabicLang : t.englishLang}`;

  /* 🆕 D-1499 — «أرسل مشكلة أو اقتراح»: ورقةٌ فوق الإعدادات، وتأكيدُها في مضيف الشاشة نفسِها */
  const [fbOpen, setFbOpen] = useState(false);
  const toast = useRef<ToastHostRef>(null);

  return (
    <SettingsScreen
      title={t.settingsNavHeading}
      toast={toast}
      overlay={fbOpen ? <FeedbackSheet onClose={() => setFbOpen(false)} onSent={(text) => toast.current?.say(text, undefined, undefined, "success")} /> : undefined}
    >
      {!card ? (
        q.isError ? <Text muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.apiInternal}</Text> : <RowsSkeleton rows={3} />
      ) : (
        <Group>
          {/* بطاقةُ الحساب — بابٌ واحدٌ إلى ملفّك كما يراه الناس (D-849) */}
          <Pressable
            onPress={() => (card.username ? openWeb(cardPath) : go("profile"))}
            accessibilityRole="link"
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: pressed ? tokens.surface2 : "transparent" }]}
          >
            {/* 🆕 تصميمُ أحمد (١٩ أكتوبر) — وجهٌ أكبر (٦٤)، والمعرّفُ ثمّ «عرض الملف الشخصي» تحت الاسم: البطاقةُ تقول إلى أين تأخذ */}
            <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
              {card.avatar ? <Image source={{ uri: card.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${card.pos}%`, left: "50%" }} cachePolicy="memory-disk" /> : <Icon name="people" size={22} color={tokens.muted} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text size={17} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{card.name}</Text>
                {/* 🔴 D-1142 — شاراتُ الرئيسيّة نفسُها (`IdentityBadges`): قرصُ الخطّة ثمّ الختمُ الذهبيّ — لا ✓ رفيعٌ ولا «+» */}
                <IdentityBadges flags={card.flags} nameSize={17} />
              </View>
              {card.username ? <Text size={13} weight="500" muted numberOfLines={1} style={{ marginTop: 2 }}>@{card.username}</Text> : null}
              <Text size={12} muted numberOfLines={1} style={{ marginTop: 4 }}>{card.username ? t.appViewProfile : t.appEditProfile}</Text>
            </View>
            <Chevron busy={openWeb.busy === cardPath} />
          </Pressable>
        </Group>
      )}

      {/* 🆕 تصميمُ أحمد (١٩ أكتوبر): ثلاثُ مجموعاتٍ بعناوينها — «الحساب» · «تخصيص التطبيق» · «الخصوصية والبيانات»، والعناوينُ
          أوضح (مفاتيحُ `app*` للتطبيق وحدَه — الويبُ يُبقي عناوينَه). «نشط» بجانب الاشتراك لمشتركٍ قائم، والمظهرُ يقول ثيمَه ولغتَه */}
      <Group label={t.setAccount}>
        <Row icon="person" title={t.appEditProfile} onPress={() => go("profile")} />
        <Row icon="person-plus" title={t.appAccountSignIn} onPress={() => go("account")} />
        <Row icon="card" title={t.appManagePlus} badge={s?.account.plus ? <StatusPill label={t.appPlusActive} /> : undefined} onPress={() => openWeb("/profile/settings/billing")} busy={openWeb.busy === "/profile/settings/billing"} />
        <Row icon="gift" title={t.setInvites} onPress={() => go("invites")} />
      </Group>

      <Group label={t.appGroupPersonalize}>
        <Row icon="home" title={t.appHomeProfile} onPress={() => go("home")} />
        <Row icon="grid" title={t.widgetScreenTitle} onPress={() => go("widget")} />
        <Row icon="link" title={t.stremioScreenTitle} onPress={() => go("stremio")} />
        <Row icon="palette" title={t.setAppearance} value={appearance} onPress={() => go("appearance")} />
        <Row icon="film" title={t.setContent} onPress={() => go("content")} />
      </Group>

      <Group label={t.setGroupData}>
        <Row icon="shield" title={t.setPrivacy} onPress={() => go("privacy")} />
        <Row icon="bell" title={t.setNotifications} onPress={() => go("notifications")} />
        <Row icon="download" title={t.setImport} onPress={() => go("import")} />
      </Group>

      <Group label={t.setGroupSupport}>
        {/* 🆕 D-1499 — أوّلَ «الدعم»: أسرعُ طريقٍ لمشكلةٍ أو اقتراح؛ والبريدُ باقٍ داخل «المساعدة» («ب») */}
        <Row icon="send" title={t.fbRow} subtitle={t.fbRowSub} onPress={() => { haptic.pick(); setFbOpen(true); }} />
        <Row icon="comment" title={t.setHelp} onPress={() => go("help")} />
        <Row icon="info" title={t.setAbout} onPress={() => go("about")} />
      </Group>

      <Group>
        {/* 🆕 تصميمُ «الحساب وتسجيل الدخول» (١٩ أكتوبر): الخروجُ برمز الباب ولونِ النصّ — الأحمرُ للحذف وحدَه */}
        <Row
          icon="logout"
          title={t.appSignOut}
          onPress={() => {
            haptic.pick();
            /* 🆕 D-1371 — شاشةُ الخروج تُدفع فوق هذه (فلا تنكشف الرئيسيّة)، وهي من يرسل الطلبَ ويرفع شاشةَ الدخول حين يكتمل رسمُها */
            router.push("/signing-out");
          }}
        />
      </Group>
    </SettingsScreen>
  );
}
