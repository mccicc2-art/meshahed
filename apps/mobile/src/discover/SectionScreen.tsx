import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { api, ApiError, qk } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { RailCard, RAIL_CARD_W } from "./RailCard";
import { HoldHost, ToastHost, type HoldHostRef, type ToastHostRef } from "../HoldHost";
import { CardStoreContext, createCardStore } from "../cardStore";
import { marksOf, useCardActs } from "../cardActs";
import { usePullRefresh } from "../pullRefresh";
import { dismissed, useDismissed } from "./dismissed";
import type { CardAnchor, CardItem } from "../library/PosterCard";
import type { CuratedCard, LibraryPayload, SectionPayload } from "../contracts";

/**
 * ====== «الكلّ ←» شاشةٌ كاملة بتمريرٍ لا نهائيّ — D-1046 (Phase 11-F · F5) ======
 *
 * **لماذا**: كانت ورقةً سفليّةً بارتفاع ٥٦٠ فيها شبكةٌ وزرُّ «المزيد» (`AllSheet` — D-994): قسمٌ من مئات
 * الأعمال يُقرأ من نافذةٍ بثلث الشاشة وبضغطةٍ لكلِّ ستّين. الآن شاشةٌ تُدفع فوق «اكتشف» (كصفحة العمل والقائمة):
 * شبكةٌ افتراضيّة (`FlashList`) **تجلب صفحتَها التالية حين يقترب القاعُ** (`onEndReached` عند ٠٫٦)، ومؤشّرٌ في
 * الذيل بدل الزرّ. والخادمُ صار يردّ الشريحةَ وحدَها (المسارُ نفسُه — D-1046)، ومفتاحُ الكاش مفتاحُ الورقة
 * القديمة فلا يُجلب القسمُ مرّتين.
 *
 * 🔑 **لا عنصرَ جديداً**: `RailCard` · `HoldHost`/`ToastHost`/`cardStore` · `useCardActs` (بـ«غير مهتمّ» كما في
 * «اكتشف») · `usePullRefresh`. والترويسةُ ترويسةُ صفحتَي الشخص والقائمة.
 * 🔑 **«غير مهتمّ» هنا يخفي البطاقةَ في «اكتشف» تحتها أيضاً، فوراً** — المخزنُ واحد (`dismissed` — D-1053).
 */
const HEADER_H = 64;
const PAD = 16;
const GAP = 10;
const keyOf = (c: CuratedCard) => `${c.kind}-${c.id}`;

export function SectionScreen({ title, query }: { title: string; query: string }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cols = Math.max(2, Math.floor((width - PAD * 2 + GAP) / (RAIL_CARD_W + GAP)));

  const q = useInfiniteQuery({
    queryKey: ["discover:section", query] as const,
    queryFn: async ({ pageParam }) => (await api<SectionPayload>(`/api/v1/discover/section?${query}&pg=${pageParam}`)).data,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  });
  const hidden = useDismissed();
  const items = useMemo(() => {
    /* المكرَّرُ يسقط بمفتاحه: صفحةٌ قديمةٌ في الكاش (من قبل قصِّ الخادم) تراكميّةٌ، والجديدةُ شريحة */
    const seen = new Set<string>();
    const out: CuratedCard[] = [];
    for (const p of q.data?.pages ?? [])
      for (const c of p.items) {
        const k = keyOf(c);
        if (seen.has(k) || hidden.has(k)) continue;
        seen.add(k);
        out.push(c);
      }
    return out;
  }, [q.data, hidden]);

  const lib = useQuery({
    queryKey: qk.tag("me:library"),
    queryFn: async () => (await api<LibraryPayload>("/api/v1/me/library")).data,
    staleTime: 60_000,
  });
  const [store] = useState(createCardStore);
  const marks = useMemo(() => marksOf(lib.data?.items), [lib.data]);
  useEffect(() => store.setBase(marks), [store, marks]);

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  const toastHost = useRef<ToastHostRef>(null);
  const say = useCallback((text: string) => toastHost.current?.say(text), []);
  const fail = useCallback(
    (e: unknown) => {
      const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[key];
      say(typeof msg === "string" ? msg : t.apiInternal);
    },
    [t, say],
  );
  const openCard = useCallback((c: { kind: "tv" | "movie"; id: number }) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: c.kind, id: String(c.id), from: "discover" } }), [router]);
  const holdHost = useRef<HoldHostRef<CuratedCard>>(null);
  const hold = useCallback((c: CuratedCard, anchor: CardAnchor) => holdHost.current?.open(c, anchor), []);
  const onHeld = useCallback((c: CuratedCard | null) => store.setHeld(c ? keyOf(c) : null), [store]);
  const onDismiss = useCallback(
    (key: string, hide: boolean) => {
      if (hide) dismissed.add(key);
      else dismissed.restore(key);
      if (hide) say(t.dismissedToast);
    },
    [say, t],
  );
  const act = useCardActs<CuratedCard>(store, { onReview: openCard, onError: fail, onDismiss });
  const heldItemOf = useCallback(
    (c: CuratedCard): CardItem => {
      const m = store.mark(keyOf(c));
      return { key: keyOf(c), kind: c.kind, id: c.id, title: c.title, posterPath: c.poster_path, progress: m?.progress ?? 0, completed: !!m?.completed, dropped: !!m?.dropped };
    },
    [store],
  );
  const inListOf = useCallback((c: CuratedCard) => !!store.mark(keyOf(c)), [store]);

  const renderItem = useCallback(
    ({ item }: { item: CuratedCard }) => (
      <View style={{ alignItems: "center", paddingBottom: GAP }}>
        <RailCard card={item} rank={null} lib={null} onPress={openCard} onHold={hold} />
      </View>
    ),
    [openCard, hold],
  );
  const refreshControl = usePullRefresh([["discover:section", query]], 0);
  const more = useCallback(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
  }, [q]);

  return (
    <CardStoreContext.Provider value={store}>
      <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
        <View style={{ height: HEADER_H, borderBottomWidth: 1, borderBottomColor: tokens.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 56 }}>
          <Text size={15} weight="700" numberOfLines={1}>{title}</Text>
          <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.closeLabel} style={{ position: "absolute", start: PAD, top: 0, bottom: 0, justifyContent: "center" }}>
            <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 11, height: 11, borderStartWidth: 2, borderTopWidth: 2, borderColor: tokens.fg, transform: [{ rotate: "-45deg" }], marginStart: 4 }} />
            </View>
          </Pressable>
        </View>
        {q.isError && items.length === 0 ? (
          <View style={{ padding: PAD, alignItems: "center", gap: 12, paddingTop: 48 }}>
            <Text muted>{t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <FlashList
            data={items}
            key={cols}
            numColumns={cols}
            keyExtractor={keyOf}
            renderItem={renderItem}
            refreshControl={refreshControl}
            onEndReached={more}
            onEndReachedThreshold={0.6}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PAD - GAP / 2, paddingTop: PAD, paddingBottom: insets.bottom + 24 }}
            ListEmptyComponent={q.isLoading ? <ActivityIndicator color={tokens.accent} style={{ paddingVertical: 56 }} /> : <Text muted style={{ textAlign: "center", paddingVertical: 56 }}>{t.browseEmpty}</Text>}
            ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={tokens.accent} style={{ paddingVertical: 20 }} /> : null}
          />
        )}
        <HoldHost hostRef={holdHost} variant="discover" toItem={heldItemOf} inListOf={inListOf} onAction={act} onHeld={onHeld} />
        <ToastHost hostRef={toastHost} bottom={insets.bottom + 16} />
      </View>
    </CardStoreContext.Provider>
  );
}
