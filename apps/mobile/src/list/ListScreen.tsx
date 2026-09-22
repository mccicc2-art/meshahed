import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, FlatList, Platform, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, qk, write } from "../api";
import { useApp } from "../state";
import { shell, type NativeRoot } from "../shell";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { num } from "@/core/i18n";
import { RailCard, RAIL_CARD_W } from "../discover/RailCard";
import { HoldHost, ToastHost, type HoldHostRef, type ToastHostRef } from "../HoldHost";
import { CardStoreContext, createCardStore } from "../cardStore";
import { marksOf, useCardActs } from "../cardActs";
import { ListReviewSheet, type MyReview } from "../library/ListReviewSheet";
import { ReorderSheet } from "../library/ReorderSheet";
import { Chip } from "../library/Chip";
import { ListEditSheet } from "./ListEditSheet";
import { ListCoverSheet } from "./ListCoverSheet";
import { ListReviews } from "./ListReviews";
import { TitlePickerSheet } from "../search/TitlePickerSheet";
import { ShareListSheet } from "./ShareListSheet";
import { SmartListSheet } from "../library/SmartListSheet";
import { haptic } from "../haptics";
import type { HoldAction } from "../library/HoldMenu";
import type { CardAnchor, CardItem } from "../library/PosterCard";
import type { CuratedCard, SearchTitle } from "../contracts";
import type {
  LibraryPayload, ListCoverBody, ListDeleteBody, ListDetailItem, ListDetailPayload, ListPlaylistBody, ListReorderBody, ListReplyDeleteBody,
  ListReviewLikeBody, ListReviewReplyBody, ListToggleItemBody, ListUpdateBody, QueueItem, SaveListBody,
} from "../contracts";

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
 * 🆕 **D-1037 · D-1038 (L2)** — صار أصليّاً: تحريرُ المالك (الاسمُ · النبذةُ · الخصوصيّةُ · النوع · الترتيبُ
 * بالسحب · الغلاف · الحذف) · إزالةُ عملٍ من قائمتي (صفٌّ في قائمة الضغط المطوّل) · مفتاحُ التشغيل · القلوبُ
 * والردودُ على آراء الناس. **كلُّ كتابةٍ تفاؤليّةٌ في كاش الصفحة، وتتراجع عند الفشل بإعادة الجلب.**
 * ⚖️ **ما بقي ويبيّاً ببابٍ ظاهر — ثلاثةٌ مربوطةٌ بشاشاتٍ لم تُنقل**: إضافةُ عمل (⇐ البحث) · المشاركةُ لصديق/
 * مجتمع وورقةُ الإعلان (⇐ شاشاتُ الناس) · محرّرُ شرط القائمة الذكيّة. تُغلق حين تُنقل شاشاتُها، لا قبلها.
 */
const HEADER_H = 64;
const PAGE_PAD = 16;
const GAP = 10;

const asCard = (it: ListDetailItem): CuratedCard => ({ kind: it.kind, id: it.id, title: it.title, poster_path: it.poster_path, imdb_rating: null }) as CuratedCard;
const keyOf = (it: ListDetailItem) => `${it.kind}-${it.id}`;
const layoutOf = (_: unknown, index: number) => ({ length: RAIL_CARD_W + GAP, offset: PAGE_PAD + (RAIL_CARD_W + GAP) * index, index });

