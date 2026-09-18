import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, FlatList, Platform, Pressable, ScrollView, Share, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, qk, write } from "../api";
import { CONFIG } from "../config";
import { useApp } from "../state";
import { shell } from "../shell";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { num } from "@/core/i18n";
import { RailCard, RAIL_CARD_W } from "../discover/RailCard";
import { HoldHost, ToastHost, type HoldHostRef, type ToastHostRef } from "../HoldHost";
import { CardStoreContext, createCardStore } from "../cardStore";
import { marksOf, useCardActs } from "../cardActs";
import { ListReviewSheet, type MyReview } from "../library/ListReviewSheet";
import { ReviewRow } from "../title/TitleCommunity";
import type { CardAnchor, CardItem } from "../library/PosterCard";
import type { CuratedCard } from "../contracts";
import type { LibraryPayload, ListDetailItem, ListDetailPayload, SaveListBody } from "../contracts";

/**
 * ====== صفحةُ القائمة — شاشةٌ أصليّة (D-1036 · الشريحةُ الأولى: القراءة) ======
 *
 * **لماذا** (طلبُ أحمد بعد بلاغ D-1035: «اجعل صفحة القائمة تطبيق أصليّة»): أكثرُ صفحة ويب تُفتح من
 * داخل شاشتين أصليّتين — برأسٍ آخر وانتقالٍ أبطأ وضوءِ شريطٍ يُخمَّن. الآن تُدفع في المكدّس فوق
 * «المكتبة»/«اكتشف» كصفحة العمل (D-956)، والرجوعُ يعيد ما تحتها كما تُرك.
 *
 * 🔑 **التخطيطُ تخطيطُ `ListDetail` بحكم D-678** (حكمُ أحمد بعد أن رأى الشبكةَ ورفضها): الاسمُ والنبذةُ
 * وصاحبُها · سطرُ الحقائق · **الأعمالُ رفٌّ أفقيٌّ** مرقَّمٌ (أو بسنة الفوز — D-995) · **شريطُ الحال** ♥ 💬 ★
 * (تشريحُ `ListCard` نفسُه: القلبُ هو الحفظ، والنجمةُ بابُ رأيي) · ثمّ الآراءُ تحتَه.
 * 🔑 **لا عنصرَ جديداً**: `RailCard` بطاقةُ «اكتشف» · `HoldHost`/`ToastHost`/`cardStore` (D-1028) ·
 * `useCardActs` (مستخرَجٌ من «اكتشف») · `ListReviewSheet` ورقةُ رأيي القائمة · `ReviewRow` صفُّ رأي العمل.
 *
 * ⚖️ **ما بقي ويبيّاً ببابٍ من هنا** (الشريحةُ الثانية): تحريرُ المالك (الاسمُ والنوعُ والغلافُ والترتيبُ
 * والحذف) وورقةُ الإعلان، والردودُ والقلوبُ على آراء الناس، ومفتاحُ التشغيل. **بابٌ ظاهرٌ لا نقصٌ صامت.**
 */
const HEADER_H = 64;
const PAGE_PAD = 16;
const GAP = 10;

const asCard = (it: ListDetailItem): CuratedCard => ({ kind: it.kind, id: it.id, title: it.title, poster_path: it.poster_path, imdb_rating: null }) as CuratedCard;
const keyOf = (it: ListDetailItem) => `${it.kind}-${it.id}`;
const layoutOf = (_: unknown, index: number) => ({ length: RAIL_CARD_W + GAP, offset: PAGE_PAD + (RAIL_CARD_W + GAP) * index, index });

