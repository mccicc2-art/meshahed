import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { File, Paths } from "expo-file-system";
import { api, downloadTo, write } from "../api";
import { useApp } from "../state";
import { BackChevron, Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius, type Tokens } from "../theme";
import { shell, type NativeRoot } from "../shell";
import { haptic } from "../haptics";
import { posterFor } from "../poster";
import { usePullRefresh } from "../pullRefresh";
import { clock, hm, primeLabel, reportLead } from "@/core/statsFormat";
import type { MyReportPayload, ReportPeriod, ReportRepairPayload, ReportStats } from "@/core/contracts/report";

/**
 * ====== «تقريرك» أصليّاً (🆕 D-1366 · Phase 11-V · V-C · C5 · الدفعة أ — ١١ أكتوبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد بعد صورةٍ للشاشة: «اعتمده» ثمّ «نفذ وارفع»**. ترجمةُ `ReportView` (الويب، تصميمُه في D-799) لا إعادةُ تصميمه
 * (D-1067) — الأقسامُ بترتيبها: الوقتُ الكبير وحلقةُ الأيّام · جملةُ الافتتاح · «اليوم المستحيل» · الأعمدة · «الأكثر مشاهدة» ·
 * «لمحة عن مدّتك» · «ذوقك في هذه المدّة» · سطرُ الاستنتاج · بابُ «الإحصائيات الكاملة».
 *  - 🔑 **المدّةُ حالةٌ هنا لا رابط**: في الويب تبويبٌ يستبدل الرابط كي لا يُكدّس التاريخ (D-805) — وهنا لا تاريخَ يُكدَّس.
 *    والشهرُ افتراضُها (D-805)، و«كلُّ الأوقات» ليست في التقرير (حجّةُ الصفحة: تقريرٌ عن كلِّ الأوقات هو الملفُّ نفسُه).
 *  - 🔑 **الأرقامُ والجملُ من `core/statsFormat`** — الدوالُّ التي تقرؤها الصفحة: لا صياغةَ ثانيةً لرقمٍ واحد.
 *  - ⚖️ **قفلُ غير المشترك تلاشٍ لا ضباب** (قرارُه «1 أ»): لا وحدةَ ضبابٍ في النسخة ولا بناءَ لأجلها. ما تحت الافتتاح يُرسم
 *    خافتاً مقصوصاً، وفوقه حجابٌ متدرّجٌ إلى لون الصفحة (`react-native-svg`، في النسخة) ثمّ بطاقةُ الثمن — نصوصُ `PlusPreview`.
 *  - 🆕 D-1367 (الدفعة ب) — **«الإحصائيات الكاملة» شاشةٌ أصليّة** (`FullStatsScreen`) تفتح على مدّة التقرير، والقطعُ المشتركةُ
 *    (`PlusPill` · `PlusLock` · `SvgGuard` · `H2`) تُصدَّر من هنا لها.
 *  - 🆕 D-1368 (الدفعة ج) — **«شارك تقريرك»** (D-810): صفٌّ تحت باب الإحصائيات ورمزٌ في الترويسة، كلاهما يشارك **صورةَ المدّة
 *    المعروضة** (`useShareReport`) — الصورةُ يرسمها الخادمُ براسم الويب، تُكتب على القرص ثمّ تُسلَّم لورقة المشاركة (وصفةُ C3).
 */
const PAGE_PAD = 16;
const HEADER_H = 56;
const BAR_H = 112;
const RING = 104;
/* 🆕 D-1390 — **لا أخضرَ ولا أحمرَ ثانيين**: كانا `#3DBE6B`/`#E5484D` مكتوبين هنا — درجتان غيرُ `success`/`error`
   (قاعدةُ «لونُ نجاحٍ واحد»)، وعلى «النهاري» تباينُ الأخضر ٢٫١٩ والأحمر ٣٫٥٩. الرمزان يعرفان درجتَهما في كلِّ ثيم. */
