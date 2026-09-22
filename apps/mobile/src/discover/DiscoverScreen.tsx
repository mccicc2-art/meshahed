import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, FlatList, Platform, Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, qk, write, queryClient } from "../api";
import { useApp } from "../state";
import { shell } from "../shell";
import { nativeListId } from "../list/route";
import { Text } from "../ui";
import { Icon } from "../icons";
import { RailCard, RAIL_CARD_W, type LibMark } from "./RailCard";
import { HoldHost, ToastHost, type HoldHostRef, type ToastHostRef } from "../HoldHost";
import { CardStoreContext, createCardStore } from "../cardStore";
import { useCardActs } from "../cardActs";
import type { CardAnchor, CardItem } from "../library/PosterCard";
import { Chip } from "../library/Chip";
import { ListsRails } from "./ListsRails";
import { TrailersRail } from "./TrailersRail";
import { FilterSheet } from "./FilterSheet";
import { Logo } from "../Logo";
import { NameSheet } from "./NameSheet";
import { coldStartVoid, span } from "../perfMarks";
import { usePullRefresh } from "../pullRefresh";
import { dismissed, useDismissed } from "./dismissed";
import { railsHiddenFor, type RailKey } from "@/core/railPrefs";
import type { TabPref } from "@/core/tabPrefs";
import type { MyRow } from "@/core/myRows";
import { sectionToRuleType } from "@/core/smartListKeys";
import { axisValueLabel, browseActive, browseFromQuery, browseQuery, EMPTY_BROWSE, type AxisKey, type BrowseState } from "./browseState";
import { TabSlide } from "../TabSlide";
import { useChromeHide } from "../ChromeHide";
import { BottomNav, navHeight } from "../BottomNav";
import { regionName } from "@/core/region";
import type { CuratedCard, CuratedRailKey, CuratedRailPayload, CuratedTab, LibraryPayload, PersonalRailsPayload, SavedFilterBody, SavedFilterResult, SmartListBody, DiscoverViewPayload, MyRowsBody } from "../contracts";

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

/**
 * 🆕 D-1003 — **تسخينُ «اكتشف» قبل فتحها** (بلاغُ أحمد: «بطء في اكتشف أوّل ما تدخل»):
 * الغلافُ يناديها حين تجهز الجلسةُ والويبُ يحمّل الرئيسيّة — فتصل الشاشةُ إلى كاش
 * `react-query` مملوءاً بصفوف التبويب الذي سيُفتح (الشخصيّ + الأربعة/الخمسة المنسَّقة +
 * تفضيلاتُ العرض). المفاتيحُ مفاتيحُ `Rail`/`DiscoverPane` حرفاً فلا نداءَ يتكرّر.
 */
