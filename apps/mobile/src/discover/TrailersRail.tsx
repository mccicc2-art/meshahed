import React, { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View, type ViewToken } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, write } from "../api";
import { TrailerPlayer } from "../trailers/TrailerPlayer";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import type { CuratedTab, FollowBody, TrackResult, TrailerCard, TrailersRailPayload } from "../contracts";

/**
 * ====== صفُّ التريلرات في «اكتشف» الأصليّة — D-958 (١٤ سبتمبر ٢٠٢٦) ======
 *
 * 🔑 **مصغّراتٌ وبابٌ لا مشغّل**: قرارُ C3 (D-955) أبقى المشغّلَ ويبيّاً، لكنّ
 * الشاشةَ الأصليّةَ **لم تعرض الصفَّ ولا باباً إليه أصلاً** — فمن يفتح «اكتشف» في
 * التطبيق لا يرى التريلرات (بلاغُ أحمد). هذا الصفُّ يسدّ الفجوةَ بلا تبعيّةٍ
 * جديدة: خلفيّةُ TMDB (أو مصغّرةُ يوتيوب من المفتاح) وزرُّ ▶ **والضغطُ يفتح
 * `/trailers?at=` في الغلاف** — المشغّلُ الواحدُ وصوتُه وتبديلُ الخانات كما هي.
 *
 * ⚖️ **١٤ سبتمبر مساءً — D-959: البابُ صار مشغّلاً في مكانه** (أمرُ أحمد
 * «نفّذها»): الضغطةُ على السطح تُبدّل الصورةَ بـ`TrailerPlayer` الأصليِّ فوق
 * البطاقة نفسِها — **لا مغادرةَ للشاشة**. **وواحدٌ يعمل في الصفّ**: من يفتح
 * بطاقةً يُغلق ما قبلها، **والبطاقةُ التي تخرج من العين تتوقّف** (`viewability`
 * — الرفُّ يلتقط بطاقةً واحدةً في المرّة)، **والخروجُ من «اكتشف» يوقف الكلّ**
 * (`useFocusEffect`): **صوتٌ يتبع مستخدماً غادر الشاشةَ عطلٌ لا ميزة.**
 * **و`href` باقٍ احتياطاً** — يُفتح حين ترفض يوتيوب مفاتيحَ البطاقة كلَّها.
 *
 * 🔑 **والبطاقةُ بقياس الويب لا بقياس الملصقات** (أحمد بلقطة، ١٤ سبتمبر: «أبغى
 * حجم شاشة عرض التريلر مثل حجمها في الويب»): الويبُ يعرضها `min(92vw, …)` —
 * **بطاقةٌ واحدةٌ تملأ العرضَ تقريباً، وسطحٌ 16:9، وتذييلٌ فيه الاسمُ وسطرُ
 * «سنة · نوع · نسبة» وفعلان: «التفاصيل» (صفحةُ العمل الأصليّة، D-956) و«مكتبتي»
 * (`track/follow` متفائلاً كما `useTrailerFollow`)**. هنا العرضُ = الشاشةُ − ٢×١٦
 * والتاليةُ تلوح من الحافّة كما في الويب. **«ترايلرات لك» بالنصّ نفسِه والأيقونةِ
 * نفسِها** (`t.trailersForYou` · `play`). ⚠️ **الصمتُ عند الفراغ أو الفشل** (D-222).
 */
const PAGE_PAD = 16;
const GAP = 12;

const thumbOf = (c: TrailerCard) => c.backdrop ?? `https://i.ytimg.com/vi/${c.video_key}/hqdefault.jpg`;

