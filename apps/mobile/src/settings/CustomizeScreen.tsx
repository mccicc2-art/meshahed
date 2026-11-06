import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
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
 * 🆕 D-1630 — **«التخصيص» من جديد: كلُّ خيارٍ صورةٌ تُرى، وكلُّ لمسةٍ تُحفظ** (أحمد ٦ نوفمبر، «ب» ثمّ «نفذ و ارفع»).
 * بلاغُه: «سيئة وغير مفهومة… اجعل المعاينة عند كلِّ خيار». فالصفحةُ القديمة (D-1112 · D-1322) تغيّرت هكذا:
 * - **المعاينةُ الكبيرةُ المثبّتة حُذفت** — كلُّ خيارٍ يحمل معاينتَه: شبكةُ الأرقام ببطاقتها فوقها، أقسامٌ بصورٍ مصغّرة،
 *   أحجامُ الملصق بملصقاتٍ بأحجامها.
 * - **«تنسيقاتي» و«طريقة العرض» و«عدد البطاقات» حُذفت** — العرضُ زرُّه في رأس الرئيسيّة، والعددُ «الكلّ» للجميع
 *   (`sanitizeCardCount("full")` في الأساس، والاختيارُ القديمُ يُهمل).
 * - **لا زرَّ «حفظ»**: كلُّ تغييرٍ يُكتب بعد لحظةٍ («الأحدثُ يفوز» — `seq`)، ومكانَ الزرّ «✓ محفوظ»، وبعد كلِّ تغييرٍ
 *   «تم · تراجع». فلا ورقةَ «تعديلاتٌ لم تُحفظ» ولا خسارةَ عند الرجوع (الخروجُ يُفرغ المنتظر).
 * - **الأرقامُ شبكةٌ تُختار باللمس**: لا شيء (البطاقةُ تختفي) أو ١–٤ بترتيب اللمس، وعلى كلِّ مختارٍ رقمُ موضعه.
 * - **الأقسامُ والتبويباتُ قوائمُ في الصفحة نفسِها** (`ArrangeList`): سحبٌ بـ≡ وعينٌ للإخفاء.
 * - **الاستعادةُ تسأل أوّلاً** («٤أ») ثمّ تُحفظ، و«تراجع» يعيد ما كان.
 * 🔒 **بلس** يحكمه الخادم (`plus` و`needsPlus`): كلُّ حقول الصفحة مدفوعةٌ اليوم (`PLUS_*_FIELDS`)، فغيرُ المشترك يرى
 * الشارةَ على المجموعة، ولمستُه تفتح صفحةَ بلس بدل أن تغيّر شيئاً — كان يجرّب في المعاينة ثمّ يُصدّ عند «حفظ»، والحفظُ
 * التلقائيُّ لا مكانَ فيه لتجربةٍ لا تُحفظ.
 */
const KEY = ["me:customize"] as const;
type Tab = "home" | "profile";
/** مهلةُ الحفظ بعد آخر لمسة — تجمع لمساتِ ترتيبٍ متتالية في نداءٍ واحد */
const SAVE_DELAY = 600;

/** النصوصُ الجديدةُ محلّيّة — `i18n.ts` محجوزٌ لمهمّة الودجت (٢٧٤) في السجلّ، كـ`RATERS_WORDS` */
const WORDS = {
  ar: {
    saved: "✓ محفوظ",
    saving: "يحفظ…",
    failed: "لم يُحفظ",
    done: "تم",
    undo: "تراجع",
    max: `${STATS_PICK_MAX} أرقام على الأكثر`,
    statsHint: "اختر حتى ٤ بترتيب اللمس — ولا شيء يُخفي البطاقة",
    statsHidden: "البطاقةُ مخفيّة",
    profileStatsHint: "اختر ما يظهر في بطاقة صفحتك — ولا شيء يُخفيها",
    asOthers: "هذه صفحتك كما يراها غيرك",
    openPage: "افتح صفحتك",
    savedListsHint: "القوائمُ التي حفظتَها من غيرك تظهر في تبويب القوائم",
    resetTitle: "استعادة الافتراضيّ؟",
    resetBody: (tab: string) => `يعود تبويب «${tab}» كما كان أوّل مرّة — وتقدر تتراجع بعدها.`,
    resetDo: "استعادة",
    cancel: "إلغاء",
    resetHint: "يعيد هذا التبويب إلى الافتراضيّ",
  },
  en: {
    saved: "✓ Saved",
    saving: "Saving…",
    failed: "Not saved",
    done: "Done",
    undo: "Undo",
    max: `${STATS_PICK_MAX} numbers at most`,
    statsHint: "Pick up to 4 in tap order — none hides the card",
    statsHidden: "The card is hidden",
    profileStatsHint: "Pick what your page's card shows — none hides it",
    asOthers: "This is your page as others see it",
    openPage: "Open your page",
    savedListsHint: "Lists you saved from others appear in the Lists tab",
    resetTitle: "Restore defaults?",
    resetBody: (tab: string) => `The «${tab}» tab goes back to how it started — you can undo it after.`,
    resetDo: "Restore",
    cancel: "Cancel",
    resetHint: "Returns this tab to its defaults",
  },
} as const;

