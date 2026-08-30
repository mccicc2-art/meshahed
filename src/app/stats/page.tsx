import { redirect } from "next/navigation";
import Link from "next/link";
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
import { Icon } from "@/components/Icon";
import { PlusPill } from "@/components/ui/PlusPill";

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

      {/* 🆕 **بابُ التقارير** (D-796) — **صفٌّ في ذيل الإحصائيات لا رمزٌ
          ثالثٌ في الترويسة**: الترويسةُ فيها المشاركةُ والمدى، **ورمزٌ
          ثالثٌ في صفٍّ عرضُه أربعُ وحداتٍ يزحم اثنين قائمين** (D-776).
          🔑 **والموضعُ يقول المعنى**: من فرغ من قراءة «كم عندي» هو
          بالضبط من يسأل «وماذا فعلتُ هذا الأسبوع؟» — **وبابٌ يقع حيث
          يولد السؤال لا يحتاج تعليماً.** */}
      <Link
        href="/reports"
        className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 active:opacity-70 transition"
      >
        <Icon name="chart" size={18} className="text-accent shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-14 font-bold">
            {locale === "en" ? "Your reports" : "تقاريرك"}
          </span>
          {/* 🆕 **والجملةُ تقول ما فيها مرّةً واحدة** (D-803): كانت
              «**أسبوعك** و**شهرك** و**سنتك** — من مزايا Loopz+»،
              **وثلاثةُ ضمائرَ ثمّ وسمُ خطّةٍ في سطرِ شرحٍ من اثنتي عشرة
              كلمةً يُقرأ إعلاناً لا وصفاً.** */}
          <span className="block text-12 text-muted mt-0.5">
            {locale === "en" ? "Your week, month and year." : "أسبوعك وشهرك وسنتك."}
          </span>
        </span>
        {/* 🆕 **والوسمُ رقاقةٌ لا نجمة** (D-803، حكمُ أحمد على لقطةٍ
            محوَّطة): **«من مزايا Loopz+» جملةٌ في سطرِ الشرح، والرقاقةُ
            تقولها بلا كلمة** — **ووسمٌ وجملةٌ يقولان الشيءَ مرّتين.**
            🔑 **وهي `PlusPill` نفسُها التي في ترويستَي «تقريرك»
            و«الإحصائيات الكاملة»** (D-801) — **فالقارئُ يرى الوسمَ
            نفسَه عند الباب وخلفه**، **ونجمةٌ هنا ورقاقةٌ هناك وسمان
            لمعنًى واحد** (القاعدة ٣). */}
        <PlusPill />
      </Link>
    </div>
  );
}
