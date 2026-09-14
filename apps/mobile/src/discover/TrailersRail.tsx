import React from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import type { CuratedTab, TrailerCard, TrailersRailPayload } from "../contracts";

/**
 * ====== صفُّ التريلرات في «اكتشف» الأصليّة — D-958 (١٤ سبتمبر ٢٠٢٦) ======
 *
 * 🔑 **مصغّراتٌ وبابٌ لا مشغّل**: قرارُ C3 (D-955) أبقى المشغّلَ ويبيّاً، لكنّ
 * الشاشةَ الأصليّةَ **لم تعرض الصفَّ ولا باباً إليه أصلاً** — فمن يفتح «اكتشف» في
 * التطبيق لا يرى التريلرات (بلاغُ أحمد). هذا الصفُّ يسدّ الفجوةَ بلا تبعيّةٍ
 * جديدة: خلفيّةُ TMDB (أو مصغّرةُ يوتيوب من المفتاح) وزرُّ ▶ **والضغطُ يفتح
 * `/trailers?at=` في الغلاف** — المشغّلُ الواحدُ وصوتُه وتبديلُ الخانات كما هي.
 * **«ترايلرات لك» بالنصّ نفسِه والأيقونةِ نفسِها** (`t.trailersForYou` · `play`).
 * ⚠️ **الصمتُ عند الفراغ**: لا رأسَ بلا بطاقات (D-222).
 */
const CARD_W = 232;
const PAGE_PAD = 16;
const GAP = 12;

const thumbOf = (c: TrailerCard) => c.backdrop ?? `https://i.ytimg.com/vi/${c.video_key}/hqdefault.jpg`;

export function TrailersRail({ tab, onOpenWeb }: { tab: CuratedTab; onOpenWeb: (path: string) => void }) {
  const { t, tokens } = useApp();
  const q = useQuery({
    queryKey: ["discover:trailers", tab],
    queryFn: async () => (await api<TrailersRailPayload>(`/api/v1/discover/trailers?tab=${tab}`)).data,
    staleTime: 5 * 60_000,
  });
  const items = q.data?.items ?? [];
  if (!q.data) {
    return (
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAGE_PAD, marginBottom: 10 }}>
          <Icon name="play" size={16} color={tokens.accent} />
          <Text size={17} weight="700" style={{ flex: 1 }}>{t.trailersForYou}</Text>
        </View>
        <View style={{ flexDirection: "row", paddingHorizontal: PAGE_PAD, gap: GAP }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ width: CARD_W, aspectRatio: 16 / 9, borderRadius: radius.card, backgroundColor: tokens.surface2 }} />
          ))}
        </View>
      </View>
    );
  }
  if (items.length === 0) return null;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAGE_PAD, marginBottom: 10 }}>
        <Icon name="play" size={16} color={tokens.accent} />
        <Text size={17} weight="700" style={{ flex: 1 }} numberOfLines={1}>{t.trailersForYou}</Text>
        <Pressable onPress={() => onOpenWeb(q.data.see_all)} hitSlop={8}>
          <Text size={12} weight="600" color={tokens.accent}>{t.seeAll}</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(c) => `${c.kind}-${c.id}`}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpenWeb(item.href)} style={{ width: CARD_W, gap: 6 }} accessibilityLabel={`${t.trailerPlay} — ${item.title}`}>
            <View style={{ width: CARD_W, aspectRatio: 16 / 9, borderRadius: radius.card, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
              <Image source={{ uri: thumbOf(item) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={`${item.kind}-${item.id}`} />
              {/* دائرةُ ▶ كما في `TrailerCardMedia` (`h-14 w-14 rounded-full bg-black/60`) */}
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
                <Icon name="play" size={18} color="#fff" />
              </View>
            </View>
            <Text size={13} weight="600" numberOfLines={1}>{item.title}</Text>
            <Text size={11} muted numberOfLines={1}>{[item.year, item.genre].filter(Boolean).join(" · ")}</Text>
          </Pressable>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}
        initialNumToRender={3}
        windowSize={5}
      />
    </View>
  );
}
