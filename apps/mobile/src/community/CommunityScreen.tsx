import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, FlatList, Platform, Pressable, ScrollView, Share, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, queryClient, write } from "../api";
import { CONFIG } from "../config";
import { haptic } from "../haptics";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { Composer } from "../thread/Composer";
import { openThreadPath } from "../thread/route";
import { useApp } from "../state";
import { shell } from "../shell";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { Logo } from "../Logo";
import { TabSlide } from "../TabSlide";
import { useChromeHide } from "../ChromeHide";
import { BottomNav, navHeight } from "../BottomNav";
import { useBootRoot } from "../bootRoot";
import { useRefetchOnFocus } from "../useRefetchOnFocus";
import { usePullRefresh } from "../pullRefresh";
import { afterPaint, coldStartVoid, span, tabLanded } from "../perfMarks";
import { ListCard } from "../library/ListCard";
import { FeedCard, LeaderCard, RoomCard, TopReviewCard, type CardActs, type CardDoors, type RoomPin } from "./CommunityCards";
import { errorText, useCommunityActs, useViewCounter, type CommunityActs } from "./communityActs";
import { CommunityTools, toolsOnFor } from "./CommunityTools";
import { COMMUNITY_PAGER_TABS, type BoardSection, type CommunityPagerTab, type CommunityPrefsBody } from "@/core/communityParams";
import { guardLastVisible, type TabPref } from "@/core/tabPrefs";
import { displayNameOf } from "@/core/people";
import type { CommunityFeedRow, CommunityLeaderRow, CommunityListCard, CommunityPayload, CommunityPeopleAllPayload, CommunityPrefs, HiddenRailsBody } from "../contracts";
import { openProfile, profileHandleOf } from "../member/open";

/**
 * ====== «المجتمع» أصليّاً — Phase 11-M · M1 (D-1168 · D-1171) ======
 *
 * 🔑 **الصفحةُ نفسُها بتبويباتها الثلاثة** (`app/people/page.tsx`): «مجتمعي» (الخطّ) · «الأعمال» (غرفُ النقاش) · «الناس»
 * (اللوحة و«عرض الكل») — **من حمولةٍ واحدة** (`GET /api/v1/community`) تقرؤها الصفحةُ من النواة نفسِها (D-1172)، فالخطُّ
 * يصل مرشَّحاً ومرتَّباً وبلغة القارئ، والتطبيقُ يرسم ولا يحسب. التبويباتُ الظاهرةُ وترتيبُها والمفتوحُ أوّلاً من
 * تفضيلاتك (D-1171). والانزلاقُ `TabSlide` نفسُه (الجارُ مسخَّنٌ، K2)، والكسوةُ الذكيّةُ كأخواتها (D-966).
 *
 * ⚖️ **قراءةٌ وحدَها في M1** (خطّة §٣): العملُ والقائمةُ ⇐ صفحتاهما الأصليّتان؛ الشخصُ والرأيُ والنشرةُ والغرفة ⇐ بابٌ
 * ويبيٌّ يعود رجوعُه إلى هنا (`returnTo: "community"`).
 *
 * 🆕 **M2 — التفاعل**: القلبُ · «تعليق» بصندوق الردّ الواحد (`thread/Composer`) · المشاهداتُ تُعدّ (`PostViews`) · المشاركةُ بورقة
 * النظام · دبّوسُ الغرف · زاويةُ المتابعة في «عرض الكل» · **ورقةُ الأدوات** (`CommunityTools`) بزرّها في طرف الترويسة كالويب.
 * الحالةُ في الكاش (`communityActs`)، والرسالةُ العابرةُ من المضيف الواحد (`ToastHost`).
 */
type Tab = CommunityPagerTab;
const HEADER_H = 64;
const PAGE_PAD = 16;
const ALL_TABS: Tab[] = ["activity", "talk", "people"];
export const COMMUNITY_KEY = ["community"] as const;
/* الشاشةُ ثابتةٌ في مجموعة التبويبات (K3)؛ هذه ذاكرتُها إن أُعيد بناؤها بعد بابٍ ويبيّ (K3b) */
const memory: { tab: Tab | null; all: BoardSection | null } = { tab: null, all: null };