export function prefetchDiscover(): void {
  const tab = memory.tab === "lists" ? "shows" : memory.tab;
  void queryClient.prefetchQuery({ queryKey: ["discover:view"] as const, queryFn: async () => (await api<DiscoverViewPayload>("/api/v1/discover/view")).data, staleTime: 5 * 60_000 });
  void queryClient.prefetchQuery({
    queryKey: ["discover:personal", tab, ""] as const,
    queryFn: async () => (await api<PersonalRailsPayload>(`/api/v1/discover/personal?tab=${tab}`)).data,
    staleTime: 5 * 60_000,
  });
  for (const key of RAILS[tab]) {
    void queryClient.prefetchQuery({
      queryKey: ["discover:rail", tab, key, ""] as const,
      queryFn: async () => (await api<CuratedRailPayload>(`/api/v1/discover/rail?tab=${tab}&key=${key}`)).data,
      staleTime: 10 * 60_000,
    });
  }
}

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
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const ar = locale !== "en";
  const navH = navHeight(insets.bottom);
  const [tab, setTab] = useState<Tab>(memory.tab);
  useEffect(() => {
    memory.tab = tab;
  }, [tab]);
  /* F0 (D-1024) — `discover.open`: من تركيب الشاشة إلى وصول آخر صفٍّ منسَّقٍ في تبويب الفتح.
     و«اكتشف» فُتحت أوّلاً ⇒ الإقلاعُ البارد ليس «إلى المكتبة» فلا يُسجَّل باسمها. */
  const [openTab] = useState<Tab>(memory.tab);
  const [endOpen] = useState(() => {
    coldStartVoid();
    return span("discover.open", { tab: memory.tab });
  });

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
      /* D-1036 — صفحةُ القائمة أصليّةٌ الآن: دفعٌ في المكدّس لا بابٌ ويبيّ، والشاشةُ تبقى تحتها (نهجُ D-956).
         القرارُ هنا لا في كلِّ منادٍ — كلُّ من يفتح قائمةً يمرّ من هذا الباب */
      const listId = nativeListId(path);
      if (listId) {
        router.push({ pathname: "/list/[id]", params: { id: listId, from: "discover" } });
        return;
      }
      setLeaving(true);
      void shell.open(path, { returnTo: "discover" }).then(back);
    },
    [leaving, back, router],
  );
  /* D-958 — خطأُ «مكتبتي» من صفّ التريلرات: مضيفُ الإشعار الواحد كما في المكتبة */
  /* ⚖️ D-1028 (F4) — الإشعارُ في مضيفه (`ToastHost`) لا في حالة الشاشة؛ و`setToast` ثابتةُ المرجع */
  const toastHost = useRef<ToastHostRef>(null);
  const setToast = useCallback((text: string) => toastHost.current?.say(text), []);
  /**
   * 🆕 D-1047 (Phase 11-F · F5) — **حذفٌ بلا تأكيدٍ يحتاج «تراجع»** (دَينٌ معلَنٌ في `05`: «حذفُ فلترٍ محفوظ بضغطةٍ
   * مطوّلة بلا تأكيدٍ ولا تراجع»). الحذفُ يُرى فوراً، **والكتابةُ تُؤجَّل أربعَ ثوانٍ** يعرض فيها الإشعارُ «تراجع»:
   * الضغطُ يعيد ما حُذف ولا يصل الخادمَ شيء؛ وانقضاءُ المهلة يكتب. **ما عُلِّق لا يضيع**: حذفٌ ثانٍ، أو مغادرةُ
   * الشاشة، يكتبان المعلَّقَ فوراً — «تراجع» يؤخّر الكتابةَ ولا يُسقطها.
   */
  const pending = useRef<{ id: ReturnType<typeof setTimeout>; commit: () => void } | null>(null);
  const flushPending = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    clearTimeout(p.id);
    p.commit();
  }, []);
  const undoable = useCallback(
    (text: string, commit: () => void, undo: () => void) => {
      flushPending();
      const id = setTimeout(flushPending, 4000);
      pending.current = { id, commit };
      toastHost.current?.say(
        text,
        {
          label: t.undoWatched,
          onPress: () => {
            if (pending.current?.id !== id) return;
            clearTimeout(id);
            pending.current = null;
            undo();
          },
        },
        4000,
      );
    },
    [flushPending, t],
  );
  useEffect(() => flushPending, [flushPending]);

  const onError = useCallback(
    (e: unknown) => {
      const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[key];
      setToast(typeof msg === "string" ? msg : t.apiInternal);
    },
    [t, setToast],
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
  /**
   * 🆕 D-992 (Phase 11-C4) — **الفلترُ أصليٌّ وينزلق مع التبويبات**: حالةٌ واحدة كما في رابط
   * الويب (`browseState`)، تُفتح ورقتُها من الرأس وتُطبَّق دفعةً واحدة، والصفوفُ تطلب
   * `/api/v1/discover/{rail,personal}` بالمعاملات نفسِها فتعود مفلترة. رقاقاتُ الفلاتر
   * المحفوظة تطبّق `q` هنا بدل أن تفتح الويب.
   */
  const [browse, setBrowse] = useState<BrowseState>(EMPTY_BROWSE);
  const [sheet, setSheet] = useState(false);
  /* D-994 ⇒ ⚖️ D-1046 (F5): «الكلّ ←» كانت ورقةً سفليّةً بزرّ «المزيد»؛ صارت **شاشةً كاملة** تُدفع فوق «اكتشف»
     بتمريرٍ لا نهائيّ (`SectionScreen`). `see_all` يحمل `/discover/<s>?m=…` فيُحوَّل إلى استعلام القسم كما كان */
  const openAll = useCallback(
    (title: string, path: string) => {
      const m = /^\/discover\/([^/?]+)\??(.*)$/.exec(path);
      if (!m) return;
      const p = new URLSearchParams(m[2] ?? "");
      p.set("s", m[1]);
      router.push({ pathname: "/section", params: { title, query: p.toString(), path } });
    },
    [router],
  );
  const bq = browseQuery(browse);
  /* ⚖️ D-1028 (F4) — `held`/`busy`/`overrides` خرجت من جذر الشاشة: القائمةُ في `HoldHost`، والإطارُ
     الذهبيُّ والخيطُ التفاؤليُّ في `cardStore` تقرؤهما **البطاقةُ المعنيّةُ وحدَها**. كانت ضغطةٌ
     مطوّلةٌ تعيد رسمَ الجذر فاللوح فكلِّ صفّ. المنطقُ نفسُه حرفاً: تفاؤلٌ ثمّ كتابةٌ ثمّ تراجعٌ عند الفشل. */
  const [store] = useState(createCardStore);
  useEffect(() => store.setBase(marks), [store, marks]);
  const holdHost = useRef<HoldHostRef<CuratedCard>>(null);
  /* D-1053 — المخفيُّ في الجلسة مخزنٌ تشترك فيه «اكتشف» و«الكلّ ←» */
  const hidden = useDismissed();
  const hold = useCallback((card: CuratedCard, anchor: CardAnchor) => holdHost.current?.open(card, anchor), []);
  const onHeld = useCallback((c: CuratedCard | null) => store.setHeld(c ? `${c.kind}-${c.id}` : null), [store]);
  /* D-1036 — الأفعالُ نفسُها صارت في `useCardActs` (تقرؤها صفحةُ القائمة الأصليّة أيضاً) */
  const onDismiss = useCallback(
    (key: string, hide: boolean) => {
      if (hide) dismissed.add(key);
      else dismissed.restore(key);
      if (hide) setToast(t.dismissedToast);
    },
    [t, setToast],
  );
  const act = useCardActs<CuratedCard>(store, { onReview: openCard, onError, onDismiss });
  /** بطاقةُ القائمة بشكل `CardItem` — الحقولُ التي تقرؤها `HoldMenu` وحدَها؛ تُحسب لحظةَ الفتح */
  const heldItemOf = useCallback(
    (c: CuratedCard): CardItem => {
      const m = store.mark(`${c.kind}-${c.id}`);
      return { key: `${c.kind}-${c.id}`, kind: c.kind, id: c.id, title: c.title, posterPath: c.poster_path, progress: m?.progress ?? 0, completed: !!m?.completed, dropped: !!m?.dropped };
    },
    [store],
  );
  const inListOf = useCallback((c: CuratedCard) => !!store.mark(`${c.kind}-${c.id}`), [store]);

  /* D-953 → ⚖️ D-961: السحبُ صار انزلاقاً — الإيماءةُ والعتباتُ انتقلت إلى
     `TabSlide` (مصنعٌ واحدٌ تقرؤه المكتبةُ و«اكتشف»)، **والترتيبُ هنا لأنّه
     ترتيبُ هذه الشاشة.** */
  /**
   * 🆕 D-997 — **تفضيلاتُ «عرض»** من `/api/v1/discover/view` (كوكيُّ الويب نفسُه): ترتيبُ
   * التبويبات وإظهارُها يحكمان الشريطَ والانزلاق؛ الصفوفُ المخفيّة تُطوى في اللوح؛ صفوفُك
   * تصل ضمن `personal.myrows` بعد الكتابة. الكتابةُ بالمسارات التي تكتب بها المكتبة
   * (`me/prefs/tabs` · `hidden-rails`) + `my-rows`، وبلس حيث كان.
   */
  const viewQ = useQuery({
    queryKey: ["discover:view"] as const,
    queryFn: async () => (await api<DiscoverViewPayload>("/api/v1/discover/view")).data,
    staleTime: 5 * 60_000,
  });
  const view = viewQ.data ?? null;
  const ALL_TABS: Tab[] = ["shows", "movies", "anime", "lists"];
  const tabsOrder: Tab[] = useMemo(() => {
    const prefs = view?.tabs ?? [];
    const ordered = prefs.filter((p) => !p.hidden && (ALL_TABS as string[]).includes(p.key)).map((p) => p.key as Tab);
    return ordered.length ? ordered : ALL_TABS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const hiddenRails = useMemo(() => new Set(view?.hidden_rails ?? []), [view]);
  /* تبويبٌ أُخفي وأنت فيه: الانتقالُ إلى أوّل ظاهرٍ (كما يفعل الويب بإعادة الرسم) */
  useEffect(() => {
    if (!tabsOrder.includes(tab)) setTab(tabsOrder[0]);
  }, [tabsOrder, tab]);
  const onView = useCallback(
    async (patch: { tabs?: TabPref[]; hidden?: string[]; rows?: MyRow[] }) => {
      /* تفاؤلٌ محلّيّ ثمّ الكتابة — و`needsPlus` يفتح بابَ بلس كما في المكتبة */
      qc.setQueryData<DiscoverViewPayload>(["discover:view"], (prev) => (prev ? { ...prev, ...(patch.tabs ? { tabs: patch.tabs } : {}), ...(patch.hidden ? { hidden_rails: patch.hidden } : {}), ...(patch.rows ? { my_rows: patch.rows } : {}) } : prev));
      try {
        let r: { ok: boolean; needsPlus?: true } = { ok: true };
        if (patch.tabs) r = await write<{ ok: boolean; needsPlus?: true }>("/api/v1/me/prefs/tabs", { surface: "discover", prefs: patch.tabs });
        if (patch.hidden) r = await write<{ ok: boolean; needsPlus?: true }>("/api/v1/me/prefs/hidden-rails", { keys: patch.hidden });
        if (patch.rows) {
          await write<{ ok: boolean }>("/api/v1/me/prefs/my-rows", { rows: patch.rows } satisfies MyRowsBody);
          void qc.invalidateQueries({ queryKey: ["discover:personal"] });
        }
        if (r.needsPlus) {
          void qc.invalidateQueries({ queryKey: ["discover:view"] });
          leaveTo("/plus");
        }
      } catch (e) {
        void qc.invalidateQueries({ queryKey: ["discover:view"] });
        onError(e);
      }
    },
    [qc, leaveTo, onError],
  );
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
    /* D-1028 (F4) — المخزنُ ثابتُ المرجع: السياقُ يوصله ولا يعيد رسمَ أحد */
    <CardStoreContext.Provider value={store}>
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
        {/* D-1022 — شعارُ Loopz يساراً في رؤوس الشاشات الأصليّة كلِّها (طلبُ أحمد) */}
        <View style={{ position: "absolute", start: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}>
          <Logo size={28} />
        </View>
      </View>

      {/* شريطُ التبويبات — عائلةُ segmented نفسُها كما في المكتبة؛ D-1009 — زرُّ الأدوات في طرفه
          كما في المكتبة لا في الرأس (طلبُ أحمد بلقطتين: «مكان الفلتر خلّه جنب كلمة ليست») */}
      <View style={{ flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderBottomColor: tokens.divider, paddingHorizontal: PAGE_PAD }}>
        {tabsOrder.map((k) => {
          const on = k === tab;
          return (
            <Pressable key={k} onPress={() => goTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}>
              <Text size={14} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted}>{tabLabel(k)}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setSheet(true)}
          hitSlop={8}
          accessibilityLabel={t.browseFilters}
          style={{ alignSelf: "center", marginBottom: 4, width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: browseActive(browse) ? tokens.accent : tokens.border, backgroundColor: browseActive(browse) ? tokens.accent : "transparent", alignItems: "center", justifyContent: "center", marginStart: 8 }}
        >
          <Icon name="sliders" size={17} color={browseActive(browse) ? tokens.onAccent : tokens.fg} />
        </Pressable>
      </View>
    </View>
    </Animated.View>

      {/* ⚖️ D-961 → D-965 — اللوحُ ينزلق، **والجارُ يُرسم حيّاً** تحت الإصبع لحظةَ قفل السحب */}
      {openTab !== "lists" ? <OpenMark tab={openTab} onDone={endOpen} /> : null}
      <TabSlide
        order={tabsOrder}
        tab={tab}
        onTab={goTab}
        perfScreen="discover"
        render={(k, active) => (
          <DiscoverPane
            tab={k}
            active={active}
            browse={browse}
            bq={bq}
            onBrowse={setBrowse}
            hiddenRails={hiddenRails}
            hidden={hidden}
            onHold={hold}
            topPad={topH}
            bottomPad={bottomPad}
            onScroll={chrome.onScroll}
            ar={ar}
            onOpen={openCard}
            onLeave={leaveTo}
            onError={onError}
            onToast={setToast}
            onUndoable={undoable}
            onSeeAll={openAll}
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
          /* Phase 11-G — البحثُ أصليّ: تبديلٌ كأخويه لا بابٌ ويبيّ */
          if (k === "search") {
            router.replace("/search");
            return;
          }
          leaveTo(k === "home" ? "/" : "/people");
        }}
      />
      </Animated.View>
      <ToastHost hostRef={toastHost} bottom={navH + 16} />
      {sheet ? (
        <FilterSheet
          tab={tab === "lists" ? "shows" : tab}
          viewOnly={tab === "lists"}
          value={browse}
          view={view}
          onView={(patch) => void onView(patch)}
          onApply={(next) => {
            setBrowse(next);
            setSheet(false);
          }}
          onClose={() => setSheet(false)}
        />
      ) : null}
      <HoldHost hostRef={holdHost} variant="discover" toItem={heldItemOf} inListOf={inListOf} onAction={act} onHeld={onHeld} />
      {leaving ? (
        <View pointerEvents="auto" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
    </View>
    </CardStoreContext.Provider>
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
  browse,
  bq,
  onBrowse,
  hiddenRails,
  hidden,
  onHold,
  topPad,
  bottomPad,
  onScroll,
  ar,
  onOpen,
  onLeave,
  onError,
  onToast,
  onUndoable,
  onSeeAll,
}: {
  tab: Tab;
  /** هل هذا اللوحُ هو النشط؟ الجارُ المسلَّح يُرسم حيّاً لكنّه لا يحمّي مشغّلاً (D-975) */
  active: boolean;
  /** D-992 — الفلترُ النشط واستعلامُه الجاهز، وتبديلُه (الرقاقات) */
  browse: BrowseState;
  bq: string;
  onBrowse: (next: BrowseState) => void;
  /** D-997 — رموزُ الصفوف المخفيّة (`tab:key`) */
  hiddenRails: ReadonlySet<string>;
  /** D-978 — بطاقاتٌ أُخفيت بـ«غير مهتمّ» في هذه الجلسة */
  hidden: ReadonlySet<string>;
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
  /** D-993 — توستٌ من اللوح (قائمةٌ ذكيّةٌ أُنشئت) */
  onToast: (text: string) => void;
  /** D-1047 — فعلٌ يُرى فوراً وتُؤجَّل كتابتُه بإشعار «تراجع» */
  onUndoable: (text: string, commit: () => void, undo: () => void) => void;
  /** D-994 — «الكلّ» لصفٍّ: العنوانُ ومسارُ `see_all` */
  onSeeAll: (title: string, path: string) => void;
}) {
  const { t } = useApp();
  const router = useRouter();
  /* C2 — الصفوفُ الشخصيّة في ردٍّ واحد؛ «لا صفَّ بلا شيءٍ يقوله» (D-219) */
  const railTab: CuratedTab = tab === "lists" ? "shows" : tab;
  const personal = useQuery({
    queryKey: ["discover:personal", railTab, bq] as const,
    queryFn: async () => (await api<PersonalRailsPayload>(`/api/v1/discover/personal?tab=${railTab}${bq ? `&${bq}` : ""}`)).data,
    staleTime: 5 * 60_000,
    enabled: tab !== "lists",
  });
  const ps = personal.data;
  const lists = tab === "lists";
  const filtering = browseActive(browse);
  /* D-997 — الصفوفُ المخفيّة لهذا التبويب بمفاتيح `railPrefs` (top10/top50 تجمع نسختَي الصفّ) */
  const off = tab === "lists" ? new Set<string>() : railsHiddenFor(hiddenRails, tab);
  const railOff = (key: CuratedRailKey): boolean => {
    const anime = tab === "anime";
    const k: RailKey =
      key === "top10-movie" ? (anime ? "top10a-movies" : "top10")
      : key === "top10-tv" ? (anime ? "top10a-shows" : "top10")
      : key === "top50-movie" ? (anime ? "top50a-movies" : "top50")
      : key === "top50-tv" ? (anime ? "top50a-shows" : "top50")
      : key;
    return off.has(k);
  };
  /**
   * 🆕 D-993 — **«احفظ الفلتر» و«قائمة ذكيّة» أصليّان** (تتمّةُ C4): الأوّل يُدرج في
   * `ui_state.filters` عبر `/api/v1/me/prefs/saved-filters` (الخادمُ يقرأ القائمةَ ويُدرج — التطبيقُ
   * لا يحملها)، والثاني `createSmartList(…, "catalog")` عبر `/api/v1/lists/smart-catalog` بالشرط
   * نفسِه الذي يبنيه `SavedFiltersRow` (`q` + `type`). **بلس شرطُهما** كالويب: `needsPlus`
   * يفتح صفحةَ بلس. الضغطُ المطوّل على فلترٍ محفوظ يحذفه (كما في الويب).
   */
  const qc = useQueryClient();
  const [naming, setNaming] = useState<null | "filter" | "smart">(null);
  const [savingName, setSavingName] = useState(false);
  const saveNamed = useCallback(
    async (name: string) => {
      if (!naming || tab === "lists") return;
      setSavingName(true);
      try {
        if (naming === "filter") {
          const r = await write<SavedFilterResult>("/api/v1/me/prefs/saved-filters", { name, section: tab, q: bq } satisfies SavedFilterBody);
          if (r.needsPlus) {
            onLeave("/plus");
            return;
          }
          qc.setQueryData<PersonalRailsPayload>(["discover:personal", railTab, bq], (prev) => (prev ? { ...prev, filters: r.filters.filter((f) => f.section === tab).map((f) => ({ name: f.name, q: f.q })) } : prev));
          void qc.invalidateQueries({ queryKey: ["discover:personal"] });
        } else {
          const type = sectionToRuleType(tab) ?? "all";
          const r = await write<{ id: string | null; needsPlus?: true }>("/api/v1/lists/smart-catalog", { name, rule: { ...Object.fromEntries(new URLSearchParams(bq)), type } } satisfies SmartListBody);
          if (r.needsPlus) {
            onLeave("/plus");
            return;
          }
          onToast(t.listMadeToast(name));
        }
        setNaming(null);
      } catch (e) {
        onError(e);
      } finally {
        setSavingName(false);
      }
    },
    [naming, tab, bq, qc, railTab, onLeave, onError, onToast, t],
  );
  const removeSaved = useCallback(
    (f: { name: string; q: string }) => {
      const key = ["discover:personal", railTab, bq] as const;
      const before = qc.getQueryData<PersonalRailsPayload>(key);
      /* D-1047 — يختفي الآن، ويُكتب بعد مهلة «تراجع»: الرقاقةُ تعود من اللقطة إن ضُغط */
      qc.setQueryData<PersonalRailsPayload>(key, (prev) => (prev ? { ...prev, filters: prev.filters.filter((x) => x.q !== f.q) } : prev));
      onUndoable(
        t.browseRemoveFilter(f.name),
        () => {
          /* الردُّ العامّ يحمل الاسمَ والاستعلامَ لا المعرّف — فالحذفُ بالاستعلام والقسم ويقرّره الخادم */
          write<SavedFilterResult>("/api/v1/me/prefs/saved-filters", { remove: f.q, section: tab } satisfies SavedFilterBody)
            .then(() => void qc.invalidateQueries({ queryKey: ["discover:personal"] }))
            .catch((e) => {
              if (before) qc.setQueryData<PersonalRailsPayload>(key, before);
              onError(e);
            });
        },
        () => {
          if (before) qc.setQueryData<PersonalRailsPayload>(key, before);
        },
      );
    },
    [railTab, tab, bq, qc, onUndoable, onError, t],
  );
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
  /* D-1028 (F4) — كائنٌ محفوظ: كان جديداً في كلِّ رسمة فيكسر `memo` كلِّ صفّ */
  const railProps = useMemo(() => ({ hidden, onHold, onOpen }), [hidden, onHold, onOpen]);
  /* D-994 — أقسامُ «اكتشف» تُفتح ورقةً أصليّة؛ ما سواها (رابطٌ خارج `/discover/`) يبقى باباً */
  const seeAll = (path: string, title: string) => (path.startsWith("/discover/") ? onSeeAll(title, path) : onLeave(path));
  /* D-1044 (F5) — السحبُ يعيد جلبَ صفوف **هذا التبويب وحدَه** (المفاتيحُ تبدأ بالتبويب)؛ «قوائم» لها مفتاحُها */
  const refreshControl = usePullRefresh(
    lists ? [["discover:lists"]] : [["discover:rail", tab], ["discover:personal", tab], ["discover:trailers", tab]],
    topPad,
  );
  return (
    <ScrollView
      refreshControl={refreshControl}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: bottomPad, gap: 24 }}
      showsVerticalScrollIndicator={false}
      contentOffset={{ x: 0, y: memory.y[tab] ?? 0 }}
      onScroll={(e) => { memory.y[tab] = e.nativeEvent.contentOffset.y; onScroll(e); }}
      scrollEventThrottle={16}
    >
      {lists ? <ListsRails onOpenWeb={onLeave} /> : null}
      {/* رقاقاتُ الفلاتر المحفوظة — D-992: تطبّق `q` هنا (كانت تفتح `/news?<q>` باباً) */}
      {!lists && ps && ps.filters.length > 0 && !filtering ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 8 }}>
          {ps.filters.map((f) => (
            <Chip key={f.q} label={f.name} active={false} onPress={() => onBrowse(browseFromQuery(f.q))} onLongPress={() => removeSaved(f)} />
          ))}
        </ScrollView>
      ) : null}
      {/* D-992 — الفلاترُ المفعّلة كما `ActiveFilters` الويب: رقاقةٌ لكلِّ محور بعلامة ×، و«مسح الكلّ» */}
      {!lists && filtering ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 8, alignItems: "center" }}>
          {(Object.keys(browse) as AxisKey[])
            .filter((k) => browse[k] !== null)
            .map((k) => {
              const label = axisValueLabel(k, browse[k] as string | number, ar ? "ar" : "en", [], t);
              return (
                <Chip
                  key={k}
                  label={`${label}  ×`}
                  active
                  onPress={() => onBrowse({ ...browse, [k]: null } as BrowseState)}
                />
              );
            })}
          <Chip label={t.browseClearAll} active={false} onPress={() => onBrowse(EMPTY_BROWSE)} />
          {/* D-993 — «＋ احفظ الفلتر» لا يظهر لفلترٍ محفوظٍ أصلاً (D-217) */}
          {!(ps?.filters ?? []).some((f) => f.q === bq) ? (
            <Chip label={ar ? "＋ احفظ الفلتر" : "＋ Save filter"} active={false} onPress={() => setNaming("filter")} />
          ) : null}
          <Chip label={t.smartListLabel} active={false} onPress={() => setNaming("smart")} />
        </ScrollView>
      ) : null}
      {naming ? (
        <NameSheet
          title={naming === "filter" ? (ar ? "احفظ الفلتر" : "Save filter") : t.smartListLabel}
          placeholder={naming === "filter" ? (ar ? "سمِّ الفلتر" : "Name this filter") : ar ? "سمِّ القائمة الذكيّة" : "Name this smart list"}
          busy={savingName}
          onSubmit={(n) => void saveNamed(n)}
          onClose={() => setNaming(null)}
        />
      ) : null}
      {/* D-958 — صفُّ التريلرات أوّلاً كما في الصفحة (قبل `PersonalRails`)؛ ويصمت بفلترٍ نشط كما في الصفحة */}
      {!lists && !filtering && !off.has("trailers") ? <TrailersRail tab={tab} active={active} onOpenWeb={onLeave} onOpenTitle={(c) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: c.kind, id: String(c.id), from: "discover" } })} onError={onError} /> : null}
      {/* ترتيبُ `PersonalRails`: مقترحٌ لك · صفوفي · (السينما) · من فنّانيك · ثمّ الباقي */}
      {!lists && foryou.length > 0 && !off.has("foryou") ? (
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
        <CardsRail key={`myrow-${m.key}`} title={m.title} icon="sparkle-star" items={m.items} ranked={false} {...railProps} seeAll={m.see_all} onSeeAll={seeAll} />
      )) : null}
      {!lists ? RAILS[tab].filter((key) => !railOff(key)).map((key, i) => (
        <React.Fragment key={`${tab}-${key}`}>
          <Rail tab={tab} railKey={key} bq={bq} {...railProps} onSeeAll={seeAll} ar={ar} />
          {i === 0 && ps && ps.artists.length > 0 && !off.has("artists") ? (
            <CardsRail title={t.artistsRail} icon="people" items={ps.artists} ranked={false} {...railProps} seeAll={ps.artists_see_all} onSeeAll={seeAll} />
          ) : null}
        </React.Fragment>
      )) : null}
    </ScrollView>
  );
}

