import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, FlatList, Platform, Pressable, ScrollView, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, qk, queryClient, write, ApiError } from "../api";
import { useApp } from "../state";
import { shell } from "../shell";
import { Button, Text, Toast } from "../ui";
import { radius, space } from "../theme";
import { PosterCard, type CardAnchor, type CardItem } from "./PosterCard";
import { HoldMenu, type HoldAction } from "./HoldMenu";
import { ToolsSheet, type LibrarySort } from "./ToolsSheet";
import { ArtistsTab } from "./ArtistsTab";
import { ListsTab } from "./ListsTab";
import { TabSlide } from "../TabSlide";
import { useChromeHide } from "../ChromeHide";
import { BottomNav, navHeight } from "../BottomNav";
import { OneTimeHint } from "./OneTimeHint";
import { Icon } from "../icons";
import { byTitle, normalizeSearch } from "@/core/arabic";
import { guardLastVisible, type TabPref } from "@/core/tabPrefs";
import type { LibraryItem, LibraryPayload, LibraryStatus, LibraryTab, ShowRefBody, SetDroppedBody, ToggleMovieBody, HiddenRailsBody } from "../contracts";

/**
 * ====== المكتبةُ أصليّةً — تجربةُ المقارنة (Phase 11 · B2، D-936) ======
 *
 * 🔑 **الشكلُ شكلُ `/library` في الويب بالبكسل، والمنطقُ منطقُه بالحرف**:
 * البياناتُ من `/api/v1/me/library` **بالحالة محسوبةً في الخادم** (الوصفةُ
 * الواحدة `core/libraryStatus.ts` — D-876) **والعنوانُ والملصقُ كما تعرضهما
 * الصفحة** (`display_title` · `display_poster_path` — قرارُ المراجع على B0).
 * **لا ترجمةَ ولا نداءَ TMDB من الشاشة**: فرقٌ يُقاس في B5 هو فرقُ تصييرٍ لا شبكة.
 *
 * 📐 **المقاسات — كلُّها بأسماء الويب** (B0 §٣): الترويسةُ `--header-h` ٦٤ ·
 * حشوةُ الصفحة `px-4` ١٦ · التبويباتُ `segmentedItem` (`pt-2 pb-3 text-14`،
 * خطٌّ سفليٌّ ٣ بلون التمييز على `--divider`) · فاصلُ الرفوف `space-y-7` ٢٨ ·
 * رأسُ الرفّ `text-22 font-bold` ثمّ `mb-1` · صفٌّ أفقيٌّ `gap-3` بعرض
 * `--poster-w` ١١٨ · **والشبكةُ المفتوحة `auto-fill minmax(96px,1fr) gap-3`**
 * — **الأعمدةُ تُحسب بالمعادلة نفسِها لا برقمٍ ثابت** (G1).
 *
 * 🔑 **التجميعُ بالحالة كما في الفرز «ذكيّ»** (G2): كلُّ حالةٍ رفٌّ أفقيٌّ
 * بعنوانٍ قابلٍ للطيّ — مغلقاً صفٌّ يُسحب، ومفتوحاً شبكةٌ كاملة، **ورفٌّ
 * بعنصرٍ واحدٍ يُرسم عنصراً لا صفّاً** (D-…: «إزالة الفراغ عند عمل واحد»).
 * والترتيبُ داخل التبويب ترتيبُ الصفحة: جارٍ ⇢ لم يبدأ ⇢ مكتمل ⇢ موقوف،
 * والجاري بتقدّمه تنازليّاً.
 *
 * 🆕 **D-947 — المكتبةُ كاملةً** (حكمُ أحمد: «كمّل بناءَ المكتبة بالكامل مثل
 * الليست وغيرها»): **التبويباتُ الخمسة** بترتيب صاحبها وإخفائه (`tabs` من
 * الردّ — كوكي `TabsPrefs` نفسُه) وعدّاداتُها (`PageTabs`: الاسمُ ورقمٌ
 * `text-12` بجانبه)، **والشريطُ يمرّر أفقيّاً حين لا يسع** (وصفةُ `PageTabs`:
 * `flex-1 shrink-0` — لا قصَّ لاسم). «فنّانون» في `ArtistsTab` و«قوائم» في
 * `ListsTab` **ببياناتٍ من مسارَيهما ولا تُجلب قبل فتحهما** (D-128/D-350:
 * الثقيلُ مشروطٌ بتبويبه). **وتصنيفُ الأنمي غيرِ المصنَّف يُطلق مرّةً عند فتح
 * تبويبه** كالويب (يسدّ KNOWN_GAP-12)، **وورقةُ الأدوات تحمل تبويبَ «عرض»**
 * (ترتيبُ التبويبات · صفوفُ الصفحة — يسدّ KNOWN_GAP-8).
 *
 * ⚠️ **ما بقي معلَناً**: كثافةُ الملصقات من تفضيل صاحبها (`home_prefs.density`
 * — الافتراضيُّ `comfortable` ١١٨، KNOWN_GAP-13) · طابورُ الأوفلاين
 * (KNOWN_GAP-14) · **وأبوابُ الأشكال الثقيلة في الويب** (نموذجُ الشروط
 * الذكيّة · ورقةُ ترتيب الطابور · إعلانُ قائمةٍ خاصّة — انظر `ListsTab`).
 *
 * 🆕 **B3 — الأفعالُ من قائمة الضغط المطوَّل، تفاؤليّةٌ بارتداد** (كما
 * `runOrQueue` في الويب، بلا طابورِ أوفلاين — KNOWN_GAP-14): الحمولةُ في
 * كاش `me:library` تُعدَّل فوراً بالوصفة نفسِها (`showStatusOf`/`movieStatusOf`
 * محسوبتان هنا من `watched/aired` لا حالةٌ مخمَّنة)، ثمّ `write()` ينادي
 * `/api/v1/track/*` ويُبطل الوسومَ فيُعاد الجلبُ ويستوي الاثنان؛ **وعند
 * الخطأ يُعاد الجلبُ فوراً وتُقال الرسالةُ** (مفتاحُ الخطأ من الخادم
 * بلغة الجهاز — كما يترجمها الويب).
 *
 * 🔁 **الضغطُ على بطاقةٍ يفتح العملَ في الـWebView** (لا صفحةَ عملٍ أصليّة —
 * التجربةُ شاشةٌ واحدة): يُوجَّه المتصفّحُ إلى `/show/:id` **ثمّ تُغلق هذه
 * الشاشة** — فالرجوعُ من العمل يعود إلى ما كان قبل المكتبة في تاريخ الويب.
 */
