import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, I18nManager, Platform, Pressable, RefreshControl, ScrollView, Share, TextInput, View, useWindowDimensions } from "react-native";
import { TabSlide } from "../TabSlide";
import { Image } from "expo-image";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, write } from "../api";
import { useApp } from "../state";
import { Button, Text, Toast } from "../ui";
import { Icon, iconOr } from "../icons";
import { radius } from "../theme";
import { CONFIG } from "../config";
import { haptic } from "../haptics";
import { shell, type NativeRoot } from "../shell";
import { stackAboveRoots } from "../nativeStack";
import { span, afterPaint } from "../perfMarks";
import { usePullRefresh } from "../pullRefresh";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { HomeCover, StatsCard, type StatCell } from "../home/HomeHeader";
import { FollowsSheet } from "../home/FollowsSheet";
import { PosterCard, type CardItem } from "../library/PosterCard";
import { ListCard, PlayPill } from "../library/ListCard";
import { ReorderSheet } from "../library/ReorderSheet";
import { Sheet } from "../library/Sheet";
import { Chip } from "../library/Chip";
import { openProfile } from "./open";
import { displayNameOf } from "@/core/people";
import { num } from "@/core/i18n";
import { PROFILE_SECTIONS, profileSectionMeta, profileTabMeta, sectionKeyOf } from "@/core/profilePrefs";
import { profileUrl } from "@/core/media";
import { browseGenreName, groupByGenre } from "@/core/browse";
import { SCOPES, clock, dayKey, episodeOf, groupDays, keep, label as scopeLabel, shiftDay, verbOf, type ActivityItem, type Scope } from "@/core/activityDays";
import type {
  ProfileActivity,
  ProfileList,
  ProfilePayload,
  ProfileReview,
  ProfileSectionKey,
  ProfileShow,
  ProfileTabKey,
  ProfileTitle,
} from "@/core/contracts/profile";
import type { FollowUserResult, LikeBody } from "@/core/communityActs";
import { REPORT_REASON_MAX, type ProfileReportBody, type ProfileSavedListsBody, type ProfileSectionOrderBody } from "@/core/contracts/profile";
import type { ListReorderBody, QueueItem } from "@/core/contracts/library";

/**
 * ====== ملفُّ الشخص أصليّاً — Phase 11-N · N1 (٢٩ سبتمبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد: «ابدا خطة ملف الشخص اصلية»** — كان أكثرَ بابٍ ويبيٍّ يُضغط في التطبيق (كلُّ صورة شخص). **الحمولةُ ما تقرؤه
 * صفحةُ `/u/{username}` حرفاً** (`GET /api/v1/profile/{username}` فوق `lib/profileCore.ts` — N0)، **والشاشةُ ترسم ولا تصوغ**.
 *
 * 🔑 **الرأسُ رأسُ الرئيسيّة** كما في الويب («صفحة المستخدم بهيئة الرئيسية نفسها»): الغلافُ (`HomeCover`) · الصورةُ والاسمُ
 * والشارات · صفُّ «متابِع/يتابع» · بطاقةُ الأرقام (`StatsCard` — مكوّنٌ واحدٌ للاثنين). **مكانُ أدوات المالك زرُّ المتابعة.**
 * 🔑 **التبويباتُ الخمسة بترتيب صاحبها وما أخفاه** (من الخادم) — **بالضغط كما في الويب** (`PageTabs` روابطُ لا سحب)، والشريطُ
 * يلتصق أعلى الشاشة عند التمرير.
 * 🔑 **حجمُ الملصق حجمُ القارئ** (قرارُ أحمد ٢٩ سبتمبر: «بحجمك انت») — `viewer.density`؛ الترتيبُ والإخفاءُ لصاحب الملفّ.
 * 🔑 **لا ويبَ إلّا ما لم يُنقل**: الأعمالُ والقوائمُ وملفّاتُ الناس أصليّة؛ «الإحصاءات» بابٌ ويبيٌّ حتى N4 — يظهر فوق الشاشة
 * طبقةً (K3b) فتبقى هذه تحتها كما تُركت.
 * ⏭️ **N2**: قائمةُ ⋯ (رسالة · بلاغ · حظر) وقلوبُ المراجعات وردودُها · **N3**: أدواتُ المالك (الترتيب · راية المحفوظات).
 *
 * 🆕 **N3 — أدواتُ صاحب الملفّ** (ما يرسمه الويبُ لـ`isMe` حرفاً، بلا شكلٍ جديد):
 * - **مقبضُ الترتيب** على عنوان كلِّ صفٍّ فيه عملان فأكثر — صفوفُ «المفضّلة» (`FavoritesRail`: قائمةٌ حقيقيّة ⇐
 *   `POST /api/v1/lists/reorder`، والدمجُ في خانات النوع نفسِه — D-567) · وأقسامُ «نظرة عامّة» الخمسة (`SectionReorderButton`
 *   ⇐ `profile_prefs.sectionOrder` — D-581). **ورقةُ `ReorderSheet` نفسُها** التي ترتّب طوابيرَ الرئيسيّة والقائمة.
 * - **رايةُ «القوائم المحفوظة»** On/Off على عنوان قسمها في «قوائم» (`SavedListsToggle` — D-594؛ من البلس — D-791).
 * - **ما أخفيتَه تراه أنت وحدك** في «نظرة عامّة» (D-152) · **وبابُ «التخصيص»** حين تُطفأ التبويباتُ كلُّها (D-672).
 * - **صورتي تفتح «تعديل الملفّ»** الأصليّة (D-571) · **و«الإحصاءات» صفحتي أنا** (`/stats` — D-650).
 * الترتيبُ يُرسم فوراً في الكاش (نهجُ D-1094) ثمّ يُكتب؛ الفشلُ يعيد الجلبَ ويقول سببه (D-1179).
 */
const HEADER_H = 56;
const PAGE_PAD = 16;
const GAP = 10;
const DENSITY_W = { compact: 96, comfortable: 118, large: 148 } as const;

/* ألوانُ النصّ فوق الغلاف — قيمُ `HomeGreeting` نفسُها */
const ART_MUTED = "rgba(255,255,255,0.7)";
const ART_SHADOW = { textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 };

export const profileKey = (username: string) => [`profile:${username.toLowerCase()}`] as const;

type Grid = "shows" | "movies" | "anime";

