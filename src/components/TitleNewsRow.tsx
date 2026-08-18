import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgoShort } from "@/lib/when";
import { Icon } from "./Icon";

/**
 * **صفُّ خبرٍ داخل خطّ المجتمع** (D-398، ووسِّع في D-400).
 *
 * **وهو يرسم جملةً جاهزة لا يركّبها**: مصدرا الخبر في صفحة العمل اثنان
 * وصيغتاهما مختلفتان — **نشرةُ `loopz_news` تُصاغ بـ`newsLine`،
 * ونشرةُ الغرفة (`title_posts.kind`) تُصاغ بـ`bulletinLine`** — **ودالّةُ
 * الصياغة تملكها وحدةٌ واحدة** (D-211/D-261). **فلو عرف الصفُّ المصدرين
 * لصار فيه فرعان يعرفان القاعدة**، ولو نُسخ الصفُّ لصار للخبر رسمان.
 * **فالصفُّ يأخذ السطرَ والزمنَ والوجهة، ولا يسأل من أين جاء.**
 *
 * ⚠️ **ولا ملصقَ فيه**: نحن **داخل** صفحة العمل وصورتُه في ترويستها فوق
 * (D-223/D-257).
 *
 * **والوجهُ مكانَه ختمٌ**: صفوفُ الخطّ الأخرى تبدأ بوجهِ قائلها، **وللخبر
 * قائلٌ أيضاً — نحن** (D-213)، فرمزُ النشرة يجلس حيث يجلس الوجه ليبقى
 * إيقاعُ العمود واحداً.
 */
export function TitleNewsRow({
  line,
  at,
  href,
  source,
  replies = 0,
  locale,
}: {
  /** الجملةُ مركّبةً بلغة القارئ — **المستدعي يملك صيغتَها** */
  line: string;
  at: string;
  href: string;
  /** اسمُ المصدر إن كان للخبر مصدرٌ خارجيّ */
  source?: string | null;
  /** ردودُ الغرفة على هذه النشرة — **والصفرُ لا يُرسم** (D-222) */
  replies?: number;
  locale: Locale;
}) {
  const t = getDict(locale);

  return (
    <article className="rounded-2xl border border-border bg-surface p-3.5 flex gap-3">
      <span
        aria-hidden
        className="shrink-0 size-11 rounded-full bg-accent/12 border border-accent/25 flex items-center justify-center"
      >
        <Icon name="newspaper" size={18} className="text-accent" />
      </span>

      <div className="min-w-0 flex-1">
        <Link href={href} prefetch={false} className="block group">
          {/* **وسطرُ النوع كأخيه في بطاقة الرأي** (D-407): الخطُّ فيه
              صنفان، **والختمُ وحدَه لا يُقرأ عند التمرير السريع.** */}
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-accent">
            {t.communityKindNews}
          </p>
          <p className="mt-0.5 text-[14px] leading-relaxed font-semibold group-hover:text-accent transition">
            {line}
          </p>
          <p className="mt-1 flex items-center gap-2 text-[12px] text-muted">
            <span className="tabular-nums">{timeAgoShort(at, t)}</span>
            {source && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{t.newsPerSource(source)}</span>
              </>
            )}
            {replies > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Icon name="comment" size={13} />
                  {replies}
                </span>
              </>
            )}
          </p>
        </Link>
      </div>
    </article>
  );
}
