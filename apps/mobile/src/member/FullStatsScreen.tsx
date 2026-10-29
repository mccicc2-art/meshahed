import React, { useCallback, useEffect, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { BackHandler, I18nManager, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Svg, { Circle, Line, Path, Polygon } from "react-native-svg";
import { api } from "../api";
import { useApp } from "../state";
import { BackChevron, Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { Sheet } from "../library/Sheet";
import { Segmented } from "../library/ToolsSheet";
import { shell, type NativeRoot } from "../shell";
import { haptic } from "../haptics";
import { usePullRefresh } from "../pullRefresh";
import { controlSize, type Tokens } from "../theme";
import { H3, PlusLock, PlusPill, SvgGuard, Tile, TopThree, myReportKey } from "./ReportScreen";
import { hm, primeLabel } from "@/core/statsFormat";
import { profileUrl } from "@/core/media";
import type { MyReportPayload, ReportPeriod, ReportStats } from "@/core/contracts/report";

/**
 * ====== «الإحصائيات الكاملة» أصليّاً (🆕 D-1367 · Phase 11-V · V-C · C5 · الدفعة ب — ١١ أكتوبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد: «الاحصائيات الكاملة نبي نحوله تطبيق» ثمّ صورةٌ بأقسامها الأربعة و«اعتمد» و«نفذ وارفع»** — نقضٌ معلَنٌ لآخر ما
 * بقي من إيقاف الإحصائيات (القرارُ ٨ في خطّة 11-V). ترجمةُ `/statistics` و`FullStatsTabs` (D-799…D-813) لا إعادةُ تصميمهما:
 *  - **أربعُ مدد** (الأسبوع · الشهر · السنة · كلُّ الأوقات) **وسهمان في الترويسة** يتنقّلان بين الأسابيع والشهور والسنين
 *    (`offset`) — للمشترك وحدَه ولغير «كلِّ الأوقات»، كما في الصفحة. **وأربعةُ أقسام**: نظرة عامة · المحتوى · الذوق · العادات.
 *  - 🔑 **المسارُ مسارُ التقرير** (`/api/v1/me/report`) والمفتاحُ مفتاحُه: مدّةٌ فُتحت في «تقريرك» تُرسم هنا من الكاش فوراً.
 *    والقسمُ حالةٌ لا جلب — الأقسامُ الأربعةُ وجوهُ حمولةٍ واحدة.
 *  - 🔑 **خمسةُ رسومٍ متّجهة** (الاتّجاه · حلقةُ الإكمال · دائرةُ التركيبة · البصمة · — والخريطةُ الحراريّةُ عروضٌ عاديّة) كلٌّ
 *    خلف `SvgGuard`: رسمٌ يسقط على جهازٍ يُسقط نفسَه لا الشاشة.
 *  - ⚖️ **اتّجاهُ الخطّ يتبع اللغة**: أوّلُ المدّة عند بداية السطر (يمينٌ في العربيّة) فيطابق صفَّ التسميات تحته. في الصفحة
 *    الرسمُ يسارٌ دائماً والتسمياتُ تنعكس مع العربيّة — تباينٌ هناك لا يُنقل.
 *  - ⚖️ **بلا تلميحة «أوّل مرّة»** (`OneTimeHint` الويب): لا مخزنَ تلميحاتٍ هنا لها، وما تقوله تقوله العناوين.
 *  - القفلُ لغير المشترك `PlusLock` نفسُه — على القسم كلِّه كما في الصفحة (لا جزءَ مفتوحاً فوقه).
 */
const PAGE_PAD = 16;
const HEADER_H = 56;
/* 🆕 D-1582 — حدّا قامة الاتّجاه حين يأخذ ما بقي، وما حوله من تسمياتٍ ومفتاح (والهيكلُ بالأدنى) */
const CHART_MIN = 120;
const CHART_MAX = 220;
const CHART_CHROME = 16 + 28;
const PREV = "#7A7A7A";
const PERIODS: ReportPeriod[] = ["week", "month", "year", "all"];
type Tab = "overview" | "content" | "taste" | "habits";
const TABS: Tab[] = ["overview", "content", "taste", "habits"];
const n = (v: number) => v.toLocaleString("en-US");

export function FullStatsScreen({ from, initial }: { from: NativeRoot | "web"; initial?: ReportPeriod }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const en = locale === "en";
  /* الأسبوعُ افتراضُ الصفحة (`asStatsPeriod`)؛ ومن جاء من «تقريرك» يفتح على مدّته */
  const [period, setPeriod] = useState<ReportPeriod>(initial ?? "week");
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  /* 🆕 D-1581 — ورقةُ المدّة (زرُّ الأدوات) */
  const [tools, setTools] = useState(false);
  const key = myReportKey(period, offset);
  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await api<MyReportPayload>(`/api/v1/me/report?p=${period}${offset ? `&o=${offset}` : ""}`)).data,
    staleTime: 5 * 60_000,
    /* التنقّلُ بالسهمين يُبقي ما كان مرسوماً حتى يصل ما بعده — لا هيكلَ يومض مع كلِّ ضغطة */
    placeholderData: keepPreviousData,
  });
  const d = q.data ?? null;
  const refresh = usePullRefresh([key], 0);

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
    (kind: "tv" | "movie", id: number) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from } }),
    [router, from],
  );
  const openWeb = useCallback((path: string) => void shell.open(path, from === "web" ? undefined : { returnTo: from }), [from]);

  const periodLabel: Record<ReportPeriod, string> = en
    ? { week: "Week", month: "Month", year: "Year", all: "All time" }
    : { week: "الأسبوع", month: "الشهر", year: "السنة", all: "كل الأوقات" };
  const tabLabel: Record<Tab, string> = en
    ? { overview: "Overview", content: "Content", taste: "Taste", habits: "Habits" }
    : { overview: "نظرة عامة", content: "المحتوى", taste: "الذوق", habits: "العادات" };
  const s = d?.stats ?? null;
  const nav = !!d?.plus && period !== "all";

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top, height: insets.top + HEADER_H, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={t.closeLabel} hitSlop={4} style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <BackChevron color={tokens.fg} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Text size={17} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{en ? "Full Statistics" : "الإحصائيات الكاملة"}</Text>
          {d?.plus ? <PlusPill /> : null}
        </View>
        {/* التنقّلُ بين المدد في الترويسة (D-804): السابقُ · اسمُ المدّة · التالي (ولا تالٍ بعد الحاضر) */}
        {nav && s ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Step dir="prev" label={en ? "Previous" : "السابق"} onPress={() => { haptic.pick(); setOffset((o) => o - 1); }} />
            <Text size={12} weight="600" numberOfLines={1} style={{ fontVariant: ["tabular-nums"] }}>{s.range.label}</Text>
            {s.range.can_go_next ? <Step dir="next" label={en ? "Next" : "التالي"} onPress={() => { haptic.pick(); setOffset((o) => Math.min(0, o + 1)); }} /> : <View style={{ width: 32, height: 36 }} />}
          </View>
        ) : (
          /* 🆕 D-1581 — بلا صفِّ المدد يبقى اسمُ المدّة مقروءاً في الترويسة («كل الأوقات» وغيرُ المشترك بلا سهمين) */
          <Text size={12} weight="600" numberOfLines={1} style={{ paddingHorizontal: 8 }}>{s?.range.label ?? periodLabel[period]}</Text>
        )}
      </View>

      {/* الأقسام — نقطةٌ بلون التمييز بجانب النشط (الصورة)، لا خطٌّ ثانٍ تحت خطّ المدّة */}
      {/* 🆕 D-1581 — **صفُّ المدد خرج إلى زرّ الأدوات** (أحمد ٢٩ أكتوبر: «نحذف الفلتر الصف الأول ويكون فلتر بشكل مختلف — مثل مكان
          tools المكتبة، يضغطه ويحدد الفترة»): الدائرةُ نفسُها في طرف صفّ الأقسام كما في المكتبة، والورقةُ الواحدةُ فيها العائلةُ المقسّمة */}
      <View accessibilityRole="tablist" style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: PAGE_PAD, marginTop: 8, marginBottom: 4 }}>
        {TABS.map((id) => {
          const on = id === tab;
          return (
            <Pressable key={id} onPress={() => { if (on) return; haptic.pick(); setTab(id); }} accessibilityRole="tab" accessibilityState={{ selected: on }} hitSlop={8} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Text size={14} weight={on ? "700" : "400"} color={on ? tokens.fg : tokens.muted} numberOfLines={1}>{tabLabel[id]}</Text>
              {on ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.accent }} /> : null}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => { haptic.pick(); setTools(true); }}
          accessibilityRole="button"
          accessibilityLabel={en ? "Period" : "المدّة"}
          hitSlop={controlSize.filterSlop}
          style={{ width: controlSize.filterBtn, height: controlSize.filterBtn, borderRadius: controlSize.filterBtn / 2, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center", marginStart: 8 }}
        >
          <Icon name="sliders" size={controlSize.filterIcon} color={tokens.fg} />
        </Pressable>
      </View>

      {tools ? (
        <Sheet title={en ? "Period" : "المدّة"} onClose={() => setTools(false)}>
          <Segmented
            items={PERIODS.map((p) => ({ id: p, label: periodLabel[p] }))}
            value={period}
            onChange={(v) => {
              setTools(false);
              if (v === period) return;
              haptic.pick();
              setPeriod(v as ReportPeriod);
              setOffset(0);
            }}
          />
          {/* 🆕 D-1582 — بابا الذيل (التصدير وإحصائياتي) هنا لا تحت القسم: القسمُ شاشةٌ واحدةٌ لا يتّسع لذيل */}
          {d?.plus ? (
            <View style={{ marginTop: 12 }}>
              <SheetLink icon="download" label={en ? "Export data" : "تصدير بياناتك"} onPress={() => { setTools(false); router.push({ pathname: "/settings/[section]", params: { section: "privacy" } }); }} />
              <SheetLink icon="chart" label={en ? "Stats" : "الإحصائيات"} onPress={() => { setTools(false); router.push({ pathname: "/stats", params: { from } }); }} />
            </View>
          ) : null}
        </Sheet>
      ) : null}

      {!d || !s ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: PAGE_PAD }}>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <Skeleton />
        )
      ) : (
        /* 🆕 D-1582 — **كلُّ قسمٍ شاشةٌ واحدة** (أحمد ٢٩ أكتوبر: «حتى الإحصائيات الكاملة أبغاها صفحة وحدة» ثمّ «١أ»): المحتوى
           `flexGrow` والرسمُ الذي يتمدّد (الاتّجاه · الخريطة) يأخذ ما بقي بين حدّين، والذيلُ ١٦ */
        <ScrollView refreshControl={refresh} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>
          {s.empty ? (
            <Note>{en ? "Nothing watched in this period." : "لا مشاهدات في هذه المدّة."}</Note>
          ) : d.plus ? (
            <Body s={s} tab={tab} onTitle={openTitle} />
          ) : (
            <PlusLock onPlus={() => openWeb("/plus")}>
              <Body s={s} tab={tab} onTitle={openTitle} />
            </PlusLock>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** سهمُ المدّة — «السابق» يشير إلى بداية السطر و«التالي» إلى نهايته، فينقلبان مع العربيّة (`‹ ›` المرآويّان في الصفحة) */
function Step({ dir, label, onPress }: { dir: "prev" | "next"; label: string; onPress: () => void }) {
  const { tokens } = useApp();
  const towardEnd = dir === "next";
  const deg = towardEnd !== I18nManager.isRTL ? "-90deg" : "90deg";
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ width: 32, height: 36, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <View style={{ transform: [{ rotate: deg }] }}>
        <Icon name="chevron-down" size={18} color={tokens.muted} />
      </View>
    </Pressable>
  );
}

function Note({ children }: { children: string }) {
  return <Text size={14} muted style={{ textAlign: "center", paddingVertical: 64, paddingHorizontal: 24, lineHeight: 22 }}>{children}</Text>;
}

function Body({ s, tab, onTitle }: { s: ReportStats; tab: Tab; onTitle: (kind: "tv" | "movie", id: number) => void }) {
  if (tab === "content") return <ContentTab s={s} onTitle={onTitle} />;
  if (tab === "taste") return <TasteTab s={s} />;
  if (tab === "habits") return <HabitsTab s={s} />;
  return <OverviewTab s={s} />;
}

/* ══════════════════════ نظرة عامة ══════════════════════ */

/** صفُّ الخانات الأربع — `Tile` التقرير نفسُها (D-1575) في صفٍّ واحد: قيمةُ المدّة تصغر لتتّسع */
function Tiles({ items }: { items: { icon: IconName; value: string; label: string; small?: boolean }[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
      {items.map((x) => (
        <Tile key={x.label} icon={x.icon} label={x.label} value={x.value} small={x.small} />
      ))}
    </View>
  );
}

function OverviewTab({ s }: { s: ReportStats }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  return (
    <>
      <Tiles
        items={[
          { icon: "clock", value: hm(s.minutes, locale), label: en ? "Watch time" : "الوقت", small: true },
          { icon: "trending", value: hm(s.dailyAvgMin, locale), label: en ? "Daily" : "المعدّل", small: true },
          { icon: "play", value: n(s.episodes), label: en ? "Episodes" : "حلقات" },
          { icon: "film", value: n(s.movies), label: en ? "Movies" : "أفلام" },
        ]}
      />

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <H3>{en ? "Watch-time trend" : "اتجاه وقت المشاهدة"}</H3>
        {s.deltaPct !== null ? <Text size={13} weight="700" color={s.deltaPct >= 0 ? tokens.success : tokens.error} style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{`${s.deltaPct >= 0 ? "+" : ""}${n(s.deltaPct)}%`}</Text> : null}
      </View>
      {/* الاتّجاهُ يأخذ ما بقي من الشاشة (١٢٠–٢٢٠) */}
      <TrendChart s={s} />

      <H3>{en ? "Content breakdown" : "توزيع المحتوى"}</H3>
      <View style={{ gap: 8 }}>
        {s.mix.map((m) => (
          <View key={m.key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name={mixIcon(m.key)} size={16} color={tokens.muted} />
            <Text size={13} style={{ width: "22%", maxWidth: 96 }}>{mixLabel(m.key, en)}</Text>
            <Track thin pct={m.pct} color={mixColor(m.key, tokens)} />
            <Text size={13} style={{ width: 64, textAlign: "right", fontVariant: ["tabular-nums"] }}>{hm(m.minutes, locale)}</Text>
            <Text size={13} weight="700" color={tokens.accent} style={{ width: 40, textAlign: "right", fontVariant: ["tabular-nums"] }}>{`${n(m.pct)}%`}</Text>
          </View>
        ))}
      </View>

      <H3>{en ? "Completion" : "الإكمال"}</H3>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Ring pct={s.completionPct} />
        <View style={{ flex: 1, flexDirection: "row", gap: 8, minWidth: 0 }}>
          <StatCell center icon="check" value={n(s.status.completed)} label={en ? "Completed" : "مكتملة"} />
          <StatCell center icon="play" value={n(s.status.inProgress)} label={en ? "In progress" : "قيد المشاهدة"} />
          <StatCell center icon="repeat" value={n(s.status.rewatched)} label={en ? "Rewatched" : "أُعيدت"} />
        </View>
      </View>
    </>
  );
}

/* ══════════════════════ المحتوى ══════════════════════ */

function ContentTab({ s, onTitle }: { s: ReportStats; onTitle: (kind: "tv" | "movie", id: number) => void }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  const decades = s.releaseYears.filter((y) => y.pct > 0);
  return (
    <>
      <Tiles
        items={[
          { icon: "tv", value: n(s.titles), label: en ? "Titles" : "أعمال" },
          { icon: "play", value: n(s.episodes), label: en ? "Episodes" : "حلقات" },
          { icon: "film", value: n(s.movies), label: en ? "Movies" : "أفلام" },
          { icon: "check", value: n(s.status.completed), label: en ? "Completed" : "مكتملة" },
        ]}
      />

      <H3>{en ? "Content mix" : "تركيبة المحتوى"}</H3>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Donut mix={s.mix} total={hm(s.minutes, locale)} label={en ? "Total" : "الإجمالي"} />
        <View style={{ flex: 1, gap: 10, minWidth: 0 }}>
          {s.mix.map((m) => (
            <View key={m.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: mixColor(m.key, tokens) }} />
              <Text size={13} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{mixLabel(m.key, en)}</Text>
              <Text size={13} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{`${n(m.pct)}%`}</Text>
              <Text size={13} muted style={{ fontVariant: ["tabular-nums"] }}>{`· ${hm(m.minutes, locale)}`}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 🆕 D-1582 — «أعلى الأعمال» هنا لا في «نظرة عامة» («٢أ»): ثلاثةُ ملصقاتٍ كالتقرير بدل قائمةٍ من خمسة.
          و«حالة المشاهدة» خرجت: أرقامُها في خانات هذا القسم وفي «الإكمال» */}
      {s.topTitles.length > 0 ? (
        <>
          <H3>{en ? "Top titles" : "أعلى الأعمال"}</H3>
          <TopThree titles={s.topTitles} onTitle={onTitle} />
        </>
      ) : null}

      {/* سنواتُ الإصدار شريطٌ واحدٌ مقسّم (كذوق التقرير) لا عقودٌ في أسطر */}
      {decades.length > 0 ? (
        <>
          <H3>{en ? "Release years" : "سنوات الإصدار"}</H3>
          <View style={{ flexDirection: "row", height: 22, borderRadius: 6, overflow: "hidden" }}>
            {decades.map((y, i) => (
              <View key={y.decade} style={{ flexGrow: Math.max(1, y.pct), flexBasis: 0, alignItems: "center", justifyContent: "center", backgroundColor: tokens.accent, opacity: 1 - (i % 4) * 0.2 }}>
                {y.pct >= 12 ? <Text size={11} weight="700" color={tokens.onAccent}>{`${n(y.pct)}%`}</Text> : null}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            {decades.map((y) => (
              <Text key={y.decade} size={11} muted numberOfLines={1} style={{ flexGrow: Math.max(1, y.pct), flexBasis: 0, textAlign: "center", writingDirection: "ltr" }}>{`${y.decade}s`}</Text>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

/* ══════════════════════ الذوق ══════════════════════ */

function TasteTab({ s }: { s: ReportStats }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  /* لا استنتاجَ على بياناتٍ قليلة (حجّةُ الصفحة) */
  if (s.taste.thin) return <Note>{en ? "Keep watching to build your taste profile — we do not draw conclusions from too little data." : "واصل المشاهدة لتتكوّن بصمة ذوقك — لا نعرض استنتاجاً على بياناتٍ قليلة."}</Note>;
  return (
    <>
      {/* 🆕 D-1582 — البصمةُ والأنواعُ متجاورتان: شاشةٌ واحدة لا بصمةٌ بعرضها ثمّ قائمة */}
      <H3>{en ? "Your taste fingerprint" : "بصمة ذوقك"}</H3>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Radar axes={s.taste.radar} />
        <View style={{ flex: 1, gap: 8, minWidth: 0 }}>
          {s.taste.genres.map((g, i) => (
            <View key={g.slug}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text size={12} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{g.name}</Text>
                <Text size={12} weight={i === 0 ? "700" : "400"} color={i === 0 ? tokens.accent : tokens.muted} style={{ fontVariant: ["tabular-nums"] }}>{`${n(g.pct)}%`}</Text>
              </View>
              <View style={{ flexDirection: "row", marginTop: 3 }}>
                <Track thin pct={g.pct} color={tokens.accent} opacity={i === 0 ? 1 : 0.75} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 20, marginTop: 4 }}>
        <PctList title={en ? "Languages" : "اللغات"} rows={s.taste.languages.slice(0, 3)} />
        <PctList title={en ? "Countries" : "الدول"} rows={s.taste.countries.slice(0, 3)} />
      </View>

      {s.taste.shift.length > 0 ? (
        <>
          <H3>{en ? "Taste shift" : "انزياح الذوق"}</H3>
          <View style={{ gap: 6 }}>
            {s.taste.shift.slice(0, 2).map((x) => (
              <View key={x.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name={x.delta > 0 ? "trending" : "chevron-down"} size={15} color={x.delta > 0 ? tokens.accent : tokens.muted} />
                <Text size={13} weight="700" style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{`${x.delta > 0 ? "+" : ""}${n(x.delta)}%`}</Text>
                <Text size={13} muted numberOfLines={1} style={{ flex: 1 }}>{x.label}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {s.taste.artists.length > 0 ? (
        <>
          <H3>{en ? "Your artists" : "وجوهك"}</H3>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {s.taste.artists.map((a) => {
              const uri = profileUrl(a.photo, "w185");
              return (
                <View key={a.name} style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                    {uri ? <Image source={{ uri }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <Icon name="people" size={18} color={tokens.muted} />}
                  </View>
                  <Text size={11} numberOfLines={1} style={{ marginTop: 6, textAlign: "center" }}>{a.name}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </>
  );
}

/* ══════════════════════ العادات ══════════════════════ */

const BANDS = ["morning", "afternoon", "evening", "night"] as const;
const BAND_LABELS: Record<(typeof BANDS)[number], [string, string]> = {
  morning: ["الصباح", "Morning"],
  afternoon: ["الظهيرة", "Afternoon"],
  evening: ["المساء", "Evening"],
  night: ["آخر الليل", "Late night"],
};
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** أسماءُ الأيّام القصيرة كما تصوغها الصفحة (`Intl`)؛ وإن لم يُحسن محرّكُ الجهاز صياغتَها فقائمةٌ ثابتة */
function dayNames(en: boolean): string[] {
  try {
    const f = new Intl.DateTimeFormat(en ? "en-GB" : "ar", { weekday: "short", timeZone: "UTC" });
    const out = [0, 1, 2, 3, 4, 5, 6].map((d) => f.format(new Date(Date.UTC(2026, 1, 1 + d))));
    if (out.every((x) => typeof x === "string" && x.length > 0)) return out;
  } catch {
    /* القائمةُ الثابتة */
  }
  return en ? DAYS_EN : DAYS_AR;
}

function HabitsTab({ s }: { s: ReportStats }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  if (s.habits.timedRows === 0) {
    return <Note>{en ? "No watch hours in this period — titles you dated to their air date carry no time of day, and hour habits are built from marking as you watch." : "لا ساعات مشاهدة في هذه المدّة — الأعمال التي أرّختها بتاريخ عرضها لا تحمل ساعة، وعاداتُ الساعة تُبنى من التعليم وقتَ المشاهدة."}</Note>;
  }
  const peak = Math.max(1, ...s.habits.heat.flat());
  const names = dayNames(en);
  const top = Math.max(...s.habits.timeOfDay.map((x) => x.pct));
  return (
    <>
      <View style={{ marginTop: 12 }}>
        <Text size={12} muted>{en ? "Your rhythm" : "إيقاعك"}</Text>
        <Text size={24} weight="700" style={{ marginTop: 2, lineHeight: 32 }}>{rhythmLabel(s.habits.rhythm, en)}</Text>
        {s.habits.primeHours ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 5 }}>
            <Text size={13} muted>{en ? "Most active around" : "أنشط ما تكون عند"}</Text>
            <Text size={13} muted style={{ writingDirection: "ltr" }}>{primeLabel(s.habits.primeHours)}</Text>
          </View>
        ) : null}
      </View>

      <H3>{en ? "Viewing heatmap" : "خريطة المشاهدة"}</H3>
      {/* 🆕 D-1582 — الخريطةُ تأخذ ما بقي من الشاشة: صفوفُها `flex: 1` بين ٢٤ و٤٨ */}
      <View style={{ flex: 1, minHeight: 14 + 4 * 24 + 16, maxHeight: 14 + 4 * 48 + 16, gap: 4 }}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <View style={{ width: 64 }} />
          {names.map((d, i) => (
            <Text key={i} size={11} muted numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>{d}</Text>
          ))}
        </View>
        {s.habits.heat.map((band, bi) => (
          <View key={bi} style={{ flex: 1, flexDirection: "row", alignItems: "stretch", gap: 4 }}>
            <Text size={12} muted numberOfLines={1} style={{ width: 64, alignSelf: "center" }}>{BAND_LABELS[BANDS[bi] ?? "night"][en ? 1 : 0]}</Text>
            {band.map((v, di) => (
              /* `color-mix` الصفحة: لونُ التمييز بنسبته فوق الأرضيّة — هنا أرضيّةٌ وفوقها التمييزُ بشفافيّته */
              <View key={di} accessibilityLabel={`${v} min`} style={{ flex: 1, borderRadius: 6, backgroundColor: tokens.surface2, overflow: "hidden" }}>
                {v > 0 ? <View style={{ flex: 1, backgroundColor: tokens.accent, opacity: Math.max(12, Math.round((v / peak) * 100)) / 100 }} /> : null}
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* قيمُ هذا الصفِّ مُدَدٌ لا أعداد («14h 6m»): الرمزُ فوق الرقم كي لا يُبتر (D-813) */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <StatCell center stacked icon="play" value={n(s.habits.sessions)} label={en ? "Sessions" : "جلسات"} />
        <StatCell center stacked icon="clock" value={hm(s.habits.avgSessionMin, locale)} label={en ? "Average" : "المتوسط"} />
        <StatCell center stacked icon="trending" value={hm(s.habits.longestSessionMin, locale)} label={en ? "Longest" : "الأطول"} />
        <StatCell center stacked icon="check" value={n(s.streak)} label={en ? "Day streak" : "أيام متتالية"} />
      </View>

      <H3>{en ? "Time of day" : "أوقات اليوم"}</H3>
      <View style={{ flexDirection: "row", height: 26, borderRadius: 6, overflow: "hidden" }}>
        {s.habits.timeOfDay.map((b) => {
          const on = b.pct === top;
          return (
            <View key={b.key} style={{ flexGrow: Math.max(1, b.pct), flexBasis: 0, alignItems: "center", justifyContent: "center", backgroundColor: on ? tokens.accent : tokens.surface2 }}>
              {b.pct >= 8 ? <Text size={11} weight="700" color={on ? tokens.onAccent : tokens.muted}>{`${n(b.pct)}%`}</Text> : null}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 6 }}>
        {s.habits.timeOfDay.map((b) => (
          <Text key={b.key} size={11} muted numberOfLines={1} style={{ flexGrow: Math.max(1, b.pct), flexBasis: 0, textAlign: "center" }}>{BAND_LABELS[b.key][en ? 1 : 0]}</Text>
        ))}
      </View>
    </>
  );
}

/* ══════════════════════ قطعٌ مشتركة ══════════════════════ */

function rhythmLabel(r: ReportStats["habits"]["rhythm"], en: boolean): string {
  if (r === "weekend") return en ? "Weekend watcher" : "مشاهد نهاية الأسبوع";
  if (r === "night") return en ? "Night watcher" : "مشاهد الليل";
  if (r === "binge") return en ? "Binge watcher" : "مشاهد متواصل";
  if (r === "steady") return en ? "Steady watcher" : "مشاهد منتظم";
  return en ? "Not clear yet" : "لم يتّضح بعد";
}
type Mix = "shows" | "movies" | "anime";
const mixIcon = (k: Mix): IconName => (k === "movies" ? "film" : k === "anime" ? "sparkles" : "tv");
const mixLabel = (k: Mix, en: boolean) => (k === "movies" ? (en ? "Movies" : "أفلام") : k === "anime" ? (en ? "Anime" : "أنمي") : en ? "Shows" : "مسلسلات");
/* ألوانُ الصفحة: التمييزُ للمسلسلات، والنصُّ ثمّ الخافتُ للأفلام والأنمي.
   🆕 D-1390 — كانا رقمين ثابتين (`#EDEDED` · `#8A8A8A`): الأبيضُ على «النهاري» تباينُه ١٫٠٧ — شريحةُ الأفلام لا تُرى أصلاً.
   الرمزان ينقلبان مع الثيم فيبقى الترتيبُ نفسُه: الأقوى ثمّ الأوسط ثمّ الأخفّ. */
const mixColor = (k: Mix, tk: Tokens) => (k === "shows" ? tk.accent : k === "movies" ? tk.fg : tk.muted);

/** شريطُ نسبةٍ — قامةٌ بلون السطح وداخلها الممتلئ من بداية السطر */
function Track({ pct, color, opacity = 1, thin }: { pct: number; color: string; opacity?: number; thin?: boolean }) {
  const { tokens } = useApp();
  const h = thin ? 6 : 8;
  return (
    <View style={{ flex: 1, height: h, borderRadius: h / 2, backgroundColor: tokens.surface2, overflow: "hidden", flexDirection: "row" }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, borderRadius: h / 2, backgroundColor: color, opacity }} />
    </View>
  );
}

/** خانةُ رقم — الرمزُ يجاور الرقمَ (D-812) إلّا حيث القيمةُ مدّةٌ طويلة فيعلوه (`stacked` — D-813) */
function StatCell({ icon, value, label, large, center, stacked }: { icon: IconName; value: string; label: string; large?: boolean; center?: boolean; stacked?: boolean }) {
  const { tokens } = useApp();
  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: center ? "center" : "flex-start" }}>
      <View style={{ flexDirection: stacked ? "column" : "row", alignItems: "center", gap: stacked ? 6 : 8, maxWidth: "100%" }}>
        <Icon name={icon} size={large ? 18 : 16} color={tokens.accent} />
        <Text size={large ? 24 : 20} weight="700" numberOfLines={1} style={{ flexShrink: 1, fontVariant: ["tabular-nums"] }}>{value}</Text>
      </View>
      <Text size={12} muted style={{ marginTop: large ? 6 : 4, textAlign: center ? "center" : "left" }}>{label}</Text>
    </View>
  );
}

function Ring({ pct }: { pct: number }) {
  const { tokens } = useApp();
  const S = 76;
  const r = 31;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: S, height: S }}>
      <SvgGuard fallback={<View style={{ width: S, height: S, borderRadius: S / 2, borderWidth: 7, borderColor: tokens.surface2 }} />}>
        <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={S / 2} cy={S / 2} r={r} fill="none" stroke={tokens.surface2} strokeWidth={7} />
          <Circle cx={S / 2} cy={S / 2} r={r} fill="none" stroke={tokens.accent} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
        </Svg>
      </SvgGuard>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Text size={18} weight="700" style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{`${n(pct)}%`}</Text>
      </View>
    </View>
  );
}

function Donut({ mix, total, label }: { mix: ReportStats["mix"]; total: string; label: string }) {
  const { tokens } = useApp();
  /* 🆕 D-1582 — ١٠٤ (كانت ١٣٢) */
  const r = 36;
  const c = 2 * Math.PI * r;
  const arcs = mix.reduce<{ key: Mix; len: number; offset: number }[]>((out, m) => {
    const prev = out[out.length - 1];
    out.push({ key: m.key, len: (c * m.pct) / 100, offset: prev ? prev.offset + prev.len : 0 });
    return out;
  }, []);
  return (
    <View style={{ width: 104, height: 104 }}>
      <SvgGuard fallback={<View style={{ width: 104, height: 104, borderRadius: 52, borderWidth: 9, borderColor: tokens.surface2 }} />}>
        <Svg width={104} height={104} viewBox="0 0 104 104" style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={52} cy={52} r={r} fill="none" stroke={tokens.surface2} strokeWidth={9} />
          {arcs.map((a) => (
            <Circle key={a.key} cx={52} cy={52} r={r} fill="none" stroke={mixColor(a.key, tokens)} strokeWidth={9} strokeDasharray={`${a.len} ${c - a.len}`} strokeDashoffset={-a.offset} />
          ))}
        </Svg>
      </SvgGuard>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
        <Text size={15} weight="700" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ["tabular-nums"] }}>{total}</Text>
        <Text size={12} muted style={{ marginTop: 2 }}>{label}</Text>
      </View>
    </View>
  );
}

/** خطُّ الاتّجاه — هذه المدّةُ بلون التمييز والسابقةُ رماديّة، وأربعُ خطوطٍ منقّطةٍ خلفهما */
function TrendChart({ s }: { s: ReportStats }) {
  const { tokens, locale } = useApp();
  const { width } = useWindowDimensions();
  const en = locale === "en";
  const w = Math.max(120, width - PAGE_PAD * 2);
  /* 🆕 D-1582 — **القامةُ ما بقي من الشاشة** (١٢٠–٢٢٠): الغلافُ `flex: 1` يُقاس، والرسمُ يُرسم بقامته */
  const [box, setBox] = useState(CHART_MIN + CHART_CHROME);
  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (Math.abs(h - box) > 1) setBox(h);
  };
  const CH = Math.max(CHART_MIN, Math.min(CHART_MAX, box - CHART_CHROME));
  const count = s.buckets.length;
  const peak = Math.max(1, ...s.buckets.map((b) => Math.max(b.minutes, b.prevMinutes)));
  const step = count > 1 ? (w - 8) / (count - 1) : 0;
  const rtl = I18nManager.isRTL;
  const x = (i: number) => (count > 1 ? (rtl ? w - 4 - i * step : 4 + i * step) : w / 2);
  const y = (v: number) => CH - 10 - (v / peak) * (CH - 26);
  const path = (k: "minutes" | "prevMinutes") => s.buckets.map((b, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(b[k]).toFixed(1)}`).join(" ");
  const hasPrev = s.buckets.some((b) => b.prevMinutes > 0);
  return (
    <View onLayout={onLayout} style={{ flex: 1, minHeight: CHART_MIN + CHART_CHROME, maxHeight: CHART_MAX + CHART_CHROME }}>
      <SvgGuard fallback={<View style={{ height: CH, borderRadius: 12, backgroundColor: tokens.surface2, opacity: 0.4 }} />}>
        <Svg width={w} height={CH}>
          {[0, 1, 2, 3].map((i) => {
            const gy = 10 + i * ((CH - 36) / 3);
            return <Line key={i} x1={0} x2={w} y1={gy} y2={gy} stroke={tokens.divider} strokeWidth={1} strokeDasharray="2 4" />;
          })}
          {hasPrev && count > 1 ? <Path d={path("prevMinutes")} fill="none" stroke={PREV} strokeWidth={2} strokeLinejoin="round" /> : null}
          {count > 1 ? <Path d={path("minutes")} fill="none" stroke={tokens.accent} strokeWidth={2.5} strokeLinejoin="round" /> : null}
          {s.buckets.map((b, i) => (
            <Circle key={i} cx={x(i)} cy={y(b.minutes)} r={count > 20 ? 2 : 3} fill={tokens.accent} />
          ))}
        </Svg>
      </SvgGuard>
      <View style={{ flexDirection: "row" }}>
        {s.buckets.map((b, i) => (
          /* اثنا عشر شهراً في صفٍّ لا تُقرأ على هاتف (D-801): تسميةٌ كلَّ ثلاثة */
          <Text key={i} size={11} muted numberOfLines={1} style={{ flex: 1, minWidth: 0, textAlign: "center" }}>{count <= 8 || i % 3 === 0 ? b.label : ""}</Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 }}>
        <Legend color={tokens.accent} label={en ? "This period" : "هذه المدّة"} />
        {hasPrev ? <Legend color={PREV} label={en ? "Last period" : "المدّة السابقة"} /> : null}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 16, height: 2, backgroundColor: color }} />
      <Text size={12} muted>{label}</Text>
    </View>
  );
}

/** بصمةُ الذوق — مضلّعٌ على محاور الأنواع. القيمةُ تُرسم بجذرها (كما في الصفحة) كي لا يبتلع النوعُ الأوّلُ الشكل */
function Radar({ axes }: { axes: ReportStats["taste"]["radar"] }) {
  const { tokens } = useApp();
  /* 🆕 D-1582 — ١٨٠ (كانت ٢٤٠) بجانب الأنواع لا بعرض الشاشة */
  const size = 180;
  const c = size / 2;
  const r = 46;
  if (axes.length < 3) return null;
  const at = (i: number, dist: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [c + Math.cos(a) * dist, c + Math.sin(a) * dist] as const;
  };
  const pt = (i: number, v: number) => at(i, (v / 100) * r);
  const plotted = (score: number) => Math.max(12, Math.round(Math.sqrt(Math.max(0, score) / 100) * 100));
  const poly = (f: (i: number) => readonly [number, number]) => axes.map((_, i) => f(i).map((v) => v.toFixed(1)).join(",")).join(" ");
  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <SvgGuard fallback={<View style={{ width: size, height: size }} />}>
        <Svg width={size} height={size}>
          {[0.33, 0.66, 1].map((k) => (
            <Polygon key={k} points={poly((i) => pt(i, k * 100))} fill="none" stroke={tokens.divider} strokeWidth={1} strokeDasharray={k === 1 ? undefined : "2 3"} />
          ))}
          {axes.map((a, i) => {
            const [px, py] = pt(i, 100);
            return <Line key={a.key} x1={c} y1={c} x2={px} y2={py} stroke={tokens.divider} strokeWidth={1} />;
          })}
          <Polygon points={poly((i) => pt(i, plotted(axes[i].score)))} fill={tokens.accent} fillOpacity={0.18} stroke={tokens.accent} strokeWidth={2} />
          {axes.map((a, i) => {
            const [px, py] = pt(i, plotted(a.score));
            return <Circle key={a.key} cx={px} cy={py} r={3.5} fill={tokens.accent} />;
          })}
        </Svg>
      </SvgGuard>
      {/* التسمياتُ حول الشكل بإحداثيّاتٍ مطلقة (`left`/`top`) — لا تنعكس مع العربيّة كما لا ينعكس الرسم */}
      {axes.map((a, i) => {
        const [lx, ly] = at(i, r + 20);
        return (
          <View key={a.key} pointerEvents="none" style={{ position: "absolute", left: lx - 32, top: ly - 14, width: 64, height: 28, alignItems: "center", justifyContent: "center" }}>
            <Text size={10} muted numberOfLines={2} style={{ textAlign: "center", lineHeight: 13 }}>{a.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PctList({ title, rows }: { title: string; rows: { code: string; name: string; pct: number }[] }) {
  const { tokens } = useApp();
  if (!rows.length) return <View style={{ flex: 1 }} />;
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text size={15} weight="700" style={{ marginTop: 16, marginBottom: 8 }}>{title}</Text>
      <View style={{ gap: 8 }}>
        {rows.map((x, i) => (
          <View key={x.code}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text size={13} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{x.name}</Text>
              <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{`${n(x.pct)}%`}</Text>
            </View>
            <View style={{ flexDirection: "row", marginTop: 4 }}>
              <Track thin pct={x.pct} color={i === 0 ? tokens.accent : tokens.muted} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** 🆕 D-1582 — بابٌ في ورقة الأدوات (التصديرُ وإحصائياتي) — سطرٌ برمزه كسطور القائمة الجانبيّة الثانويّة */
function SheetLink({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { tokens } = useApp();
  return (
    <Pressable onPress={() => { haptic.pick(); onPress(); }} accessibilityRole="link" style={({ pressed }) => ({ height: 48, flexDirection: "row", alignItems: "center", gap: 14, opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={20} color={tokens.accent} />
      <Text size={15} weight="500" style={{ flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

function Skeleton() {
  const { tokens } = useApp();
  const bone = tokens.surface2;
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, gap: 28 }}>
      {[0, 1].map((r) => (
        <View key={r} style={{ flexDirection: "row", gap: 12 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ flex: 1, gap: 8 }}>
              <View style={{ height: 24, width: "70%", borderRadius: 6, backgroundColor: bone }} />
              <View style={{ height: 12, width: "45%", borderRadius: 6, backgroundColor: bone }} />
            </View>
          ))}
        </View>
      ))}
      <View style={{ height: CHART_MIN, borderRadius: 12, backgroundColor: bone }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 16, borderRadius: 6, backgroundColor: bone }} />
      ))}
    </View>
  );
}
