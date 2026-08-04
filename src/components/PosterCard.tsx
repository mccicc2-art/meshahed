import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/media";
import { Icon } from "./Icon";

type BadgeTone = "neutral" | "progress" | "watched" | "rating" | "dropped";

/** لون الشارة يحمل معناها: لا يحتاج القارئ أن يقرأ ليعرف نوعها */
const BADGE_BG: Record<BadgeTone, string> = {
  neutral: "rgba(0,0,0,0.75)",
  progress: "var(--accent)",
  watched: "var(--brand-3)",
  rating: "var(--verified)",
  dropped: "var(--error)",
};

export function PosterCard({
  href,
  title,
  posterPath,
  year,
  badge,
  count,
  progress,
  note,
  tone = "default",
  badgeTone = "neutral",
  dropped = false,
}: {
  href: string;
  title: string;
  posterPath: string | null;
  year?: string;
  badge?: string;
  /** رقمٌ في دائرة على الزاوية المقابلة — ما بقي من الحلقات */
  count?: number;
  progress?: number; // 0..100
  note?: string;
  /** waiting = حلقة جديدة تنتظرك (ذهبي) بدل الأخضر المعتاد */
  tone?: "default" | "waiting";
  /** لون الشارة: التقدّم بنفسجي، المُشاهَد برتقالي، التقييم أصفر */
  badgeTone?: BadgeTone;
  /** موقوف ببطاقة حمراء: الشريط كله أحمر مهما كان التقدّم */
  dropped?: boolean;
}) {
  const url = posterUrl(posterPath, "w342");
  return (
    // prefetch={false}: الصفحة الواحدة فيها عشرات البطاقات، والتحميل المسبق
    // الافتراضي يطلق طلب RSC لكل بطاقة تدخل الشاشة — عشرات الطلبات المتزامنة
    // كانت ترجع 503 وتُبطئ التنقّل الفعلي. الرابط يُحمَّل عند النقر.
    <Link href={href} prefetch={false} className="group block">
      <div className="relative aspect-[2/3] rounded-[18px] overflow-hidden bg-surface border border-border">
        {url ? (
          <Image
            src={url}
            alt={title}
            fill
            sizes="(max-width: 640px) 33vw, 160px"
            className="object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted">
            <Icon name="film" size={26} />
          </div>
        )}
        {badge && (
          <span
            className="absolute top-2 start-2 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
            style={{ background: BADGE_BG[badgeTone] }}
          >
            {badge}
          </span>
        )}
        {typeof count === "number" && count > 0 && (
          <span className="absolute top-2 end-2 grid place-items-center min-w-6 h-6 px-1.5 rounded-full bg-accent text-[color:var(--on-accent)] text-[11px] font-bold tabular-nums">
            {count}
          </span>
        )}
        {/* الاسم داخل الملصق على حجابٍ متدرّج: البطاقة مستطيلٌ واحد،
            والعين تقرأ الصورة والاسم في حركةٍ واحدة */}
        <div className="absolute inset-x-0 bottom-0 p-2 pt-7 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <p className="text-[12px] font-semibold leading-tight text-white line-clamp-2 drop-shadow">
            {title}
          </p>
          {year && <p className="text-[10px] text-white/60 mt-0.5">{year}</p>}
          {note && (
            <p className="text-[10px] text-accent-2/90 mt-0.5 line-clamp-1">
              {note}
            </p>
          )}
        </div>

        {(typeof progress === "number" || dropped) && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
            {/* المكتمل أخضر — لون الإنجاز الدلاليّ الثابت — وغير المكتمل
                يتدرّج كتدرّج المستوى: كهرمانيّ فورديّ فبنفسجي */}
            <div
              className="h-full"
              style={{
                width: dropped
                  ? "100%"
                  : `${Math.max(0, Math.min(100, progress ?? 0))}%`,
                background: dropped
                  ? "var(--error)"
                  : (progress ?? 0) >= 100
                    ? "var(--success)"
                    : tone === "waiting"
                      ? "var(--accent)"
                      : "linear-gradient(90deg, var(--brand-3) 0%, var(--accent-2) 55%, var(--accent) 100%)",
              }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}
