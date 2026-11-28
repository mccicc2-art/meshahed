import React, { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewProps } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { api, qk, queryClient, write, ApiError } from "../api";
import { useApp } from "../state";
import { Button, Text, type ToastTone } from "../ui";
import { radius } from "../theme";
import { usePullRefresh } from "../pullRefresh";
import { Sheet } from "./Sheet";
import { ListCard, type ListCardData } from "./ListCard";
import { ListReviewSheet, type MyReview } from "./ListReviewSheet";
import { ReorderSheet } from "./ReorderSheet";
import { NewListBar } from "../newlist/NewListBar";
import { ShareListSheet } from "../list/ShareListSheet";
import { profileUrl } from "@/core/media";
import { posterFor } from "../poster";
import { railOff, railsHiddenFor } from "@/core/railPrefs";
import { OneTimeHint } from "./OneTimeHint";
import type { LibraryListsPayload, LibraryListCard, LibraryAutoGroup, ListPlaylistBody, SaveListBody, ToWatchBody, QueueOrderBody } from "../contracts";
import { scrollJank } from "../scrollJank";
import { railGrow, useRtlRailPin } from "../rtlRailPin";

/**
 * ====== تبويبُ «قوائم» أصليّاً — نسخةُ `ListManager` + `listsExtra` (D-947) ======
 *
 * 🔑 **التركيبةُ تركيبةُ الويب بترتيبها**: زرُّ «قائمة جديدة» وبابُ «قائمة ذكيّة»
 * (D-830/D-877) ⇢ سطرُ التعليم لمن لا ذكيّةَ له (D-570) ⇢ بطاقةُ «للمشاهدة»
 * أوّلاً (D-559) ⇢ قوائمي (D-364) ⇢ «تجتمع عندك» (D-820) ⇢ المحفوظة (D-374).
 * **والصفوفُ المخفيّة تغيب بعنوانها** (D-874) بالكوكي نفسِه الذي تقرؤه الصفحة.
 *
 * 🔑 **كلُّ أفعال التبويب أصليّة** — كتاباتٌ بسطرٍ عبر `/api/v1` فوق الأفعال
 * القائمة: رايةُ التشغيل · الحفظُ · رايةُ «للمشاهدة» · إنشاءُ قائمةٍ · 🆕 D-948
 * **رأيي في قائمةٍ** (`ListReviewSheet`) · **ترتيبُ طابور «للمشاهدة» بالسحب**
 * (`ReorderSheet`) · **قائمةٌ ذكيّةٌ بشروطها** (`SmartListSheet`) — ⚖️ نقضٌ
 * لحكم D-947 («الأشكالُ الثقيلة أبوابٌ في الويب») بأمر أحمد: «ابنِ الثلاثة».
 * D-952 — كان البابان الأخيران ويبيَّين مباشرين (`/lists/:id?share=1` و`/library?edit=<id>`).
 * 🆕 Phase 11-G (G5/G6) — **أُقفلا**: المشاركةُ ورقةٌ أصليّة (`ShareListSheet`: إعلانٌ · صديقٌ · مجتمعٌ · رابط) للمعلنة
 * والخاصّة معاً، وتحريرُ شرطِ ذكيّةِ المكتبة في `SmartListSheet` بوضع `editing`. **ذكيّةُ الكتالوج** وحدَها تُعدَّل في
 * اكتشف من صفحتها كما في الويب (شرطُها شريطُ الفلاتر، D-145).
 * 🆕 T450/T454 — **الإنشاءُ والتعديلُ صارا صفحةَ «قائمة جديدة»** (`newlist/NewListScreen`، `/list/new` و`?edit=`):
 * سقطت ورقتا الاسمِ وحده والشروط (`SmartListSheet` حُذف) ووضعُ «حدِّث» في «اكتشف».
 *
 * 📐 الشبكةُ `grid-cols-1 sm:grid-cols-2` بفاصل `gap-2.5` ١٠ — عمودٌ على
 * الجوّال واثنان من ٦٤٠ (D-461).
 */