async function fetchCommunity() {
  return (await api<CommunityPayload>("/api/v1/community")).data;
}

/** تسخينٌ اختياريّ — المفتاحُ مفتاحُ الشاشة فلا نداءَ يتكرّر */
export function prefetchCommunity(): void {
  void queryClient.prefetchQuery({ queryKey: COMMUNITY_KEY, queryFn: fetchCommunity, staleTime: 60_000 });
}

export function CommunityScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const navH = navHeight(insets.bottom);

  const q = useQuery({ queryKey: COMMUNITY_KEY, queryFn: fetchCommunity, staleTime: 60_000 });
  const d = q.data ?? null;

  /* `community.open`: من التركيب إلى أوّل رسمٍ فيه حمولة — و`cached` يفصل الكاشَ المحفوظ عن الشبكة (نهجُ الرئيسيّة) */
  const [endOpen] = useState(() => {
    coldStartVoid();
    return span("community.open", { cached: qc.getQueryData(COMMUNITY_KEY) ? 1 : 0 });
  });
  const opened = useRef(false);
  useEffect(() => {
    if (!d || opened.current) return;
    opened.current = true;
    afterPaint(() => endOpen());
  }, [d, endOpen]);
  useFocusEffect(useCallback(() => tabLanded("people"), []));
  useRefetchOnFocus(["community"]);

  /* ——— M2: الأفعال ——— */
  const toastHost = useRef<ToastHostRef>(null);
  const say = useCallback((text: string) => toastHost.current?.say(text), []);
  const acts = useCommunityActs(d, t, say);
  const [composing, setComposing] = useState<CommunityFeedRow | null>(null);
  const [tools, setTools] = useState(false);
  const share = useCallback((path: string, title: string) => {
    const url = `${CONFIG.apiBase}${path}`;
    /* إغلاقُ ورقة النظام ليس خطأً (`ShareTitleButton`) */
    void Share.share({ message: title ? `${title} — ${url}` : url, url }).catch(() => {});
  }, []);
  const cardActs: CardActs = useMemo(
    () => ({ like: acts.like, signedIn: acts.signedIn, meId: acts.meId, comment: setComposing, share }),
    [acts.like, acts.signedIn, acts.meId, share],
  );

  /* التبويباتُ الظاهرةُ بترتيبك، والمفتوحُ أوّلاً من تفضيلك (D-1171) — ما لم يكن للشاشة تبويبٌ تذكره */
  const order: Tab[] = useMemo(() => {
    const v = (d?.tabs.visible ?? []).filter((k): k is Tab => (ALL_TABS as string[]).includes(k));
    return v.length ? v : ALL_TABS;
  }, [d]);
  const [tab, setTab] = useState<Tab>(memory.tab ?? "activity");
  const chose = useRef(memory.tab !== null);
  useEffect(() => {
    if (!d || chose.current) return;
    chose.current = true;
    setTab(d.tabs.initial);
  }, [d]);
  useEffect(() => {
    if (!order.includes(tab)) setTab(order[0]);
  }, [order, tab]);
  const goTab = useCallback((next: Tab) => {
    chose.current = true;
    memory.tab = next;
    setTab(next);
  }, []);
  /* M1-fix — الخطُّ يُضيء وجهةَ السحب لحظةَ رفع الإصبع (`onAim`)، والقلبُ بعد الطيران */
  const [aim, setAim] = useState<Tab | null>(null);
  useEffect(() => setAim(null), [tab]);
  const lit = aim ?? tab;
  const [all, setAllState] = useState<BoardSection | null>(memory.all);
  const setAll = useCallback((s: BoardSection | null) => {
    memory.all = s;
    setAllState(s);
  }, []);

  /* ——— الملاحة ——— */
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  const { switchTo, bootBack } = useBootRoot();
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        /* «عرض الكل» طبقةٌ داخل التبويب: الرجوعُ يطويها أوّلاً (بابُ الرجوع النصّيّ في الويب) */
        if (tab === "people" && memory.all) {
          setAll(null);
          return true;
        }
        if (bootBack("/community")) return true;
        back();
        return true;
      });
      return () => sub.remove();
    }, [back, bootBack, tab, setAll]),
  );
  const [leaving, setLeaving] = useState(false);
  const doors: CardDoors = useMemo(
    () => ({
      onTitle: (kind, id) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from: "community" } }),
      onList: (id) => router.push({ pathname: "/list/[id]", params: { id, from: "community" } }),
      onWeb: (path) => {
        /* 🆕 11-N · N1 — ملفُّ الشخص أصليٌّ: رابطُه لا يفتح الويب (`member/open.ts`) */
        { const who = profileHandleOf(path); if (who) return openProfile(router, who, "community"); }
        /* 🆕 M3 — الغرفةُ والمنشورُ والرأيُ أصليّةٌ الآن؛ الملفُّ `/u/…` وحدَه يبقى باباً ويبيّاً */
        if (openThreadPath(router, path, "community")) return;
        if (leaving) return;
        setLeaving(true);
        void shell.open(path, { returnTo: "community" }).then((layered) => {
          setLeaving(false);
          /* 🆕 K3b — ظهرت طبقةً ⇒ هذه الشاشةُ تبقى تحتها كما هي (لا نزعَ ولا بناء) */
          if (!layered) back();
        });
      },
    }),
    [router, leaving, back],
  );

  /* ——— الكسوة ——— */
  const chrome = useChromeHide();
  const [topH, setTopH] = useState(insets.top + HEADER_H + 46);
  const bottomPad = navH + 24;
  const { reveal } = chrome;
  useEffect(() => {
    reveal();
  }, [tab, all, reveal]);

  const label = (k: Tab) => (k === "activity" ? t.communityTabMine : k === "talk" ? t.communityTabWorks : t.communityTabPeople);

  /* ——— M2: ورقةُ الأدوات — تفاؤليّةٌ في الكاش ثمّ `me/prefs/*` (كوكيزُ الويب نفسُها)، ثمّ يُعاد الخطّ كـ`router.refresh()` ——— */
  const patchPrefs = useCallback(
    (fn: (p: CommunityPrefs) => CommunityPrefs, extra?: (d: CommunityPayload, p: CommunityPrefs) => Partial<CommunityPayload>) =>
      qc.setQueryData<CommunityPayload>(COMMUNITY_KEY, (prev) => {
        if (!prev?.prefs) return prev;
        const p = fn(prev.prefs);
        return { ...prev, prefs: p, ...(extra ? extra(prev, p) : {}) };
      }),
    [qc],
  );
  const savePrefs = useCallback(
    async (path: string, body: unknown, undo: CommunityPrefs | null, refetch: boolean) => {
      try {
        const r = await write<{ ok?: boolean; needsPlus?: true }>(path, body);
        if (r && r.needsPlus) {
          if (undo) patchPrefs(() => undo);
          doors.onWeb("/plus");
          return;
        }
        if (refetch) void qc.invalidateQueries({ queryKey: COMMUNITY_KEY, exact: true });
      } catch (e) {
        if (undo) patchPrefs(() => undo);
        say(errorText(t, e));
      }
    },
    [qc, patchPrefs, doors, say, t],
  );
  const onPrefs = useCallback(
    (patch: CommunityPrefsBody) => {
      haptic.pick();
      const undo = d?.prefs ?? null;
      patchPrefs((p) => ({ ...p, ...patch }));
      void savePrefs("/api/v1/me/prefs/community", patch, undo, true);
    },
    [d, patchPrefs, savePrefs],
  );
  const onTabs = useCallback(
    (next: TabPref[]) => {
      const clean = guardLastVisible(next);
      const undo = d?.prefs ?? null;
      /* الشريطُ يتبع الترتيبَ فوراً — `visible` هي ما يرسمه الرأس (D-1171) */
      patchPrefs(
        (p) => ({ ...p, tabs: clean }),
        (x) => ({
          tabs: {
            ...x.tabs,
            visible: clean.filter((c) => !c.hidden).map((c) => c.key).filter((k): k is Tab => (COMMUNITY_PAGER_TABS as readonly string[]).includes(k)),
          },
        }),
      );
      void savePrefs("/api/v1/me/prefs/tabs", { surface: "community", prefs: clean }, undo, false);
    },
    [d, patchPrefs, savePrefs],
  );
  const onRails = useCallback(
    (keys: string[]) => {
      const undo = d?.prefs ?? null;
      patchPrefs((p) => ({ ...p, hidden_rails: keys }));
      /* الأقسامُ تُقصّ على الخادم (`null` = مطفأ، D-874) — فاللوحةُ تُعاد لا تُحسب هنا */
      void savePrefs("/api/v1/me/prefs/hidden-rails", { keys } satisfies HiddenRailsBody, undo, true);
    },
    [d, patchPrefs, savePrefs],
  );
  const toolsOn = toolsOnFor(lit, d?.prefs ?? null);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <Animated.View
        onLayout={(e) => setTopH(Math.round(e.nativeEvent.layout.height))}
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, paddingTop: insets.top, backgroundColor: tokens.bg, transform: [{ translateY: Animated.multiply(chrome.hidden, -topH) }] }}
      >
        <View style={{ height: HEADER_H, borderBottomWidth: 1, borderBottomColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
          <Text size={15} weight="700">{t.peopleTitle}</Text>
          <View style={{ position: "absolute", start: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}>
            <Logo size={28} />
          </View>
          {d?.prefs ? (
            /* زرُّ الأدوات (`FilterIconButton`) — **بلا رقمٍ ولا نقطة** في المجتمع (D-554/D-592)، والحالةُ في لون الرمز وحدَه */
            <Pressable
              onPress={() => setTools(true)}
              accessibilityRole="button"
              accessibilityLabel={t.communityToolsTitle}
              accessibilityState={{ expanded: tools }}
              style={{ position: "absolute", end: PAGE_PAD, width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="sliders" size={16} color={toolsOn > 0 ? tokens.fg : tokens.muted} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider, paddingHorizontal: PAGE_PAD }}>
          {order.map((k) => {
            const on = k === lit;
            return (
              <Pressable key={k} onPress={() => goTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}>
                <Text size={14} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted}>{label(k)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {!d ? (
        <View style={{ flex: 1, paddingTop: topH + 12, paddingHorizontal: PAGE_PAD, gap: 12 }}>
          {q.isError ? (
            <View style={{ alignItems: "center", gap: 12, paddingTop: 40 }}>
              <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
              <Button label={t.errorRetry} onPress={() => void q.refetch()} />
            </View>
          ) : (
            [0, 1, 2, 3].map((i) => <View key={i} style={{ height: 120, borderRadius: radius.card, backgroundColor: tokens.surface2 }} />)
          )}
        </View>
      ) : (
        <TabSlide
          order={order}
          tab={tab}
          onTab={goTab}
          onAim={setAim}
          perfScreen="community"
          render={(k) => (
            <Pane k={k} d={d} doors={doors} acts={acts} cardActs={cardActs} live={tab === k} topPad={topH} bottomPad={bottomPad} onScroll={chrome.onScroll} all={all} onAll={setAll} />
          )}
        />
      )}

      <Animated.View style={{ position: "absolute", left: 0, right: 0, bottom: 0, transform: [{ translateY: Animated.multiply(chrome.hidden, navH) }] }}>
        <BottomNav
          active="people"
          onGo={(k) => {
            if (k === "people") {
              if (tab === "people" && all) setAll(null);
              return;
            }
            if (k === "library") return switchTo("/library");
            if (k === "news") return switchTo("/discover");
            if (k === "search") return switchTo("/search");
            switchTo("/home");
          }}
        />
      </Animated.View>
      {leaving ? (
        <View pointerEvents="auto" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
      {composing ? (
        <Composer
          title={t.actionComment}
          hint={composing.kind === "news" ? `Loopz · ${composing.item.title}` : `${displayNameOf(composing.item.person, t.anonymousUser)} · ${composing.item.title ?? ""}`}
          onSend={(draft) => acts.reply(composing, draft.body)}
          onClose={() => setComposing(null)}
        />
      ) : null}
      {tools && d?.prefs ? (
        <CommunityTools
          tab={lit}
          tabTitle={label(lit)}
          prefs={d.prefs}
          tabLabels={{ activity: t.communityTabMine, talk: t.communityTabWorks, people: t.communityTabPeople }}
          onPrefs={onPrefs}
          onTabs={onTabs}
          onRails={onRails}
          onMessage={() => {
            setTools(false);
            /* 🆕 11-M · M4 — «راسل صديقاً» يفتح «الرسائل» الأصليّة فوق المجتمع، والرجوعُ إليه */
            router.push({ pathname: "/messages", params: { from: "community" } });
          }}
          onClose={() => setTools(false)}
        />
      ) : null}
      <ToastHost hostRef={toastHost} bottom={navH + 16} />
    </View>
  );
}

type PaneProps = {
  k: Tab;
  d: CommunityPayload;
  doors: CardDoors;
  acts: CommunityActs;
  cardActs: CardActs;
  /** اللوحُ المفتوح — المشاهداتُ تُعدّ فيه وحدَه (الجارُ المسخَّن خارج الشاشة) */
  live: boolean;
  topPad: number;
  bottomPad: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  all: BoardSection | null;
  onAll: (s: BoardSection | null) => void;
};

/** لوحُ تبويب — كلُّ ما يخصّ تبويباً واحداً هنا ليرسم `TabSlide` لوحين جنباً إلى جنب في أثناء السحب */
function Pane({ k, d, doors, acts, cardActs, live, topPad, bottomPad, onScroll, all, onAll }: PaneProps) {
  const { t, tokens } = useApp();
  const refresh = usePullRefresh([COMMUNITY_KEY], topPad);
  const views = useViewCounter(live && k === "activity" && acts.signedIn);
  const roomPin: RoomPin = useMemo(() => ({ admin: acts.admin, readOnly: !acts.signedIn, onPin: acts.pin }), [acts.admin, acts.signedIn, acts.pin]);
  const empty = (text: string) => (
    <View style={{ marginTop: 8, paddingVertical: 36, paddingHorizontal: 20, borderRadius: radius.card, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.border, backgroundColor: tokens.surface }}>
      <Text size={14} muted style={{ textAlign: "center", lineHeight: 21 }}>{text}</Text>
    </View>
  );

  if (k === "activity") {
    return (
      <FlatList
        data={d.feed.rows}
        keyExtractor={(r) => r.key}
        renderItem={({ item }) => <FeedCard row={item} doors={doors} acts={cardActs} />}
        onViewableItemsChanged={views.onViewableItemsChanged}
        viewabilityConfig={views.viewabilityConfig}
        ListEmptyComponent={empty(d.feed.empty_text)}
        contentContainerStyle={{ paddingTop: topPad + 4, paddingBottom: bottomPad, paddingHorizontal: PAGE_PAD }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={refresh}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
      />
    );
  }

  if (k === "talk") {
    return (
      <FlatList
        data={d.rooms}
        keyExtractor={(r) => `${r.mediaType}-${r.tmdbId}`}
        renderItem={({ item }) => <RoomCard room={item} doors={doors} pin={roomPin} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={empty(t.talkRoomsEmpty)}
        contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: bottomPad, paddingHorizontal: PAGE_PAD }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={refresh}
        initialNumToRender={6}
        windowSize={7}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: bottomPad, paddingHorizontal: PAGE_PAD }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={refresh}
    >
      {all ? <BoardAll section={all} doors={doors} acts={acts} onBack={() => onAll(null)} /> : d.board.empty ? empty(t.peopleTabEmpty) : <Board d={d} doors={doors} onAll={onAll} />}
    </ScrollView>
  );
}

/* رموزُ الأقسام وألوانُها — `SECTION_TONE` الويب حرفاً (D-268: فهرسٌ بصريّ لا ألوانُ حالة) */
const TONE = { featured: "#A78BFA", reviews: "#F26D6D", rising: "#FB923C", talked: "#2DD4BF", lists: "#60A5FA" } as const;

function SectionHead({ icon, color, title, onAll }: { icon: IconName; color: string; title: string; onAll?: () => void }) {
  const { t, tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <Icon name={icon} size={17} color={color} />
      <Text size={15} weight="700" numberOfLines={1} style={{ flex: 1 }}>{title}</Text>
      {onAll ? (
        <Pressable onPress={onAll} hitSlop={8} accessibilityRole="button">
          <Text size={12} color={tokens.muted}>{t.seeAll}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Grid({ rows, mode, doors, follow }: { rows: CommunityLeaderRow[]; mode: "featured" | "top" | "rising"; doors: CardDoors; follow?: { acts: CommunityActs; ids: ReadonlySet<string> } }) {
  const lines: CommunityLeaderRow[][] = [];
  for (let i = 0; i < rows.length; i += 3) lines.push(rows.slice(i, i + 3));
  return (
    <View style={{ gap: 10 }}>
      {lines.map((line, li) => (
        <View key={li} style={{ flexDirection: "row", gap: 10 }}>
          {line.map((p, i) => (
            <LeaderCard
              key={p.id}
              p={p}
              mode={mode}
              rank={li * 3 + i + 1}
              doors={doors}
              follow={
                follow && follow.acts.signedIn && follow.acts.meId && p.id !== follow.acts.meId
                  ? { state: follow.acts.followState(p.id, follow.ids.has(p.id)), onPress: () => follow.acts.follow(p.id, follow.ids.has(p.id)) }
                  : null
              }
            />
          ))}
          {/* خاناتٌ فارغةٌ تُبقي العرضَ ثلاثاً (شبكةُ `grid-cols-3`) */}
          {Array.from({ length: 3 - line.length }, (_, j) => <View key={`x${j}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

function ListsRow({ cards, doors }: { cards: CommunityListCard[]; doors: CardDoors }) {
  const { t } = useApp();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginHorizontal: -PAGE_PAD }}>
      <View style={{ width: PAGE_PAD - 10 }} />
      {cards.map((item) => (
        <View key={item.id} style={{ width: 280 }}>
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
            onPress={() => doors.onList(item.id)}
          />
        </View>
      ))}
      <View style={{ width: PAGE_PAD - 10 }} />
    </ScrollView>
  );
}

/** اللوحةُ بترتيب أحمد (D-270/D-289/D-291): مميّزون · الأكثر · أعلى التعليقات · العملُ الذي يدور حوله الكلام · القوائم · الصاعدون */
function Board({ d, doors, onAll }: { d: CommunityPayload; doors: CardDoors; onAll: (s: BoardSection) => void }) {
  const { t, tokens } = useApp();
  const b = d.board;
  const gap = <View style={{ height: 26 }} />;
  return (
    <View>
      {b.featured?.length ? (
        <>
          <SectionHead icon="sparkle-star" color={TONE.featured} title={t.peopleBoardFeatured} onAll={() => onAll("featured")} />
          <Grid rows={b.featured} mode="featured" doors={doors} />
          {gap}
        </>
      ) : null}
      {b.top?.length ? (
        <>
          <SectionHead icon="chart" color={tokens.accent} title={t.peopleBoardTop} onAll={() => onAll("top")} />
          <Grid rows={b.top} mode="top" doors={doors} />
          {gap}
        </>
      ) : null}
      {b.reviews?.length ? (
        <>
          <SectionHead icon="heart-filled" color={TONE.reviews} title={t.peopleBoardTopReview} onAll={() => onAll("reviews")} />
          <View style={{ gap: 10 }}>
            {b.reviews.map((r) => <TopReviewCard key={`${r.id}-${r.mediaType}-${r.tmdbId}`} r={r} doors={doors} />)}
          </View>
          {gap}
        </>
      ) : null}
      {b.talked_about ? (
        <>
          <SectionHead icon="comment" color={TONE.talked} title={t.peopleBoardTalked} />
          <RoomCard room={b.talked_about} doors={doors} hero />
          {gap}
        </>
      ) : null}
      {b.lists?.length ? (
        <>
          <SectionHead icon="bookmark" color={TONE.lists} title={t.peopleBoardSavedLists} onAll={() => onAll("lists")} />
          <ListsRow cards={b.lists} doors={doors} />
          {gap}
        </>
      ) : null}
      {b.rising?.length ? (
        <>
          <SectionHead icon="trending" color={TONE.rising} title={t.peopleBoardRising} onAll={() => onAll("rising")} />
          <Grid rows={b.rising} mode="rising" doors={doors} />
        </>
      ) : null}
    </View>
  );
}

/** «عرض الكل» — قسمٌ واحدٌ بعشرة (D-264)، وبابُ رجوعٍ نصّيٌّ فوقه كالويب */
function BoardAll({ section, doors, acts, onBack }: { section: BoardSection; doors: CardDoors; acts: CommunityActs; onBack: () => void }) {
  const { t, tokens } = useApp();
  const q = useQuery({
    queryKey: ["community", "people", section] as const,
    queryFn: async () => (await api<CommunityPeopleAllPayload>(`/api/v1/community/people?all=${section}`)).data,
    staleTime: 60_000,
  });
  const x = q.data;
  const ids = useMemo(() => new Set(x?.following_ids ?? []), [x]);
  const title =
    section === "featured" ? t.peopleBoardFeatured
    : section === "top" ? t.peopleBoardTop
    : section === "rising" ? t.peopleBoardRising
    : section === "reviews" ? t.peopleBoardTopReview
    : t.peopleBoardSavedLists;
  return (
    <View>
      <Pressable onPress={onBack} hitSlop={8} style={{ alignSelf: "flex-start", marginBottom: 14 }}>
        <Text size={12} muted>‹ {t.backAria}</Text>
      </Pressable>
      <Text size={15} weight="700" style={{ marginBottom: 10 }}>{title}</Text>
      {!x ? (
        <ActivityIndicator color={tokens.accent} style={{ marginTop: 24 }} />
      ) : x.leaders && x.leaders.length ? (
        <Grid rows={x.leaders} mode={section === "featured" ? "featured" : section === "rising" ? "rising" : "top"} doors={doors} follow={{ acts, ids }} />
      ) : x.reviews && x.reviews.length ? (
        <View style={{ gap: 10 }}>{x.reviews.map((r) => <TopReviewCard key={`${r.id}-${r.mediaType}-${r.tmdbId}`} r={r} doors={doors} />)}</View>
      ) : x.lists && x.lists.length ? (
        <View style={{ gap: 12 }}>
          {x.lists.map((l) => (
            <ListCard
              key={l.id}
              card={{
                id: l.id,
                name: l.name,
                icon: l.kind === "smart" || l.kind === "curated" ? "sparkle-star" : undefined,
                owner: l.owner,
                owner_avatar: l.owner_avatar,
                countText: l.count_label ?? t.listCount(l.item_count),
                posters: l.posters,
                cover: l.cover,
                stats: { saves: l.saves, reviews: l.reviews, rating: l.rating },
                playlist: null,
                canSave: l.can_save,
                savedByMe: l.saved_by_me,
                canReview: !!l.can_review,
                hasMyReview: !!l.my_review,
              }}
              onPress={() => doors.onList(l.id)}
            />
          ))}
        </View>
      ) : (
        <Text size={14} muted style={{ textAlign: "center", paddingVertical: 32 }}>{t.peopleTabEmpty}</Text>
      )}
    </View>
  );
}