/**
 * F0 (D-1024) — مراقبُ `discover.open`: **لا يرسم شيئاً ولا يجلب شيئاً**. يعدّ ما يُجلب
 * الآن تحت `discover:rail/<tab>` (`useIsFetching` قراءةٌ للكاش لا مشترِكٌ فيه)، وينادي
 * `onDone` حين لا يبقى جلبٌ وفي الكاش صفٌّ واحدٌ ناجحٌ على الأقلّ. **لماذا لا `useQueries`
 * بمفاتيح الصفوف**: مشترِكٌ بمفتاح صفٍّ مخفيّ (D-997) أو بلا فلترٍ والشاشةُ مفلترة كان
 * سيجلب ما لا تعرضه الشاشة — قياسٌ يثقل ما يقيسه قياسٌ فاسد. ومكوّنٌ مستقلّ كي لا
 * تعيد وصولاتُ الصفوف رسمَ الشاشة كلِّها.
 */
function OpenMark({ tab, onDone }: { tab: CuratedTab; onDone: () => void }) {
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: ["discover:rail", tab] });
  useEffect(() => {
    if (fetching > 0) return;
    const any = qc.getQueryCache().findAll({ queryKey: ["discover:rail", tab] }).some((q) => q.state.status === "success");
    if (any) onDone();
  }, [fetching, qc, tab, onDone]);
  return null;
}

