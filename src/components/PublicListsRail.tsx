import Link from "next/link";
import Image from "next/image";
import { Icon } from "./Icon";
import { PosterRail, RailItem } from "./PosterRail";
import { posterUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import type { PublicListCard } from "@/lib/data";
import { ListPeekTrigger } from "./ListPeek";

/** تسميات ورقة المعاينة — تُمرَّر من الخادم لأن مكوّن المعاينة عميل */
export type PeekLabels = { close: string; openList: string; failed: string; watchedMark: string };

/**
 * صفّ «قوائم من المجتمع» — اكتشاف القوائم المعلنة في اكتشف.
 *
 * مكوّن خادمٍ بلا تفاعل: البطاقة رابطٌ واحد إلى `/lists/[id]` (الصفحة
 * نفسها تقرأ قائمة الغير عبر `public_list` — البنية جاهزة من D-053).
 * الهندسة هندسة بطاقة `/lists` نفسها مصغّرةً لصفٍّ أفقيّ: الاسم فالعدّ
 * فسطر الصاحب، وتحتها شريط أربعة ملصقات — لا نظام بصريّ جديد.
 * قائمة مخفي الاسم تظهر بلا سطر صاحبٍ أصلاً (D-011): سطرٌ باسمٍ بديل
 * يوحي بأن «مستخدم» شخصٌ يُقصَد، والغياب أصدق.
 *
 * D-068: البطاقة نفسها صارت تخدم ثلاثة أبواب — اكتشف، والمحفوظة في
 * قوائمي، وقوائم الشخص في ملفّه — فالعنوان صار معاملاً بدل أن تُنسخ
 * البطاقة ثلاث مرات. الافتراضي يبقى عنوان اكتشف.
 */
export function PublicListsRail({
  lists,
  locale,
  title,
  peekLabels,
}: {
  lists: PublicListCard[];
  locale: Locale;
  /** عنوان الصفّ — يغيب فيحلّ عنوان «قوائم من المجتمع» */
  title?: string;
  /** حاضرةً تجعل ضغطة البطاقة معاينةً منبثقة بدل الانتقال (تبويب القوائم) */
  peekLabels?: PeekLabels;
}) {
  const t = getDict(locale);
  if (!lists.length) return null;

  return (
    <PosterRail title={title ?? t.publicListsRail} icon="list" iconColor="var(--accent-2)">
      {lists.map((l) => (
        /* wide لا الافتراضي: خانة الملصق (118px) لبطاقةٍ أعرض منها كانت
           تجعل البطاقات تتراكب فوق بعضها (لقطة المالك — D-084) */
        <RailItem key={l.id} wide>
          <CommunityListCard list={l} locale={locale} className="w-full" peekLabels={peekLabels} />
        </RailItem>
      ))}
    </PosterRail>
  );
}

/**
 * بطاقة القائمة نفسها، مُخرَجةً باسمها: الصفّ الأفقيّ يعطيها `w-56`،
 * وشبكة تبويب «القوائم» في اكتشف تعطيها العرض الكامل — بطاقةٌ واحدة
 * للبابين لا نسختان تتباعدان (نفس حجّة D-068 حين خدمت ثلاثة أبواب).
 */
export function CommunityListCard({
  list: l,
  locale,
  className = "w-full",
  peekLabels,
}: {
  list: PublicListCard;
  locale: Locale;
  /** عرض البطاقة — ثابتٌ في الصفّ الممرَّر، كاملٌ في الشبكة */
  className?: string;
  /** حاضرةً: البطاقة تفتح معاينةً منبثقة (طلب أحمد)؛ غائبةً تبقى رابطاً */
  peekLabels?: PeekLabels;
}) {
  const t = getDict(locale);
  const posters = l.posters.map((p) => posterUrl(p, "w185")).filter(Boolean) as string[];
  const body = (
    <>
      <span className="block text-[14px] font-bold truncate">{l.name}</span>
      <span className="block text-[12px] text-muted truncate mt-0.5">
        {t.listCount(l.item_count)}
        {l.owner ? ` · ${t.listByOwner(l.owner)}` : ""}
      </span>
      <span className="mt-2 flex gap-1.5">
        {/* **ثلاثةٌ لا أربعة — نفسُ بطاقات المجموعات المنسّقة** (D-206، طلب
            أحمد: «حتى الليست من الكميونتي تُعرض بنفس الطريقة»). **وبطاقتان
            بإيقاعين لمعنًى واحد هي ما تمنعه القاعدة ٦** — والرابعُ يجعل كلَّ
            ملصقٍ ٥٦px، أصغرَ من أن يُعرف الفيلمُ منه. */}
        {posters.length > 0 ? (
          posters.slice(0, 3).map((url, i) => (
            <span
              key={i}
              className="relative w-[calc(33.333%-4px)] aspect-[2/3] rounded-lg overflow-hidden bg-surface-2 border border-[color:var(--background)]"
            >
              <Image src={url} alt="" fill sizes="80px" className="object-cover" />
            </span>
          ))
        ) : (
          <span className="grid place-items-center w-14 aspect-[2/3] rounded-lg border border-dashed border-border text-muted">
            <Icon name="list" size={16} />
          </span>
        )}
      </span>
    </>
  );

  const cardClass = `block rounded-2xl border border-border bg-surface p-2.5 hover:bg-surface-2 transition ${className}`;
  if (peekLabels) {
    return (
      <ListPeekTrigger kind="list" refId={l.id} title={l.name} labels={peekLabels}>
        <span className={cardClass}>{body}</span>
      </ListPeekTrigger>
    );
  }
  return (
    <Link href={`/lists/${l.id}`} prefetch={false} className={cardClass}>
      {body}
    </Link>
  );
}