const tasteColors = (tk: Tokens) => ["#7C4DFF", tk.success, tk.error, "#6B6B6B"];
const PERIODS: ReportPeriod[] = ["week", "month", "year"];

export const myReportKey = (period: ReportPeriod, offset = 0) => ["me:reports", period, offset] as const;

/**
 * مشاركةُ صورة التقرير — **صورةُ مدّةٍ بعينها** (رمزٌ يشارك «الشهر» وأنت في «السنة» عطلٌ بحجمٍ أصغر — حجّةُ D-810).
 * الملفُّ في الكاش باسمٍ موقوت، والسابقُ يُمسح قبل الجديد لا بعد المشاركة (ورقةُ أندرويد قد تعود قبل أن يقرأه التطبيقُ الآخر).
 * وحدةُ المشاركة تُحمَّل عند الحاجة (حجّةُ `PrivacyScreen`): إن غابت في ثنائيٍّ ما فالنتيجةُ سطرُ خطأٍ هنا لا سقوطُ الشاشة.
 */
function useShareReport(period: ReportPeriod) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* المدّةُ تبدّلت ⇒ خطأُ المدّة السابقة ليس خطأَها */
  useEffect(() => setError(null), [period]);
  const share = useCallback(async () => {
    if (busy) return;
    haptic.pick();
    setBusy(true);
    setError(null);
    try {
      for (const f of Paths.cache.list()) {
        if (f instanceof File && f.name.startsWith("loopz-report-")) f.delete();
      }
      const file = new File(Paths.cache, `loopz-report-${period}-${Date.now()}.png`);
      await downloadTo(`/api/v1/me/report/image?p=${period}`, file);
      const Sharing = await import("expo-sharing");
      if (!(await Sharing.isAvailableAsync())) throw new Error("sharing unavailable");
      await Sharing.shareAsync(file.uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: t.shareReportTitle });
    } catch {
      setError(t.shareFailed);
    } finally {
      setBusy(false);
    }
  }, [busy, period, t]);
  return { busy, error, share };
}

