import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Linking, View } from "react-native";
import { Sheet } from "../library/Sheet";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { api, write, ApiError } from "../api";
import { push } from "../push";
import type { PushGroup, PushPrefsPayload } from "@/core/push";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, Row, RowsSkeleton, Toggle, LinkedRow } from "./ui";
import { Image } from "expo-image";
import { Icon, GOOGLE_MARK } from "../icons";
import { useRouter } from "expo-router";
import { useSettings, invalidateSettings } from "./api";
import { linkGoogle, linkApple } from "../linkGoogle";
import { APPLE_SIGN_IN } from "../auth";
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

/** `about/page.tsx` — الوردماركُ ورقمُ البناء، ثلاثُ شاشاتٍ أصليّة (المميزات · الشروط · الخصوصية)، وسطرا المصادر */
export function AboutScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const q = useSettings();
  return (
    <SettingsScreen title={t.setAbout}>
      <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }}>
        <Text size={20} weight="800">Loopz</Text>
        <Text size={12} muted style={{ marginTop: 4 }}>{`${t.setAboutBuild} ${q.data?.about.build ?? "…"}`}</Text>
      </View>
      <Group>
        {/* 🆕 «لا ويب في التطبيق» ١ — المميزاتُ شاشةٌ أصليّة */}
        <Row icon="sparkle-star" title={t.setAboutFeatures} onPress={() => router.push({ pathname: "/settings/[section]", params: { section: "features" } })} />
        {/* 🆕 «لا ويب في التطبيق» ٢ — الشروطُ والخصوصيّةُ شاشتان أصليّتان تقرآن النصَّ الواحدَ من الخادم */}
        <Row icon="book" title={t.setAboutTerms} onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } })} />
        <Row icon="shield" title={t.setAboutPrivacy} onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } })} />
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
 * ====== ورقةُ حذف الحساب (🆕 D-1358 · Phase 11-V · V-C · C2 — ١١ أكتوبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد «1 أ»: ضغطتان كما في الويب** (`PrivacyData.onDelete`) — الأولى تسلّح الزرَّ («متأكد؟ اضغط مرة أخرى»، ويعود
 * بعد خمس ثوانٍ)، والثانيةُ تحذف. الفعلُ `POST /api/v1/me/delete` (فعلُ الويب نفسُه)، ورسالتا الفشل رسالتاه.
 * 🔑 **بعد النجاح: طريقُ زرِّ «تسجيل الخروج» حرفاً** (D-1156) — تُنزل الشاشاتُ ثمّ يُرسل الغلافُ `/auth/signout`: كوكيزُ الطبقة
 * تُمسح هناك، والغلافُ يرى العنوانَ فيمسح الجلسةَ والكاشَ ويرفع شاشةَ الدخول الأصليّة. **لا طريقَ خروجٍ ثانياً** — الدخولُ والخروجُ
 * انكسرا كلَّ مرّةٍ مُسّا فيها (خطّة 11-V · V-D).
 * ⚖️ **والورقةُ لا تُغلق والحذفُ جارٍ**: إغلاقُها لا يوقف طلباً خرج، فيُحذف الحسابُ والشاشةُ تقول إنّه قائم.
 * ⚖️ **بلا «تم» في الرأس** (في الويب «إلغاء» و«تم» معاً وكلاهما يُغلق فقط): `Sheet` الواحدة لها إغلاقُها وسحبُها.
 */
function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (disarm.current) clearTimeout(disarm.current); }, []);
  const press = async () => {
    if (busy) return;
    setError(null);
    if (disarm.current) clearTimeout(disarm.current);
    if (!armed) {
      haptic.pick();
      setArmed(true);
      disarm.current = setTimeout(() => setArmed(false), 5000);
      return;
    }
    setBusy(true);
    try {
      await api<{ done: boolean }>("/api/v1/me/delete", { method: "POST", body: { confirm: "delete" } });
    } catch (e) {
      setBusy(false);
      setArmed(false);
      setError(e instanceof ApiError && e.error.code === "rate_limited" ? t.deleteAccountBusyGate : t.deleteAccountFailed);
      return;
    }
    /* الحسابُ ذهب: الخروجُ بطريقه (انظر أعلى). 🆕 D-1371 — عبر شاشة الخروج؛ **والورقةُ تُغلق أوّلاً**: هي `Modal` يعلو كلَّ
       شاشةٍ ما دامت شاشتُه مركَّبة، وشاشةُ الخروج تُدفع فوقها لا بدلَها */
    onClose();
    router.push("/signing-out");
  };
  return (
    <Sheet title={t.deleteAccountTitle} onClose={() => { if (!busy) onClose(); }}>
      {/* `Sheet` تفصل أبناءها بفجوتها (٢٠) — لا هوامشَ هنا */}
      <Text size={12} muted style={{ lineHeight: 20 }}>{t.deleteAccountDesc}</Text>
      <Button label={busy ? t.deleteAccountBusy : armed ? t.deleteAccountConfirm : t.deleteAccountBtn} variant={armed || busy ? "danger" : "ghost"} disabled={busy} onPress={() => void press()} />
      {error ? <Text size={12} color={tokens.error} style={{ lineHeight: 19 }}>{error}</Text> : null}
    </Sheet>
  );
}

