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
import { StatsRangeMenu } from "@/components/StatsRangeMenu";
import { SettingsHeader } from "@/components/settings/SettingsHeader";

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

  return (
    <div>
      {/* ⚖️ 🆕 D-682: تبويباتُ المدى المقسّمة غادرت وجهَ الصفحة إلى قائمة
          «⋯» في الترويسة (مواصفةُ أحمد المكتوبة: رجوعٌ · عنوانٌ · مشاركةٌ
          فـ«⋯») — **والأداةُ انتقلت ولم تمت**، والمدى باقٍ في الرابط
          (D-438/D-463) فصفوفُ القائمة روابطُ تُشارَك. */}
      <SettingsHeader
        title={t.statsPageTitle}
        fallbackHref="/library"
        action={
          <span className="flex items-center">
            <ShareCard locale={locale} icon />
            <StatsRangeMenu locale={locale} current={range} />
          </span>
        }
      />

      {/* المفتاحُ يحمل المدى: تبديلُ التبويب يبدّل الهيكلَ العظميّ أيضاً
          فلا تبقى أرقامُ المدى السابق معروضةً بينما يُجلب الجديد */}
      <Suspense key={range} fallback={<LibraryAnalysisSkeleton />}>
        <LibraryAnalysis locale={locale} range={range} />
      </Suspense>
    </div>
  );
}