export function ReportScreen({ from }: { from: NativeRoot | "web" }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const en = locale === "en";
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const key = myReportKey(period);
  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await api<MyReportPayload>(`/api/v1/me/report?p=${period}`)).data,
    staleTime: 5 * 60_000,
  });
  const d = q.data ?? null;
  const refresh = usePullRefresh([key], 0);
  const sharing = useShareReport(period);
  /* الرمزُ والصفُّ للمشترك وعلى مدّةٍ فيها ما يُشارك: الخادمُ يرفض غيرَ ذلك (403 · 409)، وزرٌّ يُضغط ليُرفض فخّ */
  const canShare = !!d?.plus && !d.stats.empty;

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

  const labels: Record<ReportPeriod, string> = en
    ? { week: "Week", month: "Month", year: "Year", all: "All time" }
    : { week: "الأسبوع", month: "الشهر", year: "السنة", all: "كل الأوقات" };
  const title = en ? "Your Report" : "تقريرك";

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top, height: insets.top + HEADER_H, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={t.closeLabel} hitSlop={4} style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <BackChevron color={tokens.fg} />
        </Pressable>
        {/* المدّةُ في الاسم لا في سطرٍ تحته (D-804)، ورقاقةُ PLUS بجانبه للمشترك وحدَه (D-801) */}
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Text size={17} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{d ? `${title} · ${d.stats.range.label}` : title}</Text>
          {d?.plus ? <PlusPill /> : null}
        </View>
        {canShare ? (
          <Pressable onPress={() => void sharing.share()} disabled={sharing.busy} accessibilityRole="button" accessibilityLabel={t.shareReportTitle} hitSlop={4} style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: sharing.busy ? 0.4 : pressed ? 0.7 : 1 })}>
            <Icon name="share" size={20} color={tokens.fg} />
          </Pressable>
        ) : null}
      </View>

      {/* تبويباتُ المدّة — خطٌّ تحت النشط لا رقاقةٌ مطوَّقة (الصورة) */}
      <View accessibilityRole="tablist" style={{ flexDirection: "row", paddingHorizontal: PAGE_PAD }}>
        {PERIODS.map((p) => {
          const on = p === period;
          return (
            <Pressable key={p} onPress={() => { if (on) return; haptic.pick(); setPeriod(p); }} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, alignItems: "center", paddingTop: 4, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}>
              <Text size={15} weight={on ? "700" : "400"} color={on ? tokens.fg : tokens.muted}>{labels[p]}</Text>
            </Pressable>
          );
        })}
      </View>

      {!d ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: PAGE_PAD }}>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <ReportSkeleton />
        )
      ) : (
        <ScrollView refreshControl={refresh} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {d.stats.empty ? (
            <Text size={14} muted style={{ textAlign: "center", paddingVertical: 64, paddingHorizontal: 24, lineHeight: 22 }}>
              {en ? "Nothing watched in this period — tick an episode or a film and your report appears here." : "لا مشاهدات في هذه المدّة — علّم حلقةً أو فيلماً ويظهر تقريرك هنا."}
            </Text>
          ) : (
            <ReportBody s={d.stats} plus={d.plus} onTitle={openTitle} onWeb={openWeb} onFull={(p) => router.push({ pathname: "/statistics", params: { from, p } })} sharing={sharing} onRepaired={() => void q.refetch()} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** `PlusPill` الويب: «PLUS» علامةٌ لا تُترجم، بلون التمييز على أرضيّته الشفيفة */
export function PlusPill() {
  const { tokens } = useApp();
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: tokens.accent + "26" }}>
      <Text size={12} weight="700" color={tokens.accent} style={{ writingDirection: "ltr", letterSpacing: 0.5 }}>PLUS</Text>
    </View>
  );
}

