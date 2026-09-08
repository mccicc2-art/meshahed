import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, Platform, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, qk, queryClient, write, ApiError } from "../api";
import { useApp } from "../state";
import { shell } from "../shell";
import { Button, Text } from "../ui";
import { radius, space } from "../theme";
import { PosterCard, type CardAnchor, type CardItem } from "./PosterCard";
import { HoldMenu, type HoldAction } from "./HoldMenu";
import { ToolsSheet, type LibrarySort } from "./ToolsSheet";
import { Icon } from "../icons";
import { byTitle, normalizeSearch } from "@/core/arabic";
import type { LibraryItem, LibraryPayload, LibraryStatus, LibraryTab, ShowRefBody, SetDroppedBody, ToggleMovieBody } from "../contracts";

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
 * ⚠️ **ما ليس هنا معلَنٌ لا منسيّ** (B0 §٨): فنّانون/قوائم (KNOWN_GAP-7) ·
 * أدواتُ الفرز والبحث والمفضّلة وخانةُ «حلّل مكتبتك» (B4) · قائمةُ الضغط
 * المطوَّل (B3) · ذاكرةُ التمرير وتخزينُ التبويب في الرابط (B4) · تصنيفُ
 * الأنمي غيرِ المصنَّف (الويبُ يسأل عنه عند أوّل فتح — هنا يُعرض المصنَّفُ
 * فقط، KNOWN_GAP-12) · كثافةُ الملصقات من تفضيل صاحبها (`home_prefs.density`
 * لا يصل الغلاف — الافتراضيُّ `comfortable` ١١٨، KNOWN_GAP-13).
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
const memory: { tab: Tab | null; open: LibraryStatus[]; y: number } = { tab: null, open: [], y: 0 };

