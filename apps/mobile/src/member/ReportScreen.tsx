import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { File, Paths } from "expo-file-system";
import { downloadTo, write } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { posterFor } from "../poster";
import { tabSwipeBlocksPress } from "../TabSlide";
import { hm as hmFull, primeLabel } from "@/core/statsFormat";
import type { Locale } from "@/core/i18n";
import type { ReportBucket, ReportPeriod, ReportRepairPayload, ReportStats, ReportTitle } from "@/core/contracts/report";

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
 *  - 🆕 D-1575 — **شاشةٌ واحدةٌ بلا نزول** (أحمد ٢٩ أكتوبر): الوقتُ في سطرٍ وحبّةُ الأيّام · «لمحة عن مدّتك» شبكةُ ستّ خانات ·
 *    أعمدةٌ قصيرة · ثلاثةُ ملصقاتٍ صغيرة · الذوق · سطرُ «الإحصائيات الكاملة». جملةُ الافتتاح وسطرُ الاستنتاج حُذفا («١ب»)،
 *    وصفُّ «شارك تقريرك» حُذف — رمزُ الترويسة يفعلها. الويبُ باقٍ على ترتيبه («٢أ»: شاشتُه كبيرة).
 *  - 🆕 D-1579 → D-1580 — **المددُ الثلاث خاناتٌ ملوّنة** (`PeriodHeat`: تقويمُ الشهر، صفُّ الأسبوع، شهورُ السنة) بدل الأعمدة،
 *    **ولمسةُ يومٍ أو شهرٍ تبدّل «الأكثر مشاهدة» إلى أعماله** (`titles` من الخادم لكلِّ عمود)، وملصقاتٌ أكبر.
 *  - 🆕 D-1576 — **المددُ تُسحب** (`TabSlide`، لوحٌ لكلِّ مدّة: `ReportPane`) **والمحتوى يملأ الطول**: الأعمدةُ تأخذ ما بقي (٤٨–١٦٠)،
 *    والأرقامُ والملصقاتُ والمسافاتُ أوسعُ قليلاً (أحمد: «خلها ترتاح وتستفيد من كامل المساحة»).
 *  - 🆕 D-1583 — **الصفحةُ ثابتةٌ** (`FitScroll`: لا سحبَ ولا ارتداد، والتمريرُ لما لا يتّسع وحدَه) **والتحديثُ تلقائيّ** عند كلِّ فتح،
 *    والخاناتُ تتمدّد أكثر فيبقى تحت المحتوى نحوُ ٥٪ من الطول على كلِّ هاتف.
 *  - 🆕 D-1586 — **«تقريرك» صار قسمَ «ملخص» في «إحصائياتك»** (أحمد ٣٠ أكتوبر: «ليه ماتكون صفحة وحدة وما نشتت المستخدم؟»):
 *    الشاشةُ ذهبت (`FullStatsScreen` هي الشاشةُ الواحدة)، وهذا الملفُّ قطعُها المشتركة — `ReportBody` جسمُ الملخّص، والمشاركة.
 *  - 🆕 D-1368 (الدفعة ج) — **«شارك تقريرك»** (D-810): رمزٌ في الترويسة يشارك **صورةَ المدّة المعروضة** (`useShareReport`) — الصورةُ يرسمها الخادمُ براسم الويب، تُكتب على القرص ثمّ تُسلَّم لورقة المشاركة (وصفةُ C3).
 */
const PAGE_PAD = 16;
/* 🆕 D-1390 — **لا أخضرَ ولا أحمرَ ثانيين**: كانا `#3DBE6B`/`#E5484D` مكتوبين هنا — درجتان غيرُ `success`/`error`
   (قاعدةُ «لونُ نجاحٍ واحد»)، وعلى «النهاري» تباينُ الأخضر ٢٫١٩ والأحمر ٣٫٥٩. الرمزان يعرفان درجتَهما في كلِّ ثيم. */

