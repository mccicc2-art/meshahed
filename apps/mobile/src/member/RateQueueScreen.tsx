import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, FlatList, LayoutAnimation, Platform, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, write } from "../api";
import { useApp } from "../state";
import { Button, Text, TopBar } from "../ui";
import { Icon } from "../icons";
import { Chip } from "../library/Chip";
import { Sheet } from "../library/Sheet";
import { StarRow } from "../title/StarRow";
import { posterFor } from "../poster";
import { haptic } from "../haptics";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { usePullRefresh } from "../pullRefresh";
import { useHomeDoor } from "../homeDoor";
import type { NativeRoot } from "../shell";
import { RATE_QUEUE_KEY } from "./rateQueue";
import { num } from "@/core/i18n";
import { messageOf } from "../settings/api";
import type { RateQueueItem, RateQueuePayload } from "@/core/rateQueue";
import type { RateBody, ToggleMovieBody } from "@/core/contracts/track";

/**
 * ====== 🆕 T530 — «بانتظار تقييمك» أصليّاً (أحمد ٢٣ نوفمبر: «١أ» قائمةٌ طويلة) ======
 *
 * كلُّ عملٍ بطاقةٌ بشكل صفوف «تقييماتي» (الملصقُ والاسمُ والنوعُ والسنة) **وتحته صفُّ النجوم نفسُه** (`StarRow spread`، ما في
 * انبثاق التقييم وبطاقة Stremio). **اختيارُ النجمة هو الحفظ** (`track/rate` بلا كتابة)، فيقول الصفُّ «انحفظ تقييمك · ٨/١٠» ثمّ
 * يخرج ويصعد ما بعده. «⋯» فيه «تخطَّ» (يخرج من القائمة وعددِها في كلِّ أجهزته) و«لم أشاهده» للفيلم (تُزال علامةُ المشاهدة).
 *
 * 🔑 **ما فُعل لا ينتظر القائمة** (درسُ R253): القائمةُ لا تُعاد بعد كلِّ تقييم (مفتاحُها خارج `me:ratings`)، وما قيّمه أو
 * تخطّاه يُخفى بحالةٍ هنا — فإن أُعيدت القائمةُ بسحبٍ لم يرجع ما خرج، ولم يقفز صفٌّ تحت الإصبع.
 * 🔑 **والمتابعون يرون ما قيّمه هنا بطاقةً واحدة** («٣ب»): تقييماتٌ بلا كتابةٍ في اليوم تُجمع في خطّ المجتمع منذ T457.
 */
const PAGE_PAD = 16;
const SAVED_MS = 1100;
/** بعد خروج صفٍّ لا تُقبل نجمةٌ هذه المدّة: ما تحته يصعد، وضغطةٌ قُصد بها صفٌّ قد تقع على الذي بعده (مراجعةُ الوكيل، البند ٢) */
const SETTLE_MS = 450;
type Filter = "all" | "movie" | "tv";
const keyOf = (r: { kind: string; id: number }) => `${r.kind}-${r.id}`;