export function LibraryScreen() {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

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

  const openTitle = useCallback(
    (item: CardItem) => {
      shell.open(item.kind === "tv" ? `/show/${item.id}` : `/movie/${item.id}`);
      back();
    },
    [back],
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
  /** القائمةُ بعد المصافي والترتيب — الوصفةُ في `LibraryGrid.tsx` (`items`) حرفاً */
  const list = useMemo(() => {
    const items = data.data?.items ?? [];
    const inTab = items.filter((x) =>
      activeTab === "shows" ? x.kind === "tv" : activeTab === "movies" ? x.kind === "movie" : x.is_anime === true,
    );
    const byFav = fav && hasFav ? inTab.filter((x) => x.is_favorite === true) : inTab;
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
  }, [data.data, activeTab, fav, hasFav, q, sort, locale]);

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

  const tabs: { key: Tab; label: string }[] = [
    { key: "shows", label: t.shortShows },
    { key: "movies", label: t.shortMovies },
    { key: "anime", label: t.discoverTabAnime },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
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
        <Text size={15} weight="700">{t.libraryTitle}</Text>
        <Pressable
          onPress={back}
          hitSlop={12}
          accessibilityLabel={t.closeLabel}
          style={{ position: "absolute", start: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}
        >
          <Chevron color={tokens.fg} />
        </Pressable>
      </View>

      {/* التبويباتُ الثلاثة — عائلةُ segmented الواحدة، وزرُّ الأدوات في طرفها (`FilterIconButton`: `h-9 w-9 rounded-full border`) */}
      <View style={{ flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderBottomColor: tokens.divider, paddingHorizontal: PAGE_PAD }}>
        {tabs.map((tb) => {
          const on = tb.key === activeTab;
          return (
            <Pressable
              key={tb.key}
              onPress={() => setTab(tb.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{ flex: 1, alignItems: "center", paddingTop: 8, paddingBottom: 12, paddingHorizontal: 12 }}
            >
              <Text size={14} weight="600" color={on ? tokens.fg : tokens.muted}>{tb.label}</Text>
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
      {chips.length > 0 ? (
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

      {/* خانةٌ تحت الشريط (D-453/D-671): «الإحصائيات» و«النشاط» بابان إلى الويب، والقلبُ مِصفاةٌ لمن له مفضّلة */}
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: PAGE_PAD, marginTop: 12 }}>
        {(
          [
            { path: "/stats", icon: "chart", label: t.statsPageTitle },
            { path: "/activity", icon: "clock", label: t.activityTitle },
          ] as const
        ).map((b) => (
          <Pressable
            key={b.path}
            onPress={() => { shell.open(b.path); back(); }}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}
          >
            <Icon name={b.icon} size={17} color={tokens.accent} />
            <Text size={14} weight="700">{b.label}</Text>
          </Pressable>
        ))}
        {hasFav ? (
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

      {data.isLoading ? (
        <Skeleton cols={cols} cellW={cellW} />
      ) : data.isError ? (
        <Empty
          text={t.apiInternal}
          cta={t.errorRetry}
          onCta={() => void data.refetch()}
        />
      ) : list.length === 0 ? (
        <Empty
          text={q.trim() ? t.libSearchEmpty(q.trim()) : activeTab === "anime" ? t.libAnimeEmpty : t.libraryEmpty}
          cta={q.trim() ? t.libSearchEmptyCta : activeTab === "anime" ? t.libAnimeEmptyCta : t.libraryEmptyCta}
          onCta={() => {
            if (q.trim()) {
              setQ("");
              return;
            }
            shell.open(activeTab === "anime" ? "/news?tab=anime" : "/news");
            back();
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 28 }}
          showsVerticalScrollIndicator={false}
          contentOffset={{ x: 0, y: memory.y }}
          onScroll={(e) => { memory.y = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={64}
        >
          {!grouped ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
              {list.map(({ c }) => (
                <PosterCard key={c.key} item={c} width={cellW} onPress={openTitle} onHold={hold} />
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
                      <PosterCard key={it.key} item={it} width={cellW} onPress={openTitle} onHold={hold} />
                    ))}
                  </View>
                ) : solo ? (
                  <PosterCard item={g.items[0]} width={RAIL_W} onPress={openTitle} onHold={hold} />
                ) : (
                  <FlatList
                    horizontal
                    data={g.items}
                    keyExtractor={(it) => it.key}
                    renderItem={({ item }) => <PosterCard item={item} width={RAIL_W} onPress={openTitle} onHold={hold} />}
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
        </ScrollView>
      )}
      {tools ? <ToolsSheet q={q} onQ={setQ} sort={sort} onSort={setSort} onClose={() => setTools(false)} /> : null}
      {held ? <HoldMenu item={held.item} anchor={held.anchor} busy={busy} onAction={(a) => void act(a)} onClose={() => setHeld(null)} /> : null}
      {toast ? <Toast text={toast} bottom={insets.bottom + 16} /> : null}
    </View>
  );
}

/** مضيفُ الرسائل الواحد في التطبيق — نسخةُ `ToastHost` (الويب) بنغمة الخطأ: كبسولةٌ `rounded-full border bg-elevated ps-4 py-2.5 text-sm` بحدٍّ ونصٍّ بلون `--error`، على ارتفاع `5.5rem + safe-area` */
function Toast({ text, bottom }: { text: string; bottom: number }) {
  const { tokens } = useApp();
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: PAGE_PAD, right: PAGE_PAD, bottom: bottom + 72, alignItems: "center" }}>
      <View
        style={{
          maxWidth: 448,
          paddingStart: 16,
          paddingEnd: 16,
          paddingVertical: 10,
          borderRadius: radius.pill,
          backgroundColor: tokens.elevated,
          borderWidth: 1,
          borderColor: tokens.error + "66",
          shadowColor: "#000",
          shadowOpacity: 0.45,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
        }}
      >
        <Text size={14} color={tokens.error}>{text}</Text>
      </View>
    </View>
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

/** سهمُ الرجوع — خطّان بلا أيقونة: الشاشةُ الوحيدةُ التي تحتاجه، ولا مجموعةَ أيقوناتٍ ثانية */
function Chevron({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 11,
          height: 11,
          borderStartWidth: 2,
          borderTopWidth: 2,
          borderColor: color,
          transform: [{ rotate: "-45deg" }],
          marginStart: 4,
        }}
      />
    </View>
  );
}
