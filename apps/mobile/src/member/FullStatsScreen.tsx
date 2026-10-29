import React, { useCallback, useEffect, useState } from "react";
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
import { posterFor } from "../poster";
import { usePullRefresh } from "../pullRefresh";
import { controlSize, type Tokens } from "../theme";
import { H2, PlusLock, PlusPill, SvgGuard, myReportKey } from "./ReportScreen";
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
const CHART_H = 132;
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
      <View accessibilityRole="tablist" style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: PAGE_PAD, marginTop: 8, marginBottom: 20 }}>
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
        <ScrollView refreshControl={refresh} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {s.empty ? (
            <Note>{en ? "Nothing watched in this period." : "لا مشاهدات في هذه المدّة."}</Note>
          ) : d.plus ? (
            <Body s={s} tab={tab} onTitle={openTitle} />
          ) : (
            <PlusLock onPlus={() => openWeb("/plus")}>
              <Body s={s} tab={tab} onTitle={openTitle} />
            </PlusLock>
          )}
          {!s.empty && d.plus ? (
            <Footer
              onExport={() => router.push({ pathname: "/settings/[section]", params: { section: "privacy" } })}
              onStats={() => router.push({ pathname: "/stats", params: { from } })}
            />
          ) : null}
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
  return <OverviewTab s={s} onTitle={onTitle} />;
}

/* ══════════════════════ نظرة عامة ══════════════════════ */

function OverviewTab({ s, onTitle }: { s: ReportStats; onTitle: (kind: "tv" | "movie", id: number) => void }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  return (
    <View>
      <TileRow
        items={[
          { icon: "clock", value: hm(s.minutes, locale), label: en ? "Watch time" : "وقت المشاهدة" },
          { icon: "trending", value: hm(s.dailyAvgMin, locale), label: en ? "Daily average" : "المعدّل اليومي" },
          { icon: "play", value: n(s.episodes), label: en ? "Episodes" : "حلقات" },
          { icon: "film", value: n(s.movies), label: en ? "Movies" : "أفلام" },
        ]}
      />

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 30, marginBottom: 12 }}>
        <Text size={20} weight="700" style={{ flexShrink: 1 }}>{en ? "Watch-time trend" : "اتجاه وقت المشاهدة"}</Text>
        {s.deltaPct !== null ? <Text size={14} weight="700" color={s.deltaPct >= 0 ? tokens.success : tokens.error} style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{`${s.deltaPct >= 0 ? "+" : ""}${n(s.deltaPct)}%`}</Text> : null}
      </View>
      <TrendChart s={s} />

      <H2>{en ? "Content breakdown" : "توزيع المحتوى"}</H2>
      <View style={{ gap: 12 }}>
        {s.mix.map((m) => (
          <View key={m.key} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon name={mixIcon(m.key)} size={18} color={tokens.muted} />
            <Text size={14} style={{ width: "22%", maxWidth: 96 }}>{mixLabel(m.key, en)}</Text>
            <Track pct={m.pct} color={mixColor(m.key, tokens)} />
            <Text size={14} style={{ width: 64, textAlign: "right", fontVariant: ["tabular-nums"] }}>{hm(m.minutes, locale)}</Text>
            <Text size={14} weight="700" color={tokens.accent} style={{ width: 40, textAlign: "right", fontVariant: ["tabular-nums"] }}>{`${n(m.pct)}%`}</Text>
          </View>
        ))}
      </View>

      <H2>{en ? "Completion" : "الإكمال"}</H2>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
        <Ring pct={s.completionPct} label={en ? "Completion rate" : "نسبة الإكمال"} />
        <View style={{ flex: 1, flexDirection: "row", gap: 8, minWidth: 0 }}>
          <StatCell center icon="check" value={n(s.status.completed)} label={en ? "Completed" : "مكتملة"} />
          <StatCell center icon="play" value={n(s.status.inProgress)} label={en ? "In progress" : "قيد المشاهدة"} />
          <StatCell center icon="repeat" value={n(s.status.rewatched)} label={en ? "Rewatched" : "أُعيدت"} />
        </View>
      </View>

      <TopTitles s={s} onTitle={onTitle} />
    </View>
  );
}

