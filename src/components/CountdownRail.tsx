import Link from "next/link";
import Image from "next/image";
import { getDict, type Locale } from "@/lib/i18n";
import { daysUntil } from "@/lib/when";

export interface CountdownItem {
  key: string;
  href: string;
  title: string;
  poster: string | null;
  date: string;
  badge?: string;
}

/**
 * صفّ «قادم قريباً» بعدّ تنازلي.
 *
 * الرقم هو المعلومة، لا التاريخ: «بعد ٣ أيام» يُفهم فوراً، و«٢٠ أغسطس»
 * يحتاج من القارئ أن يحسب. والعدّ تحت البطاقة لا فوقها حتى لا يحجب الملصق،
 * وبلون دافئ كلما اقترب الموعد.
 */
export function CountdownRail({
  title,
  items,
  locale,
}: {
  title: string;
  items: CountdownItem[];
  locale: Locale;
}) {
  const t = getDict(locale);
  if (!items.length) return null;

  return (
    <section>
      <h2 className="text-base font-bold mb-3">{title}</h2>

      <div className="-mx-4 px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 w-max pb-1">
          {items.map((item) => {
            const days = daysUntil(item.date);
            const soon = days !== null && days <= 7;
            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch={false}
                className="group w-[112px] sm:w-[132px] shrink-0"
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-2 border border-border">
                  {item.poster ? (
                    <Image
                      src={item.poster}
                      alt={item.title}
                      fill
                      sizes="132px"
                      className="object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-2xl">🎬</div>
                  )}
                  {item.badge && (
                    <span className="absolute top-1.5 end-1.5 text-[10px] font-bold text-white bg-black/60 backdrop-blur rounded-md px-1.5 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </div>

                <p className="text-xs font-medium leading-tight line-clamp-1 mt-1.5 group-hover:text-accent transition">
                  {item.title}
                </p>

                <p
                  className={`text-[11px] font-bold mt-0.5 ${soon ? "text-accent" : "text-muted"}`}
                >
                  {days === null
                    ? ""
                    : days < 0
                      ? t.whenAiring
                      : days === 0
                        ? t.whenToday
                        : days === 1
                          ? t.whenTomorrow
                          : t.countdownDays(days)}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
