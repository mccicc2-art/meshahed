import React, { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import type { LibraryItem, SearchTitle } from "../contracts";
import { libraryQuery } from "../library/LibraryScreen";
import { posterFor } from "../poster";

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

/**
 * 🆕 D-1538 — **قبل الكتابة: آخرُ ما حدّثتَه في مكتبتك** (أحمد ٢٢ أكتوبر بلقطة القلم: «ليش علامتين بحث ولي مساحة فاضية كذا
 * قبل لا اكتب»، ثمّ «ب» على صورته و«رتبها لا يكون فيه فراغ عاليمين» و«اللي حدثتها مؤخرا»): كان الشريطُ المضغوطُ فارغاً بأيقونة بحثٍ
 * ثانية فوق خانة البحث. الآن صفٌّ واحدٌ يملأ العرضَ من الطرف إلى الطرف — العددُ من عرض الحاوية والعرضُ يُقسَم بالتساوي — مرتّبٌ بآخر
 * مشاهدةٍ أو إضافة. يقرأ استعلامَ المكتبة نفسَه (`libraryQuery` — الرئيسيّةُ تسخّنه)، ومكتبةٌ فارغةٌ ⇐ لا صفّ: الخانةُ وحدَها.
 */
const RECENT_MIN_W = 46;
const RECENT_GAP = 8;
const recentAt = (i: LibraryItem) => Math.max(Date.parse(i.last_watched ?? "") || 0, Date.parse(i.added_at) || 0);
function useRecentTitles(on: boolean): SearchTitle[] {
  const lib = useQuery({ ...libraryQuery, staleTime: 5 * 60_000, enabled: on });
  const items = lib.data?.items ?? [];
  return [...items]
    .sort((a, b) => recentAt(b) - recentAt(a))
    .slice(0, 12)
    .map((i) => {
      const path = i.display_poster_path ?? i.poster_path;
      /* `poster` رابطٌ جاهزٌ كنتيجة البحث (القلمُ يرسمه بعد الاختيار)، و`posterPath` الخامُ لما يُكتب */
      return { id: i.id, mediaType: i.kind, title: i.display_title ?? i.title, year: null, poster: posterFor(path, 96), posterPath: path };
    });
}

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

export function LoopzPanel({ term, compact, onPick, cols: colsIn }: { term: string; compact: boolean; onPick: (r: SearchTitle) => void; /** 🆕 R57 — أعمدةٌ من عرض الحاوية لا الشاشة (ورقةُ البحث أضيقُ من الشاشة) */ cols?: number }) {
  const { t, tokens } = useApp();
  const { width: screenW } = useWindowDimensions();
  /* 🆕 R57 — **الشبكةُ تُقاس من حاويتها** (أحمد ٢١ أكتوبر بلقطة بحث «Discussions»: «فيه فراغ فاليمين .. خل الاعمال جايه فالمنتصف
     بالضبط»؛ «ب» مكبّرة ١٢٪): كانت تحسب أربعةَ أعمدةٍ من عرض الشاشة فلا يتّسع في الورقة إلّا ثلاثةٌ ويبقى مكانُ الرابع فراغاً يميناً.
     الآن العرضُ عرضُ الحاوية، والشبكةُ في المنتصف بفراغين متساويين (حشوةٌ محسوبة لا توسيطُ كلِّ صفّ — فالصفُّ الأخيرُ الناقصُ يبدأ من أوّله) */
  const [boxW, setBoxW] = useState(0);
  const width = boxW || screenW;
  const q = useDebounced(term);
  const short = q.trim().length < MIN_QUERY;
  const search = useSearch(q, "titles");
  const rows = short ? [] : search.data?.titles ?? [];
  const recent = useRecentTitles(compact && short);
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
  if (compact && short) {
    if (!recent.length || !boxW) {
      /* القياسُ أوّلاً (عرضُ الحاوية يقرّر العدد)، ومكتبةٌ فارغةٌ لا ترسم شيئاً */
      return recent.length ? <View onLayout={(e) => setBoxW(Math.round(e.nativeEvent.layout.width))} style={{ height: 1 }} /> : null;
    }
    const inner = boxW - 32;
    const n = Math.max(3, Math.floor((inner + RECENT_GAP) / (RECENT_MIN_W + RECENT_GAP)));
    const w = Math.floor((inner - (n - 1) * RECENT_GAP) / n);
    return (
      <View onLayout={(e) => setBoxW(Math.round(e.nativeEvent.layout.width))} style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8 }}>
        <Text size={12} weight="600" muted>{t.panelRecent}</Text>
        <View style={{ flexDirection: "row", gap: RECENT_GAP }}>
          {recent.slice(0, n).map((r) => (
            <Pressable key={`${r.mediaType}-${r.id}`} onPress={() => pick(r)} accessibilityLabel={r.title} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              {poster(r, w)}
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
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
  const cols = colsIn ?? 4;
  /* ٣ أعمدة ⇐ الملصقُ أكبرُ ١٢٪ من مقاس الأربعة وما بقي فراغٌ متساوٍ في الطرفين */
  const w = colsIn ? Math.min(Math.floor(((width - 16 - 30) / 4) * 1.12), Math.floor((width - 16 - (cols - 1) * 10) / cols)) : Math.floor((width - 16 - (cols - 1) * 10) / cols);
  return (
    <ScrollView onLayout={(e) => setBoxW(Math.round(e.nativeEvent.layout.width))} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: colsIn ? Math.max(8, Math.floor((width - cols * w - (cols - 1) * 10) / 2)) : 8, paddingTop: 10, paddingBottom: 10 }}>
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
