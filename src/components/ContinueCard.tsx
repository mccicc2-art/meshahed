import Link from "next/link";
import Image from "next/image";
import { posterUrl, backdropUrl } from "@/lib/media";
import { Icon } from "./Icon";

/**
 * بطاقة «أكمل المشاهدة».
 *
 * بطاقة عريضة بصورة المشهد لا بالملصق: القسم يجيب عن «أين توقّفت»، وصورة
 * المشهد تعيدك إلى الحلقة أسرع من غلافٍ دعائي. وكل ما تحتاجه فوق الصورة —
 * النسبة في زاويةٍ، والاسم ورقم الحلقة في أسفلها، والشريط على الحافّة —
 * فالبطاقة مستطيلٌ واحد لا صورةٌ وسطران تحتها.
 *
 * وإن غاب المشهد رجعت إلى الملصق: أفضل من فراغ.
 */
export function ContinueCard({
  href,
  title,
  backdropPath,
  posterPath,
  progress,
  episodeLabel,
}: {
  href: string;
  title: string;
  backdropPath: string | null;
  posterPath: string | null;
  /** ٠–١٠٠ */
  progress: number;
  /** مثل S2 E15 — يُحذف السطر إن لم يُعرف */
  episodeLabel?: string | null;
}) {
  const url = backdropPath
    ? backdropUrl(backdropPath, "w780")
    : posterUrl(posterPath, "w342");
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <Link href={href} prefetch={false} className="group block">
      <div className="relative aspect-[16/10] rounded-[18px] overflow-hidden bg-surface border border-border">
        {url ? (
          <Image
            src={url}
            alt={title}
            fill
            sizes="(max-width: 640px) 70vw, 320px"
            className="object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-muted">
            <Icon name="film" size={26} />
          </span>
        )}

        {/* حجاب سفليّ يحمل النصّ: يبقي الصورة مرئية ويضمن قراءة الاسم */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/20" />

        <span className="absolute top-2.5 start-2.5 rounded-full bg-accent px-2.5 py-1 text-[12px] font-bold text-[color:var(--on-accent)]">
          <span dir="ltr">{pct}%</span>
        </span>

        <div className="absolute inset-x-0 bottom-0 p-3 pb-3.5 flex items-end justify-between gap-2">
          <p className="text-[15px] font-bold leading-tight text-white line-clamp-2 drop-shadow">
            {title}
          </p>
          {episodeLabel && (
            <span className="shrink-0 text-[12px] font-semibold text-white/70">
              <span dir="ltr">{episodeLabel}</span>
            </span>
          )}
        </div>

        {/* شريط التقدّم على حافّة البطاقة نفسها */}
        <span className="absolute inset-x-0 bottom-0 h-1 bg-[color:var(--divider)]">
          <span
            className="block h-full"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, var(--brand-3) 0%, var(--accent-2) 55%, var(--accent) 100%)",
            }}
          />
        </span>
      </div>
    </Link>
  );
}
