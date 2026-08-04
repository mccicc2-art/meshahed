import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/media";
import { Icon } from "./Icon";

/**
 * بطاقة «أكمل المشاهدة».
 *
 * الملصق ثم الاسم ثم شريط التقدّم ونسبته — الشريط تحت الاسم لا فوق
 * الملصق: فوق الملصق يختفي على صورة داكنة، وتحت الاسم يقرأه المستخدم
 * مع الاسم في حركة عين واحدة.
 *
 * حلّت محلّ بطاقة الحلقة التالية العريضة: تلك تعرض عملاً واحداً وتأخذ
 * ثلث الشاشة، وهذه تعرض كل ما أنت في وسطه في صفٍّ واحد.
 */
export function ContinueCard({
  href,
  title,
  posterPath,
  progress,
}: {
  href: string;
  title: string;
  posterPath: string | null;
  /** ٠–١٠٠ */
  progress: number;
}) {
  const url = posterUrl(posterPath, "w342");
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
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
          <span className="absolute inset-0 grid place-items-center text-muted">
            <Icon name="film" size={22} />
          </span>
        )}
      </div>

      <p className="mt-2 text-[13px] font-medium leading-tight line-clamp-2 group-hover:text-accent transition">
        {title}
      </p>

      <div className="mt-1.5 flex items-center gap-2">
        <span className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, var(--brand-3), var(--accent-2))",
            }}
          />
        </span>
        <span className="text-[11px] text-muted tabular-nums shrink-0">
          <span dir="ltr">{pct}%</span>
        </span>
      </div>
    </Link>
  );
}
