import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, Platform, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useBootRoot } from "../bootRoot";
import { warmDiscoverOnce } from "../discover/DiscoverScreen";
import { useQueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import { ApiError, write } from "../api";
import { useApp } from "../state";
import { shell } from "../shell";
import { Loading, Text } from "../ui";
import { radius } from "../theme";
import { posterFor } from "../poster";
import { PosterCard, type CardAnchor, type CardItem } from "../library/PosterCard";
import { ListCard } from "../library/ListCard";
import { OneTimeHint } from "../library/OneTimeHint";
import { HoldHost, ToastHost, type HoldHostRef, type ToastHostRef } from "../HoldHost";
import { CardStoreContext, createCardStore } from "../cardStore";
import { useCardActs } from "../cardActs";
import type { HoldAction } from "../library/HoldMenu";
import { ReorderSheet } from "../library/ReorderSheet";
import { Sheet } from "../library/Sheet";
import { SectionOrderSheet } from "./SectionOrderSheet";
import { FollowsSheet } from "./FollowsSheet";
import { CelebrateSheet } from "./CelebrateSheet";
import { BottomNav, navHeight } from "../BottomNav";
import { useChromeHide } from "../ChromeHide";
import { usePullRefresh } from "../pullRefresh";
import { haptic } from "../haptics";
import { capCards } from "@/core/cardCount";
import { useHome, HOME_KEY, HOME_EXTRAS_KEY } from "./useHome";
import { HomeCover, HomeTopBar, HomeGreeting, HomeStats, COVER_SOLID } from "./HomeHeader";
import { WeekStrip } from "./WeekStrip";
import { ContinueCard, MediaRow, mixedRowSubtitle } from "./Cards";
import { SectionHeader, Rail, Column, Gap, PAGE_PAD } from "./Section";
import type { HomePayload, HomeMixedCard, HomeViewBody, HomeOrderBody, HomeQueueItem, QueueOrderBody, ToggleEpisodeBody, TrackResult, SetDroppedBody, ShowRefBody, ToggleMovieBody, ToWatchBody, FollowBody, UnfollowBody, ShowWatchedResult, UnmarkEpisodesBody } from "../contracts";
import { applyQueueOrder, type HomeSection } from "@/core/homePrefs";

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
  const { t, tokens } = useApp();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const navH = navHeight(insets.bottom);
  const { home, extras, backdropOf } = useHome();
  const d = home.data ?? null;
  /* D-1085 — الرئيسيّةُ رسمت حمولتَها: تُسخَّن «اكتشف» (التريلرات و«قوائم» معها) مرّةً في الجلسة بعد أن تهدأ */
  useEffect(() => {
    if (d) warmDiscoverOnce();
  }, [d]);
  const toastHost = useRef<ToastHostRef>(null);
  const scroll = useRef<ScrollView>(null);
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
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (bootBack("/home")) return true;
      back();
      return true;
    });
    return () => sub.remove();
  }, [back, bootBack]);
  const [leaving, setLeaving] = useState(false);
  const openWeb = useCallback(
    (path: string) => {
      if (leaving) return;
      setLeaving(true);
      void shell.open(path, { returnTo: "home" }).then(() => {
        setLeaving(false);
        back();
      });
    },
    [leaving, back],
  );
  const openTitle = useCallback((kind: "tv" | "movie", id: number) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from: "home" } }), [router]);
  const openList = useCallback((id: string) => router.push({ pathname: "/list/[id]", params: { id, from: "home" } }), [router]);
  const openHref = useCallback(
    (href: string) => {
      const m = /^\/(show|movie)\/(\d+)/.exec(href);
      if (m) return openTitle(m[1] === "show" ? "tv" : "movie", Number(m[2]));
      if (href.startsWith("/library")) return router.push("/library");
      if (href === "/search" || href.startsWith("/search?")) return router.push("/search");
      openWeb(href);
    },
    [openTitle, openWeb, router],
  );

  /* ——— وضعُ العرض: تبديلٌ محلّيٌّ فوريّ ثمّ حفظٌ (وصفةُ `HomeViewSwitch`) ——— */
  const [viewLocal, setViewLocal] = useState<"visual" | "compact" | null>(null);
  const view = viewLocal ?? d?.prefs.view ?? "visual";
  const toggleView = useCallback(() => {
    const next = view === "visual" ? "compact" : "visual";
    haptic.pick();
    setViewLocal(next);
    qc.setQueryData<HomePayload>(HOME_KEY, (prev) => (prev ? { ...prev, prefs: { ...prev.prefs, view: next } } : prev));
    write<{ view: "visual" | "compact" }>("/api/v1/me/prefs/home-view", { view: next } satisfies HomeViewBody).catch(() => toastHost.current?.say(t.errViewSave));
  }, [view, qc, t]);

  /* ——— ورقةُ عدّادَي المتابعة — `FollowCountButton` الويب؛ القفلُ (`hide_follow_lists`) يُحترم في `HomeGreeting` ——— */
  const [follows, setFollows] = useState<"followers" | "following" | null>(null);

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
    [openTitle, invalidateHome, onError],
  );
  const actDiscBase = useCardActs<CardItem & { poster_path: string | null }>(store, { onReview: (c) => openTitle(c.kind, c.id), onError });
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
  const inListOf = useCallback((item: CardItem) => !!store.mark(`${item.kind}-${item.id}`), [store]);

  /* ——— الأوراق: ترتيبُ الأقسام · أولويّةُ صفٍّ · «الكلّ» ——— */
  const [orderSheet, setOrderSheet] = useState(false);
  const [queueRow, setQueueRow] = useState<QueueOrderBody["row"] | null>(null);
  const [allSheet, setAllSheet] = useState<"shows" | "movies" | null>(null);
  const saveOrder = useCallback(
    async (next: HomeSection[]) => {
      setOrderSheet(false);
      qc.setQueryData<HomePayload>(HOME_KEY, (prev) => (prev ? { ...prev, prefs: { ...prev.prefs, order: next } } : prev));
      try {
        const r = await write<{ ok: boolean; needsPlus?: true }>("/api/v1/me/prefs/home-order", { order: next } satisfies HomeOrderBody);
        if (r.needsPlus) {
          invalidateHome();
          openWeb("/plus");
        }
      } catch (e) {
        invalidateHome();
        onError(e);
      }
    },
    [qc, invalidateHome, openWeb, onError],
  );
  /* D-1094 — «تمّ» يرتّب الصفَّ **فوراً** ثمّ يكتب (تسجيلُ أحمد على 1.11.9: رتّب «للمشاهدة» وضغط «تمّ»
     فبقي الصفُّ كما كان — الترتيبُ حُفظ فعلاً في `home_prefs` لكنّ الصفَّ ينتظر إعادةَ جلب الرئيسيّة كاملةً).
     الترتيبُ هنا `applyQueueOrder` نفسُها التي يرتّب بها الخادم — فالتفاؤلُ والجلبُ اللاحقُ يتّفقان حرفاً؛
     والفشلُ يعيد الحمولةَ السابقة ويقول سببَه. `towatchlist` لا يُرسم ترتيبُه في الرئيسيّة فيكفيه الجلب. */
  const saveQueue = useCallback(
    (row: QueueOrderBody["row"], keys: string[]) => {
      setQueueRow(null);
      const prev = qc.getQueryData<HomePayload>(HOME_KEY);
      if (prev && row !== "towatchlist") {
        const byKey = <T,>(arr: T[], keyOf: (x: T) => string) => applyQueueOrder(arr, keyOf, keys);
        const s = prev.sections;
        const q = prev.queues;
        const next: HomePayload =
          row === "continue"
            ? { ...prev, sections: { ...s, continue: byKey(s.continue, (c) => c.key) }, queues: { ...q, continue: byKey(q.continue, (x) => x.key) } }
            : row === "towatch"
              ? (() => {
                  const all = byKey(s.towatch.all, (x) => x.key);
                  return { ...prev, sections: { ...s, towatch: { all, items: all.slice(0, s.towatch.items.length) } }, queues: { ...q, towatch: byKey(q.towatch, (x) => x.key) } };
                })()
              : (() => {
                  /* صفُّ القوائم: البطاقاتُ بمعرّفها، وبطاقةُ الطابور موضعُها بين البطاقات = موضعُ مفتاحها الذي لا يطابق بطاقة */
                  const cards = byKey(s.lists.cards, (c) => c.id);
                  const ids = new Set(cards.map((c) => c.id));
                  const at = s.lists.towatch_card ? keys.findIndex((k) => !ids.has(k)) : -1;
                  return { ...prev, sections: { ...s, lists: { ...s.lists, cards, towatch_at: at } }, queues: { ...q, lists: byKey(q.lists, (x) => x.key) } };
                })();
        qc.setQueryData<HomePayload>(HOME_KEY, next);
      }
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
        toastHost.current?.say(on ? t.listPlaylistOnToast : t.listPlaylistOffToast);
      } catch (e) {
        onError(e);
      } finally {
        setToWatchBusy(false);
      }
    },
    [toWatchBusy, qc, onError, t],
  );
  const queueItemsOf = useCallback((items: HomeQueueItem[]) => items.map((q) => ({ key: q.key, title: q.title ?? "", poster_path: q.poster_path, media_type: q.media_type ?? ("movie" as const) })), []);

  /* ——— الودجت (D-929): ما كان `WidgetSync` الويبيّ يكتبه — يُكتب من هنا ——— */
  useEffect(() => {
    if (!d) return;
    try {
      new File(Paths.document, "widget.json").write(JSON.stringify(d.widget.slice(0, 3)));
    } catch {
      /* ودجتٌ قديمةٌ خيرٌ من شاشةٍ تسقط */
    }
  }, [d]);

  /* ——— الرأسُ يختفي بالتمرير كالويب (`chrome-top`)، والغلافُ ثابتٌ خلفه ——— */
  const chrome = useChromeHide();
  const topH = insets.top + HEADER_H;
  const refresh = usePullRefresh([HOME_KEY, HOME_EXTRAS_KEY], topH);
  const [pastCover, setPastCover] = useState(false);
  const pastRef = useRef(false);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      chrome.onScroll(e);
      /* حدُّ العتبة حيث يذوب الغلاف (`COVER_SOLID`) مطروحاً منه ارتفاعُ الشريط — حالةٌ واحدةٌ لا تصييرَ مع كلّ بكسل */
      const past = e.nativeEvent.contentOffset.y > COVER_SOLID - HEADER_H;
      if (past !== pastRef.current) {
        pastRef.current = past;
        setPastCover(past);
      }
    },
    [chrome],
  );
  const bottomPad = navH + 24;

  const posterW = d ? ({ compact: 96, comfortable: 118, large: 148 } as const)[d.prefs.density] : 118;
  const cap = useCallback((n: number) => (d ? capCards(n, d.prefs.cards) : n), [d]);
  /* فوق الغلاف الشريطُ شفّافٌ وأيقوناتُه بيضاء؛ وبعد تجاوز الغلاف يأخذ خلفيّةَ الصفحة ولونَها — الويبُ يتركه شفّافاً فوق المحتوى
     (تعليقُ D-479 يعترف بذلك)، وهذا تحسينٌ للتطبيق وحدَه بقاعدة أحمد (٢٢ سبتمبر): الشكلُ بما يناسب التطبيق، والوظائفُ من الويب */
  const onArt = !!d?.header.cover_url;

  useEffect(() => {
    if (!d) return;
    const m = new Map<string, { saved: boolean; progress: number; completed: boolean; dropped: boolean } | null>();
    for (const r of [...d.sections.friends, ...(extras.data?.trending ?? [])]) {
      const saved = "saved" in r ? r.saved : r.added;
      m.set(`${r.kind}-${r.id}`, saved || r.watched ? { saved: saved && !r.watched, progress: r.watched ? 100 : 0, completed: r.watched, dropped: false } : null);
    }
    store.setBase(m);
  }, [d, extras.data, store]);
  const asItem = useCallback(
    (c: { key: string; kind: "tv" | "movie"; id: number; title: string; poster_path: string | null; progress?: number | null; count?: number | null; watched?: boolean }): CardItem => ({
      key: c.key,
      kind: c.kind,
      id: c.id,
      title: c.title,
      posterPath: c.poster_path,
      progress: c.progress ?? 0,
      count: c.count ?? undefined,
      completed: c.watched === true || (c.progress ?? 0) >= 100,
      dropped: false,
    }),
    [],
  );
  const pressItem = useCallback((it: CardItem) => openTitle(it.kind, it.id), [openTitle]);

  /* ——— الأقسام: مفتاحٌ ⇐ عقدةٌ، والغائبُ لا يُرسم (خريطةُ `sections` في الصفحة حرفاً) ——— */
  const sections = useMemo(() => {
    if (!d) return null;
    const s = d.sections;
    const mixedRow = (x: HomeMixedCard) => <MediaRow key={x.key} title={x.title} subtitle={mixedRowSubtitle(x)} posterPath={x.poster_path} progress={x.progress} onPress={() => openTitle(x.kind, x.id)} />;
    const posterRow = (items: CardItem[], hold: typeof holdLibOpen = holdLibOpen) => <Rail>{items.map((it) => <PosterCard key={it.key} item={it} width={posterW} onPress={pressItem} onHold={hold} />)}</Rail>;
    const arrange = <Pressable onPress={() => setOrderSheet(true)} hitSlop={8} accessibilityRole="button"><Text size={12} weight="500" muted>{t.custArrange}</Text></Pressable>;
    const map: Record<HomeSection, React.ReactNode> = {
      continue:
        s.continue.length > 0 ? (
          <View key="continue">
            <SectionHeader title={t.continueWatching} icon="play" onTitle={() => router.push("/library")} seeAll={d.queues.continue.length > 1 ? t.allWord : undefined} seeAllLabel={t.listReorder} onSeeAll={() => setQueueRow("continue")} />
            {view === "compact" ? (
              <Column>{s.continue.map((c) => <ContinueCard key={c.key} card={c} posterW={posterW} variant="row" backdropPath={c.type === "show" ? c.backdrop_path : backdropOf(c.next.kind, c.next.id)} onPress={() => (c.type === "show" ? openTitle("tv", c.id) : c.type === "towatch" ? openTitle(c.next.kind, c.next.id) : openList(c.list_id))} onCheck={c.type === "show" ? () => void markNext(c) : () => void markListNext(c)} busy={busyKeys.has(c.key)} />)}</Column>
            ) : (
              <Rail>{s.continue.map((c) => <ContinueCard key={c.key} card={c} posterW={posterW} variant="card" backdropPath={c.type === "show" ? c.backdrop_path : backdropOf(c.next.kind, c.next.id)} onPress={() => (c.type === "show" ? openTitle("tv", c.id) : c.type === "towatch" ? openTitle(c.next.kind, c.next.id) : openList(c.list_id))} onCheck={c.type === "show" ? () => void markNext(c) : () => void markListNext(c)} busy={busyKeys.has(c.key)} />)}</Rail>
            )}
          </View>
        ) : null,
      week: <WeekStrip key="week" days={s.week.days} entries={s.week.entries} onDay={(id) => openTitle("tv", id)} onCalendar={() => openWeb("/calendar")} />,
      towatch:
        s.towatch.items.length > 0 ? (
          <View key="towatch">
            <SectionHeader title={t.libToWatch} icon="bookmark" onTitle={() => router.push("/library")} seeAll={s.towatch.all.length > 1 ? t.allWord : undefined} seeAllLabel={t.listReorder} onSeeAll={() => setQueueRow("towatch")} />
            {view === "compact" ? <Column>{s.towatch.items.slice(0, cap(s.towatch.items.length)).map(mixedRow)}</Column> : posterRow(s.towatch.items.slice(0, cap(s.towatch.items.length)).map((x) => asItem({ key: x.key, kind: x.kind, id: x.id, title: x.title, poster_path: x.poster_path, progress: x.progress })))}
          </View>
        ) : null,
      upcoming:
        s.upcoming.length > 0 ? (
          <View key="upcoming">
            <SectionHeader title={t.libUpcoming} icon="hourglass" onTitle={() => router.push("/library")} action={arrange} />
            <Column>
              {s.upcoming.slice(0, cap(s.upcoming.length)).map((x) => {
                const ep = extras.data?.upcoming_eps[x.key] ?? x.ep;
                return view === "compact" ? (
                  <MediaRow key={x.key} chip={x.badge} title={x.title} subtitle={ep ?? x.subtitle} onPress={() => openTitle(x.kind, x.id)} />
                ) : (
                  <MediaRow key={x.key} title={[x.badge, ep].filter(Boolean).join(" · ")} subtitle={x.title} posterPath={x.poster_path} onPress={() => openTitle(x.kind, x.id)} />
                );
              })}
            </Column>
          </View>
        ) : null,
      shows:
        s.shows.items.length > 0 ? (
          <View key="shows">
            <SectionHeader title={t.myShows} icon="tv" onTitle={() => router.push("/library")} action={arrange} seeAll={t.allWord} onSeeAll={() => setAllSheet("shows")} />
            {posterRow(s.shows.items.slice(0, cap(s.shows.items.length)).map((i) => asItem({ key: `ms-${i.id}`, kind: "tv", id: i.id, title: i.title, poster_path: i.poster_path, progress: i.progress, count: i.count, watched: i.badge_tone === "watched" })))}
          </View>
        ) : null,
      movies:
        s.movies.items.length > 0 ? (
          <View key="movies">
            <SectionHeader title={t.myMovies} icon="film" onTitle={() => router.push("/library")} action={arrange} seeAll={t.allWord} onSeeAll={() => setAllSheet("movies")} />
            {posterRow(s.movies.items.slice(0, cap(s.movies.items.length)).map((m) => asItem({ key: `mm-${m.id}`, kind: "movie", id: m.id, title: m.title, poster_path: m.poster_path, progress: m.progress })))}
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
            <SectionHeader title={t.ratingsListTitle} icon="star" onTitle={() => openWeb("/ratings")} action={arrange} seeAll={t.seeAll} onSeeAll={() => openWeb("/ratings")} />
            {posterRow(s.ratings.slice(0, cap(s.ratings.length)).map((r) => asItem({ key: `rt-${r.kind}-${r.id}`, kind: r.kind, id: r.id, title: `★ ${r.rating}/10 · ${r.title}`, poster_path: r.poster_path })))}
          </View>
        ) : null,
      lists:
        s.lists.cards.length > 0 || s.lists.towatch_card ? (
          <View key="lists">
            <SectionHeader title={t.listsTitle} icon="list" onTitle={() => router.push("/library")} seeAll={d.queues.lists.length > 1 ? t.allWord : undefined} seeAllLabel={t.listReorder} onSeeAll={() => setQueueRow("lists")} />
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
            <SectionHeader title={t.railFriendsNow} icon="people" onTitle={() => openWeb("/people")} seeAll={t.seeAll} onSeeAll={() => openWeb("/people")} />
            {posterRow(s.friends.slice(0, cap(12)).map((r) => asItem({ key: `fw-${r.kind}-${r.id}`, kind: r.kind, id: r.id, title: r.title, poster_path: r.poster_path, watched: r.watched })), holdDiscOpen)}
          </View>
        ) : null,
      trending:
        d.prefs.order.includes("trending") && (extras.data?.trending.length ?? 0) > 0 ? (
          <View key="trending">
            <SectionHeader title={t.trendingWeek} icon="trending" accent={false} action={arrange} />
            {posterRow((extras.data?.trending ?? []).slice(0, cap(12)).map((r) => asItem({ key: `tr-${r.kind}-${r.id}`, kind: r.kind, id: r.id, title: r.title, poster_path: r.poster_path, watched: r.watched })), holdDiscOpen)}
          </View>
        ) : null,
    };
    return d.prefs.order.map((k) => map[k]).filter(Boolean);
  }, [d, extras.data, view, posterW, cap, asItem, pressItem, openTitle, openList, openWeb, router, t, tokens, backdropOf, markNext, markListNext, busyKeys, setToWatch, toWatchBusy, holdLibOpen, holdDiscOpen]);

  return (
    <CardStoreContext.Provider value={store}>
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      {d ? <HomeCover url={d.header.cover_url} pos={d.header.cover_pos} /> : null}
      <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, paddingTop: insets.top, backgroundColor: pastCover ? tokens.bg : "transparent", borderBottomWidth: pastCover ? StyleSheet.hairlineWidth : 0, borderBottomColor: tokens.border, transform: [{ translateY: Animated.multiply(chrome.hidden, -topH) }] }}>
        <HomeTopBar onArt={onArt && !pastCover} unreadSignals={d?.header.unread_signals ?? 0} unreadShares={d?.header.unread_shares ?? 0} onInbox={() => openWeb("/messages")} onSignals={() => openWeb("/messages?tab=alerts")} onSettings={() => router.push("/settings")} />
      </Animated.View>
      {!d ? (
        home.isError ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
          </View>
        ) : (
          <Loading />
        )
      ) : (
        <ScrollView ref={scroll} refreshControl={refresh} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: topH + 10, paddingBottom: bottomPad }}>
          {/* صفُّ الترحيب وبطاقةُ الأرقام يقفان على الغلاف (D-836: الغلافُ يكبر بمقدارهما لا أكثر) */}
          <View style={{ minHeight: Math.max(0, COVER_SOLID - HEADER_H - 10) }}>
            <HomeGreeting h={d.header} onArt={onArt} view={view} onToggleView={toggleView} onAvatar={() => openWeb(d.header.username ? `/u/${d.header.username}` : "/profile")} onFollowers={() => setFollows("followers")} onFollowing={() => setFollows("following")} />
          </View>
          <HomeStats h={d.header} onStat={openHref} />
          {!d.hints.includes("home-customize") ? (
            <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 12 }}>
              <OneTimeHint id="home-customize" text={t.hintHome} />
            </View>
          ) : null}
          <Gap />
          {sections?.map((node, i) => (
            <React.Fragment key={i}>
              {node}
              <Gap />
            </React.Fragment>
          ))}
          {d.pick_genres_hint ? (
            <Pressable onPress={() => openWeb("/profile/edit")} accessibilityRole="link" style={{ marginHorizontal: PAGE_PAD, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.border, borderRadius: 12, paddingVertical: 16, alignItems: "center" }}>
              <Text size={14} muted>{t.pickGenresHint}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
      <HoldHost hostRef={holdLib} variant="library" toItem={asItemSame} onAction={actLib} />
      <HoldHost hostRef={holdDisc} variant="discover" toItem={asItemSame} inListOf={inListOf} onAction={actDisc} />
      {orderSheet && d ? <SectionOrderSheet order={d.prefs.order} onClose={() => setOrderSheet(false)} onDone={(next) => void saveOrder(next)} /> : null}
      {queueRow && d ? (
        <ReorderSheet
          items={queueItemsOf(queueRow === "continue" ? d.queues.continue : queueRow === "towatch" ? d.queues.towatch : queueRow === "lists" ? d.queues.lists : d.queues.towatch_list)}
          onClose={() => setQueueRow(null)}
          onDone={(keys) => saveQueue(queueRow, keys)}
        />
      ) : null}
      {allSheet && d ? (
        <Sheet title={`${allSheet === "shows" ? t.myShows : t.myMovies} · ${t.listCount(allSheet === "shows" ? d.sections.shows.total : d.sections.movies.total)}`} onClose={() => setAllSheet(null)}>
          {/* سقفُ ٥٠ بطاقةً (D-733) — والباقي في المكتبة بسهمه في الذيل (D-030) */}
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: 16 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {(allSheet === "shows"
                ? d.sections.shows.items.slice(0, 50).map((i) => asItem({ key: `as-${i.id}`, kind: "tv", id: i.id, title: i.title, poster_path: i.poster_path, progress: i.progress, watched: i.badge_tone === "watched" }))
                : d.sections.movies.items.slice(0, 50).map((m) => asItem({ key: `am-${m.id}`, kind: "movie", id: m.id, title: m.title, poster_path: m.poster_path, progress: m.progress }))
              ).map((it) => (
                <PosterCard key={it.key} item={it} width={posterW} onPress={(x) => { setAllSheet(null); pressItem(x); }} marquee={false} />
              ))}
            </View>
            {(allSheet === "shows" ? d.sections.shows.total : d.sections.movies.total) > 50 ? (
              <Pressable onPress={() => { setAllSheet(null); router.push("/library"); }} accessibilityRole="link" style={{ marginTop: 16, alignItems: "center" }}>
                <Text size={12} weight="500" color={tokens.accent}>{t.seeAll}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Sheet>
      ) : null}
      {celebrate ? <CelebrateSheet {...celebrate} onClose={() => setCelebrate(null)} onError={onError} /> : null}
      {follows ? <FollowsSheet dir={follows} onClose={() => setFollows(null)} onOpenWeb={openWeb} /> : null}
      <ToastHost hostRef={toastHost} bottom={navH} />
      <BottomNav
        active="home"
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
          name: t.libToWatch,
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
