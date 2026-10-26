import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  BROWSE_COUNTRIES,
  BROWSE_LENGTHS,
  BROWSE_ERAS,
  BROWSE_GENRES,
  BROWSE_LANGS,
  BROWSE_RATES,
  BROWSE_SEASONS,
  BROWSE_STATUSES,
  BROWSE_STUDIOS,
  BROWSE_TAGS,
  browseCountryName,
  browseEraName,
  browseGenreName,
  browseLangName,
  browseSeasonName,
  browseStatusName,
  browseStudioName,
  browseTagName,
  genreFitsType,
  browseLengthName,
  splitCountries,
} from "@/core/browse";
import { AWARDS, awardName } from "@/core/awards";
import { regionName } from "@/core/region";
import { MY_ROWS_MAX, type MyRow } from "@/core/myRows";
import { guardLastVisible, moveTab, toggleTab, type TabPref } from "@/core/tabPrefs";
import { railsOf, railToken, railsHiddenFor, type RailTab } from "@/core/railPrefs";
import { num } from "@/core/i18n";
import { Switch, Arrow } from "../library/ToolsSheet";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { OneTimeHint } from "../library/OneTimeHint";
import { Chip } from "../library/Chip";
import { axesForTab, axisValueLabel, browseActive, EMPTY_BROWSE, type AxisKey, type BrowseState } from "./browseState";
import type { CuratedTab, ProvidersPayload, DiscoverViewPayload } from "../contracts";

/**
 * ====== ورقةُ الفلاتر الأصليّة — Phase 11-C4 (D-992، ١٦ سبتمبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد بتسجيل: «خلّي الفلتر تطبيق»** — ينقض قرارَ C3 («ورقةُ الفلاتر تبقى ويبيّة»)
 * ويتّسق مع «كلّها أصليّة». الورقةُ `Sheet` المشتركة نفسُها (القاعدة ٣)، ومحاورُها محاورُ
 * `DiscoverFilterSheet` الويب بترتيبها وشروطها: النوعُ بحسب التبويب، الوسمُ، اللغةُ،
 * البلدُ، المنصّةُ (من `/api/v1/discover/providers` مع بلد المشاهدة في العنوان)، الحقبةُ،
 * التقييمُ، الجائزةُ للأفلام والمسلسلات، الحالةُ للمسلسلات، الموسمُ والاستوديو للأنمي.
 *
 * 🔑 **محورٌ = صفٌّ يفتح قائمةَ اختيارٍ واحدة** (Radio)، لا تسعُ قوائمَ منسدلةٍ في شاشةٍ عرضُها
 * ٣٦٠: الصفُّ يقول القيمةَ الحاليّة، والضغطةُ تفتح القائمةَ في الورقة نفسِها وتعود.
 * 🆕 **D-1550**: صار بطاقتين في الصفّ، والضغطةُ تفتح رقائقَ الخيارات تحت صفّها بدل قائمةٍ تحلّ محلَّ الورقة.
 *
 * 🔑 **مسودّةٌ ثمّ تطبيق** كالويب: التغييراتُ تُجمع في `draft`، و«عرض النتائج» يسلّمها
 * دفعةً واحدة — الصفوفُ لا تُعاد بعد كلِّ لمسة.
 */
/**
 * 🆕 D-997 — **لوحُ «عرض» في الورقة نفسِها** (بلاغُ أحمد بلقطتين: «وين الفيو؟»): تبويبا
 * «الأدوات» و«عرض» كالويب (`DiscoverFilterSheet`) — «عرض» يحمل صفوفَك (نوع + موضوع ×٢)،
 * التبويباتِ ترتيباً وإظهاراً، وصفوفَ هذا التبويب. **الحالةُ كوكيٌّ في الخادم** كما في الويب
 * (`/api/v1/discover/view` + `me/prefs/{tabs,hidden-rails,my-rows}`)، والمفاتيحُ (`Switch` ·
 * `Arrow` · `toggleTab` · `moveTab` · `railsOf`) هي مفاتيحُ `ToolsSheet` المكتبة — عائلةٌ واحدة.
 */
