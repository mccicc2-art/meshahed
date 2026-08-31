import Link from "next/link";
import Image from "next/image";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { PosterRail, RailItem } from "./PosterRail";
import { posterUrl, POSTER_INTRINSIC } from "@/lib/media";
import { getDict, num, type Locale } from "@/lib/i18n";
import { curatedName } from "@/lib/universes";
import { ListSaveHeart } from "./ListSaveHeart";
import { ListPlayToggle } from "./ListPlayToggle";
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
  grid = false,
  action,
  leading,
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
  /**
   * 🆕 **بطاقةٌ أولى ليست قائمةً** (D-703) — طابورُ «للمشاهدة» في صفِّ
   * الرئيسية: **مكانُه بين القوائم لأنه يُقرأ قائمةً** (عرفُ
   * `ListManager` منذ D-559)، **وليس له صفٌّ في `user_lists`** فلا
   * يدخل `lists`. **ولا بطاقةَ ثانيةً تُخترع**: المستدعي يمرّر
   * `ToWatchListCard` نفسَها.
   */
  leading?: React.ReactNode;
}) {
  const t = getDict(locale);
  if (!lists.length && !leading) return null;

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
          {leading && <li className="min-w-0">{leading}</li>}
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
      {leading && <RailItem size="list">{leading}</RailItem>}
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
  coverColor,
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
   * 🆕 **لونُ الغلاف** (D-824 · الهجرة ١٦٢) — **تدرّجٌ جاهزٌ لا رمز**:
   * **البطاقةُ ترسم ولا تعرف السجلّ** (D-235: ما يعبر الحدَّ مُسلسَل)،
   * **والمستدعي يترجم الرمزَ بـ`listColorCss`** — **فسجلُّ الألوان
   * قارئٌ واحدٌ لا اثنان.**
   * ⚠️ **ويأتي بعد `cover` في الترتيب** — غلافٌ واحدٌ لا اثنان.
   */
  coverColor?: string | null;
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
  /* 🆕 **مفتاحُ التشغيل على كلِّ بطاقةٍ يملك قارئُها صفَّها** (D-674،
     حكمُ أحمد: «نعم الكل له مفتاح تشغيل و إيقاف»): **قائمتُك برايتها
     في صفِّها (١٢٢)، ومحفوظتُك برايتها في صفِّ حفظك (١٤٩)** —
     **ورقاقةٌ واحدةٌ لا تعرف الفرقَ إلا عند الكتابة** (القاعدة ٣).
     ⚠️ **ولا مفتاحَ حيث لا رايةَ نعرفها** (`playlist === undefined`):
     بطاقةُ غريبٍ لم تحفظها **لا صفَّ لها تُكتب فيه** — **ومفتاحٌ
     يفشل عند الضغط وعدٌ كاذب** (D-217) — **وسطحٌ لم يمرِّرها بعد
     يبقى كما كان** (D-028).
     ⚠️ **ولا مفتاحَ لقائمةٍ فارغة**: رايةٌ على قائمةٍ بلا أعمالٍ لا
     تُظهر شيئاً في «تابِع المشاهدة» (شرطُ D-563 حرفاً). */
  const play =
    l.playlist === undefined || l.item_count <= 0 ? null : (
      <ListPlayToggle
        listId={l.id}
        locale={locale}
        initialOn={l.playlist}
        saved={!l.mine}
      />
    );
  const body = (
    <ListCardShell
      name={name}
      play={play}
      /* **القلبُ والآراءُ والنجمةُ في شريط الحال** (D-677، تصميمُه) —
         **والفاعلُ فاعلٌ والساكنُ ساكن**: من يملك الفعلَ يضغط زرَّه
         (نفسُ شرط `list_saves` و`list_reviews` — D-217)، **ومن لا
         يملكه يرى الرقمَ ساكناً بصفره** (نقضُ D-219 المحصورُ المسجَّل
         في رأس الهيكل). */
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
          <span
            className="shrink-0 flex items-center gap-1 text-12 font-bold text-accent tabular-nums"
            dir="ltr"
          >
            <Icon name="star" size={15} />
            {num(l.rating ?? 0, locale)}
          </span>
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
          <span
            className="shrink-0 flex items-center gap-1 text-12 text-muted tabular-nums"
            dir="ltr"
          >
            <Icon name="heart-filled" size={15} className="fill-current text-accent" />
            {num(l.saves ?? 0, locale)}
          </span>
        )
      }
      comments={
        <span
          className="shrink-0 flex items-center gap-1 text-12 text-muted tabular-nums"
          dir="ltr"
        >
          <Icon name="comment" size={15} className="text-accent" />
          {num(l.reviews ?? 0, locale)}
        </span>
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
      coverColor={coverColor}
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
      /* **البطاقةُ بلا حشوة** (D-677): الأرضيّةُ تملأها والهيكلُ يحشو
         محتواه بنفسه — `overflow-hidden` يقصّ الملصقاتِ على زواياها. */
      className={`block rounded-2xl border border-border bg-surface overflow-hidden hover:border-accent/40 transition ${className}`}
    >
      {body}
    </Link>
  );
}

