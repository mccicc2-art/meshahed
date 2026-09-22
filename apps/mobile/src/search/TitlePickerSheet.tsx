import React, { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { Divided, RowsSkeleton, TitleRow } from "./SearchRows";
import { MIN_QUERY, useDebounced, useSearch } from "./useSearch";
import type { SearchTitle } from "../contracts";

/**
 * ====== منتقي عملٍ — `TitleSearchSheet` (الويب) بوضع `onPick` (Phase 11-G · G4) ======
 *
 * 🔑 **لماذا الآن**: كان «أضِف أعمالاً» في صفحة القائمة الأصليّة بابَ ويبٍ (KNOWN_GAP في D-1037) لأنّ الإضافةَ
 * بحثٌ + اختيار، ولا بحثَ أصليّاً قبل اليوم. الورقةُ تقرأ `useSearch` نفسَه بنطاق `titles` (سقفُ ٢٤ كالرقاقة)،
 * وترسم `TitleRow` نفسَه — **لا حقلَ ثانياً ولا صفَّ ثانياً** (القاعدة ٣)؛ والاختلافُ الوحيد أنّ الصفَّ يختار
 * لا يفتح، كما يفعل الويب حين يمرَّر `onPick` (يُخفي التبويبات ويثبّت وضعَ الأعمال).
 *
 * 🔑 **ورقةٌ سفليّة** لا وسطيّة (قاعدةُ D-1032): يفتحها صاحبُها بنفسه، وهي أداة.
 */
export function TitlePickerSheet({ onPick, onClose }: { onPick: (t: SearchTitle) => void; onClose: () => void }) {
  const { t, tokens } = useApp();
  const [q, setQ] = useState("");
  const term = useDebounced(q);
  const search = useSearch(term, "titles");
  const short = term.trim().length < MIN_QUERY;
  const data = search.data;

  return (
    <Sheet title={t.listAddTitles} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <View style={{ position: "relative", justifyContent: "center" }}>
          <View pointerEvents="none" style={{ position: "absolute", start: 14, zIndex: 1 }}>
            <Icon name="search" size={18} color={tokens.muted} />
          </View>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={tokens.muted}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            style={{ minHeight: 48, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.md, paddingStart: 40, paddingEnd: 12, paddingVertical: 12, fontSize: 16, color: tokens.fg, textAlign: "left" }}
          />
        </View>
        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {short ? (
            <Text size={13} muted style={{ textAlign: "center", paddingVertical: 40 }}>{t.searchStart}</Text>
          ) : !data ? (
            <RowsSkeleton rows={4} />
          ) : data.titles.length === 0 ? (
            <Text size={13} muted style={{ textAlign: "center", paddingVertical: 40 }}>{t.searchNoResults}</Text>
          ) : (
            <View style={{ opacity: search.isPlaceholderData ? 0.6 : 1 }}>
              <Divided>
                {data.titles.map((r) => (
                  <TitleRow key={`${r.mediaType}-${r.id}`} r={r} onPress={() => onPick(r)} />
                ))}
              </Divided>
            </View>
          )}
        </ScrollView>
      </View>
    </Sheet>
  );
}
