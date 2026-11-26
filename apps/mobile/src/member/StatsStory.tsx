import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, I18nManager, Platform, Pressable, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { api, downloadTo } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { posterFor } from "../poster";
import { markStorySeen } from "../statsDoor";
import type { NativeRoot } from "../shell";
import { REPORT_STALE, SvgGuard, hm, myReportKey } from "./ReportScreen";
import { Track, rhythmLabel } from "./FullStatsScreen";
import { countedUnit, yearPersona } from "@/core/yearPersona";
import { primeLabel } from "@/core/statsFormat";
import { num, type Locale } from "@/core/i18n";
import type { MyReportPayload, ReportStats, ReportTitle } from "@/core/contracts/report";

/**
 * ====== 🆕 قصّةُ «إحصائياتك» (ت٤ «ج» · أحمد ٢٦ نوفمبر ٢٠٢٦: «١أ ٢أ ٣ب») ======
 *
 * **لماذا قصّة**: الأرقامُ في صفحةٍ تُقرأ ولا تُشارَك؛ والقصّةُ تقول عن صاحبها جملةً («محقّق الجرائم») ثمّ تسندها بأرقامه، وآخرُها
 * بطاقةٌ جاهزةٌ للمشاركة — قاعدةُ بطاقات لوبز: الهويّةُ أوّلاً. تُفتح أوّلَ مرّةٍ في الأسبوع من الباب الواحد (`statsDoor`)،
 * و«شاهد قصّتك» في صفحة «إحصائياتك» يعيدها.
 * 🔑 **خمسُ صفحاتٍ تُقلَّب باللمس** («١أ»): وقتُك · أكثرُ عملٍ شاهدته · بصمةُ ذائقتك · عاداتُك · البطاقة. **كلُّ الأوقات** («٢أ»).
 * **بلا مؤقّت**: من يقرأ رقمَه لا يُسحب منه. الضغطُ في طرف البداية يرجع، وفي غيره يتقدّم (الاتّجاهُ يتبع اللغة).
 * 🔑 **حمولةٌ واحدة**: تقريرُ «كلّ الأوقات» (`/api/v1/me/report?p=all`) بمفتاحه — الصفحةُ التي تفتحها «كلّ الأرقام والتقارير»
 * ترسم من الكاش نفسِه فلا تقول القصّةُ رقماً غيرَ ما تقوله الصفحة. والبطاقةُ بطاقةُ «حصاد 2026» نفسُها بوسم «كلّ الأوقات»
 * (`/api/v1/me/report/image?p=all`) — راسمٌ واحدٌ لا راسمان.
 * ⚖️ **بثيم التطبيق لا داكنةً دائماً**: الأزرارُ والنصوصُ من نظام التصميم نفسِه فتصحّ في «النهاري»، والوهجُ الأصفرُ خلفها لونُ التمييز.
 * ⚖️ **نصوصُها في الملفّ** (`en ? … : …`) كأختها `FullStatsScreen` — عائلةُ «إحصائياتك» كلُّها هكذا منذ نُقلت من الويب.
 */
const PAGES = ["time", "top", "taste", "habits", "card"] as const;
type Page = (typeof PAGES)[number];
const PAD = 24;

type Words = Parameters<typeof countedUnit>[1];
const W: Record<"day" | "hour" | "ep" | "tv" | "mv" | "streak", Words> = {
  day: { one: "يوم واحد", two: "يومان", few: "أيام", many: "يوماً", hundred: "يوم", en1: "day", enN: "days" },
  hour: { one: "ساعة واحدة", two: "ساعتان", few: "ساعات", many: "ساعةً", hundred: "ساعة", en1: "hour", enN: "hours" },
  ep: { one: "حلقة واحدة", two: "حلقتان", few: "حلقات", many: "حلقةً", hundred: "حلقة", en1: "episode", enN: "episodes" },
  tv: { one: "مسلسل واحد", two: "مسلسلان", few: "مسلسلات", many: "مسلسلاً", hundred: "مسلسل", en1: "show", enN: "shows" },
  mv: { one: "فيلم واحد", two: "فيلمان", few: "أفلام", many: "فيلماً", hundred: "فيلم", en1: "movie", enN: "movies" },
  streak: { one: "يوم واحد", two: "يومان", few: "أيام", many: "يوماً", hundred: "يوم", en1: "day", enN: "days" },
};