export function ListScreen({ id, from }: { id: string; from: NativeRoot }) {
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
  const cardAct = useCardActs<CuratedCard>(store, { onReview: openCard, onError: fail });

  /* ====== D-1037 — كتاباتُ المالك ====== تفاؤلٌ في كاش الصفحة؛ `fail` يعيد الجلبَ فيتراجع كلُّ شيء */
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "edit" | "reorder" | "cover" | "add" | "share" | "rule">(null);
  const patch = useCallback((fn: (p: ListDetailPayload) => ListDetailPayload) => qc.setQueryData<ListDetailPayload>(qk.list(id), (p) => (p ? fn(p) : p)), [qc, id]);
  const run = useCallback(
    async (optimistic: ((p: ListDetailPayload) => ListDetailPayload) | null, job: () => Promise<unknown>, done?: () => void) => {
      setBusy(true);
      if (optimistic) patch(optimistic);
      try {
        await job();
        done?.();
        return true;
      } catch (e) {
        fail(e);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [patch, fail],
  );
  const act = useCallback(
    async (a: HoldAction, c: CuratedCard): Promise<boolean> => {
      if (a !== "remove") return cardAct(a, c);
      /* إزالةٌ من **القائمة** لا من المكتبة — `toggle-item` بـ`add:false`، وهو مسارُ صفحة العمل نفسُه */
      return run(
        (p) => ({ ...p, items: p.items.filter((x) => !(x.kind === c.kind && x.id === c.id)) }),
        () => write<{ done: true }>("/api/v1/lists/toggle-item", { listId: id, tmdbId: c.id, mediaType: c.kind, title: c.title, posterPath: c.poster_path, add: false } satisfies ListToggleItemBody),
      );
    },
    [cardAct, run, id],
  );
  const saveMeta = useCallback(
    (v: Omit<ListUpdateBody, "listId">) =>
      void run(
        (p) => ({ ...p, name: v.name, subtitle: v.subtitle ?? null, is_public: v.isPublic, kind: v.kind ?? p.kind }),
        () => write<{ done: true }>("/api/v1/lists/update", { listId: id, ...v } satisfies ListUpdateBody),
        () => {
          setSheet(null);
          /* الإعلانُ يفتح شريطَ الحال والآراء — وأعدادُها عند الخادم */
          void q.refetch();
        },
      ),
    [run, id, q],
  );
  const saveOrder = useCallback(
    (keys: string[]) =>
      void run(
        (p) => {
          const by = new Map(p.items.map((x) => [`${x.kind}-${x.id}`, x]));
          const next = keys.map((k) => by.get(k)).filter((x): x is ListDetailItem => !!x);
          return { ...p, items: next.length === p.items.length ? next : p.items };
        },
        () => write<{ done: true }>("/api/v1/lists/reorder", { listId: id, keys } satisfies ListReorderBody),
        () => setSheet(null),
      ),
    [run, id],
  );
  const saveCover = useCallback(
    (v: Omit<ListCoverBody, "listId">) =>
      void run(
        (p) => ({ ...p, cover: { tmdb_id: v.tmdbId, media_type: v.mediaType, backdrop_path: v.backdropPath } }),
        () => write<{ done: true }>("/api/v1/lists/cover", { listId: id, ...v } satisfies ListCoverBody),
        () => {
          setSheet(null);
          say(t.savedToast);
        },
      ),
    [run, id, say, t],
  );
  /* Phase 11-G (G4) — **إضافةُ عملٍ من المنتقي الأصليّ** (`ListDetail.addPicked` حرفاً): موجودٌ أصلاً ⇒ رسالةٌ بلا
     نداء؛ وإلّا صفٌّ تفاؤليٌّ في آخر القائمة ثمّ `toggle-item` بـ`add:true` — المسارُ الذي تكتب به صفحةُ العمل نفسُها،
     و`upsert` عنده يجعل التكرارَ بلا أثر. الورقةُ تبقى مفتوحةً لإضافةٍ ثانية (الويب يغلقها — لكنّ إضافةَ خمسة أعمالٍ
     بخمس فتحاتٍ ثمنٌ يُرى على الهاتف أكثر) — ⚖️ افتراقٌ محصورٌ يُسجَّل. */
  const addPicked = useCallback(
    (p: SearchTitle) => {
      const key = `${p.mediaType}-${p.id}`;
      if (q.data?.items.some((x) => keyOf(x) === key)) {
        say(t.listAlreadyIn);
        return;
      }
      haptic.success();
      void run(
        (prev) => ({ ...prev, items: [...prev.items, { kind: p.mediaType, id: p.id, title: p.title, poster_path: p.posterPath ?? null, badge: null }] }),
        () => write<{ done: true }>("/api/v1/lists/toggle-item", { listId: id, tmdbId: p.id, mediaType: p.mediaType, title: p.title, posterPath: p.posterPath ?? null, add: true } satisfies ListToggleItemBody),
        () => say(t.listAddedToast(p.title)),
      );
    },
    [q.data, run, id, say, t],
  );
  const removeList = useCallback(
    () =>
      void run(null, () => write<{ done: true }>("/api/v1/lists/delete", { listId: id } satisfies ListDeleteBody), () => {
        qc.removeQueries({ queryKey: qk.list(id) });
        back();
      }),
    [run, id, qc, back],
  );
  const setPlaylist = useCallback(
    (on: boolean) =>
      void run(
        (p) => ({ ...p, playlist: on }),
        () => write<{ on: boolean }>("/api/v1/lists/playlist", { listId: id, on } satisfies ListPlaylistBody),
        () => say(on ? t.listPlaylistOnToast : t.listPlaylistOffToast),
      ),
    [run, id, say, t],
  );

  /* ====== D-1038 — القلبُ والردُّ على رأي ====== */
  const likeReview = useCallback(
    (reviewUserId: string, liked: boolean) =>
      void run(
        (p) => ({ ...p, review_rows: p.review_rows.map((r) => (r.user_id === reviewUserId ? { ...r, liked_by_me: liked, likes: Math.max(0, r.likes + (liked ? 1 : -1)) } : r)) }),
        () => write<{ liked: boolean }>("/api/v1/lists/review-like", { listId: id, reviewUserId, liked } satisfies ListReviewLikeBody),
      ),
    [run, id],
  );
  const replyReview = useCallback(
    (reviewUserId: string, body: string, parentId: string | null) =>
      /* الردُّ **لا يُخمَّن**: اسمي وصورتي ومعرّفُ الردّ عند الخادم — يُجلب بعد الكتابة */
      run(null, () => write<{ reply_id: string | null }>("/api/v1/lists/review-reply", { listId: id, reviewUserId, body, parentId } satisfies ListReviewReplyBody), () => {
        say(t.replySentToast);
        void q.refetch();
      }),
    [run, id, say, t, q],
  );
  const deleteReply = useCallback(
    (replyId: string) =>
      void run(
        (p) => ({ ...p, reply_rows: p.reply_rows.filter((x) => x.reply_id !== replyId && x.parent_id !== replyId) }),
        () => write<{ done: true }>("/api/v1/lists/reply-delete", { listId: id, replyId } satisfies ListReplyDeleteBody),
        () => void q.refetch(),
      ),
    [run, id, q],
  );
  const queue: QueueItem[] = useMemo(() => (d?.items ?? []).map((x) => ({ key: `${x.kind}-${x.id}`, title: x.title, poster_path: x.poster_path, media_type: x.kind })), [d]);
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

  /* Phase 11-G (G6) — ورقةُ المشاركة أصليّة (`ShareListSheet`): كان ما سبق ورقةَ النظام للمعلنة وبابَ ويبٍ
     (`?share=1`) لقائمتي الخاصّة؛ الآن الورقةُ نفسُها للحالتين — والإعلانُ ثمّ الصديقُ والمجتمعُ والرابطُ فيها */
  const share = useCallback(() => {
    if (!d) return;
    setSheet("share");
  }, [d]);

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
              {/* D-1037 — مفتاحُ التشغيل: رقاقةٌ (عائلةُ التحكّم القائمة) — لقائمتي ولمحفوظتي وحدَهما */}
              {d.playlist !== null ? (
                <View style={{ flexDirection: "row", marginTop: 8 }}>
                  <Chip label={t.listPlaylist} active={d.playlist} onPress={() => setPlaylist(!d.playlist)} leading={<Icon name="play" size={13} color={d.playlist ? tokens.onAccent : tokens.muted} />} />
                </View>
              ) : null}
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
                <ListReviews rows={d.review_rows} replies={d.reply_rows} canAct={d.can_review || d.mine} busy={busy} onLike={likeReview} onReply={replyReview} onDeleteReply={deleteReply} />
              </View>
            ) : null}

            {d.mine ? (
              <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 24, gap: 10 }}>
                <Button label={t.listEditTitle} variant="ghost" onPress={() => setSheet("edit")} />
                {/* Phase 11-G (G4/G5) — إضافةُ عملٍ بالمنتقي الأصليّ؛ وشرطُ ذكيّةِ المكتبة بورقتها الأصليّة. **ذكيّةُ الكتالوج
                    وحدَها** تُعدَّل في «اكتشف» الويبيّة (شرطُها هو شريطُ الفلاتر نفسُه، D-145 — لا نموذجَ فلاترَ ثانياً هنا) */}
                {d.smart ? (
                  d.smart_source === "library" ? (
                    <Button label={t.smartListUpdate(d.name)} variant="ghost" onPress={() => setSheet("rule")} />
                  ) : (
                    <Button label={`${t.smartListLabel} ↗`} variant="ghost" onPress={() => openWeb(`/lists/${id}?from=app`)} />
                  )
                ) : (
                  <Button label={t.listAddTitles} variant="ghost" onPress={() => setSheet("add")} />
                )}
              </View>
            ) : null}
          </ScrollView>
        )}

        {sheet === "edit" && d ? <ListEditSheet list={d} busy={busy} onSave={saveMeta} onReorder={() => setSheet("reorder")} onCover={() => setSheet("cover")} onDelete={removeList} onClose={() => setSheet(null)} /> : null}
        {sheet === "reorder" && d ? <ReorderSheet items={queue} onClose={() => setSheet("edit")} onDone={saveOrder} /> : null}
        {sheet === "add" && d ? <TitlePickerSheet onPick={addPicked} onClose={() => setSheet(null)} /> : null}
        {sheet === "share" && d ? (
          <ShareListSheet
            listId={id}
            name={d.name}
            isPublic={d.is_public}
            mine={d.mine}
            onClose={() => setSheet(null)}
            onChanged={() => {
              patch((p) => ({ ...p, is_public: true }));
              void q.refetch();
              void qc.invalidateQueries({ queryKey: ["me:lists"] });
            }}
            onToast={say}
            onError={fail}
          />
        ) : null}
        {sheet === "rule" && d && d.smart_source === "library" ? (
          <SmartListSheet
            editing={{ id, name: d.name, rule: d.smart_rule ?? undefined }}
            onClose={() => setSheet(null)}
            onNeedsPlus={() => {
              setSheet(null);
              openWeb("/plus");
            }}
            onCreated={() => setSheet(null)}
            onUpdated={() => {
              setSheet(null);
              say(t.smartListUpdated);
              void q.refetch();
            }}
            onError={fail}
          />
        ) : null}
        {sheet === "cover" && d ? <ListCoverSheet list={d} busy={busy} onPick={saveCover} onClose={() => setSheet("edit")} /> : null}
        <HoldHost hostRef={holdHost} variant={d?.mine && !d.smart ? "mylist" : "list"} toItem={heldItemOf} inListOf={inListOf} onAction={act} onHeld={onHeld} />
        {reviewOpen && d ? <ListReviewSheet listId={id} listName={d.name} mine={d.my_review ? { rating: d.my_review.rating, body: d.my_review.body, has_spoiler: d.my_review.has_spoiler } : null} onClose={() => setReviewOpen(false)} onSaved={onReviewSaved} onError={fail} /> : null}
        <ToastHost hostRef={toastHost} bottom={insets.bottom + 16} />
      </View>
    </CardStoreContext.Provider>
  );
}
