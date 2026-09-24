import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { api, queryClient, write } from "../api";
import { Chip } from "../library/Chip";
import { Sheet } from "../library/Sheet";
import { Segmented } from "../library/ToolsSheet";
import { ArrangeSheet } from "../home/SectionOrderSheet";
import type { ToastHostRef } from "../HoldHost";
import type { CustomizePayload, CustomizeSaveBody, CustomizeSaveResult, TemplatesBody } from "../contracts";
import { SettingsScreen, Group, Row, Toggle, Field, RowsSkeleton } from "./ui";
import { SETTINGS_KEY, messageOf, useOpenWeb } from "./api";
import {
  DEFAULT_HOME_PREFS,
  HEADER_STATS,
  HOME_SECTIONS,
  HOME_VIEWS,
  STATS_PICK_MAX,
  STATS_PICK_MIN,
  headerStatMeta,
  homeSectionMeta,
  sanitizeHomePrefs,
  type HomePrefs,
} from "@/core/homePrefs";
import {
  DEFAULT_PROFILE_PREFS,
  HIDEABLE_PROFILE_TABS,
  PROFILE_SECTIONS,
  orderedProfileTabs,
  profileSectionMeta,
  profileTabMeta,
  sanitizeProfilePrefs,
  type HideableProfileTab,
  type ProfilePrefs,
} from "@/core/profilePrefs";
import { CARD_COUNTS, type CardCount } from "@/core/cardCount";
import { DENSITIES, type Density } from "@/core/density";
import {
  TEMPLATES_CAP,
  TEMPLATE_NAME_MAX,
  newTemplateId,
  removeTemplate,
  sanitizeTemplateName,
  templatesOf,
  upsertTemplate,
  type PrefTemplate,
  type TemplateSurface,
} from "@/core/prefTemplates";

/**
 * 🆕 D-1112 — «الرئيسيّة والملفّ» أصليّةً (Phase 11-I · I3) — `CustomizeScreen` الويبيّة بخياراتها كلِّها:
 * تبويبان (الرئيسيّة · الملفّ) · قوالبُ «احفظ هذا التنسيق» (D-822) · رأسُ الصفحة (الأرقام وخاناتُها) ·
 * ترتيبُ الأقسام والتبويبات وإخفاؤها · العرض (المظهر · عددُ البطاقات · حجمُ الملصق) · قوائمُ محفوظة · استعادة.
 *
 * ⚖️ **فرقان عن الويب، وكلاهما لصالح الهاتف**:
 * ١) **مسودّتان لا مسودّةٌ واحدة**: في الويب يُفكّ اللوحُ عند تبديل التبويب فيضيع ما لم يُحفظ فيه صامتاً؛
 *    هنا كلُّ تبويبٍ يحفظ مسودّتَه، و«حفظ» في الترويسة يرسل ما تغيّر منهما في نداءٍ واحد.
 * ٢) **«حفظ» في الترويسة وورقةُ «تعديلاتٌ لم تُحفظ» عند الرجوع** — نمطُ «تعديل الملفّ» الأصليّ (D-1106)
 *    بدل شريط الحفظ العائم.
 * ⚠️ **والمعاينةُ المصغّرة (`CustomizePreview`) لم تُنقل**: رسمٌ مصغّرٌ للرئيسيّة بلا فعل — الترتيبُ يُرى في
 * ورقته، والنتيجةُ في الرئيسيّة نفسِها بعد الحفظ. **دَينٌ معلَنٌ لا منسيّ.**
 * 🔒 **بلس** يحكمه الخادم (`plus` في الحمولة و`needsPlus` في الردّ) — غيرُ المشترك يجرّب ويرى، و«حفظ» يفتح
 * صفحةَ بلس كما تفعل ورقةُ الترتيب في الرئيسيّة.
 */
const KEY = ["me:customize"] as const;
type Tab = "home" | "profile";

