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
import { Segmented } from "../library/ToolsSheet";
import { OneTimeHint } from "../library/OneTimeHint";
import { libraryQuery } from "../library/LibraryScreen";
import { Sheet } from "../library/Sheet";
import { StarRow } from "../title/StarRow";
import { posterFor } from "../poster";
import { haptic } from "../haptics";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { usePullRefresh } from "../pullRefresh";
import { useHomeDoor } from "../homeDoor";
import type { NativeRoot } from "../shell";
import { RATE_QUEUE_KEY } from "./rateQueue";
import { RateDeck } from "./RateDeck";
import { num } from "@/core/i18n";
import { messageOf } from "../settings/api";
import { RATE_DECKS, rateDeckOf, type RateDeckId, type RateQueueItem, type RateQueuePayload } from "@/core/rateQueue";
import type { RateBody, UnrateBody } from "@/core/contracts/track";

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
 *
 * ====== 🆕 أحمد ٢٦ نوفمبر (استوديو المشاركة) ======
 * - **طريقتان في شاشةٍ واحدة**: المروحةُ (`RateDeck`، الافتراضيّة) والقائمةُ القديمة — زرٌّ في الرأس يبدّل بينهما (أيقونتا الرئيسيّة نفسُهما).
 * - **ثلاثُ رزمٍ بلا «الكلّ»** («٢أ»): أفلامٌ · مسلسلاتٌ · أنمي، تبويباتٌ بخطٍّ أصفرَ تحت المختار («ت٥أ»: لا كبسولاتِ فلترة).
 * - **شريطُ تقدّمٍ تحت التبويبات** («ن١أ»): «قيّمت N من M» — M ما بقي وما قيّمتَه في هذه الجلسة.
 * - **«لم أشاهده» يُخرج من الطابور وحدَه** («١أ»): لا يمسّ علامةَ المشاهدة. فاندمج فيه «تخطَّ» القديم (كانا الفعلَ نفسَه الآن)،
 *   ويُكتب بعد أن يختفي إشعارُ «تراجع» لا قبله — فالتراجعُ لا يحتاج فعلاً عكسيّاً في الخادم.
 * - **«لاحقاً»** يؤخّر العملَ إلى آخر رزمته في هذه الجلسة فقط — لا يُحفظ، لأنّه «ليس الآن» لا «أبداً».
 */
const PAGE_PAD = 16;
const SAVED_MS = 1100;
/** بعد خروج صفٍّ لا تُقبل نجمةٌ هذه المدّة: ما تحته يصعد، وضغطةٌ قُصد بها صفٌّ قد تقع على الذي بعده (مراجعةُ الوكيل، البند ٢) */
const SETTLE_MS = 450;
/** مدّةُ «تراجع» — و«لم أشاهده» يُكتب بعدها */
const UNDO_MS = 3500;
type Mode = "cards" | "list";
const keyOf = (r: { kind: string; id: number }) => `${r.kind}-${r.id}`;
const DECK_HINT = "rate-deck-gestures";

