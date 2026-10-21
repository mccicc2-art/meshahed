import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { SYSTEM_FONT_CAP } from "../fontScale";
import { posterFor } from "../poster";
import { Sheet } from "../library/Sheet";
import { LoopzPanel } from "../messages/PanelModes";
import { recentRooms, type RecentRoom } from "../thread/recentRooms";
import type { CommunityRoom, SearchTitle } from "../contracts";

/**
 * ====== 🆕 R56 — بحثُ «Discussions» ======
 *
 * أحمد ٢١ أكتوبر: «اذا ابغى ادخل غرفة نقاش عمل اقدر من داخل صفحة العمل لاكن من هنا ما اقدر»؛ اختار **أيقونةَ 🔍 بجانب
 * الترتيب** (`discussions-4`) و«٢ أ»: قبل الكتابة «زرتها مؤخراً» ثمّ «الأنشط هذا الأسبوع».
 * 🔑 **البحثُ بحثُ لوحة «+» نفسُه** (`LoopzPanel` — شبكةُ ملصقاتٍ بـ`useSearch`) لا بحثٌ ثانٍ؛ واللمسةُ تفتح الغرفةَ بالباب
 * الذي تفتحها به البطاقة (`onOpen` ← `openThreadPath`). والورقةُ الواحدةُ في التطبيق (`Sheet`).
 */
export function TalkSearch({ rooms, onOpen, onClose }: { rooms: readonly CommunityRoom[]; onOpen: (kind: "tv" | "movie", id: number) => void; onClose: () => void }) {
  const { t, tokens } = useApp();
  const [term, setTerm] = useState("");
  const [recent, setRecent] = useState<RecentRoom[]>([]);
  useEffect(() => {
    let live = true;
    void recentRooms().then((r) => live && setRecent(r));
    return () => {
      live = false;
    };
  }, []);
  /* الأنشطُ أسبوعاً من الغرف التي في الحمولة أصلاً — بلا نداء */
  const active = [...rooms].filter((r) => r.postsWeek > 0).sort((a, b) => b.postsWeek - a.postsWeek).slice(0, 5);
  const open = (kind: "tv" | "movie", id: number) => {
    haptic.pick();
    onClose();
    onOpen(kind, id);
  };
  const row = (key: string, kind: "tv" | "movie", id: number, title: string, poster: string | null, sub: string) => (
    <Pressable key={key} onPress={() => open(kind, id)} accessibilityRole="link" accessibilityLabel={title} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 40, aspectRatio: 2 / 3, borderRadius: radius.sm, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
        {poster ? <Image source={{ uri: posterFor(poster, 40) ?? undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="film" size={14} color={tokens.muted} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size={14} weight="700" numberOfLines={1}>{title}</Text>
        <Text size={12} muted numberOfLines={1}>{sub}</Text>
      </View>
      <Icon name="comment" size={16} color={tokens.accent} />
    </Pressable>
  );
  const typed = term.trim().length > 0;
  return (
    <Sheet title={t.talkSearchTitle} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: typed ? tokens.accent : tokens.border, backgroundColor: tokens.surface }}>
        <Icon name="search" size={16} color={tokens.muted} />
        <TextInput
          value={term}
          onChangeText={setTerm}
          autoFocus
          returnKeyType="search"
          maxFontSizeMultiplier={SYSTEM_FONT_CAP}
          placeholder={t.talkSearchPlaceholder}
          placeholderTextColor={tokens.muted}
          style={{ flex: 1, fontSize: 15, color: tokens.fg, padding: 0 }}
        />
        {typed ? (
          <Pressable onPress={() => setTerm("")} hitSlop={8} accessibilityLabel={t.closeLabel}>
            <Icon name="close" size={16} color={tokens.muted} />
          </Pressable>
        ) : null}
      </View>
      {typed ? (
        <View style={{ height: 420 }}>
          <LoopzPanel term={term} compact={false} cols={3} onPick={(r: SearchTitle) => open(r.mediaType, r.id)} />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {recent.length ? <Text size={12} weight="700" muted style={{ marginTop: 6, marginBottom: 2 }}>{t.talkSearchRecent}</Text> : null}
          {recent.map((r) => row(`r-${r.kind}-${r.id}`, r.kind, r.id, r.title, r.poster, r.kind === "tv" ? t.typeSeries : t.typeMovie))}
          {active.length ? <Text size={12} weight="700" muted style={{ marginTop: 12, marginBottom: 2 }}>{t.talkSearchActive}</Text> : null}
          {active.map((r) => row(`a-${r.mediaType}-${r.tmdbId}`, r.mediaType, r.tmdbId, r.title?.trim() || "—", r.posterPath, t.talkRoomPostsWeek(r.postsWeek)))}
        </ScrollView>
      )}
    </Sheet>
  );
}