export function CustomizeScreen() {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const q = useQuery({ queryKey: KEY, queryFn: async () => (await api<CustomizePayload>("/api/v1/me/customize")).data, staleTime: 0 });
  const d = q.data;

  const [tab, setTab] = useState<Tab>("home");
  const [base, setBase] = useState<{ home: HomePrefs; profile: ProfilePrefs } | null>(null);
  const [home, setHome] = useState<HomePrefs | null>(null);
  const [profile, setProfile] = useState<ProfilePrefs | null>(null);
  const [tpl, setTpl] = useState<PrefTemplate[]>([]);
  useEffect(() => {
    if (d && !base) {
      setBase({ home: d.home, profile: d.profile });
      setHome(d.home);
      setProfile(d.profile);
      setTpl(d.templates);
    }
  }, [d, base]);

  const [sheet, setSheet] = useState<"sections" | "stats" | "tabs" | "overview" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);

  const homeDirty = !!home && !!base && JSON.stringify(home) !== JSON.stringify(base.home);
  const profileDirty = !!profile && !!base && JSON.stringify(profile) !== JSON.stringify(base.profile);
  const dirty = homeDirty || profileDirty;

  async function save() {
    if (!d || !home || !profile || !dirty || saving) return;
    if (!d.plus) return openWeb("/plus");
    setError(null);
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
      haptic.success();
      toast.current?.say(t.setSaved);
    } catch (e) {
      setError(messageOf(e, t as unknown as Record<string, unknown>, t.errSaveShort));
    } finally {
      setSaving(false);
    }
  }

  const back = () => {
    if (dirty) return setAsk(true);
    if (router.canGoBack()) router.back();
  };

  /* «حفظ» الترويسة — زرُّ «تعديل الملفّ» نفسُه (D-1106) لا زرٌّ ثانٍ بشكلٍ آخر */
  const saveAction = (
    <Pressable onPress={() => void save()} disabled={!dirty || saving} hitSlop={10} accessibilityRole="button" style={{ height: 44, justifyContent: "center", paddingHorizontal: 4 }}>
      <Text size={14} weight="700" color={dirty && !saving ? tokens.accent : tokens.muted}>{saving ? t.saving : t.setSave}</Text>
    </Pressable>
  );

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
            if (router.canGoBack()) router.back();
          }}
        />
      </View>
    </Sheet>
  ) : null;

  if (!d || !home || !profile) {
    return (
      <SettingsScreen title={t.custTitle}>
        {q.isError ? <Text muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.apiInternal}</Text> : <RowsSkeleton rows={6} />}
      </SettingsScreen>
    );
  }

  const posterLabel: Record<Density, string> = { compact: t.custPosterS, comfortable: t.custPosterM, large: t.custPosterL };
  const cardsLabel: Record<CardCount, string> = { compact: t.cardsCompact, medium: t.cardsMedium, full: t.cardsFull };
  /* صفُّ اختيارٍ واحد — عائلةُ الرقاقة (`chipClass` في الويب) باسمه في طرفه */
  const choice = <K extends string>(label: string, all: readonly K[], value: K, names: Record<K, string>, onPick: (k: K) => void) => (
    <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
      <Text size={15} weight="600">{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {all.map((k) => (
          <Chip key={k} label={names[k]} active={value === k} onPress={() => onPick(k)} />
        ))}
      </View>
    </View>
  );

  const statMeta = headerStatMeta(t);
  const visibleTabs = orderedProfileTabs(profile).filter((k) => !profile.hiddenTabs.includes(k));

  return (
    <SettingsScreen title={t.custTitle} toast={toast} onBack={back} action={saveAction} overlay={
      <>
        {overlay}
        {sheet === "sections" ? (
          <ArrangeSheet title={t.custArrange} hint={t.custOrderHint} all={HOME_SECTIONS} picked={home.order} meta={homeSectionMeta(t)} onClose={() => setSheet(null)} onDone={(order) => { setHome({ ...home, order }); setSheet(null); }} />
        ) : sheet === "stats" ? (
          <ArrangeSheet title={t.custArrangeStats} hint={t.custStatsPickHint} all={HEADER_STATS} picked={home.statsPick} meta={statMeta} min={STATS_PICK_MIN} max={STATS_PICK_MAX} onClose={() => setSheet(null)} onDone={(statsPick) => { setHome({ ...home, statsPick }); setSheet(null); }} />
        ) : sheet === "tabs" ? (
          <ArrangeSheet
            title={t.custTabsTitle}
            hint={t.custTabsHint}
            all={HIDEABLE_PROFILE_TABS}
            picked={visibleTabs}
            meta={profileTabMeta(t)}
            onClose={() => setSheet(null)}
            onDone={(picked) => {
              /* وصفةُ `ProfileCustomize` حرفاً: الظاهرُ بترتيبه ثمّ المخفيُّ بترتيبه القديم */
              const hidden = orderedProfileTabs(profile).filter((k) => !picked.includes(k));
              setProfile({ ...profile, tabOrder: [...picked, ...hidden], hiddenTabs: HIDEABLE_PROFILE_TABS.filter((k): k is HideableProfileTab => hidden.includes(k)) });
              setSheet(null);
            }}
          />
        ) : sheet === "overview" ? (
          <ArrangeSheet title={t.custArrange} hint={t.custOrderHint} all={PROFILE_SECTIONS} picked={profile.order} meta={profileSectionMeta(t)} onClose={() => setSheet(null)} onDone={(order) => { setProfile({ ...profile, order }); setSheet(null); }} />
        ) : null}
      </>
    }>
      <Segmented
        items={[
          { id: "home", label: t.custTabHome },
          { id: "profile", label: t.custTabProfile },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      <Templates
        key={tab}
        surface={tab}
        list={tpl}
        setList={setTpl}
        current={(tab === "home" ? home : profile) as unknown as Record<string, unknown>}
        onApply={(p) => (tab === "home" ? setHome(sanitizeHomePrefs(p)) : setProfile(sanitizeProfilePrefs(p)))}
        plus={d.plus}
        ar={locale !== "en"}
        onPlus={() => openWeb("/plus")}
      />

      {error ? <Text size={13} color={tokens.error}>{error}</Text> : null}

      {tab === "home" ? (
        <>
          <Group label={t.custHeaderSection}>
            <Toggle icon="chart" label={t.custStatsShort} checked={home.stats} onChange={() => setHome({ ...home, stats: !home.stats })} />
            <Row icon="chart" title={t.custStatsCard} value={t.custShownN(home.statsPick.length)} onPress={() => setSheet("stats")} />
          </Group>
          <Group label={t.custSectionsTitle}>
            <Row icon="grip" title={t.custArrange} subtitle={t.custSectionsHint} value={t.custShownN(home.order.length)} onPress={() => setSheet("sections")} />
          </Group>
          <Group label={t.custDisplay}>
            {choice(t.custHomeView, HOME_VIEWS, home.view, { visual: t.viewVisual, compact: t.viewCompact }, (view) => setHome({ ...home, view }))}
            {choice(t.custLayout, CARD_COUNTS, home.cards, cardsLabel, (cards) => setHome({ ...home, cards }))}
            {choice(t.custPosterSize, DENSITIES, home.density, posterLabel, (density) => setHome({ ...home, density }))}
          </Group>
        </>
      ) : (
        <>
          <Group label={t.custProfileHeader}>
            <Toggle icon="chart" label={t.custStatsShort} checked={profile.stats} onChange={() => setProfile({ ...profile, stats: !profile.stats })} />
            {/* 🆕 D-1130 — نظيرُ الويب: بابُ «الإحصائيات» يُخفى وحدَه، ولا يُعرض والبطاقةُ مخفيّة */}
            {profile.stats ? <Toggle icon="chart" label={t.custStatsLink} hint={t.custStatsLinkHint} checked={profile.statsLink} onChange={() => setProfile({ ...profile, statsLink: !profile.statsLink })} /> : null}
          </Group>
          <Group label={t.custTabsTitle}>
            <Row icon="grip" title={t.custArrange} subtitle={t.custSectionsHint} value={t.custShownN(visibleTabs.length)} onPress={() => setSheet("tabs")} />
          </Group>
          <View style={{ gap: 6 }}>
            <Group label={t.custOverviewTab}>
              <Row icon="grip" title={t.custArrange} subtitle={t.custSectionsHint} value={t.custShownN(profile.order.length)} onPress={() => setSheet("overview")} />
            </Group>
            <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>
              {t.custProfileHint}
              {profile.order.length === 0 ? ` — ${t.custProfileEmpty}` : ""}
            </Text>
          </View>
          <Group label={t.custListsTab}>
            <Toggle icon="bookmark" label={t.savedListsSection} checked={profile.savedLists} onChange={() => setProfile({ ...profile, savedLists: !profile.savedLists })} />
          </Group>
          <Group label={t.custDisplay}>
            {choice(t.custLayout, CARD_COUNTS, profile.cards, cardsLabel, (cards) => setProfile({ ...profile, cards }))}
            {choice(t.custPosterSize, DENSITIES, profile.density, posterLabel, (density) => setProfile({ ...profile, density }))}
          </Group>
        </>
      )}

      {/* الاستعادةُ تعيد التبويبَ الظاهرَ إلى افتراضيّه — مسودّةً لا حفظاً، كالويب */}
      <Group>
        <Row
          icon="repeat"
          title={t.custResetShort}
          subtitle={t.custResetHint}
          onPress={() => (tab === "home" ? setHome({ ...DEFAULT_HOME_PREFS }) : setProfile({ ...DEFAULT_PROFILE_PREFS }))}
        />
      </Group>
    </SettingsScreen>
  );
}

/**
 * قوالبُ التخصيص — `PrefTemplatesRow` الويبيّة: رقاقةٌ لكلِّ قالبٍ تطبّقه على المسودّة، و«احفظ هذا التنسيق»
 * باسمٍ حتى ٢٤ حرفاً، و«احذف» للمختار. **القائمةُ تُكتب كاملةً فوراً** (لا مع «حفظ» الترويسة) — كالويب،
 * فالقالبُ ليس تنسيقاً بل لقطةٌ منه. التراجعُ عند الفشل أو `needsPlus`.
 */
function Templates({
  surface,
  list,
  setList,
  current,
  onApply,
  plus,
  ar,
  onPlus,
}: {
  surface: TemplateSurface;
  list: PrefTemplate[];
  setList: (l: PrefTemplate[]) => void;
  current: Record<string, unknown>;
  onApply: (p: Record<string, unknown>) => void;
  plus: boolean;
  ar: boolean;
  onPlus: () => void;
}) {
  const { tokens } = useApp();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const mine = templatesOf(list, surface);
  const full = mine.length >= TEMPLATES_CAP;

  function persist(next: PrefTemplate[]) {
    const before = list;
    setList(next);
    write<{ ok: boolean; needsPlus?: true }>("/api/v1/me/customize/templates", { tpl: next } satisfies TemplatesBody)
      .then((r) => {
        if (r.needsPlus) {
          setList(before);
          onPlus();
        }
      })
      .catch(() => setList(before));
  }
  function saveTpl() {
    if (!plus) return onPlus();
    const clean = sanitizeTemplateName(name);
    if (!clean) return;
    const next = upsertTemplate(list, { id: newTemplateId(), name: clean, s: surface, p: current });
    if (next !== list) persist(next);
    setName("");
    setNaming(false);
  }

  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {mine.map((x) => (
          <Chip
            key={x.id}
            label={x.name}
            active={picked === x.id}
            onPress={() => {
              setPicked(x.id);
              onApply(x.p);
            }}
          />
        ))}
        {!naming && !full ? (
          <Chip label={ar ? "احفظ هذا التنسيق" : "Save this look"} active={false} leading={<Icon name="plus" size={14} color={tokens.muted} />} onPress={() => (plus ? setNaming(true) : onPlus())} />
        ) : null}
      </ScrollView>
      {naming ? (
        <View style={{ borderRadius: 16, backgroundColor: tokens.surface }}>
          <Field label={ar ? "سمِّ التنسيق" : "Name this look"} value={name} onChange={setName} maxLength={TEMPLATE_NAME_MAX} counter />
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingBottom: 12 }}>
            <Button label={ar ? "إلغاء" : "Cancel"} size="sm" variant="ghost" style={{ flex: 1 }} onPress={() => { setNaming(false); setName(""); }} />
            <Button label={ar ? "حفظ" : "Save"} size="sm" style={{ flex: 1 }} disabled={!sanitizeTemplateName(name)} onPress={saveTpl} />
          </View>
        </View>
      ) : null}
      {picked && mine.some((x) => x.id === picked) ? (
        <Text
          size={12}
          color={tokens.error}
          onPress={() => {
            persist(removeTemplate(list, picked));
            setPicked(null);
          }}
        >
          {ar ? "احذف هذا التنسيق" : "Delete this look"}
        </Text>
      ) : null}
      {full ? (
        <Text size={12} muted>
          {ar ? `بلغتَ الحدّ (${TEMPLATES_CAP}) — احذف واحداً لتحفظ غيره` : `Limit reached (${TEMPLATES_CAP}) — delete one to save another`}
        </Text>
      ) : null}
    </View>
  );
}