const HEADER_H = 64;
const PAGE_PAD = 16;
const GAP = 12;
const MIN_COL = 96;
const RAIL_W = 118;
const STATUS_ORDER: LibraryStatus[] = ["watching", "unstarted", "completed", "dropped"];

type Tab = LibraryTab;

/**
 * ذاكرةُ الشاشة بين فتحتين (G8 · V3): الويبُ يحفظ التبويبَ في الرابط وموضعَ
 * التمرير في `ScrollMemory`؛ هنا الشاشةُ تُنزع عند فتح عملٍ وتُعاد من زرّ
 * المكتبة، **فتُحفظ في متغيّرِ وحدةٍ** — عقدُ المالك: الرجوعُ لا يقفز إلى الأعلى.
 */
/* D-965 — موضعُ التمرير **لكلِّ تبويب**: الجارُ المسلَّح يُرسم بموضعه هو، لا بموضع النشط */
const memory: { tab: Tab | null; open: LibraryStatus[]; y: Partial<Record<Tab, number>> } = { tab: null, open: [], y: {} };

export function LibraryScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const navH = navHeight(insets.bottom);

  const data = useQuery({
    queryKey: qk.tag("me:library"),
    queryFn: async () => (await api<LibraryPayload>("/api/v1/me/library")).data,
  });

  const [tab, setTab] = useState<Tab | null>(memory.tab);
  const activeTab: Tab = tab ?? data.data?.default_tab ?? "shows";
  const [open, setOpen] = useState<Set<string>>(() => new Set(memory.open));
  useEffect(() => {
    memory.tab = tab;
    memory.open = [...open] as LibraryStatus[];
  }, [tab, open]);
  const [held, setHeld] = useState<{ item: CardItem; anchor: CardAnchor } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /* B4 — أدواتُ الصفحة: بحثٌ وترتيبٌ ومفضّلة (حالةُ الشاشة كما في `LibraryGrid`) */
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<LibrarySort>("smart");
  const [fav, setFav] = useState(false);
  const [tools, setTools] = useState(false);

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

  /* 🆕 D-951 — **الخروجُ إلى صفحةٍ ويبيّة يُغلق الشاشةَ بعد وصولها لا قبله**:
     `shell.open` تعِد بالوصول (أو بمهلة)، والشاشةُ تبقى فوق الـWebView حتّى
     يُحلّ الوعد — فلا تظهر الرئيسيّةُ لجزءٍ من الثانية. و`leaving` يحجب ضغطةً
     ثانيةً في أثناء الانتظار ويُظهر مؤشّراً خفيفاً إن طالت الشبكة. */
  const [leaving, setLeaving] = useState(false);
  const leaveTo = useCallback(
    (path: string) => {
      if (leaving) return;
      setLeaving(true);
      void shell.open(path, { returnTo: "library" }).then(back);
    },
    [leaving, back],
  );

  /* D-956 — صفحةُ العمل أصليّةٌ الآن: دفعٌ في المكدّس لا بابٌ ويبيّ؛ المكتبةُ تبقى تحتها */
  const openTitle = useCallback(
    (item: CardItem) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: item.kind, id: String(item.id), from: "library" } }),
    [router],
  );

  const hold = useCallback((item: CardItem, anchor: CardAnchor) => setHeld({ item, anchor }), []);

  /** تعديلُ الكاش تفاؤليّاً — الوصفةُ الواحدة للحالة (D-876) تُعاد هنا من الرقمين */
  const patch = useCallback((key: string, fn: (x: LibraryItem) => LibraryItem) => {
    queryClient.setQueryData<LibraryPayload>(qk.tag("me:library"), (prev) => {
      if (!prev) return prev;
      const items = prev.items.map((x) => (`${x.kind === "tv" ? "tv" : "mv"}-${x.id}` === key ? fn(x) : x));
      const counts = { watching: 0, unstarted: 0, completed: 0, dropped: 0 } as LibraryPayload["counts"];
      for (const x of items) counts[x.status] += 1;
      return { ...prev, items, counts };
    });
  }, []);

  const act = useCallback(
    async (a: HoldAction) => {
      const h = held;
      if (!h) return;
      const { item } = h;
      setHeld(null);
      if (a === "review") {
        openTitle(item);
        return;
      }
      const isTv = item.kind === "tv";
      const statusOf = (x: LibraryItem, watched: number, dropped: boolean): LibraryStatus => {
        if (dropped) return "dropped";
        if (!isTv) return watched > 0 ? "completed" : "unstarted";
        const aired = x.aired;
        const w = Math.min(watched, aired || Infinity);
        if (aired > 0 && w >= aired && w > 0) return "completed";
        return w > 0 ? "watching" : "unstarted";
      };
      setBusy(true);
      try {
        if (a === "drop" || a === "resume") {
          const dropped = a === "drop";
          patch(item.key, (x) => ({ ...x, status: statusOf(x, x.watched, dropped) }));
          await write<unknown>("/api/v1/track/dropped", { tmdbId: item.id, mediaType: item.kind, dropped } satisfies SetDroppedBody);
        } else if (a === "next") {
          patch(item.key, (x) => ({ ...x, watched: x.watched + 1, status: statusOf(x, x.watched + 1, false) }));
          await write<unknown>("/api/v1/track/next-episode", { showTmdbId: item.id } satisfies ShowRefBody);
        } else if (a === "rewatch") {
          patch(item.key, (x) => ({ ...x, watched: 0, rewatch_count: x.rewatch_count + 1, status: statusOf(x, 0, false) }));
          await write<unknown>("/api/v1/track/rewatch", { showTmdbId: item.id } satisfies ShowRefBody);
        } else if (a === "all") {
          if (isTv) {
            patch(item.key, (x) => ({ ...x, watched: x.aired, status: statusOf(x, x.aired, false) }));
            await write<unknown>("/api/v1/track/show-watched", { showTmdbId: item.id } satisfies ShowRefBody);
          } else {
            patch(item.key, (x) => ({ ...x, watched: 1, status: "completed" }));
            await write<unknown>("/api/v1/track/movie", { movieTmdbId: item.id, runtime: null, watched: true } satisfies ToggleMovieBody);
          }
        }
      } catch (e) {
        void queryClient.invalidateQueries({ queryKey: qk.tag("me:library") });
        const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
        const msg = (t as unknown as Record<string, unknown>)[key];
        setToast(typeof msg === "string" ? msg : t.apiInternal);
      } finally {
        setBusy(false);
      }
    },
    [held, openTitle, patch, t],
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  /* بناءُ بطاقات التبويب — الوصفةُ في `library/page.tsx`: التقدّمُ من
     `watched/aired`، والعدُّ المتبقّي حين بدأ ولم يكتمل ولم يُوقَف. */
  const hasFav = useMemo(() => (data.data?.items ?? []).some((x) => x.is_favorite === true), [data.data]);
  /* القائمةُ والتجميعُ صارا في `LibraryPane` (D-965): لوحٌ لكلِّ تبويب، والجارُ يُرسم حيّاً بجانب النشط */

  const inner = screenW - PAGE_PAD * 2;
  const cols = Math.max(1, Math.floor((inner + GAP) / (MIN_COL + GAP)));
  const cellW = Math.floor((inner - GAP * (cols - 1)) / cols);

  const sortLabel = sort === "added" ? t.sortAdded : sort === "title" ? t.sortTitle : sort === "progress" ? t.sortProgress : t.sortSmart;
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(q.trim() ? [{ key: "q", label: `${t.librarySearchGroup}: ${q.trim()}`, remove: () => setQ("") }] : []),
    ...(fav && hasFav ? [{ key: "fav", label: t.profileFavoritesRail, remove: () => setFav(false) }] : []),
    ...(sort !== "smart" ? [{ key: "sort", label: sortLabel, remove: () => setSort("smart") }] : []),
  ];
  const toolsOn = (q.trim() ? 1 : 0) + (sort !== "smart" ? 1 : 0);

  /* D-947 — الخمسةُ بعدّاداتها كما في `LibraryGrid` (`shows.length` بعد قاطع
     D-946 · `artistCount` · `lists + saved`)، بترتيب صاحبها، والمخفيُّ يغيب
     إلّا إن كان المفتوح (`applyTabPrefs` حرفاً). */
  const allItems = data.data?.items ?? [];
  const nOf = (k: Tab) =>
    k === "shows"
      ? allItems.filter((x) => x.kind === "tv" && x.is_anime !== true).length
      : k === "movies"
        ? allItems.filter((x) => x.kind === "movie" && x.is_anime !== true).length
        : k === "anime"
          ? allItems.filter((x) => x.is_anime === true).length
          : k === "artists"
            ? (data.data?.artist_count ?? 0)
            : (data.data?.list_count ?? 0);
  const labelOf = (k: Tab) =>
    k === "shows" ? t.shortShows : k === "movies" ? t.shortMovies : k === "anime" ? t.discoverTabAnime : k === "artists" ? t.shortArtists : t.listsTitle;
  const tabPrefs: TabPref[] = data.data?.tabs ?? (["shows", "movies", "anime", "artists", "lists"] as Tab[]).map((key) => ({ key, hidden: false }));
  const tabs: { key: Tab; label: string; n: number }[] = tabPrefs
    .filter((p) => !p.hidden || p.key === activeTab)
    .map((p) => ({ key: p.key as Tab, label: labelOf(p.key as Tab), n: nOf(p.key as Tab) }));
  const tabLabels = Object.fromEntries(tabPrefs.map((p) => [p.key, labelOf(p.key as Tab)]));
  const coreTab = activeTab === "shows" || activeTab === "movies" || activeTab === "anime";
  const hiddenRails = data.data?.hidden_rails ?? [];

  /* 🆕 D-953 — **السحبُ الأفقيُّ في الفراغ ينقل التبويب** (فكرةُ أحمد بتسجيل:
     «إذا حرّكت إصبعي في المكان الفاضي بين watching وnot started… ينتقل من
     shows إلى movies»). خيارٌ ثانٍ بجانب الضغط، لا بديلٌ عنه.
     🔑 **لماذا «الفراغُ» تحديداً ولا `PagerView`**: صفوفُ الحالات المطويّة
     تتمرّر أفقيّاً، وصفحةٌ تنزلق كاملةً تسرق سحبَها. فالحكمُ لنظام المستجيب
     نفسِه: الصفُّ الأفقيُّ يستولي على السحب أصليّاً بعد ٨ بكسل (Android)،
     **ونحن لا نسأل قبل ٢٠ بكسل** — فما وصلنا فهو سحبٌ لم يُرِده أحد.
     والقائمةُ العموديّة لا تعترض الأفقيّ. **والاتّجاهُ اتّجاهُ القراءة**: التالي
     في جهة النهاية (RTL: السحبُ يميناً = التالي). التبويباتُ المخفيّة لا تُزار. */
  /* ⚖️ D-961 — الإيماءةُ نفسُها (عتباتُ D-953) انتقلت إلى `TabSlide`، **ومعها
     صار للانتقال حركة**: `setTab` تبقى بابَ التبديل الوحيد، تُنادى من الضغطة
     ومن السحب معاً. */
  const tabsOrder = useMemo(() => tabs.map((x) => x.key), [tabs]);

  /* D-966 — الكسوةُ الذكيّة: الرأسُ (بتبويباته وأدواته) والشريطُ يختبئان مع النزول
     ويعودان مع الرجوع — حدودُ `ChromeAutoHide` الويب حرفاً. **الورقةُ كلُّها** (رأسٌ +
     ألواح) تصعد بارتفاع الرأس وتمتدّ تحت الشاشة بمقداره، فلا يتغيّر ارتفاعُ شيءٍ ولا
     يقفز المحتوى؛ وذيلُ التمرير يزيد بالمقدار نفسِه. وقلبُ التبويب يُعيد الكسوةَ
     (بابُ `reveal` — درسُ D-524). */
  const chrome = useChromeHide();
  /* تقديرٌ أوّليٌّ قبل القياس (ترويسة + تبويبات + صفُّ الأدوات) — فلا يقفز المحتوى في أوّل إطار */
  const [topH, setTopH] = useState(insets.top + HEADER_H + 46 + 60);
  const bottomPad = navH + 24;
  const { reveal } = chrome;
  useEffect(() => {
    reveal();
  }, [activeTab, reveal]);

  /* تفضيلاتُ العرض تُكتب في الخادم (كوكي) وتُبطل `me:library` فيعود الردُّ بها؛
     والحارسُ (بلس) هناك — `needsPlus` يفتح بابَ «بلس» في الويب. */
  const savePrefs = useCallback(
    async (path: string, body: unknown) => {
      try {
        const r = await write<{ ok: boolean; needsPlus?: true }>(path, body);
        if (r.needsPlus) leaveTo("/plus");
      } catch (e) {
        const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
        const msg = (t as unknown as Record<string, unknown>)[key];
        setToast(typeof msg === "string" ? msg : t.apiInternal);
      }
    },
    [leaveTo, t],
  );
  const openWeb = leaveTo;

  /* تصنيفُ ما لم يُصنَّف — مرّةً، عند من فتح التبويب (D-182)، كما في `LibraryGrid` */
  const [classifying, setClassifying] = useState(false);
  const askedRef = useRef(false);
  const animeUnknown = data.data?.anime_unknown ?? 0;
  useEffect(() => {
    if (activeTab !== "anime" || animeUnknown <= 0 || askedRef.current) return;
    askedRef.current = true;
    setClassifying(true);
    write<{ classified: number }>("/api/v1/me/library/classify-anime", {})
      .catch(() => null)
      .finally(() => setClassifying(false));
  }, [activeTab, animeUnknown]);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
    {/* ⚖️ D-969 — **الرأسُ وحدَه يتحرّك والمحتوى ثابت** (بلاغُ أحمد بتسجيل على 1.8.2: «في الهوم
        الدوك سلس… في اكتشف والمكتبة أبغى نفس السلاسة»): D-966 رفعت الورقةَ كلَّها بارتفاع الرأس
        فقفز المحتوى معه — **والويبُ يحرّك الكسوةَ فقط والمحتوى يظهر من تحتها** (`transform`
        على `.chrome-top` وحدَه). فالرأسُ مطلقٌ فوق الألواح، والألواحُ تملأ الشاشةَ وتبدأ
        بحشوةٍ علويّة بارتفاعه — ما مرّ تحته يظهر حين يختبئ، كما في الويب حرفاً. */}
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
      {/* الترويسة: `header` ٦٤ بحدٍّ سفليّ `border-border`، الاسمُ في المنتصف `text-15 font-bold` */}
      <View
        style={{
          height: HEADER_H,
          borderBottomWidth: 1,
          borderBottomColor: tokens.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* ⚖️ D-980 — بلا سهمِ رجوع: الشريطُ السفليّ (D-961) هو المخرج كما في صفحة الويب،
            والسهمُ كان بقيّةَ زمنٍ لم يكن فيه شريط؛ زرُّ النظام للرجوع يبقى (`back`). */}
        <Text size={15} weight="700">{t.libraryTitle}</Text>
      </View>

      {/* التبويباتُ الثلاثة — عائلةُ segmented الواحدة، وزرُّ الأدوات في طرفها (`FilterIconButton`: `h-9 w-9 rounded-full border`) */}
      <View style={{ flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderBottomColor: tokens.divider, paddingHorizontal: PAGE_PAD }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: "stretch" }}>
        {tabs.map((tb) => {
          const on = tb.key === activeTab;
          return (
            <Pressable
              key={tb.key}
              onPress={() => setTab(tb.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{ flexGrow: 1, flexShrink: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 8, paddingBottom: 12, paddingHorizontal: 12 }}
            >
              <Text size={14} weight="600" color={on ? tokens.fg : tokens.muted}>{tb.label}</Text>
              <Text size={12} color={on ? tokens.accent : tokens.muted + "B3"} style={{ fontVariant: ["tabular-nums"] }}>{String(tb.n)}</Text>
              {on ? (
                <View
                  style={{
                    position: "absolute",
                    bottom: -1,
                    left: 0,
                    right: 0,
                    height: 3,
                    borderTopLeftRadius: radius.pill,
                    borderTopRightRadius: radius.pill,
                    backgroundColor: tokens.accent,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
        </ScrollView>
        <Pressable
          onPress={() => setTools(true)}
          accessibilityLabel={t.libraryToolsTitle}
          style={{ alignSelf: "center", marginBottom: 4, width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center", marginStart: 8 }}
        >
          <Icon name="sliders" size={16} color={toolsOn > 0 ? tokens.fg : tokens.muted} />
          {toolsOn > 0 ? (
            <View style={{ position: "absolute", top: -4, end: -4, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: tokens.elevated, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
              <Text size={10} weight="800">{String(toolsOn)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* رقاقاتُ «ما اخترتَه» (`ActiveFilterChips`، عائلةُ chip): بحث · مفضّلة · ترتيب — قابلةٌ للإزالة، و«مسح الكل» */}
      {coreTab && chips.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingHorizontal: PAGE_PAD, paddingTop: 12, paddingBottom: 8 }}>
          {chips.map((c) => (
            <Pressable
              key={c.key}
              onPress={c.remove}
              accessibilityLabel={t.browseRemoveFilter(c.label)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.accent + "66", backgroundColor: tokens.accent + "1A" }}
            >
              <Text size={14} weight="600" color={tokens.accent} numberOfLines={1} style={{ maxWidth: 224 }}>{c.label}</Text>
              <Icon name="close" size={12} color={tokens.accent} />
            </Pressable>
          ))}
          <Pressable onPress={() => { setQ(""); setSort("smart"); }} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border }}>
            <Text size={12} weight="600" muted>{t.browseClearAll}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* خانةٌ تحت الشريط (D-453/D-671): «الإحصائيات» و«النشاط» بابان إلى الويب، والقلبُ مِصفاةٌ لمن له مفضّلة — **وتغيب في تبويب القوائم** (D-832) */}
      {activeTab !== "lists" ? (
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: PAGE_PAD, marginTop: 12 }}>
        {(
          [
            { path: "/stats", icon: "chart", label: t.statsPageTitle },
            { path: "/activity", icon: "clock", label: t.activityTitle },
          ] as const
        ).map((b) => (
          <Pressable
            key={b.path}
            onPress={() => leaveTo(b.path)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}
          >
            <Icon name={b.icon} size={17} color={tokens.accent} />
            <Text size={14} weight="700">{b.label}</Text>
          </Pressable>
        ))}
        {hasFav && coreTab ? (
          <Pressable
            onPress={() => setFav((v) => !v)}
            accessibilityRole="togglebutton"
            accessibilityState={{ checked: fav }}
            accessibilityLabel={t.profileFavoritesRail}
            style={{ paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: fav ? tokens.accent : tokens.border, backgroundColor: fav ? tokens.accent + "1A" : tokens.surface }}
          >
            <Icon name={fav ? "heart-filled" : "heart"} size={19} color={tokens.accent} />
          </Pressable>
        ) : null}
      </View>
      ) : null}
    </View>
    </Animated.View>

      {/* D-965 — لوحٌ لكلِّ تبويب: `TabSlide` يرسم النشطَ، ويسلّح الجارَ حيّاً عند قفل السحب */}
      <TabSlide
        order={tabsOrder}
        tab={activeTab}
        onTab={setTab}
        render={(k) =>
          k === "artists" ? (
            <ArtistsTab onOpenWeb={openWeb} topPad={topH} bottomPad={bottomPad} onScroll={chrome.onScroll} />
          ) : k === "lists" ? (
            <ListsTab hiddenRails={hiddenRails} onOpenWeb={openWeb} say={setToast} topPad={topH} bottomPad={bottomPad} onScroll={chrome.onScroll} />
          ) : (
            <LibraryPane
              tab={k}
              data={data}
              q={q}
              sort={sort}
              fav={fav && hasFav}
              open={open}
              setOpen={setOpen}
              cols={cols}
              cellW={cellW}
              topPad={topH}
              bottomPad={bottomPad}
              onScroll={chrome.onScroll}
              classifying={k === "anime" && classifying}
              onOpen={openTitle}
              onHold={hold}
              onClearSearch={() => setQ("")}
              onLeave={leaveTo}
            />
          )
        }
      />
      {/* D-961 — الشريطُ الخماسيُّ كما في كلِّ صفحةٍ ويبيّة؛ «المكتبة» هي الخانةُ المضيئة — D-966: يهبط بارتفاعه مع النزول */}
      <Animated.View style={{ position: "absolute", left: 0, right: 0, bottom: 0, transform: [{ translateY: Animated.multiply(chrome.hidden, navH) }] }}>
      <BottomNav
        active="library"
        onGo={(k) => {
          if (k === "library") return;
          if (k === "news") {
            router.replace("/discover");
            return;
          }
          leaveTo(k === "home" ? "/" : k === "people" ? "/people" : "/search");
        }}
      />
      </Animated.View>
      {tools ? (
        <ToolsSheet
          q={q}
          onQ={setQ}
          sort={sort}
          onSort={setSort}
          showFilters={coreTab}
          tabs={tabPrefs}
          tabLabels={tabLabels}
          onTabs={(next) => {
            const clean = guardLastVisible(next);
            queryClient.setQueryData<LibraryPayload>(qk.tag("me:library"), (prev) => (prev ? { ...prev, tabs: clean as LibraryPayload["tabs"] } : prev));
            void savePrefs("/api/v1/me/prefs/tabs", { surface: "library", prefs: clean });
          }}
          hiddenRails={hiddenRails}
          onRails={(keys) => {
            queryClient.setQueryData<LibraryPayload>(qk.tag("me:library"), (prev) => (prev ? { ...prev, hidden_rails: keys } : prev));
            void savePrefs("/api/v1/me/prefs/hidden-rails", { keys } satisfies HiddenRailsBody);
          }}
          onClose={() => setTools(false)}
        />
      ) : null}
      {held ? <HoldMenu item={held.item} anchor={held.anchor} busy={busy} onAction={(a) => void act(a)} onClose={() => setHeld(null)} /> : null}
      {leaving ? (
        /* D-951 — حجابٌ يمنع ضغطةً ثانية، ومؤشّرٌ صغيرٌ فوق المكتبة حتّى تصل الصفحة (أقلّ من ثانية عادةً) */
        <View pointerEvents="auto" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
      {toast ? <Toast text={toast} bottom={navH + 16} /> : null}
    </View>
  );
}

/**
 * لوحُ تبويبٍ أساسيّ (مسلسلات · أفلام · أنمي) — D-965. **كلُّ ما يخصّ تبويباً
 * واحداً يعيش هنا** (المصافي والترتيب والتجميع وموضعُ التمرير)، فيستطيع
 * `TabSlide` أن يرسم لوحين جنباً إلى جنب في أثناء السحب. **البياناتُ واحدةٌ**
 * (`me:library` محمّلةٌ أصلاً) فالجارُ يُرسم فوراً بلا نداء.
 */
function LibraryPane({
  tab,
  data,
  q,
  sort,
  fav,
  open,
  setOpen,
  cols,
  cellW,
  topPad,
  bottomPad,
  onScroll,
  classifying,
  onOpen,
  onHold,
  onClearSearch,
  onLeave,
}: {
  tab: Tab;
  data: { data?: LibraryPayload; isLoading: boolean; isError: boolean; refetch: () => unknown };
  q: string;
  sort: LibrarySort;
  /** المصفاةُ فعّالةٌ فقط حين لصاحبها مفضّلة (`fav && hasFav` عند المنادي) */
  fav: boolean;
  open: Set<string>;
  setOpen: React.Dispatch<React.SetStateAction<Set<string>>>;
  cols: number;
  cellW: number;
  /** ارتفاعُ الرأس المطلق فوق اللوح (D-969) — يُحشى به أوّلُ المحتوى لا اللوحُ نفسُه */
  topPad: number;
  bottomPad: number;
  /** الكسوةُ الذكيّة تقرأ التمرير (D-966) */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  classifying: boolean;
  onOpen: (item: CardItem) => void;
  onHold: (item: CardItem, anchor: CardAnchor) => void;
  onClearSearch: () => void;
  onLeave: (path: string) => void;
}) {
  const { t, locale } = useApp();
  /** القائمةُ بعد المصافي والترتيب — الوصفةُ في `LibraryGrid.tsx` (`items`) حرفاً */
  const list = useMemo(() => {
    const items = data.data?.items ?? [];
    /* 🆕 D-946 — **الأنمي في تبويبه وحدَه**: المعلَّمُ أنمياً يخرج من
       «مسلسلاتي» و«أفلامي»؛ وغيرُ المصنَّف (`null`) يبقى في تبويبه الأصليّ.
       **الوصفةُ حرفاً كما في `library/page.tsx`** (B5: تكافؤٌ لا تقريب). */
    const inTab = items.filter((x) =>
      tab === "anime"
        ? x.is_anime === true
        : x.is_anime !== true && (tab === "shows" ? x.kind === "tv" : x.kind === "movie"),
    );
    const byFav = fav ? inTab.filter((x) => x.is_favorite === true) : inTab;
    const needle = normalizeSearch(q);
    const filtered = needle ? byFav.filter((x) => normalizeSearch(x.display_title ?? x.title).includes(needle)) : byFav;
    const rank = (st: LibraryStatus) => STATUS_ORDER.indexOf(st);
    const rows = filtered.map((x, i) => ({ c: toCard(x), x, i }));
    if (sort === "added") rows.sort((a, b) => b.x.added_at.localeCompare(a.x.added_at));
    else if (sort === "title") {
      const cmp = byTitle(locale === "en" ? "en" : "ar");
      rows.sort((a, b) => cmp(a.c.title, b.c.title));
    } else if (sort === "progress")
      rows.sort((a, b) => (a.c.progress >= 100 ? 1 : 0) - (b.c.progress >= 100 ? 1 : 0) || b.c.progress - a.c.progress);
    else rows.sort((a, b) => rank(a.x.status) - rank(b.x.status) || (a.x.status === "watching" ? b.c.progress - a.c.progress : 0) || a.i - b.i);
    return rows;
  }, [data.data, tab, fav, q, sort, locale]);

  /* التجميعُ بالحالة في الفرز «ذكيّ» بلا بحث فقط (G2/G3) — غيرُه شبكةٌ مسطّحة */
  const grouped = sort === "smart" && !q.trim();
  const groups = useMemo(() => {
    if (!grouped) return [] as { status: LibraryStatus; items: CardItem[] }[];
    const by = new Map<LibraryStatus, CardItem[]>();
    for (const { c, x } of list) {
      const b = by.get(x.status);
      if (b) b.push(c);
      else by.set(x.status, [c]);
    }
    return [...by].map(([status, items]) => ({ status, items }));
  }, [grouped, list]);

  /* ملاحظةُ التصنيف تعيش فوق اللوح المطلق (تحت الرأس مباشرةً) لا داخل التمرير */
  const note = classifying ? (
    <Text size={12} muted style={{ textAlign: "center", paddingVertical: 8, position: "absolute", top: topPad, left: 0, right: 0, zIndex: 1 }}>{t.animeClassifying}</Text>
  ) : null;
  const wrap = (body: React.ReactNode, scrolls = false) => (
    <View style={{ flex: 1, paddingTop: scrolls ? 0 : topPad }}>
      {note}
      {body}
    </View>
  );
  if (data.isLoading) return wrap(<Skeleton cols={cols} cellW={cellW} />);
  if (data.isError) return wrap(<Empty text={t.apiInternal} cta={t.errorRetry} onCta={() => void data.refetch()} />);
  if (list.length === 0)
    return wrap(
      <Empty
        text={q.trim() ? t.libSearchEmpty(q.trim()) : tab === "anime" ? t.libAnimeEmpty : t.libraryEmpty}
        cta={q.trim() ? t.libSearchEmptyCta : tab === "anime" ? t.libAnimeEmptyCta : t.libraryEmptyCta}
        onCta={() => {
          if (q.trim()) {
            onClearSearch();
            return;
          }
          onLeave(tab === "anime" ? "/news?tab=anime" : "/news");
        }}
      />,
    );
  return wrap(
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: topPad + 12, paddingBottom: bottomPad, gap: 28 }}
      showsVerticalScrollIndicator={false}
      contentOffset={{ x: 0, y: memory.y[tab] ?? 0 }}
      onScroll={(e) => { memory.y[tab] = e.nativeEvent.contentOffset.y; onScroll(e); }}
      scrollEventThrottle={16}
    >
      {/* D-954 — التلميحُ في رأس القائمة كما في `LibraryGrid` (فوق الشبكة، تحت
          الأدوات)، **ولا يُرسم إن قُرئ في الحساب** — على أيِّ جهاز */}
      {!(data.data?.hints ?? []).includes("library-hold") ? (
        <OneTimeHint id="library-hold" text={t.longPressHint} />
      ) : null}
      {!grouped ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {list.map(({ c }) => (
            <PosterCard key={c.key} item={c} width={cellW} onPress={onOpen} onHold={onHold} />
          ))}
        </View>
      ) : null}
      {groups.map((g) => {
        const isOpen = open.has(g.status);
        const solo = g.items.length === 1;
        const toggle = () =>
          setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(g.status)) next.delete(g.status);
            else next.add(g.status);
            return next;
          });
        return (
          <View key={g.status}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
              <Pressable onPress={toggle} hitSlop={6}>
                <Text size={22} weight="700">{statusLabel(g.status, t)}</Text>
              </Pressable>
              <Pressable onPress={toggle} hitSlop={8}>
                <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>
                  {isOpen ? t.closeLabel : String(g.items.length)}
                </Text>
              </Pressable>
            </View>
            <View style={{ height: 4 }} />
            {isOpen ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
                {g.items.map((it) => (
                  <PosterCard key={it.key} item={it} width={cellW} onPress={onOpen} onHold={onHold} />
                ))}
              </View>
            ) : solo ? (
              <PosterCard item={g.items[0]} width={RAIL_W} onPress={onOpen} onHold={onHold} />
            ) : (
              <FlatList
                horizontal
                data={g.items}
                keyExtractor={(it) => it.key}
                renderItem={({ item }) => <PosterCard item={item} width={RAIL_W} onPress={onOpen} onHold={onHold} />}
                showsHorizontalScrollIndicator={false}
                /* `-mx-4 px-4`: الصفُّ يلامس حافّةَ الشاشة ويبدأ من الهامش */
                style={{ marginHorizontal: -PAGE_PAD }}
                contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP, paddingBottom: 4 }}
                initialNumToRender={6}
                windowSize={5}
              />
            )}
          </View>
        );
      })}
    </ScrollView>,
    true,
  );
}