export function RateQueueScreen({ from }: { from: NativeRoot | "web" }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useRef<ToastHostRef>(null);
  const [mode, setMode] = useState<Mode>("cards");
  const flip = useCallback(() => {
    haptic.pick();
    setMode((m) => (m === "cards" ? "list" : "cards"));
  }, []);
  /** الرزمةُ المفتوحة — تُختار مرّةً حين تصل القائمة */
  const [ci, setCi] = useState(-1);
  /** ما قيّمه في القائمة ويبقى ظاهراً لحظةَ «انحفظ» ثمّ يدخل `gone` */
  const [saved, setSaved] = useState<ReadonlyMap<string, number>>(() => new Map());
  /** ما يُحفظ الآن — نجومُه ظاهرةٌ وصفُّه مقفل */
  const [busy, setBusy] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  /** «لاحقاً»: رقمُ الترتيب في هذه الجلسة — الأكبرُ في آخر رزمته */
  const [later, setLater] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [rated, setRated] = useState(0);
  const [tray, setTray] = useState<readonly { key: string; poster: string | null; v: number }[]>([]);
  const [menu, setMenu] = useState<RateQueueItem | null>(null);
  /* التلميحاتُ المقروءة من كاش المكتبة (ما يكتبه `OneTimeHint` عند الإغلاق) — بلا نداء */
  const hints = useQuery({ ...libraryQuery, enabled: false }).data?.hints ?? [];

  const q = useQuery({
    queryKey: [...RATE_QUEUE_KEY, "all"],
    queryFn: async () => (await api<RateQueuePayload>("/api/v1/me/rate-queue")).data,
    staleTime: 5 * 60_000,
  });
  const refresh = usePullRefresh([[...RATE_QUEUE_KEY, "all"]], 0);

  /* «لم أشاهده» المؤجَّلة: تُكتب بعد مهلة «تراجع»، وما بقي منها يُكتب عند المغادرة */
  const pending = useRef(new Map<string, { r: RateQueueItem; timer: ReturnType<typeof setTimeout> }>());
  /** «لم أشاهده» واحدةٌ بعد الأخرى: الخادمُ يقرأ الحالةَ ويكتبها، فطلبان متوازيان قد يُضيع أحدُهما الآخر (البند ٩) */
  const skips = useRef<Promise<unknown>>(Promise.resolve());
  const sendSkip = useCallback(
    (r: RateQueueItem, quiet = false) => {
      const next = skips.current.then(() => write("/api/v1/me/rate-queue/skip", { kind: r.kind, id: r.id }));
      skips.current = next.catch(() => undefined);
      next.catch(() => {
        if (quiet) return;
        setGone((g) => {
          const n = new Set(g);
          n.delete(keyOf(r));
          return n;
        });
        toast.current?.say(t.apiInternal);
      });
    },
    [t],
  );
  /* المغادرةُ تكتب ما بقي مؤجَّلاً وتُجدّد العددَ في الرئيسيّة و«تقييماتي» والمكتبة — لا كلُّ تقييم */
  useEffect(
    () => () => {
      for (const { r, timer } of pending.current.values()) {
        clearTimeout(timer);
        sendSkip(r, true);
      }
      pending.current.clear();
      void skips.current.then(() => qc.invalidateQueries({ queryKey: RATE_QUEUE_KEY }));
    },
    [qc, sendSkip],
  );

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
  /** الرزمُ الثلاث بترتيب `RATE_DECKS` — وما أُجّل في آخر رزمته بترتيب تأجيله */
  const decks = useMemo(() => {
    const out: RateQueueItem[][] = RATE_DECKS.map(() => []);
    for (const r of left) out[RATE_DECKS.indexOf(rateDeckOf(r))].push(r);
    for (const d of out) d.sort((a, b) => (later.get(keyOf(a)) ?? 0) - (later.get(keyOf(b)) ?? 0));
    return out;
  }, [left, later]);
  const open = useMemo(() => decks.map((d) => d.filter((r) => !saved.has(keyOf(r))).length), [decks, saved]);

  /* أوّلُ رزمةٍ: المسلسلات في الوسط إن كان فيها شيء (فتُرى الجارتان)، وإلّا أوّلُ رزمةٍ فيها شيء */
  useEffect(() => {
    if (ci >= 0 || !q.data) return;
    const n = RATE_DECKS.map((d) => q.data.items.filter((r) => rateDeckOf(r) === d).length);
    setCi(n[1] ? 1 : Math.max(0, n.findIndex((x) => x > 0)));
  }, [q.data, ci]);
  const deck = Math.max(0, ci);

  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drop = useCallback((k: string, animate = true) => {
    if (settling.current) clearTimeout(settling.current);
    settling.current = setTimeout(() => (settling.current = null), SETTLE_MS);
    /* الصفُّ يُطوى ولا يختفي دفعةً: ما تحته يصعد بحركةٍ تراها العين */
    if (animate) LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setGone((g) => new Set(g).add(k));
  }, []);
  const restore = useCallback((k: string) => {
    setGone((g) => {
      const n = new Set(g);
      n.delete(k);
      return n;
    });
  }, []);

  /** الكتابةُ الواحدة للطريقتين — تعود بالنجاح */
  const save = useCallback(
    async (r: RateQueueItem, stars: number): Promise<boolean> => {
      try {
        await write("/api/v1/track/rate", { tmdbId: r.id, mediaType: r.kind, rating: stars, review: "", title: r.title, posterPath: r.poster_path } satisfies RateBody);
        return true;
      } catch (e) {
        toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
        return false;
      }
    },
    [t],
  );

  /** «تراجع» بعد تقييم: يُسحب التقييمُ ويعود العملُ إلى رأس رزمته */
  const undoRate = useCallback(
    (r: RateQueueItem) => {
      const k = keyOf(r);
      restore(k);
      setRated((n) => Math.max(0, n - 1));
      setTray((x) => x.filter((y) => y.key !== k));
      setLater((m) => {
        const n = new Map(m);
        n.set(k, -1 - n.size);
        return n;
      });
      setCi(RATE_DECKS.indexOf(rateDeckOf(r)));
      write("/api/v1/track/unrate", { tmdbId: r.id, mediaType: r.kind } satisfies UnrateBody).catch((e) =>
        toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal)),
      );
    },
    [restore, t],
  );

  /* المروحة: التقييمُ يُحفظ (`save`) ثمّ تطير البطاقة (`RateDeck`)، ومعها يخرج العملُ هنا في الرسمة نفسِها */
  const rated1 = useCallback(
    (r: RateQueueItem, v: number) => {
      const k = keyOf(r);
      drop(k, false);
      setRated((n) => n + 1);
      setTray((x) => [{ key: k, poster: r.poster_path, v }, ...x.filter((y) => y.key !== k)].slice(0, 6));
      toast.current?.say(t.rateQueueSaved(num(v, locale)), { label: t.undoWatched, onPress: () => undoRate(r) }, UNDO_MS, "success");
    },
    [drop, t, locale, undoRate],
  );

  /* القائمة: النجمةُ هي الحفظ، فيقول الصفُّ «انحفظ» ثمّ يُطوى */
  const rateRow = useCallback(
    async (r: RateQueueItem, stars: number | null) => {
      const k = keyOf(r);
      if (!stars || busy.has(k) || saved.has(k) || settling.current) return;
      haptic.pick();
      setBusy((b) => new Map(b).set(k, stars));
      const ok = await save(r, stars);
      setBusy((b) => {
        const n = new Map(b);
        n.delete(k);
        return n;
      });
      if (!ok) return;
      haptic.success();
      setSaved((s) => new Map(s).set(k, stars));
      setTimeout(() => {
        drop(k);
        setRated((n) => n + 1);
        setSaved((s) => {
          const n = new Map(s);
          n.delete(k);
          return n;
        });
      }, SAVED_MS);
    },
    [busy, saved, save, drop],
  );

  const laterOf = useCallback((r: RateQueueItem) => {
    setLater((m) => new Map(m).set(keyOf(r), Date.now()));
  }, []);

  const notSeen = useCallback(
    (r: RateQueueItem) => {
      setMenu(null);
      const k = keyOf(r);
      drop(k, mode === "list");
      const timer = setTimeout(() => {
        pending.current.delete(k);
        sendSkip(r);
      }, UNDO_MS);
      pending.current.set(k, { r, timer });
      toast.current?.say(
        t.rateQueueRemoved,
        {
          label: t.undoWatched,
          onPress: () => {
            const p = pending.current.get(k);
            if (!p) return;
            clearTimeout(p.timer);
            pending.current.delete(k);
            restore(k);
            setCi(RATE_DECKS.indexOf(rateDeckOf(r)));
          },
        },
        UNDO_MS,
      );
    },
    [drop, mode, sendSkip, restore, t],
  );

  const openTitle = useCallback(
    (r: RateQueueItem) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: r.kind, id: String(r.id), from } }),
    [router, from],
  );
  const metaOf = useCallback(
    (r: RateQueueItem) => [r.anime ? t.rateQueueAnimeOne : r.kind === "tv" ? t.rateQueueShow : t.rateQueueMovie, r.year ? String(r.year) : null].filter(Boolean).join(" · "),
    [t],
  );

  const renderRow = useCallback(
    ({ item: r }: { item: RateQueueItem }) => {
      const k = keyOf(r);
      const done = saved.get(k);
      const now = busy.get(k);
      const uri = posterFor(r.poster_path, 54);
      return (
        <View style={{ flexDirection: "row", gap: 12, paddingVertical: 10, paddingHorizontal: PAGE_PAD, borderBottomWidth: 1, borderBottomColor: tokens.divider, opacity: done ? 0.55 : 1 }}>
          <Pressable onPress={() => openTitle(r)} accessibilityRole="link" accessibilityLabel={r.title}>
            <View style={{ width: 56, aspectRatio: 2 / 3, borderRadius: 10, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
              {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name={r.kind === "tv" ? "tv" : "film"} size={16} color={tokens.muted} />}
            </View>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable onPress={() => openTitle(r)} style={{ flex: 1, minWidth: 0 }}>
                <Text size={15} weight="700" numberOfLines={1}>{r.title}</Text>
                <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{metaOf(r)}</Text>
              </Pressable>
              {done ? null : (
                <Pressable onPress={() => setMenu(r)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.rateQueueMore} style={{ padding: 2 }}>
                  <Icon name="dots" size={18} color={tokens.muted} />
                </Pressable>
              )}
            </View>
            <View style={{ opacity: now ? 0.6 : 1 }} pointerEvents={now || done ? "none" : "auto"}>
              <StarRow spread size={20} value={done ?? now ?? null} onChange={(n) => void rateRow(r, n)} />
            </View>
            {done ? <Text size={13} weight="700" color={tokens.success}>{`✓ ${t.rateQueueSaved(num(done, locale))}`}</Text> : null}
          </View>
        </View>
      );
    },
    [saved, busy, tokens, t, locale, openTitle, rateRow, metaOf],
  );

  const total = rated + open.reduce((a, b) => a + b, 0);
  const label: Record<RateDeckId, (n: string) => string> = { movie: t.rateQueueMovies, tv: t.rateQueueShows, anime: t.rateQueueAnime };
  const header = (
    <View style={{ paddingHorizontal: PAGE_PAD, gap: 10, paddingBottom: 6 }}>
      {/* التبويباتُ الثلاثةُ ثابتةُ المواضع (عددُها صفرٌ أحياناً ولا تختفي) — والمروحةُ تعتمد على مواضعها: الجارتان رأسا ما يجاور */}
      <Segmented
        items={RATE_DECKS.map((d, i) => ({ id: d, label: label[d](num(open[i], locale)) }))}
        value={RATE_DECKS[deck]}
        onChange={(v) => setCi(RATE_DECKS.indexOf(v as RateDeckId))}
      />
      <View style={{ gap: 6 }} accessibilityLiveRegion="polite">
        <Text size={12} muted>{t.rateQueueProgress(num(rated, locale), num(total, locale))}</Text>
        <View style={{ height: 4, borderRadius: 999, backgroundColor: tokens.surface2, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${total ? (rated / total) * 100 : 0}%`, borderRadius: 999, backgroundColor: tokens.accent }} />
        </View>
      </View>
    </View>
  );
  const rows = decks[deck];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top }}>
        <TopBar
          title={t.rateQueueTitle}
          onBack={back}
          onBackLong={home}
          backLabel={t.closeLabel}
          end={
            <Pressable onPress={flip} hitSlop={8} accessibilityRole="button" accessibilityLabel={mode === "cards" ? t.rateQueueViewList : t.rateQueueViewCards} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Icon name={mode === "cards" ? "view-rows" : "view-cards"} size={22} color={tokens.fg} />
            </Pressable>
          }
        />
      </View>
      {!q.data ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: PAGE_PAD }}>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 6, gap: 12, alignItems: "center" }}>
            <View style={{ height: 44, alignSelf: "stretch", borderRadius: 10, backgroundColor: tokens.surface2 }} />
            <View style={{ width: "58%", aspectRatio: 2 / 3, borderRadius: 14, backgroundColor: tokens.surface2, marginTop: 16 }} />
          </View>
        )
      ) : !q.data.items.length ? (
        <Text muted style={{ textAlign: "center", paddingVertical: 56, paddingHorizontal: PAGE_PAD, lineHeight: 22 }}>{t.rateQueueEmpty}</Text>
      ) : mode === "cards" ? (
        <View style={{ flex: 1, paddingBottom: insets.bottom + 8 }}>
          {header}
          {/* الإيماءاتُ تُقال مرّةً واحدة ثمّ تصمت (أحمد: «الكلام زحمة … بسّطه») — لا سطرَي تعليماتٍ دائمين تحت الاسم */}
          {hints && !hints.includes(DECK_HINT) ? <OneTimeHint id={DECK_HINT} text={t.rateQueueDeckHint} style={{ marginHorizontal: PAGE_PAD, marginBottom: 4 }} /> : null}
          <RateDeck
            decks={decks}
            ci={deck}
            onDeck={setCi}
            onRate={save}
            onRated={rated1}
            onLater={laterOf}
            onMenu={setMenu}
            onOpen={openTitle}
            tray={tray}
            metaOf={metaOf}
          />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={keyOf}
          renderItem={renderRow}
          extraData={[saved, busy]}
          refreshControl={refresh}
          initialNumToRender={8}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Text muted style={{ textAlign: "center", paddingVertical: 56, lineHeight: 22 }}>
              {left.length ? t.rateQueueDeckDone(t.rateQueueDeckNames[deck]) : t.rateQueueEmpty}
            </Text>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        />
      )}
      {menu ? (
        <Sheet title={menu.title} onClose={() => setMenu(null)}>
          <View style={{ gap: 10, paddingBottom: 8 }}>
            {mode === "cards" ? (
              <Button
                label={t.rateQueueLater}
                variant="ghost"
                onPress={() => {
                  setMenu(null);
                  laterOf(menu);
                }}
              />
            ) : null}
            <Button label={t.rateQueueNotWatched} variant="ghost" onPress={() => notSeen(menu)} />
            <Button
              label={t.rateQueueOpenTitle}
              variant="ghost"
              onPress={() => {
                setMenu(null);
                openTitle(menu);
              }}
            />
          </View>
        </Sheet>
      ) : null}
      {/* في المروحة يعلو الإشعارُ الشريطَ والرفّ — كان يغطّي الشريطَ لحظةَ تقييم البطاقة التالية */}
      <ToastHost hostRef={toast} bottom={insets.bottom + 24 + (mode === "cards" && q.data?.items.length ? 190 : 0)} />
    </View>
  );
}
