import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/media";
import { Icon } from "./Icon";

/**
 * بطاقة «أكمل المشاهدة».
 *
 * الاسم وشريط التقدّم ونسبته كلها داخل الملصق، على حجابٍ متدرّج في
 * أسفله: البطاقة صارت مستطيلاً واحداً لا ملصقاً وسطرين تحته، فالصفّ
 * يعرض أعمالاً أكثر في الارتفاع نفسه، والاسم والنسبة يُقرآن مع الصورة
 * في حركة عين واحدة.
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

        {/* حجابٌ متدرّج يحمل الاسم والنسبة: الملصق نفسه هو البطاقة، فلا
            يحتاج سطراً تحته. والتدرّج لا اللون المصمت — يبقي أسفل الصورة
            مرئياً ويضمن أن يُقرأ النصّ على ملصقٍ فاتح */}
        <div className="absolute inset-x-0 bottom-0 p-2 pt-8 bg-gradient-to-t from-black/90 via-black/65 to-transparent">
          <p className="text-[11px] font-semibold leading-tight text-white line-clamp-2 drop-shadow">
            {title}
          </p>

          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, var(--brand-3), var(--accent-2))",
                }}
              />
            </span>
            <span className="text-[10px] font-bold text-white/85 tabular-nums shrink-0">
              <span dir="ltr">{pct}%</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
