import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { getProfile, getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { hasFullStats } from "@/core/plan";
import { asTimeZone } from "@/core/zone";
import { asOffset, asStatsPeriod, buildPeriodStats, statsRange, type StatsPeriod } from "@/lib/periodStats";
import { ContentTab, HabitsTab, OverviewTab, TasteTab } from "@/components/stats/FullStatsTabs";
import { ReportView } from "@/components/ReportView";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { PlusPreview } from "@/components/stats/PlusPreview";
import { ShareCard } from "@/components/ShareCard";
import { chipClass } from "@/components/ui/controls";

/**
 * ====== 🆕 «إحصائياتك» — صفحةٌ واحدةٌ بدل «تقريرك» و«الإحصائيات الكاملة» (T412→T413، التصميم «أ»، أحمد ١٨ نوفمبر) ======
 *
 * 🔁 **نقضٌ مسجَّل لـ«٣أ» في D-1586** (٣٠ أكتوبر: «التطبيقُ وحدَه، والويبُ صفحتاه كما هما»): مطابقةُ الويب للتطبيق جعلت الويبَ
 * مثلَه — **خمسةُ أقسام**: ملخص (جسمُ «تقريرك» `ReportView` كما هو) · الاتجاه («نظرة عامة») · المحتوى · الذوق · العادات.
 * المدّةُ أربعٌ وتفتح على **الشهر** (D-805)، والسهمان للمشترك ولغير «كلّ الأوقات»، والمشاركةُ في الترويسة. و`/reports` بابٌ
 * ثانٍ لهذه الصفحة نفسِها (تحويلٌ بمدّته) — لا صفحتان تفترقان.
 * 🔑 **على الحاسوب** صفُّ الترويسة يحمل المدّةَ وسهميها والمشاركة (التصميم «أ»)، والتبويباتُ تحته؛ والملخّصُ عمودٌ مقروءٌ في
 * الوسط (قصّةٌ تُقرأ من أعلى)، والأقسامُ الأربعةُ شبكةٌ من عمودين (`.lz-statgrid` في `globals.css`). ما دونه كما كان.
 * 🔑 **والقفلُ لغير المشترك كما كان**: الملخّصُ رقمُه مكشوفٌ وما تحته مموَّه (D-809)، والأقسامُ الأربعةُ معاينةٌ مموّهة.
 * 🔑 **والروابطُ تستبدل ولا تُكدّس** (D-805): المدّةُ والإزاحةُ والقسمُ وجوهُ صفحةٍ واحدة لا وجهاتٌ في التاريخ.
 */

const TABS = ["summary", "trend", "content", "taste", "habits"] as const;
type TabId = (typeof TABS)[number];

function asTab(raw: string | null | undefined): TabId {
  /* «overview» اسمُ القسم القديم في روابطَ محفوظة — يذهب إلى «الاتجاه» وهو وجهُه نفسُه */
  if (raw === "overview") return "trend";
  return TABS.includes(raw as TabId) ? (raw as TabId) : "summary";
}

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<{ p?: string; o?: string; t?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const [{ locale }, params, profile] = await Promise.all([getT(), searchParams, getProfile()]);
  const ar = locale !== "en";
  const period: StatsPeriod = params.p ? asStatsPeriod(params.p) : "month";
  /* 🆕 T540 — **الإحصاءاتُ الكاملةُ للجميع** (أحمد ٢٤ نوفمبر «١ و٢ خله مجاني»): السؤالُ `hasFullStats` لا `isPlus` */
  const full = hasFullStats(profile);
  /* الإزاحةُ لمن يرى الإحصاءاتِ كاملةً، ولا إزاحةَ في «كلّ الأوقات» */
  const offset = full && period !== "all" ? asOffset(params.o) : 0;
  const tab = asTab(params.t);
  const tz = asTimeZone(profile?.timezone);
  const range = statsRange(period, offset, locale, tz);

  const periodLabel: Record<StatsPeriod, string> = ar
    ? { week: "الأسبوع", month: "الشهر", year: "السنة", all: "كل الأوقات" }
    : { week: "Week", month: "Month", year: "Year", all: "All time" };
  const tabLabel: Record<TabId, string> = ar
    ? { summary: "ملخص", trend: "الاتجاه", content: "المحتوى", taste: "الذوق", habits: "العادات" }
    : { summary: "Summary", trend: "Trend", content: "Content", taste: "Taste", habits: "Habits" };

  const href = (next: { p?: StatsPeriod; o?: number; t?: TabId }) => {
    const p = next.p ?? period;
    const o = next.o ?? offset;
    const tb = next.t ?? tab;
    const q = new URLSearchParams();
    if (p !== "month") q.set("p", p);
    if (o !== 0) q.set("o", String(o));
    if (tb !== "summary") q.set("t", tb);
    const s = q.toString();
    return s ? `/statistics?${s}` : "/statistics";
  };

  const tools = (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label={ar ? "المدّة" : "Period"} className="flex items-center gap-1.5">
        {(["week", "month", "year", "all"] as const).map((p) => (
          <Link key={p} role="tab" aria-selected={p === period} href={href({ p, o: 0 })} scroll={false} replace className={chipClass(p === period, "sm")}>
            {periodLabel[p]}
          </Link>
        ))}
      </div>
      {full && period !== "all" && (
        <span className="flex items-center gap-0.5">
          <Link
            href={href({ o: offset - 1 })}
            scroll={false}
            replace
            aria-label={ar ? "السابق" : "Previous"}
            className="grid h-9 w-8 place-items-center rounded-full text-muted transition hover:text-foreground"
          >
            {/* الحرفُ مرآويٌّ في يونيكود فينقلب مع العربيّة وحدَه (D-801) */}
            <span aria-hidden>‹</span>
          </Link>
          <span className="whitespace-nowrap text-12 font-semibold tabular-nums">{range.label}</span>
          {range.canGoNext ? (
            <Link
              href={href({ o: offset + 1 })}
              scroll={false}
              replace
              aria-label={ar ? "التالي" : "Next"}
              className="grid h-9 w-8 place-items-center rounded-full text-muted transition hover:text-foreground"
            >
              <span aria-hidden>›</span>
            </Link>
          ) : (
            <span aria-hidden className="h-9 w-8" />
          )}
        </span>
      )}
    </div>
  );

  return (
    <div>
      <SettingsHeader
        title={ar ? "إحصائياتك" : "Your stats"}
        /* T540 — لا شارةَ PLUS: الصفحةُ لم تعد من مزايا الاشتراك */
        fallbackHref="/stats"
        action={full ? <ShareCard locale={locale} kind={period === "all" ? "stats" : "report"} period={period} icon /> : undefined}
      />

      <div className="mt-2 flex flex-col gap-3 desk:flex-row desk:items-center desk:justify-between">
        {tools}
      </div>

      <div role="tablist" aria-label={ar ? "الأقسام" : "Sections"} className="mt-3 mb-5 flex overflow-x-auto border-b border-[color:var(--divider)] desk:mb-6">
        {TABS.map((tb) => {
          const on = tb === tab;
          return (
            <Link
              key={tb}
              role="tab"
              aria-selected={on}
              href={href({ t: tb })}
              scroll={false}
              replace
              className={`-mb-px shrink-0 border-b-[3px] px-4 pb-2.5 pt-1 text-14 transition ${
                on ? "border-accent font-bold text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tabLabel[tb]}
            </Link>
          );
        })}
      </div>

      <Suspense key={`${period}:${offset}:${tab}`} fallback={<StatsSkeleton />}>
        <Body period={period} offset={offset} tab={tab} locale={locale} tz={tz} preview={!full} />
      </Suspense>
    </div>
  );
}

async function Body({
  period,
  offset,
  tab,
  locale,
  tz,
  preview,
}: {
  period: StatsPeriod;
  offset: number;
  tab: TabId;
  locale: "ar" | "en";
  tz: string;
  preview: boolean;
}) {
  const s = await buildPeriodStats(period, offset, locale, tz);
  /* الملخّصُ عمودٌ مقروءٌ في الوسط على الحاسوب: قصّةٌ من أعلى إلى أسفل، وتمطيطُها على ١١٠٠ بكسل يكسر سطرَ افتتاحها */
  if (tab === "summary") {
    return (
      <div className="desk:mx-auto desk:max-w-[760px]">
        <ReportView stats={s} locale={locale} preview={preview} />
      </div>
    );
  }
  if (s.empty) {
    return (
      <p className="py-16 px-6 text-center text-sm leading-relaxed text-muted">
        {locale === "en" ? "Nothing watched in this period." : "لا مشاهدات في هذه المدّة."}
      </p>
    );
  }
  const body =
    tab === "content" ? (
      <ContentTab s={s} locale={locale} />
    ) : tab === "taste" ? (
      <TasteTab s={s} locale={locale} />
    ) : tab === "habits" ? (
      <HabitsTab s={s} locale={locale} />
    ) : (
      <OverviewTab s={s} locale={locale} />
    );
  /* المعاينةُ المموّهةُ تبقى عموداً واحداً (طبقةُ الضباب تغطّي جذرَها) — الشبكةُ للمشترك */
  return preview ? <PlusPreview locale={locale} locked={body} /> : <div className="lz-statgrid">{body}</div>;
}

function StatsSkeleton() {
  return (
    <div className="space-y-7" aria-hidden>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-4 animate-pulse rounded bg-surface-2" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
      <div className="h-[132px] animate-pulse rounded-xl bg-surface-2" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