/* ══════════════════════ المحتوى ══════════════════════ */

function ContentTab({ s, onTitle }: { s: ReportStats; onTitle: (kind: "tv" | "movie", id: number) => void }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  return (
    <View>
      <TileRow
        items={[
          { icon: "tv", value: n(s.titles), label: en ? "Titles" : "أعمال" },
          { icon: "play", value: n(s.episodes), label: en ? "Episodes" : "حلقات" },
          { icon: "film", value: n(s.movies), label: en ? "Movies" : "أفلام" },
          { icon: "check", value: n(s.status.completed), label: en ? "Completed" : "مكتملة" },
        ]}
      />

      <H2>{en ? "Content mix" : "تركيبة المحتوى"}</H2>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
        <Donut mix={s.mix} total={hm(s.minutes, locale)} label={en ? "Total" : "الإجمالي"} />
        <View style={{ flex: 1, gap: 10, minWidth: 0 }}>
          {s.mix.map((m) => (
            <View key={m.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: mixColor(m.key, tokens) }} />
              <Text size={14} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{mixLabel(m.key, en)}</Text>
              <Text size={14} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{`${n(m.pct)}%`}</Text>
              <Text size={14} muted style={{ fontVariant: ["tabular-nums"] }}>{`· ${hm(m.minutes, locale)}`}</Text>
            </View>
          ))}
        </View>
      </View>

      <H2>{en ? "Watch status" : "حالة المشاهدة"}</H2>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatCell center icon="play" value={n(s.status.started)} label={en ? "Started" : "بدأتها"} />
        <StatCell center icon="check" value={n(s.status.completed)} label={en ? "Completed" : "مكتملة"} />
        <StatCell center icon="hourglass" value={n(s.status.inProgress)} label={en ? "In progress" : "جارية"} />
        <StatCell center icon="repeat" value={n(s.status.rewatched)} label={en ? "Rewatched" : "أُعيدت"} />
      </View>

      <TopTitles s={s} onTitle={onTitle} />

      {s.releaseYears.length > 0 ? (
        <>
          <H2>{en ? "Release years" : "سنوات الإصدار"}</H2>
          <View style={{ gap: 10 }}>
            {s.releaseYears.map((y) => (
              <View key={y.decade} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text size={14} style={{ width: 56, fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{`${y.decade}s`}</Text>
                <Track pct={y.pct} color={tokens.accent} />
                <Text size={14} muted style={{ width: 40, textAlign: "right", fontVariant: ["tabular-nums"] }}>{`${n(y.pct)}%`}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/* ══════════════════════ الذوق ══════════════════════ */

function TasteTab({ s }: { s: ReportStats }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  /* لا استنتاجَ على بياناتٍ قليلة (حجّةُ الصفحة) */
  if (s.taste.thin) return <Note>{en ? "Keep watching to build your taste profile — we do not draw conclusions from too little data." : "واصل المشاهدة لتتكوّن بصمة ذوقك — لا نعرض استنتاجاً على بياناتٍ قليلة."}</Note>;
  return (
    <View>
      <Text size={20} weight="700" style={{ marginBottom: 8 }}>{en ? "Your taste fingerprint" : "بصمة ذوقك"}</Text>
      <Radar axes={s.taste.radar} />

      <H2>{en ? "Top genres" : "أعلى الأنواع"}</H2>
      <View style={{ gap: 10 }}>
        {s.taste.genres.map((g, i) => (
          <View key={g.slug} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {/* الاسمُ يلتفّ ولا يُبتر (D-801/D-787) */}
            <Text size={14} style={{ width: "38%", maxWidth: 152 }}>{g.name}</Text>
            <Track pct={g.pct} color={tokens.accent} opacity={i === 0 ? 1 : 0.75} />
            <Text size={14} weight={i === 0 ? "700" : "400"} color={i === 0 ? tokens.accent : tokens.muted} style={{ width: 40, textAlign: "right", fontVariant: ["tabular-nums"] }}>{`${n(g.pct)}%`}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 20, marginTop: 30 }}>
        <PctList title={en ? "Languages" : "اللغات"} rows={s.taste.languages} />
        <PctList title={en ? "Countries" : "الدول"} rows={s.taste.countries} />
      </View>

      {s.taste.shift.length > 0 ? (
        <>
          <H2>{en ? "Taste shift" : "انزياح الذوق"}</H2>
          <View style={{ gap: 10 }}>
            {s.taste.shift.map((x) => (
              <View key={x.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name={x.delta > 0 ? "trending" : "chevron-down"} size={16} color={x.delta > 0 ? tokens.accent : tokens.muted} />
                <Text size={14} weight="700" style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{`${x.delta > 0 ? "+" : ""}${n(x.delta)}%`}</Text>
                <Text size={14} muted numberOfLines={1} style={{ flex: 1 }}>{x.label}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {s.taste.artists.length > 0 ? (
        <>
          <H2>{en ? "Your artists" : "وجوهك"}</H2>
          <View style={{ flexDirection: "row", gap: 20 }}>
            {s.taste.artists.map((a) => {
              const uri = profileUrl(a.photo, "w185");
              return (
                <View key={a.name} style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                    {uri ? <Image source={{ uri }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <Icon name="people" size={20} color={tokens.muted} />}
                  </View>
                  <Text size={12} numberOfLines={1} style={{ marginTop: 8, textAlign: "center" }}>{a.name}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
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
    <View>
      <Text size={14} muted>{en ? "Your rhythm" : "إيقاعك"}</Text>
      <Text size={34} weight="700" style={{ marginTop: 4, lineHeight: 44 }}>{rhythmLabel(s.habits.rhythm, en)}</Text>
      {s.habits.primeHours ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 5, marginTop: 4 }}>
          <Text size={14} muted>{en ? "Most active around" : "أنشط ما تكون عند"}</Text>
          <Text size={14} muted style={{ writingDirection: "ltr" }}>{primeLabel(s.habits.primeHours)}</Text>
        </View>
      ) : null}

      <H2>{en ? "Viewing heatmap" : "خريطة المشاهدة"}</H2>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <View style={{ width: 64 }} />
          {names.map((d, i) => (
            <Text key={i} size={11} muted numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>{d}</Text>
          ))}
        </View>
        {s.habits.heat.map((band, bi) => (
          <View key={bi} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text size={12} muted numberOfLines={1} style={{ width: 64 }}>{BAND_LABELS[BANDS[bi] ?? "night"][en ? 1 : 0]}</Text>
            {band.map((v, di) => (
              /* `color-mix` الصفحة: لونُ التمييز بنسبته فوق الأرضيّة — هنا أرضيّةٌ وفوقها التمييزُ بشفافيّته */
              <View key={di} accessibilityLabel={`${v} min`} style={{ flex: 1, height: 28, borderRadius: 6, backgroundColor: tokens.surface2, overflow: "hidden" }}>
                {v > 0 ? <View style={{ flex: 1, backgroundColor: tokens.accent, opacity: Math.max(12, Math.round((v / peak) * 100)) / 100 }} /> : null}
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* قيمُ هذا الصفِّ مُدَدٌ لا أعداد («14h 6m»): الرمزُ فوق الرقم كي لا يُبتر (D-813) */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 30 }}>
        <StatCell center stacked icon="play" value={n(s.habits.sessions)} label={en ? "Sessions" : "جلسات"} />
        <StatCell center stacked icon="clock" value={hm(s.habits.avgSessionMin, locale)} label={en ? "Average" : "المتوسط"} />
        <StatCell center stacked icon="trending" value={hm(s.habits.longestSessionMin, locale)} label={en ? "Longest" : "الأطول"} />
        <StatCell center stacked icon="check" value={n(s.streak)} label={en ? "Day streak" : "أيام متتالية"} />
      </View>

      <H2>{en ? "Time of day" : "أوقات اليوم"}</H2>
      <View style={{ flexDirection: "row", height: 36, borderRadius: 8, overflow: "hidden" }}>
        {s.habits.timeOfDay.map((b) => {
          const on = b.pct === top;
          return (
            <View key={b.key} style={{ flexGrow: Math.max(1, b.pct), flexBasis: 0, alignItems: "center", justifyContent: "center", backgroundColor: on ? tokens.accent : tokens.surface2 }}>
              {b.pct >= 8 ? <Text size={12} weight="700" color={on ? tokens.onAccent : tokens.muted}>{`${n(b.pct)}%`}</Text> : null}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 6 }}>
        {s.habits.timeOfDay.map((b) => (
          <Text key={b.key} size={12} muted numberOfLines={1} style={{ flexGrow: Math.max(1, b.pct), flexBasis: 0, textAlign: "center" }}>{BAND_LABELS[b.key][en ? 1 : 0]}</Text>
        ))}
      </View>
    </View>
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

/** أربعُ خاناتٍ في صفّين (شبكةُ الصفحة على عرض الهاتف) */
function TileRow({ items }: { items: { icon: IconName; value: string; label: string }[] }) {
  return (
    <View style={{ gap: 16 }}>
      {[items.slice(0, 2), items.slice(2, 4)].map((row, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12 }}>
          {row.map((x) => (
            <StatCell key={x.label} large icon={x.icon} value={x.value} label={x.label} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const { tokens } = useApp();
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: 104, height: 104 }}>
      <SvgGuard fallback={<View style={{ width: 104, height: 104, borderRadius: 52, borderWidth: 8, borderColor: tokens.surface2 }} />}>
        <Svg width={104} height={104} viewBox="0 0 104 104" style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={52} cy={52} r={r} fill="none" stroke={tokens.surface2} strokeWidth={8} />
          <Circle cx={52} cy={52} r={r} fill="none" stroke={tokens.accent} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
        </Svg>
      </SvgGuard>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }}>
        <Text size={24} weight="700" style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{`${n(pct)}%`}</Text>
        <Text size={11} muted style={{ textAlign: "center", lineHeight: 15 }}>{label}</Text>
      </View>
    </View>
  );
}

function Donut({ mix, total, label }: { mix: ReportStats["mix"]; total: string; label: string }) {
  const { tokens } = useApp();
  const r = 46;
  const c = 2 * Math.PI * r;
  const arcs = mix.reduce<{ key: Mix; len: number; offset: number }[]>((out, m) => {
    const prev = out[out.length - 1];
    out.push({ key: m.key, len: (c * m.pct) / 100, offset: prev ? prev.offset + prev.len : 0 });
    return out;
  }, []);
  return (
    <View style={{ width: 132, height: 132 }}>
      <SvgGuard fallback={<View style={{ width: 132, height: 132, borderRadius: 66, borderWidth: 10, borderColor: tokens.surface2 }} />}>
        <Svg width={132} height={132} viewBox="0 0 132 132" style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={66} cy={66} r={r} fill="none" stroke={tokens.surface2} strokeWidth={10} />
          {arcs.map((a) => (
            <Circle key={a.key} cx={66} cy={66} r={r} fill="none" stroke={mixColor(a.key, tokens)} strokeWidth={10} strokeDasharray={`${a.len} ${c - a.len}`} strokeDashoffset={-a.offset} />
          ))}
        </Svg>
      </SvgGuard>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }}>
        <Text size={18} weight="700" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ["tabular-nums"] }}>{total}</Text>
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
  const count = s.buckets.length;
  const peak = Math.max(1, ...s.buckets.map((b) => Math.max(b.minutes, b.prevMinutes)));
  const step = count > 1 ? (w - 8) / (count - 1) : 0;
  const rtl = I18nManager.isRTL;
  const x = (i: number) => (count > 1 ? (rtl ? w - 4 - i * step : 4 + i * step) : w / 2);
  const y = (v: number) => CHART_H - 10 - (v / peak) * (CHART_H - 26);
  const path = (k: "minutes" | "prevMinutes") => s.buckets.map((b, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(b[k]).toFixed(1)}`).join(" ");
  const hasPrev = s.buckets.some((b) => b.prevMinutes > 0);
  return (
    <View>
      <SvgGuard fallback={<View style={{ height: CHART_H, borderRadius: 12, backgroundColor: tokens.surface2, opacity: 0.4 }} />}>
        <Svg width={w} height={CHART_H}>
          {[0, 1, 2, 3].map((i) => {
            const gy = 10 + i * ((CHART_H - 36) / 3);
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
  const size = 240;
  const c = size / 2;
  const r = 66;
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
        const [lx, ly] = at(i, r + 22);
        return (
          <View key={a.key} pointerEvents="none" style={{ position: "absolute", left: lx - 37, top: ly - 16, width: 74, height: 32, alignItems: "center", justifyContent: "center" }}>
            <Text size={11} muted numberOfLines={2} style={{ textAlign: "center", lineHeight: 15 }}>{a.label}</Text>
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
      <Text size={20} weight="700" style={{ marginBottom: 12 }}>{title}</Text>
      <View style={{ gap: 10 }}>
        {rows.map((x, i) => (
          <View key={x.code}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text size={14} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{x.name}</Text>
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

/** «أعلى الأعمال» — خمسةٌ مرقّمة، وكلُّ صفٍّ بابٌ إلى صفحة العمل */
function TopTitles({ s, onTitle }: { s: ReportStats; onTitle: (kind: "tv" | "movie", id: number) => void }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  if (!s.topTitles.length) return null;
  return (
    <>
      <H2>{en ? "Top titles" : "أعلى الأعمال"}</H2>
      <View style={{ gap: 12 }}>
        {s.topTitles.slice(0, 5).map((x, i) => {
          const uri = posterFor(x.poster, 48);
          return (
            <Pressable key={x.key} onPress={() => onTitle(x.mediaType, x.tmdbId)} accessibilityRole="link" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.7 : 1 })}>
              <Text size={14} muted style={{ width: 14, fontVariant: ["tabular-nums"] }}>{String(i + 1)}</Text>
              <View style={{ width: 48, aspectRatio: 2 / 3, borderRadius: 8, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                {uri ? <Image source={{ uri }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <Icon name={x.mediaType === "tv" ? "tv" : "film"} size={14} color={tokens.muted} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={15} weight="700" numberOfLines={1}>{x.title}</Text>
                <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{`${hm(x.minutes, locale)}${x.episodes > 0 ? ` · ${n(x.episodes)} ${en ? "episodes" : "حلقة"}` : ""}`}</Text>
              </View>
              <View style={{ transform: [{ rotate: I18nManager.isRTL ? "90deg" : "-90deg" }] }}>
                <Icon name="chevron-down" size={16} color={tokens.muted} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

/** ذيلُ كلِّ قسم (`FooterActions`): تصديرُ البيانات (الخصوصيّةُ الأصليّة — C3) وإحصاءاتُ الملفّ */
function Footer({ onExport, onStats }: { onExport: () => void; onStats: () => void }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  const items: [IconName, string, () => void][] = [
    ["download", en ? "Export data" : "تصدير بياناتك", onExport],
    ["chart", en ? "Stats" : "الإحصائيات", onStats],
  ];
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 32, marginTop: 34 }}>
      {items.map(([icon, label, go]) => (
        <Pressable key={icon} onPress={() => { haptic.pick(); go(); }} accessibilityRole="link" hitSlop={8} style={({ pressed }) => ({ alignItems: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}>
          <Icon name={icon} size={18} color={tokens.accent} />
          <Text size={12} muted>{label}</Text>
        </Pressable>
      ))}
    </View>
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
      <View style={{ height: CHART_H, borderRadius: 12, backgroundColor: bone }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 16, borderRadius: 6, backgroundColor: bone }} />
      ))}
    </View>
  );
}
