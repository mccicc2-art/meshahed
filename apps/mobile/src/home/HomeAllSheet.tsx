import React, { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { write } from "../api";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { haptic } from "../haptics";
import { HOME_KEY } from "./useHome";
import { towatchQueueOf } from "./queueOrder";
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useApp } from "../state";
import { BackChevron, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { ReorderBody } from "../library/ReorderSheet";
import { PosterCard, type CardItem } from "../library/PosterCard";
import { ListCard } from "../library/ListCard";
import { MediaRow } from "./Cards";
import { FriendBadge, FriendsNames, FriendsWhoLine, WHO_H, whoOf } from "./Friends";
import type { HomeExtrasPayload, HomeFriendCard, HomePayload, HomeQueueItem, QueueOrderBody, ToggleMovieBody, TrackResult } from "../contracts";

/**
 * ====== 🆕 D-1353 — ورقةُ «الكلّ» الواحدةُ لأقسام الرئيسيّة ======
 *
 * بلاغُ أحمد بتسجيل ١١ أكتوبر: «يبيلنا نحدّد آليّة تعمَّم على جميع أقسام الرئيسيّة» — كانت «الكلّ» تفتح ورقةَ الترتيب
 * في ثلاثة أقسام، وورقةَ أعمالٍ في قسمين، وتبويبَ المجتمع في قسم، والعنوانُ يذهب إلى المكتبة. حكمُه بعد أربع جولات صور:
 * - **«الكلّ» ورقةٌ من الأسفل بمحتوى القسم نفسِه، في كلِّ قسم** — لا صفحةٌ كاملة («ليش ما تكون تنفكّ من تحت؟») ولا
 *   تبويبٌ آخر. وارتفاعُها **صفّان من الأعمال** والباقي بالتمرير («ماخذه حجم كبير، خلّ يبان صفّين»).
 * - **العنوانُ يفعل ما تفعله «الكلّ».**
 * - **الترتيبُ زرٌّ داخل الورقة**، والورقةُ نفسُها تتحوّل إلى وضع السحب ثمّ تعود — لا ورقةَ فوق ورقة.
 * - **أسماءُ الأصدقاء كذلك**: الضغطُ على سطر «مَن» يبدّل محتوى الورقة إلى الأسماء بسهم رجوع.
 *
 * ⚖️ **ينقض بحكم صاحبها**: D-605/D-624/D-863 («الكلّ» في الصفوف الثلاثة هي زرُّ الترتيب) و D-378 (العنوانُ بابُ
 * المكتبة). **ويُبقي D-868** («الكلّ يفتحها منبثقةً هنا») و D-733 (لا سقفَ هنا: القائمةُ ممرَّرة لا مرسومةٌ في الخادم).
 * ⚖️ **الويبُ على حاله حتى دفعته** — قرارُه «التطبيق والويب»، والدفعتان منفصلتان لتُجرَّب كلٌّ وحدَها.
 *
 * 🔑 **ورقةٌ واحدةٌ من مكوّن `Sheet` نفسِه** (القاعدة: ورقةٌ واحدة). لا ضغطَ مطوّلاً على ملصقاتها — كما كانت ورقةُ
 * «مسلسلاتي/أفلامي» قبلها؛ الأفعالُ في الصفّ نفسِه وفي صفحة العمل.
 */
export type AllSection = "continue" | "towatch" | "upcoming" | "shows" | "movies" | "lists" | "friends" | "queue";

const GAP = 12;
/** حشوةُ جسد `Sheet` الأفقيّة */
const SHEET_PAD = 16;
/** ما يطلّ من الصفّ الثالث ليدلّ على أنّ تحته مزيداً */
const PEEK = 28;

const REORDER_ROW: Partial<Record<AllSection, QueueOrderBody["row"]>> = { continue: "continue", towatch: "towatch", lists: "lists", queue: "towatchlist" };

/** `tw-mv-<id>` — مفتاحُ الفيلم في طابور الأفلام (D-719) */
const queueIdOf = (key: string) => Number(/^tw-mv-(\d+)$/.exec(key)?.[1] ?? 0);

export function HomeAllSheet({
  section,
  d,
  extras,
  asItem,
  queueItemsOf,
  toWatchBusy,
  onClose,
  onTitle,
  onList,
  onProfile,
  onReorder,
  onToWatchToggle,
  onToWatchList,
  onQueue,
}: {
  section: AllSection;
  d: HomePayload;
  extras: HomeExtrasPayload | null;
  /** بنّاءُ البطاقة الواحدُ في الرئيسيّة — الحالاتُ («لم يبدأ» · «موقوف») تُحسب في مكانٍ واحد */
  asItem: (c: { key: string; kind: "tv" | "movie"; id: number; title: string; poster_path: string | null; progress?: number | null; count?: number | null; watched?: boolean; known?: boolean }) => CardItem;
  queueItemsOf: (items: HomeQueueItem[]) => { key: string; title: string; poster_path: string | null; media_type: "tv" | "movie" }[];
  toWatchBusy: boolean;
  onClose: () => void;
  onTitle: (kind: "tv" | "movie", id: number) => void;
  onList: (id: string) => void;
  onProfile: (username: string) => void;
  onReorder: (row: QueueOrderBody["row"], keys: string[]) => void;
  onToWatchToggle: (on: boolean) => void;
  /** بطاقةُ «للمشاهدة» في القوائم: بابُ ترتيب طابورها — ورقةٌ أخرى، فتُغلق هذه أوّلاً */
  onToWatchList: () => void;
  /** 🆕 D-1507 — بطاقةُ «طابور الأفلام» في ورقة «تابِع المشاهدة» تفتح ورقةَ الطابور كما في الصفّ */
  onQueue: () => void;
}) {
  const { t, tokens } = useApp();
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<"grid" | "reorder">("grid");
  const [who, setWho] = useState<HomeFriendCard | null>(null);
  const s = d.sections;
  const qc = useQueryClient();
  /* 🆕 D-1507 — أفلامُ الطابور التي أُشّرت للتوّ: تغيب فوراً ويعيدها «تراجع» أو الفشل */
  const [gone, setGone] = useState<Set<number>>(() => new Set());
  const toast = useRef<ToastHostRef>(null);
  const setGoneOne = (id: number, on: boolean) =>
    setGone((g) => {
      const n = new Set(g);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  /* ✓ في الورقة = ✓ بطاقة الطابور في «تابِع المشاهدة» (`markListNext` لفيلم): الكتابةُ نفسُها والرجعةُ نفسُها */
  const watchQueued = async (id: number, title: string) => {
    haptic.success();
    setGoneOne(id, true);
    const movie = (watched: boolean) => write<TrackResult>("/api/v1/track/movie", { movieTmdbId: id, runtime: null, watched } satisfies ToggleMovieBody);
    try {
      await movie(true);
      void qc.invalidateQueries({ queryKey: HOME_KEY });
      toast.current?.say(`${title} ✓`, {
        label: t.undoWatched,
        onPress: () => {
          setGoneOne(id, false);
          void movie(false).then(() => qc.invalidateQueries({ queryKey: HOME_KEY })).catch(() => setGoneOne(id, true));
        },
      }, 4000, "success");
    } catch {
      setGoneOne(id, false);
      toast.current?.say(t.errSaveShort);
    }
  };
  /* 🔴 D-1354 — **عرضُ الشبكة يُقاس ولا يُفترض** (تسجيلُ أحمد ١١ أكتوبر: «العرض فيه فلمين، ابغاه ثلاثة ما يكون فيه
     مكان فاضي»). كان يُحسب من عرض الشاشة ناقصَ حشوة الورقة — وللورقة إطارٌ بكسلٌ من كلِّ جهة، فزاد مجموعُ ثلاثة
     ملصقاتٍ على المتاح ببكسلٍ واحد (٣٧٨ من ٣٧٧ على شاشته) ونزل الثالثُ إلى السطر التالي. التقديرُ الأوّلُ يطرح
     الإطار، والقياسُ (`onLayout`) يصحّحه إن اختلف. */
  const [boxW, setBoxW] = useState(width - SHEET_PAD * 2 - 2);
  const cell = Math.floor((boxW - GAP * 2) / 3);
  const posterH = Math.round(cell * 1.5);
  /* صفّان وإطلالةُ الثالث — وعلى شاشةٍ قصيرةٍ لا تتجاوز الورقةُ ثلثَي الارتفاع */
  const rowH = posterH + (section === "friends" ? WHO_H : 0);
  const bodyMax = Math.min(rowH * 2 + GAP + PEEK, Math.round(height * 0.62));

  const title =
    section === "queue" ? t.movieQueue
    : section === "continue" ? t.continueWatching
    : section === "towatch" ? t.libToWatch
    : section === "upcoming" ? t.libUpcoming
    : section === "shows" ? t.myShows
    : section === "movies" ? t.myMovies
    : section === "lists" ? t.listsTitle
    : t.railFriendsNow;

  const go = (kind: "tv" | "movie", id: number) => {
    onClose();
    onTitle(kind, id);
  };
  const press = (it: CardItem) => go(it.kind, it.id);

  /** شبكةُ ملصقات: كلُّ قسمٍ يعطي بطاقاتِه وما تفعله ضغطتُها */
  const posters: { item: CardItem; onPress: (it: CardItem) => void; friend?: HomeFriendCard; queued?: { id: number; rank: number } }[] | null = useMemo(() => {
    /* 🆕 D-1507 — **طابورُ الأفلام بترتيبه** (أحمد ٢١ أكتوبر: «يفك صفحة من تحت مثل اذا ضغط all… ويقدر يرتب ايش الاول ويقدر
       يضغط شاهدت»): رقمُ كلِّ فيلمٍ في الطابور، و✓ يخرجه، و«إعادة ترتيب» تحوّل الورقةَ نفسَها إلى السحب */
    if (section === "queue")
      return d.queues.towatch_list
        .map((q) => ({ q, id: queueIdOf(q.key) }))
        .filter((x) => x.id > 0 && !gone.has(x.id))
        .map(({ q, id }, i) => ({ item: { ...asItem({ key: q.key, kind: "movie", id, title: q.title ?? "", poster_path: q.poster_path, known: true }), noNext: true }, onPress: press, queued: { id, rank: i + 1 } }));
    if (section === "continue")
      return s.continue.map((c) =>
        c.type === "show"
          ? { item: asItem({ key: c.key, kind: "tv", id: c.id, title: c.title, poster_path: c.poster_path, progress: c.progress, known: true }), onPress: press }
          : {
              /* بطاقةُ قائمة: ملصقُ «التالي» فيها واسمُ القائمة — وضغطتُها ضغطةُ بطاقتها في الصفّ */
              item: asItem({ key: c.key, kind: c.next.kind, id: c.next.id, title: c.list_name, poster_path: c.next.poster_path }),
              onPress: () => {
                onClose();
                if (c.type === "towatch") onQueue();
                else onList(c.list_id);
              },
            },
      );
    if (section === "towatch") return s.towatch.all.map((x) => ({ item: { ...asItem({ key: x.key, kind: x.kind, id: x.id, title: x.title, poster_path: x.poster_path, progress: x.progress, known: true }), noNext: true }, onPress: press }));
    if (section === "shows") return s.shows.items.map((i) => ({ item: asItem({ key: `as-${i.id}`, kind: "tv", id: i.id, title: i.title, poster_path: i.poster_path, progress: i.progress, count: i.count, watched: i.badge_tone === "watched", known: true }), onPress: press }));
    if (section === "movies") return s.movies.items.map((m) => ({ item: asItem({ key: `am-${m.id}`, kind: "movie", id: m.id, title: m.title, poster_path: m.poster_path, progress: m.progress, known: true }), onPress: press }));
    if (section === "friends") return s.friends.map((r) => ({ item: asItem({ key: `af-${r.kind}-${r.id}`, kind: r.kind, id: r.id, title: r.title, poster_path: r.poster_path, watched: r.watched }), onPress: press, friend: r }));
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, s, asItem, d.queues.towatch_list, gone]);

  const count =
    posters ? posters.length
    : section === "upcoming" ? s.upcoming.length
    : s.lists.cards.length + (s.lists.towatch_card ? 1 : 0);
  const row = REORDER_ROW[section];
  const queue = row === "continue" ? d.queues.continue : row === "towatch" ? towatchQueueOf(d) : row === "lists" ? d.queues.lists : row === "towatchlist" ? d.queues.towatch_list.filter((q) => !gone.has(queueIdOf(q.key))) : [];
  const canReorder = !!row && queue.length > 1;

  /* ——— وضعُ الأسماء: الورقةُ نفسُها، رأسُها اسمُ العمل وسهمُ رجوع ——— */
  if (who) {
    const w = whoOf(who);
    return (
      <Sheet
        title={who.title}
        onClose={onClose}
        header={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable onPress={() => setWho(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.backAria} style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
              {/* سهمُ الرجوع الواحد (D-1460) — لا رسمَ باليد: كان «^» في العربيّة (D-1592) */}
              <BackChevron color={tokens.fg} />
            </Pressable>
            <Text size={15} weight="700" numberOfLines={1} style={{ flex: 1 }}>{who.title}</Text>
          </View>
        }
      >
        <ScrollView style={{ maxHeight: bodyMax }} showsVerticalScrollIndicator={false}>
          <FriendsNames people={w.people} others={w.others} onProfile={(u) => { onClose(); onProfile(u); }} />
        </ScrollView>
      </Sheet>
    );
  }

  return (
    <Sheet title={title} onClose={onClose}>
      {mode === "reorder" && row ? (
        <ReorderBody
          items={queueItemsOf(queue)}
          maxHeight={bodyMax}
          onDone={(keys) => {
            onReorder(row, keys);
            setMode("grid");
          }}
        />
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: -14, minHeight: 36 }}>
            <Text size={13} muted>{section === "queue" ? t.leftEps(count) : t.listCount(count)}</Text>
            {canReorder ? (
              <Pressable onPress={() => setMode("reorder")} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, opacity: pressed ? 0.7 : 1 })}>
                <Icon name="grip" size={16} color={tokens.accent} />
                <Text size={13} weight="600">{t.listReorder}</Text>
              </Pressable>
            ) : null}
          </View>
          {posters ? (
            /* 🆕 D-1596 — **شبكةٌ افتراضيّة** (أحمد ٣٠ أكتوبر: «لو شخص حاط ٥٠٠ فلم بيضطر يجهّزها»): كانت الورقةُ ترسم كلَّ ملصقٍ
               دفعةً واحدة داخل `ScrollView` — ٥٠٠ عملٍ = ٥٠٠ صورةٍ تُبنى قبل أن تظهر الورقة. `FlatList` بثلاثة أعمدة يرسم ما يُرى
               وما حوله فقط، والباقي حين يقترب التمرير؛ الشكلُ والقياسُ (`onLayout` · D-1354) هما هما */
            <FlatList
              data={posters}
              keyExtractor={(p) => p.item.key}
              numColumns={3}
              style={{ maxHeight: bodyMax }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
              columnWrapperStyle={{ gap: GAP }}
              ItemSeparatorComponent={RowGap}
              initialNumToRender={9}
              maxToRenderPerBatch={9}
              windowSize={5}
              removeClippedSubviews
              onLayout={(e) => {
                const w = Math.floor(e.nativeEvent.layout.width);
                if (w > 0 && w !== boxW) setBoxW(w);
              }}
              renderItem={({ item: p }) => (
                <View style={{ width: cell }}>
                  <View>
                    <PosterCard item={p.item} width={cell} onPress={p.onPress} marquee={false} />
                    {p.friend ? <FriendBadge card={p.friend} /> : null}
                    {p.queued ? <QueueMarks rank={p.queued.rank} onCheck={() => void watchQueued(p.queued!.id, p.item.title)} /> : null}
                  </View>
                  {p.friend ? <FriendsWhoLine card={p.friend} onProfile={(u) => { onClose(); onProfile(u); }} onNames={setWho} /> : null}
                </View>
              )}
            />
          ) : (
          <ScrollView
            style={{ maxHeight: bodyMax }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
            onLayout={(e) => {
              const w = Math.floor(e.nativeEvent.layout.width);
              if (w > 0 && w !== boxW) setBoxW(w);
            }}
          >
            {section === "upcoming" ? (
              <View style={{ gap: 8 }}>
                {s.upcoming.map((x) => {
                  const ep = extras?.upcoming_eps[x.key] ?? x.ep;
                  return <MediaRow key={x.key} title={[x.badge, ep].filter(Boolean).join(" · ")} subtitle={x.title} posterPath={x.poster_path} onPress={() => go(x.kind, x.id)} />;
                })}
              </View>
            ) : (
              <View style={{ gap: GAP }}>
                {s.lists.cards.map((c, i) => (
                  <React.Fragment key={c.id}>
                    {s.lists.towatch_card && s.lists.towatch_at === i ? <ToWatchCard card={s.lists.towatch_card} busy={toWatchBusy} onToggle={onToWatchToggle} onPress={onToWatchList} /> : null}
                    <ListCard
                      card={{
                        id: c.id,
                        name: c.name,
                        icon: c.kind === "smart" || c.kind === "curated" ? "sparkle-star" : undefined,
                        owner: c.mine ? null : c.owner,
                        owner_avatar: c.owner_avatar,
                        countText: c.count_label ?? t.listCount(c.item_count),
                        posters: c.posters,
                        cover: c.cover,
                        stats: c.saves || c.reviews || c.rating ? { saves: c.saves, reviews: c.reviews, rating: c.rating } : null,
                        playlist: c.playlist,
                        canSave: c.can_save,
                        savedByMe: c.saved_by_me,
                        canReview: !!c.can_review,
                        hasMyReview: !!c.my_review,
                      }}
                      onPress={() => {
                        onClose();
                        onList(c.id);
                      }}
                    />
                  </React.Fragment>
                ))}
                {s.lists.towatch_card && (s.lists.towatch_at < 0 || s.lists.towatch_at >= s.lists.cards.length) ? <ToWatchCard card={s.lists.towatch_card} busy={toWatchBusy} onToggle={onToWatchToggle} onPress={onToWatchList} /> : null}
              </View>
            )}
          </ScrollView>
          )}
          {/* إشعارُ «تراجع» داخل الورقة: هي نافذةٌ فوق الرئيسيّة، وإشعارُ الرئيسيّة تحتها لا يُرى */}
          {section === "queue" ? <View pointerEvents="box-none" style={{ height: 0 }}><ToastHost hostRef={toast} bottom={-64} /></View> : null}
        </>
      )}
    </Sheet>
  );
}

/** فاصلُ صفوف الشبكة الافتراضيّة — الفجوةُ نفسُها بين الأعمدة (`GAP`) */
function RowGap() {
  return <View style={{ height: GAP }} />;
}

/** 🆕 D-1507 — رقمُ الفيلم في الطابور (طرفُ البداية) و✓ «شاهدته» (الطرفُ الآخر) فوق ملصقه — دائرةُ ✓ بطاقة «تابِع المشاهدة» نفسُها */
function QueueMarks({ rank, onCheck }: { rank: number; onCheck: () => void }) {
  const { t, tokens } = useApp();
  return (
    <>
      <View pointerEvents="none" style={{ position: "absolute", top: 6, start: 6, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
        <Text size={11} weight="800" color="#000" style={{ fontVariant: ["tabular-nums"] }}>{rank}</Text>
      </View>
      <Pressable
        onPress={onCheck}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t.markWatchedAria}
        style={({ pressed }) => ({ position: "absolute", top: 6, end: 6, width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
      >
        <Icon name="check" size={16} color="#fff" />
      </Pressable>
    </>
  );
}

/** بطاقةُ طابور «للمشاهدة» في ورقة القوائم — وصفةُ `ToWatchQueueCard` في الصفّ حرفاً (D-1077)، بعرض الورقة */
function ToWatchCard({ card, busy, onToggle, onPress }: { card: NonNullable<HomePayload["sections"]["lists"]["towatch_card"]>; busy: boolean; onToggle: (on: boolean) => void; onPress: () => void }) {
  const { t } = useApp();
  return (
    <ListCard
      card={{
        id: "towatch",
        name: t.movieQueue,
        icon: "bookmark",
        owner: null,
        owner_avatar: null,
        countText: `${t.listCount(card.count)} · ${t.toWatchAutoNote}`,
        posters: card.posters.filter((x): x is string => !!x),
        cover: null,
        stats: null,
        playlist: card.on,
        dashed: !card.on,
      }}
      busy={busy}
      onPlaylist={onToggle}
      onPress={onPress}
    />
  );
}
