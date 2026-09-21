import React, { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Sheet } from "../library/Sheet";
import { posterFor } from "../poster";
import { backdropUrl } from "@/core/media";
import { radius } from "../theme";
import type { ListCoverBody, ListDetailItem, ListDetailPayload, TitleArtOptionsPayload } from "../contracts";

/**
 * ====== غلافُ قائمتي — D-1037 (L2) ======
 *
 * خطوتان كما في الويب: **عملٌ من القائمة** ثمّ **خلفيّةٌ من خلفيّاته**. الخلفيّاتُ من مسار صور العمل القائم
 * (`/api/v1/title/…/art` — كاشُه كاشُ `ArtSheet` نفسُه، المفتاحُ واحد) فلا مسارَ قراءةٍ جديداً.
 * «تلقائيّ» يعيد الغلافَ إلى ما يختاره الخادم (`null`). الألوانُ سقطت بـD-848 فلا تُعرض.
 */
export function ListCoverSheet({
  list,
  busy,
  onPick,
  onClose,
}: {
  list: ListDetailPayload;
  busy: boolean;
  onPick: (v: Omit<ListCoverBody, "listId">) => void;
  onClose: () => void;
}) {
  const { t, tokens } = useApp();
  const { width } = useWindowDimensions();
  const [item, setItem] = useState<ListDetailItem | null>(null);
  const art = useQuery({
    queryKey: ["title:art", item?.kind, item?.id] as const,
    queryFn: async () => (await api<TitleArtOptionsPayload>(`/api/v1/title/${item?.kind}/${item?.id}/art`)).data,
    enabled: !!item,
    staleTime: 10 * 60_000,
  });
  const cellW = (width - 16 * 2 - 10) / 2;
  const current = list.cover?.backdrop_path ?? null;

  return (
    <Sheet title={t.listCover} onClose={onClose}>
      {item ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text size={13} weight="600" numberOfLines={1} style={{ flex: 1 }}>{item.title}</Text>
            <Button label={t.listCoverBack} variant="ghost" onPress={() => setItem(null)} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
          </View>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {art.isLoading ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                {[0, 1].map((i) => <View key={i} style={{ width: cellW, aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: tokens.surface2 }} />)}
              </View>
            ) : (art.data?.backdrops.length ?? 0) === 0 ? (
              <Text size={13} muted style={{ paddingVertical: 24, textAlign: "center" }}>{t.artEmpty}</Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {art.data?.backdrops.map((b) => {
                  const on = b === current;
                  return (
                    <Pressable key={b} disabled={busy} onPress={() => onPick({ tmdbId: item.id, mediaType: item.kind, backdropPath: b })} style={{ width: cellW, aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", borderWidth: on ? 2 : 1, borderColor: on ? tokens.accent : tokens.border, backgroundColor: tokens.surface2 }}>
                      <Image source={{ uri: backdropUrl(b, "w780") ?? undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </>
      ) : (
        <>
          <Text size={12} muted style={{ lineHeight: 18 }}>{t.listCoverHint}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text size={12} weight="600" muted>{t.listCoverPick}</Text>
            {current ? <Button label={t.removeCover} variant="ghost" busy={busy} onPress={() => onPick({ tmdbId: null, mediaType: null, backdropPath: null })} style={{ paddingVertical: 8, paddingHorizontal: 14 }} /> : null}
          </View>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {list.items.map((it) => {
              const uri = posterFor(it.poster_path, 36);
              const on = list.cover?.tmdb_id === it.id && list.cover?.media_type === it.kind;
              return (
                <Pressable key={`${it.kind}-${it.id}`} onPress={() => setItem(it)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
                  <View style={{ width: 36, aspectRatio: 2 / 3, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }}>
                    {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
                  </View>
                  <Text size={14} numberOfLines={1} style={{ flex: 1 }}>{it.title}</Text>
                  {on ? <Text size={12} color={tokens.accent}>{t.listCoverSet}</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
    </Sheet>
  );
}
