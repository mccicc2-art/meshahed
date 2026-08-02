import { PosterCard } from "./PosterCard";

export interface LibraryEntry {
  key: string;
  href: string;
  title: string;
  posterPath: string | null;
  kind: "tv" | "movie";
  badge?: string;
  progress?: number;
}

/** شبكة بطاقات مع عنوان وعدّاد — كل الأقسام ظاهرة فوق بعض بلا فلاتر */
export function MediaSection({
  title,
  count,
  hint,
  items,
  empty,
}: {
  title: string;
  count?: number;
  hint?: string;
  items: LibraryEntry[];
  empty: string;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-1">
        <h2 className="text-lg font-bold">{title}</h2>
        {typeof count === "number" && count > 0 && (
          <span className="text-xs text-muted bg-surface-2 border border-border rounded-full px-2 py-0.5" dir="ltr">
            {count}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted mb-4">{hint}</p>}
      {!hint && <div className="mb-4" />}

      {items.length === 0 ? (
        <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-6 text-center">
          {empty}
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {items.map((i) => (
            <PosterCard
              key={i.key}
              href={i.href}
              title={i.title}
              posterPath={i.posterPath}
              badge={i.badge}
              progress={i.progress}
            />
          ))}
        </div>
      )}
    </section>
  );
}
