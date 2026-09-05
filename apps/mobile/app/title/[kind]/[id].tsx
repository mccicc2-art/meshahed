import React from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, qk, write } from "../../../src/api";
import { useApp } from "../../../src/state";
import { Button, Card, Loading, Poster, Screen, Text } from "../../../src/ui";
import { radius, space } from "../../../src/theme";
import { backdropUrl } from "@/core/media";
import type {
  FollowBody,
  RateBody,
  SetDroppedBody,
  TitlePayload,
  TrackResult,
  UnfollowBody,
  UnrateBody,
} from "../../../src/contracts";

/**
 * صفحةُ العمل — `/api/v1/title/{kind}/{id}` في ردٍّ واحد.
 * المسلسل: المواسمُ بتقدّمها، والضغطُ على موسمٍ يفتح حلقاتِه.
 * الفيلم: زرُّ «شاهدتُه» واحدٌ يبدّل.
 *
 * 🆕 D-916: **«تابِع» و«أوقف المتابعة» في صفٍّ واحدٍ تحت الرأس.** قبلها كان
 * الطريقُ الوحيدُ إلى المكتبة أن تشاهد حلقةً — فيلمٌ «للمشاهدة لاحقاً» لم
 * يكن له باب، والمختبِرُ يبحث ثمّ لا يجد كيف يضيف. الحالةُ من الخادم
 * (`me.following`/`me.dropped`) والوسومُ تعيد جلبَها — لا حالةَ محلّيّةً تنسى.
 *
 * 🆕 D-919: **التقييمُ من ١٠ بصفِّ رقاقات** (الضغطُ على الرقم المختار يزيله)
 * **وزرُّ الترايلر** يفتح يوتيوب بمفتاح TMDB — لا مشغّلَ داخليّاً في هذه
 * النسخة: مشغّلٌ مضمّنٌ حزمةٌ ثقيلةٌ لأجل زرٍّ واحد.
 */
