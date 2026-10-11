import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Linking, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { api, write } from "../api";
import { push } from "../push";
import type { PushGroup, PushPrefsPayload } from "@/core/push";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, Row, RowsSkeleton, Toggle } from "./ui";
import { useRouter } from "expo-router";
import { useSettings, useOpenWeb, invalidateSettings } from "./api";
import { linkGoogle } from "../linkGoogle";
import type { HintsResetBody } from "../contracts";
import { tourStore } from "../tour/store";

/**
 * ====== الشاشاتُ الصغيرة — الإشعارات · المساعدة · عن Loopz · الحساب (Phase 11-I · I2) ======
 * كلٌّ منها ترجمةُ صفحتها صفّاً بصفّ؛ جُمعت في ملفٍّ لأنّ كلَّ واحدةٍ أسطرٌ لا شاشة.
 */

/**
 * `notifications/page.tsx` — وفوقها ما لا يملكه الويب: **إشعاراتُ الجهاز** (D-1305). خمسةُ مفاتيحَ بنيّة المستخدم
 * (`PUSH_GROUPS`) لا بأنواع الجرس الأحدَ عشر، تُحفظ في الحساب (`me/prefs/push`) فيقرؤها الخادمُ وهو يُرسل.
 * الإذنُ مرفوضٌ ⇒ صفٌّ واحدٌ يفتح إعداداتِ النظام (أندرويد لا يعرض النافذةَ ثانيةً)، والمفاتيحُ معطَّلةٌ تحته.
 */
const PUSH_PREFS_KEY = ["me:push-prefs"] as const;
const PUSH_ROWS: { group: PushGroup; icon: "mail" | "person-check" | "heart" | "comment" | "tv"; label: "pushMessages" | "pushFollows" | "pushLikes" | "pushReplies" | "pushEpisodes"; hint: "pushMessagesSub" | "pushFollowsSub" | "pushLikesSub" | "pushRepliesSub" | "pushEpisodesSub" }[] = [
  { group: "messages", icon: "mail", label: "pushMessages", hint: "pushMessagesSub" },
  { group: "follows", icon: "person-check", label: "pushFollows", hint: "pushFollowsSub" },
  { group: "likes", icon: "heart", label: "pushLikes", hint: "pushLikesSub" },
  { group: "replies", icon: "comment", label: "pushReplies", hint: "pushRepliesSub" },
  { group: "episodes", icon: "tv", label: "pushEpisodes", hint: "pushEpisodesSub" },
];

export function NotificationsScreen() {
  const { t } = useApp();
  const toast = useRef<ToastHostRef>(null);
  const qc = useQueryClient();
  const perm = useSyncExternalStore(push.subscribe, push.state);
  const q = useQuery({ queryKey: PUSH_PREFS_KEY, queryFn: async () => (await api<PushPrefsPayload>("/api/v1/me/prefs/push")).data, staleTime: 0 });
  const muted = q.data?.muted ?? [];
  /* العودةُ من إعدادات النظام: الإذنُ يُقرأ ثانيةً (`push.ts` يسمع `AppState`) — وهنا عند الفتح */
  useEffect(() => {
    void push.refresh(false);
  }, []);
  const flip = (g: PushGroup) => {
    if (!q.data) return;
    haptic.pick();
    const prev = q.data;
    const next: PushPrefsPayload = { muted: muted.includes(g) ? muted.filter((x) => x !== g) : [...muted, g] };
    qc.setQueryData(PUSH_PREFS_KEY, next);
    write<PushPrefsPayload>("/api/v1/me/prefs/push", next).catch(() => {
      qc.setQueryData(PUSH_PREFS_KEY, prev);
      toast.current?.say(t.apiInternal);
    });
  };
  const off = perm === "denied" || perm === "undetermined";
  return (
    <SettingsScreen title={t.setNotifications} toast={toast}>
      <Group>
        <Row icon="bell" title={t.setNotifInApp} subtitle={t.setNotifInAppSub} value={t.setPlanActive} />
        <Row icon="mail" title={t.setNotifEmail} value={t.settingsSoonShort} />
      </Group>
      {perm === "unavailable" ? null : (
        <Group label={t.pushGroupLabel}>
          {[
            ...(off
              ? [
                  <Row
                    key="perm"
                    icon="bell"
                    title={perm === "undetermined" ? t.pushAllow : t.pushOffTitle}
                    subtitle={perm === "undetermined" ? t.setNotifPushSub : t.pushOffSub}
                    value={perm === "undetermined" ? undefined : t.pushOpenSystem}
                    onPress={() => {
                      haptic.pick();
                      if (perm === "undetermined") void push.refresh(true);
                      else void Linking.openSettings().catch(() => {});
                    }}
                  />,
                ]
              : []),
            ...(!q.data
              ? [<RowsSkeleton key="sk" rows={5} />]
              : PUSH_ROWS.map((r) => <Toggle key={r.group} icon={r.icon} label={t[r.label]} hint={t[r.hint]} checked={!muted.includes(r.group)} onChange={() => flip(r.group)} disabled={off} />)),
          ]}
        </Group>
      )}
    </SettingsScreen>
  );
}