export function ListScreen({ id, from }: { id: string; from: "library" | "discover" }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.list(id),
    queryFn: async () => (await api<ListDetailPayload>(`/api/v1/lists/${id}`)).data,
    staleTime: 60_000,
  });
  const d = q.data;
  /* خيطُ المكتبة تحت الملصقات — كاشُ `me:library` المشترك، عبر `cardStore` فتُعاد البطاقةُ المعنيّةُ وحدَها */
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
      void q.refetch();
    },
    [t, say, q],
  );

  const openCard = useCallback((c: { kind: "tv" | "movie"; id: number }) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: c.kind, id: String(c.id), from } }), [router, from]);
  /* بابُ الويب لما لم يُنقل بعد — الرجوعُ منه يعيد الشاشةَ التي فُتحت منها القائمة (D-949) */
  const openWeb = useCallback((path: string) => void shell.open(path, { returnTo: from }).then(back), [from, back]);

  const holdHost = useRef<HoldHostRef<CuratedCard>>(null);
  const hold = useCallback((c: CuratedCard, anchor: CardAnchor) => holdHost.current?.open(c, anchor), []);
  const onHeld = useCallback((c: CuratedCard | null) => store.setHeld(c ? `${c.kind}-${c.id}` : null), [store]);
  const act = useCardActs<CuratedCard>(store, { onReview: openCard, onError: fail });
  const heldItemOf = useCallback(
    (c: CuratedCard): CardItem => {
      const m = store.mark(`${c.kind}-${c.id}`);
      return { key: `${c.kind}-${c.id}`, kind: c.kind, id: c.id, title: c.title, posterPath: c.poster_path, progress: m?.progress ?? 0, completed: !!m?.completed, dropped: !!m?.dropped };
    },
    [store],
  );
  const inListOf = useCallback((c: CuratedCard) => !!store.mark(`${c.kind}-${c.id}`), [store]);

  /* الحفظُ تفاؤليّاً في كاش الصفحة — القلبُ هو الحفظ (D-324) وعدُّه يتبع الضغطة في مكانه */
  const [saving, setSaving] = useState(false);
  const toggleSave = useCallback(async () => {
    if (!d || !d.can_save || saving) return;
    const want = !d.saved_by_me;
    setSaving(true);
    qc.setQueryData<ListDetailPayload>(qk.list(id), (p) => (p ? { ...p, saved_by_me: want, saves: Math.max(0, p.saves + (want ? 1 : -1)) } : p));
    try {
      await write<{ saved: boolean }>("/api/v1/lists/save", { listId: id, save: want } satisfies SaveListBody);
      say(want ? t.listSavedToast : t.listUnsavedToast);
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  }, [d, saving, qc, id, say, t, fail]);

  const [reviewOpen, setReviewOpen] = useState(false);
  const onReviewSaved = useCallback(
    (next: MyReview | null) => {
      setReviewOpen(false);
      qc.setQueryData<ListDetailPayload>(qk.list(id), (p) => (p ? { ...p, my_review: next } : p));
      /* المتوسّطُ والعدُّ وصفُّ رأيي في قائمة الآراء يحسبها الخادم — تُجلب بعد الكتابة لا تُخمَّن */
      void q.refetch();
      void qc.invalidateQueries({ queryKey: ["me:lists"] });
    },
    [qc, id, q],
  );

  const share = useCallback(async () => {
    if (!d) return;
    /* قائمتي الخاصّة: الإعلانُ قبل المشاركة، وورقتُه ويبيّةٌ بعد (`?share=1` — نهجُ `ListsTab`) */
    if (d.mine && !d.is_public) return openWeb(`/lists/${id}?share=1`);
    try {
      await Share.share({ message: `${d.name} — ${CONFIG.apiBase}/lists/${id}`, url: `${CONFIG.apiBase}/lists/${id}` });
    } catch {
      /* أُغلقت الورقة */
    }
  }, [d, id, openWeb]);

  const numbered = d ? d.kind === "ranked" || d.kind === "watch_order" : false;
  const renderItem = useCallback(
    ({ item, index }: { item: ListDetailItem; index: number }) => (
      <RailCard card={asCard(item)} rank={item.badge ?? (numbered ? index + 1 : null)} rankTone={item.badge !== null ? "accent" : undefined} lib={null} onPress={openCard} onHold={hold} />
    ),
    [numbered, openCard, hold],
  );

  const facts: { icon: IconName; label: string }[] = d
    ? [
        { icon: "library", label: d.smart ? t.smartListLabel : t.listCount(d.items.length) },
        ...(d.kind === "ranked" ? [{ icon: "list" as const, label: t.listTypeRanked }] : d.kind === "watch_order" ? [{ icon: "list" as const, label: t.listTypeWatch }] : []),
        ...(d.is_public ? [{ icon: "eye" as const, label: d.mine ? t.listPublic : t.listOwnerOther }] : []),
      ]
    : [];

  return (
    <CardStoreContext.Provider value={store}>
      <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
        {/* الترويسة — رجوعٌ · الاسمُ · مشاركة (ترويسةُ صفحتَي العمل والشخص نفسُها) */}
        <View style={{ height: HEADER_H, borderBottomWidth: 1, borderBottomColor: tokens.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 56 }}>
          <Text size={15} weight="700" numberOfLines={1}>{d?.name ?? ""}</Text>
          <Pressable onPress={back} hitSlop={12} accessibilityLabel={t.closeLabel} style={{ position: "absolute", start: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}>
            <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 11, height: 11, borderStartWidth: 2, borderTopWidth: 2, borderColor: tokens.fg, transform: [{ rotate: "-45deg" }], marginStart: 4 }} />
            </View>
          </Pressable>
          {d ? (
            <Pressable onPress={() => void share()} hitSlop={12} accessibilityLabel={t.shareLinkLabel} style={{ position: "absolute", end: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}>
              <Icon name="share" size={20} color={tokens.fg} />
            </Pressable>
          ) : null}
        </View>

        {!d ? (
          q.isError ? (
            <View style={{ padding: PAGE_PAD, alignItems: "center", gap: 12, paddingTop: 48 }}>
              <Text muted>{t.apiInternal}</Text>
              <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
            </View>
          ) : (
            <View style={{ padding: PAGE_PAD, gap: 12 }}>
              <View style={{ height: 26, width: "65%", borderRadius: 6, backgroundColor: tokens.surface2 }} />
              <View style={{ height: 14, width: "90%", borderRadius: 6, backgroundColor: tokens.surface2 }} />
              <View style={{ flexDirection: "row", gap: GAP, marginTop: 12 }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={{ width: RAIL_CARD_W, aspectRatio: 2 / 3, borderRadius: radius.poster, backgroundColor: tokens.surface2 }} />
                ))}
              </View>
            </View>
          )
        ) : (
          <ScrollView contentContainerStyle={{ paddingTop: PAGE_PAD, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: PAGE_PAD, gap: 8 }}>
              <Text size={22} weight="700" style={{ lineHeight: 28 }}>{d.name}</Text>
              {d.subtitle ? <Text size={14} muted style={{ lineHeight: 21 }}>{d.subtitle}</Text> : null}
              {d.owner ? (
                <Pressable disabled={!d.owner.username} onPress={() => openWeb(`/u/${d.owner?.username}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, alignSelf: "flex-start" }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }}>
                    {d.owner.avatar ? <Image source={{ uri: d.owner.avatar }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                  </View>
                  <Text size={13} muted>{d.owner.name}</Text>
                </Pressable>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6, marginTop: 6 }}>
                {facts.map((f) => (
                  <View key={f.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Icon name={f.icon} size={14} color={tokens.accent} />
                    <Text size={12} muted>{f.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {d.items.length === 0 ? (
              <Text size={13} muted style={{ textAlign: "center", paddingVertical: 56 }}>{t.listItemsEmpty}</Text>
            ) : (
              <FlatList
                horizontal
                data={d.items}
                keyExtractor={keyOf}
                renderItem={renderItem}
                getItemLayout={layoutOf}
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 16 }}
                contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}
                initialNumToRender={5}
                windowSize={5}
              />
            )}

            {/* شريطُ الحال — تشريحُ `ListCard`: ♥ الحفظ · 💬 الآراء · ★ المتوسّط وبابُ رأيي. للمعلنة وحدَها */}
            {d.is_public ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 20, marginTop: 16, marginHorizontal: PAGE_PAD, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
                <Pressable disabled={!d.can_save || saving} onPress={() => void toggleSave()} hitSlop={8} accessibilityLabel={d.saved_by_me ? t.listUnsaveLabel : t.listSaveBtn} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name={d.can_save && !d.saved_by_me ? "heart" : "heart-filled"} size={18} color={tokens.accent} />
                  <Text size={14} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(d.saves, locale)}</Text>
                </Pressable>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name="comment" size={18} color={tokens.accent} />
                  <Text size={14} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(d.reviews, locale)}</Text>
                </View>
                <Pressable disabled={!d.can_review} onPress={() => setReviewOpen(true)} hitSlop={8} accessibilityLabel={t.listReviewsTitle} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon name={d.my_review ? "star-filled" : "star"} size={18} color={tokens.accent} />
                  <Text size={14} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{d.rating !== null ? d.rating.toFixed(1) : num(0, locale)}</Text>
                </Pressable>
              </View>
            ) : null}

            {d.is_public ? (
              <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 20, gap: 12 }}>
                <Text size={17} weight="700">{t.listReviewsTitle}</Text>
                {d.can_review ? (
                  <Button label={d.my_review ? `${t.listReviewMine} · ${num(d.my_review.rating, locale)}/${num(10, locale)}` : t.rateTitle} variant="ghost" onPress={() => setReviewOpen(true)} />
                ) : null}
                {d.review_rows.map((r) => (
                  <ReviewRow key={r.user_id} r={r} />
                ))}
                {/* الردودُ والقلوبُ على الآراء ويبيّةٌ بعد — بابٌ ظاهر */}
                {d.review_rows.length > 0 ? <Button label={`${t.tabCommunity} ↗`} variant="ghost" onPress={() => openWeb(`/lists/${id}?from=app`)} /> : null}
              </View>
            ) : null}

            {d.mine ? (
              <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 24 }}>
                <Button label={`${t.listEditTitle} ↗`} variant="ghost" onPress={() => openWeb(`/lists/${id}?from=app`)} />
              </View>
            ) : null}
          </ScrollView>
        )}

        <HoldHost hostRef={holdHost} variant="list" toItem={heldItemOf} inListOf={inListOf} onAction={act} onHeld={onHeld} />
        {reviewOpen && d ? <ListReviewSheet listId={id} listName={d.name} mine={d.my_review ? { rating: d.my_review.rating, body: d.my_review.body, has_spoiler: d.my_review.has_spoiler } : null} onClose={() => setReviewOpen(false)} onSaved={onReviewSaved} onError={fail} /> : null}
        <ToastHost hostRef={toastHost} bottom={insets.bottom + 16} />
      </View>
    </CardStoreContext.Provider>
  );
}
