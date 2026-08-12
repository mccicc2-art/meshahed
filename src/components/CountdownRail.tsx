import Link from "next/link";
import { RailScroll } from "./RailScroll";
import { Icon, type IconName } from "./Icon";
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
  icon,
  items,
  locale,
  href,
  seeAllLabel,
}: {
  title: string;
  icon?: IconName;
  items: CountdownItem[];
  locale: Locale;
  /** العنوانُ بابٌ حين توجد وجهة — نفسُ نمط `PosterRail`/`RankedRail` (D-198) */
  href?: string;
  seeAllLabel?: string;
}) {
  const t = getDict(locale);
  if (!items.length) return null;

  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-bold mb-3">
        {icon && <Icon name={icon} size={18} className="text-muted" />}
        {href ? (
          <Link href={href} className="truncate hover:text-accent transition">
            {title}
          </Link>
        ) : (
          title
        )}
        {href && seeAllLabel && (
          <Link
            href={href}
            className="ms-auto shrink-0 text-[13px] text-muted hover:text-accent transition font-normal"
          >
            {seeAllLabel}
          </Link>
        )}
      </h2>

      {/* حاوية التمرير المشتركة (`RailScroll`) لا حاويةٌ خاصّة: كان هذا
          الصفّ يكتب `overflow-x-auto` بيده فلم يكن له سهما سطح المكتب —
          وأحمد رأى ذلك قبل أن نراه («حتى السلاسل الطويلة ما فيها سهم»).
          صفٌّ يُمرَّر بلا أداة تمريرٍ ظاهرة يبدو للمستخدم صفّاً مبتوراً. */}
      <RailScroll prevLabel="السابق / Previous" nextLabel="التالي / Next">
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
                <div className="relative aspect-[2/3] rounded-poster overflow-hidden bg-surface-2 border border-border">
                  {item.poster ? (
                    <Image
                      src={item.poster}
                      alt={item.title}
                      fill
                      sizes="132px"
                      className="object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-muted"><Icon name="film" size={22} /></div>
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
      </RailScroll>
    </section>
  );
}
