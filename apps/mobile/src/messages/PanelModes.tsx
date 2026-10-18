import React from "react";
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { GifImage, recentGifs, useGifSearch } from "../thread/GifPicker";
import { MIN_QUERY, useDebounced, useSearch } from "../search/useSearch";
import type { SearchTitle } from "../contracts";

/**
 * ====== 🆕 D-1440 — ما تعرضه لوحةُ «+» حين تختار GIF أو «بحث لوبز» ======
 *
 * أحمد ١٦ أكتوبر: «الـgif والصور والبحث كلّها تكون داخل الكيبورد ومكانُ الكتابة هو البحث». فالنتائجُ تُرسم **في اللوحة نفسِها
 * مكانَ لوحة المفاتيح** لا في ورقةٍ فوق المحادثة، وخانةُ الرسالة صارت خانةَ البحث (`ChatDock` يملك النصّ).
 * - **لوحةُ المفاتيح نازلة**: شبكةٌ تملأ اللوحة (`compact = false`).
 * - **لوحةُ المفاتيح ظاهرة** (تكتب البحث): صفٌّ أفقيٌّ فوق الخانة كالواتس (`compact`) — اللوحةُ كلُّها تحت لوحة المفاتيح.
 * - اللمسةُ ترسل فوراً، كما كانت في الورقة.
 */

const STRIP_H = 96;

export function GifPanel({ term, compact, onPick }: { term: string; compact: boolean; onPick: (id: string) => void }) {
  const { t, tokens } = useApp();
  const { width } = useWindowDimensions();
  const q = term.trim();
  const { hits, loading, more } = useGifSearch(q);
  const pick = (id: string) => {
    haptic.pick();
    onPick(id);
  };
  if (compact) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ height: STRIP_H, flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, alignItems: "center" }}>
        {hits.length === 0 ? <Text size={12} muted>{loading ? t.gifLoading : q ? t.gifNone : t.gifOff}</Text> : null}
        {hits.slice(0, 24).map((g) => (
          <Pressable key={g.id} onPress={() => pick(g.id)} accessibilityLabel={g.alt} style={{ height: STRIP_H - 12, width: Math.round((STRIP_H - 12) * (g.ratio || 1)), borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2 }}>
            <GifImage id={g.id} />
          </Pressable>
        ))}
      </ScrollView>
    );
  }
  /* الأخيرةُ من هذا الجهاز أوّلاً حين الحقلُ فارغ — كالورقة */
  const recent = q ? [] : recentGifs();
  const colW = Math.floor((width - 16 - 12) / 3);
  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={hits}
        numColumns={3}
        masonry
        keyExtractor={(g) => g.id}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.6}
        onEndReached={more}
        contentContainerStyle={{ paddingHorizontal: 6, paddingTop: 6 }}
        ListHeaderComponent={
          recent.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2, paddingBottom: 8 }}>
              {recent.map((id) => (
                <Pressable key={id} onPress={() => pick(id)} style={{ width: 64, height: 64, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2 }}>
                  <GifImage id={id} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => pick(item.id)} accessibilityLabel={item.alt} style={{ width: colW, height: Math.round(colW / (item.ratio || 1)), margin: 2, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2 }}>
            <GifImage id={item.id} />
          </Pressable>
        )}
        ListEmptyComponent={<Text size={12} muted style={{ textAlign: "center", paddingTop: 24 }}>{loading ? t.gifLoading : q ? t.gifNone : t.gifOff}</Text>}
        ListFooterComponent={<Text size={10} muted style={{ textAlign: "center", paddingVertical: 8 }}>{t.gifCredit}</Text>}
      />
    </View>
  );
}

export function LoopzPanel({ term, compact, onPick }: { term: string; compact: boolean; onPick: (r: SearchTitle) => void }) {
  const { t, tokens } = useApp();
  const { width } = useWindowDimensions();
  const q = useDebounced(term);
  const short = q.trim().length < MIN_QUERY;
  const search = useSearch(q, "titles");
  const rows = short ? [] : search.data?.titles ?? [];
  const pick = (r: SearchTitle) => {
    haptic.pick();
    onPick(r);
  };
  const empty = (
    <View style={{ alignItems: "center", justifyContent: "center", paddingTop: compact ? 0 : 28, gap: 8 }}>
      {search.isFetching ? <ActivityIndicator color={tokens.accent} /> : <Icon name="search" size={compact ? 18 : 26} color={tokens.muted} />}
      {compact ? null : <Text size={13} muted style={{ textAlign: "center", paddingHorizontal: 24 }}>{t.searchPlaceholder}</Text>}
    </View>
  );
  const poster = (r: SearchTitle, w: number) => (
    <View style={{ width: w, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
      {r.poster ? <Image source={{ uri: r.poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="film" size={18} color={tokens.muted} />}
    </View>
  );
  if (compact) {
    const w = Math.round((STRIP_H - 12) * (2 / 3));
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ height: STRIP_H, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: "center" }}>
        {rows.length === 0 ? empty : null}
        {rows.slice(0, 20).map((r) => (
          <Pressable key={`${r.mediaType}-${r.id}`} onPress={() => pick(r)} accessibilityLabel={r.title}>
            {poster(r, w)}
          </Pressable>
        ))}
      </ScrollView>
    );
  }
  const cols = 4;
  const w = Math.floor((width - 16 - (cols - 1) * 10) / cols);
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 8, paddingTop: 10, paddingBottom: 10 }}>
      {rows.length === 0 ? <View style={{ width: "100%" }}>{empty}</View> : null}
      {rows.map((r) => (
        <Pressable key={`${r.mediaType}-${r.id}`} onPress={() => pick(r)} accessibilityLabel={r.title} style={({ pressed }) => ({ width: w, gap: 4, opacity: pressed ? 0.7 : 1 })}>
          {poster(r, w)}
          <Text size={11} weight="600" numberOfLines={1}>{r.title}</Text>
          <Text size={10} muted numberOfLines={1}>{`${r.mediaType === "tv" ? t.typeSeries : t.typeMovie}${r.year ? ` · ${r.year}` : ""}`}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