function ReportBody({
  s,
  plus,
  onTitle,
  onWeb,
  onFull,
  sharing,
  onRepaired,
}: {
  s: ReportStats;
  plus: boolean;
  onTitle: (kind: "tv" | "movie", id: number) => void;
  onWeb: (path: string) => void;
  onFull: (period: ReportPeriod) => void;
  sharing: { busy: boolean; error: string | null; share: () => Promise<void> };
  onRepaired: () => void;
}) {
  const { t, tokens, locale } = useApp();
  const en = locale === "en";
  const lead = reportLead(s, locale);
  const insight = s.taste.shift[0];

  /* ———— المفتوحُ للجميع: الوقتُ الكبير · الحلقة · جملةُ الافتتاح ———— */
  const openPart = (
    <>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16, marginTop: 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={44} weight="700" numberOfLines={1} adjustsFontSizeToFit style={{ lineHeight: 50 }}>{hm(s.minutes, locale)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Text size={12} muted>{en ? "WATCH TIME" : "وقت المشاهدة"}</Text>
            {s.deltaPct !== null ? (
              <>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: tokens.muted, opacity: 0.5 }} />
                {/* الفرقُ عن المدّة السابقة على سطر الاسم (D-805) — لاتينيٌّ يُقرأ من اليسار */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, direction: "ltr" }}>
                  <Icon name={s.deltaPct >= 0 ? "trending" : "pause"} size={14} color={s.deltaPct >= 0 ? tokens.success : tokens.error} />
                  <Text size={12} weight="700" color={s.deltaPct >= 0 ? tokens.success : tokens.error} style={{ fontVariant: ["tabular-nums"] }}>{`${s.deltaPct >= 0 ? "+" : ""}${s.deltaPct.toLocaleString("en-US")}%`}</Text>
                </View>
              </>
            ) : null}
          </View>
          <Text size={12} muted style={{ marginTop: 6, lineHeight: 19 }}>{en ? "Runtime of what you marked in this period" : "مدّة ما علّمتَه في هذه المدّة"}</Text>
        </View>
        <DaysRing active={s.activeDays} total={s.range.days} />
      </View>

      {lead ? (
        /* نصوصٌ متجاورةٌ لا نصٌّ داخل نصّ: `Text` يختار خطَّه لنصٍّ صِرف وحدَه */
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 5, marginTop: 14 }}>
          <Text size={14} weight="700" style={{ lineHeight: 23 }}>{lead.avg}</Text>
          <Text size={14} style={{ lineHeight: 23 }}>{lead.tail.trimEnd()}</Text>
          {lead.pct ? (
            <>
              <Text size={14} weight="700" color={tokens.accent} style={{ lineHeight: 23 }}>{lead.pct}</Text>
              <Text size={14} style={{ lineHeight: 23, flexShrink: 1 }}>{(lead.after ?? "").trim()}</Text>
            </>
          ) : null}
        </View>
      ) : null}
    </>
  );

  /* ———— ما تحت الافتتاح: للمشترك كاملاً، ولغيره معاينةٌ خلف الحجاب ———— */
  const lockedPart = (
    <>
      {s.impossible.days > 0 ? <ImpossibleDayCard onDone={onRepaired} /> : null}

      <Bars s={s} />

      {s.topTitles.length > 0 ? (
        <>
          <H2>{en ? "Most watched" : "الأكثر مشاهدة"}</H2>
          <TopThree s={s} onTitle={onTitle} />
        </>
      ) : null}

      <H2>{en ? "Your period at a glance" : "لمحة عن مدّتك"}</H2>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <RoundStat icon="play" value={s.episodes.toLocaleString("en-US")} label={en ? "Episodes" : "حلقة"} />
        <RoundStat icon="film" value={s.movies.toLocaleString("en-US")} label={en ? "Movies" : "فيلم"} />
        <RoundStat icon="check" value={s.streak.toLocaleString("en-US")} label={en ? "Day streak" : "أيام متتالية"} />
      </View>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
        <Glance icon="trending" label={en ? "Peak day" : "أكثف يوم"} value={s.peak ? `${s.peak.label} · ${hm(s.peak.minutes, locale)}` : "—"} />
        {/* وقتُ الذروة لا يُرسم بلا ساعةٍ حقيقيّة (D-797/D-798) */}
        <Glance icon="clock" label={en ? "Prime time" : "وقت الذروة"} value={s.habits.primeHours ? primeLabel(s.habits.primeHours) : "—"} />
        <Glance icon="check" label={en ? "Completion" : "الإكمال"} value={`${s.completionPct.toLocaleString("en-US")}%`} />
      </View>

      {!s.taste.thin && s.taste.genres.length > 0 ? (
        <>
          <H2>{en ? "Your taste this period" : "ذوقك في هذه المدّة"}</H2>
          <View style={{ flexDirection: "row", height: 36, borderRadius: 8, overflow: "hidden" }}>
            {s.taste.genres.slice(0, 4).map((g, i) => (
              <View key={g.slug} style={{ flexGrow: Math.max(1, g.pct), flexBasis: 0, alignItems: "center", justifyContent: "center", backgroundColor: tasteColors(tokens)[i] }}>
                {g.pct >= 10 ? <Text size={12} weight="700" color="#fff">{`${g.pct.toLocaleString("en-US")}%`}</Text> : null}
              </View>
            ))}
          </View>
          {/* الأسماءُ صفٌّ متساوٍ بنقاطٍ ملوّنة (D-805) */}
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            {s.taste.genres.slice(0, 4).map((g, i) => (
              <View key={g.slug} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tasteColors(tokens)[i] }} />
                <Text size={12} muted numberOfLines={2} style={{ flexShrink: 1, textAlign: "center" }}>{g.name}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* سطرُ الاستنتاج — ولا يُكتب بلا حركةٍ تُقاس */}
      {insight ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 16 }}>
          <Icon name="sparkles" size={16} color={tokens.accent} />
          <Text size={12} style={{ flex: 1, lineHeight: 20 }}>
            {en
              ? `You watched ${insight.delta > 0 ? "more" : "less"} ${insight.label} this period — ${Math.abs(insight.delta).toLocaleString("en-US")} points ${insight.delta > 0 ? "up" : "down"}.`
              : `${insight.delta > 0 ? "زادت" : "قلّت"} مشاهدتُك لـ«${insight.label}» بمقدار ${Math.abs(insight.delta).toLocaleString("en-US")} نقطة عن المدّة السابقة.`}
          </Text>
        </View>
      ) : null}

      {/* بابُ «الإحصائيات الكاملة» — صفٌّ يُرى لا سطرٌ رماديٌّ في الذيل (D-805). 🆕 D-1367 — شاشةٌ أصليّةٌ تفتح على المدّة نفسِها */}
      <Pressable onPress={() => { haptic.pick(); onFull(s.period); }} accessibilityRole="link" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, marginTop: 30, opacity: pressed ? 0.7 : 1 })}>
        <Icon name="chart" size={18} color={tokens.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={14} weight="700">{en ? "View full statistics" : "الإحصائيات الكاملة"}</Text>
          <Text size={12} muted style={{ marginTop: 2 }}>{en ? "Content, taste and habits in full" : "المحتوى والذوق والعادات بتفصيلها"}</Text>
        </View>
      </Pressable>

      {/* 🆕 D-1368 — «شارك تقريرك» (D-810) تحت باب الإحصائيات لا فوقه، وبشكله (بابان في ذيلٍ بشكلين يُقرآن رتبتين). بلا سهم:
          السهمُ يَعِد بصفحةٍ تُفتح، وهذا يفعل في مكانه — وسطرُه الثاني يقول حالَه (يُجهَّز · تعذّر) */}
      <Pressable onPress={() => void sharing.share()} disabled={sharing.busy} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, marginTop: 12, opacity: pressed ? 0.7 : 1 })}>
        <Icon name="share" size={18} color={tokens.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={14} weight="700">{t.shareReportTitle}</Text>
          <Text size={12} color={sharing.error ? tokens.error : tokens.muted} style={{ marginTop: 2 }}>{sharing.error ?? (sharing.busy ? t.shareBusy : t.shareReportSub)}</Text>
        </View>
      </Pressable>
    </>
  );

  if (plus) {
    return (
      <>
        {openPart}
        {lockedPart}
      </>
    );
  }
  return (
    <>
      {openPart}
      <PlusLock onPlus={() => onWeb("/plus")}>{lockedPart}</PlusLock>
    </>
  );
}

