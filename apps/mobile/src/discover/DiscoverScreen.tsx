import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, I18nManager, PanResponder, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "../api";
import { useApp } from "../state";
import { shell } from "../shell";
import { Text } from "../ui";
import { Icon } from "../icons";
import { RailCard, RAIL_CARD_W, type LibMark } from "./RailCard";
import { Chip } from "../library/Chip";
import { ListsRails } from "./ListsRails";
import { regionName } from "@/core/region";
import type { CuratedCard, CuratedRailKey, CuratedRailPayload, CuratedTab, LibraryPayload, PersonalRailsPayload } from "../contracts";

/**
 * ====== «اكتشف» أصليّةً — Phase 11-C · C1 (D-955) ======
 *
 * 🔑 **الشكلُ شكلُ الصفحة** (`news/page.tsx`): ترويسةٌ ٦٤ وشريطُ تبويباتٍ
 * (segmented) ثمّ صفوفٌ منسَّقةٌ تُقرأ بالتمرير — في السينما · الأكثرُ شعبيّة ·
 * أفضلُ ١٠ · أفضلُ ٢٥ هذي السنة · القادمُ قريباً — **كلُّ صفٍّ نداءٌ مستقلٌّ
 * يُرسم حين يصل** (`/api/v1/discover/rail`)، وهو ما تفعله الصفحةُ بـ`Suspense`.
 * **والوصفةُ وصفةُ الصفحة حرفاً** (`src/lib/discoverRails.ts` — مصدرٌ واحد).
 *
 * ⚖️ **حدودُ C1–C3 معلَنة** (خطّة 11-C §٢): التبويباتُ الأربعةُ أصليّةٌ — مسلسلات/
 * أفلام/أنمي بصفوفها المنسَّقة والشخصيّة (`/api/v1/discover/rail` · `/personal`)،
 * والقوائمُ بموجتها (`/api/v1/discover/lists`، `ListsRails`)؛ **ورقةُ الفلاتر
 * (`/news?tab=&filters=1` تفتحها من أوّل رسمة) والتريلراتُ و«عرض الكلّ» وصفحةُ
 * القائمة أبوابٌ ويبيّة** بالرجوع إلى هذه الشاشة (D-949/D-951). **ولا نموذجَ
 * فلاترَ ثانياً** (D-145).
 *
 * 🔑 **حالةُ «عندك» من كاش المكتبة** (`me:library`) — الخريطةُ في الذاكرة لا
 * نداءٌ لكلِّ بطاقة (D-322)، وهي نفسُها التي تملؤها شاشةُ المكتبة.
 */
type Tab = "shows" | "movies" | "anime" | "lists";
const HEADER_H = 64;
const PAGE_PAD = 16;
const GAP = 12;
const memory: { tab: Tab; y: number } = { tab: "shows", y: 0 };

/** ترتيبُ الصفوف كما في `CuratedRails` للحالة الافتراضيّة */
const RAILS: Record<CuratedTab, CuratedRailKey[]> = {
  movies: ["cinemas", "popular", "top10-movie", "top50-movie", "soon"],
  shows: ["popular", "top10-tv", "top50-tv", "soon"],
  /* ترتيبُ `AnimeRails` حرفاً */
  anime: ["cinemas", "airing", "popular", "top10-movie", "top10-tv", "soon", "top50-movie", "top50-tv"],
};

