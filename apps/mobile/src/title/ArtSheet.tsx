import React, { useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, write } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { posterUrl, backdropUrl } from "@/core/media";
import { extrasKey } from "./TitleExtras";
import type { TitleArtBody, TitleArtOptionsPayload, TitlePayload } from "../contracts";
import { qk } from "../api";

/**
 * ====== غلافُ العمل أصليّاً — D-1020 (١٨ سبتمبر ٢٠٢٦) ======
 *
 * قرارُ أحمد: «ليش ما تخلّي آرت وورك تطبيق أصليّ وتضيفها؟». وصفةُ `TitleArtSheet` الويب:
 * تبويبان (ملصقات · خلفيّات)، شبكةُ صورٍ من TMDB بلغة القارئ، المختارُ مؤطَّر، «الافتراضيّ» يمسح.
 * الحفظُ فوريٌّ عند الضغط (كالويب) ويُبطل صفحةَ العمل والمكتبةَ فتُرى الصورةُ الجديدة فوراً.
 * **بلس شرطُها** — الخادمُ يقرّر (`plus` في الردّ)؛ من ليس بلس يرى الصورَ ومعها بابُ بلس.
 */
export function ArtSheet({ kind, id, current, onPlus, onClose }: { kind: "tv" | "movie"; id: number; current: { poster: string | null; backdrop: string | null }; onPlus: () => void; onClose: () => void }) {
  const { t, tokens } = useApp();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<"poster" | "backdrop">("poster");
  const q = useQuery({
    queryKey: ["title:art", kind, id] as const,
    queryFn: async () => (await api<TitleArtOptionsPayload>(`/api/v1/title/${kind}/${id}/art`)).data,
    staleTime: 10 * 60_000,
  });
  const save = useMutation({
    mutationFn: (v: { posterPath: string | null; backdropPath: string | null }) => write<{ ok: true }>("/api/v1/track/title-art", { tmdbId: id, mediaType: kind, ...v } satisfies TitleArtBody),
    onSuccess: (_r, v) => {
      qc.setQueryData<TitlePayload>(qk.title(kind, id), (prev) => (prev ? { ...prev, poster_path: v.posterPath ?? prev.poster_path, backdrop_path: v.backdropPath ?? prev.backdrop_path } : prev));
      void qc.invalidateQueries({ queryKey: qk.title(kind, id) });
      void qc.invalidateQueries({ queryKey: extrasKey(kind, id) });
      void qc.invalidateQueries({ queryKey: qk.tag("me:library") });
    },
  });
  const rows = tab === "poster" ? (q.data?.posters ?? []) : (q.data?.backdrops ?? []);
  const cols = tab === "poster" ? 3 : 2;
  const gap = 8;
  const cellW = (width - 40 - gap * (cols - 1)) / cols;
  const chosen = tab === "poster" ? current.poster : current.backdrop;
  const pick = (path: string | null) => {
    if (q.data && !q.data.plus) {
      onPlus();
      return;
    }
    save.mutate(tab === "poster" ? { posterPath: path, backdropPath: current.backdrop } : { posterPath: current.poster, backdropPath: path });
  };
  return (
    <Sheet title={t.artTitle} onClose={onClose}>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider, marginBottom: 12 }}>
        {(["poster", "backdrop"] as const).map((k) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}>
              <Text size={14} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted}>{k === "poster" ? t.artPosters : t.artBackdrops}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text size={12} muted style={{ marginBottom: 10 }}>{t.artHint}</Text>
      <FlatList
        data={rows}
        key={tab}
        numColumns={cols}
        keyExtractor={(p) => p}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ gap, paddingBottom: 8 }}
        style={{ maxHeight: 420 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const on = chosen === item;
          const uri = tab === "poster" ? posterUrl(item, "w342") : backdropUrl(item, "w780");
          return (
            <Pressable onPress={() => pick(item)} accessibilityLabel={t.artChoose} style={{ width: cellW, aspectRatio: tab === "poster" ? 2 / 3 : 16 / 9, borderRadius: radius.poster, overflow: "hidden", borderWidth: 2, borderColor: on ? tokens.accent : "transparent", backgroundColor: tokens.surface2 }}>
              <Image source={{ uri: uri ?? undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={120} />
              {on ? (
                <View style={{ position: "absolute", top: 6, end: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="check-line" size={13} color={tokens.onAccent} />
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text muted style={{ textAlign: "center", paddingVertical: 32 }}>{q.isLoading ? "…" : t.artEmpty}</Text>}
      />
      <Button label={t.artUseDefault} variant="ghost" busy={save.isPending} onPress={() => pick(null)} style={{ marginTop: 8 }} />
    </Sheet>
  );
}