function toCard(x: LibraryItem): CardItem {
  const isTv = x.kind === "tv";
  const aired = x.aired;
  const watched = Math.min(x.watched, aired || Infinity);
  const done = x.status === "completed";
  const progress = isTv ? (aired > 0 ? Math.round((watched / aired) * 100) : 0) : done ? 100 : 0;
  const dropped = x.status === "dropped";
  return {
    key: `${isTv ? "tv" : "mv"}-${x.id}`,
    kind: x.kind,
    id: x.id,
    title: x.display_title ?? x.title,
    posterPath: x.display_poster_path === undefined ? x.poster_path : x.display_poster_path,
    progress,
    count: isTv && !dropped && watched > 0 && aired > watched ? aired - watched : undefined,
    completed: done,
    dropped,
  };
}

function statusLabel(s: LibraryStatus, t: ReturnType<typeof useApp>["t"]): string {
  return s === "watching"
    ? t.libStatusWatching
    : s === "completed"
      ? t.libStatusCompleted
      : s === "unstarted"
        ? t.libStatusUnstarted
        : t.libStatusDropped;
}

/** الهيكلُ أثناء التحميل — `aspect-[2/3] rounded-poster bg-surface border animate-pulse` (G6) */
function Skeleton({ cols, cellW }: { cols: number; cellW: number }) {
  const { tokens } = useApp();
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 12, flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
      {Array.from({ length: cols * 2 }, (_, i) => (
        <View
          key={i}
          style={{
            width: cellW,
            aspectRatio: 2 / 3,
            borderRadius: radius.poster,
            backgroundColor: tokens.surface,
            borderWidth: 1,
            borderColor: tokens.border,
            opacity: 0.7,
          }}
        />
      ))}
    </View>
  );
}

/** الحالةُ الفارغة — `py-16` نصٌّ خافتٌ وزرٌّ `sm` (G7) */
function Empty({ text, cta, onCta }: { text: string; cta: string; onCta: () => void }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 64, paddingHorizontal: PAGE_PAD, gap: space.lg }}>
      <Text muted style={{ textAlign: "center" }}>{text}</Text>
      <Button label={cta} onPress={onCta} />
    </View>
  );
}