export function DiscoverScreen() {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ar = locale !== "en";
  const [tab, setTab] = useState<Tab>(memory.tab);
  useEffect(() => {
    memory.tab = tab;
  }, [tab]);

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

  /* الخروجُ إلى صفحةٍ ويبيّة — الشاشةُ تبقى حتّى تصل (D-951) وتعود إليها (D-949) */
  const [leaving, setLeaving] = useState(false);
  const leaveTo = useCallback(
    (path: string) => {
      if (leaving) return;
      setLeaving(true);
      void shell.open(path, { returnTo: "discover" }).then(back);
    },
    [leaving, back],
  );
  const openCard = useCallback((c: CuratedCard) => leaveTo(c.kind === "tv" ? `/show/${c.id}` : `/movie/${c.id}`), [leaveTo]);

  /* «عندك» — خريطةٌ من كاش المكتبة نفسِه (المفتاحُ والجالبُ كما في `LibraryScreen`) */
  const lib = useQuery({
    queryKey: qk.tag("me:library"),
    queryFn: async () => (await api<LibraryPayload>("/api/v1/me/library")).data,
    staleTime: 60_000,
  });
  const marks = useMemo(() => {
    const m = new Map<string, LibMark>();
    for (const x of lib.data?.items ?? []) {
      const aired = x.aired;
      const watched = Math.min(x.watched, aired || Infinity);
      const done = x.status === "completed";
      const progress = x.kind === "tv" ? (aired > 0 ? Math.round((watched / aired) * 100) : 0) : done ? 100 : 0;
      m.set(`${x.kind}-${x.id}`, { saved: x.status === "unstarted", progress, completed: done, dropped: x.status === "dropped" });
    }
    return m;
  }, [lib.data]);

  /* D-953 — السحبُ الأفقيُّ في الفراغ ينقل التبويب (الآليّةُ نفسُها في المكتبة) */
  const tabsOrder: Tab[] = ["shows", "movies", "anime", "lists"];
  const tabRef = useRef<Tab>(tab);
  tabRef.current = tab;
  const goTab = useCallback((next: Tab) => setTab(next), []);
  const goTabRef = useRef(goTab);
  goTabRef.current = goTab;
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > 1.6 * Math.abs(g.dy),
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) < 56 && Math.abs(g.vx) < 0.4) return;
          const i = tabsOrder.indexOf(tabRef.current);
          const toEnd = I18nManager.isRTL ? g.dx > 0 : g.dx < 0;
          const next = tabsOrder[i + (toEnd ? 1 : -1)];
          if (next) goTabRef.current(next);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* C2 — الصفوفُ الشخصيّة في ردٍّ واحد؛ «لا صفَّ بلا شيءٍ يقوله» (D-219) */
  const railTab: CuratedTab = tab === "lists" ? "shows" : tab;
  const personal = useQuery({
    queryKey: ["discover:personal", railTab] as const,
    queryFn: async () => (await api<PersonalRailsPayload>(`/api/v1/discover/personal?tab=${railTab}`)).data,
    staleTime: 5 * 60_000,
    enabled: tab !== "lists",
  });
  const ps = personal.data;

  const tabLabel = (k: Tab) =>
    k === "shows" ? t.discoverTabShows : k === "movies" ? t.discoverTabMovies : k === "anime" ? t.discoverTabAnime : t.discoverTabLists;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      <View style={{ height: HEADER_H, borderBottomWidth: 1, borderBottomColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
        <Text size={15} weight="700">{t.newsTitle}</Text>
        <Pressable onPress={back} hitSlop={12} accessibilityLabel={t.closeLabel} style={{ position: "absolute", start: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}>
          <Chevron color={tokens.fg} />
        </Pressable>
        {/* الفلاترُ بابٌ ويبيٌّ — الورقةُ بمحاورها الثمانية تعيش في الويب وحدَه، و`filters=1` يفتحها من أوّل رسمة (C3) */}
        <Pressable
          onPress={() => leaveTo(`/news?tab=${tab}&filters=1`)}
          hitSlop={8}
          accessibilityLabel={t.browseFilters}
          style={{ position: "absolute", end: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
            <Icon name="sliders" size={17} color={tokens.fg} />
          </View>
        </Pressable>
      </View>

      {/* شريطُ التبويبات — عائلةُ segmented نفسُها كما في المكتبة */}
      <View style={{ flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderBottomColor: tokens.divider, paddingHorizontal: PAGE_PAD }}>
        {tabsOrder.map((k) => {
          const on = k === tab;
          return (
            <Pressable key={k} onPress={() => goTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}>
              <Text size={14} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted}>{tabLabel(k)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} {...swipe.panHandlers}>
        <ScrollView
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 24 }}
          showsVerticalScrollIndicator={false}
          contentOffset={{ x: 0, y: memory.y }}
          onScroll={(e) => { memory.y = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={64}
        >
          {tab === "lists" ? <ListsRails onOpenWeb={leaveTo} /> : null}
          {/* رقاقاتُ الفلاتر المحفوظة — كما `SavedFiltersRow`: تفتح `/news?<q>&tab=` باباً */}
          {tab !== "lists" && ps && ps.filters.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 8 }}>
              {ps.filters.map((f) => (
                <Chip key={f.q} label={f.name} active={false} onPress={() => leaveTo(`/news?${f.q}&tab=${tab}`)} />
              ))}
            </ScrollView>
          ) : null}
          {/* ترتيبُ `PersonalRails`: مقترحٌ لك · صفوفي · (السينما) · من فنّانيك · ثمّ الباقي */}
          {tab !== "lists" && ps && ps.foryou.length > 0 ? (
            <CardsRail title={t.suggestedForYou} icon="sparkle-star" items={ps.foryou} ranked={false} marks={marks} onOpen={openCard} notes />
          ) : null}
          {tab !== "lists" ? ps?.myrows.map((m) => (
            <CardsRail key={`myrow-${m.key}`} title={m.title} icon="sparkle-star" items={m.items} ranked={false} marks={marks} onOpen={openCard} seeAll={m.see_all} onSeeAll={leaveTo} />
          )) : null}
          {tab !== "lists" ? RAILS[tab].map((key, i) => (
            <React.Fragment key={`${tab}-${key}`}>
              <Rail tab={tab} railKey={key} marks={marks} onOpen={openCard} onSeeAll={leaveTo} ar={ar} />
              {i === 0 && ps && ps.artists.length > 0 ? (
                <CardsRail title={t.artistsRail} icon="people" items={ps.artists} ranked={false} marks={marks} onOpen={openCard} seeAll={ps.artists_see_all} onSeeAll={leaveTo} />
              ) : null}
            </React.Fragment>
          )) : null}
        </ScrollView>
      </View>
      {leaving ? (
        <View pointerEvents="auto" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
    </View>
  );
}

function Rail({
  tab,
  railKey,
  marks,
  onOpen,
  onSeeAll,
  ar,
}: {
  tab: CuratedTab;
  railKey: CuratedRailKey;
  marks: Map<string, LibMark>;
  onOpen: (c: CuratedCard) => void;
  onSeeAll: (path: string) => void;
  ar: boolean;
}) {
  const { t, tokens } = useApp();
  const q = useQuery({
    queryKey: ["discover:rail", tab, railKey] as const,
    queryFn: async () => (await api<CuratedRailPayload>(`/api/v1/discover/rail?tab=${tab}&key=${railKey}`)).data,
    staleTime: 10 * 60_000,
  });
  const p = q.data;
  const anime = tab === "anime";
  /* عنوانُ الصفّ كما تكتبه الصفحة — المفاتيحُ نفسُها من القاموس الواحد (والأنمي بعناوينه) */
  const title =
    railKey === "cinemas"
      ? anime ? t.animeInCinemas : t.inCinemas
      : railKey === "airing"
        ? t.airingNowAnime
        : railKey === "popular"
          ? anime ? t.mostPopularAnime : tab === "movies" ? t.mostPopularMovies : t.mostPopularSeries
          : railKey === "top10-movie"
            ? t.top10Win(anime ? t.top10AnimeMovies : t.top10Movies, "week")
            : railKey === "top10-tv"
              ? t.top10Win(anime ? t.top10AnimeSeries : t.top10Series, "week")
              : railKey === "top50-movie"
                ? anime ? t.top50AnimeMovies : t.top50Movies
                : railKey === "top50-tv"
                  ? anime ? t.top50AnimeSeries : t.top50Series
                  : anime ? t.upcomingAnime : t.comingSoon;
  const icon = railKey === "top50-movie" || railKey === "top10-movie" || railKey === "cinemas" ? "card" : railKey === "soon" ? "clock" : railKey === "popular" ? "chart" : anime ? "sparkle-star" : "list";

  if (q.isError || (p && p.items.length === 0)) return null; // رفٌّ فارغٌ لا يُرسم — كما في الصفحة
  if (!p) {
    return (
      <View>
        <View style={{ height: 22, marginHorizontal: PAGE_PAD, marginBottom: 10, width: 160, borderRadius: 6, backgroundColor: tokens.surface2 }} />
        <View style={{ flexDirection: "row", gap: GAP, paddingHorizontal: PAGE_PAD }}>
          {Array.from({ length: 4 }, (_, i) => (
            <View key={i} style={{ width: RAIL_CARD_W, aspectRatio: 2 / 3, borderRadius: 12, backgroundColor: tokens.surface2 }} />
          ))}
        </View>
      </View>
    );
  }
  return (
    <CardsRail
      title={title}
      icon={icon}
      note={p.region ? t.inCinemasRegion(regionName(p.region, ar ? "ar" : "en")) : null}
      items={p.items}
      ranked={p.ranked}
      marks={marks}
      onOpen={onOpen}
      seeAll={p.see_all}
      onSeeAll={onSeeAll}
    />
  );
}

/** الرفُّ المرسوم — عنوانٌ بأيقونةٍ و«الكل» وسطرُ ملاحظةٍ ثمّ `FlatList` أفقيّ (نسخةُ `RankedRail`) */
function CardsRail({
  title,
  icon,
  note,
  items,
  ranked,
  marks,
  onOpen,
  seeAll,
  onSeeAll,
  notes = false,
}: {
  title: string;
  icon: Parameters<typeof Icon>[0]["name"];
  note?: string | null;
  items: (CuratedCard & { note?: string | null })[];
  ranked: boolean;
  marks: Map<string, LibMark>;
  onOpen: (c: CuratedCard) => void;
  seeAll?: string | null;
  onSeeAll?: (path: string) => void;
  /** «مقترحٌ لك»: سطرُ السبب تحت كلِّ بطاقة */
  notes?: boolean;
}) {
  const { t, tokens } = useApp();
  if (items.length === 0) return null;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAGE_PAD, marginBottom: 10 }}>
        <Icon name={icon} size={16} color={tokens.accent} />
        <Text size={17} weight="700" style={{ flex: 1 }} numberOfLines={1}>{title}</Text>
        {seeAll && onSeeAll ? (
          <Pressable onPress={() => onSeeAll(seeAll)} hitSlop={8}>
            <Text size={12} weight="600" color={tokens.accent}>{t.seeAll}</Text>
          </Pressable>
        ) : null}
      </View>
      {note ? (
        <Text size={12} muted style={{ paddingHorizontal: PAGE_PAD, marginTop: -6, marginBottom: 8 }}>{note}</Text>
      ) : null}
      <FlatList
        horizontal
        data={items}
        keyExtractor={(c) => `${c.kind}-${c.id}`}
        renderItem={({ item, index }) => (
          <RailCard card={item} rank={ranked ? index + 1 : null} lib={marks.get(`${item.kind}-${item.id}`) ?? null} onPress={onOpen} note={notes ? item.note ?? null : null} />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}
        initialNumToRender={5}
        windowSize={5}
      />
    </View>
  );
}

/** سهمُ الرجوع — الخطّان نفسُهما في المكتبة (بلا أيقونةٍ ثانية) */
function Chevron({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 11, height: 11, borderStartWidth: 2, borderTopWidth: 2, borderColor: color, transform: [{ rotate: "-45deg" }], marginStart: 4 }} />
    </View>
  );
}
