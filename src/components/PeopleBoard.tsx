import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import { getDict, num, type Locale } from "@/lib/i18n";
import { timeAgoShort } from "@/lib/when";
import { dirOf, alignOf } from "@/lib/dir";
import type { PeopleLeaderRow, PeopleTopReviewRow, SavedListRow } from "@/lib/data";
import { PersonName } from "./PersonRow";
import { FollowUserButton } from "./FollowUserButton";
import { PosterRail, RailItem } from "./PosterRail";
import { CommunityListCard } from "./PublicListsRail";
import { Icon, type IconName } from "./Icon";

/**
 * **أقسامُ تبويب «الناس»** (D-263 · D-264 · الهجرتان ٨١ و٨٢).
 *
 * ================= ⚠️ إعادةُ تصميمٍ بلوحة أحمد =================
 *
 * **حكمُ أحمد على النسخة الأولى: «التصميم سيء».** وكانت صفوفاً مكدّسةً
 * بخطوطٍ فاصلة — **وهي وصفةُ خطٍّ يُمسح لا وصفةُ لوحةٍ تُتصفَّح**:
 * الصفُّ الطويل يقول «اقرأني بالترتيب»، **واللوحةُ تقول «انظر من هنا»**.
 * فصارت **بطاقاتٍ ثلاثاً في الصفّ**، ولكلِّ قسمٍ **رأسٌ برمزٍ و«عرض
 * الكل»** كما في لوحته حرفاً.
 *
 * ================= وما لم يُنقل من اللوحة، ولماذا =================
 *
 * **١) «٢٤٥ نقطة» لم تُنقل** — **وأحمد أكّد العددَ الصريح بسؤالٍ ثانٍ.**
 * فالبطاقةُ تحمل «٨ تفاعلات» **ومكوّناتِها تحتها** (مشاركة · رأي ·
 * إعجاب): **رقمٌ لا يستطيع أحدٌ مراجعتَه يُفقِد الثقةَ بالصفحة كلِّها**
 * (D-219). **والمراجعةُ تُكتب ولا تُترك ممكنة** — ولهذا سطران لا سطر.
 *
 * **٢) «تطابق ٩٢٪» ورقاقاتُ الأنواع لم تُنقل** (اختيارُ أحمد): **لا
 * نملك أيّاً منهما في القاعدة**، ونسبةٌ مخترَعةٌ هي «النقطة» نفسُها في
 * ثوبٍ آخر. **والسببُ الحقيقيُّ في موضعها**: «يشاركك ٦ أعمال» — محسوبٌ
 * من مكتبتك وقابلٌ للمراجعة (D-216/D-126).
 *
 * **٣) قسما المتابعة صارا واحداً** (اختيارُ أحمد): مصدرُهما عندنا
 * `people_to_follow` وحدها، **وقسمان من مصدرٍ واحد يعرضان الأشخاصَ
 * أنفسَهم مرّتين** — وقد تكرّر Razan وM7MD في اللوحة نفسِها.
 * ⚠️ **ثم حُذف القسمُ الموحَّد كلُّه في D-270** بحكم أحمد، **وحُذف معه
 * «ما أضافه الأعضاء إلى مكتباتهم»** — انظر التذييل آخرَ الملفّ.
 *
 * ================= وأربعةُ أقسامٍ اليوم =================
 *
 * **مميّزون · الأكثرُ مشاركةً هذا الأسبوع · أعلى التعليقات · نجومٌ
 * صاعدون** (D-270، ترتيبُ أحمد). **وثلاثةٌ منها لوحةُ نشاطٍ واحدة
 * بثلاثة أوضاع** — لا ثلاثةُ مكوّنات.
 *
 * ================= ولا قسمَ فارغاً يُرسم =================
 *
 * كلُّ مكوّنٍ هنا يعيد `null` حين لا صفَّ له، **والصفحةُ تُعلن الفراغَ
 * مرّةً واحدةً حين تفرغ الأربعةُ معاً** (D-181/D-263).
 */

