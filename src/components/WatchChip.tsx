import Image from "next/image";
import { IMG } from "@/lib/media";
import type { WatchOptions } from "@/lib/tmdb";

/**
 * شارة «أين يُبثّ» في ترويسة صفحة العمل.
 *
 * قسم المنصّات الكامل حُذف من تبويب «معلومات»: سؤال «وين أشاهده؟» يُجاب
 * في الترويسة بمنصّةٍ واحدة — الأهم بالترتيب: بثّ فمجاني فتأجير فشراء —
 * والضغط يفتح صفحة JustWatch بكل الخيارات إن أراد المزيد.
 */
export function WatchChip({ options }: { options: WatchOptions }) {
  const p =
    options.flatrate[0] ?? options.free[0] ?? options.rent[0] ?? options.buy[0] ?? null;
  if (!p) return null;

  const logo = p.logo_path ? `${IMG}/w92${p.logo_path}` : null;
  const inner = (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/90 bg-surface-2 border border-border px-2 py-1 rounded-lg hover:border-accent/50 transition">
      {logo && (
        <Image src={logo} alt="" width={18} height={18} className="rounded-[5px] shrink-0" />
      )}
      {p.provider_name}
    </span>
  );

  return options.link ? (
    <a href={options.link} target="_blank" rel="noopener noreferrer nofollow" title={p.provider_name}>
      {inner}
    </a>
  ) : (
    inner
  );
}
