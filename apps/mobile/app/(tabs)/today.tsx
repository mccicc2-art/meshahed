import React from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, qk, queryClient, write } from "../../src/api";
import { useApp } from "../../src/state";
import { Loading, PosterTile, Rail, Screen, Text } from "../../src/ui";
import { radius, space } from "../../src/theme";
import { backdropUrl } from "@/core/media";
import type { ContinueItem, HomePayload, TrackResult, WeekEpisode } from "../../src/contracts";

/**
 * الرئيسية — `/api/v1/me/home` في ردٍّ واحد (D-919).
 *
 * 🔑 **ثلاثةُ أسئلةٍ لا عشرة صفوف**: ماذا أُكمل؟ ما الذي يُذاع هذا الأسبوع؟
 * ماذا أبدأ؟ — والحلقةُ التالية محسوبةٌ في الخادم بالدالّة الواحدة.
 *
 * 🔑 **«✓» على البطاقة تعلّم الحلقةَ التاليةَ مشاهَدةً تفاؤليّاً** (نمطُ
 * شاشة الموسم): البطاقةُ تتقدّم فوراً، والخطأُ يرجعها، والوسومُ التي
 * يعيدها الخادم (`home`) تعيد جلبَ الصفحة فتصحّ الأرقام.
 */
const KEY = qk.tag("home");

export default function Today() {
  const { t, tokens, me } = useApp();
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => (await api<HomePayload>("/api/v1/me/home")).data,
  });

  const markNext = useMutation({
    mutationFn: (item: ContinueItem) =>
      write<TrackResult>("/api/v1/track/episode", {
        showTmdbId: item.id,
        season: item.next!.season,
        episode: item.next!.episode,
        runtime: item.next!.runtime,
        watched: true,
        title: item.title,
        posterPath: item.poster_path,
      }),
    onMutate: (item) =>
      queryClient.setQueryData<HomePayload>(KEY, (old) =>
        old && {
          ...old,
          continue: old.continue.map((c) =>
            c.id === item.id ? { ...c, watched: c.watched + 1, next: null } : c,
          ),
        },
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  if (q.isLoading) return <Screen><Loading /></Screen>;
  const d = q.data;
  const empty = !d || (d.continue.length === 0 && d.week.length === 0 && d.start.length === 0);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingVertical: space.md, paddingBottom: space.xl, gap: space.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={tokens.accent} />}
      >
        <View style={{ paddingHorizontal: space.lg }}>
          <Text size={28} weight="700">{t.navHome}</Text>
          {me?.nickname ? <Text muted size={13}>{me.nickname}</Text> : null}
        </View>

        {empty ? (
          <View style={{ alignItems: "center", gap: space.md, paddingTop: 48, paddingHorizontal: space.lg }}>
            <Text muted style={{ textAlign: "center" }}>{t.libraryEmpty}</Text>
            <Link href="/(tabs)/discover" asChild>
              <Pressable style={{ paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: tokens.accent }}>
                <Text weight="600" style={{ color: tokens.onAccent }}>{t.newsTitle}</Text>
              </Pressable>
            </Link>
          </View>
        ) : null}

        {d && (
          <Rail
            title={t.continueWatching}
            data={d.continue}
            keyOf={(c) => String(c.id)}
            render={(c) => (
              <ContinueCard item={c} busy={markNext.isPending && markNext.variables?.id === c.id} onMark={() => markNext.mutate(c)} />
            )}
          />
        )}

        {d && d.week.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text size={20} weight="700" style={{ paddingHorizontal: space.lg }}>{t.weekTitle}</Text>
            <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
              {d.week.map((e) => <WeekRow key={`${e.id}-${e.air_date}`} e={e} />)}
            </View>
          </View>
        )}

        {d && (
          <Rail
            title={t.libToWatch}
            data={d.start}
            keyOf={(s) => `${s.kind}:${s.id}`}
            render={(s) => (
              <Link href={{ pathname: "/title/[kind]/[id]", params: { kind: s.kind, id: String(s.id) } }} asChild>
                <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
                  <PosterTile path={s.poster_path} title={s.title} />
                </Pressable>
              </Link>
            )}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

/** بطاقةُ «أكمل المشاهدة» — خلفيّةٌ عريضةٌ وسطرُ الحلقة و«✓» (شكلُ بطاقة الويب) */
function ContinueCard({ item, busy, onMark }: { item: ContinueItem; busy: boolean; onMark: () => void }) {
  const { t, tokens } = useApp();
  const pct = item.aired > 0 ? Math.min(1, item.watched / item.aired) : 0;
  const left = Math.max(0, item.aired - item.watched);
  const bg = backdropUrl(item.backdrop_path, "w780");
  return (
    <Link href={{ pathname: "/title/[kind]/[id]", params: { kind: "tv", id: String(item.id) } }} asChild>
      <Pressable
        style={({ pressed }) => ({
          width: 280,
          height: 170,
          borderRadius: radius.lg,
          overflow: "hidden",
          backgroundColor: tokens.surface2,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {bg ? <Image source={{ uri: bg }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : null}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
        {item.next ? (
          <Pressable
            onPress={onMark}
            disabled={busy}
            hitSlop={8}
            accessibilityLabel={t.markWatchedBtn}
            style={{
              position: "absolute",
              top: space.md,
              right: space.md,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Text size={20} weight="700" style={{ color: "#fff" }}>✓</Text>
          </Pressable>
        ) : null}
        <View style={{ position: "absolute", left: space.md, right: space.md, bottom: space.md, gap: 4 }}>
          <Text size={18} weight="700" style={{ color: "#fff" }} numberOfLines={1}>{item.title}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text size={13} style={{ color: "rgba(255,255,255,0.85)" }}>
              {item.next ? `S${item.next.season} E${item.next.episode} · ${t.leftEps(left)}` : t.statusDone}
            </Text>
            <Text size={13} style={{ color: "rgba(255,255,255,0.85)" }}>{Math.round(pct * 100)}%</Text>
          </View>
        </View>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, backgroundColor: "rgba(255,255,255,0.15)" }}>
          <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: tokens.accent }} />
        </View>
      </Pressable>
    </Link>
  );
}

/** سطرُ «أسبوعك» — يومٌ وعملٌ وحلقة */
function WeekRow({ e }: { e: WeekEpisode }) {
  const { locale, tokens } = useApp();
  const day = new Date(e.air_date + "T00:00:00").toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    weekday: "short",
    day: "numeric",
  });
  return (
    <Link href={{ pathname: "/title/[kind]/[id]", params: { kind: "tv", id: String(e.id) } }} asChild>
      <Pressable
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          padding: space.sm,
          borderRadius: radius.md,
          backgroundColor: tokens.surface,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ width: 56, alignItems: "center" }}>
          <Text size={12} weight="700" style={{ color: tokens.accent }}>{day}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="600" numberOfLines={1}>{e.title}</Text>
          <Text muted size={12} numberOfLines={1}>
            {e.season && e.episode ? `S${e.season} E${e.episode}` : ""}
            {e.name ? ` · ${e.name}` : ""}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
