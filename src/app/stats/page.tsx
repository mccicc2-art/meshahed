import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { LibraryAnalysis, LibraryAnalysisSkeleton } from "@/components/LibraryAnalysis";

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
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold">{t.analysisTitle}</h1>
        <Link href="/library" className="text-xs text-accent hover:brightness-110 transition">
          {t.libraryTitle} ›
        </Link>
      </div>
      <p className="text-xs text-muted mb-5">{t.analysisSub}</p>

      <Suspense fallback={<LibraryAnalysisSkeleton />}>
        <LibraryAnalysis locale={locale} />
      </Suspense>
    </div>
  );
}