/**
 * **ألوانُ رموزِ الأقسام** (D-268، طلبُ أحمد: «رموزٌ ملوّنة كما في
 * لوحتي»).
 *
 * ⚠️ **وهذه علاماتُ أقسامٍ لا ألوانُ حالة** — والفرقُ يُقال صراحةً كي
 * لا تُقرأ نقضاً لـD-003 («اللون يحمل الحالة، ولون نجاح واحد لا
 * اثنان»): **لا أحدَ منها يعني نجاحاً ولا خطأً ولا تحذيراً**، هي
 * فهرسٌ بصريٌّ يميّز عناوينَ متجاورة. **وحالاتُ التطبيق تبقى على
 * `--accent` و`--success` وحدهما.**
 *
 * **وهي هنا في خريطةٍ واحدة لا مبثوثةٌ في النداءات** — **خامسٌ يُضاف
 * يُضاف هنا** (D-145: وصفةٌ لا نسخة).
 */
const SECTION_TONE = {
  /** ✨ البنفسجيُّ للمميّزين — ورث لونَ الاقتراحات المحذوفة (D-270) */
  featured: "text-[#A78BFA]",
  /** 🏆 الذهبُ لونُ العلامة أصلاً — والمرتبةُ الأولى تستحقّه */
  top: "text-accent",
  /** ❤️ */
  reviews: "text-[#F26D6D]",
  /** 🔥 */
  rising: "text-[#FB923C]",
} as const;

/* ============================================================
   وصفةُ القسم — رأسٌ برمزٍ و«عرض الكل»
   ============================================================
   **رمزٌ من `Icon.tsx` لا إيموجي**: لوحةُ أحمد ملوّنةٌ بالإيموجي،
   **والإيموجي يُرسم بخطّ النظام فيختلف شكلاً ولوناً بين أندرويد وآيفون**
   — وهو نصُّ قرارِ `Icon.tsx` منذ أوّل يوم. **الرموزُ ترث `currentColor`
   فتتبع الثيم**، ولا عائلةَ ثانية (D-002). */
