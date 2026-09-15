import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, FlatList, Platform, Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError, qk, write } from "../api";
import { useApp } from "../state";
import { shell } from "../shell";
import { Text, Toast } from "../ui";
import { Icon } from "../icons";
import { RailCard, RAIL_CARD_W, type LibMark } from "./RailCard";
import { HoldMenu, type HoldAction } from "../library/HoldMenu";
import type { CardAnchor, CardItem } from "../library/PosterCard";
import { Chip } from "../library/Chip";
import { ListsRails } from "./ListsRails";
import { TrailersRail } from "./TrailersRail";
import { TabSlide } from "../TabSlide";
import { useChromeHide } from "../ChromeHide";
import { BottomNav, navHeight } from "../BottomNav";
import { regionName } from "@/core/region";
import type { CuratedCard, CuratedRailKey, CuratedRailPayload, CuratedTab, DismissBody, FollowBody, LibraryPayload, PersonalRailsPayload, ShowRefBody, ToggleMovieBody, UnfollowBody } from "../contracts";

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
/* D-965 — موضعُ التمرير لكلِّ تبويب: الجارُ المسلَّح يُرسم بموضعه هو */
const memory: { tab: Tab; y: Partial<Record<Tab, number>> } = { tab: "shows", y: {} };

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
  const navH = navHeight(insets.bottom);
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
  /* D-958 — خطأُ «مكتبتي» من صفّ التريلرات: مضيفُ الإشعار الواحد كما في المكتبة */
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);
  const onError = useCallback(
    (e: unknown) => {
      const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[key];
      setToast(typeof msg === "string" ? msg : t.apiInternal);
    },
    [t],
  );
  /* D-956 — صفحةُ العمل أصليّةٌ: دفعٌ في المكدّس، و«اكتشف» تبقى تحتها */
  const openCard = useCallback((c: CuratedCard) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: c.kind, id: String(c.id), from: "discover" } }), [router]);

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

  /**
   * 🆕 D-978 — **الضغطُ المطوَّل على أيّ بطاقةٍ في «اكتشف»** (بلاغُ أحمد بلقطة: «في
   * الويب إذا ضغطت مطوّلاً تظهر خيارات، في الأصليّة لا تظهر»): `HoldMenu` المكتبةِ
   * نفسُها بصفوف `PosterHold` الويب — للمشاهدة · شاهدته كلّه · تعليقك · غير مهتمّ.
   * **الحالةُ تفاؤليّة**: الخيطُ يتبدّل تحت الإصبع من طبقةٍ فوق كاش المكتبة
   * (`overrides`)، والكتابةُ تُبطل `me:library` فتحلّ الحقيقةُ محلّ التفاؤل. «غير
   * مهتمّ» يُخفي البطاقةَ فوراً (`hidden`) ويكتب في `dismissed_titles` عبر
   * `/api/v1/track/dismiss`، ولا يُعرض في هذه الجلسة بعدها.
   */
  const [held, setHeld] = useState<{ card: CuratedCard; anchor: CardAnchor } | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState<Map<string, LibMark>>(() => new Map());
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const hold = useCallback((card: CuratedCard, anchor: CardAnchor) => setHeld({ card, anchor }), []);
  const act = useCallback(
    async (a: HoldAction) => {
      const h = held;
      if (!h) return;
      const c = h.card;
      const key = `${c.kind}-${c.id}`;
      if (a === "review") {
        setHeld(null);
        openCard(c);
        return;
      }
      setHeld(null);
      setBusy(true);
      const before = overrides.get(key);
      try {
        if (a === "towatch") {
          const inList = !!(overrides.has(key) ? overrides.get(key) : marks.get(key));
          setOverrides((m) => new Map(m).set(key, inList ? null : { saved: true, progress: 0, completed: false, dropped: false }));
          if (inList) await write<unknown>("/api/v1/track/unfollow", { tmdbId: c.id, mediaType: c.kind } satisfies UnfollowBody);
          else await write<unknown>("/api/v1/track/follow", { tmdbId: c.id, mediaType: c.kind, title: c.title, posterPath: c.poster_path } satisfies FollowBody);
        } else if (a === "all") {
          setOverrides((m) => new Map(m).set(key, { saved: false, progress: 100, completed: true, dropped: false }));
          if (c.kind === "tv") await write<unknown>("/api/v1/track/show-watched", { showTmdbId: c.id } satisfies ShowRefBody);
          else await write<unknown>("/api/v1/track/movie", { movieTmdbId: c.id, runtime: null, watched: true } satisfies ToggleMovieBody);
        } else if (a === "dismiss") {
          setHidden((prev) => new Set(prev).add(key));
          setToast(t.dismissedToast);
          await write<unknown>("/api/v1/track/dismiss", { tmdbId: c.id, mediaType: c.kind } satisfies DismissBody);
        }
      } catch (e) {
        /* التراجعُ عن التفاؤل عند الفشل — والبطاقةُ المخفيّةُ تعود */
        setOverrides((m) => {
          const next = new Map(m);
          if (before === undefined) next.delete(key);
          else next.set(key, before);
          return next;
        });
        if (a === "dismiss")
          setHidden((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        onError(e);
      } finally {
        setBusy(false);
      }
    },
    [held, overrides, marks, openCard, onError, t],
  );
  /** بطاقةُ القائمة بشكل `CardItem` — الحقولُ التي تقرؤها `HoldMenu` وحدَها */
  const heldItem: CardItem | null = useMemo(() => {
    if (!held) return null;
    const c = held.card;
    const k = `${c.kind}-${c.id}`;
    const m = overrides.has(k) ? overrides.get(k) : marks.get(k);
    return { key: `${c.kind}-${c.id}`, kind: c.kind, id: c.id, title: c.title, posterPath: c.poster_path, progress: m?.progress ?? 0, completed: !!m?.completed, dropped: !!m?.dropped };
  }, [held, overrides, marks]);
  const effectiveMarks = useMemo(() => {
    if (overrides.size === 0) return marks;
    const m = new Map(marks);
    for (const [k, v] of overrides) {
      if (v) m.set(k, v);
      else m.delete(k);
    }
    return m;
  }, [marks, overrides]);

  /* D-953 → ⚖️ D-961: السحبُ صار انزلاقاً — الإيماءةُ والعتباتُ انتقلت إلى
     `TabSlide` (مصنعٌ واحدٌ تقرؤه المكتبةُ و«اكتشف»)، **والترتيبُ هنا لأنّه
     ترتيبُ هذه الشاشة.** */
  const tabsOrder: Tab[] = ["shows", "movies", "anime", "lists"];
  const goTab = useCallback((next: Tab) => setTab(next), []);

  /* D-966 — الكسوةُ الذكيّة كما في المكتبة: الورقةُ (رأسٌ + ألواح) تصعد بارتفاع الرأس
     وتمتدّ تحته، والشريطُ يهبط؛ وقلبُ التبويب يُعيدها (`reveal`). */
  const chrome = useChromeHide();
  /* تقديرٌ أوّليٌّ قبل القياس (ترويسة + تبويبات) — فلا يقفز المحتوى في أوّل إطار */
  const [topH, setTopH] = useState(insets.top + HEADER_H + 46);
  const bottomPad = navH + 24;
  const { reveal } = chrome;
  useEffect(() => {
    reveal();
  }, [tab, reveal]);

  /* الصفوفُ الشخصيّة والمنسَّقة صارت في `DiscoverPane` (D-965): لوحٌ لكلِّ تبويب */

  const tabLabel = (k: Tab) =>
    k === "shows" ? t.discoverTabShows : k === "movies" ? t.discoverTabMovies : k === "anime" ? t.discoverTabAnime : t.discoverTabLists;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
    {/* ⚖️ D-969 — الرأسُ وحدَه يتحرّك والمحتوى ثابت، كالويب (انظر `LibraryScreen`) */}
    <Animated.View
      onLayout={(e) => setTopH(Math.round(e.nativeEvent.layout.height))}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2,
        paddingTop: insets.top,
        backgroundColor: tokens.bg,
        transform: [{ translateY: Animated.multiply(chrome.hidden, -topH) }],
      }}
    >
    <View>
      <View style={{ height: HEADER_H, borderBottomWidth: 1, borderBottomColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
        {/* ⚖️ D-980 — بلا سهمِ رجوع (انظر `LibraryScreen`): الشريطُ السفليّ هو المخرج */}
        <Text size={15} weight="700">{t.newsTitle}</Text>
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
    </View>
    </Animated.View>

      {/* ⚖️ D-961 → D-965 — اللوحُ ينزلق، **والجارُ يُرسم حيّاً** تحت الإصبع لحظةَ قفل السحب */}
      <TabSlide
        order={tabsOrder}
        tab={tab}
        onTab={goTab}
        render={(k, active) => (
          <DiscoverPane
            tab={k}
            active={active}
            marks={effectiveMarks}
            hidden={hidden}
            heldKey={held ? `${held.card.kind}-${held.card.id}` : null}
            onHold={hold}
            topPad={topH}
            bottomPad={bottomPad}
            onScroll={chrome.onScroll}
            ar={ar}
            onOpen={openCard}
            onLeave={leaveTo}
            onError={onError}
          />
        )}
      />
      {/* D-961 — الشريطُ الخماسيُّ كما في كلِّ صفحةٍ ويبيّة؛ «اكتشف» هي الخانةُ المضيئة — D-966: يهبط بارتفاعه مع النزول */}
      <Animated.View style={{ position: "absolute", left: 0, right: 0, bottom: 0, transform: [{ translateY: Animated.multiply(chrome.hidden, navH) }] }}>
      <BottomNav
        active="news"
        onGo={(k) => {
          if (k === "news") return;
          if (k === "library") {
            router.replace("/library");
            return;
          }
          leaveTo(k === "home" ? "/" : k === "people" ? "/people" : "/search");
        }}
      />
      </Animated.View>
      {toast ? <Toast text={toast} bottom={navH + 16} /> : null}
      {held && heldItem ? (
        <HoldMenu
          variant="discover"
          item={heldItem}
          anchor={held.anchor}
          busy={busy}
          inList={!!effectiveMarks.get(`${held.card.kind}-${held.card.id}`)}
          onAction={(a) => void act(a)}
          onClose={() => setHeld(null)}
        />
      ) : null}
      {leaving ? (
        <View pointerEvents="auto" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * لوحُ تبويبٍ — D-965. **كلُّ ما يخصّ تبويباً واحداً يعيش هنا** (الصفوفُ الشخصيّة
 * والمنسَّقة وموضعُ التمرير) ليستطيع `TabSlide` رسمَ لوحين جنباً إلى جنب في أثناء
 * السحب. **نداءاتُ الجار تُطلق لحظةَ تركيبه** (قفلُ الإيماءة — تسليحُ D-523)،
 * وكلُّ صفٍّ يحمل هيكلَه الخاصّ (`Rail`) فيبدو اللوحُ مبنيّاً وتمتلئ صفوفُه تباعاً؛
 * و`staleTime` يجعل الزيارةَ التالية فوريّة.
 */
/** «مقترحٌ لك»: عشرةٌ في المرّة — `PAGE` في `PickedForYou` الويب */
const PICKED_PAGE = 10;

function DiscoverPane({
  tab,
  active,
  marks,
  hidden,
  heldKey,
  onHold,
  topPad,
  bottomPad,
  onScroll,
  ar,
  onOpen,
  onLeave,
  onError,
}: {
  tab: Tab;
  /** هل هذا اللوحُ هو النشط؟ الجارُ المسلَّح يُرسم حيّاً لكنّه لا يحمّي مشغّلاً (D-975) */
  active: boolean;
  marks: Map<string, LibMark>;
  /** D-978 — بطاقاتٌ أُخفيت بـ«غير مهتمّ» في هذه الجلسة */
  hidden: ReadonlySet<string>;
  /** البطاقةُ المضغوطةُ مطوّلاً الآن (إطارٌ ذهبيّ) */
  heldKey: string | null;
  onHold: (c: CuratedCard, anchor: CardAnchor) => void;
  /** ارتفاعُ الرأس المطلق فوق اللوح (D-969) */
  topPad: number;
  bottomPad: number;
  /** الكسوةُ الذكيّة تقرأ التمرير (D-966) */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ar: boolean;
  onOpen: (c: CuratedCard) => void;
  onLeave: (path: string) => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useApp();
  const router = useRouter();
  /* C2 — الصفوفُ الشخصيّة في ردٍّ واحد؛ «لا صفَّ بلا شيءٍ يقوله» (D-219) */
  const railTab: CuratedTab = tab === "lists" ? "shows" : tab;
  const personal = useQuery({
    queryKey: ["discover:personal", railTab] as const,
    queryFn: async () => (await api<PersonalRailsPayload>(`/api/v1/discover/personal?tab=${railTab}`)).data,
    staleTime: 5 * 60_000,
    enabled: tab !== "lists",
  });
  const ps = personal.data;
  const lists = tab === "lists";
  /**
   * 🆕 D-979 — **«اقتراحات أخرى» كما في الويب** (طلبُ أحمد: «في الويب فيه more picks،
   * في الأصليّة ما فيه»): الردُّ يحمل البِركةَ كلَّها مخلوطةً (`personalRails`)، والصفُّ
   * يعرض عشراً — والزرُّ يسحب عشراً عشوائيّةً من البِركة مستبعداً المعروضَ الآن ما
   * دامت البِركةُ تسمح (وصفةُ `PickedForYou` حرفاً، D-064). **لا نداءَ للخادم**: البِركةُ
   * عندنا، والنداءُ الثاني كان سيعيد الوجوهَ نفسَها بترتيبٍ آخر.
   */
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const foryouPool = useMemo(() => (ps?.foryou ?? []).filter((c) => !hidden.has(`${c.kind}-${c.id}`)), [ps, hidden]);
  const foryou = useMemo(
    () => (picked === null ? foryouPool.slice(0, PICKED_PAGE) : foryouPool.filter((c) => picked.has(`${c.kind}-${c.id}`)).slice(0, PICKED_PAGE)),
    [foryouPool, picked],
  );
  const morePicks = useCallback(() => {
    const keyOf = (c: CuratedCard) => `${c.kind}-${c.id}`;
    const current = new Set(foryou.map(keyOf));
    const source = foryouPool.length > PICKED_PAGE * 2 ? foryouPool.filter((c) => !current.has(keyOf(c))) : foryouPool;
    const arr = [...source];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setPicked(new Set(arr.slice(0, PICKED_PAGE).map(keyOf)));
  }, [foryou, foryouPool]);
  const railProps = { marks, hidden, heldKey, onHold, onOpen };
  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: bottomPad, gap: 24 }}
      showsVerticalScrollIndicator={false}
      contentOffset={{ x: 0, y: memory.y[tab] ?? 0 }}
      onScroll={(e) => { memory.y[tab] = e.nativeEvent.contentOffset.y; onScroll(e); }}
      scrollEventThrottle={16}
    >
      {lists ? <ListsRails onOpenWeb={onLeave} /> : null}
      {/* رقاقاتُ الفلاتر المحفوظة — كما `SavedFiltersRow`: تفتح `/news?<q>&tab=` باباً */}
      {!lists && ps && ps.filters.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 8 }}>
          {ps.filters.map((f) => (
            <Chip key={f.q} label={f.name} active={false} onPress={() => onLeave(`/news?${f.q}&tab=${tab}`)} />
          ))}
        </ScrollView>
      ) : null}
      {/* D-958 — صفُّ التريلرات أوّلاً كما في الصفحة (قبل `PersonalRails`)؛ المشغّلُ بابٌ ويبيّ (C3) */}
      {!lists ? <TrailersRail tab={tab} active={active} onOpenWeb={onLeave} onOpenTitle={(c) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: c.kind, id: String(c.id), from: "discover" } })} onError={onError} /> : null}
      {/* ترتيبُ `PersonalRails`: مقترحٌ لك · صفوفي · (السينما) · من فنّانيك · ثمّ الباقي */}
      {!lists && foryou.length > 0 ? (
        <CardsRail
          title={t.suggestedForYou}
          icon="sparkle-star"
          items={foryou}
          ranked={false}
          {...railProps}
          notes
          /* الزرُّ يظهر حين توجد صفحةٌ ثانية فقط — زرٌّ لا يغيّر شيئاً كذبة (D-979) */
          action={foryouPool.length > PICKED_PAGE ? { label: t.pickedRefresh, aria: t.pickedRefreshAria, icon: "repeat", onPress: morePicks } : null}
        />
      ) : null}
      {!lists ? ps?.myrows.map((m) => (
        <CardsRail key={`myrow-${m.key}`} title={m.title} icon="sparkle-star" items={m.items} ranked={false} {...railProps} seeAll={m.see_all} onSeeAll={onLeave} />
      )) : null}
      {!lists ? RAILS[tab].map((key, i) => (
        <React.Fragment key={`${tab}-${key}`}>
          <Rail tab={tab} railKey={key} {...railProps} onSeeAll={onLeave} ar={ar} />
          {i === 0 && ps && ps.artists.length > 0 ? (
            <CardsRail title={t.artistsRail} icon="people" items={ps.artists} ranked={false} {...railProps} seeAll={ps.artists_see_all} onSeeAll={onLeave} />
          ) : null}
        </React.Fragment>
      )) : null}
    </ScrollView>
  );
}

