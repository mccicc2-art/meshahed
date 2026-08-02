import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/media";

export function PosterCard({
  href,
  title,
  posterPath,
  year,
  badge,
  progress,
  note,
}: {
  href: string;
  title: string;
  posterPath: string | null;
  year?: string;
  badge?: string;
  progress?: number; // 0..100
  note?: string;
}) {
  const url = posterUrl(posterPath, "w342");
  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-2 border border-border">
        {url ? (
          <Image
            src={url}
            alt={title}
            fill
            sizes="(max-width: 640px) 33vw, 160px"
            className="object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted text-3xl">🎬</div>
        )}
        {badge && (
          <span className="absolute top-2 right-2 text-[11px] font-semibold bg-black/70 text-accent px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
        {typeof progress === "number" && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
            <div
              className="h-full bg-accent-2"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-accent transition">
          {title}
        </p>
        {year && <p className="text-xs text-muted mt-0.5">{year}</p>}
        {note && <p className="text-[11px] text-accent-2/80 mt-0.5 line-clamp-2">{note}</p>}
      </div>
    </Link>
  );
}
