import Link from "next/link";
import { Icon, type IconName } from "./Icon";
import Image from "next/image";
import { posterUrl, titleOf, type SearchResult } from "@/lib/tmdb";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * صفّ أفقي مرقّم — قائمة «أفضل ١٠».
 *
 * الرقم داخل الملصق لا فوقه: خارجه كان يضيف سطراً لكل بطاقة ويطيل الصفّ.
 * وحجم البطاقة نفسه المستخدم في بقية صفوف التطبيق، حتى يبقى الإيقاع واحداً
 * مهما تنقّل المستخدم بين الشاشات.
 */
export function RankedRail({
  title,
  icon,
  items,
  locale,
  note,
  ranked = true,
}: {
  title: string;
  icon?: IconName;
  items: SearchResult[];
  locale: Locale;
  /** نصّ صغير تحت العنوان — يشرح مصدر الترتيب أو نطاقه */
  note?: string;
  /** إخفاء الأرقام: بعض الصفوف قائمة لا ترتيب */
  ranked?: boolean;
}) {
  const t = getDict(locale);
  if (!items.length) return null;

  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-bold mb-1">
        {icon && <Icon name={icon} size={18} className="text-muted" />}
        {title}
      </h2>
      <p className="text-[11px] text-muted mb-3">{note ?? t.topTenSource}</p>

      <div className="-mx-4 px-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 w-max pb-1">
          {items.map((r, i) => {
            const img = posterUrl(r.poster_path, "w342");
            const href = `/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`;
            return (
              <Link
                key={`${r.media_type}-${r.id}`}
                href={href}
                prefetch={false}
                className="group w-[112px] sm:w-[132px] shrink-0"
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-2 border border-border">
                  {img ? (
                    <Image
                      src={img}
                      alt={titleOf(r)}
                      fill
                      sizes="132px"
                      className="object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-2xl">🎬</div>
                  )}

                  {/* الرقم على تعتيم سفلي حتى يُقرأ فوق أي ملصق */}
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/90 to-transparent" />
                  {/* الاتجاه على العنصر الداخلي لا الخارجي: وضعه على الخارجي
                      يقلب معنى start/end فينتقل الرقم للطرف المعاكس */}
                  {ranked && (
                    <span
                      className={`absolute bottom-1 start-1.5 font-extrabold leading-none drop-shadow ${
                        i < 3 ? "text-accent text-3xl" : "text-white/85 text-2xl"
                      }`}
                    >
                      <span dir="ltr">{i + 1}</span>
                    </span>
                  )}

                  <span className="absolute bottom-1.5 end-1.5 text-[11px] font-bold text-white bg-black/55 backdrop-blur rounded-md px-1.5 py-0.5">
                    <span dir="ltr">★ {r.vote_average.toFixed(1)}</span>
                  </span>
                </div>

                <p className="text-xs font-medium leading-tight line-clamp-2 mt-1.5 group-hover:text-accent transition">
                  {titleOf(r)}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