export function ProfileScreen({ username, from }: { username: string; from: NativeRoot | "web" }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const nav = useNavigationContainerRef();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  /* 🆕 N3-fix2 — مفتاحٌ ثابتُ الهويّة: كان مصفوفةً جديدةً كلَّ رسمة فيُبطل كلَّ `useCallback`/`useMemo` يعتمد عليه */
  const key = useMemo(() => profileKey(username), [username]);

  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await api<ProfilePayload>(`/api/v1/profile/${encodeURIComponent(username)}`)).data,
    staleTime: 60_000,
  });
  const d = q.data ?? null;

  /* `profile.open`: من التركيب إلى أوّل رسمٍ فيه حمولة — `cached` يفصل الكاشَ عن الشبكة (نهجُ «المجتمع») */
  const [endOpen] = useState(() => span("profile.open", { cached: qc.getQueryData(key) ? 1 : 0 }));
  const opened = useRef(false);
  useEffect(() => {
    if (!d || opened.current) return;
    opened.current = true;
    afterPaint(() => endOpen());
  }, [d, endOpen]);

  const [tab, setTab] = useState<ProfileTabKey | null>(null);
  const shown = useMemo(() => d?.tabs ?? [], [d?.tabs]);
  const active: ProfileTabKey | null = tab && shown.includes(tab) ? tab : (shown[0] ?? null);
  const [follows, setFollows] = useState<"followers" | "following" | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [ranks, setRanks] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  /* 🆕 N2 — ورقةُ ⋯ ثمّ ورقتا البلاغ وتأكيد الحظر (الويبُ: قائمةٌ ثمّ ورقتان — `ProfileMenu`) */
  const [menu, setMenu] = useState<null | "menu" | "report" | "block">(null);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  /* 🆕 N3 — ورقةُ الترتيب: صفٌّ من «المفضّلة» أو قسمٌ من «نظرة عامّة» */
  const [sorting, setSorting] = useState<null | { fav: FavRow } | { sec: SortSec }>(null);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(h);
  }, [toast]);

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

  /* الأبواب — الأصليُّ دفعٌ بـ`from` من فتح الملفّ، والويبيُّ (الإحصاءات حتى N4) طبقةٌ فوق الشاشة (K3b) */
  const fromOut = from;
  const openTitle = useCallback(
    (kind: "tv" | "movie", id: number) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from: fromOut } }),
    [router, fromOut],
  );
  const openList = useCallback((id: string) => router.push({ pathname: "/list/[id]", params: { id, from: fromOut } }), [router, fromOut]);
  const openPerson = useCallback((id: number) => router.push({ pathname: "/person/[id]", params: { id: String(id), from: fromOut } }), [router, fromOut]);
  const openMember = useCallback((name: string) => openProfile(router, name, fromOut), [router, fromOut]);
  const openWeb = useCallback(
    (path: string) => {
      if (leaving) return;
      setLeaving(true);
      void shell
        .open(path, fromOut === "web" ? undefined : { returnTo: fromOut, resume: stackAboveRoots(nav.getRootState()) })
        .then((layered) => {
          setLeaving(false);
          if (layered) return;
          if (router.canDismiss()) router.dismissAll();
          else router.replace("/web");
        });
    },
    [leaving, fromOut, nav, router],
  );
  const share = useCallback(() => {
    if (!d?.person.username) return;
    const url = `${CONFIG.apiBase}/u/${d.person.username}`;
    void Share.share({ message: url, url }).catch(() => {});
  }, [d]);

  /* المتابعةُ — `POST /api/v1/community/follow` نفسُه (M2)، تفاؤليّةً في كاش الملفّ؛ الحسابُ الخاصُّ يعيد «طلبتَ» */
  const follow = useMutation({
    mutationFn: async (on: boolean) => (d ? write<FollowUserResult>("/api/v1/community/follow", { user_id: d.person.id, on }) : null),
    onMutate: (on) => {
      haptic.pick();
      qc.setQueryData<ProfilePayload>(key, (p) => (p ? { ...p, relation: { ...p.relation, following: on && !p.person.is_private, requested: on && p.person.is_private } } : p));
    },
    onSuccess: (r) => {
      if (!r) return;
      qc.setQueryData<ProfilePayload>(key, (p) =>
        p
          ? {
              ...p,
              relation: { ...p.relation, following: r.state === "following", requested: r.state === "requested" },
              counts: { ...p.counts, followers: Math.max(0, p.counts.followers + (r.state === "following" && !p.relation.following ? 1 : 0)) },
            }
          : p,
      );
      if (r.state === "requested") setToast(t.followRequestSent);
      /* المتابعةُ تفتح المحتوى (أو تغلقه) — الحمولةُ من الخادم لا تخمين */
      void q.refetch();
    },
    onError: (e) => {
      const k = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[k];
      setToast(typeof msg === "string" ? msg : t.apiInternal);
      void q.refetch();
    },
  });

  const failText = useCallback(
    (e: unknown) => {
      const k = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[k];
      return typeof msg === "string" ? msg : t.apiInternal;
    },
    [t],
  );
  /* 🆕 N2 — «رسالة» للمتبادلَين وحدَهم (D-051) ⇐ خيطُ M4 أصليّاً؛ ولغيرهم التلميحُ نفسُه الذي يقوله الويب */
  const message = useCallback(() => {
    if (!d) return;
    setMenu(null);
    if (!(d.relation.following && d.relation.follows_me)) return setToast(t.msgNeedsMutual);
    router.push({ pathname: "/messages/[peer]", params: { peer: d.person.id, from: fromOut } });
  }, [d, router, fromOut, t]);
  const report = useMutation({
    mutationFn: async () => (d ? write<{ done: true }>("/api/v1/profile/report", { user_id: d.person.id, reason: reason.trim() || null } satisfies ProfileReportBody) : null),
    onSuccess: () => {
      setMenu(null);
      setReason("");
      setReported(true);
      setToast(t.reportDone);
    },
    onError: (e) => setToast(failText(e)),
  });
  /* الحظرُ فعلُ M4 نفسُه (`/me/messages/block`: يفكّ المتابعة ويُخفي المحادثة) — ثمّ يُغادَر الملفّ: لا شيءَ فيه يخصّك بعده */
  const block = useMutation({
    mutationFn: async () => (d ? write<{ done: true }>("/api/v1/me/messages/block", { person_id: d.person.id }) : null),
    /* 🆕 N2-fix2 — بعد الحظر يبقى الملفُّ مفتوحاً ويقول إنّه محظور (ومعه رفعُ الحظر) — كان يُغلق فلا يُعرف أين يُرفع */
    onSuccess: () => {
      setMenu(null);
      haptic.pick();
      setToast(t.blockedToast);
      void q.refetch();
    },
    onError: (e) => setToast(failText(e)),
  });
  /* 🆕 N2-fix2 — رفعُ الحظر من الملفّ نفسِه (فعلُ الإعدادات ← الخصوصيّة ← المحظورون نفسُه) */
  const unblock = useMutation({
    mutationFn: async () => (d ? write<{ done: true }>("/api/v1/me/settings/blocked", { user_id: d.person.id }) : null),
    onSuccess: () => {
      setMenu(null);
      haptic.pick();
      setToast(t.unblockedToast);
      void qc.invalidateQueries({ queryKey: ["me:settings"] });
      void q.refetch();
    },
    onError: (e) => setToast(failText(e)),
  });
  /* 🆕 N2 — قلبُ المراجعة (`LikeButton` الويب): تفاؤليٌّ في كاش الملفّ، ويعود إن رفض الخادم */
  const likeReview = useCallback(
    (r: ProfileReview) => {
      if (!d || !d.viewer.signed_in) return;
      haptic.pick();
      const on = !r.liked_by_me;
      const flip = (want: boolean) =>
        qc.setQueryData<ProfilePayload>(key, (p) => {
          if (!p) return p;
          const patch = (x: ProfileReview) =>
            x.tmdb_id === r.tmdb_id && x.media_type === r.media_type && x.liked_by_me !== want ? { ...x, liked_by_me: want, likes: Math.max(0, x.likes + (want ? 1 : -1)) } : x;
          return { ...p, reviews: p.reviews.map(patch), overview: { ...p.overview, ratings: p.overview.ratings.map(patch) } };
        });
      flip(on);
      void write<unknown>("/api/v1/community/like", { target: "review", user_id: d.person.id, tmdb_id: r.tmdb_id, media_type: r.media_type, on } satisfies LikeBody).catch((e) => {
        flip(!on);
        setToast(failText(e));
      });
    },
    [d, qc, key, failText],
  );
  /* «تعليق» ⇐ خيطُ الرأي أصليّاً (M3: `/review/[kind]/[id]/[user]`) — الردودُ تُكتب هناك كما في الويب */
  const openReview = useCallback(
    (r: ProfileReview) => {
      if (!d) return;
      router.push({ pathname: "/review/[kind]/[id]/[user]", params: { kind: r.media_type, id: String(r.tmdb_id), user: d.person.id, from: fromOut, compose: "1" } });
    },
    [d, router, fromOut],
  );

  /* 🆕 N2-fix — قبولُ طلب متابعته أو رفضُه (الفعلُ نفسُه الذي في صفّ الإشعار) */
  const request = useMutation({
    mutationFn: async (accept: boolean) => (d ? write<{ done: true }>("/api/v1/me/follow-requests", { person_id: d.person.id, accept }) : null),
    onSuccess: () => {
      haptic.pick();
      void q.refetch();
    },
    onError: (e) => setToast(failText(e)),
  });

  /* ——— 🆕 N3 — أدواتُ صاحب الملفّ ——— */
  const patch = useCallback((f: (p: ProfilePayload) => ProfilePayload) => qc.setQueryData<ProfilePayload>(key, (p) => (p ? f(p) : p)), [qc, key]);
  /** صفوفُ المفضّلة: الورقةُ ترتّب نوعاً واحداً، والقائمةُ واحدةٌ للأنواع — خاناتُ النوع تُملأ بترتيبه الجديد وما سواه يثبت (D-567) */
  const saveFav = useCallback(
    (row: FavRow, keys: string[]) => {
      setSorting(null);
      if (!d?.owner?.fav_list_id) return;
      const listId = d.owner.fav_list_id;
      const mine = new Set(d.favorites[row].map(favKey));
      let i = 0;
      const merged = d.owner.fav_keys.map((k) => (mine.has(k) ? (keys[i++] ?? k) : k));
      haptic.pick();
      patch((p) => ({ ...p, favorites: { ...p.favorites, [row]: byKeys(p.favorites[row], favKey, keys) }, owner: p.owner ? { ...p.owner, fav_keys: merged } : p.owner }));
      void write<{ done: true }>("/api/v1/lists/reorder", { listId, keys: merged } satisfies ListReorderBody).catch((e) => {
        setToast(failText(e));
        void q.refetch();
      });
    },
    [d, patch, failText, q],
  );
  /** قسمُ «نظرة عامّة»: `profile_prefs.sectionOrder` — والقوائمُ مصفوفةٌ واحدةٌ للقسم وللتبويب (`listsOrdered` — D-152) */
  const saveSec = useCallback(
    (sec: SortSec, keys: string[]) => {
      setSorting(null);
      if (!d?.owner) return;
      haptic.pick();
      patch((p) => {
        const o = p.overview;
        const ov =
          sec === "shows" ? { ...o, shows: byKeys(o.shows, showKey, keys) }
          : sec === "anime" ? { ...o, anime: byKeys(o.anime, showKey, keys) }
          : sec === "movies" ? { ...o, movies: byKeys(o.movies, (x) => sectionKeyOf.movie(x.tmdb_id), keys) }
          : sec === "artists" ? { ...o, artists: byKeys(o.artists, (a) => sectionKeyOf.artist(a.person_id), keys) }
          : { ...o, lists: byKeys(o.lists, listKey, keys) };
        return {
          ...p,
          overview: ov,
          lists: sec === "lists" ? { ...p.lists, public: byKeys(p.lists.public, listKey, keys) } : p.lists,
          owner: p.owner ? { ...p.owner, section_order: { ...p.owner.section_order, [sec]: keys } } : p.owner,
        };
      });
      void write<{ done: true }>("/api/v1/me/prefs/profile-order", { section: sec, keys } satisfies ProfileSectionOrderBody).catch((e) => {
        setToast(failText(e));
        void q.refetch();
      });
    },
    [d, patch, failText, q],
  );
  /** رايةُ المحفوظات — متفائلةٌ بارتداد (`SavedListsToggle`)؛ غيرُ المشترك يُعاد ويُفتح له «بلس» (نهجُ ترتيب الرئيسيّة) */
  const setSaved = useCallback(
    (on: boolean) => {
      haptic.pick();
      const flip = (v: boolean) => patch((p) => (p.owner ? { ...p, owner: { ...p.owner, saved_lists: v } } : p));
      flip(on);
      void write<{ ok: boolean; needsPlus?: true }>("/api/v1/me/prefs/profile-saved-lists", { on } satisfies ProfileSavedListsBody)
        .then((r) => {
          if (!r.needsPlus) return;
          flip(!on);
          openWeb("/plus");
        })
        .catch((e) => {
          flip(!on);
          setToast(failText(e));
        });
    },
    [patch, failText, openWeb],
  );
  const sortItems: QueueItem[] = useMemo(() => {
    if (!d || !sorting) return [];
    if ("fav" in sorting) return d.favorites[sorting.fav].map((x) => ({ key: favKey(x), title: x.title, poster_path: x.poster_path, media_type: x.media_type }));
    const o = d.overview;
    switch (sorting.sec) {
      case "shows":
        return o.shows.map((x) => ({ key: showKey(x), title: x.title, poster_path: x.poster_path, media_type: "tv" }));
      case "anime":
        return o.anime.map((x) => ({ key: showKey(x), title: x.title, poster_path: x.poster_path, media_type: "tv" }));
      case "movies":
        return o.movies.map((x) => ({ key: sectionKeyOf.movie(x.tmdb_id), title: x.title, poster_path: x.poster_path, media_type: "movie" }));
      /* الورقةُ لا تقرأ `media_type` (مفتاحٌ وملصقٌ واسم) — الفنّانُ والقائمةُ يحملانه لأنّ النوعَ يطلبه */
      case "artists":
        return o.artists.map((a) => ({ key: sectionKeyOf.artist(a.person_id), title: a.name ?? "—", poster_path: a.profile_path, media_type: "movie" }));
      case "lists":
        return o.lists.map((l) => ({ key: listKey(l), title: l.name, poster_path: l.posters[0] ?? null, media_type: "movie" }));
    }
  }, [d, sorting]);

  const posterW = DENSITY_W[d?.viewer.density ?? "comfortable"];
  const onArt = !!d?.person.cover_url;
  const name = d ? displayNameOf(d.person, t.anonymousUser) : "";

  const stats: StatCell[] = useMemo(() => {
    if (!d || !d.display.stats || d.locked) return [];
    const cells: StatCell[] = [
      { key: "shows", icon: "tv", value: num(d.counts.shows, locale), label: t.shortShows, href: "#shows" },
      { key: "movies", icon: "film", value: num(d.counts.movies, locale), label: t.shortMovies, href: "#movies" },
    ];
    if (d.counts.anime > 0) cells.push({ key: "anime", icon: "sparkles", value: num(d.counts.anime, locale), label: t.discoverTabAnime, href: "#anime" });
    /* 🆕 N3 — بابي أنا `/stats` بمداها الكامل، ولزائري سطحُ العضو (D-650: `/stats` تقرأ صاحبَ الجلسة) */
    if (d.display.stats_link && (d.viewer.is_me || d.person.username))
      cells.push({ key: "stats", icon: "chart", value: "", label: t.statsPageTitle, href: d.viewer.is_me ? "/stats" : `/u/${d.person.username}/stats` });
    return cells;
  }, [d, t, locale]);
  const onStat = useCallback((href: string) => (href.startsWith("#") ? setGrid(href.slice(1) as Grid) : openWeb(href)), [openWeb]);

  const tabMeta = profileTabMeta(t);

  /**
   * 🔴 N1-fix4 — **السحبُ بنظام المكتبة واكتشف والمجتمع** (أحمد ٢٩ سبتمبر: «خلي الايماءات نفس نظامها فالمكتبة و اكتشف و المجتمع»):
   * كانت سحبةً تُقلب عند الرفع والجسمُ يدخل بعدها — الآن **`TabSlide` نفسُه**: اللوحُ يتبع الإصبع، والجارُ حاضرٌ مسخَّنٌ (K2)، والطيرانُ
   * والعتباتُ والاهتزازُ أرقامُه. ولكي يبقى رأسُ الملفّ فوق التبويبات **وصفةُ الملفّات الاجتماعيّة**: الرأسُ طبقةٌ فوق اللوحات تُطوى مع
   * تمرير اللوح النشط حتى يلتصق شريطُها أعلى الشاشة، وكلُّ لوحٍ يبدأ بفراغٍ بطول الرأس. والرأسُ **لا يحبس اللمس** إلّا على أزراره
   * (`box-none`): السحبُ والتمريرُ من فوقه يصلان اللوحَ تحته. تبديلُ التبويب يُبقي الرأسَ حيث هو (الجارُ يُزامَن قبل أن يُرى) —
   * فلا قفزةَ (يحلّ محلَّ N1-fix2).
   */
  const collapse = useRef(new Animated.Value(0)).current;
  const collapseNow = useRef(0);
  const [headH, setHeadH] = useState(0);
  const [barH, setBarH] = useState(0);
  const maxC = Math.max(0, headH - barH);
  const maxCRef = useRef(0);
  maxCRef.current = maxC;
  const [aim, setAim] = useState<ProfileTabKey | null>(null);
  const activeRef = useRef<ProfileTabKey | null>(active);
  activeRef.current = active;
  const panes = useRef(new Map<ProfileTabKey, { ref: ScrollView | null; y: number }>()).current;
  /* لوحٌ يُرى الآن أو يُسلَّح: يبدأ حيث الرأسُ الآن — مطويٌّ جزئيّاً ⇐ الموضعُ نفسُه؛ ملتصقٌ ⇐ موضعُه هو إن نزل أبعد، وإلّا حدُّ الالتصاق */
  const syncPane = useCallback(
    (k: ProfileTabKey) => {
      const p = panes.get(k);
      if (!p?.ref || k === activeRef.current) return;
      const c = collapseNow.current;
      const target = c < maxCRef.current ? c : Math.max(p.y, maxCRef.current);
      if (Math.abs(target - p.y) < 1) return;
      p.y = target;
      p.ref.scrollTo({ y: target, animated: false });
    },
    [panes],
  );
  const syncOthers = useCallback(() => {
    for (const k of panes.keys()) syncPane(k);
  }, [panes, syncPane]);
  const pick = useCallback(
    (k: ProfileTabKey) => {
      syncPane(k);
      setAim(null);
      setTab(k);
    },
    [syncPane],
  );
  const onPaneScroll = useCallback(
    (k: ProfileTabKey, y: number) => {
      const p = panes.get(k);
      if (p) p.y = y;
      if (k !== activeRef.current) return;
      const c = Math.max(0, Math.min(y, maxCRef.current));
      collapseNow.current = c;
      collapse.setValue(c);
    },
    [panes, collapse],
  );
  /* التبويبُ النشطُ تغيّر (سحبٌ أو ضغطة): الرأسُ يأخذ موضعَ لوحه الجديد، وسائرُ اللوحات تُزامَن معه */
  useEffect(() => {
    if (!active) return;
    const p = panes.get(active);
    const c = Math.max(0, Math.min(p?.y ?? collapseNow.current, maxC));
    collapseNow.current = c;
    collapse.setValue(c);
    syncOthers();
  }, [active, maxC, panes, collapse, syncOthers]);
  const viewportH = height - insets.top - HEADER_H;
  /* 🆕 N3-fix — **اسحب للتحديث** (أحمد ٣٠ سبتمبر: «خليه فيه ريفريش اذا سحبته على تحت») — `usePullRefresh` نفسُه الذي في المكتبة
     واكتشف والمجتمع؛ كلُّ الألواح من حمولةٍ واحدة فمفتاحٌ واحد. الدوّارُ تحت الرأس (`headH`) لا خلفه. */
  const refresh = usePullRefresh([key], headH);
  /**
   * 🔴 N3-fix2 — **الضغطُ على تبويبٍ كان أبطأَ من «اكتشف»** (تسجيلُ أحمد ٣٠ سبتمبر: «اكتشف اسلس واسرع»): الخطُّ ينتقل والجسمُ يتبعه
   * بعد ٠٫٥–٠٫٨ث، وفي «اكتشف» ٠٫٣ث. **العلّة**: كلُّ ضغطةٍ (`setTab`) كانت تعيد رسمَ الألواح الخمسة كلِّها — `warmAll` يُبقيها
   * مركّبةً، وأجسامُها (سجلُّ النشاط · المراجعات · الصفوف) تُبنى من جديد لأنّ كلَّ خاصّيّةٍ فيها دالّةٌ أو عنصرٌ يولد مع الرسمة.
   * «اكتشف» ألواحُه مكوّناتٌ مستقلّةٌ لا تتغيّر خصائصُها بالضغط. **الآن مثلُه**: الأجسامُ تُبنى مرّةً لكلِّ حمولة (`useMemo` على `d`)،
   * والغلافُ `ProfilePane` مذكَّرٌ (`memo`) بخصائصَ ثابتةِ الهويّة (دوالُّ لكلِّ مفتاحٍ تُحفظ مرّةً) — فالضغطةُ تحرّك الخطَّ واللوحَ
   * ولا تمسّ ما في داخلهما. الشكلُ والحركةُ والأرقامُ كما هي.
   */
  const bodies = useMemo(() => {
    if (!d) return null;
    const o = d.viewer.is_me ? d.owner : null;
    return {
      favorites: <Favorites d={d} posterW={posterW} onTitle={openTitle} onSort={o?.fav_list_id ? (fav) => setSorting({ fav }) : undefined} />,
      overview: <Overview d={d} posterW={posterW} onTitle={openTitle} onList={openList} onPerson={openPerson} onSort={o ? (sec) => setSorting({ sec }) : undefined} />,
      activity: <ActivityPane rows={d.activity} onTitle={openTitle} />,
      reviews: <ReviewsPane rows={d.reviews} onTitle={openTitle} onLike={d.viewer.signed_in ? likeReview : undefined} onComment={openReview} />,
      lists: <ListsPane d={d} onList={openList} onMember={openMember} savedFlag={o ? { on: o.saved_lists, onToggle: setSaved } : undefined} />,
    } satisfies Record<ProfileTabKey, React.ReactNode>;
  }, [d, posterW, openTitle, openList, openPerson, openMember, likeReview, openReview, setSaved]);
  /* دوالُّ كلِّ لوحٍ تُصنع مرّةً لعمر الشاشة — `panes`/`syncPane`/`onPaneScroll` ثابتةٌ أصلاً */
  const paneFns = useRef(new Map<ProfileTabKey, { register: (ref: ScrollView | null) => void; onScroll: (y: number) => void }>()).current;
  const fnsOf = (k: ProfileTabKey) => {
    let f = paneFns.get(k);
    if (!f) {
      f = {
        register: (ref) => {
          /* المرجعُ يُعاد مع كلِّ رسم (`null` ثمّ العقدة) — الموضعُ المحفوظُ لا يُمحى معه، والمزامنةُ لعقدةٍ جديدةٍ وحدَها */
          const cur = panes.get(k);
          if (!ref) {
            if (cur) cur.ref = null;
            return;
          }
          const fresh = cur?.ref !== ref;
          panes.set(k, { ref, y: cur?.y ?? 0 });
          if (fresh && !cur) syncPane(k);
        },
        onScroll: (y) => onPaneScroll(k, y),
      };
      paneFns.set(k, f);
    }
    return f;
  };
  const renderPane = (k: ProfileTabKey) =>
    bodies ? (
      <ProfilePane
        k={k}
        topPad={headH}
        minH={viewportH + maxC}
        bottomPad={insets.bottom + 40}
        register={fnsOf(k).register}
        onScroll={fnsOf(k).onScroll}
        onSettle={syncOthers}
        refreshControl={refresh}
      >
        {bodies[k]}
      </ProfilePane>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      {d ? <HomeCover url={d.person.cover_url} pos={d.person.cover_pos} /> : null}
      <View style={{ paddingTop: insets.top, height: insets.top + HEADER_H, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
        <RoundBtn icon="back" label={t.closeLabel} onPress={back} onArt={!!d?.person.cover_url} />
        <View style={{ flex: 1 }} />
        {d?.person.username ? <RoundBtn icon="share" label={t.shareLinkLabel} onPress={share} onArt={!!d.person.cover_url} /> : null}
        {d?.viewer.is_me ? <RoundBtn icon="settings" label={t.headerSettings} onPress={() => router.push("/settings")} onArt={!!d.person.cover_url} /> : null}
        {/* 🆕 N2 — ⋯ ملفّ غيرك (`ProfileMenu`): رسالة · بلاغ · حظر */}
        {d && !d.viewer.is_me && d.viewer.signed_in ? <RoundBtn icon="dots" label={t.profileMenuAria} onPress={() => setMenu("menu")} onArt={!!d.person.cover_url} /> : null}
      </View>

      {!d ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: PAGE_PAD }}>
            <Text muted style={{ textAlign: "center" }}>{q.error instanceof ApiError && q.error.status === 404 ? t.userNotFound : t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: PAGE_PAD, gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: tokens.surface2 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ height: 20, width: "55%", borderRadius: 6, backgroundColor: tokens.surface2 }} />
                <View style={{ height: 12, width: "35%", borderRadius: 6, backgroundColor: tokens.surface2 }} />
              </View>
            </View>
            <View style={{ height: 60, borderRadius: 16, backgroundColor: tokens.surface2 }} />
          </View>
        )
      ) : (
        <View style={{ flex: 1, overflow: "hidden" }}>
          {headH > 0 && !d.locked && shown.length > 0 && active ? (
            <TabSlide order={shown} tab={active} onTab={pick} onAim={setAim} perfScreen="profile" warmAll render={(k) => renderPane(k)} />
          ) : headH > 0 ? (
            <ScrollView refreshControl={refresh} contentContainerStyle={{ paddingTop: headH, paddingBottom: insets.bottom + 40 }}>
              {!d.locked && shown.length === 0 ? (
                <View style={{ alignItems: "center", gap: 8, paddingVertical: 40 }}>
                  <Text muted style={{ textAlign: "center" }}>{t.profileNoTabs}</Text>
                  {/* 🆕 N3 — من أطفأ تبويباتِه كلَّها يجد بابَ مفاتيحها هنا (D-672) — «التخصيص» الأصليّة (D-1112) */}
                  {d.viewer.is_me ? (
                    <Pressable onPress={() => router.push("/settings/home")} accessibilityRole="link" hitSlop={8}>
                      <Text size={14} weight="700" color={tokens.accent} style={{ textDecorationLine: "underline" }}>{t.custTitle}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          ) : null}
          {/* ——— الرأسُ طبقةٌ فوق اللوحات: يُطوى مع التمرير حتى يلتصق شريطُه، ولا يحبس اللمسَ إلّا على أزراره ——— */}
          <Animated.View
            pointerEvents="box-none"
            onLayout={(e) => setHeadH(Math.round(e.nativeEvent.layout.height))}
            style={{ position: "absolute", top: 0, left: 0, right: 0, transform: [{ translateY: Animated.multiply(collapse, -1) }] }}
          >
            <View pointerEvents="box-none">
            <View pointerEvents="box-none" style={{ paddingHorizontal: PAGE_PAD, flexDirection: "row", alignItems: "center", gap: 12 }}>
              {/* 🆕 N3 — صورةُ ملفّي بابُ تعديله (D-571) — «تعديل الملفّ» أصليّة (D-1106)؛ ولزائري لا رابط */}
              <Pressable
                /* لزائري الصورةُ صورة: لا تحبس اللمس فيصل التمريرُ من فوقها إلى اللوح (كما كانت) */
                pointerEvents={d.viewer.is_me ? "auto" : "none"}
                disabled={!d.viewer.is_me}
                onPress={() => router.push("/settings/profile")}
                accessibilityRole={d.viewer.is_me ? "button" : undefined}
                accessibilityLabel={d.viewer.is_me ? t.headerSettings : undefined}
                style={({ pressed }) => ({ width: 60, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 2, borderColor: tokens.bg, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.95 : 1 }] })}
              >
                {!d.person.hide_name && d.person.avatar_url ? (
                  <Image source={{ uri: d.person.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" contentPosition={{ top: `${d.person.avatar_pos ?? 50}%`, left: "50%" }} cachePolicy="memory-disk" />
                ) : (
                  <Icon name="people" size={24} color={tokens.muted} />
                )}
              </Pressable>
              <View pointerEvents="box-none" style={{ flex: 1, minWidth: 0 }}>
                <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {/* D-1134 — فوق الغلاف أبيضُ بظلٍّ كتحيّة الرئيسيّة (`HomeGreeting.onArt`) — يصحّ في «النهاري» أيضاً */}
                  <Text size={20} weight="700" color={onArt ? "#fff" : tokens.fg} numberOfLines={1} style={[{ flexShrink: 1, lineHeight: 24 }, onArt ? ART_SHADOW : null]}>{name}</Text>
                  {d.person.hide_name ? null : <IdentityBadges flags={identityFlags(d.person)} nameSize={20} />}
                </View>
                <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  {d.person.username && !d.person.hide_name ? <Text size={12} color={onArt ? ART_MUTED : tokens.muted} numberOfLines={1} style={{ flexShrink: 1 }}>@{d.person.username}</Text> : null}
                  {/* القفلُ كالويب (`FollowCountButton.locked`): العددُ يُرى والورقةُ لا تُفتح */}
                  <CountBtn icon="people" value={d.counts.followers} label={t.followersLabel} locked={d.person.hide_follow_lists} onArt={onArt} onPress={() => setFollows("followers")} />
                  <CountBtn icon="heart" value={d.counts.following} label={t.followingLabel} locked={d.person.hide_follow_lists} onArt={onArt} onPress={() => setFollows("following")} />
                </View>
              </View>
              {d.viewer.is_me || !d.viewer.signed_in || d.person.system || d.relation.blocked_by_me || d.relation.blocked_me ? null : (
                <Button
                  size="sm"
                  variant={d.relation.following || d.relation.requested ? "ghost" : "primary"}
                  label={d.relation.following ? t.followingUser : d.relation.requested ? t.followRequested : t.followUser}
                  busy={follow.isPending}
                  onPress={() => follow.mutate(!(d.relation.following || d.relation.requested))}
                />
              )}
            </View>
            {d.person.bio ? <Text pointerEvents="none" size={13} style={{ paddingHorizontal: PAGE_PAD, marginTop: 10, lineHeight: 19 }}>{d.person.bio}</Text> : null}
            {/* 🆕 N2-fix — طلب متابعتي وطلبُه قائم: القرارُ هنا أيضاً (الإشعارُ يفتح هذا الملفّ) */}
            {d.relation.requested_me ? (
              <View style={{ marginHorizontal: PAGE_PAD, marginTop: 12, padding: 12, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bg, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="people" size={18} color={tokens.accent} />
                <Text size={13} style={{ flex: 1 }} numberOfLines={2}>{t.notifRequest(name)}</Text>
                <Button size="sm" label={t.requestAccept} busy={request.isPending && request.variables === true} onPress={() => request.mutate(true)} />
                <Button size="sm" variant="ghost" label={t.requestReject} busy={request.isPending && request.variables === false} onPress={() => request.mutate(false)} />
              </View>
            ) : null}
            <Facts d={d} onRanks={() => setRanks(true)} />
            <StatsCard stats={stats} onStat={onStat} />

            {/* 🆕 N2-fix2 — الحظرُ يُقال صريحاً: من حظرتُه (ومعه رفعُ الحظر) · ومن حظرني «غير متاح» */}
            {d.relation.blocked_by_me || d.relation.blocked_me ? (
              <View pointerEvents="box-none" style={{ margin: PAGE_PAD, marginTop: 20, padding: 20, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, alignItems: "center", gap: 10 }}>
                <Icon name="shield" size={24} color={d.relation.blocked_by_me ? tokens.error : tokens.muted} />
                <Text size={14} style={{ textAlign: "center", lineHeight: 20 }}>{d.relation.blocked_by_me ? t.profileBlockedByMe : t.profileBlockedMe}</Text>
                {d.relation.blocked_by_me ? <Button size="sm" variant="ghost" label={t.unblockButton} busy={unblock.isPending} onPress={() => unblock.mutate()} /> : null}
              </View>
            ) : d.locked ? (
              <View pointerEvents="none" style={{ margin: PAGE_PAD, marginTop: 20, padding: 20, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, alignItems: "center", gap: 8 }}>
                <Icon name="shield" size={24} color={tokens.muted} />
                <Text size={15} weight="700">{t.privateCoverTitle}</Text>
                <Text size={13} muted style={{ textAlign: "center" }}>{t.privateCoverHint}</Text>
              </View>
            ) : null}
          </View>

            <View style={{ backgroundColor: tokens.bg }} onLayout={(e) => setBarH(Math.round(e.nativeEvent.layout.height))}>
            {!d.locked && shown.length > 0 ? (
              /* 🔴 N1-fix3 — **التبويباتُ تملأ العرضَ حتى الحافّة** (أحمد بلقطة ٢٩ سبتمبر: «أماكنها لاصقة في بعض.. المفترض مالية المكان لين
                 أقصى اليمين»): كانت متلاصقةً في البداية وفراغٌ بعدها. الآن كلُّ تبويبٍ يأخذ نصيبَه من العرض (`flexGrow`) والخطُّ تحت
                 نصيبه كلِّه — ويبقى الصفُّ قابلاً للتمرير إن ضاق العرضُ عن خمسةٍ بأعدادها (خطٌّ كبير · شاشةٌ صغيرة). */
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 8 }} style={{ borderBottomWidth: 1, borderBottomColor: tokens.divider, marginTop: 14 }}>
                {shown.map((k) => {
                  const on = k === (aim ?? active);
                  const count = k === "activity" ? d.activity.length : k === "reviews" ? d.reviews.length : k === "lists" ? d.lists.public.length + d.lists.saved.length : null;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => {
                        if (k === active) return;
                        /* 🔴 N3-fix2 — بلا اهتزاز (أحمد ٣٠ سبتمبر: «فيها ثقل حتى فالاحساس .. مع اهتزاز»): شريطُ «اكتشف» والمكتبة
                           والمجتمع لا يهتزّ عند الضغط — كان هذا الشريطُ وحدَه يهتزّ، فتُحسّ الضغطةُ أثقلَ من أخواتها */
                        pick(k);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      style={{ flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11, paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}
                    >
                      <Text size={14} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted}>{tabMeta[k].label}</Text>
                      {count ? <Text size={11} color={tokens.muted} style={{ fontVariant: ["tabular-nums"] }}>{num(count, locale)}</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            </View>
          </Animated.View>
        </View>
      )}

      {follows && d ? (
        <FollowsSheet
          dir={follows}
          userId={d.viewer.is_me ? undefined : d.person.id}
          onClose={() => setFollows(null)}
          onOpen={(u) => (u.toLowerCase() === username.toLowerCase() ? undefined : openMember(u))}
        />
      ) : null}
      {grid && d ? <GridSheet d={d} which={grid} posterW={posterW} width={width} onClose={() => setGrid(null)} onTitle={(k, id) => { setGrid(null); openTitle(k, id); }} /> : null}
      {ranks && d ? <RanksSheet d={d} onClose={() => setRanks(false)} /> : null}
      {sorting && d && sortItems.length > 1 ? (
        <ReorderSheet items={sortItems} onClose={() => setSorting(null)} onDone={(keys) => ("fav" in sorting ? saveFav(sorting.fav, keys) : saveSec(sorting.sec, keys))} />
      ) : null}
      {menu === "menu" && d ? (
        <Sheet title={name} onClose={() => setMenu(null)}>
          {d.person.system || d.relation.blocked_by_me || d.relation.blocked_me ? null : (
            <MenuRow icon="comment" label={t.msgUserOption} dim={!(d.relation.following && d.relation.follows_me)} onPress={message} />
          )}
          {d.person.system ? null : (
            <MenuRow icon="shield" label={reported ? t.reportDone : t.reportUserOption} dim={reported} onPress={() => (reported ? setMenu(null) : setMenu("report"))} />
          )}
          {d.relation.blocked_by_me ? (
            <MenuRow icon="shield" label={t.unblockButton} onPress={() => unblock.mutate()} />
          ) : (
            <MenuRow icon="close" label={t.blockOption} danger onPress={() => setMenu("block")} />
          )}
        </Sheet>
      ) : null}
      {menu === "report" && d ? (
        <Sheet title={t.reportUserTitle} onClose={() => setMenu(null)}>
          <Text size={12} muted style={{ lineHeight: 18, marginBottom: 10 }}>{t.reportUserBody}</Text>
          <TextInput
            value={reason}
            onChangeText={(v) => setReason(v.slice(0, REPORT_REASON_MAX))}
            placeholder={t.reportReasonPlaceholder}
            accessibilityLabel={t.reportReasonPlaceholder}
            placeholderTextColor={tokens.muted}
            multiline
            maxLength={REPORT_REASON_MAX}
            textAlignVertical="top"
            style={{ minHeight: 80, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.fg, textAlign: I18nManager.isRTL ? "right" : "left" }}
          />
          <Button style={{ marginTop: 12 }} label={t.reportSend} busy={report.isPending} onPress={() => report.mutate()} />
        </Sheet>
      ) : null}
      {menu === "block" && d ? (
        <Sheet title={t.blockConfirmTitle} onClose={() => setMenu(null)}>
          <Text size={13} muted style={{ lineHeight: 19, marginBottom: 14 }}>{t.blockConfirmBody}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button style={{ flex: 1 }} variant="ghost" label={t.cancelLabel} onPress={() => setMenu(null)} />
            <Button style={{ flex: 1 }} variant="danger" label={t.blockConfirmButton} busy={block.isPending} onPress={() => block.mutate()} />
          </View>
        </Sheet>
      ) : null}
      {toast ? <Toast text={toast} bottom={insets.bottom + 16} /> : null}
    </View>
  );
}

/* ——————————————————— أجزاءُ الرأس ——————————————————— */

function RoundBtn({ icon, label, onPress, onArt }: { icon: "back" | "share" | "settings" | "dots"; label: string; onPress: () => void; onArt: boolean }) {
  const { tokens } = useApp();
  const fg = onArt ? "#fff" : tokens.fg;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}>
      {icon === "back" ? (
        <View style={{ width: 11, height: 11, borderStartWidth: 2, borderTopWidth: 2, borderColor: fg, transform: [{ rotate: "-45deg" }], marginStart: 4 }} />
      ) : (
        <Icon name={icon} size={20} color={fg} />
      )}
    </Pressable>
  );
}

/** لوحُ تبويبٍ في `TabSlide`: تمريرٌ رأسيٌّ خاصٌّ به، يبدأ بفراغٍ بطول الرأس، وطولُه يكفي ليلتصق الشريطُ أيّاً كان محتواه */
const ProfilePane = React.memo(function ProfilePane({
  topPad,
  minH,
  bottomPad,
  register,
  onScroll,
  onSettle,
  refreshControl,
  children,
}: {
  k: ProfileTabKey;
  topPad: number;
  minH: number;
  bottomPad: number;
  register: (ref: ScrollView | null) => void;
  onScroll: (y: number) => void;
  onSettle: () => void;
  refreshControl: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
  children: React.ReactNode;
}) {
  return (
    <ScrollView
      ref={register}
      refreshControl={refreshControl}
      onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
      onScrollEndDrag={onSettle}
      onMomentumScrollEnd={onSettle}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, minHeight: minH + bottomPad }}
    >
      {children}
    </ScrollView>
  );
});

function MenuRow({ icon, label, onPress, dim = false, danger = false }: { icon: "comment" | "shield" | "close"; label: string; onPress: () => void; dim?: boolean; danger?: boolean }) {
  const { tokens } = useApp();
  const c = danger ? tokens.error : dim ? tokens.muted : tokens.fg;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={18} color={danger ? tokens.error : dim ? tokens.muted : tokens.accent} />
      <Text size={15} color={c}>{label}</Text>
    </Pressable>
  );
}

function CountBtn({ icon, value, label, locked, onArt, onPress }: { icon: "people" | "heart"; value: number; label: string; locked: boolean; onArt: boolean; onPress: () => void }) {
  const { tokens, locale } = useApp();
  const c = onArt ? ART_MUTED : tokens.muted;
  return (
    <Pressable onPress={onPress} disabled={locked} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${value} ${label}`} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Icon name={icon} size={12} color={c} />
      <Text size={12} weight="600" color={c} style={{ fontVariant: ["tabular-nums"] }}>{num(value, locale)}</Text>
    </Pressable>
  );
}

/** سطرُ الحقائق: مراتبُه الأسبوعيّة (بابٌ لورقتها) · حسابُ X الموثَّق · «عضو منذ» لمشترك Plus — كالويب */
function Facts({ d, onRanks }: { d: ProfilePayload; onRanks: () => void }) {
  const { t, tokens, locale } = useApp();
  const since = d.person.joined_at
    ? t.memberSince(new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { month: "long", year: "numeric" }).format(new Date(d.person.joined_at)))
    : null;
  if (!d.weekly_ranks.length && !d.person.x && !since) return null;
  return (
    <View pointerEvents="box-none" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, paddingHorizontal: PAGE_PAD, marginTop: 10 }}>
      {d.weekly_ranks.length ? (
        <Pressable onPress={onRanks} accessibilityRole="button" accessibilityLabel={t.weeklyRanksTimes(d.weekly_ranks.length)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: tokens.accent }}>
          <Icon name="star" size={11} color={tokens.accent} />
          <Text size={11} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{num(d.weekly_ranks.length, locale)}</Text>
        </Pressable>
      ) : null}
      {d.person.x ? (
        <View accessibilityLabel={t.xVerifiedTip} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text size={12} weight="700">𝕏</Text>
          <Text size={12} muted>@{d.person.x.handle}</Text>
        </View>
      ) : null}
      {since ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="calendar" size={12} color={tokens.muted} />
          <Text size={12} muted>{since}</Text>
        </View>
      ) : null}
    </View>
  );
}

function RanksSheet({ d, onClose }: { d: ProfilePayload; onClose: () => void }) {
  const { t, tokens, locale } = useApp();
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <Sheet title={t.weeklyRanksTitle} onClose={onClose}>
      <Text size={12} muted style={{ marginBottom: 8 }}>{t.weeklyRanksHint}</Text>
      {d.weekly_ranks.map((r, i) => (
        <View key={r.week} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: tokens.divider }}>
          <Text size={13}>{t.weeklyRanksWeek(fmt.format(new Date(`${r.week}T00:00:00Z`)))}</Text>
          <Text size={13} weight="700" color={tokens.accent}>{t.weeklyRankOrd(r.rank)}</Text>
        </View>
      ))}
    </Sheet>
  );
}

/* ——————————————————— التبويبات ——————————————————— */

const asItem = (x: ProfileTitle | ProfileShow): CardItem => ({
  key: `${x.media_type}-${x.tmdb_id}`,
  kind: x.media_type,
  id: x.tmdb_id,
  title: x.title,
  posterPath: x.poster_path,
  /* تقدّمُ صاحب الملفّ على ملصقه (`PosterCard.progress` في الويب) — الخيطُ خيطُه لا القارئ */
  progress: "progress" in x ? x.progress : 0,
  completed: "progress" in x ? x.progress >= 100 : false,
  dropped: false,
});

/* 🆕 N3 — مفاتيحُ الترتيب بصيغة الويب (`sectionKeyOf` · `listItemKey`) — ما تكتبه الورقةُ هو ما يقرؤه الخادمُ بحرفه */
type FavRow = "shows" | "movies" | "anime";
type SortSec = ProfileSectionOrderBody["section"];
const favKey = (x: ProfileTitle) => `${x.media_type}-${x.tmdb_id}`;
const showKey = (x: ProfileShow) => sectionKeyOf.show(x.tmdb_id);
const listKey = (l: ProfileList) => sectionKeyOf.list(l.id);
/** يرتّب بالمفاتيح، وما لم تذكره يُذيَّل بترتيبه (`applySectionOrder` نفسُها) — فالتفاؤلُ والجلبُ اللاحقُ يتّفقان */
function byKeys<T>(xs: T[], keyOf: (x: T) => string, keys: string[]): T[] {
  const at = new Map(keys.map((k, i) => [k, i] as const));
  const ranked = xs.filter((x) => at.has(keyOf(x))).sort((a, b) => at.get(keyOf(a))! - at.get(keyOf(b))!);
  return [...ranked, ...xs.filter((x) => !at.has(keyOf(x)))];
}

/**
 * عنوانُ صفّ — 🆕 N3: **ومقبضُ الترتيب في طرفه لصاحب الملفّ** (`onSort` — الويب: زرُّ `grip` ١٨ في خانة `action`)، أو ما يُمرَّر
 * مكانَه (`action` — رايةُ المحفوظات). المقبضُ لا يرفع الصفّ: هامشُه السالبُ يُبقي العنوانَ على ارتفاعه.
 */
function SectionHead({ icon, label, onSort, action }: { icon: string; label: string; onSort?: () => void; action?: React.ReactNode }) {
  const { t, tokens } = useApp();
  const sort = onSort
    ? () => {
        haptic.pick();
        onSort();
      }
    : undefined;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAGE_PAD, marginTop: 22, marginBottom: 10 }}>
      <Pressable onPress={sort} disabled={!sort} style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={iconOr(icon, "list")} size={16} color={tokens.accent} />
        <Text size={17} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text>
      </Pressable>
      {action ??
        (sort ? (
          <Pressable
            onPress={sort}
            accessibilityRole="button"
            accessibilityLabel={t.listReorder}
            hitSlop={4}
            style={({ pressed }) => ({ width: 36, height: 36, marginVertical: -9, marginEnd: -8, borderRadius: 18, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name="grip" size={18} color={tokens.muted} />
          </Pressable>
        ) : null)}
    </View>
  );
}

function Rail({ items, posterW, onTitle }: { items: (ProfileTitle | ProfileShow)[]; posterW: number; onTitle: (k: "tv" | "movie", id: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}>
      {items.map((x) => (
        <PosterCard key={`${x.media_type}-${x.tmdb_id}`} item={asItem(x)} width={posterW} onPress={(it) => onTitle(it.kind, it.id)} />
      ))}
    </ScrollView>
  );
}

function Empty({ text }: { text: string }) {
  return <Text muted style={{ textAlign: "center", paddingVertical: 40, paddingHorizontal: PAGE_PAD }}>{text}</Text>;
}

/** المفضّلة: مسلسلاتُه وأفلامُه بترتيبه (`favorites.order` — D-564) ثمّ الأنمي يذيّلهما (D-941) */
function Favorites({ d, posterW, onTitle, onSort }: { d: ProfilePayload; posterW: number; onTitle: (k: "tv" | "movie", id: number) => void; onSort?: (row: FavRow) => void }) {
  const { t } = useApp();
  const f = d.favorites;
  if (!f.shows.length && !f.movies.length && !f.anime.length) return <Empty text={t.profileEmptyFavorites} />;
  const rows: { key: FavRow; icon: string; label: string; items: ProfileTitle[] }[] = [
    ...f.order.map((k) => (k === "shows" ? { key: k, icon: "tv", label: t.shortShows, items: f.shows } : { key: k, icon: "film", label: t.shortMovies, items: f.movies })),
    { key: "anime" as const, icon: "sparkles", label: t.discoverTabAnime, items: f.anime },
  ];
  return (
    <View>
      {rows.filter((r) => r.items.length).map((r) => (
        <View key={r.key}>
          {/* 🆕 N3 — «صفُّ مفضّلةٍ يُرتَّب من عنوانه» (`FavoritesRail` — D-567): العنوانُ والمقبضُ يفتحان الورقة */}
          <SectionHead icon={r.icon} label={r.label} onSort={onSort && r.items.length > 1 ? () => onSort(r.key) : undefined} />
          <Rail items={r.items} posterW={posterW} onTitle={onTitle} />
        </View>
      ))}
    </View>
  );
}

/** نظرةٌ عامّة: أقسامُه بترتيبه (`sections` — D-581)، وسقفُ البطاقات في الصفّ تفضيلُه (`display.cards` — D-152) */
function Overview({
  d,
  posterW,
  onTitle,
  onList,
  onPerson,
  onSort,
}: {
  d: ProfilePayload;
  posterW: number;
  onTitle: (k: "tv" | "movie", id: number) => void;
  onList: (id: string) => void;
  onPerson: (id: number) => void;
  /** 🆕 N3 — لصاحب الملفّ: مقبضُ ترتيب الأقسام الخمسة (`SectionReorderButton` — «التقييمات» لا تُرتَّب في الويب) */
  onSort?: (sec: SortSec) => void;
}) {
  const { t, tokens } = useApp();
  const meta = profileSectionMeta(t);
  const cap = <T,>(xs: T[]) => (d.display.cards == null ? xs : xs.slice(0, d.display.cards));
  const o = d.overview;
  const body = (s: ProfileSectionKey): React.ReactNode => {
    switch (s) {
      case "shows":
        return o.shows.length ? <Rail items={cap(o.shows)} posterW={posterW} onTitle={onTitle} /> : null;
      case "movies":
        return o.movies.length ? <Rail items={cap(o.movies)} posterW={posterW} onTitle={onTitle} /> : null;
      case "anime":
        return o.anime.length ? <Rail items={cap(o.anime)} posterW={posterW} onTitle={onTitle} /> : null;
      case "artists":
        return o.artists.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 14 }}>
            {cap(o.artists).map((a) => {
              const img = profileUrl(a.profile_path, "w185");
              return (
                <Pressable key={a.person_id} onPress={() => onPerson(a.person_id)} accessibilityRole="link" style={{ width: 78, alignItems: "center", gap: 6 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                    {img ? <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="people" size={24} color={tokens.muted} />}
                  </View>
                  <Text size={11} numberOfLines={2} style={{ textAlign: "center" }}>{a.name ?? ""}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null;
      case "lists":
        return o.lists.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}>
            {cap(o.lists).map((l) => (
              <View key={l.id} style={{ width: 280 }}>
                <ListCard card={listCardOf(l, t)} onPress={() => onList(l.id)} />
              </View>
            ))}
          </ScrollView>
        ) : null;
      case "ratings":
        return o.ratings.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}>
            {cap(o.ratings).map((r) => (
              <View key={`${r.media_type}-${r.tmdb_id}`} style={{ width: posterW }}>
                <PosterCard
                  item={{ key: `${r.media_type}-${r.tmdb_id}`, kind: r.media_type, id: r.tmdb_id, title: r.title ?? "", posterPath: r.poster_path, progress: 0, completed: false, dropped: false }}
                  width={posterW}
                  onPress={(it) => onTitle(it.kind, it.id)}
                />
                {r.rating != null ? <RatingPill value={r.rating} /> : null}
              </View>
            ))}
          </ScrollView>
        ) : null;
    }
  };
  const blocks = d.sections.map((s) => ({ s, node: body(s) })).filter((b) => b.node);
  const countOf = (s: ProfileSectionKey) => (s === "ratings" ? 0 : o[s].length);
  /* 🆕 N3 — ما أخفيتَه تراه أنت وحدك (D-152): ما ليس في ترتيبك يُرسم صفّاً منقّطاً بشارته — الويبُ تحت الأقسام */
  const hidden = d.viewer.is_me ? PROFILE_SECTIONS.filter((s) => !d.sections.includes(s)) : [];
  return (
    <View>
      {blocks.length ? (
        blocks.map(({ s, node }) => (
          <View key={s}>
            <SectionHead
              icon={meta[s].icon}
              label={s === "ratings" ? t.profileTopRated : meta[s].label}
              onSort={onSort && s !== "ratings" && countOf(s) > 1 ? () => onSort(s as SortSec) : undefined}
            />
            {node}
          </View>
        ))
      ) : (
        <Empty text={t.profileEmptyOverview} />
      )}
      {hidden.length ? (
        <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 20, gap: 10 }}>
          {hidden.map((s) => (
            <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: radius.card, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.border }}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name={iconOr(meta[s].icon, "list")} size={16} color={tokens.muted} />
                  <Text size={14} weight="700" muted numberOfLines={1} style={{ flexShrink: 1 }}>{meta[s].label}</Text>
                </View>
                <Text size={12} muted>{t.profileHiddenHint}</Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border }}>
                <Text size={12} muted>{t.profileHiddenBadge}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RatingPill({ value }: { value: number }) {
  const { tokens, locale } = useApp();
  return (
    <View style={{ position: "absolute", top: 6, start: 6, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: tokens.accent }}>
      <Icon name="star" size={10} color={tokens.onAccent} />
      <Text size={11} weight="700" color={tokens.onAccent} style={{ fontVariant: ["tabular-nums"] }}>{num(value, locale)}</Text>
    </View>
  );
}

const listCardOf = (l: ProfileList, t: ReturnType<typeof useApp>["t"]) => ({
  id: l.id,
  name: l.name,
  owner: l.owner,
  owner_avatar: l.owner_avatar,
  countText: t.listCount(l.item_count),
  posters: l.posters,
  cover: null,
  stats: { saves: l.saves, reviews: l.reviews, rating: l.rating },
  playlist: null,
});

/** النشاط — شاشةُ `/activity` بقواعدها (`core/activityDays` — الويبُ يقرأ الملفَّ نفسَه): الرقاقات · حصيلةُ الأسبوع · الأيّام */
function ActivityPane({ rows, onTitle }: { rows: ProfileActivity[]; onTitle: (k: "tv" | "movie", id: number) => void }) {
  const { t, tokens, locale } = useApp();
  const [scope, setScope] = useState<Scope>("all");
  const items: ActivityItem[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        at: r.at,
        mediaType: r.media_type,
        tmdbId: r.tmdb_id,
        title: r.title,
        poster: r.poster,
        season: r.season,
        episode: r.episode,
        rating: r.rating,
        listName: r.list_name,
      })),
    [rows],
  );
  const matching = items.filter((it) => keep(it, scope));
  const today = dayKey(new Date().toISOString(), true);
  const weekCount = matching.filter((it) => dayKey(it.at, true) >= shiftDay(today, -6)).length;
  const days = groupDays(matching, true, t, locale, today);
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 14 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {SCOPES.map((s) => (
          <Chip key={s} label={scopeLabel(s, t)} active={scope === s} onPress={() => (s === scope ? undefined : (haptic.pick(), setScope(s)))} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.divider, marginTop: 10 }}>
        <Text size={13} muted>{t.activityThisWeek}</Text>
        <Text size={13} muted style={{ fontVariant: ["tabular-nums"] }}>{t.activityCount(weekCount)}</Text>
      </View>
      {days.length === 0 ? (
        <Empty text={t.profileEmptyActivity} />
      ) : (
        days.map((day) => (
          <View key={day.key} style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <Text size={15} weight="700">{day.label}</Text>
              <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(day.rows.length, locale)}</Text>
            </View>
            <View style={{ borderStartWidth: 1, borderStartColor: tokens.divider, marginStart: 6, paddingStart: 14 }}>
              {day.rows.map((r) => {
                const ep = episodeOf(r, t);
                return (
                  <Pressable key={r.id} onPress={() => onTitle(r.mediaType, r.tmdbId)} accessibilityRole="link" style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 }]}>
                    <View style={{ position: "absolute", start: -19, width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: tokens.divider, backgroundColor: tokens.bg }} />
                    <View style={{ width: 44, aspectRatio: 2 / 3, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                      {r.poster ? <Image source={{ uri: r.poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name={r.mediaType === "tv" ? "tv" : "film"} size={14} color={tokens.muted} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text size={14} numberOfLines={1}>
                        <Text size={14} muted>{verbOf(r, t)} </Text>
                        <Text size={14} weight="700">{r.title}</Text>
                        {ep ? <Text size={14} muted> · {ep}</Text> : null}
                        {r.kind === "list" && r.listName ? <Text size={14} muted> {t.actVerbTo} {r.listName}</Text> : null}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                        {r.rating != null ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <Icon name="star" size={12} color={tokens.accent} />
                            <Text size={12} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(r.rating, locale)}</Text>
                          </View>
                        ) : null}
                        <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{clock(r.at, locale, true)}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/** المراجعات: الأحدثُ أوّلاً، والتقييمُ بلا متنٍ صفٌّ أيضاً (D-583)؛ الحرقُ مغطّى حتى يُكشف. قلوبُها تُرى — والضغطُ في N2 */
function ReviewsPane({
  rows,
  onTitle,
  onLike,
  onComment,
}: {
  rows: ProfileReview[];
  onTitle: (k: "tv" | "movie", id: number) => void;
  onLike?: (r: ProfileReview) => void;
  onComment: (r: ProfileReview) => void;
}) {
  const { t, tokens, locale } = useApp();
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  if (!rows.length) return <Empty text={t.profileEmptyReviews} />;
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 6 }}>
      {rows.map((r, i) => {
        const k = `${r.media_type}-${r.tmdb_id}`;
        const hidden = r.has_spoiler && !shown.has(k);
        return (
          <View key={k} style={{ flexDirection: "row", gap: 12, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: tokens.divider }}>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Pressable onPress={() => onTitle(r.media_type, r.tmdb_id)} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{r.title ?? ""}</Text>
                {r.rating != null ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Icon name="star" size={12} color={tokens.accent} />
                    <Text size={12} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{num(r.rating, locale)}</Text>
                  </View>
                ) : null}
              </Pressable>
              {r.review ? (
                hidden ? (
                  <Pressable onPress={() => setShown((s) => new Set(s).add(k))} accessibilityRole="button" style={{ padding: 10, borderRadius: radius.control, backgroundColor: tokens.surface2 }}>
                    <Text size={12} muted>{`${t.spoilerMark} · ${t.spoilerShow}`}</Text>
                  </Pressable>
                ) : (
                  <Text size={13} style={{ lineHeight: 19 }}>{r.review}</Text>
                )
              ) : null}
              {/* 🆕 N2 — القلبُ فعلٌ و«تعليق» يفتح خيطَ الرأي (`LikeButton` · `RowComment` في الويب) */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                <Pressable onPress={onLike ? () => onLike(r) : undefined} disabled={!onLike} hitSlop={8} accessibilityRole="button" accessibilityState={{ selected: r.liked_by_me }} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="heart" size={14} color={r.liked_by_me ? tokens.accent : tokens.muted} />
                  {r.likes > 0 ? <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(r.likes, locale)}</Text> : null}
                </Pressable>
                <Pressable onPress={() => onComment(r)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.actionComment} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="comment" size={14} color={tokens.muted} />
                  <Text size={12} muted>{t.actionComment}</Text>
                </Pressable>
              </View>
            </View>
            <PosterCard
              item={{ key: k, kind: r.media_type, id: r.tmdb_id, title: r.title ?? "", posterPath: r.poster_path, progress: r.mine.progress, completed: r.mine.watched, dropped: r.mine.dropped }}
              width={64}
              marquee={false}
              onPress={(it) => onTitle(it.kind, it.id)}
            />
          </View>
        );
      })}
    </View>
  );
}

/** القوائم: المعلنةُ ثمّ المحفوظة (رايتُها لصاحبها — D-594؛ فراغُها يُسقط قسمَها) */
function ListsPane({
  d,
  onList,
  onMember,
  savedFlag,
}: {
  d: ProfilePayload;
  onList: (id: string) => void;
  onMember: (name: string) => void;
  /** 🆕 N3 — لصاحب الملفّ: رايةُ قسم المحفوظات (`SavedListsToggle` — D-594): هو يراه دائماً وعليه الرقاقة، والزائرُ حين «تعمل» */
  savedFlag?: { on: boolean; onToggle: (on: boolean) => void };
}) {
  const { t } = useApp();
  void onMember;
  const { public: pub, saved } = d.lists;
  if (!pub.length && !saved.length) return <Empty text={t.profileEmptyLists} />;
  const block = (label: string, icon: string, ls: ProfileList[], action?: React.ReactNode) =>
    ls.length ? (
      <View>
        <SectionHead icon={icon} label={label} action={action} />
        <View style={{ paddingHorizontal: PAGE_PAD, gap: GAP }}>
          {ls.map((l) => (
            <ListCard key={l.id} card={listCardOf(l, t)} onPress={() => onList(l.id)} />
          ))}
        </View>
      </View>
    ) : null;
  return (
    <View>
      {block(t.profileListsRail, "list", pub)}
      {block(t.savedListsSection, "bookmark", saved, savedFlag ? <PlayPill on={savedFlag.on} label={t.savedListsSection} onToggle={savedFlag.onToggle} /> : undefined)}
    </View>
  );
}

/** ورقةُ خانةِ الأرقام: الصفُّ كاملاً مجمَّعاً بالتصنيف كالويب (`ProfileStatSheet` · D-645 — أبجديٌّ داخل التصنيف) */
function GridSheet({
  d,
  which,
  posterW,
  width,
  onClose,
  onTitle,
}: {
  d: ProfilePayload;
  which: Grid;
  posterW: number;
  width: number;
  onClose: () => void;
  onTitle: (k: "tv" | "movie", id: number) => void;
}) {
  const { t, locale } = useApp();
  const rows: (ProfileTitle | ProfileShow)[] = which === "shows" ? d.overview.shows : which === "movies" ? d.overview.movies : d.overview.anime;
  const collator = useMemo(() => new Intl.Collator(locale === "ar" ? "ar" : "en", { sensitivity: "base", numeric: true }), [locale]);
  const sortKey = (s: string) => s.trim().replace(/^(the|a|an)\s+/i, "");
  const byTitle = (a: ProfileTitle, b: ProfileTitle) => collator.compare(sortKey(a.title), sortKey(b.title));
  const groups = groupByGenre(rows, (r) => r.genres, byTitle);
  const cols = Math.max(3, Math.floor((width - PAGE_PAD * 2 + GAP) / (posterW + GAP)));
  const w = Math.floor((width - PAGE_PAD * 2 - GAP * (cols - 1)) / cols);
  const title = which === "shows" ? t.shortShows : which === "movies" ? t.shortMovies : t.discoverTabAnime;
  const gridOf = (xs: (ProfileTitle | ProfileShow)[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
      {xs.map((x) => (
        <PosterCard key={`${x.media_type}-${x.tmdb_id}`} item={asItem(x)} width={w} marquee={false} onPress={(it) => onTitle(it.kind, it.id)} />
      ))}
    </View>
  );
  return (
    <Sheet title={`${title} · ${num(rows.length, locale)}`} onClose={onClose}>
      <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false}>
        {groups.length <= 1
          ? gridOf([...rows].sort(byTitle))
          : groups.map((g) => (
              <View key={g.genre?.slug ?? "other"} style={{ marginBottom: 16 }}>
                <Text size={14} weight="700" muted style={{ marginBottom: 8 }}>{g.genre ? browseGenreName(g.genre, locale) : t.genreOther}</Text>
                {gridOf(g.rows)}
              </View>
            ))}
      </ScrollView>
    </Sheet>
  );
}
