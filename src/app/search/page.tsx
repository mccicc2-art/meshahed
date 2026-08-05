import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { searchMulti, titleOf, yearOf } from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { PosterCard } from "@/components/PosterCard";
import { PosterGrid } from "@/components/PosterGrid";
import { SearchBox } from "@/components/SearchBox";
import { Alert } from "@/components/ui/Alert";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { q = "" } = await searchParams;

  // النتائج خلف Suspense: كان طلب TMDB يحجب الصفحة كلها بما فيها صندوق
  // البحث نفسه — فيختفي الصندوق الذي كتب المستخدم فيه للتو طوال الاستعلام.
  // الآن الصندوق يرسم فوراً والنتائج تلحق بهيكل شبكة.
  return (
    <div>
      <div className="max-w-xl mx-auto mb-8">
        <Suspense fallback={null}>
          <SearchBox big locale={locale} />
        </Suspense>
      </div>

      <Suspense
        key={q}
        fallback={
          q ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="skeleton aspect-[2/3] rounded-poster border border-border" />
              ))}
            </div>
          ) : null
        }
      >
        <SearchResults q={q} t={t} />
      </Suspense>
    </div>
  );
}

/** نتائج البحث — تجلب بياناتها بنفسها فلا تحجب رسم الصندوق */
async function SearchResults({ q, t }: { q: string; t: Awaited<ReturnType<typeof getT>>["t"] }) {
  let results: Awaited<ReturnType<typeof searchMulti>> = [];
  let failed = false;
  if (q) {
    try {
      results = await searchMulti(q);
    } catch {
      failed = true;
    }
  }

  return (
    <>
      {failed && (
        <Alert center className="mb-4">
          {t.searchFailed}
        </Alert>
      )}

      {q && !failed && (
        <p className="text-muted text-sm mb-4">{t.searchResultsFor(q, results.length)}</p>
      )}

      {results.length > 0 ? (
        <PosterGrid>
          {results.map((r) => (
            <PosterCard
              key={`${r.media_type}-${r.id}`}
              href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`}
              title={titleOf(r)}
              posterPath={r.poster_path}
              year={yearOf(r)}
              badge={r.media_type === "tv" ? t.typeSeries : t.typeMovie}
            />
          ))}
        </PosterGrid>
      ) : q ? (
        <p className="text-center text-muted py-16">{t.searchNoResults}</p>
      ) : (
        <p className="text-center text-muted py-16">{t.searchStart}</p>
      )}
    </>
  );
}
