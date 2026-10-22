import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { homeSeen, useBootRoot } from "../bootRoot";
import { useRefetchOnFocus } from "../useRefetchOnFocus";
import { useBadges } from "../messages/badges";
import { warmDiscoverOnce } from "../discover/DiscoverScreen";
import { warmMessagesOnce } from "../messages/common";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, write } from "../api";
import { useApp } from "../state";
import { shell } from "../shell";
import { Loading, Text, type ToastTone } from "../ui";
import { radius } from "../theme";
import { posterFor } from "../poster";
import { PosterCard, type CardAnchor, type CardItem } from "../library/PosterCard";
import { ListCard } from "../library/ListCard";
import { OneTimeHint } from "../library/OneTimeHint";
import { useTourAnchor } from "../tour/anchors";
import { tourStore } from "../tour/store";
import { PRIVACY_HINT } from "@/core/privacyNotice";
import { HoldHost, ToastHost, type HoldHostRef, type ToastHostRef } from "../HoldHost";
import { CardStoreContext, createCardStore } from "../cardStore";
import { toWatchState, useCardActs } from "../cardActs";
import type { HoldAction } from "../library/HoldMenu";
import { ReorderSheet } from "../library/ReorderSheet";
import { Sheet } from "../library/Sheet";
import { openProfile, profileHandleOf } from "../member/open";
import { warmOwnProfile } from "../member/profileData";
import { CelebrateSheet } from "./CelebrateSheet";
import { navHeight } from "../BottomNav";
import { DockLink } from "../navDock";
import { useChromeHide } from "../ChromeHide";
import { usePullRefresh } from "../pullRefresh";
import { haptic } from "../haptics";
import { capCards } from "@/core/cardCount";
import { useHome, HOME_KEY, HOME_EXTRAS_KEY } from "./useHome";
import { afterPaint, coldStartOnce, span, tabLanded } from "../perfMarks";
import { HomeTopBar, HomeStats, HomeViewSwitch } from "./HomeHeader";
import { WeekStrip } from "./WeekStrip";
import { opening } from "../opening/opening";
import { ContinueCard, MediaRow, mixedRowSubtitle } from "./Cards";
import { SectionHeader, Rail, Column, Gap, PAGE_PAD } from "./Section";
import type { HomePayload, HomeMixedCard, HomeViewBody, HomeQueueItem, HomeFriendCard, QueueOrderBody, ToggleEpisodeBody, TrackResult, SetDroppedBody, ShowRefBody, ToggleMovieBody, ToWatchBody, FollowBody, UnfollowBody, ShowWatchedResult, UnmarkEpisodesBody, WatchStateBody } from "../contracts";
import { nextHomeView, sanitizeHomeView, sectionView, type HomeSection, type HomeView } from "@/core/homePrefs";
import { reorderHomePayload } from "./queueOrder";
import { HomeAllSheet, type AllSection } from "./HomeAllSheet";
import { FriendsNames, FriendBadge, FriendsWhoLine, whoOf } from "./Friends";
import { usePosterSizes } from "../posterSizes";
import { refreshWidgets } from "../widget/feed";
import { widgetBus } from "../widget/bus";
import { useStremio } from "../stremio/api";
import { useStremioAnswer } from "../stremio/useAnswer";
import { StremioCard } from "../stremio/StremioCard";

/**
 * ====== الرئيسيةُ الأصليّة — `app/page.tsx` بحذافيرها (Phase 11-H · H2/H3، D-1066) ======
 *
 * الحسابُ كلُّه في الخادم (`lib/homeCore.ts` ⇐ `GET /me/home`)؛ هذه الشاشةُ ترسم
 * ما يرسمه الويب بترتيب صاحبها: الترويسةُ ثمّ الأقسامُ الاثنا عشر بـ`prefs.order`،
 * وقسمٌ فارغٌ لا يُرسم (الشرطُ شرطُ الصفحة حرفاً). عرضُ الملصق من الكثافة
 * (٩٦ · ١١٨ · ١٤٨ — D-441) وسقفُ البطاقات من `cards` (`capCards`).
 *
 * H4: قائمةُ الضغط المطوّل (مضيفان: `library` لصفوف مكتبتي و`discover` للأصدقاء
 * والرائج — القائمةُ نفسُها في كلِّ سطح، D-229)، ورقةُ ترتيب الأقسام (`home-order`)،
 * ورقةُ الأولويّة للصفوف الأربعة (`queue-order` — الأبوابُ نفسُها التي تكتبها المكتبة)،
 * وورقةُ «الكلّ» لمسلسلاتي/أفلامي (سقفُ ٥٠ ثمّ بابُ المكتبة — D-733).
 * ⚖️ ما بقي ويباً بقرار: عدّادا المتابِعين (ورقةُ `FollowCountButton` بلا باب `v1` بعد).
 */
const HEADER_H = 64;