/**
 * 🆕 **هيكلُ بطاقة القائمة — واحدٌ لكلِّ باب، بوجه D-677** (تصميمُ أحمد
 * بلقطتين: «أبغاك تطبق هذا التصميم الجديد لليست، ويطبق في كل مكان:
 * الديسكفري والهوم والمكتبة والبروفايل والكوميونتي — وسواءً الليست لي
 * أو لا، التصميم يكون موحد»).
 *
 * **تشريحُ البطاقة الجديد:**
 *  ١) الملصقاتُ (أو الغلافُ المختار) **أرضيّةُ البطاقة كلِّها** من جهة
 *     النهاية، وحجابٌ من جهة البداية يُقرأ عليه النصّ.
 *  ٢) الاسمُ عريضاً **بسطرين يلتفّان** — ⚖️ **نقضٌ محصورٌ لمشي D-486
 *     في هذه البطاقة بتصميمه**: لقطتُه تُظهر الاسمَ ملتفّاً لا ماشياً.
 *  ٣) وجهُ الصاحب واسمُه، ثمّ عددُ الأعمال.
 *  ٤) **شريطُ الحال في القاع**: ♥ عددُ الحفظ · 💬 عددُ الآراء · ★
 *     التقييم · **ومفتاحُ التشغيل في طرفه** (D-674).
 *     ⚖️ **والصفرُ يُطبع هنا** — **نقضٌ محصورٌ لتطبيق D-219 في هذا
 *     الشريط بتصميمه** (لقطتُه: «♥ 0 · 💬 0 · ★ 0»): الشريطُ تشريحُ
 *     البطاقة الثابت، **وغيابُ خانةٍ منه يُقرأ اختلافَ بطاقةٍ لا غيابَ
 *     رقم** — وتوحيدُ الشكل هو نصُّ طلبه.
 *
 * **والبطاقةُ واحدةٌ في كلِّ سطح** (D-375/D-383): اكتشف والرئيسية
 * والمكتبة والملفّ والمجتمع و`/news` — **فسطحٌ واحدٌ يُعدَّل يغيّرها
 * كلَّها**، وهو حرفُ طلبه.
 */
