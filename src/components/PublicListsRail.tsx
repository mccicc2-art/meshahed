import Link from "next/link";
import Image from "next/image";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { PosterRail, RailItem } from "./PosterRail";
import { posterUrl } from "@/lib/media";
import { getDict, num, type Locale } from "@/lib/i18n";
import { curatedName } from "@/lib/universes";
import { ListSaveHeart } from "./ListSaveHeart";
import { ListRateStar } from "./ListRateStar";
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
  /* 🆕 **اسمُ قائمةِ لوبز بلغة القارئ** (دَينُ D-328): الصفُّ مكتوبٌ
     بالعربية في القاعدة **والهويّةُ في `source_slug`** — فالقارئُ
     الإنجليزيُّ كان يرى «أفضل ٢٥٠ فيلماً» في «الأكثر حفظاً» بينما يراها
     «Top 250 Movies» في رفّها. **واسمٌ واحدٌ بوجهين في صفحةٍ واحدة
     يُقرأ قائمتين** (D-147/D-273). وقائمةُ العضو تعود باسمها كما هو. */
  const name = curatedName(l.source_slug, l.name, locale === "en" ? "en" : "ar");
  const body = (
    <>
      {/* 🆕 **صفٌّ من عمودين: التعريفُ يساراً والحكمُ في الزاوية**
          (D-357، طلبُ أحمد: «رقم القلب يكون جنب القلب ورقم التقييم كذلك،
          وحط النجمة تحت القلب بحيث كلهم أرقامهم تكون يمينهم»).

          **وكان الرمزان في سطر الاسم وأرقامُهما في سطرٍ ثالثٍ أسفل
          البطاقة** — **ورقمٌ يجاور صاحبَه أو لا يُقرأ** (D-223/D-237):
          القارئُ يرى ♥ في الزاوية و«♥ ١» في القاع فيحسبهما شيئين.

          🔴 **ولماذا عمودان لا صفٌّ ثالث:** الرمزان في عمودٍ واحدٍ
          ارتفاعُه سطران، **وبجانبه الاسمُ وسطرُ صاحبِه — وهما سطران
          أيضاً** — **فالبطاقةُ لا تعلو بكسلاً واحداً** (D-046: لا شيء
          يتغيّر حجمُه بعد أن يُرسم، **وثمنُ الترتيب يُدفع من الفراغ لا
          من الارتفاع** — D-264/D-303). */}
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold truncate">{name}</span>
          {/* 🆕 **وجهُ الصاحب دائرةً قبل اسمه** (D-335، طلبُ أحمد: «صورة
              الشخص الي عملها تظهر دائرة صغيرة واسمه — بدون زيادة حجم
              الكارد»): الدائرةُ ١٤px داخل سطرِ الـ12px القائم **فلا يعلو
              السطرُ ولا البطاقة**. ومخفي الاسم بلا وجهٍ ولا اسمٍ أصلاً —
              الغيابُ أصدق (D-011). */}
          <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted min-w-0">
            {l.owner && (
              <>
                <Avatar src={l.owner_avatar} name={l.owner} size={14} className="shrink-0" />
                <span className="truncate">{l.owner}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span className="shrink-0">{countLabel ?? t.listCount(l.item_count)}</span>
          </span>
        </span>
        {/* **القلبُ فوق والنجمةُ تحته، ورقمُ كلٍّ يمينَه** — بنصِّ طلبه.
            ⚠️ **ولا يظهر الزرّان لقائمتي أنا ولا لزائرٍ بلا حساب**: نفسُ
            شرط `list_saves` و`list_reviews` حرفاً — **وزرٌّ لا يستطيع أن
            يكتب وعدٌ كاذب** (D-217). **ومن لا زرَّ له يرى الرقمَ ساكناً**
            فلا يفقد الحقيقةَ من لا يملك الفعل. */}
        <span className="shrink-0 flex flex-col items-end gap-0.5 tabular-nums">
          {l.can_save ? (
            <ListSaveHeart
              listId={l.id}
              saved={l.saved_by_me}
              count={l.saves ?? 0}
              locale={locale}
            />
          ) : (
            (l.saves ?? 0) > 0 && (
              <span className="flex items-center gap-1 h-8 px-1 text-[12px] text-muted" dir="ltr">
                <Icon name="heart-filled" size={16} className="fill-current" />
                {num(l.saves as number, locale)}
              </span>
            )
          )}
          {/* 🆕 **النجمةُ زرٌّ دائمٌ ورقمُها صادق** (D-352): البابُ لا
              يُغلق، **والرقمُ يبقى محكوماً بـD-219** فيظهر إن وُجد ويغيب
              إن لم يوجد. */}
          {l.can_review ? (
            <ListRateStar
              listId={l.id}
              listName={name}
              rating={l.rating ?? null}
              mine={l.my_review ?? null}
              locale={locale}
            />
          ) : (
            (l.rating ?? null) !== null && (
              <span
                className="flex items-center gap-1 h-8 px-1 text-[12px] font-bold text-accent"
                dir="ltr"
              >
                <Icon name="star" size={16} />
                {num(l.rating as number, locale)}
              </span>
            )
          )}
        </span>
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