export function BoardSection({
  icon,
  tone,
  title,
  note,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  icon: IconName;
  /** **لونُ رمزِ القسم** — انظر `SECTION_TONE` (D-268) */
  tone?: string;
  title: string;
  /**
   * **سطرٌ يقول ما يقيسه القسمُ فعلاً** (D-270) — **لا شرحٌ ولا ترويج.**
   * **ولا يُكتب إلا حين يكذب العنوانُ وحدَه**: «أعضاء مميّزون» تُقرأ
   * «اخترناهم»، **و«الأكثر مشاركةً هذا الأسبوع» لا تحتاج سطراً** لأنها
   * تقول شرطَها في اسمها. **وسطرٌ تحت كلِّ عنوانٍ يصير ضجيجاً** (D-181).
   */
  note?: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      /* **ولا خطَّ فاصلاً بين الأقسام** (D-269، طلبُ أحمد بلقطتين للخطّ
         وحده): **البطاقاتُ تفصل نفسَها بحوافّها**، والخطُّ فوقها فاصلٌ
         ثانٍ لِما هو مفصولٌ أصلاً — **وهو منطقُ D-134 نفسُه** (خطٌّ
         فاصلٌ واحد لا خطّان). **والمسافةُ وحدَها تفصل.** */
      className="mt-7 first:mt-0"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-bold min-w-0">
            <Icon name={icon} size={17} className={`shrink-0 ${tone ?? "text-accent"}`} />
            <span className="truncate">{title}</span>
          </h2>
          {note && <p className="mt-0.5 text-[11px] text-muted">{note}</p>}
        </div>
        {seeAllHref && seeAllLabel && (
          <Link
            href={seeAllHref}
            prefetch={false}
            className="shrink-0 mt-0.5 text-[12px] text-muted hover:text-accent transition"
          >
            {seeAllLabel}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/* **⚠️ `PeopleSearch` حُذف في يومه** (D-267، طلبُ أحمد: «احذف البحث لأنه
   مضاف في البحث عندي خيار ناس»): **بحثُ الشريط العلويّ فيه تبويبُ «أشخاص»
   منذ زمن** — فكان الحقلُ هنا **سطحاً ثانياً لسؤالٍ واحد** (D-222)،
   وبناؤه كان خطأَ جردٍ لا خطأَ تنفيذ: **قرأتُ «بلا سطحٍ هنا» في `05`
   ولم أفحص الأسطحَ الأخرى** — وقاعدةُ D-262 كانت تسأل: **هل هو مبنيٌّ
   وغيرُ موصول؟ بل كان مبنيّاً وموصولاً في مكانٍ آخر.**
   و`searchPeople` باقيةٌ لقارئها القائم (ورقةُ المحادثات وبحثُ الشريط). */

/** **ثلاثٌ في الصفّ على كل عرض** — وبطاقةُ الشخص واحدةٌ في الأقسام الثلاثة */
function CardGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-3 gap-2.5">{children}</ul>;
}

function PersonCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface border border-border">
      {children}
    </li>
  );
}

/**
 * **شارةُ المرتبة** — ذهبٌ وفضّةٌ وبرونز كما في اللوحة، **وما بعد الثالث
 * رقمٌ صامت**: الميداليةُ تمييزٌ، **وميداليةٌ للعاشر تُلغي معنى الأولى.**
 */
function RankBadge({ rank, locale }: { rank: number; locale: Locale }) {
  const tone =
    rank === 1
      ? "bg-accent text-black"
      : rank === 2
        ? "bg-[#C8CCD4] text-black"
        : rank === 3
          ? "bg-[#B77B45] text-white"
          : "bg-surface-2 text-muted border border-border";
  return (
    <span
      aria-hidden
      className={`absolute -bottom-1 -start-1 w-[22px] h-[22px] rounded-full grid place-items-center text-[11px] font-extrabold tabular-nums ${tone}`}
    >
      {num(rank, locale)}
    </span>
  );
}

/**
 * **لوحةُ النشاط — ثلاثةُ أقسامٍ بمكوّنٍ واحد** (D-198 · D-270).
 *
 * `mode="top"` يسأل عن **حجم** نافذة الأسبوع، و`mode="rising"` عن **الفرق**
 * بينها وبين التي قبلها — **ونداءٌ واحدٌ يخدمهما** لأن الدالّةَ ترجع
 * النافذتين معاً فالواجهةُ تطرح.
 * **و`mode="featured"` نافذةٌ أخرى بالكامل** (تسعون يوماً، الهجرة ٨٥)
 * **فصفوفُه تأتي من نداءٍ ثانٍ** — ولذلك `rows` تُمرَّر من الصفحة ولا
 * يفترض المكوّنُ مصدرَها.
 *
 * ⚠️ **والشكلُ واحدٌ فالمكوّنُ واحد** (D-145/D-222): ثلاثةُ أقسامٍ تعرض
 * **وجهاً ورقماً وتفصيلَه**، **ونسخةٌ ثالثة من بطاقةِ شخصٍ كانت ستكون
 * العائلةَ الرابعة.** **والمختلفُ ثلاثةُ أشياءٍ فقط**: الفرز، والميدالية،
 * والعنوان.
 *
 * ⚠️ **والفرزُ هنا لا في SQL**: الدالّةُ ترتّب بالمجموع، **والصاعدُ قد
 * يكون العاشرَ مجموعاً وهو الأوّل فرقاً** — فلو قُصّت القائمةُ في القاعدة
 * بثلاثةٍ لصار القسمُ الثاني نسخةً من الأوّل بترتيبٍ آخر.
 *
 * **والنافذةُ أسبوعٌ تقويميٌّ يبدأ السبت** (D-265، طلبُ أحمد «خلها يتصفر
 * كل سبت» — **نقضٌ صريحٌ لجوابه في D-264**): المرساةُ في SQL بتوقيت
 * الرياض، **فالرقمُ يقف يومَ السبت ولا يتدحرج.**
 */
export function PeopleLeaderboard({
  rows,
  locale,
  mode,
  limit = 3,
  seeAllHref,
  meId,
  following,
  follow = false,
}: {
  rows: PeopleLeaderRow[];
  locale: Locale;
  mode: "top" | "rising" | "featured";
  limit?: number;
  seeAllHref?: string;
  /**
   * 🆕 **أتُعرض علامةُ المتابعة؟** (D-281) — **`false` في المعاينة
   * و`true` في «عرض الكل»**، بحكم أحمد.
   *
   * **وهو صريحٌ لا مستنتَجٌ من `seeAllHref`**: صحيحٌ أن المعاينةَ وحدَها
   * تحمل رابطَ «الكل» اليوم، **لكنّ ربطَ فعلٍ بغياب رابطٍ اقترانٌ ينكسر
   * صامتاً** يومَ يظهر قسمٌ بلا رابط. **ما يُقصد يُكتب.**
   */
  follow?: boolean;
  /**
   * 🆕 **هويّتي — فلا يُعرض عليَّ أن أتابع نفسي** (D-275).
   */
  meId?: string;
  /**
   * 🆕 **من أتابعهم** (D-275) — **والحالةُ الابتدائية تأتي من الخادم**:
   * القسمُ يعرض الناسَ كلَّهم لا الغرباءَ وحدهم، **و«متابعة» تحت اسمِ من
   * تتابعه كذبةٌ يراها صاحبُها في الحال** (D-216).
   * **ونداءٌ واحدٌ مخزَّنٌ للصفحة** لا سؤالٌ من كل بطاقة (D-205/D-223).
   */
  following?: Set<string>;
}) {
  const t = getDict(locale);

  /* **ومن لم يصعد لا يظهر في «الصاعدين»**: فرقٌ صفرٌ أو سالبٌ ليس
     صعوداً، **و«زاد ٠» تحت عنوانٍ يقول «صاعدون» تكذب** (D-216).
     **و«المميّزون» يُفرزون بالمجموع كـ«الأكثر»** — والفرقُ نافذتُهما
     لا قاعدةُ فرزهما، **و`prevTotal` تصل صفراً فيهم دائماً.** */
  const list =
    mode === "rising"
      ? rows
          .map((r) => ({ r, delta: r.total - r.prevTotal }))
          .filter((x) => x.delta > 0)
          .sort((a, b) => b.delta - a.delta)
          .slice(0, limit)
          .map((x) => x.r)
      : [...rows].sort((a, b) => b.total - a.total).slice(0, limit);

  if (!list.length) return null;

  const icon: IconName =
    mode === "featured" ? "sparkle-star" : mode === "top" ? "chart" : "trending";
  const tone =
    mode === "featured"
      ? SECTION_TONE.featured
      : mode === "top"
        ? SECTION_TONE.top
        : SECTION_TONE.rising;
  const title =
    mode === "featured"
      ? t.peopleBoardFeatured
      : mode === "top"
        ? t.peopleBoardTop
        : t.peopleBoardRising;

  return (
    <BoardSection
      icon={icon}
      tone={tone}
      title={title}
      /* ⚖️ **وسقط سطرُ «آخر ٩٠ يوماً»** (D-283، طلبُ أحمد: «احذف هذي
         العبارة»). **وخانةُ `note` باقيةٌ في `BoardSection`** لمن
         يحتاجها لاحقاً — **الحذفُ للنصّ لا للأداة.**
         ⚠️ **والثمنُ يُقال:** كُتب السطرُ في D-270 لأن «مميّزون» تُقرأ
         «اخترناهم بأيدينا» وهم محسوبون. **وأحمد رآه ثم حكم** — وحكمٌ
         بعد رؤيةٍ غيرُ حكمٍ عن غياب (D-270). */
      seeAllHref={seeAllHref}
      seeAllLabel={t.seeAll}
    >
      <CardGrid>
        {list.map((p, i) => (
          <PersonCard key={p.id}>
            <PersonName
              person={p}
              t={t}
              size={56}
              vertical
              /* **الميداليةُ للوحة الأسبوع وحدها**: الصعودُ ليس ترتيباً
                 دائماً بل حركةَ أسبوع، **و«المميّزون» ثلاثةٌ متساوون في
                 صفةٍ واحدة لا سبّاقٌ ووصيف** — **وميداليةٌ في قسمين
                 تُلغي معنى الأولى** (حجّةُ `RankBadge` نفسُها). */
              badge={mode === "top" ? <RankBadge rank={i + 1} locale={locale} /> : undefined}
              /* **علامةُ المتابعة على حافّة الوجه — وفي «عرض الكل» وحدَه**
                 (D-281، طلبُ أحمد). **والزاويتان متقابلتان** فلا تصطدم
                 بالميدالية: هذه `top-end` وتلك `bottom-start`. */
              corner={
                follow && meId && p.id !== meId ? (
                  <FollowUserButton
                    variant="corner"
                    targetId={p.id}
                    locale={locale}
                    initialFollowing={following?.has(p.id) ?? false}
                  />
                ) : undefined
              }
              sub={
                <>
                  <span
                    className={`block text-[12px] font-bold tabular-nums ${
                      mode === "rising" ? "text-success" : "text-accent"
                    }`}
                  >
                    {mode === "rising"
                      ? t.peopleBoardDelta(p.total - p.prevTotal)
                      : t.peopleBoardActions(p.total)}
                  </span>
                  {/* **مكوّناتُ الرقم تحته** — وهي سببُ بقاء العدد صريحاً.
                      ⚠️ **وفي «الصاعدين» الرقمان اللذان يُطرحان لا
                      المكوّنات** (D-275): المكوّناتُ تجمع `total` **والعنوانُ
                      فرقٌ**، فكانت تكذب كلَّ أسبوعٍ يكون فيه رصيدٌ سابق —
                      **وتصادفت مع الحقّ ما دام `prev = 0`.** */}
                  <span className="block mt-0.5 text-[10px] opacity-80">
                    {mode === "rising"
                      ? t.peopleBoardVsLast(p.total, p.prevTotal)
                      : /* ⚖️ **والإعجابُ خرج من المكوّنات** (D-288، بعد
                           تشغيل ٨٩): **`total` صار مشاركاتٍ وآراءَ فقط**،
                           **وتفصيلٌ يذكر ثالثاً لا يجمعه العنوانُ كذبٌ**
                           (D-219/D-275). */
                        t.peopleBoardBreakdown(p.posts, p.reviews)}
                  </span>
                </>
              }
            />

            {/* ⚖️ **وسقط الزرُّ العريض تحت الوجه** (D-281 ينقض شكلَ D-275
                لا حجّتَه، بحكم أحمد: «حركة إضافة هذي ألغيها بالكامل…
                وما تكون هنا لأنها تسوّي للصفحة»).
                **وحجّةُ D-275 باقيةٌ حرفاً**: سطحُ اكتشافٍ بلا فعلٍ معرضٌ
                لا اكتشاف — **والفعلُ لم يُحذف، انتقل.**
                **وثلاثةُ أزرارٍ عريضة × أربعةِ أقسام = اثنا عشر نداءً
                للفعل في لوحةٍ وظيفتُها أن تُقرأ**: الصفحةُ تطول
                والبطاقاتُ تثقل، **وسطحُ العرض يصير سطحَ إدارة.**
                **فالمعاينةُ تُقرأ، و«عرض الكل» يُعمل فيه.** */}
          </PersonCard>
        ))}
      </CardGrid>
    </BoardSection>
  );
}

/**
 * **أعلى التعليقات إعجاباً** — **ثلاثةٌ لا واحد** (طلبُ أحمد، الهجرة ٨٢).
 *
 * **وواحدٌ كان قليلاً بحقّ:** قسمٌ يعرض صفّاً واحداً **لا يُقرأ قسماً بل
 * استثناء**، وثلاثةٌ تُظهر أن للموقع كلاماً يُعجب الناس. **والسقفُ كان
 * `limit 1` في جسم الدالّة** فلم يكن للواجهة أن تطلب أكثر — **حدٌّ
 * متجمّدٌ لا حارس** (D-193/D-264).
 *
 * **والبطاقةُ بابٌ إلى `/review`** حيث الردودُ والإعجاب، **ولا نسخةَ
 * ثانية من شريط الأفعال** (D-224). **والوجهُ في البداية والملصقُ في
 * النهاية** — عائلةُ صفّ النشاط نفسُها (D-222)، لا عائلةُ بطاقةِ الغرفة
 * التي لا وجهَ فيها (D-257).
 */
/**
 * 🆕 **ما يحفظه الناس — صفٌّ أفقيٌّ يكسر إيقاعَ اللوحة** (D-290، بلاغُ
 * أحمد على أوّل نسخة: «العنوان غيّره، والتصميم وطريقة العرض غيّرها…
 * وأنا أحتاج شيئاً بينهم يكسر طابعَ التكرار، وكان في بالي قائمة
 * الليست»).
 *
 * ================= لماذا صفٌّ أفقيٌّ لا صفوفٌ مكدّسة =================
 *
 * **الأقسامُ الأربعةُ حوله كلُّها إيقاعٌ واحد**: عنوانٌ ثم بطاقاتُ وجوهٍ
 * متجاورة. **ونسختي الأولى كانت صفّاً مكدّساً بملصقاتٍ صغيرة** — **شكلاً
 * خامساً من العائلة نفسِها، فلم تكسر شيئاً.**
 * **والكسرُ يقع بالإيقاع لا بالمحتوى**: صفٌّ **يُسحب أفقيّاً** ببطاقاتٍ
 * عريضةٍ فيها ثلاثةُ ملصقات **يختلف عن شبكة الوجوه في اتّجاهه وحجمه
 * معاً** — فتقع العينُ عليه فتعرف أنها غيّرت الموضوع.
 *
 * ================= ولا بطاقةَ جديدة =================
 *
 * **`CommunityListCard` مبنيّةٌ منذ D-063 وتخدم ثلاثةَ أبواب** (اكتشف ·
 * قوائمي المحفوظة · قوائم الشخص) — **وهذا رابعُها** (D-068/D-262: أرخصُ
 * مكوّنٍ هو الذي لا يُكتب، **وقبل أن يُبنى شيء يُسأل: أهو مبنيٌّ في
 * مكانٍ آخر؟**). **وسطرُ العدّ وحدَه اختلف** فصار `countLabel`.
 *
 * **و`PosterRail` هي ترويسةُ الصفّ نفسُها** التي تحملها رفوفُ التطبيق —
 * **بعنوانٍ ورمزٍ ورابط «الكل»**، فلا ترويسةَ ثانيةٌ تُخترع لهذا القسم
 * (D-002).
 */
export function TopSavedLists({
  rows,
  locale,
  seeAllHref,
}: {
  rows: SavedListRow[];
  locale: Locale;
  seeAllHref?: string;
}) {
  const t = getDict(locale);
  /* **ومن لا شيءَ له لا يُعرض في لوحة** (D-181) — والقسمُ يغيب كلَّه */
  if (!rows.length) return null;

  return (
    <PosterRail
      title={t.peopleBoardSavedLists}
      icon="bookmark"
      iconColor="#60A5FA"
      href={seeAllHref}
      seeAllLabel={seeAllHref ? t.seeAll : undefined}
    >
      {rows.map((row) => (
        /* **`wide` لا الافتراضي** — خانةُ الملصق أضيقُ من بطاقة قائمة
           (D-084)، **والبطاقاتُ كانت تتراكب.** */
        <RailItem key={row.listId} wide>
          <CommunityListCard
            list={{
              id: row.listId,
              name: row.name,
              kind: null,
              /* **واسمُ الصاحب من الحارس نفسِه** (D-011): `hide_name`
                 محسومةٌ في القاعدة، **ومخفيُّ الاسم يظهر بلا سطرِ صاحبٍ
                 أصلاً** — **وسطرٌ باسمٍ بديل يوحي بأن «مستخدم» شخصٌ
                 يُقصد** (حجّةُ `PublicListsRail` حرفاً). */
              owner: row.hideName ? null : (row.nickname ?? row.username),
              /* **لا يُقرأ**: `countLabel` يحلّ محلَّه — انظر أدناه */
              item_count: 0,
              posters: row.posters,
            }}
            locale={locale}
            /* **والمقياسُ يُكتب صريحاً**: القسمُ يرتّب بالحفظ **فالرقمُ
               الظاهرُ هو الحفظ** (D-219: الرقمُ يخصّ ما تحته). */
            countLabel={t.peopleBoardSaves(row.saves)}
            className="w-full"
          />
        </RailItem>
      ))}
    </PosterRail>
  );
}

export function TopReviews({
  rows,
  locale,
  seeAllHref,
}: {
  rows: PeopleTopReviewRow[];
  locale: Locale;
  seeAllHref?: string;
}) {
  const t = getDict(locale);
  if (!rows.length) return null;

  return (
    <BoardSection
      icon="heart-filled"
      tone={SECTION_TONE.reviews}
      title={t.peopleBoardTopReview}
      seeAllHref={seeAllHref}
      seeAllLabel={t.seeAll}
    >
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const poster = posterUrl(row.posterPath, "w185");
          const title = row.title?.trim();
          const reviewHref = `/review/${row.mediaType}/${row.tmdbId}/${row.id}`;
          const titleHref =
            row.mediaType === "tv" ? `/show/${row.tmdbId}` : `/movie/${row.tmdbId}`;
          return (
            <li key={`${row.id}-${row.mediaType}-${row.tmdbId}`}>
              <article className="relative overflow-hidden flex gap-3 p-3.5 rounded-2xl bg-surface border border-border">
                {/* ============ غلافُ العمل خلف البطاقة (D-283) ============
                    **طلبُ أحمد: «حط الخلفية غلاف الفلم على أفضل الردود،
                    يستاهلون».** **ووصفةُ `WorksTalk` نفسُها حرفاً**
                    (D-145: وصفةٌ تُنسخ ناقصةً عطلٌ لا أسلوب): صورةٌ
                    بـ`opacity-[0.40]` ثم طبقةٌ من لون السطح إلى الشفّاف
                    **باتّجاه البداية حيث يُقرأ النصّ**.
                    ⚠️ **والمصدرُ هو الملصقُ لا الغلافُ العريض**:
                    `ratings` لا تحمل `backdrop_path`، **وإضافتُه تغيّرُ
                    أعمدةِ الدالّة أي `drop`** — وهو خارج الإذن. **فالملصقُ
                    ممدودٌ بـ`object-cover`**، ويبقى الغلافُ الحقيقيّ
                    دَيناً مكتوباً. */}
                {poster && (
                  <>
                    <Image
                      src={poster}
                      alt=""
                      fill
                      sizes="680px"
                      className="object-cover opacity-[0.40] pointer-events-none"
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0 pointer-events-none bg-gradient-to-r rtl:bg-gradient-to-l from-[color:var(--surface)] via-[color:var(--surface)]/70 via-[55%] to-transparent"
                    />
                  </>
                )}
                <div className="relative min-w-0 flex-1 flex flex-col">
                  {/* **الترويسةُ ترويسةُ صفّ «النشاط» حرفاً** (D-272، طلبُ
                      أحمد: «خلي تنسيقه مثل الرفيو في اكتيفتي عشان
                      التناسق»): **وجهٌ ٤٤ · اسمٌ ثم عمرٌ مختصرٌ في الطرف ·
                      وسطرٌ ثانٍ فيه العملُ ونجمتُه.**

                      **وحجّةُ ذلك الصفّ تنتقل معه** (D-228): عنوانٌ طويل
                      بجانب الاسم يقصّهما معاً، **فسطرٌ يملكه العملُ يحلّها
                      بلا قصّ** — **و★ بعد العنوان لا بعد الاسم** لأن
                      الترويسةَ كلَّها كلامُ صاحب الصفّ فنجمتُها نجمتُه.

                      ⚠️ **والوسمُ الزمنيّ صار مختصراً** (`7d` لا «7 days
                      ago»): **جملةٌ في موضع وسمٍ تسرق العرضَ من الاسم**،
                      **وبابُه التعليقُ لا الملفّ** — ولهذا هو في `end`
                      خارج رابط الاسم. */}
                  <PersonName
                    person={row}
                    t={t}
                    size={44}
                    end={
                      <Link
                        href={reviewHref}
                        prefetch={false}
                        className="text-[11px] text-muted tabular-nums hover:text-accent transition"
                      >
                        {timeAgoShort(row.createdAt, t)}
                      </Link>
                    }
                    sub={
                      <span className="flex items-center gap-1.5">
                        {title && (
                          <Link
                            href={titleHref}
                            prefetch={false}
                            className="min-w-0 truncate text-[13px] hover:text-accent transition"
                          >
                            <bdi>{title}</bdi>
                          </Link>
                        )}
                        {row.rating > 0 && (
                          <span
                            className="shrink-0 text-[13px] font-bold text-accent tabular-nums"
                            title={t.rateOutOf(row.rating)}
                          >
                            ★ <span dir="ltr">{row.rating.toFixed(1)}</span>
                          </span>
                        )}
                      </span>
                    }
                  />

                  {/* **والكلامُ بعرض العمود تحت الوجه** — لا بجانبه (D-228) */}
                  <Link
                    href={reviewHref}
                    prefetch={false}
                    /* **الاتّجاه على الرابط لا على المقصوص** — D-282 */
                    dir={dirOf(row.review)}
                    className={`block mt-2 ${alignOf(row.review)}`}
                  >
                    <p className="text-[13px] leading-relaxed text-foreground/85 line-clamp-3">
                      {row.review}
                    </p>
                  </Link>

                  {/* **والإعجابُ يبقى وحدَه في الذيل** — **وهو سببُ وجود
                      القسم**: «أعلى التعليقات إعجاباً» بلا رقمِ إعجابٍ
                      عنوانٌ بلا دليل (D-219). **ولا شريطَ أفعالٍ ثانٍ**:
                      البطاقةُ بابٌ إلى `/review` حيث الردُّ والإعجاب
                      يعملان (D-224). */}
                  {/* **و`mt-auto` تُنزله إلى القاع** فيثبت موضعُه بين
                      البطاقات مهما قصُر الكلام (D-224) — **والملصقُ أطولُ
                      من النصّ في أكثر البطاقات، فبلا هذا يطفو الرقمُ في
                      وسط فراغ.** */}
                  <p className="mt-auto pt-2 inline-flex items-center gap-1.5 text-[12px] text-muted">
                    <Icon name="heart-filled" size={13} className="shrink-0" />
                    <span className="tabular-nums">{t.peopleBoardLikes(row.likes)}</span>
                  </p>
                </div>

                {/* **والملصقُ بعرض ملصقِ «النشاط» نفسِه** (٩٢px، طلبُ أحمد
                    «كبّره شوي»): **كان ٤٨×٧٢ فيُقرأ زينةً لا باباً** —
                    **ومقاسٌ ثانٍ لمعنًى واحدٍ في سطحين هو ما تمنعه
                    D-222.** **والنسبةُ ٢:٣ تحفظه من التمدّد** (D-046). */}
                <Link
                  href={titleHref}
                  prefetch={false}
                  className="relative w-[92px] aspect-[2/3] shrink-0 self-start rounded-xl overflow-hidden bg-surface-2 border border-border"
                >
                  {poster ? (
                    <Image src={poster} alt="" fill sizes="92px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted">
                      <Icon name={row.mediaType === "tv" ? "tv" : "film"} size={16} />
                    </span>
                  )}
                </Link>
              </article>
            </li>
          );
        })}
      </ul>
    </BoardSection>
  );
}