export function TrailersRail({
  tab,
  onOpenWeb,
  onOpenTitle,
  onError,
}: {
  tab: CuratedTab;
  onOpenWeb: (path: string) => void;
  onOpenTitle: (c: { kind: "tv" | "movie"; id: number }) => void;
  onError: (e: unknown) => void;
}) {
  const { t, tokens } = useApp();
  const { width: screenW } = useWindowDimensions();
  /* عرضُ الويب `min(92vw, calc(45dvh·16/9), 760px)` — على الهاتف يحسمها `92vw`؛ هنا الهوامشُ الثابتة */
  const cardW = Math.min(screenW - PAGE_PAD * 2, 760);
  const q = useQuery({
    queryKey: ["discover:trailers", tab],
    queryFn: async () => (await api<TrailersRailPayload>(`/api/v1/discover/trailers?tab=${tab}`)).data,
    staleTime: 5 * 60_000,
  });
  /* «مكتبتي» متفائلٌ ويتراجع عند الفشل — نسخةُ `useTrailerFollow` (الويب) */
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const follow = useMutation({
    mutationFn: (c: TrailerCard) =>
      write<TrackResult>("/api/v1/track/follow", { tmdbId: c.id, mediaType: c.kind, title: c.title, posterPath: c.poster_path } satisfies FollowBody),
    onMutate: (c) => setAdded((prev) => new Set(prev).add(`${c.kind}-${c.id}`)),
    onError: (e, c) => {
      setAdded((prev) => {
        const next = new Set(prev);
        next.delete(`${c.kind}-${c.id}`);
        return next;
      });
      onError(e);
    },
  });

  /* **بطاقةٌ واحدةٌ تعمل** — المعرّفُ لا المؤشّر: القائمةُ تُعاد جلبُها فتتبدّل الرتب */
  const [live, setLive] = useState<string | null>(null);
  const viewCfg = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onView = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const seen = new Set(viewableItems.map((v) => v.key));
    setLive((cur) => (cur && !seen.has(cur) ? null : cur));
  }).current;
  /* مغادرةُ الشاشة توقف الصوت — والعودةُ تبدأ من الصورة لا من منتصف مقطع */
  useFocusEffect(useCallback(() => () => setLive(null), []));

  const items = q.data?.items ?? [];
  /* فشلُ الجلب صمتٌ لا هيكلٌ أبديّ (درسُ ١٤ سبتمبر: 500 في المسار أبقى الهيكلَ معروضاً) */
  if (q.isError) return null;
  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAGE_PAD, marginBottom: 10 }}>
      <Icon name="play" size={16} color={tokens.accent} />
      <Text size={17} weight="700" style={{ flex: 1 }} numberOfLines={1}>{t.trailersForYou}</Text>
      {q.data ? (
        <Pressable onPress={() => onOpenWeb(q.data.see_all)} hitSlop={8}>
          <Text size={12} weight="600" color={tokens.accent}>{t.seeAll}</Text>
        </Pressable>
      ) : null}
    </View>
  );
  if (!q.data) {
    return (
      <View>
        {header}
        <View style={{ paddingHorizontal: PAGE_PAD }}>
          <View style={{ width: cardW, borderRadius: radius.card, backgroundColor: tokens.surface2, aspectRatio: 16 / 9 }} />
        </View>
      </View>
    );
  }
  if (items.length === 0) return null;
  return (
    <View>
      {header}
      <FlatList
        horizontal
        data={items}
        keyExtractor={(c) => `${c.kind}-${c.id}`}
        renderItem={({ item }) => {
          const id = `${item.kind}-${item.id}`;
          const isAdded = added.has(id);
          return (
            <View style={{ width: cardW, borderRadius: radius.card, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}>
              {live === id ? (
                /* D-959 — المشغّلُ الأصليُّ في مكان الصورة، بالمصغّرة نفسِها سِتراً فلا وميض */
                <TrailerPlayer
                  videoKeys={item.video_keys?.length ? item.video_keys : [item.video_key]}
                  width={cardW}
                  poster={thumbOf(item)}
                  label={item.title}
                  onExhausted={() => {
                    setLive(null);
                    onOpenWeb(item.href);
                  }}
                />
              ) : (
                <Pressable onPress={() => setLive(id)} accessibilityLabel={`${t.trailerPlay} — ${item.title}`} style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                  <Image source={{ uri: thumbOf(item) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={id} />
                  {/* دائرةُ ▶ كما في `TrailerCardMedia` (`h-14 w-14 rounded-full bg-black/60`) */}
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="play" size={24} color="#fff" />
                  </View>
                </Pressable>
              )}
              {/* التذييلُ: `flex items-center gap-3 px-3.5 py-3` — الاسمُ وسطرُه، ثمّ «التفاصيل» و«مكتبتي» */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
                {/* D-959: الاسمُ يشغّل كالسطح — لا يغادر الشاشةَ بعد اليوم */}
                <Pressable onPress={() => setLive(id)} style={{ flex: 1, minWidth: 0 }}>
                  <Text size={15} weight="700" numberOfLines={1}>{item.title}</Text>
                  <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{[item.year, item.genre, item.country].filter(Boolean).join(" · ")}</Text>
                </Pressable>
                <Pressable onPress={() => onOpenTitle(item)} hitSlop={6} style={{ alignItems: "center", gap: 4 }}>
                  <Icon name="info" size={19} color={tokens.muted} />
                  <Text size={12} muted>{t.trailerDetails}</Text>
                </Pressable>
                <Pressable onPress={() => follow.mutate(item)} disabled={isAdded} hitSlop={6} style={{ alignItems: "center", gap: 4 }}>
                  <Icon name={isAdded ? "check-line" : "plus"} size={19} color={isAdded ? tokens.accent : tokens.muted} />
                  <Text size={12} color={isAdded ? tokens.accent : tokens.muted}>{t.trailerMyList}</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        viewabilityConfig={viewCfg}
        onViewableItemsChanged={onView}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
        initialNumToRender={2}
        windowSize={3}
      />
    </View>
  );
}
