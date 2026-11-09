import React, { useEffect, useMemo, useRef, useState } from "react";
import { I18nManager, Pressable, View, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon, iconOr } from "../icons";
import { haptic } from "../haptics";
import { api, queryClient, write } from "../api";
import { Sheet } from "../library/Sheet";
import { Segmented } from "../library/ToolsSheet";
import { ArrangeList } from "../home/SectionOrderSheet";
import type { ToastHostRef } from "../HoldHost";
import type { CustomizePayload, CustomizeSaveBody, CustomizeSaveResult, HomePayload, SettingsPayload } from "../contracts";
import { HOME_KEY } from "../home/useHome";
import { profileKey } from "../member/profileData";
import { radius } from "../theme";
import { CustomizePreview, type PreviewWho } from "./CustomizePreview";
import { SettingsScreen, Group, Row, Toggle, RowsSkeleton, StatusPill } from "./ui";
import { SETTINGS_KEY, messageOf, useOpenWeb } from "./api";
import {
  defaultHomePrefs,
  HEADER_STATS,
  HOME_SECTIONS,
  STATS_PICK_MAX,
  headerStatMeta,
  homeSectionMeta,
  touchesPaidHomePrefs,
  type HeaderStatKey,
  type HomePrefs,
} from "@/core/homePrefs";
import {
  defaultProfilePrefs,
  HIDEABLE_PROFILE_TABS,
  PROFILE_SECTIONS,
  PROFILE_STATS,
  orderedProfileTabs,
  profileSectionMeta,
  profileTabMeta,
  touchesPaidProfilePrefs,
  type HideableProfileTab,
  type ProfilePrefs,
  type ProfileStatKey,
} from "@/core/profilePrefs";
import { DENSITIES, type Density } from "@/core/density";

/**
 * 🆕 D-1630 — **«التخصيص»: كلُّ خيارٍ صورةٌ تُرى** (أحمد ٦ نوفمبر، «ب»): شبكةُ الأرقام بترتيب اللمس (لا شيء = البطاقةُ مخفيّة)،
 * الأقسامُ والتبويباتُ قوائمُ في الصفحة نفسِها (`ArrangeList`)، أحجامُ الملصق صورٌ، والاستعادةُ تسأل أوّلاً.
 * «تنسيقاتي» و«طريقة العرض» و«عدد البطاقات» حُذفت — العرضُ زرُّه في رأس الرئيسيّة، والعددُ «الكلّ» للجميع.
 *
 * 🆕 D-1640 — **ثلاثةُ تعديلاتٍ بطلب أحمد (٩ نوفمبر، بعد تجربة «المعمل»)**:
 * ١) **المعاينةُ عادت مثبّتةً وتطوى («١ب»)** — `CustomizePreview` فوق الخيارات: الصفحةُ كاملةً في صندوقٍ يتمرّر، تتبدّل مع الإصبع.
 *    بلاغُه: «مافيه محاكي يظهر كيف صار للشخص قبل يسوي حفظ».
 * ٢) **«حفظ» عاد زرّاً** («الحفظ خله يضغط زر حفظ») — نقضٌ صريحٌ للحفظ التلقائيّ في D-1630. مسودّتان (لكلِّ تبويبٍ مسودّتُه)
 *    و«حفظ» يرسل ما تغيّر منهما في نداءٍ واحد، والرجوعُ بتعديلٍ لم يُحفظ يسأل (`setUnsaved*` — نمطُ «تعديل الملفّ»).
 *    **غيرُ المشترك يجرّب كلَّ شيءٍ ويراه في المعاينة**، و«حفظ» يفتح صفحةَ بلس («اذا ضغط حفظ للغير مشترك يجيه اشترك بلس»)
 *    — حين يمسّ حقلاً مدفوعاً، والخادمُ يحكم بالقاعدة نفسِها (`touchesPaid*` · `needsPlus`).
 * ٣) **التنقّلُ بين «الرئيسيّة» و«الملفّ» بالإيماء** — سحبٌ أفقيٌّ على الخيارات (`activeOffsetX` · `failOffsetY`: العموديُّ
 *    للتمرير، والمقبضُ ≡ يمسك قبله). الاتّجاهُ اتّجاهُ القراءة: في العربيّة «الملفّ» يسار «الرئيسيّة»، فالسحبُ يميناً يأتي به.
 */
