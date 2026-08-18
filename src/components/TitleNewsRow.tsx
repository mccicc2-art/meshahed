import Link from "next/link";
import { newsLine, newsSource } from "@/lib/newsLine";
import type { LoopzNewsItem } from "@/lib/data";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { Icon } from "./Icon";

/**
 * **صفُّ نشرةِ Loopz داخل خطّ المجتمع** (D-398).
 *
 * **وهو جسدُ `TitleNewsTab` نفسُه** الذي كان تبويباً مستقلاً (D-300) —
 * **لم يتغيّر منه حرفٌ في الشكل**، وإنما فقد قائمتَه: الأخبارُ صارت
 * رقاقةً في قائمةٍ واحدةٍ مع الآراء والنقاش، **فمن يملك القائمة هو
 * الخطُّ لا الخبر** (نفسُ حجّة انتزاع `TalkReviewRow`).
 *
 * ⚠️ **ولا ملصقَ في الصفّ**: نحن **داخل** صفحة العمل وصورتُه في ترويستها
 * فوق (D-223/D-257).
 *
 * **والوجهُ مكانَه ختمٌ**: صفوفُ الخطّ الأخرى تبدأ بوجهِ قائلها، **وللخبر
 * قائلٌ أيضاً — نحن** (D-213)، فرمزُ النشرة يجلس حيث يجلس الوجه ليبقى
 * إيقاعُ العمود واحداً.
 */
export function TitleNewsRow({ n, locale }: { n: LoopzNewsItem; locale: Locale }) {
  const t = getDict(locale);
  const line = newsLine(n, t, locale);
  /* **ونشرةٌ بلا صيغةٍ تسقط هنا لا في الرسم** — نفسُ حارس `ActivityFeed`
     و`/post` حرفاً (D-179: القراءةُ متسامحة). */
  if (!line) return null;
  const src = newsSource(n);

  return (
    <article className="py-4 first:pt-0 flex gap-3">
      <span
        aria-hidden
        className="shrink-0 size-11 rounded-full bg-accent/12 border border-accent/25 flex items-center justify-center"
      >
        <Icon name="newspaper" size={18} className="text-accent" />
      </span>

      <div className="min-w-0 flex-1">
        <Link href={`/post/${encodeURIComponent(n.key)}`} prefetch={false} className="block group">
          <p className="text-[14px] leading-relaxed font-semibold group-hover:text-accent transition">
            {line}
          </p>
          <p className="mt-1 flex items-center gap-2 text-[12px] text-muted">
            <span>{timeAgo(n.published_at, t)}</span>
            {src && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{t.newsPerSource(src.name)}</span>
              </>
            )}
          </p>
        </Link>
      </div>
    </article>
  );
}