export function HomeScreen() {
  const { t, tokens, me } = useApp();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const navH = navHeight(insets.bottom);
  const { home, extras, backdropOf } = useHome();
  const d = home.data ?? null;
  /* K1 — `home.open`: من التركيب إلى أوّل رسمٍ فيه حمولة، و`cached` يفصل الكاشَ عن الشبكة كما في المكتبة.
     والإقلاعُ صار إلى الرئيسيّة ⇒ `coldstart.home` هنا، وهو يُسكت `coldstart.library` الذي صار يقيس «متى
     فُتحت المكتبةُ أوّلَ مرّة» لا الإقلاع */
  const [endOpen] = useState(() => span("home.open", { cached: qc.getQueryData(HOME_KEY) ? 1 : 0 }));
  /* 🆕 D-1350 — أنميشنُ الفتح ينتظر هذه: الرئيسيّةُ معها حمولتُها (أو عرفت أنّها لن تصل) */
  const openReady = !!home.data || home.isError;
  useEffect(() => {
    if (openReady) opening.ready();
  }, [openReady]);
  useEffect(() => {
    if (!d) return;
    afterPaint(() => {
      endOpen();
      coldStartOnce("coldstart.home");
    });
  }, [d, endOpen]);
  /* K3 — التبويبُ ثابت: «وصلتُ» عند كلِّ ظهورٍ لا عند التركيب وحدَه — ومعه أنّ للمجموعة رئيسيّةً يُرجع إليها */
  useFocusEffect(
    useCallback(() => {
      homeSeen();
      tabLanded("home");
    }, []),
  );
  useRefetchOnFocus(["home"]);
  /* 🆕 M4-fix2 — شارتا الظرف والجرس تُسألان وحدَهما (طلبٌ خفيف) عند الظهور والعودة من الخلفيّة — لا تنتظران الحمولةَ كلَّها */
  useBadges(!!d);
  /* D-1085 — الرئيسيّةُ رسمت حمولتَها: تُسخَّن «اكتشف» (التريلرات و«قوائم» معها) مرّةً في الجلسة بعد أن تهدأ */
  useEffect(() => {
    if (d) {
      warmDiscoverOnce();
      /* 🆕 1.12.7 — والصندوقُ إن لم تكن له نسخةٌ محفوظة (الظرفُ في رأس هذه الشاشة بابُه) */
      warmMessagesOnce();
    }
  }, [d]);
  /* 🆕 D-1238 — وملفُّ صاحب الحساب: صورتُه في رأس هذه الشاشة بابُه، فيُجلب قبل الضغطة (`profileData.ts`) */
  useEffect(() => {
    if (d) warmOwnProfile(d.header.username);
  }, [d]);
  const toastHost = useRef<ToastHostRef>(null);
  const scroll = useRef<ScrollView>(null);
  /* D-1318 — خطوةُ «ملفك» في الجولة تشير إلى الصورة، والصورةُ في رأس العمود: تُصعَد الصفحةُ قبل أن تُقاس */
  const avatarAnchor = useTourAnchor("home-avatar", () => scroll.current?.scrollTo({ y: 0, animated: true }));
  /* والجولةُ على الشاشة (عرضاً أو خطوةً) تُخفي تلميحَي الرئيسيّة — مخفيّان لا منزوعان، فلا يُحسبان مقروءَين */
  const tourBusy = useSyncExternalStore(tourStore.subscribe, tourStore.busy);
  /* وعرضُ الجولة يظهر على الرئيسيّة وحدَها — فتقول هي إنّها الظاهرة (`store.ts`: لماذا لا تكفي حالةُ التبويبات) */
  useFocusEffect(
    useCallback(() => {
      tourStore.setHome(true);
      return () => tourStore.setHome(false);
    }, []),
  );
  const onError = useCallback(
    (e: unknown) => {
      const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[key];
      toastHost.current?.say(typeof msg === "string" ? msg : t.apiInternal);
    },
    [t],
  );

  /* ——— الملاحة: كلُّ بابٍ من الرئيسية يعود إليها (D-949 بـ`returnTo:"home"`) ——— */
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  /* D-1075 — رئيسيّةٌ رُفعت عند الإقلاع (`boot=1`): زرُّ الرجوع يخرج من التطبيق كما كان يفعل من
     الويب، لا يكشف رئيسيّةَ الويب المحمَّلةَ تحتها */
  const { switchTo, bootBack } = useBootRoot();
  /* K3 — الرجوعُ للتبويب الظاهر وحدَه: الجذورُ الأربعة مركَّبةٌ معاً، ومستمعٌ في تبويبٍ مخفيّ كان سيسبق الظاهر */
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (bootBack("/home")) return true;
        back();
        return true;
      });
      return () => sub.remove();
    }, [back, bootBack]),
  );
  const [leaving, setLeaving] = useState(false);
  const openWeb = useCallback(
    (path: string) => {
      /* 🆕 11-N · N1 — ملفُّ الشخص أصليٌّ: رابطُه لا يفتح الويب (`member/open.ts`) */
      { const who = profileHandleOf(path); if (who) return openProfile(router, who, "home"); }
      /* 🆕 D-1213 — «النشاط» أصليّ: دفعٌ فوق هذه الشاشة لا بابٌ ويبيّ */
      if (path === "/activity") return void router.push({ pathname: "/activity", params: { from: "home" } });
      /* 🆕 D-1214 — و«الإحصائيات» (خاناتُ بطاقة الأرقام) كذلك */
      if (path === "/stats") return void router.push({ pathname: "/stats", params: { from: "home" } });
      /* 🆕 D-1317 — و«تقويم أعمالك» (عنوانُ شريط الأسبوع) شاشةٌ أصليّةٌ كذلك */
      if (path === "/calendar") return void router.push({ pathname: "/calendar", params: { from: "home" } });
      /* 🆕 D-1357 (V-C · C1) — و«تقييماتي» (عنوانُ قسم التقييمات و«الكلّ»): آخرُ بابٍ ويبيٍّ في أقسام الرئيسيّة */
      if (path === "/ratings") return void router.push({ pathname: "/ratings", params: { from: "home" } });
      /* 🆕 D-1352 (V-A) — «المجتمع» جذرٌ أصليٌّ خامس (D-1171) والشريطُ ينتقل إليه أصليّاً؛ عنوانُ «أصدقاؤك الآن» و«عرض
         الكلّ» كانا ما زالا يفتحان صفحةَ الويب. `/people` وحدَه — بلا استعلام — هو ما يُطلب من هذه الشاشة. */
      if (path === "/people") return void switchTo("/community");
      if (leaving) return;
      setLeaving(true);
      void shell.open(path, { returnTo: "home" }).then((layered) => {
        setLeaving(false);
        /* 🆕 K3b — ظهرت طبقةً ⇒ هذه الشاشةُ تبقى تحتها كما هي (لا نزعَ ولا بناء) */
        if (!layered) back();
      });
    },
    [leaving, back, router, switchTo],
  );
  const openTitle = useCallback((kind: "tv" | "movie", id: number) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from: "home" } }), [router]);
  const openList = useCallback((id: string) => router.push({ pathname: "/list/[id]", params: { id, from: "home" } }), [router]);

  /* 🆕 «من Stremio» (خطّةُ Stremio، ٢٢ أكتوبر) — بعد «أكمل المشاهدة» أينما كان في ترتيب العضو، ولـLoopz+ وحده (لا يُسأل
     الخادمُ لغيره). الجوابُ يُخفي الإشارةَ فوراً ويُرسل بعد «تراجع» (`useStremioAnswer`)، وبلا منتظرةٍ لا قسم */
  const stremioQ = useStremio(!!me?.plus);
  const stremioAns = useStremioAnswer(toastHost);
  const stremioNode = useMemo(() => {
    const st = stremioQ.data;
    if (!st?.plus) return null;
    const items = st.items.filter((x) => !stremioAns.hidden.has(x.id));
    if (!items.length) return null;
    return (
      <StremioCard
        key="stremio"
        items={items}
        count={Math.max(items.length, st.count - stremioAns.hidden.size)}
        onAnswer={stremioAns.answer}
        onAll={() => router.push("/stremio")}
        onOpen={(x) => openTitle(x.kind, x.tmdb_id)}
      />
    );
  }, [stremioQ.data, stremioAns.hidden, stremioAns.answer, router, openTitle]);

  const openHref = useCallback(
    (href: string) => {
      const m = /^\/(show|movie)\/(\d+)/.exec(href);
      if (m) return openTitle(m[1] === "show" ? "tv" : "movie", Number(m[2]));
      /* K3 — المكتبةُ والبحثُ تبويبان: انتقالٌ إليهما لا دفعٌ فوق الرئيسيّة */
      if (href.startsWith("/library")) return switchTo("/library");
      if (href === "/search" || href.startsWith("/search?")) return switchTo("/search");
      openWeb(href);
    },
    [openTitle, openWeb, switchTo],
  );

  /* ——— وضعُ العرض: الكاشُ مصدرُه، وما في الطريق يسبقه مؤقّتاً (وصفةُ `HomeViewSwitch`) ———
     🆕 D-1323 (تسجيلُ أحمد ٨ أكتوبر: حفظ «بصري» ثمّ «مختصر» من «التخصيص» والرئيسيّةُ لم تتبدّل): كان هنا
     `viewLocal` يُكتب عند أوّل ضغطةٍ على المبدّل **ولا يُمحى أبداً**، فيحجب كلَّ ما يحفظه «التخصيص» (والأجهزةُ الأخرى)
     حتى إغلاق التطبيق — التبويبُ ثابتٌ لا يُفكّ (K3). الآن القيمةُ من `prefs.view` في الكاش، و`viewPending` يسبقها
     **ما دامت كتابةٌ في الطريق فقط**: ضغطتان متلاحقتان لا تومضان بردِّ الأولى، ثمّ يعود الحكمُ إلى الخادم.
     🆕 D-1321 — والدورةُ ثلاثةُ أوضاع (بصريّ ← مختصر ← مزدوج)، والكتاباتُ طابورٌ لا تتسابق على العمود (كالويب). */
  const [viewPending, setViewPending] = useState<HomeView | null>(null);
  /* D-1425 — كاشٌ محفوظٌ من نسخةٍ سابقة قد يحمل «مختصر» الذي لم يعد وضعاً: يُقرأ «مزدوجاً» كما يقرؤه الخادم */
  const view: HomeView = viewPending ?? sanitizeHomeView(d?.prefs.view);
  const viewQueue = useRef<Promise<unknown>>(Promise.resolve());
  const viewWanted = useRef<HomeView | null>(null);
  const toggleView = useCallback(() => {
    const next = nextHomeView(view);
    haptic.pick();
    viewWanted.current = next;
    setViewPending(next);
    const stamp = (v: HomeView) => qc.setQueryData<HomePayload>(HOME_KEY, (prev) => (prev ? { ...prev, prefs: { ...prev.prefs, view: v } } : prev));
    stamp(next);
    viewQueue.current = viewQueue.current
      .catch(() => {})
      .then(() => write<{ view: HomeView }>("/api/v1/me/prefs/home-view", { view: next } satisfies HomeViewBody))
      .catch(() => toastHost.current?.say(t.errViewSave))
      .finally(() => {
        /* آخرُ ما طُلب وحدَه يُنهي الانتظار — وردُّ جلبٍ أقدمَ وصل في الأثناء يُصحَّح قبل رفع الحجاب */
        if (viewWanted.current !== next) return;
        stamp(next);
        setViewPending(null);
      });
  }, [view, qc, t]);


  /* ——— «شاهدتُها» على بطاقة «أكمل المشاهدة» (D-437) — **تفاؤلٌ ثمّ كتابةٌ ثمّ إعادةُ جلب، بهذا الترتيب** ———
     D-1088 (بلاغُ أحمد على 1.11.9 بتسجيل: «الصحّ لا يعمل»): كانت الضغطةُ تكتب ثمّ **تنتظر إعادةَ جلب الرئيسيّة
     كاملةً** قبل أن تُظهر شيئاً — والجلبُ ثوانٍ على 5G — فبدت ميّتة؛ وأثناء الانتظار قفلٌ واحد (`busyKey`)
     يُسقط ضغطاتِ البطاقات الأخرى صامتةً. الآن وصفةُ `ContinueCard.mark` الويب حرفاً: البطاقةُ تتقدّم في
     الكاش فوراً (`setQueryData`)، والتوستُ فوراً، والخادمُ يلحق في الخلفيّة ثمّ يتجدّد الجلبُ بلا انتظار؛
     والفشلُ يعيد البطاقةَ ويقول سببَه. والقفلُ **لكلِّ بطاقةٍ وحدَها** كالويب. */
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(() => new Set());
  const lock = useCallback((key: string, on: boolean) => {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  /** التفاؤل: يُبدّل بطاقةً واحدةً في حمولة الرئيسيّة المكاشة — الوسمُ نفسُه الذي يعيده الخادم فلا سباق */
  const patchCard = useCallback(
    (key: string, fn: (c: HomePayload["sections"]["continue"][number]) => HomePayload["sections"]["continue"][number]) =>
      qc.setQueryData<HomePayload>(HOME_KEY, (prev) => (prev ? { ...prev, sections: { ...prev.sections, continue: prev.sections.continue.map((c) => (c.key === key ? fn(c) : c)) } } : prev)),
    [qc],
  );
  const [celebrate, setCelebrate] = useState<{ tmdbId: number; title: string; posterPath: string | null; aired: number } | null>(null);
  const markNext = useCallback(
    async (card: Extract<HomePayload["sections"]["continue"][number], { type: "show" }>) => {
      if (card.season == null || card.episode == null || busyKeys.has(card.key)) return;
      lock(card.key, true);
      haptic.success();
      const cur = { season: card.season, episode: card.episode };
      const body = { showTmdbId: card.id, season: cur.season, episode: cur.episode, runtime: card.runtime, title: card.title, posterPath: card.poster_path };
      /* الحلقةُ الأخيرةُ تُنهي المسلسل ⇐ احتفالٌ بدل «تراجع» — شرطُ `finishedAll` في `ContinueCard` الويب حرفاً */
      const finishedAll = card.aired > 0 && card.watched + 1 >= card.aired;
      /* التفاؤل كالويب (`bump` + `ep.e + 1`): العدّادُ والخيطُ والحلقةُ تتقدّم قبل ردّ الخادم؛ الانتقالُ بين
         المواسم لا تعرفه البطاقةُ فيصحّحه الجلبُ حين يصل — كما في الويب */
      const advanced = (c: typeof card) => ({ ...c, watched: c.watched + 1, episode: cur.episode + 1, episode_label: `S${cur.season} E${cur.episode + 1}`, progress: c.aired > 0 ? Math.round(((c.watched + 1) / c.aired) * 100) : c.progress });
      const restored = (c: typeof card) => ({ ...c, watched: card.watched, episode: cur.episode, episode_label: card.episode_label, progress: card.progress });
      patchCard(card.key, (c) => (c.type === "show" ? advanced(c) : c));
      if (finishedAll) setCelebrate({ tmdbId: card.id, title: card.title, posterPath: card.poster_path, aired: card.aired });
      const saved = write<TrackResult>("/api/v1/track/episode", { ...body, watched: true } satisfies ToggleEpisodeBody)
        .then(() => {
          void qc.invalidateQueries({ queryKey: HOME_KEY });
          return true;
        })
        .catch((e) => {
          patchCard(card.key, (c) => (c.type === "show" ? restored(c) : c));
          setCelebrate(null);
          onError(e);
          return false;
        })
        .finally(() => lock(card.key, false));
      if (finishedAll) return;
      /* «تراجع» كتوست `ContinueCard` الويبيّ حرفاً: `S1 E2 ✓` والفعلُ يعكس الكتابةَ نفسَها — بعد أن تصل، لا قبلها */
      toastHost.current?.say(
        `S${cur.season} E${cur.episode} ✓`,
        {
          label: t.undoWatched,
          onPress: () => {
            patchCard(card.key, (c) => (c.type === "show" ? restored(c) : c));
            void saved.then((ok) => {
              if (!ok) return;
              write<TrackResult>("/api/v1/track/episode", { ...body, watched: false } satisfies ToggleEpisodeBody)
                .then(() => qc.invalidateQueries({ queryKey: HOME_KEY }))
                .catch(onError);
            });
          },
        },
        6000,
        "success",
      );
    },
    [busyKeys, lock, patchCard, qc, onError, t],
  );

  /* ——— D-1079 — الصحُّ على بطاقات القوائم وطابور «للمشاهدة» — `ListContinueCard.mark` الويب ———
     الفيلمُ يُعلَّم مشاهَداً؛ والمسلسلُ يُختم كلُّه كما من صفحته (D-604): متابعةٌ أوّلاً إن لم يكن في
     المكتبة، ثمّ `show-watched` الذي يعيد ما أضافه. **والرجعةُ صادقة** (D-047): «تراجع» يحذف ما أضافته
     الضغطةُ وحدَها، ومن لم يكن متابعاً قبلها لا يبقى متابعاً بعدها (D-238). الإعادةُ تقلب البطاقةَ إلى
     التالي — وهو الفعلُ نفسُه. الاتّجاهُ الثاني في الويب ضغطةٌ ثانية؛ هنا توستُ «تراجع» كجارتها (D-437).
     D-1088 — والتفاؤلُ هنا أيضاً: العدّادُ يتقدّم فوراً والتالي يبدّله الجلبُ حين يصل. */
  const markListNext = useCallback(
    async (card: Exclude<HomePayload["sections"]["continue"][number], { type: "show" }>) => {
      if (busyKeys.has(card.key)) return;
      lock(card.key, true);
      haptic.success();
      const n = card.next;
      const before = card.watched;
      patchCard(card.key, (c) => (c.type === "show" ? c : { ...c, watched: c.watched + 1 }));
      let undo: (() => Promise<unknown>) | null = null;
      const saved = (async () => {
        if (n.kind === "movie") {
          await write<TrackResult>("/api/v1/track/movie", { movieTmdbId: n.id, runtime: null, watched: true } satisfies ToggleMovieBody);
          undo = () => write<TrackResult>("/api/v1/track/movie", { movieTmdbId: n.id, runtime: null, watched: false } satisfies ToggleMovieBody);
        } else {
          const followedHere = !n.followed;
          if (followedHere) await write<TrackResult>("/api/v1/track/follow", { tmdbId: n.id, mediaType: "tv", title: n.title ?? "", posterPath: n.poster_path } satisfies FollowBody);
          const res = await write<ShowWatchedResult>("/api/v1/track/show-watched", { showTmdbId: n.id } satisfies ShowRefBody);
          const added = res?.added ?? [];
          undo = async () => {
            if (added.length) await write<TrackResult>("/api/v1/track/episodes-unmark", { showTmdbId: n.id, episodes: added } satisfies UnmarkEpisodesBody);
            if (followedHere) await write<TrackResult>("/api/v1/track/unfollow", { tmdbId: n.id, mediaType: "tv" } satisfies UnfollowBody);
          };
        }
        void qc.invalidateQueries({ queryKey: HOME_KEY });
        return true;
      })()
        .catch((e) => {
          patchCard(card.key, (c) => (c.type === "show" ? c : { ...c, watched: before }));
          onError(e);
          return false;
        })
        .finally(() => lock(card.key, false));
      toastHost.current?.say(
        `${n.title ?? card.list_name} ✓`,
        {
          label: t.undoWatched,
          onPress: () => {
            patchCard(card.key, (c) => (c.type === "show" ? c : { ...c, watched: before }));
            void saved.then((ok) => {
              if (!ok || !undo) return;
              undo()
                .then(() => qc.invalidateQueries({ queryKey: HOME_KEY }))
                .catch(onError);
            });
          },
        },
        6000,
        "success",
      );
    },
    [busyKeys, lock, patchCard, qc, onError, t],
  );

  /* ——— الضغطُ المطوّل: مضيفان بقائمتَي الويب — «مكتبتي» لصفوفي و«اكتشف» لما ليس عندي ——— */
  const holdLib = useRef<HoldHostRef<CardItem>>(null);
  const holdDisc = useRef<HoldHostRef<CardItem>>(null);
  const [store] = useState(createCardStore);
  const invalidateHome = useCallback(() => void qc.invalidateQueries({ queryKey: HOME_KEY }), [qc]);
  const actLib = useCallback(
    async (a: HoldAction, item: CardItem) => {
      if (a === "review") {
        openTitle(item.kind, item.id);
        return;
      }
      try {
        if (a === "drop" || a === "resume") await write<unknown>("/api/v1/track/dropped", { tmdbId: item.id, mediaType: item.kind, dropped: a === "drop" } satisfies SetDroppedBody);
        else if (a === "next") await write<unknown>("/api/v1/track/next-episode", { showTmdbId: item.id } satisfies ShowRefBody);
        /* 🆕 D-1280 — «ابدأ» · «إيقاف مؤقّت» · «كمّل»: كتابةٌ ثمّ قراءةُ الرئيسيّة من جديد — العملُ ينتقل بين صفَّين،
           والخادمُ وحدَه يعرف موضعَه وحلقتَه التالية */
        else if (a === "start" || a === "pause" || a === "unpause") await write<unknown>("/api/v1/track/watch-state", { showTmdbId: item.id, state: a === "start" ? "started" : a === "pause" ? "paused" : null } satisfies WatchStateBody);
        else if (a === "remove") {
          /* «إزالة» لِما لم يبدأ — حذفٌ من المكتبة، ورجعتُه متابعةٌ من جديد (لا تقدّمَ يضيع: لم يبدأ) */
          await write<unknown>("/api/v1/track/unfollow", { tmdbId: item.id, mediaType: item.kind } satisfies UnfollowBody);
          toastHost.current?.say(
            t.holdRemoved,
            {
              label: t.undoWatched,
              onPress: () =>
                void write<unknown>("/api/v1/track/follow", { tmdbId: item.id, mediaType: item.kind, title: item.title, posterPath: item.posterPath } satisfies FollowBody)
                  .then(invalidateHome)
                  .catch(onError),
            },
            6000,
            "info",
          );
        }
        else if (a === "rewatch") await write<unknown>("/api/v1/track/rewatch", { showTmdbId: item.id } satisfies ShowRefBody);
        else if (a === "all") {
          if (item.kind === "tv") await write<unknown>("/api/v1/track/show-watched", { showTmdbId: item.id } satisfies ShowRefBody);
          else await write<unknown>("/api/v1/track/movie", { movieTmdbId: item.id, runtime: null, watched: true } satisfies ToggleMovieBody);
        }
        invalidateHome();
      } catch (e) {
        onError(e);
        return false;
      }
    },
    [openTitle, invalidateHome, onError, t],
  );
  /* D-1328 — إشعارُ «للمشاهدة» من الضغط المطوّل يمرّ بمضيف الرئيسيّة نفسِه */
  const sayHome = useCallback((text: string, tone: ToastTone) => toastHost.current?.say(text, undefined, undefined, tone), []);
  const actDiscBase = useCardActs<CardItem & { poster_path: string | null }>(store, { onReview: (c) => openTitle(c.kind, c.id), onError, say: sayHome });
  const actDisc = useCallback(
    async (a: HoldAction, item: CardItem) => {
      const ok = await actDiscBase(a, { ...item, poster_path: item.posterPath });
      if (ok && a !== "review") invalidateHome();
      return ok;
    },
    [actDiscBase, invalidateHome],
  );
  const holdLibOpen = useCallback((item: CardItem, anchor: CardAnchor) => holdLib.current?.open(item, anchor), []);
  const holdDiscOpen = useCallback((item: CardItem, anchor: CardAnchor) => holdDisc.current?.open(item, anchor), []);
  const asItemSame = useCallback((item: CardItem) => item, []);
  const toWatchOf = useCallback((item: CardItem) => toWatchState(store.mark(`${item.kind}-${item.id}`)), [store]);

  /* ——— الأوراق: ترتيبُ الأقسام · أولويّةُ صفٍّ · «الكلّ» ——— */
  const [queueRow, setQueueRow] = useState<QueueOrderBody["row"] | null>(null);
  /* 🆕 D-1353 — «الكلّ» والعنوانُ في كلِّ قسمٍ يفتحان ورقةَ القسم نفسِه (`HomeAllSheet`)؛ و`who`: أسماءُ أصدقاء عملٍ من الصفّ */
  const [allSheet, setAllSheet] = useState<AllSection | null>(null);
  const [who, setWho] = useState<HomeFriendCard | null>(null);
  /* D-1094 — «تمّ» يرتّب الصفَّ **فوراً** ثمّ يكتب (تسجيلُ أحمد على 1.11.9: رتّب «للمشاهدة» وضغط «تمّ»
     فبقي الصفُّ كما كان — الترتيبُ حُفظ فعلاً في `home_prefs` لكنّ الصفَّ ينتظر إعادةَ جلب الرئيسيّة كاملةً).
     الترتيبُ هنا `applyQueueOrder` نفسُها التي يرتّب بها الخادم — فالتفاؤلُ والجلبُ اللاحقُ يتّفقان حرفاً؛
     والفشلُ يعيد الحمولةَ السابقة ويقول سببَه. `towatchlist` لا يُرسم ترتيبُه في الرئيسيّة فيكفيه الجلب. */
  const saveQueue = useCallback(
    (row: QueueOrderBody["row"], keys: string[]) => {
      setQueueRow(null);
      const prev = qc.getQueryData<HomePayload>(HOME_KEY);
      if (prev) qc.setQueryData<HomePayload>(HOME_KEY, reorderHomePayload(prev, row, keys));
      write<{ done: true }>("/api/v1/me/prefs/queue-order", { row, keys } satisfies QueueOrderBody)
        .then(invalidateHome)
        .catch((e) => {
          if (prev) qc.setQueryData<HomePayload>(HOME_KEY, prev);
          onError(e);
        });
    },
    [qc, invalidateHome, onError],
  );
  /* «للمشاهدة» في «تابِع المشاهدة» — `setToWatchQueue` الويب: تفاؤلٌ لا، كتابةٌ ثمّ إعادةُ جلب وتوست؛ الاهتزازُ من الباب الواحد */
  const [toWatchBusy, setToWatchBusy] = useState(false);
  const setToWatch = useCallback(
    async (on: boolean) => {
      if (toWatchBusy) return;
      setToWatchBusy(true);
      haptic.pick();
      try {
        await write<{ on: boolean }>("/api/v1/me/prefs/to-watch", { on } satisfies ToWatchBody);
        await qc.invalidateQueries({ queryKey: HOME_KEY });
        toastHost.current?.say(on ? t.listPlaylistOnToast : t.listPlaylistOffToast, undefined, undefined, on ? "success" : "info");
      } catch (e) {
        onError(e);
      } finally {
        setToWatchBusy(false);
      }
    },
    [toWatchBusy, qc, onError, t],
  );
  const queueItemsOf = useCallback((items: HomeQueueItem[]) => items.map((q) => ({ key: q.key, title: q.title ?? "", poster_path: q.poster_path, media_type: q.media_type ?? ("movie" as const) })), []);

  /* ——— 🆕 الودجتات: كلُّ تحميلٍ للرئيسيّة يجدّدها (وكلُّ فعلٍ يبطل الرئيسيّة يعيد تحميلها) — `widget/feed.ts` ——— */
  useEffect(() => {
    if (d) void refreshWidgets();
  }, [d]);

  /* ——— 🆕 ما يصل من الودجت: «الكل» يفتح ورقةَ القسم، و«ابدأ» من الخانة الباهتة يترك هنا توستَ «تراجع» ——— */
  useEffect(
    () =>
      widgetBus.subscribe((e) => {
        if (e.type === "all") {
          setAllSheet(e.section);
          return;
        }
        toastHost.current?.say(
          t.widgetStartedToast(e.title),
          {
            label: t.undoWatched,
            onPress: () =>
              void write<unknown>("/api/v1/track/watch-state", { showTmdbId: e.id, state: e.action === "start" ? null : "paused" } satisfies WatchStateBody)
                .then(() => qc.invalidateQueries({ queryKey: HOME_KEY }))
                .catch(onError),
          },
          6000,
          "success",
        );
      }),
    [t, qc, onError],
  );

  /* ——— الرأسُ يختفي بالتمرير كالويب (`chrome-top`)، والغلافُ ثابتٌ خلفه ——— */
  const chrome = useChromeHide();
  const topH = insets.top + HEADER_H;
  const refresh = usePullRefresh([HOME_KEY, HOME_EXTRAS_KEY], topH);
  /* 🆕 D-1377 — لا خطَّ تحت رأس الرئيسيّة أبداً (أحمد: «شيل الخط»؛ كان يظهر بعد أوّل تمرير — D-1233)، فلا حالةَ تُتابَع هنا */
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => chrome.onScroll(e), [chrome]);
  const bottomPad = navH + 24;

  /* 🆕 D-1379 — المقاساتُ من مصدرٍ واحد وبنسبة عرض الشاشة (المرجعُ جهازُ خالد ٤١٢) */
  const sizes = usePosterSizes(d?.prefs.density ?? "comfortable");
  const posterW = sizes.posterW;
  const contSize = useMemo(() => ({ w: sizes.continueW, h: sizes.continueH }), [sizes.continueW, sizes.continueH]);
  const cap = useCallback((n: number) => (d ? capCards(n, d.prefs.cards) : n), [d]);

  useEffect(() => {
    if (!d) return;
    const m = new Map<string, { saved: boolean; progress: number; completed: boolean; dropped: boolean } | null>();
    for (const r of [...d.sections.friends, ...(extras.data?.trending ?? [])]) {
      const saved = "saved" in r ? r.saved : r.added;
      m.set(`${r.kind}-${r.id}`, saved || r.watched ? { saved: saved && !r.watched, progress: r.watched ? 100 : 0, completed: r.watched, dropped: false } : null);
    }
    store.setBase(m);
  }, [d, extras.data, store]);
  const watchStates = d?.watch_states;
  const asItem = useCallback(
    /* 🆕 D-1280 — `known`: الصفُّ يعرف تقدّمَ العمل حقّاً («للمشاهدة» · «مسلسلاتي» · «أفلامي»)، فيُعلن «لم يبدأ».
       صفٌّ بلا تقدّم («تقييماتي») لا يعلنه — وإلّا عرضت القائمةُ «إزالة» فوق عملٍ مُشاهَد. و`watchStates` خريطةُ
       الخادم: «ابدأ» ضُغط أو «إيقاف مؤقّت»، في أيِّ صفٍّ ظهر العمل */
    (c: { key: string; kind: "tv" | "movie"; id: number; title: string; poster_path: string | null; progress?: number | null; count?: number | null; watched?: boolean; known?: boolean }): CardItem => {
      const completed = c.watched === true || (c.progress ?? 0) >= 100;
      const state = c.kind === "tv" ? watchStates?.[String(c.id)] : undefined;
      return {
        key: c.key,
        kind: c.kind,
        id: c.id,
        title: c.title,
        posterPath: c.poster_path,
        progress: c.progress ?? 0,
        count: c.count ?? undefined,
        completed,
        dropped: false,
        unstarted: c.known === true && !completed && !state && (c.kind === "movie" || (c.progress ?? 0) === 0),
        paused: state === "paused" && !completed,
      };
    },
    [watchStates],
  );
  const pressItem = useCallback((it: CardItem) => openTitle(it.kind, it.id), [openTitle]);

  /* ——— الأقسام: مفتاحٌ ⇐ عقدةٌ، والغائبُ لا يُرسم (خريطةُ `sections` في الصفحة حرفاً) ——— */
  const sections = useMemo(() => {
    if (!d) return null;
    const s = d.sections;
    const mixedRow = (x: HomeMixedCard) => <MediaRow key={x.key} title={x.title} subtitle={mixedRowSubtitle(x)} posterPath={x.poster_path} progress={x.progress} onPress={() => openTitle(x.kind, x.id)} />;
    const posterRow = (items: CardItem[], hold: typeof holdLibOpen = holdLibOpen) => <Rail>{items.map((it) => <PosterCard key={it.key} item={it} width={posterW} onPress={pressItem} onHold={hold} />)}</Rail>;
    /* 🗑️ D-1488 — «رتّب الأقسام» غادر رؤوسَ الأقسام الخمسة (أحمد ٢٠ أكتوبر: «شيلها منها»)؛ البابُ صار بطاقةَ «خصّص رئيسيتك» آخرَ الصفحة والإعدادات */
    const map: Record<HomeSection, React.ReactNode> = {
      continue:
        s.continue.length > 0 ? (
          <View key="continue">
            {/* 🆕 D-1507 — بطاقةُ «طابور الأفلام» تفتح ورقتَه (ترتيبُه و✓) بدل صفحة أوّل فيلمٍ فيه */}
            <SectionHeader title={t.continueWatching} icon="play" onTitle={() => setAllSheet("continue")} seeAll={d.queues.continue.length > 1 ? t.allWord : undefined} onSeeAll={() => setAllSheet("continue")} />
            {sectionView(view, "continue") === "compact" ? (
              <Column>{s.continue.map((c) => <ContinueCard key={c.key} card={c} size={contSize} variant="row" backdropPath={c.type === "show" ? c.backdrop_path : backdropOf(c.next.kind, c.next.id)} onPress={() => (c.type === "show" ? openTitle("tv", c.id) : c.type === "towatch" ? setAllSheet("queue") : openList(c.list_id))} onCheck={c.type === "show" ? () => void markNext(c) : () => void markListNext(c)} busy={busyKeys.has(c.key)} onHold={c.type === "show" ? (anchor) => holdLibOpen({ key: c.key, kind: "tv", id: c.id, title: c.title, posterPath: c.poster_path, progress: c.progress, completed: false, dropped: false, noNext: true }, anchor) : undefined} />)}</Column>
            ) : (
              <Rail>{s.continue.map((c) => <ContinueCard key={c.key} card={c} size={contSize} variant="card" backdropPath={c.type === "show" ? c.backdrop_path : backdropOf(c.next.kind, c.next.id)} onPress={() => (c.type === "show" ? openTitle("tv", c.id) : c.type === "towatch" ? setAllSheet("queue") : openList(c.list_id))} onCheck={c.type === "show" ? () => void markNext(c) : () => void markListNext(c)} busy={busyKeys.has(c.key)} onHold={c.type === "show" ? (anchor) => holdLibOpen({ key: c.key, kind: "tv", id: c.id, title: c.title, posterPath: c.poster_path, progress: c.progress, completed: false, dropped: false, noNext: true }, anchor) : undefined} />)}</Rail>
            )}
          </View>
        ) : null,
      week: <WeekStrip key="week" days={s.week.days} entries={s.week.entries} onDay={(id) => openTitle("tv", id)} onCalendar={() => openWeb("/calendar")} />,
      towatch:
        s.towatch.items.length > 0 ? (
          <View key="towatch">
            <SectionHeader title={t.libToWatch} icon="bookmark" onTitle={() => setAllSheet("towatch")} seeAll={s.towatch.all.length > 1 ? t.allWord : undefined} onSeeAll={() => setAllSheet("towatch")} />
            {sectionView(view, "towatch") === "compact" ? <Column>{s.towatch.items.slice(0, cap(s.towatch.items.length)).map(mixedRow)}</Column> : posterRow(s.towatch.items.slice(0, cap(s.towatch.items.length)).map((x) => ({ ...asItem({ key: x.key, kind: x.kind, id: x.id, title: x.title, poster_path: x.poster_path, progress: x.progress, known: true }), noNext: true })))}
          </View>
        ) : null,
      upcoming:
        s.upcoming.length > 0 ? (
          <View key="upcoming">
            <SectionHeader title={t.libUpcoming} icon="hourglass" onTitle={() => setAllSheet("upcoming")} seeAll={s.upcoming.length > cap(s.upcoming.length) ? t.allWord : undefined} onSeeAll={() => setAllSheet("upcoming")} />
            <Column>
              {s.upcoming.slice(0, cap(s.upcoming.length)).map((x) => {
                const ep = extras.data?.upcoming_eps[x.key] ?? x.ep;
                /* 🆕 D-1323 (بلاغُ أحمد ٨ أكتوبر: «الصورة تجي، وإذا غيّرت الوضع ورجعت للبصري تصير رصاصيّة»): الشكلان كانا
                   بمفتاحٍ واحد، فيبقى الصفُّ حيّاً عند التبديل ويُستبدل جوفُه — وصورةٌ تُنشأ داخل صفٍّ قائمٍ تبقى بلا رسم.
                   «أكمل المشاهدة» و«للمشاهدة» يُهدمان ويُبنيان عند التبديل ولا يصيبهما ذلك؛ **فمفتاحٌ لكلِّ شكلٍ يجعل
                   «القادم» مثلَهما.** ⚠️ السببُ في مكتبة الصور غيرُ مثبتٍ من الحاوية — إن بقي الرماديّ فالتشخيصُ يُعاد. */
                return sectionView(view, "upcoming") === "compact" ? (
                  <MediaRow key={`c:${x.key}`} chip={x.badge} title={x.title} subtitle={ep ?? x.subtitle} onPress={() => openTitle(x.kind, x.id)} />
                ) : (
                  <MediaRow key={`v:${x.key}`} title={[x.badge, ep].filter(Boolean).join(" · ")} subtitle={x.title} posterPath={x.poster_path} onPress={() => openTitle(x.kind, x.id)} />
                );
              })}
            </Column>
          </View>
        ) : null,
      shows:
        s.shows.items.length > 0 ? (
          <View key="shows">
            <SectionHeader title={t.myShows} icon="tv" onTitle={() => setAllSheet("shows")} seeAll={t.allWord} onSeeAll={() => setAllSheet("shows")} />
            {posterRow(s.shows.items.slice(0, cap(s.shows.items.length)).map((i) => asItem({ key: `ms-${i.id}`, kind: "tv", id: i.id, title: i.title, poster_path: i.poster_path, progress: i.progress, count: i.count, watched: i.badge_tone === "watched", known: true })))}
          </View>
        ) : null,
      movies:
        s.movies.items.length > 0 ? (
          <View key="movies">
            <SectionHeader title={t.myMovies} icon="film" onTitle={() => setAllSheet("movies")} seeAll={t.allWord} onSeeAll={() => setAllSheet("movies")} />
            {posterRow(s.movies.items.slice(0, cap(s.movies.items.length)).map((m) => asItem({ key: `mm-${m.id}`, kind: "movie", id: m.id, title: m.title, poster_path: m.poster_path, progress: m.progress, known: true })))}
          </View>
        ) : null,
      recap: s.recap ? (
        <View key="recap">
          <SectionHeader title={t.recapTitle} icon="book" seeAll={t.seeAll} onSeeAll={() => openWeb("/activity")} />
          <Pressable onPress={() => openWeb("/activity")} accessibilityRole="link" style={({ pressed }) => [{ marginHorizontal: PAGE_PAD, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 16, opacity: pressed ? 0.85 : 1 }]}>
            <Text size={15} weight="700" style={{ flexShrink: 1, lineHeight: 20 }}>{s.recap.line}</Text>
            <View style={{ flexDirection: "row" }}>
              {s.recap.posters.map((p, i) => {
                const u = posterFor(p, 36);
                return (
                  <View key={i} style={{ width: 36, height: 54, borderRadius: radius.sm, overflow: "hidden", borderWidth: 2, borderColor: tokens.surface, backgroundColor: tokens.surface2, marginStart: i > 0 ? -12 : 0, zIndex: 3 - i }}>
                    {u ? <Image source={{ uri: u }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : null}
                  </View>
                );
              })}
            </View>
          </Pressable>
        </View>
      ) : null,
      ratings:
        s.ratings.length > 0 ? (
          <View key="ratings">
            <SectionHeader title={t.ratingsListTitle} icon="star" onTitle={() => openWeb("/ratings")} seeAll={t.seeAll} onSeeAll={() => openWeb("/ratings")} />
            {posterRow(s.ratings.slice(0, cap(s.ratings.length)).map((r) => asItem({ key: `rt-${r.kind}-${r.id}`, kind: r.kind, id: r.id, title: `★ ${r.rating}/10 · ${r.title}`, poster_path: r.poster_path })))}
          </View>
        ) : null,
      lists:
        s.lists.cards.length > 0 || s.lists.towatch_card ? (
          <View key="lists">
            <SectionHeader title={t.listsTitle} icon="list" onTitle={() => setAllSheet("lists")} seeAll={d.queues.lists.length > 1 ? t.allWord : undefined} onSeeAll={() => setAllSheet("lists")} />
            <Rail>
              {s.lists.cards.map((c, i) => (
                <React.Fragment key={c.id}>
                  {s.lists.towatch_card && s.lists.towatch_at === i ? <ToWatchQueueCard count={s.lists.towatch_card.count} posters={s.lists.towatch_card.posters} on={s.lists.towatch_card.on} busy={toWatchBusy} onPress={() => { haptic.pick(); setQueueRow("towatchlist"); }} onToggle={(on) => void setToWatch(on)} /> : null}
                  <View style={{ width: 280 }}>
                    {/* الوصفةُ نفسُها في `ListsRails` (اكتشف) — بطاقةُ القائمة الواحدة في كلِّ سطح */}
                    <ListCard
                      card={{
                        id: c.id,
                        name: c.name,
                        icon: c.kind === "smart" || c.kind === "curated" ? "sparkle-star" : undefined,
                        owner: c.mine ? null : c.owner,
                        owner_avatar: c.owner_avatar,
                        countText: c.count_label ?? t.listCount(c.item_count),
                        posters: c.posters,
                        cover: c.cover,
                        stats: c.saves || c.reviews || c.rating ? { saves: c.saves, reviews: c.reviews, rating: c.rating } : null,
                        playlist: c.playlist,
                        canSave: c.can_save,
                        savedByMe: c.saved_by_me,
                        canReview: !!c.can_review,
                        hasMyReview: !!c.my_review,
                      }}
                      onPress={() => openList(c.id)}
                    />
                  </View>
                </React.Fragment>
              ))}
              {s.lists.towatch_card && (s.lists.towatch_at < 0 || s.lists.towatch_at >= s.lists.cards.length) ? <ToWatchQueueCard count={s.lists.towatch_card.count} posters={s.lists.towatch_card.posters} on={s.lists.towatch_card.on} busy={toWatchBusy} onPress={() => { haptic.pick(); setQueueRow("towatchlist"); }} onToggle={(on) => void setToWatch(on)} /> : null}
            </Rail>
          </View>
        ) : null,
      friends:
        s.friends.length > 0 ? (
          <View key="friends">
            <SectionHeader title={t.railFriendsNow} icon="people" onTitle={() => setAllSheet("friends")} seeAll={s.friends.length > cap(12) ? t.allWord : undefined} onSeeAll={() => setAllSheet("friends")} />
            {/* 🆕 D-1353 — تحت كلِّ ملصقٍ سطرُ «مَن» (`Friends.tsx`): الملصقُ يفتح العمل، والسطرُ يفتح صاحبَه أو قائمةَ الأسماء */}
            <Rail>
              {s.friends.slice(0, cap(12)).map((r) => {
                const it = asItem({ key: `fw-${r.kind}-${r.id}`, kind: r.kind, id: r.id, title: r.title, poster_path: r.poster_path, watched: r.watched });
                return (
                  <View key={it.key} style={{ width: posterW }}>
                    <View>
                      <PosterCard item={it} width={posterW} onPress={pressItem} onHold={holdDiscOpen} />
                      <FriendBadge card={r} />
                    </View>
                    <FriendsWhoLine card={r} onProfile={(u) => openProfile(router, u, "home")} onNames={setWho} />
                  </View>
                );
              })}
            </Rail>
          </View>
        ) : null,
      trending:
        d.prefs.order.includes("trending") && (extras.data?.trending.length ?? 0) > 0 ? (
          <View key="trending">
            <SectionHeader title={t.trendingWeek} icon="trending" accent={false} />
            {posterRow((extras.data?.trending ?? []).slice(0, cap(12)).map((r) => asItem({ key: `tr-${r.kind}-${r.id}`, kind: r.kind, id: r.id, title: r.title, poster_path: r.poster_path, watched: r.watched })), holdDiscOpen)}
          </View>
        ) : null,
    };
    return d.prefs.order.flatMap((k) => (k === "continue" ? [map[k], stremioNode] : [map[k]])).filter(Boolean);
  }, [d, stremioNode, extras.data, view, posterW, contSize, cap, asItem, pressItem, openTitle, openList, openWeb, t, tokens, backdropOf, markNext, markListNext, busyKeys, setToWatch, toWatchBusy, holdLibOpen, holdDiscOpen, router]);

  return (
    <CardStoreContext.Provider value={store}>
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      {/* 🆕 D-1433 — رأسُ الرئيسيّة ثابتٌ لا يصعد (أحمد ١٦ أكتوبر: «الهيدر في الهوم لا يطلع فوق، خلّه ثابت والباقي يكون
          تحته»): الصفحةُ تمرّ تحته وخلفيّتُه معتمة. الدوكُ وحده يتبع التمرير (حكمُه «١ أ») */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, paddingTop: insets.top, backgroundColor: tokens.bg }}>
        {/* 🆕 D-1429 — الصورةُ والاسمُ صعدا إلى هذا الصفّ مكانَ الشعار، فالرأسُ صفٌّ واحد */}
        <HomeTopBar
          h={d?.header ?? null}
          avatarRef={avatarAnchor}
          onAvatar={() => (d?.header.username ? openProfile(router, d.header.username, "home") : router.push("/settings/profile"))}
          viewSwitch={d && !d.header.show_stats ? <HomeViewSwitch view={view} onToggle={toggleView} /> : null}
          unreadSignals={d?.header.unread_signals ?? 0}
          unreadShares={d?.header.unread_shares ?? 0}
          onInbox={() => router.push({ pathname: "/messages", params: { from: "home" } })}
          onSignals={() => router.push({ pathname: "/messages", params: { tab: "alerts", from: "home" } })}
          onSettings={() => router.push("/settings")}
        />
      </View>
      {!d ? (
        home.isError ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
          </View>
        ) : (
          <Loading />
        )
      ) : (
        /* 🆕 D-1238 — **الأقسامُ التي تحت الشاشة تُفصل عن أندرويد وهي لا تُرى** (نهجُ D-1236 في «اكتشف»: نزل وسيطُها
           ~١١٦ → ~٩١ms). مسبارُ D-1235 بعدها: الرئيسيّةُ صارت الأثقل — وقفةُ ٥٠–٨٣ms على خيط الواجهة في ٣ من ٣ عودات.
           العمودُ يحمل كلَّ الأقسام ملصوقةً، وصفوفُها تركّب كلَّ بطاقاتها (صورتان واسمٌ ماشٍ لكلٍّ). تجربةٌ تُحكم بالرقم. */
        <ScrollView ref={scroll} removeClippedSubviews refreshControl={refresh} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: topH + 2, paddingBottom: bottomPad }}>
          {/* 🆕 D-1233 — **رأسُ الرئيسيّة صفٌّ واحد** (أحمد بثلاث لقطات، ٣ أكتوبر: شريك · بلس · غير مشترك): الصورةُ والاسمُ
              وشارةُ الاشتراك ومبدّلُ العرض. الغلافُ وسطرُ `@username • المتابعون` خرجا من هنا للجميع — مكانُهما الملفُّ
              الشخصيّ. **وبطاقةُ الأرقام باقيةٌ بشكلها لمن يريدها** («ابغاها ظاهره بنفس الشكل للي يبيها»): `show_stats`
              من تخصيص الرئيسيّة هو الذي يقرّر، كما كان. */}
          {/* 🆕 D-1429 — صفُّ الترحيب صعد إلى الرأس؛ البطاقةُ أوّلُ ما في الصفحة ومبدّلُ العرض خانتُها الأخيرة */}
          <HomeStats h={d.header} onStat={openHref} viewSwitch={<HomeViewSwitch view={view} onToggle={toggleView} />} />
          {!d.hints.includes("home-customize") ? (
            <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 12 }}>
              <OneTimeHint id="home-customize" text={t.hintHome} hidden={tourBusy} />
            </View>
          ) : !d.hints.includes(PRIVACY_HINT) ? (
            /* 🆕 D-1273 — **السياسةُ تَعِد: «نُعلمك داخل التطبيق»** (فقرةُ «التغييرات والتواصل»)، وتغيّرت في D-1268 بلا
               إعلام. التلميحُ القائمُ نفسُه — مرّةً ثمّ يصمت، ومحفوظٌ في الحساب فلا يعود على جهازٍ ثانٍ. **وبعد تلميح
               التخصيص لا معه**: تلميحان فوق بعضٍ يُقرآن ضجيجاً، والأوّلُ للعضو الجديد. نصٌّ بلا رابط (حكمُ أحمد:
               «نصّ أفضل») — السياسةُ صفحةُ ويب، والضغطةُ تُخرج من الرئيسيّة لأجل سطر. */
            <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 12 }}>
              <OneTimeHint id={PRIVACY_HINT} text={t.hintPrivacy} hidden={tourBusy} />
            </View>
          ) : null}
          <Gap />
          {sections?.map((node, i) => (
            <React.Fragment key={i}>
              {node}
              <Gap />
            </React.Fragment>
          ))}
          {/* 🆕 D-1488 — «خصّص رئيسيتك» مكانَ «اختر أنواعك» (الأنواعُ لا تُستعمل في الرئيسية؛ بطاقتُها انتقلت إلى «اكتشف»):
              لمن لم يرتّب أقسامَه بيده، وتختفي بعد أوّل ترتيب. تفتح «الرئيسيّة والملفّ» */}
          {d.customize_hint ? (
            <Pressable onPress={() => router.push({ pathname: "/settings/[section]", params: { section: "home" } })} accessibilityRole="link" style={{ marginHorizontal: PAGE_PAD, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.border, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 12, alignItems: "center" }}>
              <Text size={14} muted style={{ textAlign: "center" }}>{t.customizeHomeHint}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
      <HoldHost hostRef={holdLib} variant="library" toItem={asItemSame} onAction={actLib} />
      <HoldHost hostRef={holdDisc} variant="discover" toItem={asItemSame} toWatchOf={toWatchOf} onAction={actDisc} />
      {queueRow && d ? (
        <ReorderSheet
          items={queueItemsOf(queueRow === "continue" ? d.queues.continue : queueRow === "towatch" ? d.queues.towatch : queueRow === "lists" ? d.queues.lists : d.queues.towatch_list)}
          onClose={() => setQueueRow(null)}
          onDone={(keys) => saveQueue(queueRow, keys)}
        />
      ) : null}
      {allSheet && d ? (
        <HomeAllSheet
          key={allSheet}
          section={allSheet}
          d={d}
          extras={extras.data ?? null}
          asItem={asItem}
          queueItemsOf={queueItemsOf}
          toWatchBusy={toWatchBusy}
          onClose={() => setAllSheet(null)}
          onTitle={openTitle}
          onList={openList}
          onProfile={(u) => openProfile(router, u, "home")}
          onReorder={saveQueue}
          onToWatchToggle={(on) => void setToWatch(on)}
          onToWatchList={() => {
            haptic.pick();
            setAllSheet(null);
            setQueueRow("towatchlist");
          }}
          onQueue={() => setAllSheet("queue")}
        />
      ) : null}
      {who ? (
        <Sheet title={who.title} onClose={() => setWho(null)}>
          <FriendsNames {...whoOf(who)} onProfile={(u) => { setWho(null); openProfile(router, u, "home"); }} />
        </Sheet>
      ) : null}
      {celebrate ? <CelebrateSheet {...celebrate} onClose={() => setCelebrate(null)} onError={onError} /> : null}
      <ToastHost hostRef={toastHost} bottom={navH} />
      <DockLink
        k="home"
        /* 🆕 D-1433 — الدوكُ في الرئيسيّة يتبع التمرير كالمكتبة واكتشف والمجتمع (حكمُ أحمد «١ أ») والرأسُ ثابت */
        hidden={chrome.hidden}
        onGo={(k) => {
          if (k === "home") {
            scroll.current?.scrollTo({ y: 0, animated: true });
            return;
          }
          /* D-1074 — الجذورُ الأربعةُ أخوةٌ لا مكدّس: `replace` كما تفعل المكتبة/اكتشف/البحث بينها؛
             `push` كان يكدّس رئيسيّةً فوق رئيسيّة عند العودة من المكتبة */
          if (k === "library") return switchTo("/library");
          if (k === "news") return switchTo("/discover");
          if (k === "search") return switchTo("/search");
          openWeb("/people");
        }}
      />
      {/* 🗑️ D-1480 — مقعدُ الشريط (D-1277) حُذف (تسجيلُ خالد ٢٠ أكتوبر: «السواد ورى الدوك»): الشريطُ مطلقُ الموضع ويهبط مع
          التمرير، والمقعدُ كان يُبقي مكانَه فراغاً أسودَ بارتفاعه فتُقصّ الصفوفُ فوقه. الآن يمرّ المحتوى تحته كبقيّة الجذور،
          وذيلُ التمرير (`bottomPad` = الشريط + ٢٤) يُبقي آخرَ بطاقةٍ فوقه. */}
    </View>
    </CardStoreContext.Provider>
  );
}