const KEY = ["me:customize"] as const;
type Tab = "home" | "profile";
type Draft = { home: HomePrefs; profile: ProfilePrefs };
/** طيُّ المعاينة اختيارُ جلسة — يبقى بين فتحتَين للشاشة ولا يُكتب في مكان */
let previewChoice: boolean | null = null;
/** دونه تبدأ المعاينةُ مطويّةً: الصندوقُ (٢٦٠) والترويسةُ والتبويبان لا يتركون للخيارات ما يكفي */
const SHORT_SCREEN = 720;
/** مسافةُ السحب الأفقيّ أو سرعتُه التي تبدّل التبويب */
const SWIPE_DIST = 60;
const SWIPE_SPEED = 500;

/** النصوصُ الجديدةُ محلّيّة — `i18n.ts` محجوزٌ لمهمّة الودجت (٢٧٤) في السجلّ، كـ`RATERS_WORDS` */
const WORDS = {
  ar: {
    max: `${STATS_PICK_MAX} أرقام على الأكثر`,
    statsHint: "اختر حتى ٤ بترتيب اللمس — ولا شيء يُخفي البطاقة",
    statsHidden: "البطاقةُ مخفيّة",
    profileStatsHint: "اختر ما يظهر في بطاقة صفحتك — ولا شيء يُخفيها",
    asOthers: "هذه صفحتك كما يراها غيرك",
    openPage: "افتح صفحتك",
    savedListsHint: "القوائمُ التي حفظتَها من غيرك تظهر في تبويب القوائم",
    resetTitle: "استعادة الافتراضيّ؟",
    resetBody: (tab: string) => `يعود تبويب «${tab}» كما كان أوّل مرّة — ولا يُحفظ حتى تضغط «حفظ».`,
    resetDo: "استعادة",
    cancel: "إلغاء",
    resetHint: "يعيد هذا التبويب إلى الافتراضيّ",
    resetDone: "رجع للافتراضيّ — اضغط «حفظ» لتعتمده",
    undo: "تراجع",
  },
  en: {
    max: `${STATS_PICK_MAX} numbers at most`,
    statsHint: "Pick up to 4 in tap order — none hides the card",
    statsHidden: "The card is hidden",
    profileStatsHint: "Pick what your page's card shows — none hides it",
    asOthers: "This is your page as others see it",
    openPage: "Open your page",
    savedListsHint: "Lists you saved from others appear in the Lists tab",
    resetTitle: "Restore defaults?",
    resetBody: (tab: string) => `The «${tab}» tab goes back to how it started — nothing is saved until you tap Save.`,
    resetDo: "Restore",
    cancel: "Cancel",
    resetHint: "Returns this tab to its defaults",
    resetDone: "Back to defaults — tap Save to keep it",
    undo: "Undo",
  },
} as const;