type Draft = { home?: HomePrefs; profile?: ProfilePrefs };

export function CustomizeScreen() {
  const { t, tokens, locale } = useApp();
  const w = WORDS[locale === "en" ? "en" : "ar"];
  const router = useRouter();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const q = useQuery({ queryKey: KEY, queryFn: async () => (await api<CustomizePayload>("/api/v1/me/customize")).data, staleTime: 0 });
  const d = q.data;

  /* 🆕 D-1488 — بطاقةُ «خصّص ملفك» تفتح الشاشةَ على تبويب الملفّ (`?tab=profile`) */
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "profile" ? "profile" : "home");
  const [home, setHomeState] = useState<HomePrefs | null>(null);
  const [profile, setProfileState] = useState<ProfilePrefs | null>(null);
  /* المراجعُ نسخةُ الحالة للدوالّ المؤجّلة (المؤقّت · التراجع · التنظيف عند الخروج) — الحالةُ في إغلاقها قديمة */
  const homeRef = useRef<HomePrefs | null>(null);
  const profileRef = useRef<ProfilePrefs | null>(null);
  /** آخرُ ما أكّده الخادم — إليه نعود عند الفشل أو `needsPlus` */
  const baseRef = useRef<{ home: HomePrefs; profile: ProfilePrefs } | null>(null);
  const plusRef = useRef(false);
  const pending = useRef<Draft>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const applied = useRef(0);
  const [status, setStatus] = useState<"saved" | "saving" | "failed">("saved");
  const [locked, setLocked] = useState(false);
  const [askReset, setAskReset] = useState(false);

  const setHome = (h: HomePrefs) => {
    homeRef.current = h;
    setHomeState(h);
  };
  const setProfile = (p: ProfilePrefs) => {
    profileRef.current = p;
    setProfileState(p);
  };

  useEffect(() => {
    if (d && !baseRef.current) {
      baseRef.current = { home: d.home, profile: d.profile };
      plusRef.current = d.plus;
      setHome(d.home);
      setProfile(d.profile);
    }
  }, [d]);

  /* اسمُ العضو من كاشَين قائمَين (ترويسةُ الرئيسيّة ثمّ الإعدادات) — لزرّ «افتح صفحتك» ولإبطال كاش صفحته */
  const head = queryClient.getQueryData<HomePayload>(HOME_KEY)?.header;
  const account = queryClient.getQueryData<SettingsPayload>(SETTINGS_KEY)?.account;
  const username = head?.username ?? account?.username ?? null;
  const usernameRef = useRef(username);
  usernameRef.current = username;

  function revert() {
    const b = baseRef.current;
    if (!b) return;
    setHome(b.home);
    setProfile(b.profile);
  }

  /** يرسل المنتظرَ الآن — من المؤقّت، ومن التنظيف عند الخروج فلا يضيع آخرُ تغيير */
  function flush() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const body: CustomizeSaveBody = { ...pending.current };
    pending.current = {};
    if (!body.home && !body.profile) return;
    const my = ++seq.current;
    setStatus("saving");
    write<CustomizeSaveResult>("/api/v1/me/customize", body)
      .then((out) => {
        if (out.needsPlus || !out.data) {
          if (my === seq.current) {
            revert();
            setStatus("saved");
            openWeb("/plus");
          }
          return;
        }
        /* «الأحدثُ يفوز»: ردٌّ أقدمُ يصل بعد أحدثَ لا يكتب فوقه */
        if (my > applied.current) {
          applied.current = my;
          baseRef.current = { home: out.data.home, profile: out.data.profile };
          queryClient.setQueryData(KEY, out.data);
          void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
          /* D-1323 — الرئيسيّةُ ترسم المحفوظَ فوراً، ثمّ تُجلب لتأتي قيمُ الأرقام الجديدة المختارة */
          const saved = out.data.home;
          queryClient.setQueryData<HomePayload>(HOME_KEY, (prev) => (prev ? { ...prev, prefs: saved } : prev));
          void queryClient.invalidateQueries({ queryKey: HOME_KEY });
          if (body.profile && usernameRef.current) void queryClient.invalidateQueries({ queryKey: profileKey(usernameRef.current) });
        }
        if (my === seq.current) setStatus("saved");
      })
      .catch((e) => {
        if (my !== seq.current) return;
        revert();
        setStatus("failed");
        toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.errSaveShort), undefined, undefined, "error");
      });
  }

  /* الخروجُ لا ينتظر المؤقّت: ما لُمس يُرسل الآن */
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * التغييرُ الواحد: بوّابةُ بلس ← الحالة ← الحفظُ المؤجّل ← «تم · تراجع».
   * التراجعُ تغييرٌ مثلُه (يُحفظ) بلا إشعارِ تراجعٍ ثانٍ.
   */
  function change(next: Draft, undoable = true) {
    const curH = homeRef.current;
    const curP = profileRef.current;
    if (!curH || !curP) return;
    const paid = (next.home && touchesPaidHomePrefs(curH, next.home)) || (next.profile && touchesPaidProfilePrefs(curP, next.profile));
    if (!plusRef.current && paid) {
      haptic.pick();
      return openWeb("/plus");
    }
    haptic.pick();
    const prev: Draft = { ...(next.home ? { home: curH } : {}), ...(next.profile ? { profile: curP } : {}) };
    if (next.home) {
      setHome(next.home);
      pending.current.home = next.home;
    }
    if (next.profile) {
      setProfile(next.profile);
      pending.current.profile = next.profile;
    }
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
    if (undoable) toast.current?.say(w.done, { label: w.undo, onPress: () => change(prev, false) }, 4000, "success");
  }

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
  const values = new Map((head?.stats ?? []).map((s) => [s.key, s.value]));
  const visibleTabs = orderedProfileTabs(profile).filter((k) => !profile.hiddenTabs.includes(k));
  const tabNames: Record<Tab, string> = { home: t.custTabHome, profile: t.custTabProfile };

  /* مكانُ «حفظ» القديم — حالةٌ تُقرأ لا زرٌّ يُضغط */
  const statusAction = (
    <View style={{ height: 44, justifyContent: "center", paddingHorizontal: 4 }} accessibilityLiveRegion="polite">
      <Text size={13} weight="700" color={status === "failed" ? tokens.error : status === "saving" ? tokens.muted : tokens.success}>
        {status === "failed" ? w.failed : status === "saving" ? w.saving : w.saved}
      </Text>
    </View>
  );

  /* ── الأرقام ── */
  const homePick: HeaderStatKey[] = home.stats ? home.statsPick : [];
  const tapHomeStat = (k: HeaderStatKey) => {
    const next = homePick.includes(k) ? homePick.filter((x) => x !== k) : [...homePick, k];
    if (next.length > STATS_PICK_MAX) return toast.current?.say(w.max, undefined, undefined, "info");
    /* لا شيء ⇒ البطاقةُ مخفيّة، والقائمةُ المحفوظةُ تبقى (لا تقلّ عن رقمٍ عند الخادم) فتعود كما كانت إن رجع إليها */
    change({ home: next.length ? { ...home, stats: true, statsPick: next } : { ...home, stats: false } });
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
    /* «٣ب» — الخلايا الأربع تُختار؛ بابُ «الإحصائيات» خليّةٌ منها فـ`statsLink` يتبعها (الويبُ القديمُ يقرؤه) */
    change({ profile: next.length ? { ...profile, stats: true, statsPick: next, statsLink: next.includes("stats") } : { ...profile, stats: false } });
  };

  const resetSheet = askReset ? (
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
            /* D-1487 — افتراضيُّ خطّته */
            change(tab === "home" ? { home: defaultHomePrefs(d.plus) } : { profile: defaultProfilePrefs(d.plus) });
          }}
        />
      </View>
    </Sheet>
  ) : null;

  const poster = (value: Density, onPick: (v: Density) => void) => (
    <Section label={t.custPosterSize} plus={locks}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {DENSITIES.map((k) => (
          <PosterTile key={k} size={k} label={posterLabel[k]} active={value === k} onPress={() => onPick(k)} />
        ))}
      </View>
    </Section>
  );

  return (
    <SettingsScreen
      title={t.custTitle}
      toast={toast}
      action={statusAction}
      gestures={{ locked }}
      pinned={
        <Segmented
          items={[
            { id: "home", label: t.custTabHome },
            { id: "profile", label: t.custTabProfile },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      }
      overlay={resetSheet}
    >
      {tab === "home" ? (
        <>
          <Section label={t.custHeaderSection} hint={w.statsHint} plus={locks}>
            {/* المعاينةُ فوق الشبكة: البطاقةُ كما ستظهر في الرئيسيّة، بالقيم التي نعرفها */}
            <View style={{ flexDirection: "row", borderRadius: radius.md, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, minHeight: 56, alignItems: "stretch", marginBottom: 10 }}>
              {homePick.length ? (
                homePick.map((k, i) => (
                  <View key={k} style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, borderStartWidth: i ? 1 : 0, borderStartColor: tokens.divider }}>
                    <Text size={15} weight="800" numberOfLines={1}>{values.get(k) ?? "—"}</Text>
                    <Text size={11} muted numberOfLines={1}>{statMeta[k].label}</Text>
                  </View>
                ))
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Text size={13} muted>{w.statsHidden}</Text>
                </View>
              )}
            </View>
            <PickGrid all={HEADER_STATS} picked={homePick} meta={statMeta} values={values} onTap={tapHomeStat} />
          </Section>

          <Section label={t.custSectionsTitle} hint={t.custSectionsHint} plus={locks}>
            <Card>
              <ArrangeList all={HOME_SECTIONS} picked={home.order} meta={homeSectionMeta(t)} thumbs onDragChange={setLocked} onChange={(order) => change({ home: { ...home, order } })} />
            </Card>
          </Section>

          {poster(home.density, (density) => change({ home: { ...home, density } }))}
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
                  change({ profile: { ...profile, tabOrder: [...picked, ...hidden], hiddenTabs: HIDEABLE_PROFILE_TABS.filter((k): k is HideableProfileTab => hidden.includes(k)) } });
                }}
              />
            </Card>
          </Section>

          <Section label={t.custOverviewTab} hint={t.custProfileHint} plus={locks}>
            <Card>
              <ArrangeList all={PROFILE_SECTIONS} picked={profile.order} meta={profileSectionMeta(t)} thumbs onDragChange={setLocked} onChange={(order) => change({ profile: { ...profile, order } })} />
            </Card>
          </Section>

          <Section label={t.custListsTab} plus={locks}>
            <Group>
              <Toggle icon="bookmark" label={t.savedListsSection} hint={w.savedListsHint} checked={profile.savedLists} onChange={() => change({ profile: { ...profile, savedLists: !profile.savedLists } })} />
            </Group>
          </Section>

          {poster(profile.density, (density) => change({ profile: { ...profile, density } }))}
        </>
      )}

      <Group>
        <Row icon="repeat" title={t.custResetShort} subtitle={w.resetHint} trailing={null} onPress={() => setAskReset(true)} />
      </Group>
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
 * شبكةُ اختيارٍ بالترتيب: كلُّ خانةٍ اسمُها كبيرٌ وقيمتُها صغيرة (التحسين ٥ — الاسمُ ما تختار به، والقيمةُ تأكيد)،
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