type RailShared = {
  hidden: ReadonlySet<string>;
  onHold: (c: CuratedCard, anchor: CardAnchor) => void;
  onOpen: (c: CuratedCard) => void;
};

/* D-1028 (F4) — `memo`: خاصّيّاتُه كلُّها ثابتةُ المرجع الآن، فرسمةُ اللوح لا تعيد رسمَ صفٍّ لم يتغيّر */
const Rail = memo(function Rail({
  tab,
  railKey,
  bq,
  onSeeAll,
  ar,
  ...shared
}: RailShared & {
  tab: CuratedTab;
  railKey: CuratedRailKey;
  /** D-992 — استعلامُ الفلتر (فارغٌ بلا فلتر) */
  bq: string;
  onSeeAll: (path: string, title: string) => void;
  ar: boolean;
}) {
  const { t, tokens } = useApp();
  const q = useQuery({
    queryKey: ["discover:rail", tab, railKey, bq] as const,
    queryFn: async () => (await api<CuratedRailPayload>(`/api/v1/discover/rail?tab=${tab}&key=${railKey}${bq ? `&${bq}` : ""}`)).data,
    staleTime: 10 * 60_000,
  });
  const p = q.data;
  const anime = tab === "anime";
  /* عنوانُ الصفّ كما تكتبه الصفحة — المفاتيحُ نفسُها من القاموس الواحد (والأنمي بعناوينه) */
  /* D-992 — عنوانٌ يفرضه الخادم (صفُّ الجائزة باسمها) يسبق عنوانَ المفتاح */
  const title = p?.title ? p.title :
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
});