/**
 * 🆕 D-1585 — **الوقتُ ساعاتٌ وحدها من عشر ساعات** (أحمد ٣٠ أكتوبر على «2,919h 25m»: «احذف الدقايق فقط ساعات» ثمّ «١أ»): الدقائقُ
 * بجانب ألفي ساعةٍ ضجيج، وتحت العشر معنى («4h» وحدها تُنقص ساعةً تقريباً) — فتبقى، وتحت الساعة دقائق. التطبيقُ وحدَه («٢أ»):
 * `hm` النواة تبقى للويب كما هي
 */
export function hm(minutes: number, locale: Locale | string): string {
  if (minutes >= 600) return `${Math.round(minutes / 60).toLocaleString("en-US")}h`;
  return hmFull(minutes, locale as Locale);
}

export const myReportKey = (period: ReportPeriod, offset = 0) => ["me:reports", period, offset] as const;

/**
 * مشاركةُ صورة التقرير — **صورةُ مدّةٍ بعينها** (رمزٌ يشارك «الشهر» وأنت في «السنة» عطلٌ بحجمٍ أصغر — حجّةُ D-810).
 * الملفُّ في الكاش باسمٍ موقوت، والسابقُ يُمسح قبل الجديد لا بعد المشاركة (ورقةُ أندرويد قد تعود قبل أن يقرأه التطبيقُ الآخر).
 * وحدةُ المشاركة تُحمَّل عند الحاجة (حجّةُ `PrivacyScreen`): إن غابت في ثنائيٍّ ما فالنتيجةُ سطرُ خطأٍ هنا لا سقوطُ الشاشة.
 */
