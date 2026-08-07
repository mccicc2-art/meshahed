import Image from "next/image";
import { IMG } from "@/lib/media";
import { regionName } from "@/lib/region";
import type { Locale } from "@/lib/i18n";
import type { WatchOptions } from "@/lib/tmdb";

/**
 * شارة «أين يُبثّ» في ترويسة صفحة العمل.
 *
 * قسم المنصّات الكامل حُذف من تبويب «معلومات»: سؤال «وين أشاهده؟» يُجاب
 * في الترويسة بمنصّةٍ واحدة — الأهم بالترتيب: بثّ فمجاني فتأجير فشراء —
 * والضغط يفتح صفحة JustWatch بكل الخيارات إن أراد المزيد.
 *
 * **والشارة تسمّي البلد حين لا يكون بلد المستخدم.** التوفّر يختلف بين
 * البلدان اختلافاً جوهرياً، وكان التطبيق يجرّب السعودية ثم الإمارات ثم مصر
 * ثم أمريكا ويعرض أوّل ما وجد بلا كلمة — فيرى المشاهد في المغرب منصّةً لا
 * يستطيع فتحها ويظنّها متاحةً له. السقوط بقي (صفحةٌ تقول «غير متاح» عن
 * عملٍ متاحٍ في الجوار أسوأ)، لكنه صار مُعلَناً.
 */
export function WatchChip({
  options,
  region,
  userRegion,
  locale,
}: {
  options: WatchOptions;
  /** البلد الذي جاءت منه هذه البيانات فعلاً */
  region: string;
  /** بلد المستخدم المختار */
  userRegion: string;
  locale: Locale;
}) {
  const p =
    options.flatrate[0] ?? options.free[0] ?? options.rent[0] ?? options.buy[0] ?? null;
  if (!p) return null;

  const logo = p.logo_path ? `${IMG}/w92${p.logo_path}` : null;
  const elsewhere = region !== userRegion;
  const inner = (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/90 bg-surface-2 border border-border px-2 py-1 rounded-lg hover:border-accent/50 transition">
      {logo && (
        <Image src={logo} alt="" width={18} height={18} className="rounded-[5px] shrink-0" />
      )}
      {p.provider_name}
      {elsewhere && (
        <span className="text-muted font-normal">
          · {regionName(region, locale === "en" ? "en" : "ar")}
        </span>
      )}
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
