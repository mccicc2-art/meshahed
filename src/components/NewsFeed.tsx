import Link from "next/link";
import { Icon } from "./Icon";
import { timeAgo } from "@/lib/when";
import { getDict, type Locale } from "@/lib/i18n";
import { NEWS_SOURCES, decodeEntities } from "@/lib/news";
import type { NewsFeedItem } from "@/lib/data";

/**
 * «آخر الأخبار» — العناوينُ الحقيقية (D-209).
 *
 * **مكوّنُ خادمٍ بلا جافاسكربت واحدة:** القائمةُ نصٌّ وروابط، ولا حالةَ
 * فيها — فكلُّ بايتٍ يُرسل للمتصفّح هنا خسارةٌ صافية.
 *
 * **وهندستُه هي هندسةُ `TitleNews` نفسها** (الصفُّ في التبويب ذاته):
 * فاصلٌ رفيع بين الصفوف، سطرُ عنوانٍ ثم سطرُ نسبةٍ خافت. **لغةٌ بصرية
 * ثانية في تبويبٍ واحد كانت ستُقرأ سطحين لا سطحاً.**
 *
 * **ولا صورةَ في البطاقة:** صورُ الفيد تحجبها سياسةُ المحتوى عندنا
 * (`img-src`: TMDB وجوجل وسوبابيس)، **وفتحُ نطاقٍ لكل ناشرٍ ثمنٌ أمنيّ
 * لزينة**. والعنوانُ هو الخبر.
 *
 * **و«ناقشه» لا تظهر إلا لخبرٍ ثُبِّت بمعرّف TMDB** (D-144): زرٌّ يفتح
 * نقاشاً عن عملٍ لا نعرفه هو وعدٌ كاذب.
 */
export function NewsFeed({ items, locale }: { items: NewsFeedItem[]; locale: Locale }) {
  const t = getDict(locale);

  if (items.length === 0) {
    return (
      <section>
        <h2 className="text-[15px] font-bold mb-2">{t.newsRealTitle}</h2>
        <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
          {t.newsRealEmpty}
        </p>
      </section>
    );
  }

  /* اسمُ المصدر: ما جاء في الفيد أوّلاً (جوجل نيوز ينسب لكل ناشر)، وإلا
     فاسمُ الفيد من السجلّ — **ولا يُخترع اسم**، فمن لا نسبةَ له يُعرض
     بلا سطرِ نسبةٍ أصلاً */
  const labelOf = (n: NewsFeedItem): string | null =>
    n.source_label ?? NEWS_SOURCES.find((s) => s.slug === n.source)?.label ?? null;

  return (
    <section>
      <h2 className="text-[15px] font-bold">{t.newsRealTitle}</h2>
      <p className="text-xs text-muted leading-relaxed mt-1 mb-3">{t.newsRealHint}</p>

      <div className="divide-y divide-[color:var(--divider)]">
        {items.map((n) => {
          const src = labelOf(n);
          return (
            <article key={n.url} className="py-3 first:pt-0">
              {/* الرابطُ يفتح في تبويبٍ جديد: الخبرُ عند ناشره لا عندنا،
                  ومن قرأه يعود إلى مكانه في القائمة لا إلى أوّلها */}
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="block text-[15px] leading-snug font-semibold hover:text-accent transition"
              >
                {decodeEntities(n.title)}
              </a>

              {n.summary && (
                <p className="mt-1.5 text-[13px] leading-snug text-muted line-clamp-2">
                  {decodeEntities(n.summary)}
                </p>
              )}

              <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] text-muted">
                {src && <span className="truncate max-w-[45%]">{src}</span>}
                {n.published_at && (
                  <>
                    {src && <span aria-hidden>·</span>}
                    <span>{timeAgo(n.published_at, t)}</span>
                  </>
                )}
                {n.tmdb_id && n.media_type && (
                  <Link
                    href={`/talk/${n.media_type}/${n.tmdb_id}`}
                    prefetch={false}
                    className="ms-auto inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-accent hover:border-accent transition"
                  >
                    <Icon name="comment" size={12} />
                    {t.newsDiscuss}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
