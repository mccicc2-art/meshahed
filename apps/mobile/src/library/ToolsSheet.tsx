import React, { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "./Sheet";
import { moveTab, toggleTab, type TabPref } from "@/core/tabPrefs";
import { railsOf, railToken } from "@/core/railPrefs";

/**
 * ====== أدواتُ المكتبة — نسخةُ `LibraryToolsSheet.tsx` (الويب) ======
 * (Phase 11 · B4 — B0 §٣.١ V6 · 🆕 D-947: تبويبُ «عرض» كاملاً)
 *
 * تبويبان كالويب (D-325): **«أدوات»** — البحثُ (حقلٌ `min-h-11 bg-surface-2
 * border rounded-control ps-9`، الرمزُ في طرفه، **Enter يقول «تمّ»**) ثمّ
 * الترتيبُ **مقسّماً لا قائمةً** (D-076) — **ويغيبان في تبويبَي «فنّانون»
 * و«قوائم»** (`showFilters`: البحثُ لغةُ عناوين). **«عرض»** — ترتيبُ
 * التبويبات وإخفاؤها (`TabsPrefs`: مفتاحٌ وسهمان، والأخيرُ الظاهرُ لا يُخفى
 * — `guardLastVisible`) **وصفوفُ هذه الصفحة** (`RailsPrefs`، D-874: «تجتمع
 * عندك» و«المحفوظة»). **الكتابةُ بيد المستدعي** (`onTabs` · `onRails`) لأنّ
 * الحارسَ (بلس — D-819) يعيش في الخادم ويردّ `needsPlus`.
 *
 * ما لم يُنقل مُعلَن: تحريرُ شرط القائمة الذكيّة (`?edit=` — بابٌ في الويب).
 */
export type LibrarySort = "smart" | "added" | "title" | "progress";

export function ToolsSheet({
  q,
  onQ,
  sort,
  onSort,
  showFilters,
  tabs,
  tabLabels,
  onTabs,
  hiddenRails,
  onRails,
  onClose,
}: {
  q: string;
  onQ: (v: string) => void;
  sort: LibrarySort;
  onSort: (s: LibrarySort) => void;
  showFilters: boolean;
  tabs: TabPref[];
  tabLabels: Record<string, string>;
  onTabs: (next: TabPref[]) => void;
  hiddenRails: string[];
  onRails: (next: string[]) => void;
  onClose: () => void;
}) {
  const { t, tokens, locale } = useApp();
  const [pane, setPane] = useState<"do" | "see">(showFilters ? "do" : "see");
  const sorts: { id: LibrarySort; label: string }[] = [
    { id: "smart", label: t.sortSmart },
    { id: "added", label: t.sortAdded },
    { id: "title", label: t.sortTitle },
    { id: "progress", label: t.sortProgress },
  ];
  const shownCount = tabs.filter((x) => !x.hidden).length;
  const rails = railsOf("library");
  const hidden = new Set(hiddenRails);

  return (
    <Sheet title={t.libraryToolsTitle} onClose={onClose}>
      {showFilters ? (
        <Segmented
          items={[
            { id: "do", label: t.communityToolsTabDo },
            { id: "see", label: t.communityToolsTabSee },
          ]}
          value={pane}
          onChange={(v) => setPane(v as "do" | "see")}
        />
      ) : null}
      <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {pane === "do" && showFilters ? (
          <View style={{ gap: 20 }}>
            <View>
              <Text size={12} weight="700" muted style={{ marginBottom: 8 }}>{t.librarySearchGroup}</Text>
              <View style={{ position: "relative", justifyContent: "center" }}>
                <View pointerEvents="none" style={{ position: "absolute", start: 12, zIndex: 1 }}>
                  <Icon name="search" size={16} color={tokens.muted} />
                </View>
                <TextInput
                  value={q}
                  onChangeText={onQ}
                  onSubmitEditing={onClose}
                  returnKeyType="search"
                  placeholder={t.searchLibrary}
                  placeholderTextColor={tokens.muted}
                  autoCorrect={false}
                  style={{
                    minHeight: 44,
                    backgroundColor: tokens.surface2,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    borderRadius: radius.control,
                    paddingStart: 36,
                    paddingEnd: 12,
                    paddingVertical: 10,
                    fontSize: 16,
                    color: tokens.fg,
                    textAlign: "left",
                  }}
                />
              </View>
            </View>
            <View>
              <Text size={12} weight="700" muted style={{ marginBottom: 8 }}>{t.librarySortGroup}</Text>
              <Segmented
                items={sorts.map((s) => ({ id: s.id, label: s.label }))}
                value={sort}
                onChange={(v) => {
                  onSort(v as LibrarySort);
                  onClose();
                }}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 20 }}>
            <View>
              <Text size={12} weight="700" muted style={{ marginBottom: 4 }}>{t.tabsPrefsGroup}</Text>
              {tabs.map((pref, i) => {
                const label = tabLabels[pref.key] ?? pref.key;
                const lastVisible = !pref.hidden && shownCount <= 1;
                return (
                  <View key={pref.key} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: !pref.hidden }}
                      disabled={lastVisible}
                      onPress={() => onTabs(toggleTab(tabs, pref.key))}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, paddingVertical: 8, opacity: lastVisible ? 0.45 : 1 }}
                    >
                      <Text size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text>
                      <Switch on={!pref.hidden} />
                    </Pressable>
                    <Arrow up disabled={i === 0} label={t.tabsPrefsMoveUp(label)} onPress={() => onTabs(moveTab(tabs, pref.key, -1))} />
                    <Arrow disabled={i === tabs.length - 1} label={t.tabsPrefsMoveDown(label)} onPress={() => onTabs(moveTab(tabs, pref.key, 1))} />
                  </View>
                );
              })}
            </View>
            <View>
              <Text size={12} weight="700" muted style={{ marginBottom: 4 }}>{locale === "en" ? "This page's rows" : "صفوف هذه الصفحة"}</Text>
              {rails.map((r) => {
                const tok = railToken("library", r.key);
                const off = hidden.has(tok);
                return (
                  <Pressable
                    key={r.key}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: !off }}
                    onPress={() => {
                      const next = new Set(hidden);
                      if (off) next.delete(tok);
                      else next.add(tok);
                      onRails([...next]);
                    }}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, paddingVertical: 8 }}
                  >
                    <Text size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{r.label(t, "library")}</Text>
                    <Switch on={!off} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

