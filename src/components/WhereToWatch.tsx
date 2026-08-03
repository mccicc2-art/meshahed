import Image from "next/image";
import { IMG } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import type { Provider, WatchOptions } from "@/lib/tmdb";

const REGION_NAMES: Record<string, { ar: string; en: string }> = {
  SA: { ar: "السعودية", en: "Saudi Arabia" },
  AE: { ar: "الإمارات", en: "UAE" },
  EG: { ar: "مصر", en: "Egypt" },
  US: { ar: "أمريكا", en: "United States" },
};

function Row({
  label,
  providers,
  link,
}: {
  label: string;
  providers: Provider[];
  link: string | null;
}) {
  if (!providers.length) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-muted w-14 shrink-0">{label}</span>
      <div className="flex gap-2 flex-wrap">
        {providers.map((p) => {
          const logo = p.logo_path ? `${IMG}/w92${p.logo_path}` : null;
          const chip = (
            <span className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-2 py-1.5 hover:border-accent/50 transition">
              {logo && (
                <Image
                  src={logo}
                  alt=""
                  width={24}
                  height={24}
                  className="rounded-md shrink-0"
                />
              )}
              <span className="text-xs font-medium">{p.provider_name}</span>
            </span>
          );
          return link ? (
            <a
              key={p.provider_id}
              href={link}
              target="_blank"
              rel="noopener noreferrer nofollow"
              title={p.provider_name}
            >
              {chip}
            </a>
          ) : (
            <span key={p.provider_id}>{chip}</span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * أين تقدر تشاهد العمل.
 *
 * البيانات من JustWatch عبر TMDB، وشرط استخدامها إظهار مصدرها ورابطها —
 * فالرابط مثبّت أسفل القسم لا اختياري. والمنطقة تُذكر صراحةً لأن التوفّر
 * يختلف بين السعودية وغيرها، وعرض «متاح» بلا تحديد بلد وعدٌ لا يُوفى.
 */
export function WhereToWatch({
  region,
  options,
  locale,
}: {
  region: string;
  options: WatchOptions;
  locale: Locale;
}) {
  const t = getDict(locale);
  const regionName =
    REGION_NAMES[region]?.[locale === "en" ? "en" : "ar"] ?? region;

  return (
    <section aria-labelledby="watch-heading">
      <div className="flex items-baseline gap-2 mb-1">
        <h2 id="watch-heading" className="flex items-center gap-2 text-base font-bold">
          <Icon name="tv" size={18} className="text-muted" />
          {t.whereToWatch}
        </h2>
        <span className="text-[11px] text-muted">{t.watchRegion(regionName)}</span>
      </div>
      <p className="text-xs text-muted mb-4">{t.watchHint}</p>

      <div className="flex flex-col gap-3 bg-surface border border-border rounded-2xl p-4">
        <Row label={t.watchFree} providers={options.free} link={options.link} />
        <Row label={t.watchStream} providers={options.flatrate} link={options.link} />
        <Row label={t.watchRent} providers={options.rent} link={options.link} />
        <Row label={t.watchBuy} providers={options.buy} link={options.link} />

        {options.link && (
          <a
            href={options.link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-[11px] text-muted hover:text-accent transition mt-1"
          >
            {t.watchSource} ↗
          </a>
        )}
      </div>
    </section>
  );
}
