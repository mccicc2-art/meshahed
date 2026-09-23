import React, { useMemo, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Chip } from "../library/Chip";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, ExpandRow, OptionRow, OptionList, RowsSkeleton } from "./ui";
import { useSettings, saveSetting, patchSettings } from "./api";
import { ALL_LANGS, BROWSE_GENRES, browseGenreName, langName, type BrowseGenre } from "@/core/browse";
import { WATCH_REGIONS, regionName, regionFlag } from "@/core/region";
import { TITLE_MODES, resolveMediaTitle, type TitleMode } from "@/core/titleMode";
import { normalizeSearch } from "@/core/arabic";
import type { ContentPrefs } from "@/core/contentPrefs";
import type { ContentPrefsBody, RegionBody, TitleModeBody } from "../contracts";

/**
 * ====== المحتوى — التفضيلاتُ الأربع · أسماءُ الأعمال · بلدُ المشاهدة (Phase 11-I · I2) ======
 *
 * ترجمةُ `content/page.tsx`: مجموعتا الذوق واللغات (`ContentPrefsSection`)، ثمّ أسماءُ
 * الأعمال مع معاينتها (`TitleModeSection`) وبلدُ المشاهدة (`RegionSwitch`)، ثمّ زرُّ
 * إعادة الضبط الأحمر. **منتقٍ واحدٌ (`Picker`) يرسم الخمسة** كما يرسم
 * `SettingsPickerPanel` الأربعةَ في الويب — بحثٌ، المختارُ رقائقَ من عائلة `Chip`
 * (وللغاتٍ مرتَّبةٍ سهما رفعٍ وخفض)، ثمّ الكلُّ.
 *
 * الكتابةُ لحظةَ الضغطة لا مؤجَّلة: الويبُ يؤجّلها ٩٠٠م لأنّ كلَّ ضغطةٍ هناك `router.refresh()`
 * كامل؛ هنا الردُّ يرقّع الحمولةَ وحدَها فلا داعيَ للانتظار — **والتعارضُ يحسمه الخادمُ**
 * (`sanitizeContentPrefs`: المفضَّلُ يغلب) ويعود ما حُفظ فعلاً.
 */
const SAMPLES: { localized: string; original: string; translit: string }[] = [
  { localized: "صراع العروش", original: "Game of Thrones", translit: "جيم أوف ثرونز" },
  { localized: "Hidden Secret", original: "عوالم خفية", translit: "عوالم خفية" },
];
const idOf = (g: BrowseGenre) => (g.movie[0] ?? g.tv[0])!;

