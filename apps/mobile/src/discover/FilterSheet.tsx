import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  BROWSE_COUNTRIES,
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
} from "@/core/browse";
import { AWARDS, awardName } from "@/core/awards";
import { regionName } from "@/core/region";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { axesForTab, axisValueLabel, browseActive, EMPTY_BROWSE, type AxisKey, type BrowseState } from "./browseState";
import type { CuratedTab, ProvidersPayload } from "../contracts";

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
 *
 * 🔑 **مسودّةٌ ثمّ تطبيق** كالويب: التغييراتُ تُجمع في `draft`، و«عرض النتائج» يسلّمها
 * دفعةً واحدة — الصفوفُ لا تُعاد بعد كلِّ لمسة.
 */
export function FilterSheet({
  tab,
  value,
  onApply,
  onClose,
}: {
  tab: CuratedTab;
  value: BrowseState;
  onApply: (next: BrowseState) => void;
  onClose: () => void;
}) {
  const { t, tokens, locale } = useApp();
  const lang = locale === "en" ? "en" : "ar";
  const [draft, setDraft] = useState<BrowseState>(value);
  const [open, setOpen] = useState<AxisKey | null>(null);
  const providers = useQuery({
    queryKey: ["discover:providers", tab] as const,
    queryFn: async () => (await api<ProvidersPayload>(`/api/v1/discover/providers?tab=${tab}`)).data,
    staleTime: 60 * 60_000,
  });
  const provs = providers.data?.providers ?? [];
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
  }), [type, lang, provs, t]);

  const set = (key: AxisKey, v: string | number | null) => setDraft((d) => ({ ...d, [key]: v }) as BrowseState);
  const valueOf = (key: AxisKey) => draft[key];

  if (open) {
    const list = options[open];
    const current = valueOf(open);
    return (
      <Sheet title={groupLabel[open]} onClose={() => setOpen(null)}>
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          {[{ value: "" as string | number, label: anyLabel[open] }, ...list].map((o) => {
            const on = o.value === "" ? current === null : String(current) === String(o.value);
            return (
              <Pressable
                key={String(o.value)}
                onPress={() => {
                  set(open, o.value === "" ? null : o.value);
                  setOpen(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
              >
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

  return (
    <Sheet title={t.discoverToolsTitle} onClose={onClose}>
      <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Text size={12} muted style={{ marginBottom: 4 }}>{t.browseFilters}</Text>
        {axes.map((key) => {
          const v = valueOf(key);
          const on = v !== null;
          return (
            <Pressable
              key={key}
              onPress={() => setOpen(key)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderWidth: 1,
                borderColor: on ? tokens.accent : tokens.border,
                borderRadius: radius.control,
                backgroundColor: tokens.surface,
                paddingHorizontal: 12,
                paddingVertical: 10,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={11} muted numberOfLines={1}>{groupLabel[key]}</Text>
                <Text size={14} weight="600" numberOfLines={1} color={on ? tokens.fg : tokens.muted}>
                  {on ? axisValueLabel(key, v as string | number, lang, provs, t) : anyLabel[key]}
                </Text>
              </View>
              <Icon name="chevron-down" size={16} color={tokens.muted} />
            </Pressable>
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
