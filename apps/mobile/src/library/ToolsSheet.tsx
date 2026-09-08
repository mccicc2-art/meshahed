import React from "react";
import { Pressable, TextInput, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Sheet } from "./Sheet";

/**
 * ====== أدواتُ المكتبة — نسخةُ `LibraryToolsSheet.tsx` (الويب، تبويب «أدوات») ======
 * (Phase 11 · B4 — B0 §٣.١ V6)
 *
 * البحثُ (حقلٌ `min-h-11 bg-surface-2 border rounded-control ps-9`، الرمزُ في
 * طرفه، **Enter يقول «تمّ»** والكتابةُ تُصفّي خلف الورقة حرفاً بحرف) ثمّ الترتيبُ
 * **مقسّماً لا قائمةً** (D-076): ذكيّ · الأحدث · الاسم · التقدّم — اختيارُه يغلق
 * الورقة. **ما لم يُنقل مُعلَن**: إظهار/إخفاءُ الصفوف (KNOWN_GAP-8) وتحريرُ القائمة
 * الذكيّة (تبويب «القوائم» — KNOWN_GAP-10).
 */
export type LibrarySort = "smart" | "added" | "title" | "progress";

export function ToolsSheet({
  q,
  onQ,
  sort,
  onSort,
  onClose,
}: {
  q: string;
  onQ: (v: string) => void;
  sort: LibrarySort;
  onSort: (s: LibrarySort) => void;
  onClose: () => void;
}) {
  const { t, tokens } = useApp();
  const sorts: { id: LibrarySort; label: string }[] = [
    { id: "smart", label: t.sortSmart },
    { id: "added", label: t.sortAdded },
    { id: "title", label: t.sortTitle },
    { id: "progress", label: t.sortProgress },
  ];
  return (
    <Sheet title={t.libraryToolsTitle} onClose={onClose}>
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
              borderRadius: 10,
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
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider }} accessibilityRole="radiogroup">
          {sorts.map((s) => {
            const on = sort === s.id;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  onSort(s.id);
                  onClose();
                }}
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
      </View>
    </Sheet>
  );
}
