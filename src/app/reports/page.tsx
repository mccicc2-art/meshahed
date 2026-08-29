import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { getProfile, getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { isPlus } from "@/lib/plan";
import { asReportPeriod, buildPeriodReport, type ReportPeriod } from "@/lib/reports";
import { PeriodReportView } from "@/components/PeriodReportView";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { Icon } from "@/components/Icon";
import { segmentedItem, segmentedTrackFull } from "@/components/ui/controls";

/**
 * ============ تقاريرُ المشاهدة — أسبوعُك وشهرُك وسنتُك (D-796) ============
 *
 * **بندُ Loopz+ الأعلى أثراً** في قائمة القادم (`pending-D783` §٤).
 *
 * ⚖️ **ولمَ صفحةٌ لا قسمٌ في `/stats`**: **`/stats` تجيب «كم عندك»
 * والتقريرُ يجيب «ماذا فعلتَ هذه المدّة»** — **وسؤالان مختلفان في صفحةٍ
 * واحدةٍ يطول أحدُهما فيبتلع الآخر.** **و`/stats` تبقى مجّانيّةً كما هي**
 * (حكمُه)، **والصفحةُ الجديدةُ وحدَها مقفولة.**
 *
 * ⚠️ **والمدّةُ في الرابط لا في حالةِ عميل** (D-438/D-463): الحسابُ على
 * الخادم — **فالتبويبُ رابطٌ يُشارَك ويعود إليه زرُّ الرجوع.**
 *
 * 🔒 **والقفلُ يقول الثمنَ ولا يصمت** (نمطُ D-786): **شاشةٌ فارغةٌ بلا سببٍ
 * تُقرأ عطلاً لا قفلاً** — ومن يظنّه عطلاً لا يشتري بل يبلّغ عنه.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const [{ locale, t }, params, profile] = await Promise.all([
    getT(),
    searchParams,
    getProfile(),
  ]);
  const ar = locale !== "en";
  const period = asReportPeriod(params.p);
  const plus = isPlus(profile);

  const label: Record<ReportPeriod, string> = ar
    ? { week: "الأسبوع", month: "الشهر", year: "السنة" }
    : { week: "Week", month: "Month", year: "Year" };

  return (
    <div>
      <SettingsHeader title={ar ? "تقاريرك" : "Your reports"} fallbackHref="/stats" />

      {plus ? (
        <div className="mt-3 space-y-4">
          <div role="tablist" aria-label={ar ? "المدّة" : "Period"} className={segmentedTrackFull}>
            {(["week", "month", "year"] as const).map((p) => (
              <Link
                key={p}
                role="tab"
                aria-selected={p === period}
                href={p === "week" ? "/reports" : `/reports?p=${p}`}
                scroll={false}
                className={segmentedItem(p === period, "flex-1 basis-0 min-w-0 text-center")}
              >
                {label[p]}
              </Link>
            ))}
          </div>

          {/* المفتاحُ يحمل المدّة: تبديلُ التبويب يبدّل الهيكلَ العظميّ
              أيضاً فلا تبقى أرقامُ المدّة السابقة معروضةً بينما تُجلب
              الجديدة (نمطُ `/stats` حرفاً) */}
          <Suspense key={period} fallback={<ReportSkeleton />}>
            <ReportBody period={period} locale={locale} />
          </Suspense>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 text-center px-4">
          <Icon name="sparkle-star" size={28} className="text-accent" />
          <p className="text-16 font-bold leading-tight">{t.plusGateTitle}</p>
          <p className="text-13 text-muted leading-relaxed max-w-sm">
            {ar
              ? "التقارير الأسبوعية والشهرية والسنوية من مزايا Loopz+ — وإحصاءاتك في صفحة الإحصائيات تبقى مجّانيةً كما هي."
              : "Weekly, monthly and yearly reports are a Loopz+ feature — your stats page stays free exactly as it is."}
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

async function ReportBody({ period, locale }: { period: ReportPeriod; locale: "ar" | "en" }) {
  const report = await buildPeriodReport(period, locale);
  return <PeriodReportView report={report} locale={locale} />;
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-24 rounded-2xl bg-surface-2 animate-pulse" />
      <div className="h-36 rounded-2xl bg-surface-2 animate-pulse" />
      <div className="h-14 rounded-2xl bg-surface-2 animate-pulse" />
    </div>
  );
}
