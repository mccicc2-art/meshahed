import Link from "next/link";
import Image from "next/image";
import { Icon } from "./Icon";
import { posterUrl } from "@/lib/media";
import { timeAgo } from "@/lib/when";
import { getDict, type Locale } from "@/lib/i18n";
import type { LoopzNewsItem } from "@/lib/data";

/**
 * «آخر الأخبار» — **أخبارُنا نحن** (D-211).
 *
 * **الجملةُ تُركَّب هنا من حقائقَ في القاعدة**، لا تُقرأ نصّاً مخزَّناً:
 * فالخبرُ الواحد يُقرأ بالعربية والإنجليزية بلا عمودٍ ثانٍ ولا ترجمة،
 * **ومن بدّل لغته وجد الخبرَ نفسَه بلغته**. وتصحيحُ صياغةٍ يقع في
 * `i18n.ts` وحده لا في ثلاثمئة صفّ.
 *
 * **ولا رابطَ خارجيّ في البطاقة إطلاقاً** (طلبُ أحمد الصريح): الضغطُ
 * يفتح صفحةَ العمل عندنا، و«ناقشه» تفتح صفحةَ الكلام — **والقراءةُ
 * والتعليقُ كلاهما داخل التطبيق.**
 *
 * **وهندستُه هي هندسةُ `TitleNews` نفسها** — نصٌّ يميناً وملصقٌ صغير
 * يساراً. لغةٌ بصرية ثانية في تبويبٍ واحد كانت ستُقرأ سطحين لا سطحاً.
 */
export function LoopzNews({ items, locale }: { items: LoopzNewsItem[]; locale: Locale }) {
  const t = getDict(locale);

  /* الأرقامُ لاتينيةٌ في اللغتين (D-015)، فالتقويمُ يُطلب بـ`nu-latn` */
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const showDate = (iso: unknown) => {
    const s = String(iso ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const [y, m, d] = s.split("-").map(Number);
    return fmt.format(new Date(Date.UTC(y, m - 1, d)));
  };

  /** الجملة — **وما لا يعرفه القالبُ لا يُعرض**: خبرٌ بلا صيغةٍ صمتٌ لا خطأ */
  const line = (n: LoopzNewsItem): string | null => {
    const d = (n.data ?? {}) as Record<string, string | number>;
    switch (n.kind) {
      case "trailer":
        return t.newsTrailerOut(n.title);
      case "date":
        return d.from
          ? t.newsDateMoved(n.title, showDate(d.to))
          : t.newsDateSet(n.title, showDate(d.to));
      case "season":
        return t.newsSeasonUp(n.title, Number(d.season) || 0);
      case "status":
        return d.status === "Ended"
          ? t.newsEnded(n.title)
          : d.status === "Canceled"
            ? t.newsCanceled(n.title)
            : t.newsReturning(n.title);
      case "season_date":
        return t.newsSeasonDate(n.title, Number(d.season) || 0, showDate(d.date));
      case "theatrical":
        return t.newsTheatrical(n.title, showDate(d.date));
      case "released":
        return t.newsOutNow(n.title);
      default:
        return null;
    }
  };

  if (items.length === 0) {
    return (
      <section>
        <h2 className="text-[15px] font-bold mb-2">{t.newsGenTitle}</h2>
        <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
          {t.newsGenEmpty}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-[15px] font-bold">{t.newsGenTitle}</h2>
      <p className="text-xs text-muted leading-relaxed mt-1 mb-3">{t.newsGenHint}</p>

      <div className="divide-y divide-[color:var(--divider)]">
        {items.map((n) => {
          const text = line(n);
          if (!text) return null;
          const href = `/${n.media_type === "tv" ? "show" : "movie"}/${n.tmdb_id}`;
          const src = posterUrl(n.poster_path, "w185");
          return (
            <article key={n.key} className="py-3 first:pt-0">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={href}
                    prefetch={false}
                    className="block text-[15px] leading-snug font-semibold hover:text-accent transition"
                  >
                    {text}
                  </Link>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
                    <span>{timeAgo(n.published_at, t)}</span>
                    <span aria-hidden>·</span>
                    <span>{n.media_type === "tv" ? t.typeSeries : t.typeMovie}</span>
                    {/* التعليقُ داخل التطبيق — بابُ الكلام القائم (D-193)،
                        ولا خيطَ نقاشٍ ثالث تحت كل خبر */}
                    <Link
                      href={`/talk/${n.media_type}/${n.tmdb_id}`}
                      prefetch={false}
                      className="ms-auto inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-semibold hover:text-accent hover:border-accent transition"
                    >
                      <Icon name="comment" size={12} />
                      {t.newsDiscuss}
                    </Link>
                  </div>
                </div>

                <Link href={href} prefetch={false} className="shrink-0 w-14 sm:w-16">
                  <span className="relative block w-full aspect-[2/3] rounded-lg overflow-hidden bg-surface-2">
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 56px, 64px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-muted">
                        <Icon name="image" size={14} />
                      </span>
                    )}
                  </span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
