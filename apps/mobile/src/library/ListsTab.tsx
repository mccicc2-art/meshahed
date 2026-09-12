import React, { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, Share, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { api, qk, queryClient, write, ApiError } from "../api";
import { CONFIG } from "../config";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { radius } from "../theme";
import { Icon } from "../icons";
import { Sheet } from "./Sheet";
import { ListCard, type ListCardData } from "./ListCard";
import { ListReviewSheet, type MyReview } from "./ListReviewSheet";
import { ReorderSheet } from "./ReorderSheet";
import { SmartListSheet } from "./SmartListSheet";
import { profileUrl, posterUrl } from "@/core/media";
import { railOff, railsHiddenFor } from "@/core/railPrefs";
import type { LibraryListsPayload, LibraryListCard, LibraryAutoGroup, ListPlaylistBody, SaveListBody, ToWatchBody, CreateListBody, QueueOrderBody } from "../contracts";

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
 * **ما بقي باباً في الويب**: إعلانُ قائمةٍ خاصّة للمشاركة (`/lists/:id`) وتحريرُ
 * شرطِ ذكيّةٍ قائمة (`?edit=`). **والمشاركةُ الأصليّةُ لقائمةٍ معلَنة** بورقة
 * النظام (`Share`) — الرابطُ نفسُه الذي يشاركه الويب.
 *
 * 📐 الشبكةُ `grid-cols-1 sm:grid-cols-2` بفاصل `gap-2.5` ١٠ — عمودٌ على
 * الجوّال واثنان من ٦٤٠ (D-461).
 */
const PAGE_PAD = 16;

export function ListsTab({ hiddenRails, onOpenWeb, say }: { hiddenRails: string[]; onOpenWeb: (path: string) => void; say: (msg: string) => void }) {
  const { t, tokens, locale } = useApp();
  const { width } = useWindowDimensions();
  const ar = locale !== "en";
  const data = useQuery({
    queryKey: qk.tag("me:lists"),
    queryFn: async () => (await api<LibraryListsPayload>("/api/v1/me/library/lists")).data,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [smart, setSmart] = useState(false);
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
        say(on ? t.listPlaylistOnToast : t.listPlaylistOffToast);
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
        say(on ? t.listPlaylistOnToast : t.listPlaylistOffToast);
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
        say(save ? t.listSavedToast : t.listUnsavedToast);
      } catch (e) {
        fail(e);
      } finally {
        setBusyId(null);
      }
    },
    [patch, say, fail, t],
  );
  /* المشاركة: قائمةٌ معلَنةٌ ⇢ ورقةُ النظام بالرابط نفسِه؛ خاصّةٌ ⇢ صفحتُها في
     الويب حيث ورقةُ الإعلان (`ShareListSheet`) — لا نسخةَ منها هنا. */
  const share = useCallback(
    async (l: LibraryListCard) => {
      if (!l.is_public) {
        onOpenWeb(`/lists/${l.id}`);
        return;
      }
      try {
        await Share.share({ message: `${l.name} — ${CONFIG.apiBase}/lists/${l.id}`, url: `${CONFIG.apiBase}/lists/${l.id}` });
      } catch {
        /* أُغلقت الورقة */
      }
    },
    [onOpenWeb],
  );

  const cols = width >= 640 ? 2 : 1;
  const cardW = cols === 1 ? "100%" : Math.floor((width - PAGE_PAD * 2 - 10) / 2);

  if (data.isLoading) return <Loading />;
  if (data.isError || !data.data)
    return <Empty text={t.apiInternal} cta={t.errorRetry} onCta={() => void data.refetch()} />;
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
    stats: { saves: l.saves, reviews: l.reviews, rating: l.rating },
    /* ولا مفتاحَ لقائمةٍ فارغة (شرطُ D-563 حرفاً) */
    playlist: l.playlist === null || l.item_count <= 0 ? null : l.playlist,
    canSave: l.can_save,
    savedByMe: l.saved_by_me,
    canReview: !!l.can_review,
    hasMyReview: !!l.my_review,
  });

  /* المفاتيحُ تصل كاملةً (`library:autogroups`) وتُقصر على تبويبها كما في الصفحة (`railsHiddenFor`) */
  const offRails = railsHiddenFor(new Set(hiddenRails), "library");
  const savedTitle = p.saved_count > 0 ? `${t.savedListsSection} · ${p.saved_count}` : t.savedListsSection;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 12, paddingBottom: 40, gap: 32 }} showsVerticalScrollIndicator={false}>
      <View>
        {/* زرّان لا حقلٌ دائم (D-443/D-877): «قائمة جديدة» ورقةٌ بحقلٍ واحد، و«قائمة ذكيّة» بابٌ في الويب */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <Pressable
            onPress={() => setCreating(true)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}
          >
            <Icon name="plus" size={14} color={tokens.fg} />
            <Text size={14} weight="700">{t.listNewGroup}</Text>
          </Pressable>
          <Pressable
            onPress={() => setSmart(true)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}
          >
            <Icon name="sparkle-star" size={14} color={tokens.fg} />
            <Text size={14} weight="700">{t.smartListLabel}</Text>
          </Pressable>
        </View>
        {!p.has_smart ? (
          <Text size={12} muted style={{ marginTop: -8, marginBottom: 16, lineHeight: 18 }}>{t.smartListHint}</Text>
        ) : null}

        {p.lists.length === 0 && !p.to_watch ? (
          <Text size={14} muted style={{ textAlign: "center", paddingVertical: 64 }}>{t.listsEmpty}</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {p.to_watch ? (
              <View style={{ width: cardW }}>
                <ListCard
                  card={{
                    id: "towatch",
                    name: t.libToWatch,
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
                />
              </View>
            ) : null}
            {p.lists.map((l) => (
              <View key={l.id} style={{ width: cardW }}>
                <ListCard
                  card={toCard(l)}
                  busy={busyId === l.id}
                  onPress={() => onOpenWeb(`/lists/${l.id}`)}
                  onPlaylist={(on) => void setPlaylist(l, on)}
                  onShare={() => void share(l)}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {!railOff(offRails, "autogroups") && p.auto_groups.length > 0 ? (
        <View>
          <Text size={20} weight="700" style={{ marginBottom: 4 }}>{t.autoGroupsTitle}</Text>
          <Text size={12} muted style={{ marginBottom: 12, lineHeight: 18 }}>
            {ar ? "أسماءٌ تتكرّر في مكتبتك — محسوبةٌ من أعمالك، لا ترشيحاً." : "Names that recur across your library — counted from your titles, not recommended."}
          </Text>
          <FlatList
            horizontal
            data={p.auto_groups}
            keyExtractor={(g) => `${g.kind}:${g.name}`}
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -PAGE_PAD }}
            contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 12 }}
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

      {!railOff(offRails, "savedlists") && p.saved.length > 0 ? (
        <View>
          <Text size={22} weight="700" style={{ marginBottom: 12 }}>{savedTitle}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {p.saved.map((l) => (
              <View key={l.id} style={{ width: cardW }}>
                <ListCard
                  card={toCard(l)}
                  busy={busyId === l.id}
                  onPress={() => onOpenWeb(`/lists/${l.id}`)}
                  onPlaylist={(on) => void setPlaylist(l, on)}
                  onSave={(save) => void setSaved(l, save)}
                  onRate={() => setRating(l)}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {creating ? (
        <NewListSheet
          onClose={() => setCreating(false)}
          onCreated={(id, name) => {
            setCreating(false);
            say(t.listMadeToast(name));
            void queryClient.invalidateQueries({ queryKey: qk.tag("me:lists") });
            if (id) onOpenWeb(`/lists/${id}`);
          }}
          onError={fail}
        />
      ) : null}
      {smart ? (
        <SmartListSheet
          onClose={() => setSmart(false)}
          onNeedsPlus={() => {
            setSmart(false);
            onOpenWeb("/plus");
          }}
          onCreated={(id) => {
            setSmart(false);
            say(t.librarySmartCreated);
            void queryClient.invalidateQueries({ queryKey: qk.tag("me:lists") });
            void queryClient.invalidateQueries({ queryKey: qk.tag("me:library") });
            if (id) onOpenWeb(`/lists/${id}`);
          }}
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
            say(next ? t.listReviewSave : t.listReviewDelete);
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
                const uri = posterUrl(x.poster, "w185");
                return (
                  <Pressable key={x.key} onPress={() => onOpenWeb(`/${x.media_type === "tv" ? "show" : "movie"}/${x.tmdb_id}`)} style={{ width: w }}>
                    <View style={{ width: w, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}>
                      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
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

/** ورقةُ «قائمة جديدة» — حقلُ الاسم وحدَه كما في `NewListForm` المطويّ (D-443)؛ Enter ينشئ */
function NewListSheet({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (id: string | null, name: string) => void; onError: (e: unknown) => void }) {
  const { t, tokens } = useApp();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    const clean = name.trim();
    if (!clean) {
      setErr(t.listNameRequired);
      return;
    }
    setBusy(true);
    try {
      const r = await write<{ id: string | null }>("/api/v1/lists/create", { name: clean } satisfies CreateListBody);
      onCreated(r.id, clean);
    } catch (e) {
      onError(e);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={t.listNewGroup} onClose={onClose}>
      <View>
        <TextInput
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (err) setErr(null);
          }}
          placeholder={t.listNamePlaceholder}
          placeholderTextColor={tokens.muted}
          autoFocus
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: radius.control, borderWidth: 1, borderColor: err ? tokens.error : tokens.border, backgroundColor: tokens.surface2, color: tokens.fg, fontSize: 15 }}
        />
        {err ? <Text size={12} color={tokens.error} style={{ marginTop: 6 }}>{err}</Text> : null}
      </View>
      <Button label={t.listCreate} busy={busy} onPress={() => void submit()} />
    </Sheet>
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

