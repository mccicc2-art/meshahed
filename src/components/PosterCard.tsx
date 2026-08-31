import Link from "next/link";
import Image from "next/image";
import { posterUrl, POSTER_INTRINSIC } from "@/lib/media";
import { MarqueeText } from "./MarqueeText";
import { Icon, type IconName } from "./Icon";
import { QuickAdd } from "./QuickAdd";
import { PosterHold } from "./PosterHold";
import { StatusThread } from "./StatusThread";
import type { Locale } from "@/lib/i18n";

type BadgeTone = "neutral" | "progress" | "watched" | "rating" | "dropped";

/** لون الشارة يحمل معناها: لا يحتاج القارئ أن يقرأ ليعرف نوعها */
const BADGE_BG: Record<BadgeTone, string> = {
  neutral: "rgba(0,0,0,0.75)",
  progress: "var(--accent)",
  watched: "var(--success)",
  rating: "var(--verified)",
  dropped: "var(--error)",
};

export function PosterCard({
  href,
  title,
  titleSecondary = null,
  posterPath,
  year,
  badge,
  count,
  progress,
  note,
  badgeTone = "neutral",
  dropped = false,
  posterSize = "w342",
  fallbackIcon = "film",
  hideTitle = false,
  titleBelow = false,
  saved = false,
  savedMark = true,
  watched = false,
  hold,
  holdExtra,
  quickAdd,
}: {
  href: string;
  title: string;
  /**
   * 🆕 **السطرُ الثاني في وضع «المحلّي + الأصلي»** (D-544) — **`null`
   * في الأوضاع الثلاثة الأخرى وحين يتطابق الاسمان**، **فالقرارُ قرارُ
   * `resolveMediaTitle` لا قرارُ البطاقة** (لا شرطَ متفرّقٌ هنا).
   */
  titleSecondary?: string | null;
  posterPath: string | null;
  year?: string;
  badge?: string;
  /** رقمٌ في دائرة على الزاوية المقابلة — ما بقي من الحلقات */
  count?: number;
  progress?: number; // 0..100
  note?: string;
  /** waiting = حلقة جديدة تنتظرك (ذهبي) بدل الأخضر المعتاد */
  tone?: "default" | "waiting";
  /** لون الشارة: التقدّم بنفسجي، المُشاهَد برتقالي، التقييم أصفر */
  badgeTone?: BadgeTone;
  /** موقوف ببطاقة حمراء: الشريط كله أحمر مهما كان التقدّم */
  dropped?: boolean;
  /**
   * مقاس صورة TMDB. الأشخاص لهم دِلاء مقاساتٍ غير دِلاء الملصقات — و`w342`
   * ليس منها، فصورة الممثل تعود مكسورة. `w185` صالحٌ للنوعين.
   */
  posterSize?: "w185" | "w342";
  /** أيقونة الفراغ: فيلمٌ للأعمال، وشخصٌ للأشخاص */
  fallbackIcon?: IconName;
  /**
   * **ملصقٌ بلا اسمٍ مكتوبٍ عليه** (D-225، بلاغُ أحمد: «ملصقاتٌ كثيرة اسمُ
   * المسلسل مكتوبٌ فيها أصلاً»).
   *
   * **وهو صحيح:** فنُّ الملصق يحمل العنوان في تصميمه، **فحجابُنا يكتبه
   * مرّةً ثانية على وجه العمل** — «تابو» فوق ملصقٍ مكتوبٍ عليه TABOO.
   * **يُطفأ حيث يكون للاسم بيتٌ آخر** (سطرُ الترويسة في خطّ النشاط)،
   * **ويبقى مضاءً في الشبكات** حيث الملصقُ وحده بلا نصٍّ يجاوره.
   * ⚠️ **ولا يُطفأ إلا مع بديل:** ملصقٌ بلا اسمٍ في سياقٍ بلا اسم لغزٌ.
   */
  hideTitle?: boolean;
  /**
   * 🆕 **الاسمُ تحت الملصق لا عليه** (D-435، الهويّةُ الجديدة).
   *
   * **والحجّةُ القديمة كانت صحيحةً في زمنها**: حجابٌ متدرّجٌ يجمع الصورةَ
   * والاسمَ في مستطيلٍ واحد. **وثمنُها ثلثُ الملصق مطموسٌ في كلِّ بطاقة**
   * — وملصقُ العمل هو ما يتعرّف عليه القارئ قبل أن يقرأ، **فطمسُه لكتابة
   * ما تقوله الصورةُ نفسُها إنفاقٌ من رأس المال.**
   *
   * ⚠️ **ومعامِلٌ مؤقّتٌ لا وجهان دائمان**: الأسطحُ تنتقل قسماً قسماً
   * (الرئيسيةُ أوّلاً، ثم المكتبةُ فالاستكشاف)، **ويسقط المعامِلُ ويصير
   * السلوكَ الوحيد يومَ لا يبقى مستدعٍ للحجاب** — نفسُ نمط «الاسم القديم
   * يُقبل مؤقّتاً ثم يُحذف» (D-433).
   */
  titleBelow?: boolean;
  /**
   * **خيطُ الحالة تحت الملصق** (D-229، طلبُ أحمد: «خطّ تحت البوستر — أخضر
   * شفته، رصاصي معناه في «للمشاهدة»، مثل ما احنا مسوّين في المكتبة»).
   *
   * **وهو ترقيةُ الخيط القائم لا خيطٌ ثانٍ:** كان يُرسم للتقدّم والإيقاف
   * وحدهما، **فعملٌ محفوظٌ لم يبدأ لا أثرَ له على وجهه** — والقارئ لا
   * يعرف أنه في مكتبته إلا بفتحه. **الرماديُّ يقول «عندك»، والأخضرُ
   * «انتهيت»** — بلا كلمةٍ ولا شارة.
   */
  saved?: boolean;
  /**
   * 🆕 **هل يُرسم خيطُ «عندك»؟** (D-437).
   *
   * **الخيطُ أربعُ حالاتٍ، وثلاثٌ منها تفرّق**: منتهٍ · قيد المشاهدة ·
   * موقوف. **والرابعة — «في مكتبتك» — تفرّق في أسطح الاكتشاف وحدَها**؛
   * **وفي صفٍّ عنوانُه «للمشاهدة» أو شبكةٍ اسمُها «مكتبتي» هي تكرارٌ
   * لعنوان القسم على كلِّ بطاقةٍ فيه** (نفسُ حكم شارة «ما بدأته»،
   * D-434). **والافتراضيُّ `true` فلا يتغيّر سطرٌ عند أحد** (D-152).
   */
  savedMark?: boolean;
  watched?: boolean;
  /* ⚠️ **ويُتجاهلان حين يُمرَّر `hold`** — هناك تسكن الحالةُ التفاؤلية،
     **وخيطان لحالةٍ واحدة يفترقان عند أوّل ضغطة** (D-235). **والحدُّ
     بين الخادم والعميل هو ما يمنع توحيدَهما**: تمريرُ الحالة من هناك
     إلى هنا تمريرُ دالّةٍ عبر الحدّ، وقد جُرِّب فأسقط الصفحة (D-238). */
  /**
   * **الضغطُ المطوَّل بأفعاله الثلاثة** — يُمرَّر حيث تكون البطاقة عملاً
   * يملك القارئ أن يفعل به شيئاً. **وحيث لا يُمرَّر لا يتغيّر شيء**:
   * بطاقةُ ممثّلٍ لا تُتابَع كعمل، وبطاقةٌ في ورقة اختيارٍ ليست سطحَ فعل.
   */
  hold?: {
    tmdbId: number;
    mediaType: "tv" | "movie";
    added: boolean;
    watched: boolean;
    /** 🆕 D-322: التقدّمُ والإيقافُ يعبران معه — الخيطُ هناك لا هنا */
    progress?: number;
    dropped?: boolean;
    locale: Locale;
  };
  /**
   * 🆕 **صفٌّ رابعٌ في قائمة الضغط المطوَّل يملكه السطح** (D-322) —
   * «غير مهتم» في «مقترح لك». **ولا يمرّ إلا من مكوّن عميل** (فيه دالّة)،
   * ولذلك هو منفصلٌ عن `hold` المسلسَل: **لا يُغري خادماً بتمرير دالّة
   * عبر الحدّ** (D-235).
   */
  holdExtra?: { icon: IconName; label: string; run: () => void };
  /**
   * **زرُّ «+ للمشاهدة» على هذه البطاقة** (D-207 — امتدادُ D-205).
   *
   * **ولماذا اختياريّ لا افتراضيّ:** البطاقةُ نفسها تُرسم في ثمانية أسطح —
   * المكتبة، والبحث، وصفحةُ الشخص، والأعمالُ المشابهة، وطاقمُ العمل.
   * **وفي المكتبة الزرُّ عبثٌ** (كلُّ ما فيها مُضافٌ أصلاً)، **وعلى
   * الممثّلين خطأٌ** (لا يُتابَع شخصٌ كعمل). فمن يعرف أن سياقَه «عملٌ
   * قابلٌ للإضافة» يمرّره، ومن لا يعرف لا يدفع شيئاً.
   *
   * ⚠️ **و`added` يأتي من المستدعي لا من نداءٍ هنا** — لنفس سبب D-205:
   * شبكةٌ من ستّين بطاقةً تسأل كلُّ واحدةٍ عن نفسها هي ستّون استعلاماً.
   */
  quickAdd?: {
    tmdbId: number;
    mediaType: "tv" | "movie";
    added: boolean;
    locale: Locale;
  };
}) {
  const url = posterUrl(posterPath, posterSize);
  const card = (
    // prefetch={false}: الصفحة الواحدة فيها عشرات البطاقات، والتحميل المسبق
    // الافتراضي يطلق طلب RSC لكل بطاقة تدخل الشاشة — عشرات الطلبات المتزامنة
    // كانت ترجع 503 وتُبطئ التنقّل الفعلي. الرابط يُحمَّل عند النقر.
    <Link href={href} prefetch={false} className="group block">
      <div className="relative aspect-[2/3] rounded-poster overflow-hidden bg-surface border border-border">
        {/* 🆕 `width`/`height` لا `fill` (D-845): مرشَّحا srcset بدل
            ~١٣ متطابقاً — انظر `POSTER_INTRINSIC` في `lib/media.ts`. */}
        {url ? (
          <Image
            src={url}
            alt={title}
            {...POSTER_INTRINSIC[posterSize]}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted">
            <Icon name={fallbackIcon} size={26} />
          </div>
        )}
        {/* **والزرُّ لا يُرسم مع شارة العدد**: كلاهما في `top end`، ورقمُ
            الحلقات المتبقية يعني أن العملَ في المكتبة أصلاً — فالإضافةُ
            لغوٌ هناك لا مزاحمةٌ على الزاوية. */
        quickAdd && !(typeof count === "number" && count > 0) && (
          <QuickAdd
            tmdbId={quickAdd.tmdbId}
            mediaType={quickAdd.mediaType}
            title={title}
            posterPath={posterPath}
            added={quickAdd.added}
            locale={quickAdd.locale}
          />
        )}
        {badge && (
          <span
            className="absolute top-2 start-2 text-12 font-semibold px-2.5 py-1 rounded-full text-white"
            style={{ background: BADGE_BG[badgeTone] }}
          >
            {badge}
          </span>
        )}
        {typeof count === "number" && count > 0 && (
          <span className="absolute top-2 end-2 grid place-items-center min-w-6 h-6 px-1.5 rounded-full bg-accent text-[color:var(--on-accent)] text-12 font-bold tabular-nums">
            {count}
          </span>
        )}
        {/* الاسم داخل الملصق على حجابٍ متدرّج: البطاقة مستطيلٌ واحد،
            والعين تقرأ الصورة والاسم في حركةٍ واحدة.
            **ويُطفأ كلُّه بـ`hideTitle`** — الحجابُ يذهب مع النصّ، فحجابٌ
            بلا نصٍّ ظلٌّ بلا سبب. */}
        {!hideTitle && !titleBelow && (
        <div className="absolute inset-x-0 bottom-0 p-2 pt-7 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          {/* 🆕 **سطرٌ واحدٌ يمشي لا سطران يُقصّان** (D-486، طلبُ أحمد
              ٢٠ أغسطس: «أسماء كل الأفلام والمسلسلات خلّها سطر واحد يمشي
              مثل عبارة لأنك شاهدت»). **وهي الوصفةُ التي أثبتت نفسَها
              في السبب** (D-100): القصيرُ ساكنٌ تماماً، **والفائضُ وحدَه
              يذهب ويعود** — فيُقرأ كاملاً بدل أن يُبتر بـ`…`. */}
          <MarqueeText
            text={title}
            dir="auto"
            className="text-12 font-semibold leading-tight text-white drop-shadow"
          />
          {year && <p className="text-[10px] text-white/60 mt-0.5">{year}</p>}
          {note && (
            /* السبب يتحرك ليُقرأ كاملاً حين يفيض (ملاحظة صديق أحمد —
               D-100): نصٌّ قصير يبقى ساكناً، والفائض يذهب ويعود */
            <MarqueeText text={note} className="text-[10px] text-accent-2/90 mt-0.5" />
          )}
        </div>
        )}

        {/* 🆕 ⚖️ **والسببُ يعود داخل الملصق حتى حين ينزل الاسمُ تحته**
            (D-486، نقضُ شطرٍ من D-448 بطلب أحمد: «عبارة because you
            حطّها داخل البوستر بالأسفل مثل قبل»). **وحجّةُ D-448 كانت
            أنّ سطراً بحجم ١٠ فوق صورةٍ مجهولةِ الألوان لا يُقرأ** —
            **والحجابُ المتدرّجُ هو جوابُ ذلك لا نزولُ السطر**، وهو
            قائمٌ هنا كما كان. **والمكسبُ أنّ البطاقةَ تعود سطرين تحت
            الملصق بدل ثلاثة**، فيقصر الصفُّ ويستوي مع بقيّة الرفوف. */}
        {titleBelow && note && (
          <div className="absolute inset-x-0 bottom-0 p-2 pt-7 bg-gradient-to-t from-black/90 via-black/55 to-transparent">
            <MarqueeText text={note} className="text-[10px] text-accent-2/90" />
          </div>
        )}

        {/* الحالة كلها في خيط اللون: أخضر مكتمل، أصفر قيد المشاهدة،
            **سماويّ في مكتبتك**، أحمر موقوف — وما لم يبدأ لا خيط له إطلاقاً */}
        {/* **والوصفةُ صارت في `StatusThread` وحدَها** (D-322): كانت هنا
            ونسخةٌ ثانيةٌ في `PosterHold`، **فصُحّح الأصلُ وبقيت النسخةُ
            رماديّةً سبعةَ أيام** (D-289). **ودفعةٌ تضيف حالتين جديدتين
            إلى النسختين معاً هي أرخصُ لحظةٍ للاستخراج.**
            **و`hold` يُسكتها هنا** لأنه يرسمها بحالته التفاؤليّة
            (D-235) — **خيطان لحالةٍ واحدة يفترقان عند أوّل ضغطة.** */}
        {!hold && (
          <StatusThread
            saved={savedMark && saved}
            watched={watched}
            progress={progress}
            dropped={dropped}
          />
        )}
      </div>

      {/* **سطرُ الاسم تحت الملصق** — سطران بحدٍّ أقصى ثم قصّ، **ولا سنةٌ
          ولا نبذةٌ معه في الرئيسية**: الصفُّ يُقرأ عمودياً، **وسطرٌ ثالث
          يجعل بطاقاتِ الصفّ الواحد متفاوتةَ الارتفاع.** و`dir="auto"`
          للعناوين المختلطة. */}
      {!hideTitle && titleBelow && (
        <div className="mt-1.5 px-0.5">
          {/* ⚖️ 🆕 **١٢px/٥٠٠ — مقاسُ اسمِ البطاقة في كلِّ رفٍّ** (D-486،
              طلبُ أحمد بلقطةٍ تجمع الرفّين: «خط اسم الفلم في بيكيد فور
              يو خلّه مثل خط الأفلام تحت»). **ونقضُ الدرجة ١٥ من D-454
              مسجَّلٌ بسببه**: `RankedRail` كان يكتب اسمَه بـ١٢ وهذا
              بـ١٥، **فرفّان متجاوران في شاشةٍ واحدة باسمين بمقاسين** —
              **وذلك بعينه ما تمنعه القاعدة ٦**، وحكمُ المالك أن الأصغر
              هو الصحيح. */}
          <MarqueeText
            text={title}
            dir="auto"
            className="text-12 font-medium leading-tight"
          />
          {/* 🆕 **الاسمُ الأصليُّ تحته بحجمٍ أصغر** (D-544) — **ولا
              `MarqueeText` له**: سطرٌ ثانٍ متحرّكٌ فوق سطرٍ متحرّك حركةٌ
              مزدوجةٌ في كلِّ بطاقةٍ في الشبكة، **والثانويُّ يُقصّ.**
              **و`dir="auto"` عليه وحدَه** لأنه قد يخالف الأوّل اتّجاهاً. */}
          {titleSecondary && (
            <p
              dir="auto"
              className="text-[10px] text-muted leading-tight mt-0.5 truncate"
            >
              {titleSecondary}
            </p>
          )}
          {year && <p className="text-12 text-muted mt-0.5">{year}</p>}
          {/* ⚠️ **والسببُ ليس هنا** — عاد إلى الحجاب داخل الملصق أعلاه */}
        </div>
      )}
    </Link>
  );

  /* **الضغطُ المطوَّل غلافٌ لا تعديلٌ في البطاقة**: من لا يمرّره يحصل على
     البطاقة نفسِها بلا عقدةٍ إضافية في الشجرة (D-229). */
  return hold ? (
    <PosterHold
      tmdbId={hold.tmdbId}
      mediaType={hold.mediaType}
      title={title}
      posterPath={posterPath}
      added={hold.added}
      watched={hold.watched}
      progress={hold.progress}
      dropped={hold.dropped}
      titleBelow={titleBelow}
      savedMark={savedMark}
      extra={holdExtra}
      locale={hold.locale}
    >
      {card}
    </PosterHold>
  ) : (
    card
  );
}