type RailShared = {
  marks: Map<string, LibMark>;
  hidden: ReadonlySet<string>;
  heldKey: string | null;
  onHold: (c: CuratedCard, anchor: CardAnchor) => void;
  onOpen: (c: CuratedCard) => void;
};

function Rail({
  tab,
  railKey,
  onSeeAll,
  ar,
  ...shared
}: RailShared & {
  tab: CuratedTab;
  railKey: CuratedRailKey;
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
      {...shared}
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
  hidden,
  heldKey,
  onHold,
  onOpen,
  seeAll,
  onSeeAll,
  notes = false,
  action = null,
}: RailShared & {
  title: string;
  icon: Parameters<typeof Icon>[0]["name"];
  note?: string | null;
  items: (CuratedCard & { note?: string | null })[];
  ranked: boolean;
  seeAll?: string | null;
  onSeeAll?: (path: string) => void;
  /** «مقترحٌ لك»: سطرُ السبب تحت كلِّ بطاقة */
  notes?: boolean;
  /** فعلُ الصفّ في طرف العنوان (رقاقةٌ بحدٍّ كـ«اقتراحات أخرى» الويب) — بدل «الكلّ» */
  action?: { label: string; aria: string; icon: Parameters<typeof Icon>[0]["name"]; onPress: () => void } | null;
}) {
  const { t, tokens } = useApp();
  const shown = hidden.size === 0 ? items : items.filter((c) => !hidden.has(`${c.kind}-${c.id}`));
  if (shown.length === 0) return null;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAGE_PAD, marginBottom: 10 }}>
        <Icon name={icon} size={16} color={tokens.accent} />
        <Text size={17} weight="700" style={{ flex: 1 }} numberOfLines={1}>{title}</Text>
        {action ? (
          /* `rounded-full border px-2.5 py-1 text-12 font-semibold text-muted` — الرقاقةُ نفسُها (D-732) */
          <Pressable onPress={action.onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={action.aria} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: tokens.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, opacity: pressed ? 0.7 : 1 })}>
            <Icon name={action.icon} size={13} color={tokens.muted} />
            <Text size={12} weight="600" muted>{action.label}</Text>
          </Pressable>
        ) : seeAll && onSeeAll ? (
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
        data={shown}
        keyExtractor={(c) => `${c.kind}-${c.id}`}
        extraData={heldKey}
        renderItem={({ item, index }) => (
          <RailCard
            card={item}
            rank={ranked ? index + 1 : null}
            lib={marks.get(`${item.kind}-${item.id}`) ?? null}
            onPress={onOpen}
            note={notes ? item.note ?? null : null}
            onHold={onHold}
            held={heldKey === `${item.kind}-${item.id}`}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}
        initialNumToRender={5}
        windowSize={5}
      />
    </View>
  );
}

