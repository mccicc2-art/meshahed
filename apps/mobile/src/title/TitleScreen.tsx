import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qk, write, ApiError } from "../api";
import { useApp } from "../state";
import { shell, type NativeRoot } from "../shell";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Chip } from "../library/Chip";
import { radius } from "../theme";
import { CONFIG } from "../config";
import { backdropUrl, posterUrl } from "@/core/media";
import { num } from "@/core/i18n";
import { SeasonAccordion, firstOpenSeason, seasonQuery } from "./SeasonAccordion";
import { mark } from "../perfMarks";
import { TrailerPlayer } from "../trailers/TrailerPlayer";
import { ActionRow } from "./ActionRow";
import { Sheet } from "../library/Sheet";
import { ArtSheet } from "./ArtSheet";
import { Logo } from "../Logo";
import { Clipboard } from "react-native";
import { useExtras, RatingsLine, Pulse, WatchWhere, ListSheet, CastRail, RelatedRails, extrasKey } from "./TitleExtras";
import { useCommunity, CommunityTab, ReviewSheet, communityKey } from "./TitleCommunity";
import type {
  FavoriteBody,
  FollowBody,
  RateBody,
  SetDroppedBody,
  ShowRefBody,
  TitleExtrasPayload,
  TitlePayload,
  ToggleMovieBody,
  TrackResult,
  UnfollowBody,
  UnrateBody,
} from "../contracts";

/**
 * ====== صفحةُ العمل أصليّةً — Phase 11-D · D1 (D-956) ======
 *
 * 🔑 **الأصلُ شاشةُ v1.1 القديمة** (`app/title/[kind]/[id].tsx` في `07939101`، D-916/
 * D-919) **فوق العقد نفسِه** `GET /api/v1/title/{kind}/{id}` ومساراتِ `track/*` —
 * أُعيدت بلباس نظام التصميم الحاليّ (الترويسةُ ٦٤ · segmented · الرقاقاتُ ·
 * `Button` الواحد) **وبتشريح الصفحة الويبيّة**: ترويسةٌ بالرجوع والمشاركة ·
 * الخلفيّةُ والملصقُ والاسمُ والسنةُ والأنواعُ · الأفعالُ (أتابع · شاهدته · أوقفت)
 * · التقييمُ من ١٠ · تبويبا **الحلقات** و**المعلومات**.
 *
 * 🆕 **D2/D3 في الشاشة نفسِها** (`TitleExtras` · `TitleCommunity`): IMDb/RT/العمر
 * والنبضُ · أين أشاهده · المفضّلُ · «إلى قائمة» · الطاقمُ · السلسلةُ والمشابهات ·
 * تبويبُ المجتمع (آراءٌ ونشرات) · ورقةُ رأيي بنصّه و«فيها حرق». **ما بقي باباً
 * ويبيّاً بقرار**: التريلرُ (مشغّلُ الصفحة بصوته D-933) · النقاشُ المتشعّب (`/talk`) ·
 * صفحةُ الشخص · إنشاءُ قائمةٍ جديدة · قائمةُ ⋮ (الغلاف · الإبلاغ). **لا يُفتح من
 * الويب** حتى B6: الوصولُ من المكتبة و«اكتشف» الأصليّتين (دفعٌ في المكدّس).
 *
 * 🔑 **الكتابةُ تفاؤليّةٌ ثمّ إعادةُ جلب**: مساراتُ `track/*` تُبطل `home`/`me:library`/
 * `me:stats` لا `title:*` — فالشاشةُ تعدّل كاشَها فوراً ثمّ تعيد الجلبَ لتأكيد
 * الخادم (كما `TitleActions` في الويب: التفاؤلُ ثمّ الارتداد عند الفشل).
 */
const HEADER_H = 64;
const PAGE_PAD = 16;

