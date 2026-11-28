import React, { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Sheet } from "../library/Sheet";
import { LIST_CARD_H, ListCard, useListCardW } from "../library/ListCard";
import type { DiscoverListsPayload, LibraryListCard } from "../contracts";
import { scrollJank } from "../scrollJank";
import { railGrow, useRtlRailPin } from "../rtlRailPin";
import { useAppAway } from "../appActive";
import { NewListBar } from "../newlist/NewListBar";

/**
 * ====== تبويبُ «القوائم» في «اكتشف» — نسخةُ `ListsDiscovery` (الويب) ======
 * (Phase 11-C · C3 — D-955)
 *
 * 🔑 **الموجةُ من `/api/v1/discover/lists` في ردٍّ واحد**، والبطاقةُ بطاقةُ
 * المكتبة نفسُها (`ListCard` — D-947، لا بطاقةَ ثانية). **الصفوفُ أفقيّةٌ بعرضٍ
 * واحد** (`PublicListsRail` — ٢٦٠ ≈ `w-[260px]`)، والعوالمُ المنسَّقة صفٌّ لكلِّ
 * عالمٍ و«الكل» ورقةٌ أصليّة بمجموعاته كلِّها (D-996 — كان باباً إلى `/news?tab=lists&fr=`).
 * **ما بقي ويبيّاً هنا صفحةُ القائمة نفسُها** (`/lists/[id]`) — المحطّةُ ٤ في ترتيب النقل.
 * 🆕 T602 — سقطت رقاقاتُ المصدر (الكل · منسّقة · المجتمع): الأقسامُ تقولها. **ولا فلترَ عالمٍ هنا**:
 * «الكل» على الصفّ يكفي.
 */
const PAGE_PAD = 16;

/** D-1085 — خيارُ الاستعلام الواحد، يشاركه `prefetchDiscover` */
export const listsQuery = {
  queryKey: ["discover:lists"] as const,
  queryFn: async () => (await api<DiscoverListsPayload>("/api/v1/discover/lists")).data,
  staleTime: 5 * 60_000,
};