/** الرفُّ المرسوم — عنوانٌ بأيقونةٍ و«الكل» وسطرُ ملاحظةٍ ثمّ `FlatList` أفقيّ (نسخةُ `RankedRail`) */
const cardKey = (c: CuratedCard) => `${c.kind}-${c.id}`;
/* عرضُ البطاقة ثابت ⇒ الموضعُ يُحسب ولا يُقاس؛ الحشوةُ قبل أوّل بطاقة */
const cardLayout = (_: unknown, index: number) => ({ length: RAIL_CARD_W + GAP, offset: PAGE_PAD + (RAIL_CARD_W + GAP) * index, index });

const CardsRail = memo(function CardsRail({
  title,
  icon,
  note,
  items,
  ranked,
  hidden,
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
  onSeeAll?: (path: string, title: string) => void;
  /** «مقترحٌ لك»: سطرُ السبب تحت كلِّ بطاقة */
  notes?: boolean;
  /** فعلُ الصفّ في طرف العنوان (رقاقةٌ بحدٍّ كـ«اقتراحات أخرى» الويب) — بدل «الكلّ» */
  action?: { label: string; aria: string; icon: Parameters<typeof Icon>[0]["name"]; onPress: () => void } | null;
}) {
  const { t, tokens } = useApp();
  const shown = useMemo(() => (hidden.size === 0 ? items : items.filter((c) => !hidden.has(`${c.kind}-${c.id}`))), [items, hidden]);
  /* D-1028 (F4) — `renderItem` ثابتة، وبلا `extraData`: الإطارُ والخيطُ تقرؤهما البطاقةُ من
     `cardStore` بنفسها، فلا سببَ يعيد مرورَ القائمة على بطاقاتها عند ضغطةٍ مطوّلة */
  const renderItem = useCallback(
    ({ item, index }: { item: CuratedCard & { note?: string | null }; index: number }) => (
      <RailCard card={item} rank={ranked ? index + 1 : null} lib={null} onPress={onOpen} note={notes ? item.note ?? null : null} onHold={onHold} />
    ),
    [ranked, notes, onOpen, onHold],
  );
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
          <Pressable onPress={() => onSeeAll(seeAll, title)} hitSlop={8}>
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
        keyExtractor={cardKey}
        renderItem={renderItem}
        getItemLayout={cardLayout}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}
        initialNumToRender={5}
        windowSize={5}
      />
    </View>
  );
});