export function StatsStory({ from }: { from: NativeRoot | "web" }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const q = useQuery({
    queryKey: myReportKey("all", 0),
    queryFn: async () => (await api<MyReportPayload>("/api/v1/me/report?p=all")).data,
    staleTime: REPORT_STALE,
  });
  const s = q.data?.stats ?? null;

  /* رآها هذا الأسبوع حين فُتحت — لا حين أُكملت: من أغلقها في الصفحة الأولى لا يريدها مرّةً ثانيةً اليوم */
  useEffect(() => markStorySeen(), []);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  const toPage = useCallback(() => router.replace({ pathname: "/statistics", params: { from } }), [router, from]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);
  /* لا شيءَ يُروى ⇒ الصفحةُ نفسُها تقول فراغَها بنصّها */
  useEffect(() => {
    if (s?.empty) toPage();
  }, [s?.empty, toPage]);

  const card = useStoryCard(!!s && !s.empty);
  const last = PAGES.length - 1;
  const tap = useCallback(
    (e: GestureResponderEvent) => {
      const x = e.nativeEvent.locationX;
      /* طرفُ البداية (يمينٌ في العربيّة) يرجع، وما سواه يتقدّم — كما تُقلَّب صفحاتُ كتابٍ بلغته */
      const back = I18nManager.isRTL ? x > width * 0.7 : x < width * 0.3;
      if (back) {
        if (page > 0) {
          haptic.pick();
          setPage(page - 1);
        }
      } else if (page < last) {
        haptic.pick();
        setPage(page + 1);
      }
    },
    [page, last, width],
  );

  const id: Page = PAGES[page];
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      {/* الوهجُ الأصفرُ أعلى الصفحة — لونُ التمييز بشفافيّته، فيصحّ في الثيمين */}
      <SvgGuard fallback={null}>
        <Svg width="100%" height="60%" style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="0%" rx="80%" ry="90%">
              <Stop offset="0" stopColor={tokens.accent} stopOpacity={0.22} />
              <Stop offset="1" stopColor={tokens.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
        </Svg>
      </SvgGuard>

      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12 }}>
        {/* أشرطةُ التقدّم — ما مضى وما أنت فيه بلون التمييز، وما بقي بلون السطح */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          {PAGES.map((p, i) => (
            <View key={p} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= page ? tokens.accent : tokens.surface2 }} />
          ))}
        </View>
        <View style={{ height: 48, flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel={en ? "Close" : "إغلاق"} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={20} color={tokens.fg} />
          </Pressable>
          <Text size={13} weight="600" muted numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>{en ? "Your stats · All time" : "إحصائياتك · كلّ الأوقات"}</Text>
          <Pressable onPress={() => void card.share()} disabled={!card.ready || card.busy} hitSlop={8} accessibilityRole="button" accessibilityLabel={en ? "Share" : "شارك"} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: card.ready ? 1 : 0.4 }}>
            <Icon name="share" size={20} color={tokens.fg} />
          </Pressable>
        </View>
      </View>

      {!s || s.empty ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          {q.isError ? (
            <>
              <Text muted>{en ? "Couldn't load your stats." : "تعذّر جلب إحصائياتك."}</Text>
              <Button label={en ? "Try again" : "أعد المحاولة"} variant="ghost" onPress={() => void q.refetch()} />
            </>
          ) : (
            <ActivityIndicator color={tokens.accent} />
          )}
        </View>
      ) : id === "card" ? (
        <Animated.View key={id} entering={FadeIn.duration(220)} style={{ flex: 1 }}>
          <CardPage card={card} onAll={toPage} />
        </Animated.View>
      ) : (
        <Pressable onPress={tap} style={{ flex: 1 }} accessibilityHint={en ? "Tap for the next page" : "المس للتالي"}>
          <Animated.View key={id} entering={FadeIn.duration(220)} style={{ flex: 1, paddingHorizontal: PAD, paddingBottom: insets.bottom + 16 }}>
            {id === "time" ? <TimePage s={s} /> : id === "top" ? <TopPage s={s} /> : id === "taste" ? <TastePage s={s} /> : <HabitsPage s={s} />}
            <Text size={12} muted style={{ textAlign: "center", marginTop: 12 }}>{en ? "Tap for next" : "المس للتالي"}</Text>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

/* ══════════════════════ الصفحات ══════════════════════ */

/** رقمٌ كبيرٌ وتمييزُه تحته — المعدودُ بقاعدته: الواحدُ والاثنان كلمةٌ بلا رقم */
function Big({ n, w, tail }: { n: number; w: Words; tail?: string }) {
  const { tokens, locale } = useApp();
  const c = countedUnit(n, w, locale);
  return (
    <View style={{ alignItems: "center" }}>
      {c.value ? <Text size={96} weight="800" color={tokens.accent} style={{ lineHeight: 104, fontVariant: ["tabular-nums"] }}>{num(n, locale)}</Text> : null}
      <Text size={c.value ? 24 : 44} weight="700" color={c.value ? tokens.fg : tokens.accent} style={{ textAlign: "center" }}>{tail ? `${c.unit} ${tail}` : c.unit}</Text>
    </View>
  );
}

function Kicker({ children }: { children: string }) {
  return (
    <Text size={15} weight="600" muted style={{ textAlign: "center", marginTop: 24, marginBottom: 12 }}>
      {children}
    </Text>
  );
}

function counted(n: number, w: Words, locale: Locale) {
  const c = countedUnit(n, w, locale);
  return c.value ? `${num(n, locale)} ${c.unit}` : c.unit;
}

function TimePage({ s }: { s: ReportStats }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  const days = Math.floor(s.minutes / 1440);
  const shows = s.titles - s.movies;
  const line = [s.episodes > 0 ? counted(s.episodes, W.ep, locale) : null, shows > 0 ? counted(shows, W.tv, locale) : null, s.movies > 0 ? counted(s.movies, W.mv, locale) : null]
    .filter(Boolean)
    .join(" · ");
  const posters = s.topTitles.filter((x) => x.poster).slice(0, 3);
  /* الأوسطُ أوّلُها، والجانبيّان خلفه مائلان — مروحةُ الصورة المعتمدة */
  const order = posters.length === 3 ? [posters[1], posters[0], posters[2]] : posters;
  return (
    <View style={{ flex: 1 }}>
      <Kicker>{en ? "Your time on Loopz" : "وقتك في لوبز"}</Kicker>
      {days > 0 ? <Big n={days} w={W.day} tail={en ? "of watching" : "من المشاهدة"} /> : <Big n={Math.max(1, Math.round(s.minutes / 60))} w={W.hour} tail={en ? "of watching" : "من المشاهدة"} />}
      {line ? <Text size={15} muted style={{ textAlign: "center", marginTop: 10, fontVariant: ["tabular-nums"] }}>{line}</Text> : null}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16 }}>
        {order.map((t, i) => {
          const mid = order.length === 3 ? i === 1 : i === 0;
          const w = mid ? 168 : 128;
          const uri = posterFor(t.poster, w);
          return (
            <View
              key={t.key}
              style={{
                width: w,
                aspectRatio: 2 / 3,
                borderRadius: radius.md,
                overflow: "hidden",
                backgroundColor: tokens.surface2,
                zIndex: mid ? 2 : 1,
                marginHorizontal: mid ? -18 : 0,
                transform: [{ rotate: mid ? "0deg" : i === 0 ? "-8deg" : "8deg" }, { translateY: mid ? 0 : 14 }],
                opacity: mid ? 1 : 0.85,
              }}
            >
              {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TopPage({ s }: { s: ReportStats }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  const top: ReportTitle | undefined = s.topTitles[0];
  const next = s.topTitles.slice(1, 3);
  if (!top) return <View style={{ flex: 1 }} />;
  const uri = posterFor(top.poster, 200);
  const sub = [top.episodes > 1 ? counted(top.episodes, W.ep, locale) : null, hm(top.minutes, locale)].filter(Boolean).join(" · ");
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Kicker>{en ? "Your most watched" : "أكثر عملٍ شاهدته"}</Kicker>
      <View style={{ width: 200, aspectRatio: 2 / 3, borderRadius: radius.card, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 2, borderColor: tokens.accent }}>
        {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
      </View>
      <Text size={26} weight="800" numberOfLines={2} autoDir style={{ textAlign: "center", marginTop: 18, lineHeight: 34 }}>{top.title}</Text>
      <Text size={15} muted style={{ textAlign: "center", marginTop: 6, fontVariant: ["tabular-nums"] }}>{sub}</Text>
      {next.length ? (
        <View style={{ marginTop: "auto", width: "100%", gap: 8 }}>
          <Text size={13} muted style={{ textAlign: "center" }}>{en ? "Then" : "ثمّ"}</Text>
          {next.map((t, i) => (
            <View key={t.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.card, backgroundColor: tokens.surface }}>
              <Text size={16} weight="800" color={tokens.accent} style={{ width: 18, textAlign: "center" }}>{num(i + 2, locale)}</Text>
              <View style={{ width: 32, aspectRatio: 2 / 3, borderRadius: 4, overflow: "hidden", backgroundColor: tokens.surface2 }}>
                {t.poster ? <Image source={{ uri: posterFor(t.poster, 32) ?? undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
              </View>
              <Text size={15} weight="600" numberOfLines={1} autoDir style={{ flex: 1 }}>{t.title}</Text>
              <Text size={13} muted style={{ fontVariant: ["tabular-nums"] }}>{hm(t.minutes, locale)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TastePage({ s }: { s: ReportStats }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  const anime = s.mix.find((m) => m.key === "anime")?.pct ?? 0;
  const persona = yearPersona({ genres: s.taste.genres, animePct: anime, thin: s.taste.thin }, en ? "en" : "ar", "all");
  const genres = s.taste.genres.slice(0, 3);
  const artist = s.taste.artists[0] ?? null;
  const decade = s.releaseYears.reduce<{ decade: number; pct: number } | null>((b, x) => (!b || x.pct > b.pct ? x : b), null);
  return (
    <View style={{ flex: 1 }}>
      <Kicker>{en ? "Your taste fingerprint" : "بصمة ذائقتك"}</Kicker>
      <Text size={44} weight="800" color={tokens.accent} style={{ textAlign: "center", lineHeight: 56 }}>{persona}</Text>
      {genres.length ? <Text size={14} muted style={{ textAlign: "center", marginTop: 6 }}>{genres.map((g) => g.name).join(" · ")}</Text> : null}
      <View style={{ gap: 18, marginTop: 36 }}>
        {genres.map((g) => (
          <View key={g.slug} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text size={15} weight="700">{g.name}</Text>
              <Text size={15} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{`${g.pct}%`}</Text>
            </View>
            <Track pct={(g.pct / Math.max(1, genres[0].pct)) * 100} color={tokens.accent} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 28 }}>
        {decade ? <Tile label={en ? `The ${decade.decade}s` : `عقد ${decade.decade}`} value={`${decade.pct}%`} /> : null}
        {artist ? <Tile label={en ? "Most present" : "الأكثر حضوراً"} value={artist.name} /> : null}
      </View>
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const { tokens } = useApp();
  return (
    <View style={{ flex: 1, minWidth: 0, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, gap: 4 }}>
      <Text size={12} muted numberOfLines={1}>{label}</Text>
      <Text size={18} weight="800" color={tokens.accent} numberOfLines={1} autoDir>{value}</Text>
    </View>
  );
}

function HabitsPage({ s }: { s: ReportStats }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  const h = s.habits;
  const tod = h.timeOfDay.reduce<(typeof h.timeOfDay)[number] | null>((b, x) => (!b || x.pct > b.pct ? x : b), null);
  const todLabel: Record<string, string> = en
    ? { morning: "Mornings", afternoon: "Afternoons", evening: "Evenings", night: "Nights" }
    : { morning: "الصباح", afternoon: "الظهيرة", evening: "المساء", night: "الليل" };
  return (
    <View style={{ flex: 1 }}>
      <Kicker>{en ? "Your habits" : "عاداتك"}</Kicker>
      <Text size={40} weight="800" color={tokens.accent} style={{ textAlign: "center", lineHeight: 52 }}>{rhythmLabel(h.rhythm, en)}</Text>
      {h.primeHours ? (
        <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", columnGap: 5, marginTop: 6 }}>
          <Text size={15} muted>{en ? "Most active around" : "أنشط ما تكون عند"}</Text>
          <Text size={15} muted style={{ writingDirection: "ltr" }}>{primeLabel(h.primeHours)}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 36 }}>
        {s.streak > 0 ? <Stat label={en ? "Longest streak" : "أطول سلسلة"} value={counted(s.streak, W.streak, locale)} /> : null}
        {s.activeDays > 0 ? <Stat label={en ? "Days you watched" : "أيامٌ شاهدت فيها"} value={counted(s.activeDays, W.day, locale)} /> : null}
        {h.longestSessionMin > 0 ? <Stat label={en ? "Longest sitting" : "أطول جلسة"} value={hm(h.longestSessionMin, locale)} /> : null}
        {tod && tod.pct > 0 ? <Stat label={en ? "Your time of day" : "وقتك المفضّل"} value={`${todLabel[tod.key]} · ${tod.pct}%`} /> : null}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { tokens } = useApp();
  return (
    <View style={{ width: "48%", flexGrow: 1, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, gap: 4 }}>
      <Text size={12} muted numberOfLines={1}>{label}</Text>
      <Text size={18} weight="800" numberOfLines={1} style={{ fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}

function CardPage({ card, onAll }: { card: StoryCard; onAll: () => void }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingHorizontal: PAD, paddingBottom: insets.bottom + 16, gap: 12 }}>
      <Kicker>{en ? "Your card is ready" : "بطاقتك جاهزة"}</Kicker>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View style={{ height: "100%", aspectRatio: 9 / 16, maxWidth: "100%", borderRadius: radius.card, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
          {card.uri ? (
            <Image source={{ uri: card.uri }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
          ) : card.failed ? (
            <Text size={13} muted style={{ textAlign: "center", padding: 16 }}>{en ? "Couldn't draw your card." : "تعذّر رسم بطاقتك."}</Text>
          ) : (
            <ActivityIndicator color={tokens.accent} />
          )}
        </View>
      </View>
      <Button label={en ? "Share" : "شارك"} busy={card.busy} disabled={!card.ready} onPress={() => void card.share()} />
      <Button label={en ? "All numbers and reports" : "كلّ الأرقام والتقارير"} variant="ghost" onPress={onAll} />
    </View>
  );
}

/* ══════════════════════ البطاقة ══════════════════════ */

type StoryCard = { uri: string | null; ready: boolean; failed: boolean; busy: boolean; share: () => Promise<void> };

/**
 * البطاقةُ تُرسم مرّةً حين تُفتح القصّة (لا حين تصل صفحتُها — فتكون جاهزةً هناك)، وتُحفظ في الكاش باسمٍ موقوت يُمسح سابقُه
 * (وصفةُ `useShareReport`)؛ والمشاركةُ الملفُّ نفسُه الذي تراه، لا رسمٌ ثانٍ.
 */
function useStoryCard(enabled: boolean): StoryCard {
  const { locale } = useApp();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    void (async () => {
      try {
        for (const f of Paths.cache.list()) {
          if (f instanceof File && f.name.startsWith("loopz-story-")) f.delete();
        }
        const file = new File(Paths.cache, `loopz-story-${Date.now()}.png`);
        await downloadTo("/api/v1/me/report/image?p=all", file);
        setUri(file.uri);
      } catch {
        setFailed(true);
      }
    })();
  }, [enabled]);
  const share = useCallback(async () => {
    if (!uri || busy) return;
    haptic.pick();
    setBusy(true);
    try {
      const Sharing = await import("expo-sharing");
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: locale === "en" ? "Share your stats" : "شارك إحصائياتك" });
    } catch {
      /* أُغلقت ورقةُ المشاركة أو غابت الوحدة — لا شيءَ يُقال فوق قصّة */
    } finally {
      setBusy(false);
    }
  }, [uri, busy, locale]);
  return useMemo(() => ({ uri, ready: !!uri, failed, busy, share }), [uri, failed, busy, share]);
}
