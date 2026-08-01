import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { searchMulti, titleOf, yearOf } from "@/lib/tmdb";
import { PosterCard } from "@/components/PosterCard";
import { SearchBox } from "@/components/SearchBox";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { q = "" } = await searchParams;
  const results = q ? await searchMulti(q) : [];

  return (
    <div>
      <div className="max-w-xl mx-auto mb-8">
        <SearchBox big />
      </div>

      {q && (
        <p className="text-muted text-sm mb-4">
          نتائج البحث عن &laquo;{q}&raquo; — {results.length} نتيجة
        </p>
      )}

      {results.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {results.map((r) => (
            <PosterCard
              key={`${r.media_type}-${r.id}`}
              href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`}
              title={titleOf(r)}
              posterPath={r.poster_path}
              year={yearOf(r)}
              badge={r.media_type === "tv" ? "مسلسل" : "فيلم"}
            />
          ))}
        </div>
      ) : q ? (
        <p className="text-center text-muted py-16">لا توجد نتائج.</p>
      ) : (
        <p className="text-center text-muted py-16">ابحث عن مسلسل أو فيلم للبدء.</p>
      )}
    </div>
  );
}
