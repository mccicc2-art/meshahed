import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { searchMulti, titleOf, yearOf } from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { PosterCard } from "@/components/PosterCard";
import { PosterGrid } from "@/components/PosterGrid";
import { SearchBox } from "@/components/SearchBox";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { q = "" } = await searchParams;

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
    <div>
      <div className="max-w-xl mx-auto mb-8">
        <Suspense fallback={null}>
          <SearchBox big locale={locale} />
        </Suspense>
      </div>

      {failed && (
        <p className="text-center text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3 mb-4">
          {t.searchFailed}
        </p>
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
    </div>
  );
}
