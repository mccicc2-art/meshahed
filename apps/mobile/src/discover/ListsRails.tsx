import React, { useState } from "react";
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Chip } from "../library/Chip";
import { Sheet } from "../library/Sheet";
import { ListCard } from "../library/ListCard";
import type { DiscoverListsPayload, LibraryListCard } from "../contracts";

/**
 * ====== تبويبُ «القوائم» في «اكتشف» — نسخةُ `ListsDiscovery` (الويب) ======
 * (Phase 11-C · C3 — D-955)
 *
 * 🔑 **الموجةُ من `/api/v1/discover/lists` في ردٍّ واحد**، والبطاقةُ بطاقةُ
 * المكتبة نفسُها (`ListCard` — D-947، لا بطاقةَ ثانية). **الصفوفُ أفقيّةٌ بعرضٍ
 * واحد** (`PublicListsRail` — ٢٦٠ ≈ `w-[260px]`)، والعوالمُ المنسَّقة صفٌّ لكلِّ
 * عالمٍ و«الكل» ورقةٌ أصليّة بمجموعاته كلِّها (D-996 — كان باباً إلى `/news?tab=lists&fr=`).
 * **ما بقي ويبيّاً هنا صفحةُ القائمة نفسُها** (`/lists/[id]`) — المحطّةُ ٤ في ترتيب النقل.
 * **رقاقتا المصدر (الكل · لوبز · المجتمع) في الشاشة لا في الخادم** — تصفيةٌ
 * محلّيّةٌ لبياناتٍ وصلت، كما يفعل `lsrc` في الصفحة. **ولا فلترَ عالمٍ هنا**:
 * «الكل» على الصفّ يكفي.
 */
const PAGE_PAD = 16;
const CARD_W = 260;

/** D-1085 — خيارُ الاستعلام الواحد، يشاركه `prefetchDiscover` */
export const listsQuery = {
  queryKey: ["discover:lists"] as const,
  queryFn: async () => (await api<DiscoverListsPayload>("/api/v1/discover/lists")).data,
  staleTime: 5 * 60_000,
};

export function ListsRails({ onOpenWeb }: { onOpenWeb: (path: string) => void }) {
  const { t, tokens } = useApp();
  const { width } = useWindowDimensions();
  const cardW = Math.min(CARD_W, width - PAGE_PAD * 2 - 24);
  const [src, setSrc] = useState<"all" | "curated" | "community">("all");
  /* 🆕 D-996 — «الكلّ» للعالم ورقةٌ أصليّة (كان باباً إلى `/news?tab=lists&fr=`): الردُّ يحمل
     مجموعاتِ العالم كاملةً، فالورقةُ تعرضها شبكةً بالبطاقة نفسِها ولا تطلب شيئاً */
  const [allOf, setAllOf] = useState<{ name: string; sets: LibraryListCard[] } | null>(null);
  const q = useQuery(listsQuery);
  const p = q.data;

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
        <FlatList
          horizontal
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
                  stats: { saves: item.saves, reviews: item.reviews, rating: item.rating },
                  playlist: null,
                  canSave: item.can_save,
                  savedByMe: item.saved_by_me,
                  canReview: !!item.can_review,
                  hasMyReview: !!item.my_review,
                }}
                onPress={() => onOpenWeb(`/lists/${item.id}`)}
              />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 10 }}
          initialNumToRender={3}
          windowSize={5}
        />
      </View>
    );

  return (
    <View style={{ gap: 24 }}>
      {/* رقاقاتُ المصدر — عائلةُ chip الواحدة (`ListsFilters variant="chips"`) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 8 }}>
        <Chip label={t.browseAll} active={src === "all"} onPress={() => setSrc("all")} />
        <Chip label={t.listsCurated} active={src === "curated"} onPress={() => setSrc("curated")} />
        <Chip label={t.publicListsRail} active={src === "community"} onPress={() => setSrc("community")} />
      </ScrollView>
      {!p ? (
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: PAGE_PAD }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ width: cardW, height: 168, borderRadius: 14, backgroundColor: tokens.surface2 }} />
          ))}
        </View>
      ) : (
        <>
          {src !== "curated" ? rail("foryou", t.listsForYou, p.for_you) : null}
          {src !== "curated" ? rail("trending", t.listsTrending, p.trending) : null}
          {src !== "curated" ? rail("community", t.publicListsRail, p.community) : null}
          {src !== "community" ? p.franchises.map((f) => rail(f.slug, f.name, f.sets, f.sets.length > 1)) : null}
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
                    stats: { saves: item.saves, reviews: item.reviews, rating: item.rating },
                    playlist: null,
                    canSave: item.can_save,
                    savedByMe: item.saved_by_me,
                    canReview: !!item.can_review,
                    hasMyReview: !!item.my_review,
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
