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
          <article key={n.key} className="py-3 first:pt-0">
            {/* **الصفّ محاذٍ رأسياً لا مبدوءٌ من الأعلى، والملصق صغير:**
                نصُّ الخبر ثلاثة أسطر قصيرة، وملصقٌ ٢:٣ بعرض ٩٦ بكسلاً
                يجعله ضعف ارتفاع نصّه — فتُقرأ القائمة فراغاتٍ متتابعة لا
                أخباراً. صفُّ النشاط لا يعاني هذا لأن صورته ١٦:٩. */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-12 font-semibold text-accent">{label(n)}</p>
                <p className="mt-1.5 text-15 leading-snug font-semibold">{n.title}</p>
                <p className="mt-1 text-12 text-muted">
                  {when(n)} · {n.mediaType === "tv" ? t.typeSeries : t.typeMovie}
                </p>
              </div>

              <Link
                href={`/${n.mediaType === "tv" ? "show" : "movie"}/${n.tmdbId}`}
                prefetch={false}
                className="shrink-0 w-14 sm:w-16 group"
              >
                <span className="relative block w-full aspect-[2/3] rounded-lg overflow-hidden bg-surface-2">
                  {n.posterPath ? (
                    <Image
                      src={posterUrl(n.posterPath, "w185") ?? ""}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 56px, 64px"
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
