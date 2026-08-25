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
import { MarqueeText } from "./MarqueeText";
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
  grid = false,
  action,
}: {
  lists: PublicListCard[];
  locale: Locale;
  /** عنوان الصفّ — يغيب فيحلّ عنوان «قوائم من المجتمع» */
  title?: string;
  /**
   * 🆕 **عنصرٌ في طرف العنوان** (D-581) — يُمرَّر إلى `PosterRail` كما
   * هو: **مقبضُ ترتيبٍ في ملفّ صاحبها**، ولا شيءَ في سائر الأبواب.
   */
  action?: React.ReactNode;
  /**
   * 🔴 🆕 **شبكةٌ لا صفّ — حيث تجاورها شبكة** (D-433، طلبُ أحمد: «في
   * المكتبة كل البطائق أبغاها بالمقاس الجديد»).
   *
   * **مكتبتُه ترسم قوائمَه شبكةَ عمودين، ورفُّ «المحفوظة» تحتها
   * مباشرةً يرسم البطاقةَ نفسَها صفّاً أضيق** — **بطاقةٌ واحدةٌ بمقاسين
   * في شاشةٍ واحدة، والقارئُ يقرأ الفرقَ معنًى لا وجود له.**
   *
   * ⚠️ **ولا ترويسةٌ ثانيةٌ ولا شبكةٌ ثانية**: `PosterRail bare` (D-428)
   * يعطي الرأسَ نفسَه، **والشبكةُ هي شبكةُ `ListManager` حرفاً**
   * (`grid-cols-2 gap-2.5`) — **ورقمان أو صنفان لشيءٍ واحدٍ في صفحةٍ
   * واحدة هو العطلُ بعينه** (القاعدة ٦).
   */
  grid?: boolean;
}) {
  const t = getDict(locale);
  if (!lists.length) return null;

  const cards = lists.map((l) => (
    <CommunityListCard key={l.id} list={l} locale={locale} className="w-full h-full" />
  ));

  if (grid) {
    return (
      <PosterRail
        title={title ?? t.publicListsRail}
        icon="list"
        iconColor="var(--accent-2)"
        action={action}
        bare
      >
        {/* 🆕 ⚖️ **عمودٌ واحدٌ على الجوّال** (D-461، حكمُ أحمد: «أحجام
              الليستات في المكتبة تكون مثل أحجامها في الديسكفري»).

              **والقياسُ يقول ما رآه**: بطاقةُ اكتشف `280px` على شاشة ٣٩٠،
              **وبطاقةُ المكتبة في عمودين `174`** — **٦٢٪ منها**،
              فالملصقاتُ الثلاثةُ داخلها تصغر معها إلى النصف تقريباً.

              **ولماذا عمودٌ واحدٌ لا رفٌّ مطابق:** الرفُّ يُظهر طرفَ
              البطاقة التالية فيدعو للتمرير — **وهو صحيحٌ في اكتشف حيث
              القوائمُ اقتراحاتٌ تُتصفَّح**. **والمكتبةُ سؤالُها «ماذا
              عندي؟» وجوابُه جردٌ يُقرأ عمودياً** (D-006) — **ورفٌّ أفقيٌّ
              فيها يُخفي ما تملكه خلف الحافّة.** فالعرضُ يكبر والاتّجاه
              يبقى.
              ⚠️ **ومن `sm` عمودان**: الشاشةُ الواسعة تسع الاثنين
              بعرضٍ يفوق ٢٨٠ لكلٍّ منهما. */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {lists.map((l, i) => (
            <li key={l.id} className="min-w-0">
              {cards[i]}
            </li>
          ))}
        </ul>
      </PosterRail>
    );
  }

  return (
    <PosterRail
      title={title ?? t.publicListsRail}
      icon="list"
      iconColor="var(--accent-2)"
      action={action}
    >
      {lists.map((l, i) => (
        /* `size="list"` لا الافتراض: خانة الملصق (118px) لبطاقةٍ أعرض
           منها كانت تجعل البطاقات تتراكب فوق بعضها (لقطة المالك — D-084)،
           🆕 **والمقاسُ كبر في D-433 ليساوي بطاقةَ الشبكة.** */
        <RailItem key={l.id} size="list">
          {cards[i]}
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
  cover,
  action,
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
  /**
   * 🆕 **غلافُ صاحبها إن اختاره** (D-364/D-208) — **يحلّ محلَّ صفِّ
   * الملصقات لا فوقه**: بطاقةٌ تحمل غلافاً **و**ثلاثةَ ملصقات تقول
   * الشيءَ مرّتين بارتفاعٍ مضاعف (نصُّ `ListManager` حرفاً).
   * ⚠️ **وغيابُه هو السلوكُ القائم** لبقيّة قرّاء البطاقة (D-152).
   */
  cover?: string | null;
  /**
   * 🆕 **فتحةٌ في عمود الزاوية** (D-364) — **حيث يجلس ♥ و★**. مكتبتُك
   * لا تعرض الاثنين على قوائمك (لا تحفظ ما تملك ولا تقيّمه — D-217)،
   * **فالعمودُ فارغٌ هناك وبابُ المشاركة يسكنه** بدل صفٍّ ثالث.
   */
  action?: React.ReactNode;
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
    <ListCardShell
      name={name}
      /* **النجمةُ والقلبُ في سطر الاسم** (D-383، طلبُ أحمد: «النجمة التي
         تحت القلب تكون هي والاسم والتايتل في سطر واحد… تكون سطرين
         وبوستر»). ⚠️ **ولا يظهر الزرّان لقائمتي أنا ولا لزائرٍ بلا
         حساب**: نفسُ شرط `list_saves` و`list_reviews` حرفاً — **وزرٌّ لا
         يستطيع أن يكتب وعدٌ كاذب** (D-217). **ومن لا زرَّ له يرى الرقمَ
         ساكناً** فلا يفقد الحقيقةَ من لا يملك الفعل. */
      star={
        l.can_review ? (
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
              className="shrink-0 flex items-center gap-1 px-1 text-12 font-bold text-accent tabular-nums"
              dir="ltr"
            >
              <Icon name="star" size={16} />
              {num(l.rating as number, locale)}
            </span>
          )
        )
      }
      heart={
        l.can_save ? (
          <ListSaveHeart
            listId={l.id}
            saved={l.saved_by_me}
            count={l.saves ?? 0}
            locale={locale}
          />
        ) : (
          (l.saves ?? 0) > 0 && (
            <span
              className="shrink-0 flex items-center gap-1 px-1 text-12 text-muted tabular-nums"
              dir="ltr"
            >
              <Icon name="heart-filled" size={16} className="fill-current" />
              {num(l.saves as number, locale)}
            </span>
          )
        )
      }
      action={action}
      /* **وجهُ الصاحب دائرةً قبل اسمه** (D-335) — ومخفي الاسم بلا وجهٍ
         ولا اسمٍ أصلاً، الغيابُ أصدق (D-011). */
      ownerAvatar={
        l.owner ? <Avatar src={l.owner_avatar} name={l.owner} size={14} className="shrink-0" /> : null
      }
      ownerName={l.owner ?? null}
      countText={countLabel ?? t.listCount(l.item_count)}
      posters={posters}
      cover={cover}
    />
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

/**
 * 🆕 **هيكلُ بطاقة القائمة — واحدٌ لكلِّ باب** (D-383، طلبُ أحمد على
 * لقطتين متجاورتين: «لاحظت في لستات تصميمها مختلفة، لازم الكل نفس
 * التصميم… يعني اللستة تكون عبارة عن سطرين وبوستر، وهذا تطبّقه في كل
 * مكان: الديسكفري والمكتبة والكوميونتي»).
 *
 * **سطران وبوستر، لا أكثر:**
 *  ١) الاسمُ ومعه ★ و♥ **في سطرٍ واحد** — الرمزُ ورقمُه معاً (D-223).
 *  ٢) وجهُ الصاحب واسمُه · عددُ الأعمال (وذيلٌ اختياريٌّ كوعد الترتيب).
 *  ٣) ثلاثةُ ملصقات، أو الغلافُ المختار مكانَها (D-364/D-208).
 *
 * **⚖️ وهذا نقضٌ مسجَّلٌ لعمودِ الزاوية في D-357** («القلب فوق والنجمة
 * تحته») — **بحكم صاحبه بعد أن رأى الشكلين متجاورين**: بطاقةُ المجموعة
 * المنسّقة بقيت على سطر الاسم، **فقُرئ الصفُّ صفَّين بإيقاعين** وهو
 * بعينه ما تمنعه القاعدة ٦. **والسببُ الأصليُّ لـD-357 لم يسقط**: الرقمُ
 * ما زال يجاور رمزَه — **وإنّما انتقل الرمزان معاً إلى حيث كان جارُهما.**
 */
export function ListCardShell({
  name,
  icon,
  star,
  heart,
  action,
  ownerAvatar,
  ownerName,
  countText,
  extra,
  posters,
  cover,
}: {
  name: string;
  /** رمزٌ قبل الاسم — لقوائم لوبز وحدَها (✦/★) */
  icon?: React.ReactNode;
  star?: React.ReactNode;
  heart?: React.ReactNode;
  action?: React.ReactNode;
  ownerAvatar?: React.ReactNode;
  ownerName?: string | null;
  countText: string;
  /** ذيلُ السطر الثاني — «بترتيب الأحداث» أو جسمُ الجائزة */
  extra?: string;
  posters?: string[];
  cover?: string | null;
}) {
  return (
    <>
      <span className="flex items-center gap-1.5 text-14 font-bold">
        {icon}
        {/* ⚖️ 🆕 **سطرٌ واحدٌ يمشي لا سطران يُقصّان** (D-486 امتداداً،
            طلبُ أحمد ٢٠ أغسطس: «حتى في اللستات في كل مكان — العنوان ما
            أبغاه ياخذ سطرين، هو سطر واحد وإذا ما يكفي يتحرّك الكلام»).
            **ونقضُ «حدّ أقصى سطران» من D-443** — **وحجّتُها كانت أنّ
            القصَّ في سطرٍ واحد يبتلع نصفَ الاسم العربيّ**، **والمشيُ
            هو الجوابُ لا سطرٌ ثانٍ**: الاسمُ يُقرأ كاملاً ولا تتفاوت
            البطاقاتُ في الارتفاع. **و`dir="auto"` باقٍ بحرفه** (القاعدة
            ١٧) — وهو الآن معامِلٌ في `MarqueeText`.
            **وبطاقةُ القائمة واحدةٌ في كلِّ سطح** (D-375/D-383)،
            **فسطحٌ واحدٌ يُعدَّل يغيّر اكتشفَ والمجتمعَ والمكتبةَ
            والملفَّ معاً** — وهو ما طلبه بنصّه «في كل مكان». */}
        <MarqueeText
          text={name}
          dir="auto"
          className="min-w-0 flex-1 leading-tight"
        />
        {heart}
        {action}
      </span>
      {/* 🆕 **والنجمةُ آخرَ السطر الثاني والقلبُ في سطر الاسم** (D-387،
          **حكمُ أحمد الثاني بعد أن رأى الأوّل حيّاً**: «سطر ١: الاسم +
          ♥ برقمه · سطر ٢: وجهُ الصاحب واسمُه · عددُ الأعمال + ★ برقمها
          — خلّها كذا أفضل»).
          **⚖️ وهو تبديلٌ لموضعَي الرمزين لا نقضٌ لبنية السطرين**:
          الشكلُ سطران وبوستر كما استقرّ في D-383، **وطرفا السطرين
          عمودٌ واحدٌ من الأرقام** — **والذي تبدّل أيُّهما فوق.**
          **وحجّتُه أقربُ إلى الفعل**: القلبُ زرُّك أنت (تحفظ أو لا)،
          **فيجاور الاسمَ الذي تضغطه**، **والنجمةُ حكمُ الناس فتجاور
          عددَهم.** **والارتفاعُ سطران كما هو** (D-046). */}
      <span className="mt-1 flex items-center gap-1 text-12 font-normal text-muted min-w-0">
        {ownerAvatar}
        {ownerName && (
          <>
            <span className="truncate">{ownerName}</span>
            <span aria-hidden>·</span>
          </>
        )}
        <span className="truncate">
          {countText}
          {extra ?? ""}
        </span>
        {star && <span className="ms-auto shrink-0 flex items-center">{star}</span>}
      </span>
      {cover ? (
        <span className="mt-2 block relative aspect-[16/9] rounded-lg overflow-hidden bg-surface-2 border border-[color:var(--background)]">
          <Image src={cover} alt="" fill sizes="(max-width: 640px) 50vw, 260px" className="object-cover" />
        </span>
      ) : (
        <span className="mt-2 flex gap-1.5">
          {/* **ثلاثةٌ لا أربعة** (D-206) — والرابعُ يجعل كلَّ ملصقٍ ٥٦px */}
          {posters && posters.length > 0 ? (
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
      )}
    </>
  );
}
