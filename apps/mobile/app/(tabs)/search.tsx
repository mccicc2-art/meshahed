import React, { useEffect, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { rawGet } from "../../src/api";
import { useApp } from "../../src/state";
import { Loading, Poster, Screen, Text } from "../../src/ui";
import { radius, space } from "../../src/theme";
import type { SearchPayload, SearchTitle } from "@/core/searchTypes";

/**
 * البحث — يستعمل `/api/search` القائمَ كما هو (Phase 9 §4.3 القاعدة ٨):
 * نفسُ المسار الذي تستعمله صفحةُ البحث في الويب، **بلا نسخةٍ في `v1`**.
 * التأخيرُ ٣٠٠ مللي: نداءٌ لكلِّ حرفٍ يحرق حصّةَ TMDB على ما لن يُقرأ.
 */
export default function Search() {
  const { t, tokens } = useApp();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);

  const res = useQuery({
    queryKey: ["search", q],
    queryFn: () => rawGet<SearchPayload>(`/api/search?q=${encodeURIComponent(q)}&type=titles`),
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
  });

  return (
    <Screen>
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text size={28} weight="700">{t.navSearch}</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t.searchPlaceholder}
          placeholderTextColor={tokens.muted}
          autoCorrect={false}
          returnKeyType="search"
          style={{
            backgroundColor: tokens.surface,
            color: tokens.fg,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: 12,
            fontSize: 16,
            borderWidth: 1,
            borderColor: tokens.border,
            textAlign: "left",
          }}
        />
      </View>
      {res.isFetching && !res.data ? (
        <Loading />
      ) : (
        <FlatList
          data={res.data?.titles ?? []}
          keyExtractor={(i) => `${i.mediaType}:${i.id}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md }}
          ListEmptyComponent={q.length >= 2 && res.data ? <Text muted style={{ textAlign: "center", paddingTop: 32 }}>{t.searchNoResults}</Text> : null}
          renderItem={({ item }) => <Row item={item} />}
        />
      )}
    </Screen>
  );
}

function Row({ item }: { item: SearchTitle }) {
  return (
    <Link href={{ pathname: "/title/[kind]/[id]", params: { kind: item.mediaType, id: String(item.id) } }} asChild>
      <Pressable style={({ pressed }) => ({ flexDirection: "row", gap: space.md, opacity: pressed ? 0.8 : 1, alignItems: "center" })}>
        <Poster path={item.poster} width={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="600" numberOfLines={2}>{item.title}</Text>
          {item.titleSecondary ? <Text muted size={13} numberOfLines={1}>{item.titleSecondary}</Text> : null}
          <Text muted size={13}>{item.year ?? ""}</Text>
        </View>
      </Pressable>
    </Link>
  );
}