export function CustomizeScreen() {
  const { t, tokens, locale } = useApp();
  const w = WORDS[locale === "en" ? "en" : "ar"];
  const router = useRouter();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const { height: winH } = useWindowDimensions();
  const q = useQuery({ queryKey: KEY, queryFn: async () => (await api<CustomizePayload>("/api/v1/me/customize")).data, staleTime: 0 });
  const d = q.data;

  /* 🆕 D-1488 — بطاقةُ «خصّص ملفك» تفتح الشاشةَ على تبويب الملفّ (`?tab=profile`) */
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "profile" ? "profile" : "home");
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const [base, setBase] = useState<Draft | null>(null);
  const [home, setHome] = useState<HomePrefs | null>(null);
  const [profile, setProfile] = useState<ProfilePrefs | null>(null);
  useEffect(() => {
    if (d && !base) {
      setBase({ home: d.home, profile: d.profile });
      setHome(d.home);
      setProfile(d.profile);
    }
  }, [d, base]);

  const [previewOpen, setPreviewOpen] = useState(() => previewChoice ?? winH >= SHORT_SCREEN);
  const [saving, setSaving] = useState(false);
  const [ask, setAsk] = useState(false);
  const [askReset, setAskReset] = useState(false);
  const [locked, setLocked] = useState(false);

  const homeDirty = !!home && !!base && JSON.stringify(home) !== JSON.stringify(base.home);
  const profileDirty = !!profile && !!base && JSON.stringify(profile) !== JSON.stringify(base.profile);
  const dirty = homeDirty || profileDirty;

  /* السحبُ الأفقيّ يبدّل التبويب — إيماءةٌ واحدةٌ ثابتة (درسُ D-1094)، والقرارُ على خيط JS */
  const swipeTo = (forward: boolean) => {
    const next: Tab = forward ? "profile" : "home";
    if (next === tabRef.current) return;
    haptic.pick();
    setTab(next);
  };
  const swipeRef = useRef(swipeTo);
  swipeRef.current = swipeTo;
  const swipe = useMemo(() => {
    const rtl = I18nManager.isRTL;
    const go = (forward: boolean) => swipeRef.current(forward);
    return Gesture.Pan()
      .activeOffsetX([-24, 24])
      .failOffsetY([-14, 14])
      .onEnd((e) => {
        if (Math.abs(e.translationX) < SWIPE_DIST && Math.abs(e.velocityX) < SWIPE_SPEED) return;
        /* «الملفّ» بعد «الرئيسيّة» في اتّجاه القراءة: يسارها في العربيّة فيأتي بالسحب يميناً، ويمينها في الإنجليزيّة */
        const forward = rtl ? e.translationX > 0 : e.translationX < 0;
        scheduleOnRN(go, forward);
      });
  }, []);

  async function save() {
    if (!d || !home || !profile || !base || !dirty || saving) return;
    /* D-1322 — البوّابةُ على الحقل المدفوع لا على الحفظ كلِّه؛ والخادمُ يحكم بالقاعدة نفسِها (`touchesPaid*`) */
    const paid = (homeDirty && touchesPaidHomePrefs(base.home, home)) || (profileDirty && touchesPaidProfilePrefs(base.profile, profile));
    if (!d.plus && paid) {
      haptic.pick();
      return openWeb("/plus");
    }
    setSaving(true);
    try {
      const body: CustomizeSaveBody = { ...(homeDirty ? { home } : {}), ...(profileDirty ? { profile } : {}) };
      const out = await write<CustomizeSaveResult>("/api/v1/me/customize", body);
      if (out.needsPlus || !out.data) return openWeb("/plus");
      queryClient.setQueryData(KEY, out.data);
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      setBase({ home: out.data.home, profile: out.data.profile });
      setHome(out.data.home);
      setProfile(out.data.profile);
      /* D-1323 — الرئيسيّةُ ترسم المحفوظَ فوراً، ثمّ تُجلب لتأتي قيمُ الأرقام الجديدة المختارة */
      const saved = out.data.home;
      queryClient.setQueryData<HomePayload>(HOME_KEY, (prev) => (prev ? { ...prev, prefs: saved } : prev));
      void queryClient.invalidateQueries({ queryKey: HOME_KEY });
      if (profileDirty && username) void queryClient.invalidateQueries({ queryKey: profileKey(username) });
      haptic.success();
      toast.current?.say(t.setSaved, undefined, undefined, "success");
    } catch (e) {
      toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.errSaveShort), undefined, undefined, "error");
    } finally {
      setSaving(false);
    }
  }

  const leave = () => {
    if (router.canGoBack()) router.back();
  };
  const back = () => (dirty ? setAsk(true) : leave());

  /* اسمُ العضو ووجهُه من كاشَين قائمَين (ترويسةُ الرئيسيّة ثمّ الإعدادات) — للمعاينة ولزرّ «افتح صفحتك» */
  const head = queryClient.getQueryData<HomePayload>(HOME_KEY)?.header;
  const account = queryClient.getQueryData<SettingsPayload>(SETTINGS_KEY)?.account;
  const username = head?.username ?? account?.username ?? null;

  if (!d || !home || !profile) {
    return (
      <SettingsScreen title={t.custTitle}>
        {q.isError ? <Text muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.apiInternal}</Text> : <RowsSkeleton rows={6} />}
      </SettingsScreen>
    );
  }

  const locks = !d.plus;
  const posterLabel: Record<Density, string> = { compact: t.custPosterS, comfortable: t.custPosterM, large: t.custPosterL };
  const statMeta = headerStatMeta(t);
  const values = new Map((head?.stats ?? []).map((s) => [s.key as string, s.value]));
  const visibleTabs = orderedProfileTabs(profile).filter((k) => !profile.hiddenTabs.includes(k));
  const tabNames: Record<Tab, string> = { home: t.custTabHome, profile: t.custTabProfile };
  const who: PreviewWho = {
    name: head?.display_name ?? account?.nickname ?? account?.username ?? "",
    username,
    avatarUrl: head?.avatar_url ?? account?.avatar_url ?? null,
    avatarPos: head?.avatar_pos ?? account?.avatar_pos ?? null,
    coverUrl: head?.cover_url ?? null,
    coverPos: head?.cover_pos ?? null,
    followers: head && !head.hide_follow_lists ? head.followers : null,
    following: head && !head.hide_follow_lists ? head.following : null,
  };
  const togglePreview = () => {
    haptic.pick();
    previewChoice = !previewOpen;
    setPreviewOpen(previewChoice);
  };

  /* «حفظ» الترويسة — زرُّ «تعديل الملفّ» نفسُه (D-1106) */
  const saveAction = (
    <Pressable onPress={() => void save()} disabled={!dirty || saving} hitSlop={10} accessibilityRole="button" accessibilityState={{ disabled: !dirty || saving }} style={{ height: 44, justifyContent: "center", paddingHorizontal: 4 }}>
      <Text size={14} weight="700" color={dirty && !saving ? tokens.accent : tokens.muted}>{saving ? t.saving : t.setSave}</Text>
    </Pressable>
  );

  /* ── الأرقام ── */
  const homePick: HeaderStatKey[] = home.stats ? home.statsPick : [];
  const tapHomeStat = (k: HeaderStatKey) => {
    const next = homePick.includes(k) ? homePick.filter((x) => x !== k) : [...homePick, k];
    if (next.length > STATS_PICK_MAX) return toast.current?.say(w.max, undefined, undefined, "info");
    haptic.pick();
    /* لا شيء ⇒ البطاقةُ مخفيّة، والقائمةُ المحفوظةُ تبقى (لا تقلّ عن رقمٍ عند الخادم) فتعود كما كانت إن رجع إليها */
    setHome(next.length ? { ...home, stats: true, statsPick: next } : { ...home, stats: false });
  };
  const profileStatMeta: Record<ProfileStatKey, { icon: string; label: string }> = {
    shows: { icon: "tv", label: t.shortShows },
    movies: { icon: "film", label: t.shortMovies },
    anime: { icon: "sparkles", label: t.discoverTabAnime },
    stats: { icon: "chart", label: t.custStatsShort },
  };
  const profilePick: ProfileStatKey[] = profile.stats ? profile.statsPick : [];
  const tapProfileStat = (k: ProfileStatKey) => {
    const next = profilePick.includes(k) ? profilePick.filter((x) => x !== k) : [...profilePick, k];
    haptic.pick();
    /* «٣ب» — بابُ «الإحصائيات» خليّةٌ منها فـ`statsLink` يتبعها */
    setProfile(next.length ? { ...profile, stats: true, statsPick: next, statsLink: next.includes("stats") } : { ...profile, stats: false });
  };

  const overlay = ask ? (
    <Sheet title={t.setUnsavedTitle} placement="center" onClose={() => setAsk(false)}>
      <Text size={14} muted style={{ lineHeight: 21 }}>{t.setUnsavedBody}</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <Button label={t.setKeepEditing} variant="ghost" style={{ flex: 1 }} onPress={() => setAsk(false)} />
        <Button
          label={t.setDiscard}
          variant="danger"
          style={{ flex: 1 }}
          onPress={() => {
            setAsk(false);
            leave();
          }}
        />
      </View>
    </Sheet>
  ) : askReset ? (
    <Sheet title={w.resetTitle} placement="center" onClose={() => setAskReset(false)}>
      <Text size={14} muted style={{ lineHeight: 21 }}>{w.resetBody(tabNames[tab])}</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <Button label={w.cancel} variant="ghost" style={{ flex: 1 }} onPress={() => setAskReset(false)} />
        <Button
          label={w.resetDo}
          variant="danger"
          style={{ flex: 1 }}
          onPress={() => {
            setAskReset(false);
            haptic.pick();
            /* D-1487 — افتراضيُّ خطّته؛ مسودّةٌ لا حفظ، و«تراجع» يعيد ما كان قبلها */
            if (tab === "home") {
              const before = home;
              setHome(defaultHomePrefs(d.plus));
              toast.current?.say(w.resetDone, { label: w.undo, onPress: () => setHome(before) }, 4500, "info");
            } else {
              const before = profile;
              setProfile(defaultProfilePrefs(d.plus));
              toast.current?.say(w.resetDone, { label: w.undo, onPress: () => setProfile(before) }, 4500, "info");
            }
          }}
        />
      </View>
    </Sheet>
  ) : null;

  const poster = (value: Density, onPick: (v: Density) => void) => (
    <Section label={t.custPosterSize} plus={locks}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {DENSITIES.map((k) => (
          <PosterTile
            key={k}
            size={k}
            label={posterLabel[k]}
            active={value === k}
            onPress={() => {
              haptic.pick();
              onPick(k);
            }}
          />
        ))}
      </View>
    </Section>
  );

  return (
    <SettingsScreen
      title={t.custTitle}
      toast={toast}
      onBack={back}
      action={saveAction}
      gestures={{ locked }}
      pinned={
        <>
          <Segmented
            items={[
              { id: "home", label: t.custTabHome },
              { id: "profile", label: t.custTabProfile },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
          <CustomizePreview kind={tab} who={who} home={home} profile={profile} open={previewOpen} onToggle={togglePreview} values={values} />
        </>
      }
      overlay={overlay}
    >
      <GestureDetector gesture={swipe}>
        <View collapsable={false} style={{ gap: 16 }}>
          {tab === "home" ? (
            <>
              <Section label={t.custHeaderSection} hint={w.statsHint} plus={locks}>
                {homePick.length === 0 ? (
                  <View style={{ minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Text size={13} muted>{w.statsHidden}</Text>
                  </View>
                ) : null}
                <PickGrid all={HEADER_STATS} picked={homePick} meta={statMeta} values={values} onTap={tapHomeStat} />
              </Section>

              <Section label={t.custSectionsTitle} hint={t.custSectionsHint} plus={locks}>
                <Card>
                  <ArrangeList all={HOME_SECTIONS} picked={home.order} meta={homeSectionMeta(t)} thumbs onDragChange={setLocked} onChange={(order) => setHome({ ...home, order })} />
                </Card>
              </Section>

              {poster(home.density, (density) => setHome({ ...home, density }))}
            </>
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 }}>
                <Text size={13} muted style={{ flex: 1 }}>{w.asOthers}</Text>
                {username ? <Button label={w.openPage} size="sm" variant="ghost" onPress={() => router.push({ pathname: "/u/[username]", params: { username } })} /> : null}
              </View>

              <Section label={t.custProfileHeader} hint={w.profileStatsHint} plus={locks}>
                <PickGrid all={PROFILE_STATS} picked={profilePick} meta={profileStatMeta} columns={4} onTap={tapProfileStat} />
              </Section>

              <Section label={t.custTabsTitle} hint={t.custTabsHint} plus={locks}>
                <Card>
                  <ArrangeList
                    all={HIDEABLE_PROFILE_TABS}
                    picked={visibleTabs}
                    meta={profileTabMeta(t)}
                    thumbs
                    onDragChange={setLocked}
                    onChange={(picked) => {
                      /* وصفةُ `ProfileCustomize` حرفاً: الظاهرُ بترتيبه ثمّ المخفيُّ بترتيبه القديم */
                      const hidden = orderedProfileTabs(profile).filter((k) => !picked.includes(k));
                      setProfile({ ...profile, tabOrder: [...picked, ...hidden], hiddenTabs: HIDEABLE_PROFILE_TABS.filter((k): k is HideableProfileTab => hidden.includes(k)) });
                    }}
                  />
                </Card>
              </Section>

              <Section label={t.custOverviewTab} hint={t.custProfileHint} plus={locks}>
                <Card>
                  <ArrangeList all={PROFILE_SECTIONS} picked={profile.order} meta={profileSectionMeta(t)} thumbs onDragChange={setLocked} onChange={(order) => setProfile({ ...profile, order })} />
                </Card>
              </Section>

              <Section label={t.custListsTab} plus={locks}>
                <Group>
                  <Toggle icon="bookmark" label={t.savedListsSection} hint={w.savedListsHint} checked={profile.savedLists} onChange={() => setProfile({ ...profile, savedLists: !profile.savedLists })} />
                </Group>
              </Section>

              {poster(profile.density, (density) => setProfile({ ...profile, density }))}
            </>
          )}

          <Group>
            <Row icon="repeat" title={t.custResetShort} subtitle={w.resetHint} trailing={null} onPress={() => setAskReset(true)} />
          </Group>
        </View>
      </GestureDetector>
    </SettingsScreen>
  );
}

/** عنوانُ المجموعة بشارة بلس لغير المشترك — `Group` يأخذ نصّاً، والشارةُ تحتاج صفّاً */
function Section({ label, hint, plus, children }: { label: string; hint?: string; plus?: boolean; children: React.ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, marginBottom: hint ? 2 : 6 }}>
        <Text size={12} weight="600" muted>{label}</Text>
        {plus ? <StatusPill label="PLUS" /> : null}
      </View>
      {hint ? <Text size={12} muted style={{ paddingHorizontal: 4, marginBottom: 8, lineHeight: 17 }}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const { tokens } = useApp();
  return <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface, paddingHorizontal: 8, paddingVertical: 4 }}>{children}</View>;
}