const PAGE_PAD = 16;

export function ListsTab({ hiddenRails, onOpenWeb, say, topPad = 0, bottomPad = 40, onScroll, hint = false }: { hiddenRails: string[]; onOpenWeb: (path: string) => void; say: (msg: string, tone?: ToastTone) => void; topPad?: number; bottomPad?: number; onScroll?: ScrollViewProps["onScroll"]; /** D-1318 (T2) — تلميحُ «قوائمك هنا» لمرّةٍ واحدة، بدوره (`useHintTurn` في المكتبة) */ hint?: boolean }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const ar = locale !== "en";
  const refreshControl = usePullRefresh([qk.tag("me:lists")], topPad);
  const data = useQuery({
    queryKey: qk.tag("me:lists"),
    queryFn: async () => (await api<LibraryListsPayload>("/api/v1/me/library/lists")).data,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);
  const [rating, setRating] = useState<LibraryListCard | null>(null);
  const [group, setGroup] = useState<LibraryAutoGroup | null>(null);

  const fail = useCallback(
    (e: unknown) => {
      void queryClient.invalidateQueries({ queryKey: qk.tag("me:lists") });
      const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[key];
      say(typeof msg === "string" ? msg : t.apiInternal);
    },
    [say, t],
  );
  /** تعديلُ الكاش تفاؤليّاً ثمّ الكتابة — وعند الخطأ يُعاد الجلبُ وتُقال الرسالة */
  const patch = useCallback((fn: (p: LibraryListsPayload) => LibraryListsPayload) => {
    queryClient.setQueryData<LibraryListsPayload>(qk.tag("me:lists"), (prev) => (prev ? fn(prev) : prev));
  }, []);

  const setPlaylist = useCallback(
    async (l: LibraryListCard, on: boolean) => {
      setBusyId(l.id);
      const flip = (x: LibraryListCard) => (x.id === l.id ? { ...x, playlist: on } : x);
      patch((p) => ({ ...p, lists: p.lists.map(flip), saved: p.saved.map(flip) }));
      try {
        await write<{ on: boolean }>("/api/v1/lists/playlist", { listId: l.id, on } satisfies ListPlaylistBody);
        if (on) say(t.listPlaylistOnToast, "success");
        else say(t.listPlaylistOffToast, "info");
      } catch (e) {
        fail(e);
      } finally {
        setBusyId(null);
      }
    },
    [patch, say, fail, t],
  );
  const setToWatch = useCallback(
    async (on: boolean) => {
      setBusyId("towatch");
      patch((p) => (p.to_watch ? { ...p, to_watch: { ...p.to_watch, on } } : p));
      try {
        await write<{ on: boolean }>("/api/v1/me/prefs/to-watch", { on } satisfies ToWatchBody);
        if (on) say(t.listPlaylistOnToast, "success");
        else say(t.listPlaylistOffToast, "info");
      } catch (e) {
        fail(e);
      } finally {
        setBusyId(null);
      }
    },
    [patch, say, fail, t],
  );
  const setSaved = useCallback(
    async (l: LibraryListCard, save: boolean) => {
      setBusyId(l.id);
      patch((p) => ({
        ...p,
        saved: p.saved.map((x) => (x.id === l.id ? { ...x, saved_by_me: save, saves: Math.max(0, x.saves + (save ? 1 : -1)) } : x)),
      }));
      try {
        await write<{ saved: boolean }>("/api/v1/lists/save", { listId: l.id, save } satisfies SaveListBody);
        if (save) say(t.listSavedToast, "success");
        else say(t.listUnsavedToast, "info");
      } catch (e) {
        fail(e);
      } finally {
        setBusyId(null);
      }
    },
    [patch, say, fail, t],
  );
  /* Phase 11-G (G6) — المشاركةُ ورقةٌ أصليّة (`ShareListSheet`) للمعلنة والخاصّة معاً: كانت المعلنةُ ورقةَ النظام
     والخاصّةُ باباً ويبيّاً (`?share=1`، D-952) — الآن الإعلانُ والصديقُ والمجتمعُ والرابطُ في ورقةٍ واحدة كالويب */
  const [sharing, setSharing] = useState<LibraryListCard | null>(null);
  const share = useCallback((l: LibraryListCard) => setSharing(l), []);

  /* D-1492 — صفُّ «أسماءٌ تتكرّر» افتراضيٌّ أفقيّ: العلاجُ المشترك على الآيفون بالعربيّ (D-1478)، وسحبُه يمرّ بقياس الاهتزاز كما كان */
  const { props: groupsPin } = useRtlRailPin<LibraryAutoGroup>(scrollJank("library", "h").onScrollBeginDrag, scrollJank("library", "h").onMomentumScrollBegin);

  const cols = width >= 640 ? 2 : 1;
  const cardW = cols === 1 ? "100%" : Math.floor((width - PAGE_PAD * 2 - 10) / 2);

  if (data.isLoading) return <View style={{ paddingTop: topPad }}><Loading /></View>;
  if (data.isError || !data.data)
    return <View style={{ paddingTop: topPad }}><Empty text={t.apiInternal} cta={t.errorRetry} onCta={() => void data.refetch()} /></View>;
  const p = data.data;

  const toCard = (l: LibraryListCard): ListCardData => ({
    id: l.id,
    name: l.name,
    icon: l.kind === "smart" ? "sparkle-star" : undefined,
    owner: l.owner,
    owner_avatar: l.owner_avatar,
    countText: l.count_label ?? t.listCount(l.item_count),
    posters: l.posters,
    cover: l.cover,
    stats: { saves: l.saves, likes: l.likes ?? 0, reviews: l.reviews, rating: l.rating },
    /* ولا مفتاحَ لقائمةٍ فارغة (شرطُ D-563 حرفاً) */
    playlist: l.playlist === null || l.item_count <= 0 ? null : l.playlist,
    canSave: l.can_save,
    savedByMe: l.saved_by_me,
    likedByMe: l.liked_by_me,
    canReview: !!l.can_review,
    hasMyReview: !!l.my_review,
  });

  /* المفاتيحُ تصل كاملةً (`library:autogroups`) وتُقصر على تبويبها كما في الصفحة (`railsHiddenFor`) */
  const offRails = railsHiddenFor(new Set(hiddenRails), "library");
  const savedShown = railOff(offRails, "savedlists") ? [] : p.saved;

  return (
    <ScrollView refreshControl={refreshControl} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: topPad + 12, paddingBottom: bottomPad, gap: 32 }} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16} {...scrollJank("library", "v", "lists")}>
      {/* فوق الزرّين: أوّلُ ما يُرى عند فتح التبويب — وقوائمُ الآخرين ليست هنا فيقول أين هي */}
      {hint ? <OneTimeHint id="lists-tab" text={t.hintListsTab} style={{ marginBottom: -16 }} /> : null}
      <View>
        {/* 🆕 T450 — **الإطارُ نفسُه (D-1018/D-1212) صار `NewListBar`** ويدفع صفحةَ «قائمة جديدة» مقيّدةً بمكتبتك بدل ورقتَي
            «اسمٍ وحده» والشروط — والإطارُ ذاتُه في «اكتشف ← القوائم» من الكتالوج كلِّه */}
        {/* T608 (q55 — أحمد: «احذف هذي العبارة لأنها موجودة إذا ضغطت قائمة ذكية») — سقط سطرُ الشرح تحت الزرّ */}
        <NewListBar from="library" style={{ marginBottom: 16 }} />

        {p.lists.length === 0 && !p.to_watch && !savedShown.length ? (
          <Text size={14} muted style={{ textAlign: "center", paddingVertical: 64 }}>{t.listsEmpty}</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {p.to_watch ? (
              <View style={{ width: cardW }}>
                <ListCard
                  card={{
                    id: "towatch",
                    name: t.movieQueue,
                    icon: "bookmark",
                    owner: null,
                    owner_avatar: null,
                    countText: `${t.listCount(p.to_watch.count)} · ${t.toWatchAutoNote}`,
                    posters: p.to_watch.posters.filter((x): x is string => !!x),
                    cover: null,
                    stats: null,
                    playlist: p.to_watch.on,
                    dashed: !p.to_watch.on,
                  }}
                  busy={busyId === "towatch"}
                  onPlaylist={(on) => void setToWatch(on)}
                  onPress={() => setReorder(true)}
                  three={cols === 1}
                />
              </View>
            ) : null}
            {p.lists.map((l) => (
              <View key={l.id} style={{ width: cardW }}>
                <ListCard
                  card={toCard(l)}
                  three={cols === 1}
                  busy={busyId === l.id}
                  onError={fail}
                  onPress={() => onOpenWeb(`/lists/${l.id}`)}
                  onPlaylist={(on) => void setPlaylist(l, on)}
                  onShare={() => share(l)}
                  onEdit={
                    l.smart_source
                      ? {
                          label: t.smartListUpdate(l.name),
                          /* 🆕 T454 — صفحةُ «قائمة جديدة» على شرطها — للمكتبة والكتالوج معاً */
                          onPress: () => router.push({ pathname: "/list/new", params: { edit: l.id, from: l.smart_source === "library" ? "library" : "discover" } }),
                        }
                      : undefined
                  }
                />
              </View>
            ))}
            {/* 🆕 T619 (س٦٠ — أحمد: «احذف كلمة قوائم محفوظة… خلّها ورا بعض عادي بدون مسافة كبيرة») — المحفوظةُ تلي قوائمك في الشبكة نفسِها
                بلا عنوانٍ ولا فاصلٍ كبير: إشارةُ الحفظ الصفراء والصاحبُ في كلِّ بطاقةٍ يقولان إنّها لغيرك */}
            {savedShown.map((l) => (
              <View key={l.id} style={{ width: cardW }}>
                <ListCard
                  card={toCard(l)}
                  three={cols === 1}
                  busy={busyId === l.id}
                  onError={fail}
                  onPress={() => onOpenWeb(`/lists/${l.id}`)}
                  onPlaylist={(on) => void setPlaylist(l, on)}
                  onSave={(save) => setSaved(l, save)}
                  onRate={() => setRating(l)}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 🆕 T606 (q44 «أ» — أحمد ٢٧ نوفمبر: «صور الفنانين نزّلها آخر القوائم لا تكون كذا في النصّ») — «تجتمع عندك» آخرَ التبويب
          بعد قوائمك والمحفوظة: أسماءٌ محسوبةٌ لا قوائمُ صنعتها أو حفظتها، فلا تقطع ما بينهما */}
      {!railOff(offRails, "autogroups") && p.auto_groups.length > 0 ? (
        <View>
          <Text size={20} weight="700" style={{ marginBottom: 4 }}>{t.autoGroupsTitle}</Text>
          <Text size={12} muted style={{ marginBottom: 12, lineHeight: 18 }}>
            {ar ? "أسماءٌ تتكرّر في مكتبتك — محسوبةٌ من أعمالك، لا ترشيحاً." : "Names that recur across your library — counted from your titles, not recommended."}
          </Text>
          <FlatList
            horizontal
            {...scrollJank("library", "h")}
            {...groupsPin}
            data={p.auto_groups}
            keyExtractor={(g) => `${g.kind}:${g.name}`}
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -PAGE_PAD }}
            contentContainerStyle={railGrow({ paddingHorizontal: PAGE_PAD, gap: 12 })}
            renderItem={({ item: g }) => (
              <Pressable onPress={() => (p.plus ? setGroup(g) : onOpenWeb("/plus"))} style={{ width: 92, alignItems: "center" }}>
                <View style={{ width: 92, height: 92, borderRadius: 46, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
                  {g.photo ? (
                    <Image source={{ uri: profileUrl(g.photo) ?? "" }} style={{ width: 92, height: 92 }} contentFit="cover" />
                  ) : (
                    <Text size={24} weight="700" muted>{g.name.slice(0, 1)}</Text>
                  )}
                </View>
                <Text size={12} weight="700" numberOfLines={2} style={{ marginTop: 6, textAlign: "center", lineHeight: 15 }}>{g.name}</Text>
                <Text size={12} muted style={{ marginTop: 2 }}>
                  {ar ? `${g.kind === "director" ? "أخرج" : "ظهر في"} ${g.items.length}` : `${g.kind === "director" ? "directed" : "in"} ${g.items.length}`}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {sharing ? (
        <ShareListSheet
          listId={sharing.id}
          name={sharing.name}
          isPublic={sharing.is_public}
          mine={sharing.mine}
          onClose={() => setSharing(null)}
          onChanged={() => {
            setSharing(null);
            void queryClient.invalidateQueries({ queryKey: qk.tag("me:lists") });
          }}
          onToast={(s) => say(s, "success")}
          onError={fail}
        />
      ) : null}
      {reorder && p.to_watch ? (
        <ReorderSheet
          items={p.to_watch.items}
          onClose={() => setReorder(false)}
          onDone={(keys) => {
            setReorder(false);
            /* تفاؤلٌ: ملصقاتُ البطاقة الثلاثة من رأس الترتيب الجديد */
            patch((prev) => {
              if (!prev.to_watch) return prev;
              const byKey = new Map(prev.to_watch.items.map((x) => [x.key, x]));
              const items = keys.map((k) => byKey.get(k)).filter((x): x is NonNullable<typeof x> => !!x);
              return { ...prev, to_watch: { ...prev.to_watch, items, posters: items.slice(0, 3).map((x) => x.poster_path) } };
            });
            write<{ done: true }>("/api/v1/me/prefs/queue-order", { row: "towatchlist", keys } satisfies QueueOrderBody).catch(fail);
          }}
        />
      ) : null}
      {rating ? (
        <ListReviewSheet
          listId={rating.id}
          listName={rating.name}
          mine={rating.my_review ?? null}
          onClose={() => setRating(null)}
          onSaved={(next: MyReview | null) => {
            const id = rating.id;
            setRating(null);
            if (next) say(t.listReviewSave, "success");
            else say(t.listReviewDelete, "info");
            /* تفاؤلٌ على رأيي وحدَه؛ المتوسّطُ والعدُّ يأتيان مع إعادة الجلب */
            patch((prev) => ({ ...prev, saved: prev.saved.map((x) => (x.id === id ? { ...x, my_review: next } : x)) }));
            void queryClient.invalidateQueries({ queryKey: qk.tag("me:lists") });
          }}
          onError={fail}
        />
      ) : null}
      {group ? (
        <Sheet title={group.name} onClose={() => setGroup(null)}>
          <Text size={12} muted style={{ marginTop: -14 }}>
            {ar ? `${group.items.length} من أعمالك` : `${group.items.length} of your titles`}
          </Text>
          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {group.items.map((x) => {
                const w = Math.floor((width - 32 - 24) / 3);
                const uri = posterFor(x.poster, w);
                return (
                  <Pressable key={x.key} onPress={() => onOpenWeb(`/${x.media_type === "tv" ? "show" : "movie"}/${x.tmdb_id}`)} style={{ width: w }}>
                    <View style={{ width: w, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}>
                      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
                    </View>
                    <Text size={12} weight="600" numberOfLines={2} style={{ marginTop: 6, lineHeight: 15 }}>{x.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Sheet>
      ) : null}
    </ScrollView>
  );
}

function Loading() {
  const { tokens } = useApp();
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 12, gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 168, borderRadius: radius.card, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, opacity: 0.7 }} />
      ))}
    </View>
  );
}

function Empty({ text, cta, onCta }: { text: string; cta: string; onCta: () => void }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 64, paddingHorizontal: PAGE_PAD, gap: 16 }}>
      <Text muted style={{ textAlign: "center" }}>{text}</Text>
      <Button label={cta} onPress={onCta} />
    </View>
  );
}

