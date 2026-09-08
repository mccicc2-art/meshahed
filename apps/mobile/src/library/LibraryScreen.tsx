import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, Platform, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "../api";
import { useApp } from "../state";
import { shell } from "../shell";
import { Button, Text } from "../ui";
import { radius, space } from "../theme";
import { PosterCard, type CardItem } from "./PosterCard";
import type { LibraryItem, LibraryPayload, LibraryStatus, LibraryTab } from "../contracts";

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

export function LibraryScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  const q = useQuery({
    queryKey: qk.tag("me:library"),
    queryFn: async () => (await api<LibraryPayload>("/api/v1/me/library")).data,
  });

  const [tab, setTab] = useState<Tab | null>(null);
  const activeTab: Tab = tab ?? q.data?.default_tab ?? "shows";
  const [open, setOpen] = useState<Set<string>>(() => new Set());

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

  /* بناءُ بطاقات التبويب — الوصفةُ في `library/page.tsx`: التقدّمُ من
     `watched/aired`، والعدُّ المتبقّي حين بدأ ولم يكتمل ولم يُوقَف. */
  const groups = useMemo(() => {
    const items = q.data?.items ?? [];
    const inTab = items.filter((x) =>
      activeTab === "shows" ? x.kind === "tv" : activeTab === "movies" ? x.kind === "movie" : x.is_anime === true,
    );
    const cards = inTab.map(toCard);
    const rank = (s: LibraryStatus) => STATUS_ORDER.indexOf(s);
    const sorted = cards
      .map((c, i) => ({ c, s: inTab[i].status, i }))
      .sort((a, b) => rank(a.s) - rank(b.s) || (a.s === "watching" ? b.c.progress - a.c.progress : 0) || a.i - b.i);
    const by = new Map<LibraryStatus, CardItem[]>();
    for (const { c, s } of sorted) {
      const b = by.get(s);
      if (b) b.push(c);
      else by.set(s, [c]);
    }
    return [...by].map(([status, list]) => ({ status, items: list }));
  }, [q.data, activeTab]);

  const inner = screenW - PAGE_PAD * 2;
  const cols = Math.max(1, Math.floor((inner + GAP) / (MIN_COL + GAP)));
  const cellW = Math.floor((inner - GAP * (cols - 1)) / cols);

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

      {/* التبويباتُ الثلاثة — عائلةُ segmented الواحدة */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
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
      </View>

      {q.isLoading ? (
        <Skeleton cols={cols} cellW={cellW} />
      ) : q.isError ? (
        <Empty
          text={t.apiInternal}
          cta={t.errorRetry}
          onCta={() => void q.refetch()}
        />
      ) : groups.length === 0 ? (
        <Empty
          text={activeTab === "anime" ? t.libAnimeEmpty : t.libraryEmpty}
          cta={activeTab === "anime" ? t.libAnimeEmptyCta : t.libraryEmptyCta}
          onCta={() => {
            shell.open(activeTab === "anime" ? "/news?tab=anime" : "/news");
            back();
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 28 }}
          showsVerticalScrollIndicator={false}
        >
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
                      <PosterCard key={it.key} item={it} width={cellW} onPress={openTitle} />
                    ))}
                  </View>
                ) : solo ? (
                  <PosterCard item={g.items[0]} width={RAIL_W} onPress={openTitle} />
                ) : (
                  <FlatList
                    horizontal
                    data={g.items}
                    keyExtractor={(it) => it.key}
                    renderItem={({ item }) => <PosterCard item={item} width={RAIL_W} onPress={openTitle} />}
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
