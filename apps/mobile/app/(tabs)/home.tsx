import React, { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "../../src/api";
import { useApp } from "../../src/state";
import { Button, Loading, Poster, Screen, Text } from "../../src/ui";
import { radius, space } from "../../src/theme";
import type { LibraryItem, LibraryPayload, LibraryStatus } from "../../src/contracts";

/**
 * مكتبتي — الشاشةُ الأولى. الصفوفُ من `/api/v1/me/library` **بحالتها محسوبةً
 * في الخادم** بنفس قاعدة الويب، فلا يختلف «مكتمل» بين شاشتين.
 * الرقاقاتُ ترشّح محلّيّاً (العدّاداتُ تأتي مع الردّ، لا مرورٌ ثانٍ).
 */
const ORDER: LibraryStatus[] = ["watching", "unstarted", "completed", "dropped"];

export default function Home() {
  const { t, tokens } = useApp();
  const [filter, setFilter] = useState<LibraryStatus | "all">("all");
  const q = useQuery({
    queryKey: qk.tag("me:library"),
    queryFn: async () => (await api<LibraryPayload>("/api/v1/me/library")).data,
  });

  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    const filtered = filter === "all" ? all : all.filter((i) => i.status === filter);
    // الجاري أوّلاً، ثمّ الأحدثُ مشاهدةً
    return [...filtered].sort((a, b) => {
      const s = ORDER.indexOf(a.status) - ORDER.indexOf(b.status);
      if (s) return s;
      return (b.last_watched ?? b.added_at).localeCompare(a.last_watched ?? a.added_at);
    });
  }, [q.data, filter]);

  const label: Record<LibraryStatus, string> = {
    watching: t.statusWatching,
    unstarted: t.statusNotStarted,
    completed: t.statusDone,
    dropped: t.libStatusDropped,
  };

  if (q.isLoading) return <Screen><Loading /></Screen>;

  return (
    <Screen>
      <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md }}>
        <Text size={28} weight="700">{t.navLibrary}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md, flexWrap: "wrap" }}>
        {(["all", ...ORDER] as const).map((k) => {
          const on = filter === k;
          const count = k === "all" ? (q.data?.items.length ?? 0) : (q.data?.counts[k] ?? 0);
          return (
            <Pressable
              key={k}
              onPress={() => setFilter(k)}
              style={{
                paddingHorizontal: space.md,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: on ? tokens.accent : tokens.surface,
                borderWidth: 1,
                borderColor: on ? tokens.accent : tokens.border,
              }}
            >
              <Text size={13} weight="600" style={{ color: on ? tokens.onAccent : tokens.fg }}>
                {(k === "all" ? t.allWord : label[k]) + ` · ${count}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={tokens.accent} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: space.md, paddingTop: 64 }}>
            <Text muted style={{ textAlign: "center" }}>{t.libraryEmpty}</Text>
            <Link href="/(tabs)/search" asChild><Button label={t.libraryEmptyCta} /></Link>
          </View>
        }
        renderItem={({ item }) => <LibraryRow item={item} />}
      />
    </Screen>
  );
}

function LibraryRow({ item }: { item: LibraryItem }) {
  const { t, tokens } = useApp();
  const pct = item.aired > 0 ? Math.min(1, item.watched / item.aired) : 0;
  return (
    <Link href={{ pathname: "/title/[kind]/[id]", params: { kind: item.kind, id: String(item.id) } }} asChild>
      {/* 🔴 D-920: لا دالّةَ نمطٍ تحت `Link asChild` — الـSlot ينثرها كائناً فتضيع (كانت الصفوفُ تُرسم عموداً) */}
      <Pressable android_ripple={{ color: tokens.border }} style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <Poster path={item.poster_path} width={72} />
        <View style={{ flex: 1, justifyContent: "center", gap: 6 }}>
          <Text weight="600" numberOfLines={2}>{item.title}</Text>
          {item.kind === "tv" ? (
            <>
              <Text muted size={13}>{t.watchedOf(item.watched, item.aired)}</Text>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: tokens.surface2, overflow: "hidden" }}>
                <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: item.status === "completed" ? tokens.success : tokens.accent }} />
              </View>
            </>
          ) : (
            <Text muted size={13}>{item.watched ? t.statusDone : t.statusNotStarted}</Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}