/**
 * قفلُ غير المشترك — **معاينةٌ خلف حجاب** (`PlusPreview` الويب، D-809): ما تحته يُرسم خافتاً مقصوصاً لا يُلمس، وفوقه تدرّجٌ إلى
 * لون الصفحة ثمّ بطاقةُ الثمن. قطعةٌ واحدةٌ لموضعيها («تقريرك» و«الإحصائيات الكاملة» — D-1367): نسخةٌ ثانيةٌ منها عطل.
 */
export function PlusLock({ children, onPlus }: { children: React.ReactNode; onPlus: () => void }) {
  const { t, tokens, locale } = useApp();
  const en = locale === "en";
  return (
    <View style={{ marginTop: 24 }}>
      {/* المعاينة: مقصوصةٌ خافتةٌ لا تُلمس ولا يقرؤها القارئُ الآليّ (`aria-hidden` في الصفحة) */}
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ height: 330, overflow: "hidden", opacity: 0.7 }}>
        {children}
      </View>
      {/* الحجابُ يضمن قراءةَ البطاقة مهما كان تحته (D-809): شفّافٌ ← لونُ الصفحة */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <SvgGuard fallback={<View style={{ flex: 1, marginTop: 110, backgroundColor: tokens.bg, opacity: 0.94 }} />}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="lock" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={tokens.bg} stopOpacity={0} />
                <Stop offset="0.38" stopColor={tokens.bg} stopOpacity={0.8} />
                <Stop offset="0.72" stopColor={tokens.bg} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#lock)" />
          </Svg>
        </SvgGuard>
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", gap: 10, paddingHorizontal: 12 }}>
        <Icon name="sparkle-star" size={26} color={tokens.accent} />
        <Text size={15} weight="700" style={{ textAlign: "center" }}>{t.plusGateTitle}</Text>
        <Text size={12} muted style={{ textAlign: "center", lineHeight: 20 }}>
          {en ? "Your full report — the chart, what you watched most, your taste and your habits. Your stats page stays free exactly as it is." : "تقريرك كاملاً — الأعمدة وأكثر ما شاهدت وذوقك وعاداتك. وإحصاءاتك في صفحة الإحصائيات تبقى مجّاناً كما هي."}
        </Text>
        <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", gap: 5 }}>
          <Text size={15} weight="700">{t.plusPrice}</Text>
          <Text size={12} muted>{t.plusPriceRenew}</Text>
          <Text size={12} muted>{t.plusSoon}</Text>
        </View>
        <Pressable onPress={() => { haptic.pick(); onPlus(); }} accessibilityRole="link" hitSlop={8}>
          <Text size={12} weight="700" color={tokens.accent}>{t.plusLearnMore}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * 🔑 **أوّلُ رسمٍ بـ`react-native-svg` في التطبيق** (الوحدةُ في نسخة 1.12.5 منذ D-1350 ولم يستعملها شيء): الحلقةُ والحجابُ
 * وحدَهما متّجهان — فإن سقط رسمُهما على جهازٍ لا يسقط التقريرُ كلُّه إلى «حاول مجدداً»: يُرسم بديلُهما من عروضٍ عاديّة.
 */
export class SvgGuard extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function H2({ children }: { children: string }) {
  return <Text size={20} weight="700" style={{ marginTop: 30, marginBottom: 12 }}>{children}</Text>;
}

/** حلقةُ الأيّام — أيّامٌ شاهدتَ فيها من أيّام المدّة. الدائرةُ تبدأ من الأعلى (`-rotate-90` في الصفحة) */
function DaysRing({ active, total }: { active: number; total: number }) {
  const { tokens, locale } = useApp();
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, active / total) : 0;
  return (
    <View style={{ width: RING, height: RING }}>
      <SvgGuard fallback={<View style={{ width: RING, height: RING, borderRadius: RING / 2, borderWidth: 7, borderColor: tokens.surface2 }} />}>
        <Svg width={RING} height={RING} viewBox="0 0 104 104" style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={52} cy={52} r={r} fill="none" stroke={tokens.surface2} strokeWidth={7} />
          <Circle cx={52} cy={52} r={r} fill="none" stroke={tokens.accent} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
        </Svg>
      </SvgGuard>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", direction: "ltr" }}>
          <Text size={26} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{active.toLocaleString("en-US")}</Text>
          <Text size={15} muted>{` / ${total.toLocaleString("en-US")}`}</Text>
        </View>
        <Text size={12} muted style={{ marginTop: 2 }}>{locale === "en" ? "days" : "أيام"}</Text>
      </View>
    </View>
  );
}

