import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qk, write, ApiError } from "../api";
import { useApp } from "../state";
import { shell } from "../shell";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { Chip } from "../library/Chip";
import { radius } from "../theme";
import { CONFIG } from "../config";
import { backdropUrl, posterUrl } from "@/core/media";
import { num } from "@/core/i18n";
import { SeasonAccordion } from "./SeasonAccordion";
import { TrailerPlayer } from "../trailers/TrailerPlayer";
import { useExtras, RatingsLine, WatchWhere, FavoriteButton, AddToListButton, CastRail, RelatedRails } from "./TitleExtras";
import { useCommunity, CommunityTab, ReviewSheet, communityKey } from "./TitleCommunity";
import type {
  FollowBody,
  RateBody,
  SetDroppedBody,
  ShowRefBody,
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
export function TitleScreen({ kind, id, from = "library" }: { kind: "tv" | "movie"; id: number; from?: "library" | "discover" | "web" }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<"episodes" | "info" | "community">(kind === "tv" ? "episodes" : "info");
  const [toast, setToast] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
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
    onSuccess: () => {
      setToast(t.watchedMarked);
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
      setToast(Array.isArray(r?.added) && r.added.length ? t.watchedMarkedCount(r.added.length) : t.watchedMarked);
      settle();
    },
    onError: fail,
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
  const done = d?.kind === "movie" ? d.me.watched : tvDone;
  const year = (d?.kind === "tv" ? d.first_air_date : d?.release_date)?.slice(0, 4) ?? "";
  const heroH = Math.round(width * 9 / 16);
  const watchedSet = useMemo(() => new Set(d?.kind === "tv" ? d.me.watched : []), [d]);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      {/* الترويسة — `DetailTopBar`: رجوعٌ · الاسمُ · مشاركة */}
      <View style={{ height: HEADER_H, borderBottomWidth: 1, borderBottomColor: tokens.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 56 }}>
        <Text size={15} weight="700" numberOfLines={1}>{d?.name ?? ""}</Text>
        <Pressable onPress={back} hitSlop={12} accessibilityLabel={t.closeLabel} style={{ position: "absolute", start: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}>
          <Chevron color={tokens.fg} />
        </Pressable>
        <View style={{ position: "absolute", end: PAGE_PAD - 8, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 2 }}>
          {d ? <FavoriteButton kind={kind} id={id} name={d.name} posterPath={d.poster_path} x={x} /> : null}
          <Pressable onPress={() => void share()} hitSlop={10} accessibilityLabel={t.listShare} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
            <Icon name="share" size={18} color={tokens.fg} />
          </Pressable>
        </View>
      </View>

      {!d ? (
        <View style={{ padding: PAGE_PAD, gap: 12 }}>
          <View style={{ height: heroH, borderRadius: radius.card, backgroundColor: tokens.surface2 }} />
          <View style={{ height: 22, width: 200, borderRadius: 6, backgroundColor: tokens.surface2 }} />
          <View style={{ height: 44, borderRadius: radius.control, backgroundColor: tokens.surface2 }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          {/* البطل — الخلفيّةُ ١٦:٩ والملصقُ يعلوها من الطرف كما في الصفحة (`-mt-16`) */}
          <View style={{ height: heroH, backgroundColor: tokens.surface2 }}>
            {d.backdrop_path ? <Image source={{ uri: backdropUrl(d.backdrop_path, "w780") ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
            <Image source={VEIL} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96 }} contentFit="fill" />
          </View>
          <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: PAGE_PAD, marginTop: -56, alignItems: "flex-end" }}>
            <View style={{ width: 112, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}>
              {d.poster_path ? <Image source={{ uri: posterUrl(d.poster_path, "w342") ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
            <View style={{ flex: 1, gap: 4, paddingBottom: 4 }}>
              <Text size={22} weight="700" numberOfLines={2} style={{ lineHeight: 28 }}>{d.name}</Text>
              <Text size={13} muted numberOfLines={1}>
                {[year, d.vote_average ? `★ ${d.vote_average.toFixed(1)}` : null, d.kind === "movie" && d.runtime ? `${num(d.runtime, locale)} ${locale === "en" ? "min" : "د"}` : null].filter(Boolean).join("  ·  ")}
              </Text>
              {d.genres.length ? <Text size={13} muted numberOfLines={1}>{d.genres.map((g) => g.name).join(" · ")}</Text> : null}
            </View>
          </View>
          <View style={{ paddingHorizontal: PAGE_PAD, gap: 10 }}>
            <RatingsLine x={x} />
            <WatchWhere x={x} />
          </View>

          {/* الأفعالُ — `TitleActions`: أتابع · شاهدته · أوقفت */}
          <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 16, gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button style={{ flex: 1 }} label={d.me.following ? t.following : t.follow} variant={d.me.following ? "ghost" : "primary"} busy={follow.isPending} onPress={() => follow.mutate(!d.me.following)} />
              <Button
                style={{ flex: 1 }}
                label={done ? `${t.statusDone} ✓` : t.markWatchedBtn}
                variant={done ? "ghost" : "primary"}
                busy={movieWatched.isPending || showWatched.isPending || showUnwatched.isPending}
                onPress={() => (d.kind === "movie" ? movieWatched.mutate(!d.me.watched) : done ? showUnwatched.mutate() : showWatched.mutate())}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {d.me.following ? (
                <Button style={{ flex: 1 }} label={d.me.dropped ? t.resumeWatching : t.stopWatching} variant={d.me.dropped ? "primary" : "danger"} busy={drop.isPending} onPress={() => drop.mutate(!d.me.dropped)} />
              ) : null}
              <View style={{ flex: 1 }}>
                <AddToListButton kind={kind} id={id} name={d.name} posterPath={d.poster_path} x={x} onNewList={() => openWeb("", "/lists")} />
              </View>
            </View>
            {d.kind === "tv" ? (
              <View style={{ padding: 12, borderRadius: radius.card, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, gap: 2 }}>
                <Text size={14} weight="600">{t.watchedOf(d.me.watched_count, d.aired_total)}</Text>
                {d.next_episode_to_air?.air_date ? <Text size={13} muted>{t.nextEpisodeOn(d.next_episode_to_air.air_date)}</Text> : null}
              </View>
            ) : null}

            {/* تقييمي من ١٠ — عائلةُ chip */}
            <View style={{ gap: 6 }}>
              <Text size={12} weight="600" muted>{t.rateTitle}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <Chip key={n} label={String(n)} active={d.me.rating === n} onPress={() => rate.mutate({ rating: d.me.rating === n ? null : n })} />
                ))}
              </ScrollView>
            </View>
          </View>

          {/* التبويبات — segmented: الحلقات (مسلسل) · المعلومات · المزيد في الويب */}
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider, paddingHorizontal: PAGE_PAD, marginTop: 16 }}>
            {(d.kind === "tv" ? (["episodes", "info", "community"] as const) : (["info", "community"] as const)).map((k) => {
              const on = tab === k;
              return (
                <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}>
                  <Text size={14} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted}>{k === "episodes" ? t.tabEpisodes : k === "info" ? t.tabInfo : t.tabCommunity}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 16, gap: 16 }}>
            {tab === "community" ? (
              <CommunityTab data={community.data} myRating={d.me.rating} onEditReview={() => setReviewOpen(true)} onOpenTalk={(p) => openWeb("", p)} />
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
                {d.trailer_key ? (
                  trailerOn ? (
                    <View style={{ borderRadius: radius.card, overflow: "hidden" }}>
                      <TrailerPlayer
                        videoKeys={[d.trailer_key]}
                        width={width - PAGE_PAD * 2}
                        poster={backdropUrl(d.backdrop_path, "w780")}
                        label={d.name}
                        wantPlay={trailerWant}
                        onWantPlay={setTrailerWant}
                        muted={trailerMuted}
                        onMuted={setTrailerMuted}
                        onExhausted={() => {
                          setTrailerOn(false);
                          openWeb();
                        }}
                      />
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row" }}>
                      <Button
                        label={`▶ ${t.trailerPlay}`}
                        variant="ghost"
                        onPress={() => {
                          setTrailerWant(true);
                          setTrailerOn(true);
                        }}
                      />
                    </View>
                  )
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
          busy={rate.isPending}
          onClose={() => setReviewOpen(false)}
          onSave={(v) => rate.mutate(v)}
        />
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