/**
 * `help/page.tsx` — الجولةُ من سجلّها (تُعاد من الخادم بعنوانها)، وإعادةُ التلميحات،
 * ثمّ بريدُ الدعم. الجولةُ تُرسم أصليّةً فوق الشاشات (D-1318). إعادةُ التلميحات تفرّغ الحساب — والتطبيقُ
 * يقرأ تلميحاتِه من `me:library` فيعيدها البابُ بإبطاله.
 */
export function HelpScreen() {
  const { t } = useApp();
  const q = useSettings();
  const s = q.data;
  const toast = useRef<ToastHostRef>(null);
  return (
    <SettingsScreen title={t.setHelp} toast={toast}>
      <Group label={t.helpLearnGroup}>
        {!s
          ? [<RowsSkeleton key="sk" rows={2} />]
          : [
              /* 🆕 D-1318 — الجولةُ أصليّة: الصفُّ يبدأها، ومضيفُها (`TourHost`) يُنزل الإعداداتِ ويُبحر إلى خطوتها
                 الأولى. كان يفتح صفحةَ ويبٍ (`/?tour=`) تمشي على نسخٍ ويبيّةٍ لشاشاتٍ أصليّة. */
              ...s.help.tours.map((tour) => (
                <Row
                  key={tour.id}
                  icon="sparkles"
                  title={tour.title}
                  subtitle={tour.sub}
                  onPress={() => {
                    haptic.pick();
                    tourStore.start();
                  }}
                />
              )),
              <Row
                key="hints"
                icon="eye"
                title={t.hintsResetRow}
                subtitle={t.hintsResetRowSub}
                onPress={() => {
                  haptic.pick();
                  void write<{ ok: boolean }>("/api/v1/me/settings/hints-reset", { reset: true } satisfies HintsResetBody).catch(() => {});
                  toast.current?.say(t.hintsResetDone, undefined, undefined, "success");
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
  /* 🆕 D-1350 — «ربط حساب Google» لمن دخل بأبل (القرار ٥): صفٌّ يفتح Google في متصفّح النظام، وبعد الربط يقول «مرتبط» */
  const toast = useRef<ToastHostRef>(null);
  const [linking, setLinking] = useState(false);
  const providers = s?.account.providers ?? [];
  const hasGoogle = providers.includes("google");
  const link = async () => {
    if (linking) return;
    setLinking(true);
    try {
      const out = await linkGoogle();
      if (out === "linked") {
        toast.current?.say(t.linkGoogleDone, undefined, undefined, "success");
        invalidateSettings();
      } else if (out === "taken") toast.current?.say(t.linkGoogleTaken);
      else if (out === "failed") toast.current?.say(t.linkGoogleFailed);
    } finally {
      setLinking(false);
    }
  };
  return (
    <SettingsScreen title={t.setAccount} toast={toast}>
      {!s ? (
        <RowsSkeleton rows={4} />
      ) : (
        <>
          <Group>
            <Row icon="edit" title={t.setNameHandle} value={s.account.username ? `@${s.account.username}` : undefined} onPress={() => go("profile")} />
            <Row icon="mail" title={t.emailSection} subtitle={s.account.email ?? ""} />
            {providers.includes("apple") ? (
              hasGoogle ? (
                <Row icon="link" title={t.linkGoogleTitle} value={t.linkGoogleLinked} />
              ) : (
                <Row icon="link" title={t.linkGoogleTitle} subtitle={t.linkGoogleSub} onPress={() => void link()} busy={linking} />
              )
            ) : null}
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