/**
 * `account/page.tsx` — الاسمُ والمعرّف (باب تعديل الملفّ)، البريدُ، طلبُ التوثيق،
 * الاشتراكُ، ثمّ حذفُ الحساب في منطقة خطرٍ وحدَه. **الاشتراكُ بابٌ للويب** (D-932: دفع — وباقٍ بقرار ٧ في خطّة 11-V)؛
 * 🆕 D-1358 (V-C · C2) — **والحذفُ صار أصليّاً** (`DeleteAccountSheet`).
 */
export function AccountScreen() {
  const { t, tokens } = useApp();
  const q = useSettings();
  const s = q.data;
  const router = useRouter();
  /* D-1106/D-1107 — التوثيقُ شاشةٌ أصليّة، والحذفُ ورقةٌ أصليّة (D-1358). الاسمُ والاشتراكُ صارا في الفهرس (تصميمُ ١٩ أكتوبر) */
  const [deleting, setDeleting] = useState(false);
  const go = (section: "verify") => router.push({ pathname: "/settings/[section]", params: { section } });
  /* 🆕 D-1350 — «ربط حساب Google» لمن دخل بأبل (القرار ٥): صفٌّ يفتح Google في متصفّح النظام، وبعد الربط يقول «مرتبط» */
  const toast = useRef<ToastHostRef>(null);
  const [linking, setLinking] = useState<null | "google" | "apple">(null);
  const [adding, setAdding] = useState(false);
  const providers = s?.account.providers ?? [];
  const hasGoogle = providers.includes("google");
  const hasApple = providers.includes("apple");
  /* 🆕 ربطُ Apple (أحمد ١٩ أكتوبر: «نعم») — على الآيفون وحدَه (القرار ٣: أبل لا تُعرض على أندرويد)، ولمن ليس عنده */
  const canAddApple = APPLE_SIGN_IN && !hasApple;
  const link = async (which: "google" | "apple") => {
    if (linking) return;
    setAdding(false);
    setLinking(which);
    try {
      const out = which === "google" ? await linkGoogle() : await linkApple();
      if (out === "linked") {
        toast.current?.say(which === "google" ? t.linkGoogleDone : t.appLinkAppleDone, undefined, undefined, "success");
        invalidateSettings();
      } else if (out === "taken") toast.current?.say(which === "google" ? t.linkGoogleTaken : t.appLinkAppleTaken);
      else if (out === "failed") toast.current?.say(t.linkGoogleFailed);
    } finally {
      setLinking(null);
    }
  };
  /* 🆕 تصميمُ أحمد (١٩ أكتوبر) — أربعُ مجموعات: «معلومات الحساب» · «طرق تسجيل الدخول» · «توثيق الحساب» · «إدارة الحساب».
     **البريدُ «تم التحقق»** لأنّ الدخولَ بـ Google أو Apple وحدَهما: المزوّدُ هو من تحقّق منه. **«إدارة»** تفتح صفحةَ المزوّد
     نفسَه في متصفّح النظام — فكُّ الربط يُدار هناك. */
  const verifiedEmail = hasGoogle || hasApple;
  const signOut = () => {
    haptic.pick();
    /* D-1371 — شاشةُ الخروج تُدفع فوق هذه، وهي من يرسل الطلبَ ويرفع شاشةَ الدخول */
    router.push("/signing-out");
  };
  return (
    <SettingsScreen title={t.appAccountSignIn} toast={toast}>
      {!s ? (
        <RowsSkeleton rows={4} />
      ) : (
        <>
          <Group label={t.appAccountInfo}>
            <Row
              icon="mail"
              title={t.emailSection}
              subtitle={s.account.email ?? ""}
              badge={verifiedEmail ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="check" size={11} color={tokens.onAccent} />
                  </View>
                  <Text size={12} muted>{t.appEmailVerified}</Text>
                </View>
              ) : undefined}
            />
          </Group>

          <Group label={t.appSignInMethods}>
            {hasGoogle ? (
              <LinkedRow
                leading={<Image source={GOOGLE_MARK} style={{ width: 24, height: 24 }} contentFit="contain" />}
                title={t.appGoogleAccount}
                status={t.linkGoogleLinked}
                actionLabel={t.appManage}
                onPress={() => void Linking.openURL("https://myaccount.google.com/connections").catch(() => {})}
              />
            ) : null}
            {providers.includes("apple") ? (
              <LinkedRow
                leading={<Icon name="person-check" size={22} color={tokens.fg} />}
                title={t.appAppleAccount}
                status={t.linkGoogleLinked}
                actionLabel={t.appManage}
                onPress={() => void Linking.openURL("https://account.apple.com/account/manage").catch(() => {})}
              />
            ) : null}
            {/* «إضافة طريقة دخول» حين يوجد ما يُضاف: Google لمن ليس عنده، وApple على الآيفون لمن ليس عنده. واحدٌ ⇒ يُربط مباشرة؛
                اثنان ⇒ ورقةٌ تختار منها */}
            {!hasGoogle || canAddApple ? (
              <Row
                icon="plus"
                title={t.appAddSignIn}
                subtitle={!hasGoogle && !canAddApple ? t.linkGoogleSub : undefined}
                busy={!!linking}
                onPress={() => (!hasGoogle && canAddApple ? setAdding(true) : void link(!hasGoogle ? "google" : "apple"))}
              />
            ) : null}
          </Group>

          <Group label={t.appVerifyGroup}>
            <Row icon="shield" title={t.verifyTitle} subtitle={t.appVerifySub} onPress={() => go("verify")} />
          </Group>

          {/* 🆕 D-1358 — الحذفُ ورقةٌ مسلَّحة (ضغطتان) كما في الويب. والأيقونةُ سلّةٌ: الخروجُ بابٌ، وخطِران بشكلٍ واحدٍ يُخلطان */}
          <Group label={t.appManageAccount}>
            <Row icon="logout" title={t.appSignOut} onPress={signOut} />
            <Row icon="trash" title={t.deleteAccountTitle} danger onPress={() => { haptic.pick(); setDeleting(true); }} />
          </Group>
        </>
      )}
      {adding ? (
        <Sheet title={t.appAddSignIn} onClose={() => setAdding(false)}>
          <View style={{ gap: 10 }}>
            <Button label={t.appGoogleAccount} variant="ghost" onPress={() => void link("google")} />
            <Button label={t.appAppleAccount} variant="ghost" onPress={() => void link("apple")} />
          </View>
        </Sheet>
      ) : null}
      {deleting ? <DeleteAccountSheet onClose={() => setDeleting(false)} /> : null}
    </SettingsScreen>
  );
}