/** العائلةُ المقسّمة الواحدة (`segmentedItem`): خطٌّ سفليٌّ ٣ بلون التمييز على `--divider` */
function Segmented({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider }} accessibilityRole="radiogroup">
      {items.map((s) => {
        const on = value === s.id;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(s.id)}
            style={{ flex: 1, alignItems: "center", paddingHorizontal: 8, paddingVertical: 10 }}
          >
            <Text size={14} weight="600" color={on ? tokens.fg : tokens.muted} numberOfLines={1}>{s.label}</Text>
            {on ? (
              <View style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 3, borderTopLeftRadius: 999, borderTopRightRadius: 999, backgroundColor: tokens.accent }} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** المفتاحُ `h-5 w-9 rounded-full` وقرصُه `h-4 w-4` بلون الخلفيّة — وصفةُ `TabsPrefs` */
function Switch({ on }: { on: boolean }) {
  const { tokens } = useApp();
  return (
    <View style={{ width: 36, height: 20, borderRadius: 10, backgroundColor: on ? tokens.accent : tokens.border, justifyContent: "center" }}>
      <View style={{ position: "absolute", start: on ? 18 : 2, width: 16, height: 16, borderRadius: 8, backgroundColor: tokens.bg }} />
    </View>
  );
}

/** السهمان رأسيّان فلا ينقلبان مع الاتّجاه — «فوق» فوقٌ في اللغتين */
function Arrow({ up, disabled, label, onPress }: { up?: boolean; disabled: boolean; label: string; onPress: () => void }) {
  const { tokens } = useApp();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={label}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1, transform: [{ rotate: up ? "180deg" : "0deg" }] }}
    >
      <Icon name="chevron-down" size={18} color={tokens.fg} />
    </Pressable>
  );
}