export function FilterSheet({
  tab,
  value,
  onApply,
  onClose,
  view,
  onView,
  initialPane = "tools",
  viewOnly = false,
  rowsHint = false,
}: {
  tab: CuratedTab;
  value: BrowseState;
  onApply: (next: BrowseState) => void;
  onClose: () => void;
  /** D-997 — تفضيلاتُ «عرض» الحاليّة (تصل من `/api/v1/discover/view`) */
  view: DiscoverViewPayload | null;
  /** كتابةٌ واحدة لكلِّ تغيير — الشاشةُ تحفظ وتحدّث */
  onView: (patch: { tabs?: TabPref[]; hidden?: string[]; rows?: MyRow[]; rowsTab?: "shows" | "movies" | "anime" }) => void;
  initialPane?: "tools" | "view";
  /** من تبويب «القوائم»: لا فلاترَ ولا صفوفَ أعمال — «عرض» وحدَه (D-826) */
  viewOnly?: boolean;
  /**
   * 🆕 D-1318 (T2) — تلميحُ «صفوفك الخاصة» لمرّةٍ واحدة (حكمُ أحمد: «تلميحه»، وموضعُه أعلى الورقة: «نعم»). **في لوح
   * «الأدوات»** لأنّ الورقةَ تفتح عليه والصفوفُ في لوح «عرض» المجاور — ومن لم يقلب اللوحَ لا يعرف أنّها موجودة.
   * تحت عنوانها هناك سطرُ شرحٍ دائم (`myRowsHint`)؛ هذا يدلّ على الباب لا يكرّر الشرح.
   */
  rowsHint?: boolean;
}) {
  const [pane, setPane] = useState<"tools" | "view">(viewOnly ? "view" : initialPane);
  const { t, tokens, locale } = useApp();
  const lang = locale === "en" ? "en" : "ar";
  const [draft, setDraft] = useState<BrowseState>(value);
  /* 🆕 D-1550 — المحورُ المفتوحةُ لوحتُه تحت صفّه (كان: قائمةً تحلّ محلَّ الورقة) */
  const [open, setOpen] = useState<AxisKey | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const rowY = useRef<Record<number, number>>({});
  /* D-997 — منتقي صفوفك: `{i, field}` — القائمةُ نفسُها (Radio) بخيارات النوع أو الموضوع */
  const [rowPick, setRowPick] = useState<{ i: number; field: "genre" | "tag" } | null>(null);
  const providers = useQuery({
    queryKey: ["discover:providers", tab] as const,
    queryFn: async () => (await api<ProvidersPayload>(`/api/v1/discover/providers?tab=${tab}`)).data,
    staleTime: 60 * 60_000,
  });
  /* D-1049 — `?? []` كان يصنع مصفوفةً جديدةً كلَّ رسمة فيُعاد حسابُ ما يعتمد عليها بلا سبب (أوّلُ ما كشفه الفحص) */
  const provs = useMemo(() => providers.data?.providers ?? [], [providers.data]);
  const region = providers.data?.region ?? "SA";
  const type = tab === "shows" ? "tv" : tab === "anime" ? "all" : "movie";
  const axes = axesForTab(tab);

  const groupLabel: Record<AxisKey, string> = {
    g: t.browseGenreGroup,
    tag: t.browseTagGroup,
    lang: t.browseLangGroup,
    co: t.browseCountryGroup,
    p: t.browseProviderGroup(regionName(region, lang)),
    era: t.browseEraGroup,
    rate: t.browseRateGroup,
    award: t.browseAwardGroup,
    st: t.browseStatusGroup,
    se: t.browseSeasonGroup,
    std: t.browseStudioGroup,
    /* D-1551 — المقياسُ يتبع التبويب: حلقاتُ الأنمي ومواسمُ المسلسلات */
    len: tab === "anime" ? t.browseEpisodesGroup : t.browseSeasonsGroup,
  };
  const anyLabel: Record<AxisKey, string> = {
    g: t.browseAllGenres,
    tag: t.browseAnyTag,
    lang: t.browseAnyLang,
    co: t.browseAnyCountry,
    p: t.browseAnyProvider,
    era: t.browseAnyEra,
    rate: t.browseAnyRate,
    award: t.browseAnyAward,
    st: t.browseAnyStatus,
    se: t.browseAnySeason,
    std: t.browseAnyStudio,
    len: tab === "anime" ? t.browseAnyEpisodes : t.browseAnySeasons,
  };
  /* خياراتُ كلِّ محور — من `core/browse` حرفاً، بالقيمة التي يقرؤها الرابط */
  const options = useMemo((): Record<AxisKey, { value: string | number; label: string }[]> => ({
    g: BROWSE_GENRES.filter((g) => genreFitsType(g, type)).map((g) => ({ value: g.slug, label: browseGenreName(g, lang) })),
    tag: BROWSE_TAGS.map((x) => ({ value: x.slug, label: browseTagName(x, lang) })),
    lang: BROWSE_LANGS.map((x) => ({ value: x.code, label: browseLangName(x, lang) })),
    co: BROWSE_COUNTRIES.map((x) => ({ value: x.code, label: browseCountryName(x, lang) })),
    p: provs.map((x) => ({ value: x.id, label: x.name })),
    era: BROWSE_ERAS.map((x) => ({ value: x.slug, label: browseEraName(x, lang) })),
    rate: BROWSE_RATES.map((n) => ({ value: n, label: t.browseRateFrom(String(n)) })),
    award: AWARDS.filter((a) => a.kind === (type === "tv" ? "tv" : "movie")).map((a) => ({ value: a.slug, label: awardName(a, lang) })),
    st: BROWSE_STATUSES.map((x) => ({ value: x.slug, label: browseStatusName(x, lang) })),
    se: BROWSE_SEASONS.map((x) => ({ value: x.slug, label: browseSeasonName(x, lang) })),
    std: BROWSE_STUDIOS.map((x) => ({ value: x.slug, label: browseStudioName(x, lang) })),
    len: BROWSE_LENGTHS.filter((x) => x.kind === (tab === "anime" ? "episodes" : "seasons")).map((x) => ({ value: x.slug, label: browseLengthName(x, lang) })),
  }), [type, lang, provs, t, tab]);

  const set = (key: AxisKey, v: string | number | null) => setDraft((d) => ({ ...d, [key]: v }) as BrowseState);
  const valueOf = (key: AxisKey) => draft[key];

  /* 🆕 D-1304 — **صفوفُ التبويب المفتوح وحدَه** (أحمد: «ابغى حتى الرو منفصله عن بعض»): تُقرأ وتُكتب لتبويبها.
     حمولةٌ محفوظةٌ من قبل بلا `my_rows_by_tab` تسقط إلى القائمة القديمة حتى يصل الردُّ الجديد */
  const myRows: MyRow[] = view?.my_rows_by_tab?.[tab] ?? view?.my_rows ?? [];

  if (rowPick) {
    const rows = myRows;
    const row = rows[rowPick.i] ?? null;
    const isGenre = rowPick.field === "genre";
    const list = isGenre
      ? /* D-1304 — ما يملك هذا التبويبُ منه شيئاً: نوعٌ بلا أعمالٍ هنا صفٌّ لا يظهر (الرعبُ للأفلام وحدَها) */
        BROWSE_GENRES.filter((g) => (tab === "movies" ? g.movie.length > 0 : g.tv.length > 0) || g.slug === row?.genre).map((g) => ({ value: g.slug, label: browseGenreName(g, lang) }))
      : BROWSE_TAGS.map((x) => ({ value: x.slug, label: browseTagName(x, lang) }));
    const current = isGenre ? (row?.genre ?? null) : (row?.tag ?? null);
    const pick = (v: string | null) => {
      const next = [...rows];
      if (isGenre) {
        if (!v) next.splice(rowPick.i, 1);
        else next[rowPick.i] = { genre: v, tag: row?.tag ?? null };
      } else if (row) next[rowPick.i] = { genre: row.genre, tag: v };
      onView({ rows: next.filter(Boolean).slice(0, MY_ROWS_MAX), rowsTab: tab });
      setRowPick(null);
    };
    return (
      <Sheet title={isGenre ? t.myRowsRow(num(rowPick.i + 1, locale)) : t.browseTagGroup} onClose={() => setRowPick(null)}>
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          {[{ value: "", label: isGenre ? t.myRowsGenreOff : t.myRowsTagAny }, ...list].map((o) => {
            const on = o.value === "" ? current === null : current === o.value;
            return (
              <Pressable key={o.value} onPress={() => pick(o.value || null)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: on ? tokens.accent : tokens.border, alignItems: "center", justifyContent: "center" }}>
                  {on ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.accent }} /> : null}
                </View>
                <Text size={14} weight={on ? "700" : "500"} style={{ flex: 1 }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    );
  }

  const railTab: RailTab | null = viewOnly ? null : tab;
  const tabLabel = (k: string) => (k === "shows" ? t.discoverTabShows : k === "movies" ? t.discoverTabMovies : k === "anime" ? t.discoverTabAnime : t.discoverTabLists);
  const seg = viewOnly ? null : (
    /* segmented — كتبويبَي الورقة الويبيّة */
    <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider, marginBottom: 12 }}>
      {(["tools", "view"] as const).map((k) => {
        const on = pane === k;
        return (
          <Pressable key={k} onPress={() => setPane(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}>
            <Text size={14} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted}>{k === "tools" ? (lang === "ar" ? "الأدوات" : "Tools") : lang === "ar" ? "عرض" : "View"}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (pane === "view") {
    const tabs = view?.tabs ?? [];
    const hiddenAll = new Set(view?.hidden_rails ?? []);
    const hiddenHere = railTab ? railsHiddenFor(hiddenAll, railTab) : new Set<string>();
    const shownCount = tabs.filter((p) => !p.hidden).length;
    const rows = myRows;
    const rowLabel = (r: MyRow | null, field: "genre" | "tag") => {
      if (!r) return field === "genre" ? t.myRowsGenreOff : t.myRowsTagAny;
      if (field === "genre") {
        const g = BROWSE_GENRES.find((x) => x.slug === r.genre);
        return g ? browseGenreName(g, lang) : r.genre;
      }
      const x = BROWSE_TAGS.find((y) => y.slug === r.tag);
      return x ? browseTagName(x, lang) : t.myRowsTagAny;
    };
    return (
      <Sheet title={t.discoverToolsTitle} onClose={onClose}>
        {seg}
        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>
          {/* صفوفُك — نوعٌ وموضوعٌ لكلِّ صفّ (D-822/D-997)؛ 🆕 D-1304: لهذا التبويب وحدَه، وتغيب في «القوائم» */}
          {viewOnly ? null : (
          <View style={{ gap: 8 }}>
            <Text size={12} weight="700" muted>{`${t.myRowsTitle} · ${tabLabel(tab)}`}</Text>
            <Text size={12} muted>{t.myRowsHint}</Text>
            {Array.from({ length: MY_ROWS_MAX }, (_, i) => {
              const row = rows[i] ?? null;
              return (
                <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={() => setRowPick({ i, field: "genre" })} style={{ flex: 1, borderWidth: 1, borderColor: row ? tokens.accent : tokens.border, borderRadius: radius.control, backgroundColor: tokens.surface, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text size={11} muted>{t.myRowsRow(num(i + 1, locale))}</Text>
                    <Text size={14} weight="600" numberOfLines={1} color={row ? tokens.fg : tokens.muted}>{rowLabel(row, "genre")}</Text>
                  </Pressable>
                  <Pressable disabled={!row} onPress={() => setRowPick({ i, field: "tag" })} style={{ flex: 1, opacity: row ? 1 : 0.5, borderWidth: 1, borderColor: row?.tag ? tokens.accent : tokens.border, borderRadius: radius.control, backgroundColor: tokens.surface, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text size={11} muted>{t.browseTagGroup}</Text>
                    <Text size={14} weight="600" numberOfLines={1} color={row?.tag ? tokens.fg : tokens.muted}>{rowLabel(row, "tag")}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          )}
          {/* التبويبات — الترتيبُ والإظهار (`ToolsSheet` المكتبة حرفاً، بلس في الخادم) */}
          <View style={{ gap: 6 }}>
            <Text size={12} weight="700" muted>{t.tabsPrefsGroup}</Text>
            {tabs.map((pref, i) => {
              const label = tabLabel(pref.key);
              const lastVisible = !pref.hidden && shownCount <= 1;
              return (
                <View key={pref.key} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Pressable
                    disabled={lastVisible}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: !pref.hidden }}
                    accessibilityLabel={label}
                    onPress={() => onView({ tabs: guardLastVisible(toggleTab(tabs, pref.key)) })}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, opacity: lastVisible ? 0.5 : 1 }}
                  >
                    <Icon name={pref.hidden ? "eye-off" : "eye"} size={16} color={pref.hidden ? tokens.muted : tokens.fg} />
                    <Text size={14} style={{ flex: 1 }} color={pref.hidden ? tokens.muted : tokens.fg}>{label}</Text>
                    <Switch on={!pref.hidden} />
                  </Pressable>
                  <Arrow up disabled={i === 0} label={t.tabsPrefsMoveUp(label)} onPress={() => onView({ tabs: moveTab(tabs, pref.key, -1) })} />
                  <Arrow disabled={i === tabs.length - 1} label={t.tabsPrefsMoveDown(label)} onPress={() => onView({ tabs: moveTab(tabs, pref.key, 1) })} />
                </View>
              );
            })}
          </View>
          {/* صفوفُ هذا التبويب (D-826) — تغيب في «القوائم» */}
          {railTab ? (
            <View style={{ gap: 6 }}>
              <Text size={12} weight="700" muted>{lang === "ar" ? "صفوف هذا التبويب" : "This tab's rows"}</Text>
              {railsOf(railTab).map((r) => {
                const off = hiddenHere.has(r.key);
                const tok = railToken(railTab, r.key);
                return (
                  <Pressable
                    key={r.key}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: !off }}
                    onPress={() => {
                      const next = new Set(hiddenAll);
                      if (off) next.delete(tok);
                      else next.add(tok);
                      onView({ hidden: [...next] });
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}
                  >
                    <Icon name={off ? "eye-off" : "eye"} size={16} color={off ? tokens.muted : tokens.fg} />
                    <Text size={14} style={{ flex: 1 }} color={off ? tokens.muted : tokens.fg}>{r.label(t, railTab)}</Text>
                    <Switch on={!off} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      </Sheet>
    );
  }

  return (
    <Sheet title={t.discoverToolsTitle} onClose={onClose}>
      {seg}
      {rowsHint && !viewOnly ? <OneTimeHint id="discover-rows" text={t.hintMyRows} style={{ marginBottom: 12 }} /> : null}
      {/* 🆕 D-1550 — **بطاقتان في الصفّ، والخياراتُ تنفتح تحت صفّها** (أحمد ٢٦ أكتوبر على لقطته: «مهي سهلة للمستخدم
          الجديد وسريعة للوصول للي يبيه» — ثمّ «بطاقتين في الصف .. i1»). كانت المحاورُ صفوفاً بعرض الورقة، وكلُّ ضغطةٍ تُبدل
          الورقةَ بقائمةٍ ثمّ تعود: **لا يرى القارئُ الخياراتِ قبل أن يفتح، ولا الفلاترَ الأخرى وهو يختار.** الآن الشبكةُ كلُّها
          في شاشةٍ واحدة، واللوحةُ رقائقُ العائلة نفسِها (`Chip`) في الورقة نفسِها — ضغطةٌ تختار وتطوي. لوحةٌ واحدةٌ مفتوحةٌ في
          كلِّ وقت، وفتحُ أخرى يطوي الأولى. **والحرّيّةُ كما هي**: المحاورُ والقيمُ والمسودّةُ و«عرض النتائج» لم تتغيّر. */}
      <ScrollView ref={scrollRef} style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        <Text size={12} muted style={{ marginBottom: 4 }}>{t.browseFilters}</Text>
        {pairs(axes).map((row, ri) => {
          const col = open ? row.indexOf(open) : -1;
          return (
            <View key={row.join("-")} style={{ gap: 8 }} onLayout={(e) => (rowY.current[ri] = e.nativeEvent.layout.y)}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {row.map((key) => {
                  const v = valueOf(key);
                  const on = v !== null;
                  const isOpen = open === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setOpen(isOpen ? null : key);
                        /* اللوحةُ تحت صفٍّ أسفلَ الورقة قد تقع خارج النظر — يُمرَّر إلى صفّها */
                        if (!isOpen) requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, (rowY.current[ri] ?? 0) - 8), animated: true }));
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      style={({ pressed }) => ({
                        /* 🔴 D-1551 — `flexBasis: 0` صريحاً: «الحالة» الوحيدةُ في صفّها كانت أعرضَ من أخواتها (لقطةُ أحمد) —
                           الخانةُ الفارغةُ بجانبها تنكمش إلى محتواها الصفريّ فتتمدّد البطاقةُ في مكانها. القاعدةُ صفرٌ للاثنين */
                        flexGrow: 1,
                        flexShrink: 1,
                        flexBasis: 0,
                        minWidth: 0,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        borderWidth: 1,
                        borderColor: on || isOpen ? tokens.accent : tokens.border,
                        borderRadius: radius.control,
                        backgroundColor: tokens.surface,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text size={11} muted numberOfLines={1}>{groupLabel[key]}</Text>
                        <Text size={14} weight="600" numberOfLines={1} color={on ? tokens.accent : tokens.fg}>
                          {on ? axisValueLabel(key, v as string | number, lang, provs, t) : anyLabel[key]}
                        </Text>
                      </View>
                      <View style={isOpen ? { transform: [{ rotate: "180deg" }] } : undefined}>
                        <Icon name="chevron-down" size={14} color={isOpen ? tokens.accent : tokens.muted} />
                      </View>
                    </Pressable>
                  );
                })}
                {row.length === 1 ? <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }} /> : null}
              </View>
              {open && col >= 0 ? (
                <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: radius.control, backgroundColor: tokens.surface, padding: 12, gap: 10, marginTop: 4 }}>
                  {/* السهمُ الصغير يشير إلى بطاقته — مربّعٌ مُدار بحدّين فيُقرأ ذروةً متّصلةً بحدّ اللوحة */}
                  <View
                    pointerEvents="none"
                    style={{ position: "absolute", top: -6, start: col === 0 ? "25%" : "75%", marginStart: -6, width: 12, height: 12, backgroundColor: tokens.surface, borderTopWidth: 1, borderLeftWidth: 1, borderColor: tokens.border, transform: [{ rotate: "45deg" }] }}
                  />
                  {open === "co" ? (
                    <CountryPanel
                      current={(valueOf("co") as string | null) ?? null}
                      anyLabel={anyLabel.co}
                      lang={lang}
                      onPick={(v) => {
                        set("co", v);
                        setOpen(null);
                      }}
                    />
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {[{ value: "" as string | number, label: anyLabel[open] }, ...options[open]].map((o) => {
                        const cur = valueOf(open);
                        const sel = o.value === "" ? cur === null : String(cur) === String(o.value);
                        return (
                          <Chip
                            key={String(o.value)}
                            /* D-1551 — رقائقُ اللوحة أصغر (١٢ لا ١٤، أحمد: «النتائج صغر خطها»)، ولمسُها أوسعُ من شكلها */
                            size="sm"
                            hitSlop={6}
                            active={sel}
                            label={o.label}
                            onPress={() => {
                              set(open, o.value === "" ? null : o.value);
                              setOpen(null);
                            }}
                          />
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Button label={t.browseClearAll} variant="ghost" style={{ flex: 1 }} onPress={() => setDraft(EMPTY_BROWSE)} disabled={!browseActive(draft)} />
        <Button label={t.browseApply} variant="primary" style={{ flex: 1.4 }} onPress={() => onApply(draft)} />
      </View>
    </Sheet>
  );
}

/** الشبكةُ صفوفٌ من اثنين — والأخيرُ قد يبقى وحيداً */
function pairs<T>(xs: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += 2) out.push(xs.slice(i, i + 2));
  return out;
}

/**
 * 🆕 D-1551 — **لوحةُ البلد: الأشهرُ ثمّ «+ المزيد»** (أحمد: «حط الاشهر اولا بعدين مور وتظهر الباقية») — ينقض بحثَ
 * D-1550: إحدى وثلاثون دولةً لا تحتاج حقلاً يُكتب فيه. **والمختارُ من الباقية يفتح اللوحةَ كاملةً** فلا يختفي اختيارُه.
 */
function CountryPanel({
  current,
  anyLabel,
  lang,
  onPick,
}: {
  current: string | null;
  anyLabel: string;
  lang: "ar" | "en";
  onPick: (code: string | null) => void;
}) {
  const { t, locale } = useApp();
  const { top, rest } = useMemo(() => splitCountries(), []);
  const [more, setMore] = useState(() => !!current && rest.some((c) => c.code === current));
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip size="sm" hitSlop={6} active={current === null} label={anyLabel} onPress={() => onPick(null)} />
        {top.map((c) => (
          <Chip key={c.code} size="sm" hitSlop={6} active={current === c.code} label={browseCountryName(c, lang)} onPress={() => onPick(c.code)} />
        ))}
        {more ? null : <Chip size="sm" hitSlop={6} active={false} label={t.browseMoreCount(num(rest.length, locale))} onPress={() => setMore(true)} />}
      </View>
      {more ? (
        <>
          <Text size={11} muted>{t.browseAllCountries}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {rest.map((c) => (
              <Chip key={c.code} size="sm" hitSlop={6} active={current === c.code} label={browseCountryName(c, lang)} onPress={() => onPick(c.code)} />
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}