export default function Title() {
  const { kind, id } = useLocalSearchParams<{ kind: "tv" | "movie"; id: string }>();
  const tmdbId = Number(id);
  const { t, tokens } = useApp();
  const q = useQuery({
    queryKey: qk.title(kind, tmdbId),
    queryFn: async () => (await api<TitlePayload>(`/api/v1/title/${kind}/${tmdbId}`)).data,
    enabled: (kind === "tv" || kind === "movie") && Number.isFinite(tmdbId),
  });

  const toggleMovie = useMutation({
    mutationFn: (watched: boolean) =>
      write<TrackResult>("/api/v1/track/movie", {
        movieTmdbId: tmdbId,
        runtime: q.data?.kind === "movie" ? q.data.runtime : null,
        watched,
      }),
    onSuccess: () => q.refetch(),
  });

  const setFollowing = useMutation({
    mutationFn: (following: boolean) =>
      following
        ? write<TrackResult>("/api/v1/track/follow", {
            tmdbId,
            mediaType: kind,
            title: q.data?.name ?? "",
            posterPath: q.data?.poster_path ?? null,
          } satisfies FollowBody)
        : write<TrackResult>("/api/v1/track/unfollow", { tmdbId, mediaType: kind } satisfies UnfollowBody),
    onSuccess: () => q.refetch(),
  });

  const setDropped = useMutation({
    mutationFn: (dropped: boolean) =>
      write<TrackResult>("/api/v1/track/dropped", { tmdbId, mediaType: kind, dropped } satisfies SetDroppedBody),
    onSuccess: () => q.refetch(),
  });

  const rate = useMutation({
    mutationFn: (rating: number | null) =>
      rating === null
        ? write<TrackResult>("/api/v1/track/unrate", { tmdbId, mediaType: kind } satisfies UnrateBody)
        : write<TrackResult>("/api/v1/track/rate", {
            tmdbId,
            mediaType: kind,
            rating,
            review: "",
            title: q.data?.name ?? "",
            posterPath: q.data?.poster_path ?? null,
          } satisfies RateBody),
    onSuccess: () => q.refetch(),
  });

  if (q.isLoading || !q.data) return <Screen><Loading /></Screen>;
  const d = q.data;
  const backdrop = backdropUrl(d.backdrop_path, "w780");

  return (
    <Screen style={{ paddingTop: 0 }}>
      <Stack.Screen options={{ title: d.name }} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>
        <View style={{ height: 200, backgroundColor: tokens.surface2 }}>
          {backdrop ? <Image source={{ uri: backdrop }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
        </View>
        <View style={{ flexDirection: "row", gap: space.md, paddingHorizontal: space.lg, marginTop: -48 }}>
          <Poster path={d.poster_path} width={96} />
          <View style={{ flex: 1, justifyContent: "flex-end", gap: 4 }}>
            <Text size={22} weight="700">{d.name}</Text>
            <Text muted size={13}>
              {(d.kind === "tv" ? d.first_air_date : d.release_date)?.slice(0, 4) ?? ""}
              {d.vote_average ? `  ·  ★ ${d.vote_average.toFixed(1)}` : ""}
            </Text>
            <Text muted size={13} numberOfLines={1}>{d.genres.map((g) => g.name).join(" · ")}</Text>
          </View>
        </View>

        <View style={{ padding: space.lg, gap: space.lg }}>
          {/* المتابعةُ أوّلاً: هي الفعلُ الذي يُدخل العملَ المكتبةَ — والإيقافُ لا معنى له قبلها */}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button
              style={{ flex: 1 }}
              label={d.me.following ? t.following : t.follow}
              variant={d.me.following ? "ghost" : "primary"}
              busy={setFollowing.isPending}
              onPress={() => setFollowing.mutate(!d.me.following)}
            />
            {d.me.following ? (
              <Button
                style={{ flex: 1 }}
                label={d.me.dropped ? t.resumeWatching : t.stopWatching}
                variant="ghost"
                busy={setDropped.isPending}
                onPress={() => setDropped.mutate(!d.me.dropped)}
              />
            ) : null}
          </View>

          {d.kind === "movie" ? (
            <Button
              label={d.me.watched ? t.statusDone + " ✓" : t.markWatchedBtn}
              variant={d.me.watched ? "ghost" : "primary"}
              busy={toggleMovie.isPending}
              onPress={() => toggleMovie.mutate(!d.me.watched)}
            />
          ) : (
            <Card style={{ gap: 4 }}>
              <Text weight="600">{t.watchedOf(d.me.watched_count, d.aired_total)}</Text>
              {d.next_episode_to_air ? (
                <Text muted size={13}>{t.nextEpisodeOn(d.next_episode_to_air.air_date ?? "")}</Text>
              ) : null}
            </Card>
          )}

          {d.trailer_key ? (
            <Button
              label={`▶ ${t.trailerPlay}`}
              variant="ghost"
              onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${d.trailer_key}`)}
            />
          ) : null}

          {d.me.following || d.me.rating !== null ? (
            <Card style={{ gap: space.sm }}>
              <Text weight="600" size={14}>{t.rateTitle}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                  const on = d.me.rating === n;
                  return (
                    <Pressable
                      key={n}
                      disabled={rate.isPending}
                      onPress={() => rate.mutate(on ? null : n)}
                      accessibilityLabel={on ? t.ratingDeleteAria : String(n)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.pill,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: on ? tokens.accent : tokens.surface2,
                        borderWidth: 1,
                        borderColor: on ? tokens.accent : tokens.border,
                        opacity: rate.isPending ? 0.6 : 1,
                      }}
                    >
                      <Text weight="700" size={14} style={{ color: on ? tokens.onAccent : tokens.fg }}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          ) : null}

          {d.overview ? <Text muted style={{ lineHeight: 22 }}>{d.overview}</Text> : null}

          {d.kind === "tv" ? (
            <View style={{ gap: space.sm }}>
              {d.seasons.map((s) => {
                const watchedInSeason = d.me.watched.filter((k) => k.startsWith(`${s.season_number}:`)).length;
                const done = s.aired > 0 && watchedInSeason >= s.aired;
                return (
                  <Link
                    key={s.season_number}
                    href={{ pathname: "/title/tv/[id]/season/[n]", params: { id: String(d.id), n: String(s.season_number) } }}
                    asChild
                  >
                    <Pressable
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space.md,
                        padding: space.md,
                        borderRadius: radius.md,
                        backgroundColor: tokens.surface,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text weight="600">{t.seasonLabel(s.season_number)}</Text>
                        <Text muted size={13}>{watchedInSeason} / {s.aired}</Text>
                      </View>
                      <Text style={{ color: done ? tokens.success : tokens.muted }}>{done ? "✓" : "›"}</Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
