import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { getProfile, getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { isPlus } from "@/lib/plan";
import { asTimeZone } from "@/lib/zone";
import {
  asOffset,
  asStatsPeriod,
  buildPeriodStats,
  statsRange,
  type StatsPeriod,
} from "@/lib/periodStats";
import {
  ContentTab,
  HabitsTab,
  OverviewTab,
  TasteTab,
} from "@/components/stats/FullStatsTabs";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { PlusPill } from "@/components/ui/PlusPill";
import { Icon } from "@/components/Icon";

/**
 * ============ الإحصائيات الكاملة (D-799 — تصميمُ أحمد المرفق) ============
 *
 * **الصورُ هي المرجعُ النهائيّ** بنصّه.
 *
 * 🔑 **والمدّةُ والإزاحةُ والتبويبُ كلُّها في الرابط** (D-438/D-463):
 * **فالفترةُ تُمرَّر من «تقريرك» تلقائيّاً كما اشترط**، **والتنقّلُ بين
 * التبويبات لا يفقدها**، **وزرُّ الرجوع يعيد القارئَ إلى موضعه.**
 * ⚡ **و`scroll={false}` على كلِّ رابطٍ هنا**: **صفحةٌ تقفز إلى أعلاها
 * عند كلِّ تبويبٍ تُقرأ إعادةَ تحميل** — وهو نصُّ شرطه.
 *
 * 🔒 **وغيرُ المشترك يرى بابَ الترقية لا بياناتٍ وهميّة** (شرطُه:
 * «لا تعرض بيانات وهمية للمستخدم غير المشترك») — **وإحصاءاتُه المجّانيّة
 * في `/stats` لا تُمسّ.**
 */

const TABS = ["overview", "content", "taste", "habits"] as const;
type TabId = (typeof TABS)[number];

function asTab(raw: string | null | undefined): TabId {
  return TABS.includes(raw as TabId) ? (raw as TabId) : "overview";
}

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; o?: string; t?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const [{ locale, t }, params, profile] = await Promise.all([
    getT(),
    searchParams,
    getProfile(),
  ]);
  const ar = locale !== "en";
  const period = asStatsPeriod(params.p);
  const offset = asOffset(params.o);
  const tab = asTab(params.t);
  const plus = isPlus(profile);
  /* 🆕 **وتقويمُ الصفحة تقويمُ القارئ** (D-806) — والغائبُ غرينتش */
  const tz = asTimeZone(profile?.timezone);
  const range = statsRange(period, offset, locale, tz);

  const periodLabel: Record<StatsPeriod, string> = ar
    ? { week: "الأسبوع", month: "الشهر", year: "السنة", all: "كل الأوقات" }
    : { week: "Week", month: "Month", year: "Year", all: "All time" };
  const tabLabel: Record<TabId, string> = ar
    ? { overview: "نظرة عامة", content: "المحتوى", taste: "الذوق", habits: "العادات" }
    : { overview: "Overview", content: "Content", taste: "Taste", habits: "Habits" };

  const href = (next: { p?: StatsPeriod; o?: number; t?: TabId }) => {
    const p = next.p ?? period;
    const o = next.o ?? offset;
    const tb = next.t ?? tab;
    const q = new URLSearchParams();
    if (p !== "week") q.set("p", p);
    if (o !== 0) q.set("o", String(o));
    if (tb !== "overview") q.set("t", tb);
    const s = q.toString();
    return s ? `/statistics?${s}` : "/statistics";
  };

  /* **مِقودُ المدّة** — سهمٌ واسمٌ وسهم، في صفِّ الترويسة لا تحته.
     ⚠️ **وقيمةٌ لا مكوّنٌ يُعرَّف داخل الرسم**: `react-hooks/static-components`
     ترفض الثاني بحقّ — **مكوّنٌ يُخلق في كلِّ رسمةٍ يفقد حالتَه معها.** */
  const periodNav = (
      <span className="flex items-center gap-0.5 shrink-0">
        <Link
          href={href({ o: offset - 1 })}
          scroll={false}
          /* 🔴 🆕 **وكلُّ رابطٍ هنا يستبدل ولا يُكدّس** (D-805، حكمُ
             أحمد: «إذا ضغطت سهم الرجوع المفروض يرجع للصفحة الي قبلها
             مباشرة»): **المدّةُ والإزاحةُ والتبويبُ كلُّها في الرابط**
             (D-799) — **فكلُّ ضغطةٍ كانت تدفع مدخلاً في التاريخ**،
             **ومن قلّب أربعَ مددٍ وأربعةَ أقسامٍ ثمّ ضغط الرجوع مشى في
             ثمانيةِ مداخلَ قبل أن يخرج.** **والتبويبُ وجهٌ ثانٍ لصفحةٍ
             واحدة لا وجهةٌ ثانية** (D-643).
             ⚠️ **والرابطُ الداخلُ إلى الصفحة يبقى دفعاً** — هو الذي
             يُرجِع القارئَ إلى «تقريرك». */
          replace
          aria-label={ar ? "السابق" : "Previous"}
          className="grid place-items-center w-8 h-9 rounded-full text-muted hover:text-foreground transition"
        >
          {/* **ولا اتّجاهَ مقسورٌ على سهمِ تنقّل** (D-801) — الحرفُ
              مرآويٌّ في يونيكود فينقلب مع العربيّة وحدَه */}
          <span aria-hidden>‹</span>
        </Link>
        <span className="text-12 font-semibold tabular-nums whitespace-nowrap">
          {range.label}
        </span>
        {range.canGoNext ? (
          <Link
            href={href({ o: offset + 1 })}
            scroll={false}
            replace
            aria-label={ar ? "التالي" : "Next"}
            className="grid place-items-center w-8 h-9 rounded-full text-muted hover:text-foreground transition"
          >
            <span aria-hidden>›</span>
          </Link>
        ) : (
          /* **والسهمُ الغائبُ يبقى مكانُه** فلا يقفز الاسمُ عند الحدّ */
          <span aria-hidden className="w-8 h-9" />
        )}
      </span>
  );

  return (
    <div>
      {/* 🆕 **والمدّةُ صعدت إلى الصفِّ الأوّل** (D-804، حكمُ أحمد:
          «السنة والشهر لا تكتبهم في سطر لوحدهم، خلّهم مع أوّل صفّ»):
          **كان لها صفٌّ كامل** — سهمان واسمٌ — **يعطي معلومةَ كلمةٍ
          بارتفاع سطر.** **والسهمان يبقيان ملاصقَين لِما يحرّكانه**:
          **مِقودٌ يُفصل عن الرقم الذي يقوده يصير زرَّين بلا معنى** —
          **ولذلك لم تُدسَّ الكلمةُ في الاسم هنا كما في «تقريرك»**،
          فتلك لا تتنقّل وهذه تتنقّل. */}
      <SettingsHeader
        title={ar ? "الإحصائيات الكاملة" : "Full Statistics"}
        badge={plus ? <PlusPill /> : undefined}
        fallbackHref={`/reports${period !== "week" ? `?p=${period}` : ""}`}
        action={plus && period !== "all" ? periodNav : undefined}
      />

      {plus ? (
        <div className="mt-1">
          {/* ═══ المدّة ═══ */}
          <div role="tablist" aria-label={ar ? "المدّة" : "Period"} className="flex">
            {(["week", "month", "year", "all"] as const).map((p) => {
              const on = p === period;
              return (
                <Link
                  key={p}
                  role="tab"
                  aria-selected={on}
                  href={href({ p, o: 0 })}
                  scroll={false}
                  replace
                  className={`flex-1 basis-0 min-w-0 text-center pb-2.5 pt-1 text-14 border-b-2 transition ${
                    on
                      ? "font-bold text-foreground border-accent"
                      : "text-muted border-transparent hover:text-foreground"
                  }`}
                >
                  {periodLabel[p]}
                </Link>
              );
            })}
          </div>

          {/* ═══ الأقسام ═══ */}
          <div role="tablist" aria-label={ar ? "القسم" : "Section"} className="flex mt-4 mb-5">
            {TABS.map((id) => {
              const on = id === tab;
              return (
                <Link
                  key={id}
                  role="tab"
                  aria-selected={on}
                  href={href({ t: id })}
                  scroll={false}
                  replace
                  className={`flex-1 basis-0 min-w-0 text-center text-14 transition flex items-center justify-center gap-1.5 ${
                    on ? "font-bold text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  {tabLabel[id]}
                  {on && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-accent" />}
                </Link>
              );
            })}
          </div>

          <Suspense key={`${period}:${offset}:${tab}`} fallback={<StatsSkeleton />}>
            <Body period={period} offset={offset} tab={tab} locale={locale} tz={tz} />
          </Suspense>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 text-center px-4">
          <Icon name="sparkle-star" size={28} className="text-accent" />
          <p className="text-20 font-bold leading-tight">{t.plusGateTitle}</p>
          <p className="text-12 text-muted leading-relaxed max-w-sm">
            {ar
              ? "الإحصائيات الكاملة من مزايا Loopz+ — وإحصاءاتك في صفحة الإحصائيات تبقى مجّانيةً كما هي."
              : "Full statistics are a Loopz+ feature — your stats page stays free exactly as it is."}
          </p>
          <div className="rounded-2xl border border-border bg-surface px-4 py-3 mt-1">
            <p className="text-15 font-bold leading-none">{t.plusPrice}</p>
            <p className="mt-1 text-12 text-muted leading-none">{t.plusPriceRenew}</p>
            <p className="mt-1.5 text-12 text-muted leading-none">{t.plusSoon}</p>
          </div>
          <Link href="/plus" className="text-12 font-bold text-accent hover:underline">
            {t.plusLearnMore}
          </Link>
        </div>
      )}
    </div>
  );
}

async function Body({
  period,
  offset,
  tab,
  locale,
  tz,
}: {
  period: StatsPeriod;
  offset: number;
  tab: TabId;
  locale: "ar" | "en";
  tz: string;
}) {
  const s = await buildPeriodStats(period, offset, locale, tz);
  if (s.empty) {
    return (
      <p className="text-sm text-muted text-center py-16 px-6 leading-relaxed">
        {locale === "en"
          ? "Nothing watched in this period."
          : "لا مشاهدات في هذه المدّة."}
      </p>
    );
  }
  if (tab === "content") return <ContentTab s={s} locale={locale} />;
  if (tab === "taste") return <TasteTab s={s} locale={locale} />;
  if (tab === "habits") return <HabitsTab s={s} locale={locale} />;
  return <OverviewTab s={s} locale={locale} />;
}

/** هيكلٌ **بمواضع المحتوى** لا مستطيلٌ واحد (شرطُه) */
function StatsSkeleton() {
  return (
    <div className="space-y-7" aria-hidden>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-4 rounded bg-surface-2 animate-pulse" />
            <div className="h-6 w-3/4 rounded bg-surface-2 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-surface-2 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-[132px] rounded-xl bg-surface-2 animate-pulse" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-4 rounded bg-surface-2 animate-pulse" />
        ))}
      </div>
      <div className="h-[104px] w-[104px] rounded-full bg-surface-2 animate-pulse" />
    </div>
  );
}