/**
 * بطاقةُ «للمشاهدة» في صفّ القوائم — `ToWatchListCard` الويب: النقرُ يفتح ترتيبَ طابورها (`towatchlist`)،
 * والشريحةُ On/Off تُدخلها «تابِع المشاهدة» (`prefs/to-watch`).
 *
 * 🔑 D-1077 — **بطاقةُ القائمة الواحدة لا نسخةٌ ثانية** (القاعدة ٣). كانت هنا بطاقةٌ مرسومةٌ باليد
 * (صفٌّ أفقيّ بملصقاتٍ مصغّرة) فتمدّدت إلى ارتفاع جارتها في الـ`Rail` فراغاً أسود، وبدت غريبةً بين
 * قوائمه — بلاغُ أحمد على 1.11.8. الويبُ يلبسها `ListCardShell` نفسَها، والمكتبةُ الأصليّة تلبسها
 * `ListCard` نفسَها (`ListsTab`) — فهنا الوصفةُ ذاتُها بحرفها: رمزُ العلامة، سطرُ «يُبنى وحده»، بلا
 * شريط حال، وإطارٌ متقطّعٌ حين تتوقّف.
 */
function ToWatchQueueCard({ count, posters, on, busy, onPress, onToggle }: { count: number; posters: (string | null)[]; on: boolean; busy: boolean; onPress: () => void; onToggle: (on: boolean) => void }) {
  const { t } = useApp();
  return (
    <View style={{ width: 280 }}>
      <ListCard
        card={{
          id: "towatch",
          name: t.movieQueue,
          icon: "bookmark",
          owner: null,
          owner_avatar: null,
          countText: `${t.listCount(count)} · ${t.toWatchAutoNote}`,
          posters: posters.filter((x): x is string => !!x),
          cover: null,
          stats: null,
          playlist: on,
          dashed: !on,
        }}
        busy={busy}
        onPlaylist={onToggle}
        onPress={onPress}
      />
    </View>
  );
}
