import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { LibraryAnalysis, LibraryAnalysisSkeleton } from "@/components/LibraryAnalysis";
import { ShareCard } from "@/components/ShareCard";
import { OneTimeHint } from "@/components/OneTimeHint";

/**
 * الإحصائيات.
 *
 * التحليل الكامل يعيش هنا لا في المكتبة: من يريد أن يعرف توزيع ذوقه يأتي
 * قاصداً، ومن يريد أن يختار ما يشاهده لا يمرّ عليه في طريقه.
 */
export default async function StatsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  return (
    <div>
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة والوصف،
          وأُبقي اختصار «المكتبة» في أعلى الصفحة */}
      <div className="flex items-baseline justify-end mb-1">
        <h1 className="sr-only">{t.analysisTitle}</h1>
        <Link href="/library" className="text-xs text-accent hover:brightness-110 transition">
          {t.libraryTitle} ›
        </Link>
      </div>
      <div className="mb-4">
        <OneTimeHint id="stats-intro" text={t.hintStats} closeLabel={t.closeLabel} />
      </div>

      {/* المشاركة قبل التحليل لا بعده: التحليل طويل، ومن يريد المشاركة
          لا يجب أن يمرّ عليه كلّه ليجد الزرّ */}
      <div className="mb-5">
        <ShareCard locale={locale} />
      </div>

      <Suspense fallback={<LibraryAnalysisSkeleton />}>
        <LibraryAnalysis locale={locale} />
      </Suspense>
    </div>
  );
}
