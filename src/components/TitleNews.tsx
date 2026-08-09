import Link from "next/link";
import Image from "next/image";
import { Icon } from "./Icon";
import { posterUrl } from "@/lib/media";
import { timeAgo, whenLabel } from "@/lib/when";
import { getDict, type Locale } from "@/lib/i18n";
import type { NewsItem, NewsKind } from "@/lib/titleNews";

/**
 * «أخبار أعمالك» — قائمة التبويب الرابع في المجتمع.
 *
 * **هندسةُ صفّ النشاط نفسها حرفاً بحرف**: نصٌّ يميناً وصورةٌ ٱفقية
 * يساراً، بنفس المقاسات والفواصل. الاختلاف الوحيد أن مكان اسم الشخص
 * وصورته يحلّ نوعُ الخبر — فالخبر لا فاعل له. لغةٌ بصرية ثانية لصفحةٍ
 * واحدة كانت ستُقرأ سطحاً آخر لا تبويباً.
 */
export function TitleNews({ items, locale }: { items: NewsItem[]; locale: Locale }) {
  const t = getDict(locale);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
        {t.titleNewsEmpty}
      </p>
    );
  }

  const label = (n: NewsItem): string => {
    const byKind: Record<NewsKind, string> = {
      tonight: t.newsTonight,
      soon: t.newsSoon,
      aired: t.newsAired,
      released: t.newsReleased,
      upcoming: t.newsUpcoming,
      artist: n.person ? t.newsArtist(n.person) : t.newsArtistAnon,
    };
    return byKind[n.kind];
  };

  /* الماضي «قبل يومين» والمستقبل «بعد أسبوع» — دالّتان قائمتان
     (`timeAgo` من D-136 و`whenLabel` من قبله)، لا صيغة ثالثة. والفرز
     بينهما جاء محسوماً من الخادم (`future`): قراءة الساعة هنا تكسر
     نقاء الرسم. */
  const when = (n: NewsItem) => (n.future ? whenLabel(n.date, t) : timeAgo(n.date, t));

  return (
    <section>
      <p className="text-xs text-muted leading-relaxed mb-3">{t.newsHint}</p>

      <div className="divide-y divide-[color:var(--divider)]">
        {items.map((n) => (
          <article key={n.key} className="py-4 first:pt-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-accent">{label(n)}</p>
                <p className="mt-1 text-[13px] text-muted">{when(n)}</p>
                <p className="mt-2 text-[15px] leading-snug font-semibold">{n.title}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {n.mediaType === "tv" ? t.typeSeries : t.typeMovie}
                </p>
              </div>

              <Link
                href={`/${n.mediaType === "tv" ? "show" : "movie"}/${n.tmdbId}`}
                prefetch={false}
                className="shrink-0 w-20 sm:w-24 group"
              >
                <span className="relative block w-full aspect-[2/3] rounded-lg overflow-hidden bg-surface-2">
                  {n.posterPath ? (
                    <Image
                      src={posterUrl(n.posterPath, "w185") ?? ""}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 80px, 96px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
                      <Icon name="film" size={16} />
                    </span>
                  )}
                </span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