export function useShareReport(period: ReportPeriod) {
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

/* 🆕 D-1583 — **سحبُ التحديث ذهب مع ثبات الصفحة** («١أ»: تتحدّث تلقائيّاً كلّما فتحت الصفحة أو غيّرت المدّة): كلُّ تركيبٍ يجلب
   (`refetchOnMount: "always"`)، والحداثةُ نصفُ دقيقةٍ لا خمسُ دقائق — مدّةٌ عُدتَ إليها بعد قليلٍ تُجلب من جديد */
export const REPORT_STALE = 30_000;

/**
 * 🆕 D-1583 — **لوحٌ ثابتٌ لا يُسحب** (تسجيلُ أحمد ٢٩ أكتوبر: «ما أبغى أقدر أسحبها كذا، أبغاها ثابتة» ثمّ «٢أ»): لا ارتدادَ ولا سحبَ
 * تحديث، والتمريرُ لا يعمل إلّا حين لا يتّسع المحتوى للشاشة (هاتفٌ صغير أو خطٌّ مكبّر) — فلا يُقصّ شيءٌ أبداً. المحتوى `flexGrow`
 * فالقطعةُ المتمدّدةُ في اللوح تأخذ ما بقي، والذيلُ مسافةُ الأمان + ١٦ (نحوُ ٥٪ من طول هاتفٍ كبير). قطعةٌ واحدةٌ لـ«تقريرك»
 * و«الإحصائيات الكاملة»
 */
export function FitScroll({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState(0);
  const [content, setContent] = useState(0);
  const over = box > 0 && content > box + 1;
  return (
    <ScrollView
      style={{ flex: 1 }}
      onLayout={(e) => setBox(Math.round(e.nativeEvent.layout.height))}
      onContentSizeChange={(_, h) => setContent(Math.round(h))}
      scrollEnabled={over}
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 16 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
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

export function ReportBody({
  s,
  plus,
  onTitle,
  onWeb,
  shareError,
  onRepaired,
}: {
  s: ReportStats;
  plus: boolean;
  onTitle: (kind: "tv" | "movie", id: number) => void;
  onWeb: (path: string) => void;
  shareError: string | null;
  onRepaired: () => void;
}) {
  const { tokens, locale } = useApp();
  const en = locale === "en";

  /* ———— المفتوحُ للجميع: الوقتُ في سطرٍ وحبّةُ الأيّام ———— */
  /* 🆕 D-1575 — **التقريرُ شاشةٌ واحدةٌ تُقرأ بلا نزول** (لقطةُ أحمد ٢٩ أكتوبر: «أفضل شي فيه لمحة عن مدتك وماهو ظاهر، والباقي
     اللي فوق كبيره وبشعه — الأفضل ترتب بحيث من صفحة واحدة كل شي ظاهر»). كانت ثلاثَ شاشاتٍ طولاً: الرقمُ ٤٤ وحلقةُ ١٠٤ ربعُها،
     والأعمدةُ ربعٌ ثانٍ، والملصقاتُ شاشةٌ كاملة. لا معلومةَ حُذفت إلّا ما اختار حذفَه («١ب»: جملةُ «في اليوم — و٪ منها» وسطرُ
     الاستنتاج)، والبطاقةُ «شارك تقريرك» لأنّ رمزَ المشاركة في الترويسة يفعلها. الترتيبُ: ما ترجع إليه (أرقامُك) قبل ما تنظر إليه
     مرّة (الرسمُ والملصقات). على آيفون عاديٍّ وأكبر يتّسع كلُّه؛ SE وmini يبقى لهما نزولٌ قصيرٌ في الذيل — والـ`ScrollView` باقٍ لهما */
  /* 🆕 D-1580 — العمودُ المختار (يومٌ في الأسبوع والشهر، شهرٌ في السنة): «الأكثر مشاهدة» تحته يصير أعمالَه */
  const [pick, setPick] = useState<number | null>(null);
  const picked = pick !== null ? s.buckets[pick] ?? null : null;
  const pickedName = picked ? bucketName(picked, s.period, locale) : "";
  const shown = picked ? picked.titles ?? [] : s.topTitles;
  const openPart = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={36} weight="700" numberOfLines={1} adjustsFontSizeToFit style={{ lineHeight: 42 }}>{hm(s.minutes, locale)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
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
        </View>
        <DaysPill active={s.activeDays} total={s.range.days} />
      </View>
      {/* الرمزُ في الترويسة وحدَه يشارك الآن — فخطؤه يُقال هنا تحت الرقم، لا في بطاقةٍ ذهبت */}
      {shareError ? <Text size={12} color={tokens.error} style={{ marginTop: 6 }}>{shareError}</Text> : null}
    </>
  );

  /* ———— ما تحت الافتتاح: للمشترك كاملاً، ولغيره معاينةٌ خلف الحجاب ———— */
  const lockedPart = (
    <>
      {s.impossible.days > 0 ? <ImpossibleDayCard onDone={onRepaired} /> : null}

      <H3>{en ? "Your period at a glance" : "لمحة عن مدّتك"}</H3>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tile icon="play" label={en ? "Episodes" : "حلقة"} value={s.episodes.toLocaleString("en-US")} />
          <Tile icon="film" label={en ? "Movies" : "فيلم"} value={s.movies.toLocaleString("en-US")} />
          <Tile icon="check" label={en ? "Day streak" : "أيام متتالية"} value={s.streak.toLocaleString("en-US")} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tile icon="trending" label={en ? "Peak day" : "أكثف يوم"} value={s.peak ? `${s.peak.label} · ${hm(s.peak.minutes, locale)}` : "—"} small />
          {/* وقتُ الذروة لا يُرسم بلا ساعةٍ حقيقيّة (D-797/D-798) */}
          <Tile icon="clock" label={en ? "Prime time" : "وقت الذروة"} value={s.habits.primeHours ? primeLabel(s.habits.primeHours) : "—"} small />
          <Tile icon="check" label={en ? "Completion" : "الإكمال"} value={`${s.completionPct.toLocaleString("en-US")}%`} small />
        </View>
      </View>

      {/* 🆕 D-1579 → D-1580 — المددُ الثلاثُ خاناتٌ ملوّنةٌ بشكلٍ واحد (أحمد: «كذلك الأسبوعي والسنة عدلها»): الشهرُ تقويم،
          والأسبوعُ صفُّ سبعة أيّام، والسنةُ اثنا عشر شهراً */}
      <PeriodHeat s={s} pick={pick} onPick={setPick} pickedName={pickedName} />

      {s.topTitles.length > 0 ? (
        <>
          <H3>{picked ? (en ? `Watched on ${pickedName}` : s.period === "year" ? `شاهدت في ${pickedName}` : `شاهدت يوم ${pickedName}`) : en ? "Most watched" : "الأكثر مشاهدة"}</H3>
          {shown.length > 0 ? (
            <TopThree titles={shown} onTitle={onTitle} />
          ) : (
            /* قامةُ صفِّ الملصقات نفسُها فلا تقفز الصفحةُ حين يُختار يومٌ فارغ */
            <View style={{ height: TOP_W * 1.5 + 40, alignItems: "center", justifyContent: "center" }}>
              <Text size={13} muted>{en ? "Nothing watched" : s.period === "year" ? "لا مشاهدة في هذا الشهر" : "لا مشاهدة في هذا اليوم"}</Text>
            </View>
          )}
        </>
      ) : null}

      {/* 🆕 D-1586 — شريطُ «ذوقك في هذه المدّة» خرج إلى قسم «الذوق» في الشاشة الواحدة: الأنواعُ نفسُها مرسومةٌ هناك بنسبها */}

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

/** 🆕 D-1575 — عنوانُ أقسام «تقريرك» بعد ترتيب الشاشة الواحدة: أصغرُ من `H2`. 🆕 D-1582 — و«الإحصائيات الكاملة» تقرؤه أيضاً حين صار كلُّ قسمٍ شاشةً واحدة */
export function H3({ children }: { children: string }) {
  return <Text size={15} weight="700" style={{ marginTop: 16, marginBottom: 8 }}>{children}</Text>;
}

/**
 * حبّةُ الأيّام — أيّامٌ شاهدتَ فيها من أيّام المدّة. 🆕 D-1575 — كانت حلقةً ١٠٤ بجانب الرقم الكبير (ربعُ الشاشة معهما)؛ الرقمان
 * نفسُهما في حبّةٍ بقامة سطر الوقت
 */
function DaysPill({ active, total }: { active: number; total: number }) {
  const { tokens, locale } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.accent + "80", backgroundColor: tokens.accent + "1A", paddingHorizontal: 12, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", direction: "ltr" }}>
        <Text size={16} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{active.toLocaleString("en-US")}</Text>
        <Text size={12} muted>{` / ${total.toLocaleString("en-US")}`}</Text>
      </View>
      <Text size={12} muted>{locale === "en" ? "days" : "يوم"}</Text>
    </View>
  );
}

/** 🆕 D-1580 — اسمُ العمود المختار كما يُقرأ: «الخميس ١٥» لليوم، و«أكتوبر» للشهر */
export function bucketName(b: ReportBucket, period: ReportPeriod, locale: string): string {
  const en = locale === "en";
  if (period === "year" || !b.dayKey) return b.label;
  const d = new Date(`${b.dayKey}T00:00:00Z`);
  const wd = new Intl.DateTimeFormat(en ? "en" : "ar", { weekday: "long", timeZone: "UTC" }).format(d);
  return `${wd} ${d.getUTCDate().toLocaleString("en-US")}`;
}

/**
 * 🆕 D-1579 → D-1580 — **خاناتُ المدّة الملوّنة** — شكلٌ واحدٌ للمدد الثلاث (بدل ٣١ عموداً ثمّ أعمدةً للأسبوع والسنة):
 * - **الشهر** تقويمٌ بسبعة أعمدةٍ يبدأ الأحد (أسبوعُ المملكة) — في العربيّة الأحدُ يمين؛ **الأسبوع** صفُّ سبعة أيّامٍ أكبر، في كلٍّ اسمُه
 *   ووقتُه؛ **السنة** اثنا عشر شهراً أربعةً في الصفّ، في كلٍّ اسمُه وساعاتُه.
 * - **أربعُ درجاتٍ من لون التمييز** نسبةً إلى أكثف عمود، والفارغُ رماديٌّ هادئ، وما لم يأتِ بعدُ من المدّة أخفت.
 * - **لمسةٌ تختار** (ويُكتب فوق الشبكة اسمُه ووقتُه، و«الأكثر مشاهدة» تصير أعمالَه) ولمسةٌ ثانيةٌ تُلغي؛ وبلا اختيارٍ يقف السطرُ مقياساً.
 * - القامةُ `flex: 1` بين حدّين: تأخذ ما بقي من الشاشة ولا تنهار على هاتفٍ صغير.
 */
function PeriodHeat({ s, pick, onPick, pickedName }: { s: ReportStats; pick: number | null; onPick: (i: number | null) => void; pickedName: string }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  const peak = Math.max(1, ...s.buckets.map((b) => b.minutes));
  const gap = 6;
  const month = s.period === "month" && s.buckets.every((b) => b.dayKey);
  const week = s.period === "week";
  /* الصفوف: الشهرُ من الأحد (خاناتٌ فارغةٌ قبل اليوم الأوّل)، والأسبوعُ صفٌّ واحد، والسنةُ أربعةٌ في الصفّ */
  const cols = month || week ? 7 : 4;
  const lead = month ? new Date(`${s.buckets[0].dayKey}T00:00:00Z`).getUTCDay() : 0;
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...s.buckets.map((_, i) => i)];
  while (cells.length % cols) cells.push(null);
  const rows = Array.from({ length: cells.length / cols }, (_, r) => cells.slice(r * cols, r * cols + cols));
  /* 🆕 D-1583 — الحدُّ الأعلى أوسع (كان ١٠٤ · ٤٦ · ٦٤). 🆕 D-1584 — ومعتدل: بـ١٨٠ · ٧٢ · ١١٠ صارت الخاناتُ أعمدةً طويلة؛
     ١٣٢ · ٥٦ · ٨٤ تملأ ولا تتمطّط */
  const [rowMin, rowMax] = week ? [64, 132] : month ? [24, 56] : [40, 84];
  const level = (m: number) => (m <= 0 ? 0 : m / peak > 0.75 ? 4 : m / peak > 0.5 ? 3 : m / peak > 0.25 ? 2 : 1);
  const fill = (lv: number) => (lv === 0 ? tokens.surface2 : tokens.accent + ["", "40", "80", "BF", "FF"][lv]);
  /* ٢٠٢٦-١٠-٠٤ أحدٌ — أسماءُ الأيّام من أحدٍ معلوم لا من جدولٍ مكتوب */
  const narrow = new Intl.DateTimeFormat(en ? "en" : "ar", { weekday: "narrow", timeZone: "UTC" });
  const heads = month ? Array.from({ length: 7 }, (_, i) => narrow.format(new Date(Date.UTC(2026, 9, 4 + i)))) : null;
  const chosen = pick !== null ? s.buckets[pick] : null;
  const chrome = 18 + 26 + (heads ? 18 : 0);
  return (
    <View style={{ flex: 1, minHeight: rows.length * rowMin + (rows.length - 1) * gap + chrome, maxHeight: rows.length * rowMax + (rows.length - 1) * gap + chrome, paddingTop: 18 }}>
      {/* سطرُ المختار أو المقياس — قامتُه ثابتةٌ فلا تقفز الشبكةُ حين يتبدّل */}
      <View style={{ height: 20, flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {chosen ? (
          <Text size={13} weight="700" numberOfLines={1}>{`${pickedName} · ${chosen.minutes > 0 ? hm(chosen.minutes, locale) : en ? "nothing watched" : "بلا مشاهدة"}`}</Text>
        ) : (
          <>
            <Text size={11} muted>{en ? "Less" : "أقلّ"}</Text>
            {[1, 2, 3, 4].map((lv) => (
              <View key={lv} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: fill(lv) }} />
            ))}
            <Text size={11} muted>{en ? "More" : "أكثر"}</Text>
          </>
        )}
      </View>
      {heads ? (
        <View style={{ flexDirection: "row", gap, marginBottom: 4 }}>
          {heads.map((h, i) => (
            <Text key={i} size={11} muted style={{ flex: 1, textAlign: "center" }}>{h}</Text>
          ))}
        </View>
      ) : null}
      <View style={{ flex: 1, gap }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flex: 1, flexDirection: "row", gap }}>
            {row.map((idx, c) => {
              if (idx === null) return <View key={c} style={{ flex: 1 }} />;
              const b = s.buckets[idx];
              const lv = level(b.minutes);
              /* ما لم يأتِ بعدُ أخفت: أيّامُ المدّة الجارية بعد اليوم، وشهورُ السنة الجارية بعد الشهر */
              const future = s.period === "year" ? s.offset === 0 && idx > new Date().getMonth() : idx >= s.elapsedDays;
              const on = pick === idx;
              const ink = lv >= 3 ? tokens.onAccent : lv > 0 ? tokens.fg : tokens.muted;
              return (
                <Pressable
                  key={c}
                  onPress={() => { if (tabSwipeBlocksPress()) return; haptic.pick(); onPick(on ? null : idx); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${bucketName(b, s.period, locale)} · ${b.minutes > 0 ? hm(b.minutes, locale) : "0"}`}
                  style={{ flex: 1, borderRadius: month ? 8 : 12, backgroundColor: fill(lv), opacity: future ? 0.35 : 1, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: on ? 2 : 0, borderColor: tokens.fg }}
                >
                  <Text size={month ? 11 : 13} weight={lv >= 3 || !month ? "700" : "400"} color={ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontVariant: ["tabular-nums"], paddingHorizontal: 2 }}>{b.label}</Text>
                  {/* الأسبوعُ والسنةُ خاناتٌ واسعة: وقتُها تحت اسمها؛ والشهرُ رقمٌ وحده (الوقتُ في سطر المختار) */}
                  {!month && b.minutes > 0 ? (
                    <Text size={11} color={ink} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontVariant: ["tabular-nums"], opacity: 0.85 }}>{hm(b.minutes, locale)}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * «الأكثر مشاهدة» — ثلاثةُ ملصقاتٍ صغيرةٍ في صفّ، وتحت كلٍّ اسمُه ووقتُه، والأوّلُ عليه رقمُه. 🆕 D-1575 — كانت ملصقاتٍ بعرض
 * الشاشة (الأوّلُ ١٫٦ ضعف) تأخذ شاشةً كاملة؛ الملصقُ هنا يدلّ على العمل ولا يُعرض لذاته
 */
/* 🆕 D-1579 — ٧٢ (كانت ٥٦): «كبرها شوي» */
const TOP_W = 72;
/* 🆕 D-1583 — ما تحت الملصق (الاسمُ والوقت) وأعرضُ ملصقٍ حين يتمدّد */
const TOP_CAPTION = 44;
/* 🆕 D-1584 — ١٢٠ (كانت ١٣٢) */
const TOP_MAX = 120;
export function TopThree({ titles, onTitle, fill }: { titles: ReportTitle[]; onTitle: (kind: "tv" | "movie", id: number) => void; fill?: boolean }) {
  const { tokens, locale } = useApp();
  const { width } = useWindowDimensions();
  const en = locale === "en";
  /* 🆕 D-1583 — **`fill`: الصفُّ يأخذ ما بقي من اللوح والملصقُ يكبر بقامته** (أحمد: «استغل كل المساحات السوداء — تكبّر الأشياء»):
     الغلافُ `flex: 1` بين حدّين يُقاس، والعرضُ من القامة (٢:٣) ولا يتجاوز ثلثَ الصفّ ولا ١٣٢ */
  const col = (width - PAGE_PAD * 2 - 24) / 3;
  const [h, setH] = useState(TOP_W * 1.5 + TOP_CAPTION);
  const onLayout = (e: LayoutChangeEvent) => {
    const v = Math.round(e.nativeEvent.layout.height);
    if (Math.abs(v - h) > 1) setH(v);
  };
  const pw = fill ? Math.round(Math.max(TOP_W, Math.min(TOP_MAX, col, (h - TOP_CAPTION) / 1.5))) : TOP_W;
  return (
    /* 🆕 D-1579 — الملصقُ فوق اسمه لا بجانبه: بعرض ٧٢ لا يبقى بجانبه في ثلثِ الصفّ مكانٌ لاسم */
    <View
      onLayout={fill ? onLayout : undefined}
      style={[{ flexDirection: "row", alignItems: "flex-start", gap: 12 }, fill ? { flex: 1, minHeight: TOP_W * 1.5 + TOP_CAPTION, maxHeight: TOP_MAX * 1.5 + TOP_CAPTION } : null]}
    >
      {titles.slice(0, 3).map((x, i) => {
        const uri = posterFor(x.poster, pw);
        return (
          <Pressable key={x.key} onPress={() => onTitle(x.mediaType, x.tmdbId)} accessibilityRole="link" accessibilityLabel={x.title} style={({ pressed }) => ({ flex: 1, minWidth: 0, alignItems: "flex-start", opacity: pressed ? 0.8 : 1 })}>
            <View style={{ width: pw, aspectRatio: 2 / 3, borderRadius: 10, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
              {uri ? <Image source={{ uri }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <Icon name={x.mediaType === "tv" ? "tv" : "film"} size={18} color={tokens.muted} />}
              {i === 0 ? (
                <View style={{ position: "absolute", top: 6, start: 6, width: 18, height: 18, borderRadius: 5, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
                  <Text size={11} weight="700" color={tokens.onAccent}>1</Text>
                </View>
              ) : null}
            </View>
            <Text size={12} weight="700" numberOfLines={1} style={{ marginTop: 6, alignSelf: "stretch" }}>{x.title}</Text>
            <Text size={11} muted numberOfLines={1} style={{ marginTop: 2, alignSelf: "stretch" }}>{`${hm(x.minutes, locale)}${x.episodes > 0 ? ` · ${x.episodes.toLocaleString("en-US")} ${en ? "eps" : "حلقة"}` : ""}`}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * خانةُ «لمحة عن مدّتك» — 🆕 D-1575 بدلُ `RoundStat` و`Glance`: كانتا شكلين لصفّين (دائرةٌ ورقمٌ ٢٠، ورمزٌ فوق اسمٍ ورقمٍ ١٢)؛
 * خانةٌ واحدةٌ بشكلٍ واحد: رمزٌ واسمٌ في سطر، والقيمةُ تحته. `small` لقيمةٍ نصّيّة («الأربعاء ١٥ · 6h 40m») تصغر لتتّسع
 */
export function Tile({ icon, label, value, small }: { icon: IconName; label: string; value: string; small?: boolean }) {
  const { tokens } = useApp();
  return (
    <View style={{ flex: 1, minWidth: 0, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 12, paddingVertical: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Icon name={icon} size={13} color={tokens.accent} />
        <Text size={11} muted numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      </View>
      <Text size={small ? 15 : 22} weight="700" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ marginTop: 6, fontVariant: ["tabular-nums"], lineHeight: 28 }}>{value}</Text>
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