/**
 * شبكةُ اختيارٍ بالترتيب: كلُّ خانةٍ اسمُها كبيرٌ وقيمتُها صغيرة (الاسمُ ما تختار به، والقيمةُ تأكيد)،
 * والمختارُ يحمل رقمَ موضعه في زاويته. الشكلُ واحدٌ لأرقام الرئيسيّة وبطاقة الملفّ.
 */
function PickGrid<K extends string>({
  all,
  picked,
  meta,
  values,
  columns = 3,
  onTap,
}: {
  all: readonly K[];
  picked: K[];
  meta: Record<K, { icon: string; label: string }>;
  values?: Map<string, string>;
  columns?: number;
  onTap: (k: K) => void;
}) {
  const { tokens } = useApp();
  const basis = columns === 4 ? "23%" : "31.5%";
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {all.map((k) => {
        const at = picked.indexOf(k);
        const on = at >= 0;
        const value = values?.get(k);
        return (
          <Pressable
            key={k}
            onPress={() => onTap(k)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={on ? `${meta[k].label} — ${at + 1}` : meta[k].label}
            style={({ pressed }) => ({
              flexBasis: basis,
              flexGrow: 1,
              minHeight: 64,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: on ? tokens.accent : tokens.border,
              backgroundColor: on ? tokens.accent + "1A" : tokens.surface,
              paddingVertical: 10,
              paddingHorizontal: 8,
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            {on ? (
              <View style={{ position: "absolute", top: 5, end: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
                <Text size={11} weight="800" color={tokens.onAccent}>{at + 1}</Text>
              </View>
            ) : null}
            <Icon name={iconOr(meta[k].icon, "list")} size={16} color={on ? tokens.accent : tokens.muted} />
            <Text size={13} weight="700" numberOfLines={1} style={{ textAlign: "center" }}>{meta[k].label}</Text>
            {value ? <Text size={11} muted numberOfLines={1}>{value}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** خانةُ حجم الملصق — ملصقاتٌ بحجمها الحقيقيّ نسبةً، فالفرقُ يُرى قبل أن يُختار */
function PosterTile({ size, label, active, onPress }: { size: Density; label: string; active: boolean; onPress: () => void }) {
  const { tokens } = useApp();
  const shape = size === "compact" ? { n: 4, w: 13 } : size === "comfortable" ? { n: 3, w: 18 } : { n: 2, w: 25 };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: active ? tokens.accent : tokens.border,
        backgroundColor: active ? tokens.accent + "1A" : tokens.surface,
        paddingVertical: 12,
        alignItems: "center",
        gap: 8,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flexDirection: "row", gap: 3, height: 40, alignItems: "flex-end" }}>
        {Array.from({ length: shape.n }).map((_, i) => (
          <View key={i} style={{ width: shape.w, height: shape.w * 1.5, borderRadius: 3, backgroundColor: active ? tokens.accent : tokens.surface2 }} />
        ))}
      </View>
      <Text size={13} weight={active ? "700" : "600"} color={active ? tokens.accent : tokens.fg}>{label}</Text>
    </Pressable>
  );
}