export function ContentScreen() {
  const { t, tokens, locale } = useApp();
  const loc = locale === "en" ? "en" : "ar";
  const q = useSettings();
  const s = q.data;
  const toast = useRef<ToastHostRef>(null);
  const [open, setOpen] = useState<"genres" | "unwantedGenres" | "languages" | "excludedLanguages" | "titles" | "region" | null>(null);
  const toggle = (k: typeof open) => setOpen((v) => (v === k ? null : k));
  const fail = () => toast.current?.say(t.errSaveShort);

  const nameOf = (id: number) => {
    const g = BROWSE_GENRES.find((x) => idOf(x) === id) ?? BROWSE_GENRES.find((x) => x.movie.includes(id) || x.tv.includes(id));
    return g ? browseGenreName(g, loc) : String(id);
  };
  const short = (items: string[]) => (items.length === 0 ? t.cpNone : items.length === 1 ? items[0] : `${items[0]} · +${items.length - 1}`);
  const titleLabel: Record<TitleMode, string> = { localized: t.titleModeLocalized, original: t.titleModeOriginal, translit: t.titleModeTranslit, both: t.titleModeBoth };

  async function savePrefs(patch: Partial<ContentPrefs>) {
    if (!s) return;
    const out = await saveSetting<ContentPrefs>("/api/v1/me/settings/content-prefs", patch satisfies ContentPrefsBody, (x) => ({ ...x, content: { ...x.content, prefs: { ...x.content.prefs, ...patch } } }), (saved) =>
      /* ما حُفظ فعلاً (بعد حسم التعارض في الخادم) يحلّ محلَّ الترقيع التفاؤليّ */
      patchSettings((x) => ({ ...x, content: { ...x.content, prefs: saved } })),
    );
    if (!out) fail();
  }

  function setNums(list: "genres" | "unwantedGenres", ids: number[]) {
    const other = list === "genres" ? "unwantedGenres" : "genres";
    void savePrefs({ [list]: ids, [other]: s!.content.prefs[other].filter((x) => !ids.includes(x)) } as Partial<ContentPrefs>);
  }
  function setLangs(list: "languages" | "excludedLanguages", codes: string[]) {
    const other = list === "languages" ? "excludedLanguages" : "languages";
    void savePrefs({ [list]: codes, [other]: s!.content.prefs[other].filter((x) => !codes.includes(x)) } as Partial<ContentPrefs>);
  }
  async function pickTitleMode(mode: TitleMode) {
    if (!s || mode === s.content.title_mode) return;
    const out = await saveSetting<{ mode: string }>("/api/v1/me/settings/title-mode", { mode } satisfies TitleModeBody, (x) => ({ ...x, content: { ...x.content, title_mode: mode } }));
    if (!out) fail();
  }
  async function pickRegion(code: string) {
    if (!s || code === s.content.region) return;
    haptic.pick();
    setOpen(null);
    const out = await saveSetting<{ region: string }>("/api/v1/me/settings/region", { region: code } satisfies RegionBody, (x) => ({ ...x, content: { ...x.content, region: code } }));
    if (!out) fail();
  }
  async function resetAll() {
    haptic.pick();
    const empty: ContentPrefs = { genres: [], unwantedGenres: [], languages: [], excludedLanguages: [] };
    const out = await saveSetting<ContentPrefs>("/api/v1/me/settings/content-prefs", empty satisfies ContentPrefsBody, (x) => ({ ...x, content: { ...x.content, prefs: empty } }));
    if (!out) return fail();
    haptic.success();
    toast.current?.say(t.cpResetDone);
  }

  const genreOptions = (exclude: number[]) => BROWSE_GENRES.filter((g) => !exclude.includes(idOf(g))).map((g) => ({ key: String(idOf(g)), label: browseGenreName(g, loc) }));
  const langOptions = (exclude: string[]) => ALL_LANGS.filter((l) => !exclude.includes(l.code)).map((l) => ({ key: l.code, label: langName(l.code, loc) }));

  if (!s) {
    return (
      <SettingsScreen title={t.setContent} toast={toast}>
        <RowsSkeleton rows={2} />
        <RowsSkeleton rows={2} />
      </SettingsScreen>
    );
  }
  const p = s.content.prefs;
  return (
    <SettingsScreen title={t.setContent} toast={toast}>
      <Group label={t.cpTaste}>
        <ExpandRow icon="plus" title={t.cpShowMore} value={short(p.genres.map(nameOf))} open={open === "genres"} onToggle={() => toggle("genres")}>
          <Picker options={genreOptions(p.unwantedGenres)} value={p.genres.map(String)} onChange={(v) => setNums("genres", v.map(Number))} search={t.cpSearchGenres} max={20} />
        </ExpandRow>
        <ExpandRow icon="eye-off" title={t.cpShowLess} value={short(p.unwantedGenres.map(nameOf))} open={open === "unwantedGenres"} onToggle={() => toggle("unwantedGenres")}>
          <Picker options={genreOptions(p.genres)} value={p.unwantedGenres.map(String)} onChange={(v) => setNums("unwantedGenres", v.map(Number))} search={t.cpSearchGenres} max={20} />
        </ExpandRow>
      </Group>

      <Group label={t.cpLangsTitle}>
        <ExpandRow icon="compass" title={t.cpPreferred} value={short(p.languages.map((c) => langName(c, loc)))} open={open === "languages"} onToggle={() => toggle("languages")}>
          <Picker options={langOptions(p.excludedLanguages)} value={p.languages} onChange={(v) => setLangs("languages", v)} search={t.cpSearchLangs} max={12} ordered />
        </ExpandRow>
        <ExpandRow icon="eye-off" title={t.cpExcluded} value={short(p.excludedLanguages.map((c) => langName(c, loc)))} open={open === "excludedLanguages"} onToggle={() => toggle("excludedLanguages")}>
          <Picker options={langOptions(p.languages)} value={p.excludedLanguages} onChange={(v) => setLangs("excludedLanguages", v)} search={t.cpSearchLangs} max={12} />
        </ExpandRow>
      </Group>

      <Group>
        <ExpandRow icon="film" title={t.titleNamesTitle} value={titleLabel[s.content.title_mode]} open={open === "titles"} onToggle={() => toggle("titles")}>
          <OptionList>
            {TITLE_MODES.map((m) => (
              <OptionRow key={m} selected={m === s.content.title_mode} title={titleLabel[m]} subtitle={m === "localized" ? t.titleModeRecommended : undefined} onSelect={() => void pickTitleMode(m)} />
            ))}
          </OptionList>
          {/* المعاينةُ كما في الويب: عيّنتان تُحلّان بالوضع المختار */}
          <View style={{ marginTop: 12, borderRadius: radius.md, backgroundColor: tokens.surface2, padding: 12, gap: 8 }}>
            <Text size={12} muted>{t.cpPreview}</Text>
            {SAMPLES.map((sample, i) => {
              const r = resolveMediaTitle(locale === "en" ? { localized: i === 0 ? sample.original : sample.localized, original: sample.original, translit: sample.translit } : sample, s.content.title_mode);
              return (
                <View key={sample.original}>
                  <Text size={14} weight="600">{r.primary}</Text>
                  {r.secondary ? <Text size={12} muted style={{ marginTop: 2 }}>{r.secondary}</Text> : null}
                </View>
              );
            })}
          </View>
        </ExpandRow>
        <ExpandRow icon="compass" title={t.regionSection} value={`${regionFlag(s.content.region)} ${regionName(s.content.region, loc)}`} open={open === "region"} onToggle={() => toggle("region")}>
          <Picker options={WATCH_REGIONS.map((r) => ({ key: r.code, label: `${regionFlag(r.code)}  ${regionName(r.code, loc)}` }))} value={[s.content.region]} onChange={(v) => v[0] && void pickRegion(v[0])} search={t.regionSection} single />
        </ExpandRow>
      </Group>

      {/* إعادةُ الضبط — نصٌّ أحمرُ بلا بطاقة كما في `ContentPrefsReset` */}
      <Pressable onPress={() => void resetAll()} accessibilityRole="button" style={({ pressed }) => [{ minHeight: 56, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}>
        <Text size={14} weight="600" color={tokens.error}>{t.cpResetAll}</Text>
      </Pressable>
    </SettingsScreen>
  );
}

/**
 * منتقي `SettingsPickerPanel` أصليّاً: بحثٌ (بتطبيع العربيّة) · المختارُ رقائقَ
 * (ضغطةٌ تحذف؛ وللمرتَّب سهمان) · «مسح» · ثمّ الكلُّ رقائقَ. `single` لبلد المشاهدة.
 */
function Picker({ options, value, onChange, search, max, ordered, single }: { options: { key: string; label: string }[]; value: string[]; onChange: (next: string[]) => void; search: string; max?: number; ordered?: boolean; single?: boolean }) {
  const { t, tokens } = useApp();
  const [q, setQ] = useState("");
  const label = useMemo(() => new Map(options.map((o) => [o.key, o.label])), [options]);
  const shown = useMemo(() => {
    const needle = normalizeSearch(q.trim());
    return needle ? options.filter((o) => normalizeSearch(o.label).includes(needle)) : options;
  }, [q, options]);
  const full = max !== undefined && value.length >= max;
  function toggle(key: string) {
    haptic.pick();
    if (single) return onChange([key]);
    if (value.includes(key)) return onChange(value.filter((x) => x !== key));
    if (full) return;
    onChange([...value, key]);
  }
  function move(key: string, delta: -1 | 1) {
    const from = value.indexOf(key);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= value.length) return;
    haptic.pick();
    const next = [...value];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  }
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 44, borderRadius: radius.control, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, paddingHorizontal: 12 }}>
        <Icon name="search" size={18} color={tokens.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={search} placeholderTextColor={tokens.muted} style={{ flex: 1, fontSize: 14, color: tokens.fg, textAlign: "left", paddingVertical: 0 }} />
      </View>
      {!single ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text size={12} weight="600" muted>{value.length ? `${t.cpSelected} · ${value.length}` : t.cpSelected}</Text>
            {value.length ? (
              <Pressable onPress={() => { haptic.pick(); onChange([]); }} hitSlop={8}><Text size={12} weight="600" color={tokens.accent}>{t.cpClear}</Text></Pressable>
            ) : null}
          </View>
          {value.length === 0 ? (
            <Text size={12} muted>{t.cpNothing}</Text>
          ) : ordered ? (
            <View style={{ borderRadius: radius.control, borderWidth: 1, borderColor: tokens.divider }}>
              {value.map((k, i) => (
                <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingStart: 12, paddingEnd: 4, minHeight: 40, borderTopWidth: i ? 1 : 0, borderTopColor: tokens.divider }}>
                  <Text size={12} weight="700" muted>{i + 1}</Text>
                  <Text size={14} weight="600" numberOfLines={1} style={{ flex: 1 }}>{label.get(k) ?? k}</Text>
                  <Pressable onPress={() => move(k, -1)} disabled={i === 0} hitSlop={6} accessibilityLabel={`${t.cpLangUp} — ${label.get(k) ?? k}`} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", opacity: i === 0 ? 0.3 : 1 }}>
                    <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="chevron-down" size={16} color={tokens.muted} /></View>
                  </Pressable>
                  <Pressable onPress={() => move(k, 1)} disabled={i === value.length - 1} hitSlop={6} accessibilityLabel={`${t.cpLangDown} — ${label.get(k) ?? k}`} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", opacity: i === value.length - 1 ? 0.3 : 1 }}>
                    <Icon name="chevron-down" size={16} color={tokens.muted} />
                  </Pressable>
                  <Pressable onPress={() => toggle(k)} hitSlop={6} accessibilityLabel={t.cpRemoveAria(label.get(k) ?? k)} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="close" size={14} color={tokens.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {value.map((k) => (
                <Chip key={k} label={label.get(k) ?? k} active onPress={() => toggle(k)} />
              ))}
            </View>
          )}
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        {!single ? <Text size={12} weight="600" muted>{t.cpAllCategories}</Text> : null}
        {shown.length === 0 ? (
          <Text size={12} muted>{t.cpNoMatch}</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, opacity: full ? 0.7 : 1 }}>
            {shown.filter((o) => single || !value.includes(o.key)).map((o) => (
              <Chip key={o.key} label={o.label} active={!!single && value.includes(o.key)} onPress={() => toggle(o.key)} leading={single && value.includes(o.key) ? <Icon name="check" size={12} color={tokens.onAccent} /> : undefined} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