export function RateQueueScreen({ from }: { from: NativeRoot | "web" }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useRef<ToastHostRef>(null);
  const [filter, setFilter] = useState<Filter>("all");
  /** ما اختير له نجومٌ وحُفظ — يبقى ظاهراً لحظةَ «انحفظ» ثمّ يدخل `gone` */
  const [saved, setSaved] = useState<ReadonlyMap<string, number>>(() => new Map());
  /** ما يُحفظ الآن — نجومُه ظاهرةٌ وصفُّه مقفل */
  const [busy, setBusy] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [menu, setMenu] = useState<RateQueueItem | null>(null);

  const q = useQuery({
    queryKey: [...RATE_QUEUE_KEY, "all"],
    queryFn: async () => (await api<RateQueuePayload>("/api/v1/me/rate-queue")).data,
    staleTime: 5 * 60_000,
  });
  const refresh = usePullRefresh([[...RATE_QUEUE_KEY, "all"]], 0);

  /* المغادرةُ تُجدّد العددَ في الرئيسيّة و«تقييماتي» والمكتبة — لا كلُّ تقييم */
  useEffect(() => () => void qc.invalidateQueries({ queryKey: RATE_QUEUE_KEY }), [qc]);

  const home = useHomeDoor();
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

  const left = useMemo(() => (q.data?.items ?? []).filter((r) => !gone.has(keyOf(r))), [q.data, gone]);
  const counts = useMemo(() => {
    const open = left.filter((r) => !saved.has(keyOf(r)));
    const tv = open.filter((r) => r.kind === "tv").length;
    return { all: open.length, tv, movie: open.length - tv };
  }, [left, saved]);
  const rows = useMemo(() => (filter === "all" ? left : left.filter((r) => r.kind === filter)), [left, filter]);

  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** «تخطَّ» واحدةٌ بعد الأخرى: الخادمُ يقرأ الحالةَ ويكتبها، فطلبان متوازيان قد يُضيع أحدُهما الآخر (البند ٩) */
  const skips = useRef<Promise<unknown>>(Promise.resolve());
  const drop = useCallback((k: string) => {
    if (settling.current) clearTimeout(settling.current);
    settling.current = setTimeout(() => (settling.current = null), SETTLE_MS);
    /* الصفُّ يُطوى ولا يختفي دفعةً: ما تحته يصعد بحركةٍ تراها العين */
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setGone((g) => new Set(g).add(k));
  }, []);

  const rate = useCallback(
    async (r: RateQueueItem, stars: number | null) => {
      const k = keyOf(r);
      if (!stars || busy.has(k) || saved.has(k) || settling.current) return;
      haptic.pick();
      setBusy((b) => new Map(b).set(k, stars));
      try {
        await write("/api/v1/track/rate", { tmdbId: r.id, mediaType: r.kind, rating: stars, review: "", title: r.title, posterPath: r.poster_path } satisfies RateBody);
        haptic.success();
        setSaved((s) => new Map(s).set(k, stars));
        setTimeout(() => drop(k), SAVED_MS);
      } catch (e) {
        toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
      } finally {
        setBusy((b) => {
          const n = new Map(b);
          n.delete(k);
          return n;
        });
      }
    },
    [busy, saved, drop, t],
  );

  const skip = useCallback(
    (r: RateQueueItem) => {
      setMenu(null);
      drop(keyOf(r));
      const next = skips.current.then(() => write("/api/v1/me/rate-queue/skip", { kind: r.kind, id: r.id }));
      skips.current = next.catch(() => undefined);
      next.catch(() => {
        setGone((g) => {
          const n = new Set(g);
          n.delete(keyOf(r));
          return n;
        });
        toast.current?.say(t.apiInternal);
      });
    },
    [drop, t],
  );

  const unwatch = useCallback(
    (r: RateQueueItem) => {
      setMenu(null);
      if (r.kind !== "movie") return;
      drop(keyOf(r));
      write("/api/v1/track/movie", { movieTmdbId: r.id, runtime: null, watched: false } satisfies ToggleMovieBody).then(
        () => toast.current?.say(t.rateQueueUnwatched, undefined, 2200, "success"),
        (e) => {
          setGone((g) => {
            const n = new Set(g);
            n.delete(keyOf(r));
            return n;
          });
          toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
        },
      );
    },
    [drop, t],
  );

  const openTitle = useCallback(
    (r: RateQueueItem) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: r.kind, id: String(r.id), from } }),
    [router, from],
  );

  const renderRow = useCallback(
    ({ item: r }: { item: RateQueueItem }) => {
      const k = keyOf(r);
      const done = saved.get(k);
      const pending = busy.get(k);
      const uri = posterFor(r.poster_path, 54);
      const meta = [r.kind === "tv" ? t.rateQueueShow : t.rateQueueMovie, r.year ? String(r.year) : null].filter(Boolean).join(" · ");
      return (
        <View style={{ flexDirection: "row", gap: 12, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, opacity: done ? 0.55 : 1 }}>
          <Pressable onPress={() => openTitle(r)} accessibilityRole="link" accessibilityLabel={r.title}>
            <View style={{ width: 54, aspectRatio: 2 / 3, borderRadius: 8, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
              {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name={r.kind === "tv" ? "tv" : "film"} size={16} color={tokens.muted} />}
            </View>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable onPress={() => openTitle(r)} style={{ flex: 1, minWidth: 0 }}>
                <Text size={15} weight="700" numberOfLines={1}>{r.title}</Text>
                <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{meta}</Text>
              </Pressable>
              {done ? null : (
                <Pressable onPress={() => setMenu(r)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.rateQueueMore} style={{ padding: 2 }}>
                  <Icon name="dots" size={18} color={tokens.muted} />
                </Pressable>
              )}
            </View>
            <View style={{ opacity: pending ? 0.6 : 1 }} pointerEvents={pending || done ? "none" : "auto"}>
              <StarRow spread size={20} value={done ?? pending ?? null} onChange={(n) => void rate(r, n)} />
            </View>
            {done ? (
              <Text size={13} weight="700" color={tokens.success}>{`✓ ${t.rateQueueSaved(num(done, locale))}`}</Text>
            ) : null}
          </View>
        </View>
      );
    },
    [saved, busy, tokens, t, locale, openTitle, rate],
  );

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top }}>
        <TopBar title={t.rateQueueTitle} onBack={back} onBackLong={home} backLabel={t.closeLabel} />
      </View>
      {!q.data ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: PAGE_PAD }}>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 6, gap: 8 }}>
            <View style={{ height: 28, width: 220, borderRadius: 14, backgroundColor: tokens.surface2, marginBottom: 4 }} />
            {Array.from({ length: 6 }, (_, i) => (
              <View key={i} style={{ height: 104, borderRadius: 16, backgroundColor: tokens.surface2 }} />
            ))}
          </View>
        )
      ) : (
        <FlatList
          data={rows}
          keyExtractor={keyOf}
          renderItem={renderRow}
          extraData={[saved, busy]}
          refreshControl={refresh}
          initialNumToRender={8}
          ItemSeparatorComponent={Gap}
          ListHeaderComponent={
            <View style={{ paddingTop: 6, paddingBottom: 12, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Chip label={t.rateQueueAll(num(counts.all, locale))} active={filter === "all"} onPress={() => setFilter("all")} />
                {counts.movie ? <Chip label={t.rateQueueMovies(num(counts.movie, locale))} active={filter === "movie"} onPress={() => setFilter("movie")} /> : null}
                {counts.tv ? <Chip label={t.rateQueueShows(num(counts.tv, locale))} active={filter === "tv"} onPress={() => setFilter("tv")} /> : null}
              </View>
              {rows.length ? <Text size={12} muted style={{ lineHeight: 18 }}>{t.rateQueueHint}</Text> : null}
            </View>
          }
          ListEmptyComponent={<Text muted style={{ textAlign: "center", paddingVertical: 56, lineHeight: 22 }}>{t.rateQueueEmpty}</Text>}
          contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 40 }}
        />
      )}
      {menu ? (
        <Sheet title={menu.title} onClose={() => setMenu(null)}>
          <View style={{ gap: 10, paddingBottom: 8 }}>
            <Button label={t.rateQueueSkip} variant="ghost" onPress={() => skip(menu)} />
            {menu.kind === "movie" ? <Button label={t.rateQueueNotWatched} variant="ghost" onPress={() => unwatch(menu)} /> : null}
          </View>
        </Sheet>
      ) : null}
      <ToastHost hostRef={toast} bottom={insets.bottom + 24} />
    </View>
  );
}

function Gap() {
  return <View style={{ height: 8 }} />;
}
