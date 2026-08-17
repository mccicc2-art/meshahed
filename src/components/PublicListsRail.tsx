import Link from "next/link";
import Image from "next/image";
import { Icon } from "./Icon";
import { PosterRail, RailItem } from "./PosterRail";
import { posterUrl } from "@/lib/media";
import { getDict, num, type Locale } from "@/lib/i18n";
import type { PublicListCard } from "@/lib/data";

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
}: {
  lists: PublicListCard[];
  locale: Locale;
  /** عنوان الصفّ — يغيب فيحلّ عنوان «قوائم من المجتمع» */
  title?: string;
}) {
  const t = getDict(locale);
  if (!lists.length) return null;

  return (
    <PosterRail title={title ?? t.publicListsRail} icon="list" iconColor="var(--accent-2)">
      {lists.map((l) => (
        /* wide لا الافتراضي: خانة الملصق (118px) لبطاقةٍ أعرض منها كانت
           تجعل البطاقات تتراكب فوق بعضها (لقطة المالك — D-084) */
        <RailItem key={l.id} wide>
          <CommunityListCard list={l} locale={locale} className="w-full" />
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
  countLabel,
}: {
  list: PublicListCard;
  locale: Locale;
  /**
   * 🆕 **بديلُ سطر العدّ** (D-290): البطاقةُ تقول «N عملاً» لأنها في
   * «اكتشف» تعرّف بحجم القائمة — **وفي قسم «ما يحفظه الناس» المقياسُ
   * هو الحفظ لا الحجم**، **ورقمٌ يُقرأ بمعنًى غير معناه أسوأُ من لا
   * رقم** (D-219). **فيُمرَّر النصُّ ولا تُنسخ البطاقة** (D-068: بطاقةٌ
   * واحدةٌ لأربعة أبواب).
   */
  countLabel?: string;
  /** عرض البطاقة — ثابتٌ في الصفّ الممرَّر، كاملٌ في الشبكة */
  className?: string;
}) {
  const t = getDict(locale);
  const posters = l.posters.map((p) => posterUrl(p, "w185")).filter(Boolean) as string[];
  const body = (
    <>
      <span className="block text-[14px] font-bold truncate">{l.name}</span>
      <span className="block text-[12px] text-muted truncate mt-0.5">
        {countLabel ?? t.listCount(l.item_count)}
        {l.owner ? ` · ${t.listByOwner(l.owner)}` : ""}
      </span>
      {/* 🆕 **سطرُ الأرقام** (D-329، طلبُ أحمد: «أهم شي من هنا أشوف عدد
          العاملين لها مفضلة وتقييمها»).
          **وسطرٌ ثانٍ لا ذيلٌ للأوّل**: الأوّلُ يعرّف بالقائمة (حجمُها
          وصاحبُها) **وهذا حكمُ الناس عليها** — معنيان فسطران (D-224).
          🔴 **والصفرُ يُخفى ولا يُطبع**: «★ — · ♥ 0» تحت قائمةٍ جديدة
          **تُقرأ حكماً لا فراغاً** (D-219/D-134)، **فالسطرُ كلُّه يغيب
          حتى يوجد رقمٌ حقيقيّ.** */}
      {((l.rating ?? null) !== null || (l.saves ?? 0) > 0) && (
        <span className="block text-[12px] mt-0.5 flex items-center gap-2.5 tabular-nums">
          {(l.rating ?? null) !== null && (
            <span className="flex items-center gap-1 font-bold" dir="ltr">
              <Icon name="star" size={12} className="text-accent" />
              {num(l.rating as number, locale)}
            </span>
          )}
          {(l.saves ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-muted" dir="ltr">
              <Icon name="heart-filled" size={12} className="fill-current" />
              {num(l.saves as number, locale)}
            </span>
          )}
        </span>
      )}
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

  /* **رابطٌ دائماً — وسقطت المعاينةُ المنبثقة** (D-334، طلبُ أحمد:
     «وهذي المنبثقة إلغيها»): صفحةُ القائمة صارت تعطي كلَّ ما كانت
     الورقةُ تعطيه وفوقَه التقييمُ والتبويبات (D-327/D-333) — **وبابان
     لمحتوًى واحدٍ عطلٌ** (D-068). */
  return (
    <Link
      href={`/lists/${l.id}`}
      prefetch={false}
      className={`block rounded-2xl border border-border bg-surface p-2.5 hover:bg-surface-2 transition ${className}`}
    >
      {body}
    </Link>
  );
}