/** D-1000 — `from="web"`: فُتحت من صفحةٍ ويبيّة؛ أبوابُها بلا `returnTo` والرجوعُ إلى تلك الصفحة */
export function TitleScreen({ kind, id, from = "library" }: { kind: "tv" | "movie"; id: number; from?: NativeRoot | "web" }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<"episodes" | "info" | "community">(kind === "tv" ? "episodes" : "info");
  const [toast, setToast] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  /* D-1034 — انبثاقُ التقييم بحالتين: `edit` فتحه صاحبُه · `prompt` صعد بعد «شاهدته»/آخر حلقة */
  const [reviewOpen, setReviewOpen] = useState<false | "edit" | "prompt">(false);
  /* D-959 — التريلرُ يعمل في الصفحة: تشغيلٌ صريحٌ بضغطة، **ومغادرةُ التبويب توقفه**
     فلا يعود صوتٌ من نفسه حين يرجع القارئُ إلى «المعلومات».
     🆕 D-964 — **والرغبةُ والكتمُ هنا لا في المشغّل**: حالةٌ داخلَه تموت مع إعادة
     التركيب فيستأنف ما أوقفه صاحبُه (حجّةُ الصفِّ نفسُها، `TrailersRail`). */
  const [trailerOn, setTrailerOn] = useState(false);
  const [trailerWant, setTrailerWant] = useState(true);
  const [trailerMuted, setTrailerMuted] = useState(false);

  const q = useQuery({
    queryKey: qk.title(kind, id),
    queryFn: async () => (await api<TitlePayload>(`/api/v1/title/${kind}/${id}`)).data,
    staleTime: 60_000,
  });
  const d = q.data;
  /* 🆕 D-1118 — `title.open`: من فتح الشاشة إلى أوّل بيانات (`cached=1` إن رُسمت من الكاش/الملفّ) */
  const openMark = useRef<{ t0: number; cached: number } | null>({ t0: performance.now(), cached: q.data ? 1 : 0 });
  useEffect(() => {
    if (!d || !openMark.current) return;
    mark("title.open", performance.now() - openMark.current.t0, { cached: openMark.current.cached, screen: kind });
    openMark.current = null;
  }, [d, kind]);
  /* 🆕 D-1118 — **الموسمُ المفتوحُ يُجلب مع الصفحة لا بعد رسم قائمتها**: ما إن تُعرف الصفحةُ (من الكاش أو
     الشبكة) يبدأ جلبُ حلقات أوّل موسمٍ لم يكتمل — والقائمةُ حين تُرسم تجده في الطريق أو واصلاً (المفتاحُ واحد). */
  useEffect(() => {
    if (!d || d.kind !== "tv") return;
    const n = firstOpenSeason(d);
    if (n !== null) void qc.prefetchQuery(seasonQuery(d.id, n));
  }, [d, qc]);
  const extras = useExtras(kind, id);
  const x = extras.data;
  const community = useCommunity(kind, id, tab === "community");

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

  const fail = useCallback(
    (e: unknown) => {
      const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[key];
      setToast(typeof msg === "string" ? msg : t.apiInternal);
      void q.refetch();
    },
    [t, q],
  );
  /* D-959: تركُ تبويب «المعلومات» يهدم المشغّل — لا صوتَ خلف تبويبٍ آخر */
  useEffect(() => {
    if (tab !== "info") setTrailerOn(false);
  }, [tab]);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(h);
  }, [toast]);

  /* تعديلٌ تفاؤليٌّ في كاش العنوان — `me` وحدَها */
  const patchMe = useCallback(
    (fn: (me: TitlePayload["me"]) => Partial<TitlePayload["me"]>) => {
      qc.setQueryData<TitlePayload>(qk.title(kind, id), (prev) => (prev ? ({ ...prev, me: { ...prev.me, ...fn(prev.me) } } as TitlePayload) : prev));
    },
    [qc, kind, id],
  );
  const settle = () => void q.refetch();

  const follow = useMutation({
    mutationFn: (following: boolean) =>
      following
        ? write<TrackResult>("/api/v1/track/follow", { tmdbId: id, mediaType: kind, title: d?.name ?? "", posterPath: d?.poster_path ?? null } satisfies FollowBody)
        : write<TrackResult>("/api/v1/track/unfollow", { tmdbId: id, mediaType: kind } satisfies UnfollowBody),
    onMutate: (following) => patchMe(() => ({ following, dropped: false })),
    onSuccess: settle,
    onError: fail,
  });
  const drop = useMutation({
    mutationFn: (dropped: boolean) => write<TrackResult>("/api/v1/track/dropped", { tmdbId: id, mediaType: kind, dropped } satisfies SetDroppedBody),
    onMutate: (dropped) => patchMe(() => ({ dropped })),
    onSuccess: settle,
    onError: fail,
  });
  const movieWatched = useMutation({
    mutationFn: (watched: boolean) =>
      write<TrackResult>("/api/v1/track/movie", { movieTmdbId: id, runtime: d?.kind === "movie" ? d.runtime : null, watched } satisfies ToggleMovieBody),
    onMutate: (watched) => patchMe(() => ({ watched, following: true }) as Partial<TitlePayload["me"]>),
    onSuccess: (_r, watched) => {
      /* D-1034 — الانبثاقُ يقول «أُشّر كمُشاهَد» بنفسه، فلا إشعارَ تحته يكرّره */
      if (watched && d?.me.rating == null) setReviewOpen("prompt");
      else setToast(t.watchedMarked);
      settle();
    },
    onError: fail,
  });
  /**
   * 🔴 D-989 — **«منتهٍ ✓» يُضغط فيرجع «علّمه مشاهَداً» وتُمسح المشاهدة** (طلبُ أحمد بتسجيل،
   * ١٦ سبتمبر): كانت الضغطةُ على «منتهٍ» تفتح الصفحةَ الويبيّة. الآن الزرُّ مفتاحٌ بالاتّجاهين
   * كما للفيلم: `show-unwatched` يمسح حلقاتِ المسلسل كلَّها (`unmarkShow` الويب)، والعدّادُ
   * يصفّر فوراً تفاؤلاً. المتابعةُ لا تُمسّ — من أنهى ثمّ تراجع ما زال يتابع.
   */
  const showUnwatched = useMutation({
    mutationFn: () => write<TrackResult>("/api/v1/track/show-unwatched", { showTmdbId: id } satisfies ShowRefBody),
    onMutate: () => patchMe((me) => ("watched_count" in me ? { watched_count: 0, watched: [] } : {}) as Partial<TitlePayload["me"]>),
    onSuccess: settle,
    onError: fail,
  });
  const showWatched = useMutation({
    mutationFn: () => write<{ added?: unknown[] }>("/api/v1/track/show-watched", { showTmdbId: id } satisfies ShowRefBody),
    /* D-986 — تفاؤلٌ هنا أيضاً: تعليمُ مسلسلٍ بمئات الحلقات يكتبها كلَّها على الخادم (ثوانٍ)،
       والزرُّ الذي يدور بلا أثرٍ يُقرأ تعليقاً (بلاغُ أحمد: «ضغطت مشاهدة يعلق»). العدّادُ يمتلئ
       فوراً، والحقيقةُ تصل مع `settle` — التي لم تعد تكذب بعد `no-store`. */
    /* التفاؤلُ يقول ما يفعله الخادم فقط: `markShowWatched` لا يتابع (المسلسلُ المنتهي في المكتبة
       بمشاهدته لا بمتابعته) — فلا `following: true` هنا (كانت تُدّعى ثمّ تُنقض) */
    onMutate: () => patchMe((me) => (d?.kind === "tv" && "watched_count" in me ? { watched_count: d.aired_total } : {}) as Partial<TitlePayload["me"]>),
    onSuccess: (r) => {
      /* D-1034 — من لم يقيّم يرى الانبثاقَ (وفيه «أُشّر كمُشاهَد»)؛ الإشعارُ لمن قيّم فلا انبثاقَ له */
      if (d?.me.rating != null) setToast(Array.isArray(r?.added) && r.added.length ? t.watchedMarkedCount(r.added.length) : t.watchedMarked);
      settle();
    },
    onError: (e) => {
      /* التفاؤلُ رفع العدّادَ فصعد الانبثاق؛ فشلُ الكتابة يُنزله مع العدّاد — لا نسأل عن مشاهدةٍ لم تقع */
      setReviewOpen((v) => (v === "prompt" ? false : v));
      fail(e);
    },
  });
  /* التقييمُ السريع (رقاقةٌ) يحفظ النصَّ القائم؛ ورقةُ الرأي تحفظ الثلاثة معاً */
  const rate = useMutation({
    mutationFn: (v: { rating: number | null; review?: string | null; has_spoiler?: boolean }) =>
      v.rating === null
        ? write<TrackResult>("/api/v1/track/unrate", { tmdbId: id, mediaType: kind } satisfies UnrateBody)
        : write<TrackResult>("/api/v1/track/rate", {
            tmdbId: id,
            mediaType: kind,
            rating: v.rating,
            review: v.review === undefined ? (community.data?.my_review?.review ?? "") : (v.review ?? ""),
            hasSpoiler: v.has_spoiler ?? community.data?.my_review?.has_spoiler ?? false,
            title: d?.name ?? "",
            posterPath: d?.poster_path ?? null,
          } satisfies RateBody),
    onMutate: (v) => patchMe(() => ({ rating: v.rating })),
    onSuccess: () => {
      settle();
      void qc.invalidateQueries({ queryKey: communityKey(kind, id) });
      setReviewOpen(false);
    },
    onError: fail,
  });

  const webPath = `/${kind === "tv" ? "show" : "movie"}/${id}`;
  const share = useCallback(async () => {
    try {
      await Share.share({ message: `${d?.name ?? ""} — ${CONFIG.apiBase}${webPath}`, url: `${CONFIG.apiBase}${webPath}` });
    } catch {
      /* أُغلقت الورقة */
    }
  }, [d?.name, webPath]);
  /* «المزيد في الويب» — الصفحةُ نفسُها؛ الرجوعُ منها يعود إلى الشاشة الأصليّة التي سبقتنا (D-949) */
  const openWeb = useCallback(
    (suffix = "", absolute?: string) => void shell.open(absolute ?? `${webPath}${suffix}`, from === "web" ? undefined : { returnTo: from }).then(back),
    [webPath, back, from],
  );
  const openTitle = useCallback((k: "tv" | "movie", tid: number) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: k, id: String(tid), from } }), [router, from]);

  const tvDone = d?.kind === "tv" ? d.aired_total > 0 && d.me.watched_count >= d.aired_total : false;
  /**
   * 🆕 D-1034 — **«شاهدته» يسأل عن التقييم، وصفُّ النجوم تحت الأفعال حُذف** (طلبُ أحمد بلقطة: «مكان التقييم
   * بحذفه، أبغى إذا ضغطت على واتشيد يطلع لي تقييم» ثمّ «إذا ضغط آخر حلقة يطلع له التقييم») — وهو سلوكُ
   * الويب منذ D-158. القواعدُ قواعدُه: **الفعلُ يقع أوّلاً** وإغلاقُ الانبثاق لا يتراجع عنه · **من قيّم
   * لا يُسأل** · إلغاءُ المشاهدة لا يفتح شيئاً.
   * 🔑 **للمسلسل يُراقَب الانتقالُ «غير منتهٍ ⇒ منتهٍ» لا الزرّ**: فيغطّي «شاهدته» و«الموسم كامل» و«حتّى
   * هنا» **وآخرَ حلقةٍ تُعلَّم باليد** بمسارٍ واحد. والمرجعُ يُهيَّأ عند وصول البيانات: مسلسلٌ فُتح منتهياً
   * لا يسأل. ⚖️ «شاهدته» قلّاب فلا يصلح باباً للتعديل — بابُه الدائم نجمةُ سطر الاسم وبطاقةُ تبويب المجتمع.
   */
  const wasDone = useRef<boolean | null>(null);
  useEffect(() => {
    if (d?.kind !== "tv") return;
    const prev = wasDone.current;
    wasDone.current = tvDone;
    if (prev === false && tvDone && d.me.rating == null) setReviewOpen("prompt");
  }, [d, tvDone]);
  const done = d?.kind === "movie" ? d.me.watched : tvDone;
  /* D-1014 — ورقةُ القوائم وورقةُ البطاقة الحمراء يفتحهما صفُّ الأفعال */
  const [listOpen, setListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [art, setArt] = useState(false);
  const [redCard, setRedCard] = useState(false);
  const favorite = useMutation({
    mutationFn: () => write<{ favorite: boolean }>("/api/v1/track/favorite", { tmdbId: id, mediaType: kind, title: d?.name ?? "", posterPath: d?.poster_path ?? null } satisfies FavoriteBody),
    onMutate: () => qc.setQueryData<TitleExtrasPayload>(extrasKey(kind, id), (prev) => (prev ? { ...prev, favorite: !prev.favorite } : prev)),
    onSuccess: (r) => qc.setQueryData<TitleExtrasPayload>(extrasKey(kind, id), (prev) => (prev ? { ...prev, favorite: r.favorite } : prev)),
    onError: (e) => {
      qc.setQueryData<TitleExtrasPayload>(extrasKey(kind, id), (prev) => (prev ? { ...prev, favorite: !prev.favorite } : prev));
      fail(e);
    },
  });
  const year = (d?.kind === "tv" ? d.first_air_date : d?.release_date)?.slice(0, 4) ?? "";
  const heroH = Math.round(width * 9 / 16);
  /* 🔴 D-1040 — **أسفلُ الملصق = أسفلُ الخلفيّة** (طلبُ أحمد بخطٍّ أحمر على لقطة 1.11.0: «اجعل أسفل البوستر = أسفل
     الهيدر، ولا تنسَ ترفع البقيّة معها، اسمُ الفلم = أعلى البوستر»): الصفُّ كلُّه يصعد بارتفاع الملصق (١٦٨)، فيجلس
     الملصقُ والاسمُ والتفاصيلُ والرقاقاتُ **داخل** الصورة، وصفُّ الأفعال يبدأ تحتها مباشرة.
     ⚖️ **سقفٌ واحد**: على شاشةٍ ضيّقة (٣٦٠dp ⇒ خلفيّةٌ ٢٠٢) كان الملصقُ سيصعد تحت زرّ الرجوع (ينتهي عند ٤٤)؛
     فالرفعُ `min(168, heroH − 52)` — يتطابق الأسفلان على هاتفه (٤١٢dp) وعلى كلِّ شاشةٍ تتّسع، وينزل الملصقُ
     قليلاً عن الحافّة حيث لا تتّسع بدل أن يصطدم بالزرّ. */
  const POSTER_H = 168;
  const lift = Math.min(POSTER_H, heroH - 52);
  const watchedSet = useMemo(() => new Set(d?.kind === "tv" ? d.me.watched : []), [d]);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      {/* الترويسة — `DetailTopBar`: رجوعٌ · الاسمُ · مشاركة */}
      {/* D-1022 — الشريطُ العلويّ كالويب: شعارُ Loopz يساراً، الاسمُ وسطاً، **واليمينُ فارغٌ عمداً**
          (قرارُ أحمد: يُترك حتى تُنقل الرئيسيّةُ والإعداداتُ فيُوضع فيه بابُ الإعدادات). السهمُ
          و⋯ على الخلفيّة (D-1020). */}
      <View style={{ height: HEADER_H, alignItems: "center", justifyContent: "center", paddingHorizontal: 56 }}>
        <Text size={15} weight="700" numberOfLines={1}>{d?.name ?? ""}</Text>
        <View style={{ position: "absolute", start: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}>
          <Logo size={28} />
        </View>
      </View>

      {!d ? (
        <View style={{ padding: PAGE_PAD, gap: 12 }}>
          <View style={{ height: heroH, borderRadius: radius.card, backgroundColor: tokens.surface2 }} />
          <View style={{ height: 22, width: 200, borderRadius: 6, backgroundColor: tokens.surface2 }} />
          <View style={{ height: 44, borderRadius: radius.control, backgroundColor: tokens.surface2 }} />
        </View>
      ) : (
        /* 🆕 D-1133 — **شريطُ التبويبات يلتصق تحت الترويسة** (أحمد بتسجيلين، ويبٌ وتطبيق: «وأنا نازل تحت تبقى
           الحلقات وعن وكومنتي فوق، لا يكون فيه فراغ أسود فوقها»): الابنُ الرابع (البطل · الملصق · الأفعال ·
           **التبويبات** · المحتوى) لاصق. الترويسةُ خارج `ScrollView` فيلتصق تحتها بلا فجوة — لا `top` يُحسب. */
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false} stickyHeaderIndices={[3]}>
          {/* البطل — الخلفيّةُ ١٦:٩ والملصقُ يعلوها من الطرف كما في الصفحة (`-mt-16`) */}
          <View style={{ height: heroH, backgroundColor: tokens.surface2 }}>
            {d.backdrop_path ? <Image source={{ uri: backdropUrl(d.backdrop_path, "w780") ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
            {/* D-1040 — الحجابُ يغطّي الصفَّ كلَّه وفوقه قليلاً: الاسمُ صار في أعلى الملصق لا في أسفل الصورة */}
            <Image source={VEIL} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.min(heroH, lift + 28) }} contentFit="fill" />
            {/* D-1020/D-1022 — الرجوعُ و⋯ في زاويتَي الخلفيّة داخل دائرتين شبه شفّافتين ليُقرآ فوق أيِّ صورة */}
            <Pressable onPress={back} hitSlop={10} accessibilityLabel={t.closeLabel} style={{ position: "absolute", top: 10, start: PAGE_PAD, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
              <Chevron color="#fff" />
            </Pressable>
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityLabel={t.moreMenuTitle} style={{ position: "absolute", top: 10, end: PAGE_PAD, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
              <Icon name="dots" size={20} color="#fff" />
            </Pressable>
          </View>
          {/* 🔴 D-1014 — **الملصقُ يعلو إلى حافّة الخلفيّة** (طلبُ أحمد بخطٍّ أحمر على لقطة الويب):
              كان يهبط ٥٦ تحتها فتطول الترويسةُ بلا سبب؛ الآن يرتفع بقدر ارتفاعه تقريباً
              (`-96`) فينتهي طرفُه العلويّ عند الخطّ، ويصعد ما تحته معه. */}
          {/* 🔴 D-1020 — **الترويسةُ بترتيب الويب** (طلبُ أحمد بثلاث لقطات): الملصقُ والاسمُ يبدآن من
              السطر نفسِه (لا الاسمُ في أسفل الملصق)، تحت الاسم سطرُ التفاصيل ثمّ IMDb، وفي أسفل
              الملصق يمينَ العمود رقاقاتُ التصنيف والنوع، **وشعارُ المنصّة أيقونةً** في أقصى اليمين
              بدل زرّ «أين تشاهد». الملصقُ يعلو إلى حافّة الخلفيّة (D-1014). */}
          {/* 🔴 D-1031 — **الملصقُ والاسمُ يعلوان ٣٦ أخرى معاً** (طلبُ أحمد بخطٍّ أحمر على لقطة 1.10.0، ثمّ
              حكمُه على المسودّة: «ارفعها نفس سطر البوستر» — كنتُ رفعتُ الملصقَ وحدَه فسبق الاسمَ): السطرُ
              الواحد عقدُ D-1020 ويبقى. **والحجابُ يطول معهما** (٩٦ ⇒ ١٤٤): الاسمُ صار أعلى من الحجاب القديم،
              وبدونه يُقرأ على الصورة العارية فيضيع على خلفيّةٍ فاتحة. */}
          <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: PAGE_PAD, marginTop: -lift, alignItems: "flex-start" }}>
            <View style={{ width: 112, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}>
              {d.poster_path ? <Image source={{ uri: posterUrl(d.poster_path, "w342") ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4, paddingTop: 2, alignSelf: "stretch", justifyContent: "space-between" }}>
              <View style={{ gap: 4 }}>
                {/* D-1030 — نبضُ المجتمع في طرف سطر الاسم كما في الويب؛ الاسمُ يأخذ ما بقي ويلتفّ تحته */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <Text size={22} weight="700" numberOfLines={2} style={[{ flex: 1, lineHeight: 28 }, styles.onArt]}>{d.name}</Text>
                  <View style={{ height: 28, justifyContent: "center" }}><Pulse x={x} mine={d.me.rating} onPress={() => setReviewOpen("edit")} /></View>
                </View>
                <Text size={12} muted numberOfLines={2} style={styles.onArt}>
                  {[d.kind === "tv" ? t.typeSeries : t.typeMovie, year, d.kind === "tv" && d.seasons.length ? t.seasonsCount(d.seasons.filter((s) => s.season_number > 0).length) : null, d.kind === "movie" && d.runtime ? `${num(d.runtime, locale)} ${locale === "en" ? "min" : "د"}` : null, ...d.genres.slice(0, 2).map((g) => g.name)].filter(Boolean).join(" · ")}
                </Text>
                <RatingsLine x={x} compact />
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {x?.ratings?.rated ? <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text size={11} weight="700">{x.ratings.rated}</Text></View> : null}
                  {d.genres.slice(0, 1).map((g) => (
                    <View key={g.id} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text size={11} weight="600">{g.name}</Text></View>
                  ))}
                </View>
                <WatchWhere x={x} icon />
              </View>
            </View>
          </View>

          {/* D-1014 — صفُّ الأفعال الأربعة في إطارٍ واحد (تصميمُ أحمد) بدل أربعة أزرارٍ في صفَّين */}
          <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 16, paddingBottom: 16, gap: 10 }}>
            <ActionRow
              inWatch={d.me.following}
              inList={(x?.containing.length ?? 0) > 0}
              favorite={!!x?.favorite}
              watched={done}
              busy={
                follow.isPending ? "watch"
                : movieWatched.isPending || showWatched.isPending || showUnwatched.isPending ? "watched"
                : null
              }
              onPress={(k) => {
                if (k === "watch") follow.mutate(!d.me.following);
                else if (k === "list") setListOpen(true);
                else if (k === "favorite") favorite.mutate();
                else if (d.kind === "movie") movieWatched.mutate(!d.me.watched);
                else if (done) showUnwatched.mutate();
                else showWatched.mutate();
              }}
              onHoldWatch={d.kind === "tv" ? () => setRedCard(true) : undefined}
            />
            {/* D-1021 — شريطُ التقدّم مرّةً واحدة في رأس تبويب الحلقات (طلبُ أحمد: «شيل واتشد ذي لأنّها موجودة تحت») */}

            {/* ⚖️ D-1034 — صفُّ «قيّم هذا العمل» (D-1006) **حُذف من هنا**: التقييمُ يصعد انبثاقاً بعد «شاهدته»
                وآخر حلقة، وبابُه الدائم نجمةُ سطر الاسم. الويبُ لم يحمل هذا الصفَّ أصلاً. */}
          </View>

          {/* التبويبات — segmented: الحلقات (مسلسل) · المعلومات · المزيد في الويب */}
          {/* D-1133 — لاصقٌ فخلفيّتُه لونُ الصفحة (وإلّا مرّت الحلقاتُ تحته ظاهرة)؛ ومسافةُ الـ١٦ فوقه انتقلت
              إلى ذيل صفِّ الأفعال — لو بقيت فيه لالتصق ومعه شريطٌ أسودُ فارغ، وهو ما طُلب ألّا يكون */}
          {/* 🔴 D-1138 — **غلافٌ بلا نمط حول الشريط** (أحمد بلقطة: «وش بها جايه فوق بعض!!!» — الثلاثةُ عموديّة):
              `ScrollViewStickyHeader` في RN **ينقل نمطَ الابن اللاصق إلى غلافه ويستنسخ الابنَ بـ`{ flex: 1 }` وحدَه**
              (`cloneElement(child, { style: styles.fill })`) — فضاع `flexDirection: "row"` واصطفّت الخاناتُ عموداً.
              الابنُ اللاصقُ الآن غلافٌ خلفيّتُه لونُ الصفحة، والصفُّ داخله بنمطه كاملاً. */}
          <View style={{ backgroundColor: tokens.bg }}>
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider, paddingHorizontal: PAGE_PAD, backgroundColor: tokens.bg }}>
            {(d.kind === "tv" ? (["episodes", "info", "community"] as const) : (["info", "community"] as const)).map((k) => {
              const on = tab === k;
              return (
                <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}>
                  {/* D-1133 — أيقوناتُ الويب نفسُها (`DetailTabs`: list · info · people، ١٦، ذهبيّةٌ للنشط) */}
                  <Icon name={k === "episodes" ? "list" : k === "info" ? "info" : "people"} size={16} color={on ? tokens.accent : tokens.muted} />
                  <Text size={14} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted} numberOfLines={1}>{k === "episodes" ? t.tabEpisodes : k === "info" ? t.tabInfo : t.tabCommunity}</Text>
                </Pressable>
              );
            })}
          </View>
          </View>

          <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 16, gap: 16 }}>
            {tab === "community" ? (
              <CommunityTab data={community.data} myRating={d.me.rating} onEditReview={() => setReviewOpen("edit")} onOpenTalk={(p) => openWeb("", p)} />
            ) : tab === "episodes" && d.kind === "tv" ? (
              <SeasonAccordion show={d} watched={watchedSet} onError={fail} onSettled={settle} />
            ) : (
              <>
                {d.overview ? (
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Icon name="list" size={14} color={tokens.accent} />
                      <Text size={15} weight="700">{t.storyTitle}</Text>
                    </View>
                    <Pressable onPress={() => setMore((v) => !v)}>
                      <Text size={14} muted numberOfLines={more ? undefined : 4} style={{ lineHeight: 22 }}>{d.overview}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {d.kind === "tv" && d.aired_total > 0 ? (
                  <View style={{ flexDirection: "row" }}>
                    <Chip label={t.episodesCount(d.aired_total)} active={false} onPress={() => setTab("episodes")} />
                  </View>
                ) : null}
                {/* ⚖️ D-959 — التريلرُ كان باباً ويبيّاً بقرار (خطّةُ 11-D §٢)، وصار
                    يعمل في مكانه بأمر أحمد: الزرُّ يفتح المشغّلَ الأصليَّ تحته
                    **في الصفحة نفسِها**، والفشلُ الكاملُ يسقط إلى الباب القديم. */}
                {/* 🔴 D-1004 — **المشغّلُ خاملٌ في مكانه واللمسةُ الحقيقيّةُ تشغّله** (بلاغُ أحمد
                    بتسجيل على 1.9.1: «إذا أشغّل إعلاناً من داخل الفلم ما يشتغل، وأحياناً يحدّث
                    الصفحة ويدخلني ويب»): كان الزرُّ يركّب المشغّلَ حيّاً بتشغيلٍ برمجيّ — وهو ما
                    لا ينفّذه يوتيوب على الجوّال بلا لمسةٍ في مستنده (D-982)، فيقف، ويسقط حارسُ
                    التعليق إلى `openWeb` **بصفحة العمل كلِّها**. الآن كما في «اكتشف»: البطاقةُ
                    مركّبةٌ خاملةً بصورتها وثقب ▶، اللمسةُ فيه تصل الإطارَ فيشغّل يوتيوب بنفسه،
                    والمرفوضُ لا يفتح باباً إلا بلمسة (D-984) — وبابُه صفحةُ التريلرات لا صفحةُ
                    العمل. */}
                {d.trailer_key ? (
                  <View style={{ borderRadius: radius.card, overflow: "hidden", backgroundColor: tokens.surface2 }}>
                    <TrailerPlayer
                      videoKeys={[d.trailer_key]}
                      width={width - PAGE_PAD * 2}
                      poster={backdropUrl(d.backdrop_path, "w780")}
                      label={d.name}
                      idle={!trailerOn}
                      onWake={() => {
                        setTrailerWant(true);
                        setTrailerOn(true);
                      }}
                      wantPlay={trailerWant}
                      onWantPlay={setTrailerWant}
                      muted={trailerMuted}
                      onMuted={setTrailerMuted}
                      onExhausted={() => {
                        setTrailerOn(false);
                        openWeb("", `/trailers?from=${encodeURIComponent(webPath)}&at=${kind}-${id}`);
                      }}
                    />
                  </View>
                ) : null}
                {/* D-983 — الممثّلُ شاشةٌ أصليّة؛ `from` يبقى شاشةَ البداية فتعود السلسلةُ كلُّها إليها */}
                <CastRail x={x} onPerson={(pid) => router.push({ pathname: "/person/[id]", params: { id: String(pid), from } })} />
                <RelatedRails x={x} onOpen={openTitle} />
              </>
            )}
          </View>
        </ScrollView>
      )}

      {reviewOpen && d ? (
        <ReviewSheet
          initial={{ rating: d.me.rating, review: community.data?.my_review?.review ?? null, has_spoiler: community.data?.my_review?.has_spoiler ?? false }}
          head={{ name: d.name, posterPath: d.poster_path }}
          prompt={reviewOpen === "prompt"}
          busy={rate.isPending}
          onClose={() => setReviewOpen(false)}
          onSave={(v) => rate.mutate(v)}
          onRemove={() => rate.mutate({ rating: null })}
        />
      ) : null}
      {listOpen && d ? (
        <ListSheet kind={kind} id={id} name={d.name} posterPath={d.poster_path} x={x} onNewList={() => { setListOpen(false); openWeb("", "/lists"); }} onClose={() => setListOpen(false)} />
      ) : null}
      {/* D-1020 — ورقةُ «المزيد» كـ`DetailTopBar` الويب */}
      {menuOpen && d ? (
        <Sheet title={t.moreMenuTitle} onClose={() => setMenuOpen(false)}>
          {(
            [
              { icon: "send", label: t.shareSendTitle, color: tokens.accent, run: () => openWeb("", `/people?send=${kind}-${id}`) },
              { icon: "link", label: t.shareCopyLink, color: tokens.fg, run: () => { Clipboard.setString(`${CONFIG.apiBase}${webPath}`); setToast(t.linkCopied); } },
              { icon: "share", label: t.shareTitle, color: tokens.fg, run: () => void share() },
              { icon: "palette", label: t.artTitle, color: tokens.fg, run: () => setArt(true) },
            ] as const
          ).map((it) => (
            <Pressable key={it.label} onPress={() => { setMenuOpen(false); it.run(); }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
              <Icon name={it.icon} size={19} color={it.color} />
              <Text size={14}>{it.label}</Text>
            </Pressable>
          ))}
          {d.kind === "tv" ? (
            <>
              <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
              <Pressable onPress={() => { setMenuOpen(false); drop.mutate(!d.me.dropped); }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
                <Icon name="card" size={19} color={d.me.dropped ? tokens.accent : tokens.error} />
                <Text size={14} color={d.me.dropped ? tokens.fg : tokens.error}>{d.me.dropped ? t.resumeWatching : t.redCardAction}</Text>
              </Pressable>
            </>
          ) : null}
        </Sheet>
      ) : null}
      {art && d ? (
        <ArtSheet kind={kind} id={id} current={{ poster: d.poster_path, backdrop: d.backdrop_path }} onPlus={() => { setArt(false); openWeb("", "/plus"); }} onClose={() => setArt(false)} />
      ) : null}
      {/* D-1014 — البطاقةُ الحمراء وحدَها في الضغطة المطوّلة على العين */}
      {redCard && d ? (
        <Sheet title={d.name} onClose={() => setRedCard(false)}>
          <Pressable
            onPress={() => {
              drop.mutate(!d.me.dropped);
              setRedCard(false);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}
          >
            <Icon name="card" size={19} color={d.me.dropped ? tokens.accent : tokens.error} />
            <View style={{ flex: 1 }}>
              <Text size={14} color={d.me.dropped ? tokens.fg : tokens.error}>{d.me.dropped ? t.resumeWatching : t.redCardAction}</Text>
              <Text size={11} muted>{t.redCardHint}</Text>
            </View>
          </Pressable>
        </Sheet>
      ) : null}
      {toast ? (
        <View pointerEvents="none" style={{ position: "absolute", bottom: insets.bottom + 24, left: PAGE_PAD, right: PAGE_PAD, alignItems: "center" }}>
          <View style={{ backgroundColor: tokens.fg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill }}>
            <Text size={13} weight="600" color={tokens.bg}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const VEIL = require("../../assets/poster-veil.png");

function Chevron({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 11, height: 11, borderStartWidth: 2, borderTopWidth: 2, borderColor: color, transform: [{ rotate: "-45deg" }], marginStart: 4 }} />
    </View>
  );
}

/* D-1040 — الاسمُ وسطرُ التفاصيل فوق الصورة مباشرةً الآن: ظلٌّ خفيفٌ كظلِّ أسماء الملصقات (`PosterCard.shadow`)،
   فيُقرآن على خلفيّةٍ فاتحة حيث يرقّ الحجابُ في أعلاه. لا لونَ ولا مقاسَ تغيّر. */
const styles = StyleSheet.create({
  onArt: { textShadowColor: "rgba(0,0,0,0.85)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
});