export function ListsRails({ onOpenWeb }: { onOpenWeb: (path: string) => void }) {
  const { t, tokens, me } = useApp();
  /* T608 (q57) — العرضُ ثابتُ البطاقة المشترك (٣٣٠ لا ٢٦٠) ويُقصّ على الشاشة الضيّقة */
  const cardW = useListCardW();
  /* 🆕 D-996 — «الكلّ» للعالم ورقةٌ أصليّة (كان باباً إلى `/news?tab=lists&fr=`): الردُّ يحمل
     مجموعاتِ العالم كاملةً، فالورقةُ تعرضها شبكةً بالبطاقة نفسِها ولا تطلب شيئاً */
  const [allOf, setAllOf] = useState<{ name: string; sets: LibraryListCard[] } | null>(null);
  const q = useQuery(listsQuery);
  const p = q.data;
  /* 🆕 T450 — **العودةُ إلى التطبيق تجدّد القوائم** (أحمد: «لا تجددت اساسا»): التبويبُ يبقى مركَّباً، والتطبيقُ لا يجلب
     عند التركيز (`refetchOnWindowFocus: false`) والكاشُ محفوظٌ في القرص — فكان «لك» يبقى على ترتيب أمس. فالرجوعُ بعد
     دقيقةٍ فأكثر يجلب، بلا هيكل: البطاقاتُ القديمةُ مرسومةٌ حتى تصل الجديدة */
  const away = useAppAway();
  const wasAway = useRef(away);
  const { refetch, dataUpdatedAt } = q;
  useEffect(() => {
    if (wasAway.current && !away && Date.now() - dataUpdatedAt > 60_000) void refetch();
    wasAway.current = away;
  }, [away, refetch, dataUpdatedAt]);

  const rail = (key: string, title: string, lists: LibraryListCard[], seeAll?: boolean) =>
    lists.length === 0 ? null : (
      <View key={key}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAGE_PAD, marginBottom: 10 }}>
          <Icon name={seeAll ? "sparkle-star" : "list"} size={16} color={tokens.accent} />
          <Text size={17} weight="700" style={{ flex: 1 }} numberOfLines={1}>{title}</Text>
          {seeAll ? (
            <Pressable onPress={() => setAllOf({ name: title, sets: lists })} hitSlop={8}>
              <Text size={12} weight="600" color={tokens.accent}>{t.seeAll}</Text>
            </Pressable>
          ) : null}
        </View>
        <ListsRailList lists={lists} cardW={cardW} onOpenWeb={onOpenWeb} />
      </View>
    );

  return (
    <View style={{ gap: 24 }}>
      {/* 🆕 T602 (q32 «أ») — **سقط صفُّ المصدر «الكل · منسّقة · المجتمع»**: كان طبقةَ تنقّلٍ ثالثةً قبل أوّل قائمة، والأقسامُ
          نفسُها تقوله. وبابا الإنشاء أوّلُ ما في التبويب */}
      {me ? <NewListBar from="discover" style={{ marginHorizontal: PAGE_PAD }} /> : null}
      {!p ? (
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: PAGE_PAD }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ width: cardW, height: LIST_CARD_H, borderRadius: 14, backgroundColor: tokens.surface2 }} />
          ))}
        </View>
      ) : (
        <>
          {/* الترتيب: لك · أوّلُ العوالم المنسَّقة (كان يُبلَغ برقاقة «منسّقة») · الرائجة · المجتمع · بقيّةُ العوالم */}
          {rail("foryou", t.listsForYou, p.for_you)}
          {p.franchises.slice(0, 1).map((f) => rail(f.slug, f.name, f.sets, f.sets.length > 1))}
          {rail("trending", t.listsTrending, p.trending)}
          {rail("community", t.publicListsRail, p.community)}
          {p.franchises.slice(1).map((f) => rail(f.slug, f.name, f.sets, f.sets.length > 1))}
        </>
      )}
      {allOf ? (
        <Sheet title={allOf.name} onClose={() => setAllOf(null)}>
          <FlatList
            data={allOf.sets}
            keyExtractor={(l) => l.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 10 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
            style={{ maxHeight: 560 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ flex: 1 }}>
                <ListCard
                  card={{
                    id: item.id,
                    name: item.name,
                    icon: item.kind === "smart" || item.kind === "curated" ? "sparkle-star" : undefined,
                    owner: item.owner,
                    owner_avatar: item.owner_avatar,
                    countText: item.count_label ?? t.listCount(item.item_count),
                    posters: item.posters,
                    cover: item.cover,
                    stats: { saves: item.saves, likes: item.likes ?? 0, reviews: item.reviews, rating: item.rating },
                    playlist: null,
                    canSave: item.can_save,
                    savedByMe: item.saved_by_me,
                    likedByMe: item.liked_by_me,
                    canReview: !!item.can_review,
                    hasMyReview: !!item.my_review,
                    event: item.event,
                  }}
                  onPress={() => {
                    setAllOf(null);
                    onOpenWeb(`/lists/${item.id}`);
                  }}
                />
              </View>
            )}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

/** صفُّ قوائمٍ أفقيّ — مكوّنٌ لا دالّة (D-1492): لكلِّ صفٍّ تثبيتُه على الآيفون بالعربيّ (`useRtlRailPin`، D-1478)، والخطّافُ لا يُنادى في دالّةٍ تُستدعى لكلِّ صفّ */
function ListsRailList({ lists, cardW, onOpenWeb }: { lists: LibraryListCard[]; cardW: number; onOpenWeb: (path: string) => void }) {
  const { t } = useApp();
  const { props: pin } = useRtlRailPin<LibraryListCard>(scrollJank("discover", "h").onScrollBeginDrag, scrollJank("discover", "h").onMomentumScrollBegin);
  return (
    <FlatList
      horizontal
      {...scrollJank("discover", "h")}
      {...pin}
      data={lists}
      keyExtractor={(l) => l.id}
      renderItem={({ item }) => (
        <View style={{ width: cardW }}>
          <ListCard
            card={{
              id: item.id,
              name: item.name,
              icon: item.kind === "smart" || item.kind === "curated" ? "sparkle-star" : undefined,
              owner: item.owner,
              owner_avatar: item.owner_avatar,
              countText: item.count_label ?? t.listCount(item.item_count),
              posters: item.posters,
              cover: item.cover,
              stats: { saves: item.saves, likes: item.likes ?? 0, reviews: item.reviews, rating: item.rating },
              playlist: null,
              canSave: item.can_save,
              savedByMe: item.saved_by_me,
              likedByMe: item.liked_by_me,
              canReview: !!item.can_review,
              hasMyReview: !!item.my_review,
              event: item.event,
            }}
            onPress={() => onOpenWeb(`/lists/${item.id}`)}
          />
        </View>
      )}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={railGrow({ paddingHorizontal: PAGE_PAD, gap: 10 })}
      initialNumToRender={3}
      windowSize={5}
    />
  );
}
