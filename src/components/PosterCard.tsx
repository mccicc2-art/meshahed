import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/media";
import { Icon } from "./Icon";

export function PosterCard({
  href,
  title,
  posterPath,
  year,
  badge,
  progress,
  note,
  tone = "default",
}: {
  href: string;
  title: string;
  posterPath: string | null;
  year?: string;
  badge?: string;
  progress?: number; // 0..100
  note?: string;
  /** waiting = حلقة جديدة تنتظرك (ذهبي) بدل الأخضر المعتاد */
  tone?: "default" | "waiting";
}) {
  const url = posterUrl(posterPath, "w342");
  return (
    // prefetch={false}: الصفحة الواحدة فيها عشرات البطاقات، والتحميل المسبق
    // الافتراضي يطلق طلب RSC لكل بطاقة تدخل الشاشة — عشرات الطلبات المتزامنة
    // كانت ترجع 503 وتُبطئ التنقّل الفعلي. الرابط يُحمَّل عند النقر.
    <Link href={href} prefetch={false} className="group block">
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
          <div className="w-full h-full grid place-items-center text-muted"><Icon name="film" size={26} /></div>
        )}
        {badge && (
          <span
            className="absolute top-2 start-2 text-[11px] font-semibold bg-black/75 px-2 py-0.5 rounded-full text-accent"
          >
            {badge}
          </span>
        )}
        {typeof progress === "number" && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
            {/* شريط التقدّم بلون الهوية الثالث (الكهرماني): هو لون التقدّم
                في الهوية، ويفصله بصرياً عن الأزرار البنفسجية والوردية */}
            <div
              className="h-full"
              style={{
                width: `${Math.max(0, Math.min(100, progress))}%`,
                background: tone === "waiting" ? "var(--accent)" : "var(--brand-3)",
              }}
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
