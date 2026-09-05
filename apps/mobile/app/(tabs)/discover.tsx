import React from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/api";
import { useApp } from "../../src/state";
import { Loading, PosterTile, Rail, Screen, Text } from "../../src/ui";
import { space } from "../../src/theme";
import type { DiscoverPayload, DiscoverRail } from "../../src/contracts";

/**
 * اكتشف — `/api/v1/discover` (D-919): خمسةُ صفوفٍ من دوالِّ «اكتشف» في الويب
 * نفسِها. عامٌّ ومُخزَّنٌ ساعةً في الـCDN، **فلا يُبطله وسمٌ**: `staleTime`
 * ساعةٌ هنا كذلك — لا رحلةَ عند كلِّ عودةٍ للتبويب.
 */
export default function Discover() {
  const { t, tokens } = useApp();
  const q = useQuery({
    queryKey: ["discover"],
    queryFn: async () => (await api<DiscoverPayload>("/api/v1/discover", { auth: false })).data,
    staleTime: 60 * 60_000,
  });

  const titleOf = (key: DiscoverRail["key"]) =>
    key === "trending_tv"
      ? `${t.trendingWeek} · ${t.discoverTabShows}`
      : key === "trending_movie"
        ? `${t.trendingWeek} · ${t.discoverTabMovies}`
        : key === "anime"
          ? t.discoverTabAnime
          : key === "airing"
            ? t.airingNowAnime
            : t.comingSoon;

  if (q.isLoading) return <Screen><Loading /></Screen>;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingVertical: space.md, paddingBottom: space.xl, gap: space.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={tokens.accent} />}
      >
        <View style={{ paddingHorizontal: space.lg }}>
          <Text size={28} weight="700">{t.newsTitle}</Text>
        </View>
        {(q.data?.rails ?? []).map((rail) => (
          <Rail
            key={rail.key}
            title={titleOf(rail.key)}
            data={rail.items}
            keyOf={(c) => `${c.kind}:${c.id}`}
            render={(c) => (
              <Link href={{ pathname: "/title/[kind]/[id]", params: { kind: c.kind, id: String(c.id) } }} asChild>
                <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
                  <PosterTile
                    path={c.poster_path}
                    title={c.title}
                    subtitle={[c.year, c.vote_average ? `★ ${c.vote_average.toFixed(1)}` : null].filter(Boolean).join(" · ")}
                  />
                </Pressable>
              </Link>
            )}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}