/* ⚠️ **`PeopleSuggestions` و`PeopleWatching` حُذفا** (D-270، طلبُ أحمد
   بالحرف: «نفس العناوين في الصورة المرسلة ما نبغى — People to follow ·
   Added to their libraries»).

   **وكانا يعملان ببياناتٍ حقيقية بلا عطل** — **والحذفُ حكمُ صاحبِ المنتج
   على قسمٍ لا حكمٌ على شيفرته.** وقد كتبتُ يومَ بنيتُهما أن «حذفَ ما يعمل
   لأنه غاب عن رسمةٍ ليس تصميماً»، **وهذه ليست تلك الحالة**: أحمد رأى
   القسمين مبنيَّين على شاشته **ثم حكم** — **وحكمٌ بعد رؤيةٍ غيرُ حكمٍ عن
   غياب.**

   **وحُذفا كاملَين ولم يُخفَيا** (D-214): **قسمٌ يُخفى بشرطٍ يبقى شيفرةً
   تُقرأ في كل مراجعةٍ ولا تُرسم على شاشة.** **وحجّتُهما محفوظةٌ في تاريخ
   الملفّ** — من أرادها وجدها، **ولا تُستنسخ من هنا يوماً.**

   ⚠️ **والترتيبُ معكوسٌ عمداً** (D-028): يسقطان من `page.tsx` **قبل** أن
   يسقطا من هنا — **ولو حُذفا من هنا أوّلاً لكسر البناءُ في نشرةٍ وسيطة**،
   وهو خطأٌ وقعتُ فيه فعلاً في `b9bf25a`. */