export function ListCardShell({
  name,
  icon,
  star,
  play,
  heart,
  comments,
  action,
  ownerAvatar,
  ownerName,
  countText,
  extra,
  posters,
  cover,
  coverColor,
}: {
  name: string;
  /** رمزٌ قبل الاسم — لقوائم لوبز وطابور «للمشاهدة» */
  icon?: React.ReactNode;
  star?: React.ReactNode;
  /** رقاقةُ التشغيل/الإيقاف (D-674) — طرفُ شريط الحال */
  play?: React.ReactNode;
  heart?: React.ReactNode;
  /** 🆕 عدُّ الآراء (D-677) — خانةُ 💬 في شريط الحال */
  comments?: React.ReactNode;
  action?: React.ReactNode;
  ownerAvatar?: React.ReactNode;
  ownerName?: string | null;
  countText: string;
  /** ذيلُ سطر العدّ — «بترتيب الأحداث» أو جسمُ الجائزة */
  extra?: string;
  posters?: string[];
  cover?: string | null;
  /** 🆕 **لونُ الغلاف** (D-824) — تدرّجٌ جاهزٌ من `listColorCss` */
  coverColor?: string | null;
}) {
  const stats = [heart, comments, star].filter(
    (x) => x !== undefined && x !== null && x !== false,
  );
  return (
    <span className="relative block h-full min-h-[10.5rem] isolate">
      {/* **الأرضيّة**: الغلافُ المختارُ كاملاً، وإلّا الملصقاتُ الثلاثة
          من جهة النهاية — **والفراغُ أرضيّةُ السطح وحدَها** (D-063:
          الغيابُ لا يُزخرف). */}
      {/* 🆕 **واللونُ في مرتبة الغلاف لا فوقه ولا تحته** (D-824):
          **غلافٌ واحدٌ لا اثنان** — **والصورةُ تسبقه لأنّها الأخصّ**
          (اختيرت من أعمال القائمة نفسِها)، **واللونُ يسبق الملصقات**
          لأنّه اختيارُ صاحبها والملصقاتُ افتراضُنا (D-152).
          ⚠️ **ويقع تحت نفس الحجاب**: **النصُّ محبوسٌ في عمود الحجاب**
          (D-686) **فلا يحتاج اللونُ لونَ نصٍّ يقابله** — وهو ما جعل
          سجلَّه بلا قيمتين لكلِّ لون. */}
      {cover ? (
        <span aria-hidden className="absolute inset-0">
          <Image src={cover} alt="" fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" />
        </span>
      ) : coverColor ? (
        /* 🔴 **وصندوقُه صندوقُ الملصقات لا البطاقةُ كلُّها** (D-824 —
           **قِيس في `daylight` بالإنجليزيّة فسقط**): **اللونُ ملءَ
           البطاقة يضع طرفَه الغامقَ تحت الاسم في LTR** — **ونصٌّ داكنٌ
           على بنفسجيٍّ غامقٍ لا يُقرأ**، **والسطرُ الخافتُ تحته يختفي.**
           ⚖️ **والحجابُ مضبوطٌ على هذا الصندوق بعينه منذ D-686**
           («النصوصُ حُبست في عموده») — **فاللونُ يجلس حيث تجلس
           الملصقاتُ اليوم**، **ولا حجابَ ثانٍ يُخترع للون** (القاعدة ٣).
           🔑 **والدرسُ**: **تدرّجٌ باتّجاهٍ فيزيائيٍّ (`left`) في تطبيقٍ
           بوجهين لا يُحكم عليه من وجهٍ واحد** — **والقياسُ في الاتّجاه
           الآخر أرخصُ من بلاغ.** */
        <span
          aria-hidden
          className="absolute inset-y-0 end-0 w-[72%]"
          style={{ backgroundImage: coverColor }}
        />
      ) : (
        posters &&
        posters.length > 0 && (
          <span aria-hidden className="absolute inset-y-0 end-0 w-[72%] flex justify-end">
            {posters.slice(0, 3).map((url, i) => (
              <span key={i} className="relative h-full flex-1 min-w-0">
                <Image src={url} alt="" {...POSTER_INTRINSIC.w185} className="absolute inset-0 w-full h-full object-cover" />
              </span>
            ))}
          </span>
        )
      )}
      {/* **الحجابُ بلون السطح نفسِه** — فيصحّ في `daylight` بلا رقمٍ
          أصمّ (رمزُ الثيم لا لونٌ مكتوب)، **واتّجاهُه اتّجاهُ القراءة**
          (القاعدة ١٧).
          ⚖️ 🆕 **وانحسر عن الملصقات** (D-678، حكمُ أحمد على المنشور:
          «الضلام سيء كأنه غبار وأغلب البوسترات ما هي واضحة»): كان
          يمتدّ إلى آخر البطاقة بعتمة ١٠٪ **وفوقَه حزامٌ سفليٌّ كامل**
          — **فقُرئ غباراً لا حجاباً.** صار يذوب إلى الصفر عند ٧٢٪
          **وسقط الحزامُ السفليّ**: شريطُ الحال يجلس في الجهة الداكنة
          أصلاً، **ورقاقةُ المفتاح تحمل أرضيّتها بنفسها.**
          🆕 **ثمّ صار «ذكيّاً» (D-686، حكمُه: «خله ذكي حول الكلام
          والأيقونات بحيث البوسترات واضحة»)**: الذوبانُ اكتمل عند ٦٠٪،
          **والنصوصُ حُبست في عموده** (`max-w-[58%]` — نصٌّ لا يغادر
          حجابَه لا يحتاج حجاباً يطارده)، **وعنقودُ الحال لبس هالتَه
          المحلّيّة** — العتمةُ تتبع الكلامَ لا تفترش البطاقة. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[color:var(--surface)] from-[32%] via-[color:var(--surface)]/60 via-[44%] to-transparent to-[60%]"
      />

      <span className="relative flex h-full min-h-[10.5rem] flex-col p-3.5">
        <span className="flex items-start gap-1.5">
          {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
          <span dir="auto" className="min-w-0 flex-1 max-w-[58%] text-15 font-bold leading-snug line-clamp-2 break-words">
            {name}
          </span>
          {action && <span className="shrink-0">{action}</span>}
        </span>
        {(ownerAvatar || ownerName) && (
          <span className="mt-1.5 flex items-center gap-1.5 text-12 text-muted min-w-0 max-w-[58%]">
            {ownerAvatar}
            {ownerName && <span className="truncate">{ownerName}</span>}
          </span>
        )}
        <span className="mt-1 text-12 text-muted min-w-0 max-w-[58%] truncate">
          {countText}
          {extra ?? ""}
        </span>

        {(stats.length > 0 || play) && (
          <span className="mt-auto pt-3 flex items-center min-w-0">
            {stats.length > 0 && (
              /* **هالةُ العنقود المحلّيّة** (D-686): أرضيّةٌ بعرض محتواه
                 لا حزامٌ بعرض البطاقة (نقضُ الحزامِ في D-678 باقٍ) —
                 فالملصقاتُ بين العنقود والمفتاح صافية. */
              <span className="flex items-center rounded-full bg-[color:var(--surface)]/70 -ms-1.5 px-2 py-1">
                {stats.map((node, i) => (
                  <span key={i} className="flex items-center shrink-0">
                    {i > 0 && (
                      <span aria-hidden className="w-px h-4 bg-[color:var(--divider)] mx-2.5" />
                    )}
                    {node}
                  </span>
                ))}
              </span>
            )}
            {play && <span className="ms-auto ps-2 shrink-0">{play}</span>}
          </span>
        )}
      </span>
    </span>
  );
}
