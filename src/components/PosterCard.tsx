import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/media";
import { MarqueeText } from "./MarqueeText";
import { Icon, type IconName } from "./Icon";
import { QuickAdd } from "./QuickAdd";
import { PosterHold } from "./PosterHold";
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
  saved = false,
  watched = false,
  hold,
  quickAdd,
}: {
  href: string;
  title: string;
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
   * **خيطُ الحالة تحت الملصق** (D-229، طلبُ أحمد: «خطّ تحت البوستر — أخضر
   * شفته، رصاصي معناه في «للمشاهدة»، مثل ما احنا مسوّين في المكتبة»).
   *
   * **وهو ترقيةُ الخيط القائم لا خيطٌ ثانٍ:** كان يُرسم للتقدّم والإيقاف
   * وحدهما، **فعملٌ محفوظٌ لم يبدأ لا أثرَ له على وجهه** — والقارئ لا
   * يعرف أنه في مكتبته إلا بفتحه. **الرماديُّ يقول «عندك»، والأخضرُ
   * «انتهيت»** — بلا كلمةٍ ولا شارة.
   */
  saved?: boolean;
  watched?: boolean;
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
    locale: Locale;
  };
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
        {url ? (
          <Image
            src={url}
            alt={title}
            fill
            sizes="(max-width: 640px) 33vw, 160px"
            className="object-cover group-hover:scale-105 transition duration-300"
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
            className="absolute top-2 start-2 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
            style={{ background: BADGE_BG[badgeTone] }}
          >
            {badge}
          </span>
        )}
        {typeof count === "number" && count > 0 && (
          <span className="absolute top-2 end-2 grid place-items-center min-w-6 h-6 px-1.5 rounded-full bg-accent text-[color:var(--on-accent)] text-[11px] font-bold tabular-nums">
            {count}
          </span>
        )}
        {/* الاسم داخل الملصق على حجابٍ متدرّج: البطاقة مستطيلٌ واحد،
            والعين تقرأ الصورة والاسم في حركةٍ واحدة.
            **ويُطفأ كلُّه بـ`hideTitle`** — الحجابُ يذهب مع النصّ، فحجابٌ
            بلا نصٍّ ظلٌّ بلا سبب. */}
        {!hideTitle && (
        <div className="absolute inset-x-0 bottom-0 p-2 pt-7 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <p className="text-[12px] font-semibold leading-tight text-white line-clamp-2 drop-shadow">
            {title}
          </p>
          {year && <p className="text-[10px] text-white/60 mt-0.5">{year}</p>}
          {note && (
            /* السبب يتحرك ليُقرأ كاملاً حين يفيض (ملاحظة صديق أحمد —
               D-100): نصٌّ قصير يبقى ساكناً، والفائض يذهب ويعود */
            <MarqueeText text={note} className="text-[10px] text-accent-2/90 mt-0.5" />
          )}
        </div>
        )}

        {/* الحالة كلها في خيط اللون: أخضر مكتمل، بنفسجي قيد المشاهدة،
            أحمر موقوف — وما لم يبدأ لا خيط له إطلاقاً */}
        {(dropped || watched || saved || (progress ?? 0) > 0) && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
            <div
              className="h-full"
              style={{
                /* **الأولوية: موقوفٌ ثم منتهٍ ثم جارٍ ثم محفوظ** — وأخصُّ
                   الحالات يغلب أعمَّها، فعملٌ منتهٍ محفوظٌ يُقرأ منتهياً */
                width:
                  dropped || watched || (saved && (progress ?? 0) <= 0)
                    ? "100%"
                    : `${Math.max(0, Math.min(100, progress ?? 0))}%`,
                background: dropped
                  ? "var(--error)"
                  : watched || (progress ?? 0) >= 100
                    ? "var(--success)"
                    : (progress ?? 0) > 0
                      ? "var(--accent)"
                      : /* الرماديُّ حدُّ الملصق نفسُه: حالةٌ لا تُلحّ */
                        "var(--border)",
              }}
            />
          </div>
        )}
      </div>
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
      locale={hold.locale}
    >
      {card}
    </PosterHold>
  ) : (
    card
  );
}