/**
 * الأعمدة — **قامةٌ ثابتةٌ وداخلها الممتلئ** (الصورة: رمادٌ يقول المدى وأصفرُ يقول القيمة). كثافتُها تتبع عددَها (D-801): الأسبوعُ
 * سبعةٌ فسيحة، والشهرُ حتى ٣١ متراصّة — فالرقمُ فوق القمّة وحدَها، والتسميةُ كلَّ ثلاثةٍ أو خمسةٍ محسوبةً من القمّة.
 */
function Bars({ s }: { s: ReportStats }) {
  const { tokens, locale } = useApp();
  const n = s.buckets.length;
  const peakBar = Math.max(1, ...s.buckets.map((b) => b.minutes));
  const peakIndex = Math.max(0, s.buckets.findIndex((b) => b.minutes === peakBar && b.minutes > 0));
  const dense = n > 7;
  const step = n > 20 ? 5 : n > 7 ? 3 : 1;
  const gap = n > 12 ? 3 : n > 7 ? 6 : 8;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap, marginTop: 24 }}>
      {s.buckets.map((b, i) => {
        const full = Math.round((b.minutes / peakBar) * BAR_H);
        const isPeak = b.minutes === peakBar && b.minutes > 0;
        const top = s.period === "week" && isPeak;
        const showValue = dense ? isPeak : b.minutes > 0;
        const showLabel = (((i - peakIndex) % step) + step) % step === 0;
        return (
          <View key={`${b.label}-${i}`} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 6 }}>
            {/* الرقمُ والتسميةُ أعرضُ من عمودهما في المدد الكثيفة: يتجاوزان حدَّه ولا يُقصّان */}
            <View style={{ height: 16, width: 44, alignItems: "center" }}>
              {showValue ? <Text size={11} muted numberOfLines={1} style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{clock(b.minutes, locale)}</Text> : null}
            </View>
            <View style={{ width: "100%", maxWidth: 34, height: BAR_H, justifyContent: "flex-end", borderRadius: 6, backgroundColor: tokens.surface2 + "B3" }}>
              <View style={{ height: b.minutes > 0 ? Math.max(6, full) : 0, borderRadius: 6, backgroundColor: tokens.accent }} />
            </View>
            <View style={{ height: 16, width: 44, alignItems: "center" }}>
              {showLabel ? <Text size={11} weight={top ? "700" : "400"} color={top ? tokens.fg : tokens.muted} numberOfLines={1}>{b.label}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** «الأكثر مشاهدة» — ثلاثةُ ملصقات، الأوّلُ أعرض (`flex 1.6`) وعليه رقمُه */
function TopThree({ s, onTitle }: { s: ReportStats; onTitle: (kind: "tv" | "movie", id: number) => void }) {
  const { tokens, locale } = useApp();
  const { width } = useWindowDimensions();
  const en = locale === "en";
  const unit = (width - PAGE_PAD * 2 - 24) / 3.6;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      {s.topTitles.slice(0, 3).map((x, i) => {
        const w = i === 0 ? unit * 1.6 : unit;
        const uri = posterFor(x.poster, w);
        return (
          <Pressable key={x.key} onPress={() => onTitle(x.mediaType, x.tmdbId)} accessibilityRole="link" accessibilityLabel={x.title} style={({ pressed }) => ({ flexGrow: i === 0 ? 1.6 : 1, flexBasis: 0, minWidth: 0, opacity: pressed ? 0.8 : 1 })}>
            <View style={{ width: "100%", aspectRatio: 2 / 3, borderRadius: 16, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
              {uri ? <Image source={{ uri }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <Icon name={x.mediaType === "tv" ? "tv" : "film"} size={20} color={tokens.muted} />}
              {i === 0 ? (
                <View style={{ position: "absolute", top: 8, start: 8, width: 24, height: 24, borderRadius: 6, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
                  <Text size={12} weight="700" color={tokens.onAccent}>1</Text>
                </View>
              ) : null}
            </View>
            <Text size={12} weight="700" numberOfLines={1} style={{ marginTop: 8 }}>{x.title}</Text>
            <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{`${hm(x.minutes, locale)}${x.episodes > 0 ? ` · ${x.episodes.toLocaleString("en-US")} ${en ? "eps" : "حلقة"}` : ""}`}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RoundStat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const { tokens } = useApp();
  return (
    <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: tokens.accent + "99", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={17} color={tokens.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={20} weight="700" numberOfLines={1} style={{ fontVariant: ["tabular-nums"] }}>{value}</Text>
        <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{label}</Text>
      </View>
    </View>
  );
}

function Glance({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { tokens } = useApp();
  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: "flex-start" }}>
      <Icon name={icon} size={17} color={tokens.accent} />
      <Text size={12} muted style={{ marginTop: 6 }}>{label}</Text>
      <Text size={12} weight="700" style={{ marginTop: 2, lineHeight: 18 }}>{value}</Text>
    </View>
  );
}

/**
 * «اليوم المستحيل» (D-801) — يومٌ فيه أكثرُ من ٢٤ ساعة: مشاهداتٌ عُلّمت دفعةً فحُسبت على يومها. الزرُّ ينقلها إلى مواعيد عرضها
 * بفعل الويب نفسِه. ⚖️ **النتيجةُ سطرٌ في البطاقة** (الويبُ يقولها توستاً): هذه الشاشةُ بلا مضيف توست، وسطرٌ تحت الزرّ يكفي.
 */
function ImpossibleDayCard({ onDone }: { onDone: () => void }) {
  const { t, tokens } = useApp();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const repair = async () => {
    if (busy || done) return;
    haptic.pick();
    setBusy(true);
    setNote(null);
    try {
      const r = await write<ReportRepairPayload>("/api/v1/me/report/repair", {});
      if (r.moved > 0) {
        setNote(r.remaining > 0 ? t.impossibleMore : r.stuck > 0 ? t.impossibleStuck : `${t.impossibleDone} · ${r.moved.toLocaleString("en-US")}`);
        setDone(r.remaining === 0);
        onDone();
      } else {
        setNote(r.stuck > 0 ? t.impossibleStuck : t.impossibleDone);
      }
    } catch {
      setNote(t.apiInternal);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ marginTop: 12, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 14, paddingVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="clock" size={16} color={tokens.accent} />
        <Text size={14} weight="700" style={{ flex: 1 }}>{t.impossibleTitle}</Text>
      </View>
      <Text size={12} muted style={{ marginTop: 6, lineHeight: 20 }}>{t.impossibleBody}</Text>
      <Pressable onPress={() => void repair()} disabled={busy || done} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: "flex-start", marginTop: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.accent + "80", backgroundColor: tokens.accent + "1A", paddingHorizontal: 14, paddingVertical: 6, opacity: busy || done ? 0.5 : pressed ? 0.7 : 1 })}>
        <Text size={12} weight="700" color={tokens.accent}>{t.impossibleCta}</Text>
      </Pressable>
      {note ? <Text size={12} muted style={{ marginTop: 8, lineHeight: 19 }}>{note}</Text> : null}
    </View>
  );
}

/** هيكلٌ بمواضع المحتوى نفسِها (شرطُ الصفحة) — لا مستطيلٌ واحدٌ كبير */
function ReportSkeleton() {
  const { tokens } = useApp();
  const bone = tokens.surface2;
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 16, gap: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ height: 46, width: "60%", borderRadius: 8, backgroundColor: bone }} />
          <View style={{ height: 12, width: "34%", borderRadius: 6, backgroundColor: bone }} />
        </View>
        <View style={{ width: RING, height: RING, borderRadius: RING / 2, backgroundColor: bone }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 132 }}>
        {[40, 62, 30, 88, 46, 104, 120].map((h, i) => (
          <View key={i} style={{ flex: 1, height: h, borderRadius: 6, backgroundColor: bone }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[1.6, 1, 1].map((g, i) => (
          <View key={i} style={{ flexGrow: g, flexBasis: 0, aspectRatio: 2 / 3, borderRadius: 16, backgroundColor: bone }} />
        ))}
      </View>
    </View>
  );
}
