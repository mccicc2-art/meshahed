import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { ReorderBody } from "../library/ReorderSheet";
import { PosterCard, type CardItem } from "../library/PosterCard";
import { ListCard } from "../library/ListCard";
import { MediaRow } from "./Cards";
import { FriendsNames, FriendsWhoLine, WHO_H, whoOf } from "./Friends";
import type { HomeExtrasPayload, HomeFriendCard, HomePayload, HomeQueueItem, QueueOrderBody } from "../contracts";

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
export type AllSection = "continue" | "towatch" | "upcoming" | "shows" | "movies" | "lists" | "friends";

const GAP = 12;
/** حشوةُ جسد `Sheet` الأفقيّة */
const SHEET_PAD = 16;
/** ما يطلّ من الصفّ الثالث ليدلّ على أنّ تحته مزيداً */
const PEEK = 28;

const REORDER_ROW: Partial<Record<AllSection, QueueOrderBody["row"]>> = { continue: "continue", towatch: "towatch", lists: "lists" };

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
}) {
  const { t, tokens } = useApp();
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<"grid" | "reorder">("grid");
  const [who, setWho] = useState<HomeFriendCard | null>(null);
  const s = d.sections;
  const cell = Math.floor((width - SHEET_PAD * 2 - GAP * 2) / 3);
  const posterH = Math.round(cell * 1.5);
  /* صفّان وإطلالةُ الثالث — وعلى شاشةٍ قصيرةٍ لا تتجاوز الورقةُ ثلثَي الارتفاع */
  const rowH = posterH + (section === "friends" ? WHO_H : 0);
  const bodyMax = Math.min(rowH * 2 + GAP + PEEK, Math.round(height * 0.62));

  const title =
    section === "continue" ? t.continueWatching
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
  const posters: { item: CardItem; onPress: (it: CardItem) => void; friend?: HomeFriendCard }[] | null = useMemo(() => {
    if (section === "continue")
      return s.continue.map((c) =>
        c.type === "show"
          ? { item: asItem({ key: c.key, kind: "tv", id: c.id, title: c.title, poster_path: c.poster_path, progress: c.progress, known: true }), onPress: press }
          : {
              /* بطاقةُ قائمة: ملصقُ «التالي» فيها واسمُ القائمة — وضغطتُها ضغطةُ بطاقتها في الصفّ */
              item: asItem({ key: c.key, kind: c.next.kind, id: c.next.id, title: c.list_name, poster_path: c.next.poster_path }),
              onPress: () => {
                onClose();
                if (c.type === "towatch") onTitle(c.next.kind, c.next.id);
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
  }, [section, s, asItem]);

  const count =
    posters ? posters.length
    : section === "upcoming" ? s.upcoming.length
    : s.lists.cards.length + (s.lists.towatch_card ? 1 : 0);
  const row = REORDER_ROW[section];
  const queue = row === "continue" ? d.queues.continue : row === "towatch" ? d.queues.towatch : row === "lists" ? d.queues.lists : [];
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
              <View style={{ width: 10, height: 10, borderStartWidth: 2, borderTopWidth: 2, borderColor: tokens.fg, transform: [{ rotate: "-45deg" }], marginStart: 4 }} />
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
            <Text size={13} muted>{t.listCount(count)}</Text>
            {canReorder ? (
              <Pressable onPress={() => setMode("reorder")} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, opacity: pressed ? 0.7 : 1 })}>
                <Icon name="grip" size={16} color={tokens.accent} />
                <Text size={13} weight="600">{t.listReorder}</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView style={{ maxHeight: bodyMax }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {posters ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
                {posters.map((p) => (
                  <View key={p.item.key} style={{ width: cell }}>
                    <PosterCard item={p.item} width={cell} onPress={p.onPress} marquee={false} />
                    {p.friend ? <FriendsWhoLine card={p.friend} onProfile={(u) => { onClose(); onProfile(u); }} onNames={setWho} /> : null}
                  </View>
                ))}
              </View>
            ) : section === "upcoming" ? (
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
        </>
      )}
    </Sheet>
  );
}

/** بطاقةُ طابور «للمشاهدة» في ورقة القوائم — وصفةُ `ToWatchQueueCard` في الصفّ حرفاً (D-1077)، بعرض الورقة */
function ToWatchCard({ card, busy, onToggle, onPress }: { card: NonNullable<HomePayload["sections"]["lists"]["towatch_card"]>; busy: boolean; onToggle: (on: boolean) => void; onPress: () => void }) {
  const { t } = useApp();
  return (
    <ListCard
      card={{
        id: "towatch",
        name: t.libToWatch,
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
