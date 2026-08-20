import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import {
  LibraryAnalysis,
  LibraryAnalysisSkeleton,
  type StatsRange,
} from "@/components/LibraryAnalysis";
import { ShareCard } from "@/components/ShareCard";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { segmentedTrackFull, segmentedItem } from "@/components/ui/controls";

/**
 * الإحصائيات — **شكلٌ سلّمه أحمد** (D-493).
 *
 * التحليل الكامل يعيش هنا لا في المكتبة: من يريد أن يعرف توزيع ذوقه يأتي
 * قاصداً، ومن يريد أن يختار ما يشاهده لا يمرّ عليه في طريقه.
 *
 * ⚠️ **والترويسةُ ترويسةُ صفحةٍ داخليّة لا شريطُ التطبيق** — والمكوّنُ
 * هو `SettingsHeader` نفسُه (رجوعٌ · اسمٌ في المنتصف · فعلٌ واحد):
 * **الشكلُ هو الشكل، والاسمُ وحدَه يقول «إعدادات»** — ونسخةٌ ثانيةٌ منه
 * باسمٍ آخر هي بالضبط ما تمنعه القاعدة ٦. **وشريطُ التطبيق يُخفى هنا**
 * (`hidesAppHeader` في `chromeRules`) — **وترويستان في شاشةٍ واحدة
 * تجعلان سهمَي رجوعٍ وعنوانين** (حجّةُ D-462 بحرفها).
 */
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { range: raw } = await searchParams;
  /* **المدى في الرابط لا في حالةِ عميل** (D-438/D-463): الصفحةُ خادميّةٌ
     والأرقامُ تُحسب على الخادم — **فالتبويبُ رابطٌ يُشارَك ويعود إليه
     زرُّ الرجوع**، لا زرٌّ يُعيد بناء الشجرة في المتصفّح. */
  const range: StatsRange = raw === "year" || raw === "month" ? raw : "all";
  const year = new Date().getUTCFullYear();

  const tabs: { key: StatsRange; label: string }[] = [
    { key: "all", label: t.statsRangeAll },
    { key: "year", label: String(year) },
    { key: "month", label: t.statsRangeMonth },
  ];

  return (
    <div>
      <SettingsHeader
        title={t.statsPageTitle}
        fallbackHref="/library"
        action={<ShareCard locale={locale} icon />}
      />

      <nav aria-label={t.statsPageTitle} className={`${segmentedTrackFull} -mx-4 px-4 mb-5`}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/stats" : `/stats?range=${tab.key}`}
            scroll={false}
            aria-current={range === tab.key ? "page" : undefined}
            className={segmentedItem(range === tab.key, "flex-1 text-center")}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* المفتاحُ يحمل المدى: تبديلُ التبويب يبدّل الهيكلَ العظميّ أيضاً
          فلا تبقى أرقامُ المدى السابق معروضةً بينما يُجلب الجديد */}
      <Suspense key={range} fallback={<LibraryAnalysisSkeleton />}>
        <LibraryAnalysis locale={locale} range={range} />
      </Suspense>
    </div>
  );
}
