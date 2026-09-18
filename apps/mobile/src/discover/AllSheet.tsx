import React from "react";
import { ActivityIndicator, FlatList, useWindowDimensions, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Sheet } from "../library/Sheet";
import { RailCard, RAIL_CARD_W, type LibMark } from "./RailCard";
import type { CuratedCard, SectionPayload } from "../contracts";
import type { CardAnchor } from "../library/PosterCard";

const PAD = 16;
const GAP = 10;

/**
 * «الكلّ ←» أصليّاً — D-994 (Phase 11-C4). كان باباً ويبيّاً إلى `discover/[section]`؛ صار ورقةً
 * (الورقةُ المشتركة) بشبكةٍ من بطاقات الصفّ نفسِها (`RailCard`، بخيط المكتبة وقائمة الضغط
 * المطوّل)، تُملأ صفحةً صفحةً من `/api/v1/discover/section` بالمعاملات التي حملها `see_all`
 * — التطبيقُ لا يفسّر الرابطَ، ينقل استعلامَه.
 */
export function AllSheet({
  title,
  query,
  hidden,
  onHold,
  onOpen,
  onClose,
}: {
  title: string;
  /** استعلامُ `see_all` بعد `?` (`m=…&s=…&…`) — مع `s` مأخوذاً من المسار */
  query: string;
  hidden: ReadonlySet<string>;
  onHold: (c: CuratedCard, anchor: CardAnchor) => void;
  onOpen: (c: CuratedCard) => void;
  onClose: () => void;
}) {
  const { t, tokens } = useApp();
  const { width } = useWindowDimensions();
  const cols = Math.max(2, Math.floor((width - PAD * 2 + GAP) / (RAIL_CARD_W + GAP)));
  const q = useInfiniteQuery({
    queryKey: ["discover:section", query] as const,
    queryFn: async ({ pageParam }) => (await api<SectionPayload>(`/api/v1/discover/section?${query}&pg=${pageParam}`)).data,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  });
  const items = (q.data?.pages ?? []).flatMap((p) => p.items).filter((c) => !hidden.has(`${c.kind}-${c.id}`));
  /* الصفحاتُ تراكميّة في الخادم (`LIMIT × pg`) — الجديدُ هو ما بعد طول الصفحة السابقة */
  const seen = new Set<string>();
  const unique = items.filter((c) => {
    const k = `${c.kind}-${c.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <Sheet title={title} onClose={onClose}>
      <FlatList
        data={unique}
        key={cols}
        numColumns={cols}
        keyExtractor={(c) => `${c.kind}-${c.id}`}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: 8 }}
        style={{ maxHeight: 560 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RailCard card={item} rank={null} lib={null} onPress={onOpen} onHold={onHold} />
        )}
        ListEmptyComponent={q.isLoading ? <ActivityIndicator color={tokens.accent} style={{ paddingVertical: 40 }} /> : <Text muted style={{ textAlign: "center", paddingVertical: 40 }}>{t.browseEmpty}</Text>}
        ListFooterComponent={
          q.hasNextPage ? (
            <View style={{ paddingTop: 8, alignItems: "center" }}>
              <Button label={t.showMore} variant="ghost" busy={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} />
            </View>
          ) : null
        }
      />
    </Sheet>
  );
}
