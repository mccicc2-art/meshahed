import React from "react";
import { FlatList, Pressable, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, qk, queryClient, write } from "../../../../../src/api";
import { useApp } from "../../../../../src/state";
import { Button, Loading, Screen, Text } from "../../../../../src/ui";
import { radius, space } from "../../../../../src/theme";
import type { SeasonEpisode, SeasonPayload, TrackResult } from "../../../../../src/contracts";

/**
 * حلقاتُ موسم — **هنا يقع التتبّعُ الحقيقيّ**، وهو ما يقيسه Play.
 *
 * 🔑 **تفاؤلٌ محلّيّ ثمّ الخادم**: الضغطةُ تُرى فوراً، والخادمُ يُطبِّق
 * الوسومَ التي يعيدها (`home` · `me:stats` · `me:library`) فتُعاد المكتبةُ
 * جلبُها وحدَها. **وفي الفشل تُعاد الحلقةُ إلى حالها** — لا حالةٌ كاذبة.
 *
 * 🔑 **«حتى هنا» و«الموسمُ كلُّه» بنفس أجسام الويب** (`watchUpTo` ·
 * `setSeasonWatched`) — الحلقاتُ غيرُ المُذاعة لا تُرسل، كما في الويب.
 */
export default function Season() {
  const { id, n } = useLocalSearchParams<{ id: string; n: string }>();
  const tvId = Number(id);
  const seasonNumber = Number(n);
  const { t, tokens } = useApp();
  const key = qk.season(tvId, seasonNumber);

  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await api<SeasonPayload>(`/api/v1/title/tv/${tvId}/season/${seasonNumber}`)).data,
  });

  const today = new Date().toISOString().slice(0, 10);
  const aired = (e: SeasonEpisode) => !!e.air_date && e.air_date <= today;
  const ref = (e: SeasonEpisode) => ({ season: seasonNumber, episode: e.episode_number, runtime: e.runtime });

  const patch = (fn: (e: SeasonEpisode) => SeasonEpisode) =>
    queryClient.setQueryData<SeasonPayload>(key, (old) => old && { ...old, episodes: old.episodes.map(fn) });

  const toggle = useMutation({
    mutationFn: (e: SeasonEpisode) =>
      write<TrackResult>("/api/v1/track/episode", { showTmdbId: tvId, ...ref(e), watched: !e.watched }),
    onMutate: (e) => patch((x) => (x.episode_number === e.episode_number ? { ...x, watched: !e.watched } : x)),
    onError: (_err, e) => patch((x) => (x.episode_number === e.episode_number ? { ...x, watched: e.watched } : x)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [key[0]] }),
  });

  const upTo = useMutation({
    mutationFn: (e: SeasonEpisode) => {
      const eps = (q.data?.episodes ?? []).filter((x) => aired(x) && x.episode_number <= e.episode_number).map(ref);
      return write<TrackResult>("/api/v1/track/watch-up-to", { showTmdbId: tvId, episodes: eps });
    },
    onMutate: (e) => patch((x) => (aired(x) && x.episode_number <= e.episode_number ? { ...x, watched: true } : x)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [key[0]] }),
  });

  const whole = useMutation({
    mutationFn: (watched: boolean) => {
      const eps = (q.data?.episodes ?? []).filter(aired).map(ref);
      return write<TrackResult>("/api/v1/track/season", { showTmdbId: tvId, episodes: eps, watched });
    },
    onMutate: (watched) => patch((x) => (aired(x) ? { ...x, watched } : x)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [key[0]] }),
  });

  if (q.isLoading || !q.data) return <Screen><Loading /></Screen>;
  const eps = q.data.episodes;
  const airedEps = eps.filter(aired);
  const allDone = airedEps.length > 0 && airedEps.every((e) => e.watched);

  return (
    <Screen style={{ paddingTop: 0 }}>
      <Stack.Screen options={{ title: t.seasonLabel(seasonNumber) }} />
      <View style={{ padding: space.lg, gap: space.sm, flexDirection: "row" }}>
        <Button
          label={allDone ? t.seasonUndo : t.seasonAll}
          variant={allDone ? "ghost" : "primary"}
          busy={whole.isPending}
          style={{ flex: 1 }}
          onPress={() => whole.mutate(!allDone)}
        />
      </View>
      <FlatList
        data={eps}
        keyExtractor={(e) => String(e.episode_number)}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm }}
        renderItem={({ item: e }) => {
          const isAired = aired(e);
          return (
            <Pressable
              disabled={!isAired}
              onPress={() => toggle.mutate(e)}
              onLongPress={() => upTo.mutate(e)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: tokens.surface,
                opacity: !isAired ? 0.45 : pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: e.watched ? tokens.success : tokens.border,
                  backgroundColor: e.watched ? tokens.success : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {e.watched ? <Text size={14} weight="700" style={{ color: "#fff" }}>✓</Text> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="600" numberOfLines={1}>
                  {e.episode_number}. {e.name}
                </Text>
                <Text muted size={12}>
                  {e.air_date ?? ""}{e.runtime ? `  ·  ${e.runtime}′` : ""}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
