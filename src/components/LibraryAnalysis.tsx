import {
  getFollows,
  getMyRatings,
  getWatchedMovies,
  watchedMovieMinutes,
  getAllWatchedEpisodes,
  getWatchHistory,
  getProfile,
  getUser,
  getFollowStats,
  getProfileFavorites,
  getMyAnimeFlags,
  getTitleMetaFor,
} from "@/lib/data";
import { getTv, getMovie } from "@/lib/tmdb";
import { posterUrl, profileUrl } from "@/lib/media";
import Image from "next/image";
import Link from "next/link";
import { getDict, num, type Locale } from "@/lib/i18n";
import { isComplete } from "@/lib/progress";
import { favoriteTrio, trioPosterPaths } from "@/lib/heroPosters";
import { ProfileStatSheet } from "./ProfileStatSheet";
import { PosterCard } from "./PosterCard";
import { Icon, type IconName } from "./Icon";
import { browseGenreForId, browseGenreName } from "@/lib/browse";

/** المدى الزمنيّ الذي تحكمه تبويبات الصفحة */
export type StatsRange = "all" | "year" | "month";

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * ⚖️ 🆕 **D-709: الأيّامُ وحدَها** (حكمُه: «احذف عدد الساعات لأن عدد
 * الأيام يكفي») — **نقضٌ مسجَّلٌ لصيغة `daysAndHours` في هذا السطح**:
 * الرقمُ الكبيرُ حجمُ عمرِ مشاهدتك، **وساعاتٌ بجانب خمسةٍ وخمسين يوماً
 * دقّةٌ لا يقرؤها أحد.**
 * ⚠️ **وما دون اليوم يبقى بالساعات**: «٠ يوم» لمن شاهد خمسَ ساعاتٍ
 * كذبٌ (D-217) — **والدقّةُ تُحذف حيث لا تُقرأ لا حيث تصنع المعنى.**
 */
/**
 * 🆕 **ظلُّ كلامِ البطاقة السينمائيّة** (D-712) — **أربعُ طبقاتٍ بـ٧٠٪**:
 * ملتصقةٌ تحدُّ الحرف، وثالثةٌ ورابعةٌ تُطفئان ما خلفه. **وواحدةٌ عريضةٌ
 * وحدَها تُقرأ صندوقاً لا ظلّاً**، **وواحدةٌ ضيّقةٌ وحدَها لا تنقذ حرفاً
 * فوق ملصقٍ أبيض.**
 */
const HERO_TEXT_SHADOW =
  "0 1px 2px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.7), 0 0 9px rgba(0,0,0,0.7), 0 0 9px rgba(0,0,0,0.7)";

/** **والرمزُ لا يرث ظلَّ الحرف** — `drop-shadow` بالقوّة نفسِها (D-712) */
const HERO_ICON_SHADOW = "drop-shadow(0 0 5px rgba(0,0,0,0.7))";

/**
 * 🆕 **عددُ ملصقاتِ خلفيّة الخانة** (D-717) — **ثلاثةٌ لا أربع**:
 * الخانةُ عرضُها نصفُ البطاقة، **ورابعٌ يصير شريطاً بعرضِ إصبع** فلا
 * يُعرف عملاً. **وستُّ خاناتٍ × ٣ = ثمانيةَ عشرَ ملصقاً**، وهو الثمنُ
 * المعلَن (تُطلب بـ`w185` وتُصغَّر، وكلُّها تحت ١٥٪ رماديّةً).
 */
const BG_POSTERS = 3;

/**
 * 🆕 **سقفُ قائمةِ الصفّ الواحد** (D-721) — **ثلاثون عملاً.**
 * ⚠️ **والسقفُ يُقال ولا يُخفى**: «عقد 2020» عندك ثلاثُمئة عمل، **وشبكةٌ
 * بثلاثمئة بطاقةٍ تُرسَل في حمولة كلِّ فتحةٍ للصفحة** — **والورقةُ
 * تُرسم مع الصفحة لا عند فتحها** (`ProfileStatSheet` تأخذ محتواها
 * مرسوماً من الخادم). **فيُقصّ ويُكتب العددُ الحقيقيُّ في رأس الورقة**
 * (D-217: لا رقمَ يَعِد بما لا يُعرض).
 */
const ROW_WORKS = 30;

function fmtWatchTime(minutes: number, t: ReturnType<typeof getDict>) {
  const h = Math.round(minutes / 60);
  if (h < 24) return t.hours(h);
  return t.days(Math.floor(h / 24));
}

/**
 * 🆕 **خانةُ شريط الأرقام** (D-682، مواصفةُ أحمد المكتوبة): **رمزٌ أصفرُ
 * عارٍ فوق رقمٍ فوق اسمه** — القرصُ المطوَّق سقط بنصّها («لا كروت ولا
 * Pills منفصلة لكل رقم») — **وأربعُ خاناتٍ في صفٍّ واحدٍ دائماً**
 * بفواصلَ رأسيّةٍ خفيفة.
 */
function StripCell({
  icon,
  value,
  label,
  border,
}: {
  icon: IconName;
  value: string;
  label: string;
  border: string;
}) {
  return (
    /* 🆕 D-687 (حكمُه بلقطة الشريط): **الرمزُ بجوار الرقم لا فوقه** —
       سطرٌ واحدٌ للاثنين والاسمُ تحتهما، **والهوامشُ الداخليّةُ قُلّلت**
       (py-2 · gap-1). والرمزُ في طرف البداية فيتبع اتّجاهَ القراءة. */
    <div className={`flex flex-col items-center gap-1 py-2 px-1 min-w-0 ${border}`}>
      <span className="flex items-center gap-1.5">
        <Icon name={icon} size={15} className="text-accent shrink-0" />
        <span className="text-[16px] font-bold leading-none tabular-nums" dir="ltr">
          {value}
        </span>
      </span>
      <span className="text-[11px] text-muted truncate max-w-full">{label}</span>
    </div>
  );
}

/**
 * 🆕 **بياناتُ التحليل — عقدُ الوجهِ الواحد** (D-649).
 *
 * 🔴 **ولماذا عقدٌ لا مكوّنان**: الشاشةُ نفسُها تُرسم الآن لقارئين —
 * **صاحبُها بمداه الكامل، وزائرُ ملفِّه بما تسمح به دوالُّ `definer`** —
 * **ونسخةٌ ثانيةٌ من الوجه تفترق عند أوّل تعديل** (D-145/القاعدة ٣).
 * **فالوجهُ واحدٌ والقارئان اثنان.**
 *
 * ⚠️ **وما لا يُقرأ صدقاً يغيب لا يُصفَّر**: `year = null` تعني «هذا
 * القارئ لا يملك تواريخَ مشاهدةٍ يقرؤها» **فيسقط السطرُ كلُّه** —
 * **وصفرٌ في خانةٍ يقول «لم يشاهد شيئاً» وهو كذب** (D-217).
 */
/**
 * 🆕 **بطاقةُ «ذوقك» الكاملة** (D-700، صورةُ أحمد بالضبط): سماتٌ ثمّ
 * ستُّ خانات — أنواعٌ وسنواتٌ ولغاتٌ وتنوّعٌ ومخرجون وممثلون.
 * **وكلُّ خانةٍ بلا بياناتٍ تغيب لا تتصفّر** (D-217).
 */
/**
 * 🆕 **عملٌ خلف رقمٍ في بطاقة الذوق** (D-721، حكمُه: «الأشياء التي عليها
 * خطّ أحتاج أقدر أضغط عليها وتطلع قائمة بالأفلام أو باقي التصنيفات»).
 *
 * 🔑 **ورقمٌ يُضغط فيُري ما عدّه هو الفرقُ بين إحصائيّةٍ وسجلّ**:
 * «٢٩ عملاً بالإنجليزيّة» خبرٌ، **و«هذه هي» جوابٌ.**
 */
export interface TasteWork {
  mediaType: "tv" | "movie";
  tmdbId: number;
  title: string;
  poster: string | null;
}

/** صفٌّ في خانةٍ — اسمُه ورقمُه **وما خلفه** (D-721) */
interface TasteRowBase {
  /** الأعمالُ خلف الرقم، مقصوصةً بسقفٍ معلَن */
  works: TasteWork[];
  /** العددُ الحقيقيُّ قبل القصّ — **والسقفُ يُقال ولا يُخفى** (D-217) */
  total: number;
}

export interface TasteData {
  /** سماتٌ مشتقّةٌ من توزيع الأنواع — نصوصٌ جاهزةٌ بلغة القارئ */
  themes: string[];
  genres: ({ name: string; pct: number } & TasteRowBase)[];
  decades: ({ label: string; pct: number } & TasteRowBase)[];
  languages: ({ code: string; name: string; titles: number } & TasteRowBase)[];
  /** 🆕 D-703: أعلى بلدين بعدِّ أعمالهما — بدل رقمٍ مجرّد */
  countries: ({ name: string; titles: number } & TasteRowBase)[];
  /** وصفُ التنوّع بجانب عنوان الخانة — `null` حين لا بلدَ يُقرأ */
  diversityLevel: string | null;
  directors: ({ name: string; titles: number } & TasteRowBase)[];
  actors: ({ name: string; titles: number } & TasteRowBase)[];
  /**
   * 🆕 **ملصقاتُ خلفيّةِ كلِّ خانة** (D-717، اختيارُ أحمد «مقترح ٢ —
   * مكتبتك خلفك» من لوحين عُرضا عليه): **الأعمالُ التي صنعت رقمَ
   * الخانة**، ثلاثةٌ لكلٍّ — **لا زخرفةٌ تُقحم، بل الدليلُ خلف الرقم.**
   */
  posters: {
    genres: string[];
    decades: string[];
    languages: string[];
    countries: string[];
    /**
     * 🆕 **وخانتا الأشخاص وجوهُهم لا ملصقاتُهم** (D-718، حكمُه:
     * «نفّذها»): **الاسمُ المكتوبُ والوجهُ خلفه شيءٌ واحد** — **وملصقُ
     * عملٍ خلف اسمِ مخرجٍ يقول «هذه أعمالُه» وهي جملةٌ أضعفُ من
     * «هذا هو».** ووجهٌ لكلِّ اسمٍ معروض، بترتيبه.
     */
    directors: string[];
    actors: string[];
  };
}

export interface AnalysisData {
  /** دقائقُ المدى المعروض */
  minutes: number;
  episodes: number;
  movies: number;
  /** 🆕 D-698: خانتا «المسلسلات» و«التعليقات» بأسماء أحمد الأربعة */
  shows: number;
  reviews: number;
  /** 🆕 D-700: مدى الترويسة نصّاً جاهزاً («كل الأوقات» · «2026» · «أغسطس») */
  rangeLabel: string;
  /** 🆕 D-700: ملصقاتُ خلفيّة الترويسة — أوّلُ المفضّلة في كلِّ قائمة
      (مسلسل · أنمي · فيلم) والانتقاءُ الفئويُّ سدُّ النقص */
  heroPosters: string[];
  /** 🆕 D-700: بطاقةُ «ذوقك» الكاملة — والغيابُ يُسقط البطاقةَ لا يصفّرها */
  taste: TasteData | null;
  /** 🆕 **القارئُ صاحبُ الأرقام؟** (D-649) — **يقرّر ضميرَ النصّ وحدَه**:
      «ذوقك» في ملفِّ غيرك تخاطب القارئ عن أرقام سواه (D-217). */
  mine: boolean;
  /** 🆕 **ترويسةُ الهويّة** (D-679، تصميمُ أحمد): وجهٌ واسمٌ ومتابِعون
      ونبذةٌ وغلافٌ خلفَها — والغيابُ يعني قارئاً بلا ملفٍّ يُقرأ. */
  hero?: {
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    followers: number | null;
  } | null;
}

/**
 * **وجهُ التحليل** — رسمٌ خالصٌ بلا قراءةٍ واحدة (D-649).
 *
 * **شكلُ الصفحة كما رسمه أحمد** (D-493) بحرفه — **والمنقولُ هنا هو
 * الرسمُ وحدَه**، ولم يُمسَّ منه شيءٌ سوى أن مصادرَه صارت وسائطَ.
 */
export function AnalysisView({ data, locale }: { data: AnalysisData; locale: Locale }) {
  const t = getDict(locale);
  const {
    minutes: rangeMinutes,
    episodes: rangeEpisodes,
    movies: rangeMovies,
    shows,
    reviews,
    rangeLabel,
    heroPosters,
    taste,
    mine,
    hero,
  } = data;
  const divider = "border-[color:var(--divider)]";

  /* ⚖️ 🆕 **D-705: الكتلةُ عادت إلى ما كانت** (حكمُه بعد أن رآها في
     طرفها: «هذي رجعها مثل ماكانت») — **نقضُ D-703/١ بيد صاحبه بعد
     الرؤية**: الوقتُ تحت الهويّة في عمود الحجاب، بلا هالةٍ ولا طرف،
     والرقمُ ٣٤ كما كان. **والباقي من D-703 لم يُمسّ** (الصفوفُ
     الموحّدةُ والتنوّعُ والاسمُ في الرئيسية)، **وترتيبُ الملصقات
     يبقى بحكم D-704.** */
  /* ⚖️ 🆕 **D-721: الكتلةُ انتقلت إلى الزاوية المقابلة** (حكمُه بلقطةٍ
     محوَّطة: «وقت المشاهدة غيّر مكانه — الجهة الثانية في الزاوية تحت»).

     ⚖️ **نقضٌ لـD-705 بيد صاحبه** — وتلك كانت نقضاً لـD-703/١، **فهذه
     ثالثةُ جولةٍ على موضع رقمٍ واحد.** 🔑 **والفرقُ أن الجولتين
     الأوليين حرّكتاه داخلَ عموده** (الحجابُ كان يحرس جهةَ البداية
     وحدَها فبدا الطرفُ الآخرُ عارياً) — **وحجابُ D-712 صار مستوياً على
     البطاقة كلِّها، فلم يعد للعمود معنًى ولا للزاوية المقابلة خطر.**
     **فالحركةُ التي فشلت مرّتين نجحت لأن ما منعها قد تغيّر.**

     ⚠️ **والانتقالُ منطقيٌّ لا يمينيٌّ**: `items-end` و`text-end`
     ترتدّان مع الاتّجاه (القاعدة ١٧) — **والهويّةُ تبقى في صدر البطاقة
     والوقتُ في ذيلها المقابل**، فيقرأ العينُ قُطراً لا عموداً. */
  const bigTime = (
    <div className="mt-4 flex flex-col items-end text-end">
      <div
        className="text-[30px] font-semibold leading-none tabular-nums"
        style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
        dir="auto"
      >
        {fmtWatchTime(rangeMinutes, t)}
      </div>
      {/* 🆕 D-700: المدى المختارُ يُقال بجوار اسم الرقم */}
      <div className="mt-1.5 text-12 text-muted">
        {t.statWatchTime} · {rangeLabel}
      </div>
      <svg aria-hidden viewBox="0 0 220 24" fill="none" className="mt-2 h-4 w-36 text-accent/70" style={{ filter: HERO_ICON_SHADOW }}>
        <path d="M2 20 C 58 4, 140 24, 218 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ===== البطاقةُ السينمائيّة (D-682 → D-700) ===== */}
      {hero ? (
        /* 🆕 **وارتفاعُها +١٠٪** (D-713، حكمُه: «الكارد الأول زيد ارتفاعه
           ١٠٪»). **والزيادةُ حشوٌ رأسيٌّ لا كتلةٌ أكبر**: الاسمُ والنبذةُ
           والرقمُ بمقاساتٍ ضُبطت بالقياس (D-682 → D-707) — **وتكبيرُها
           يغيّر الإيقاع، وتوسيعُ الحشو يغيّر المساحةَ وحدَها**
           (وصفةُ D-489 على الشريط السفليّ حرفاً). **والملصقاتُ ترث
           الزيادةَ كلَّها** لأنها `inset-0` — **وهي المستفيدُ المقصود:
           كارد الفنِّ يكبر فنُّه.**
           📏 **مقيسٌ عند ٣٩٠px**: ٢١٩٫٨ → ٢٤٣٫٨ (+١٠٫٩٪) — **و`py-7`
           رقمٌ من السلّم، و`27px` كان سيصيب العشرةَ بالضبط ويخرج عنه**
           (القاعدة ١٧). */
        <section className="relative overflow-hidden isolate rounded-2xl border border-border bg-surface px-4 py-7">
          {/* ⚖️ D-700: الخلفيّةُ أوّلُ المفضّلة في كلِّ قائمة (مسلسل ·
              أنمي · فيلم) — «نكتفي بوجودهم في الكارد الأوّل» فقسمُ
              الثلاثية حُذف والملصقاتُ ورثت مكانَها هنا. الدرزُ ذائبٌ
              (D-695) والحجابُ يشفّ (٨٥٪). */}
          {heroPosters.length > 0 && (
            <>
              <span aria-hidden className="absolute inset-0 flex">
                {heroPosters.map((path, i) => (
                  <span
                    key={path}
                    className={`relative flex-1 min-w-0 ${
                      i > 0
                        ? "-ms-8 [mask-image:linear-gradient(to_right,transparent,black_36px)] rtl:[mask-image:linear-gradient(to_left,transparent,black_36px)]"
                        : ""
                    }`}
                  >
                    <Image src={posterUrl(path, "w342")!} alt="" fill sizes="40vw" className="object-cover" />
                  </span>
                ))}
              </span>
              {/* ⚖️ 🆕 **D-712: حجابٌ واحدٌ مستوٍ ٣٠٪، والعتمةُ نزلت من
                  الطبقة إلى الحرف** (اختيارُ أحمد من ثلاثة ألواحٍ عُرضت
                  عليه: «نعم ظلّ ناعم ١»).

                  ⚖️ **نقضٌ لـD-707 ولطبقتَي التدرّج قبلها** — **وسببُ
                  النقض أن الحجابَ كان يدفع ثمنَ الكلام بالفنّ كلِّه**:
                  عمودُ البداية يعتم ٦٠٪ **ليُقرأ سطران**، فيغرق ثلثُ
                  الملصق الأوّل ولا يُرى.
                  🔑 **والقاعدةُ المستخلَصة**: **ما يحتاج العتمةَ هو
                  الحرفُ لا المساحةُ التي حولَه** — **وظلٌّ على قدِّ
                  الكلمة يشتري القراءةَ بثمنِ الكلمة، والحجابُ يشتريها
                  بثمنِ الصورة.** وهي D-686 نفسُها («العتمةُ تتبع
                  الكلام») **مأخوذةً إلى منتهاها**: لا تتبعه بعمودٍ، بل
                  تلتصق به.
                  ⚠️ **والحجابُ لم يُلغَ**: ٣٠٪ مستوٍ يخفض صخبَ
                  الملصقات كلَّها **ويمنع أن يصير الكارد لوحةَ إعلان** —
                  **وهو أخفُّ ممّا كان في كلِّ نقطةٍ من البطاقة.** */}
              <span
                aria-hidden
                className="absolute inset-0 bg-[color:var(--surface)]/40"
              />
            </>
          )}
          {/* 🆕 **الظلُّ يسكن الحاوية فيرثه كلُّ حرفٍ تحتها** (D-712):
              `text-shadow` وراثيّةٌ، **فقاعدةٌ واحدةٌ تكفي الاسمَ
              والنبذةَ والرقمَ واسمَه** — **ونسخُها على كلِّ سطرٍ هو كيف
              تفترق الأسطرُ يوماً** (القاعدة ٦). **وأربعُ طبقاتٍ بـ٧٠٪
              لا طبقةٌ واحدةٌ صمّاء**: الملتصقةُ تحدّ الحرف، والواسعتان
              تُطفئان ما خلفه — **وطبقةٌ واحدةٌ عريضةٌ تُقرأ صندوقاً لا
              ظلّاً.** */}
          <div className="relative" style={{ textShadow: HERO_TEXT_SHADOW }}>
            <div className="flex items-center gap-3">
              <span className="shrink-0 relative w-12 h-12 rounded-full overflow-hidden bg-surface-2 border border-accent/70">
                {hero.avatarUrl ? (
                  <Image src={hero.avatarUrl} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-muted">
                    <Icon name="people" size={20} />
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[17px] font-bold min-w-0">
                  <span className="truncate" dir="auto">{hero.name}</span>
                  {/* **والرمزُ لا يبلغه ظلُّ الحرف** — فله `drop-shadow` بالقوّة نفسِها (D-712) */}
                  <Icon name="sparkle-star" size={13} className="shrink-0 text-accent" style={{ filter: HERO_ICON_SHADOW }} aria-hidden />
                </span>
                {hero.followers !== null && (
                  <span className="mt-0.5 flex items-center gap-1.5 text-12 text-muted">
                    <Icon name="people" size={13} style={{ filter: HERO_ICON_SHADOW }} />
                    {t.suggestFollowers(hero.followers)}
                  </span>
                )}
              </span>
            </div>
            {hero.bio && (
              /* **النبذةُ تلزم عمودَ حجابها** (D-693) — والحجابُ يحمي
                 جهةَ البداية، فما جاوزها يغرق فوق الملصقات.
                 ⚖️ 🆕 **ورماديُّها سقط** (D-714، حكمُه: «أرفعها»):
                 **`text-muted` رتبةٌ تُقرأ على خلفيّةٍ صمّاء** — **وفوق
                 ملصقٍ أبيضَ ساطعٍ هي أضعفُ حرفٍ في البطاقة**، وظلُّ
                 D-712 ينقذ الأبيضَ ولا ينقذ الرماديّ. **والرتبةُ لم
                 تُفقد**: ١٣px عاديّةٌ تحت اسمٍ ١٧ عريضٍ ما زالت ثانيةً
                 — **والرتبةُ تُقال بالمقاس والوزن، واللونُ يُترك
                 للقراءة حيث تصعب.** */
              <p className="mt-2 text-[13px] leading-snug line-clamp-2 max-w-[55%]" dir="auto">
                {hero.bio}
              </p>
            )}
            {bigTime}
          </div>
        </section>
      ) : (
        bigTime
      )}

      {/* ===== شريطُ الأرقام (D-698) ===== */}
      <div className="grid grid-cols-4">
        <StripCell icon="tv" value={num(shows, locale)} label={t.statsCellShows} border="" />
        <StripCell icon="film" value={num(rangeMovies, locale)} label={t.statsCellMoviesWatched} border={`border-s ${divider}`} />
        <StripCell icon="play" value={num(rangeEpisodes, locale)} label={t.statsCellEpisodesWatched} border={`border-s ${divider}`} />
        <StripCell icon="comment" value={num(reviews, locale)} label={t.statsCellComments} border={`border-s ${divider}`} />
      </div>

      {/* ===== بطاقةُ «ذوقك» الكاملة (D-700 — الصورةُ بالضبط) ===== */}
      {taste && (
        /* 🆕 **وارتفاعُها −٥٪** (D-717، حكمُه: «نقّص ارتفاع كارد ذوقك
           ٥٪»). **والنقصُ حشوٌ ينزل درجةً في السلّم، في البطاقة وفي
           خاناتها معاً** — **لا خطٌّ يصغر**: مقاساتُ الحروف ضُبطت
           بالقياس (D-703) **وتصغيرُها يغيّر المعنى، والحشوُ يغيّر
           المساحةَ وحدَها** (وصفةُ D-713 مقلوبة).
           📏 **مقيسٌ عند ٣٩٠px**: ٤١٤٫٥ → ٣٩٤٫٥ (−٤٫٨٪) — **والخمسةُ
           بالضبط كانت تحتاج رقماً خارج السلّم** (القاعدة ١٧). */
        <section className="rounded-2xl border border-border bg-surface px-4 py-3">
          <h3 className="flex items-center gap-2.5 text-[17px] font-bold">
            <Icon name="trio" size={22} className="text-accent" />
            {mine ? t.analysisTaste : t.analysisTasteOther}
          </h3>

          {/* ⚖️ 🆕 D-706 (حكمُه: «شيل الإطار وقلّل الهامش تحتها واحذف كلمة
              ثيم»): **السماتُ كلماتٌ لا رقائق** — الإطارُ يوحي بمِصفاةٍ
              تُضغط (عائلةُ الرقاقة معناها «مختارٌ يُلغى» — D-134)،
              **وهذه وصفٌ يُقرأ لا زرٌّ يُضغط** (D-217). **والعنوانُ
              سقط لأن الكلماتِ تصف نفسَها** تحت عنوان «ذوقك». */}
          {/* ⚖️ 🆕 D-708: **كلمةُ «السمات» عادت بحكمه** (نقضُ شطرٍ من
              D-706 بعد الرؤية — **والإطارُ لم يعد**): العنوانُ يقول
              ما هذه الكلمات، **والهامشُ تحتها قلّ** فالتصق الصفُّ
              بالخانات. */}
          {taste.themes.length > 0 && (
            <div className="mt-2.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-14 font-semibold text-accent">
              <span className="text-13 font-normal text-muted shrink-0">{t.tasteThemes}</span>
              {taste.themes.map((th, i) => (
                <span key={th} className="flex items-center gap-3">
                  {i > 0 && (
                    <span aria-hidden className="w-1 h-1 rounded-full bg-accent/50" />
                  )}
                  {th}
                </span>
              ))}
            </div>
          )}

          <div className="mt-1 grid grid-cols-2 gap-x-4">
            {taste.genres.length > 0 && (
              <TasteCell title={t.tasteGenres} posters={taste.posters.genres}>
                {taste.genres.map((g) => (
                  <TasteRow key={g.name} name={g.name} value={`${g.pct}%`} works={g.works} total={g.total} locale={locale} />
                ))}
              </TasteCell>
            )}
            {taste.decades.length > 0 && (
              <TasteCell title={t.tasteYears} posters={taste.posters.decades}>
                {taste.decades.map((d) => (
                  <TasteRow key={d.label} name={d.label} value={`${d.pct}%`} ltr works={d.works} total={d.total} locale={locale} />
                ))}
              </TasteCell>
            )}
            {taste.languages.length > 0 && (
              <TasteCell title={t.tasteLanguages} divider posters={taste.posters.languages}>
                {taste.languages.map((l) => (
                  <TasteRow
                    key={l.code}
                    name={l.name}
                    value={num(l.titles, locale)}
                    unit={unitWord(t.personWorksCount(l.titles))}
                    works={l.works}
                    total={l.total}
                    locale={locale}
                  />
                ))}
              </TasteCell>
            )}
            {taste.countries.length > 0 && (
              /* ⚖️ 🆕 D-703 (حكمُه: «حسّن diversity»): الخانةُ كانت تقول
                 كلمةً مجرّدةً ورقماً — **صارت تسمّي البلدانَ نفسَها**
                 (أعلى اثنين بعدِّ أعمالهما) **والمستوى وصفٌ في عنوانها**،
                 فوافقت أخواتِها الخمسَ في الشكل وزادت معنًى. */
              <TasteCell title={t.tasteDiversity} note={taste.diversityLevel ?? undefined} divider posters={taste.posters.countries}>
                {taste.countries.map((c) => (
                  <TasteRow
                    key={c.name}
                    name={c.name}
                    value={num(c.titles, locale)}
                    unit={unitWord(t.personWorksCount(c.titles))}
                    works={c.works}
                    total={c.total}
                    locale={locale}
                  />
                ))}
              </TasteCell>
            )}
            {taste.directors.length > 0 && (
              <TasteCell title={t.tasteDirectors} divider posters={taste.posters.directors}>
                {taste.directors.map((d) => (
                  <TasteRow
                    key={d.name}
                    name={d.name}
                    value={num(d.titles, locale)}
                    unit={unitWord(t.personWorksCount(d.titles))}
                    works={d.works}
                    total={d.total}
                    locale={locale}
                  />
                ))}
              </TasteCell>
            )}
            {taste.actors.length > 0 && (
              <TasteCell title={t.tasteActors} divider posters={taste.posters.actors}>
                {taste.actors.map((a) => (
                  <TasteRow
                    key={a.name}
                    name={a.name}
                    value={num(a.titles, locale)}
                    unit={unitWord(t.personWorksCount(a.titles))}
                    works={a.works}
                    total={a.total}
                    locale={locale}
                  />
                ))}
              </TasteCell>
            )}
          </div>
        </section>
      )}

    </div>
  );
}

/** خانةُ بطاقة الذوق: عنوانٌ (ووصفٌ اختياريٌّ) وصفوفُه — ⚖️ D-702:
    أقراصُ الأيقونات حُذفت، و⚖️ D-703: أقراصُ الحروف كذلك. */
function TasteCell({
  title,
  note,
  divider = false,
  posters,
  children,
}: {
  title: string;
  /** وصفٌ بجانب العنوان — «متوسّط» بجانب «التنوّع» */
  note?: string;
  divider?: boolean;
  /**
   * 🆕 **صورُ خلفيّة الخانة، روابطَ جاهزة** (D-717/D-718) — ملصقاتُ
   * الأعمال التي صنعت الرقم، **أو وجوهُ الأشخاص في خانتَيهما** — انظر
   * الحجّةَ في `TasteData.posters`.
   */
  posters?: string[];
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden py-3 min-w-0 ${
        divider ? "border-t border-[color:var(--divider)]" : ""
      }`}
    >
      {/* 🆕 **الخلفيّة** (D-717، اختيارُه «مكتبتك خلفك»): **ملصقاتٌ لا
          رسمٌ** — واللوحان عُرضا عليه فاختار الصورةَ على الشارت.
          ⚠️ **ثلاثةُ قيودٍ تحوّلها من صورةٍ إلى ملمس**: **١٥٪** (رقمُه)
          فلا تنازع الرقمَ الذي جاءت تخدمه · **ورماديّةٌ** لأن ستَّ
          خاناتٍ بألوانِ ستِّ ملصقاتٍ تصير لوحةَ إعلان · **و`aria-hidden`
          لأنها لا تقول شيئاً لمن لا يراها.**
          🔑 **وهي دليلٌ لا زخرفة**: خلف «أكشن ومغامرة» أعمالُ أكشنك
          أنت — **وزخرفةٌ لا تتبدّل ببيانات صاحبها زينةٌ في ثوب معنى.** */}
      {posters && posters.length > 0 && (
        <span aria-hidden className="absolute inset-0 flex opacity-15 grayscale">
          {posters.map((p) => (
            <span key={p} className="relative flex-1 min-w-0">
              <Image src={p} alt="" fill sizes="120px" className="object-cover" />
            </span>
          ))}
        </span>
      )}
      <span className="relative block text-13 text-muted mb-1.5">
        {title}
        {note && <span className="text-accent font-semibold"> · {note}</span>}
      </span>
      <span className="relative block space-y-1.5">{children}</span>
    </div>
  );
}

/**
 * ⚖️ 🆕 **صفُّ بطاقة الذوق — وصفةٌ واحدةٌ لخاناتها الستّ** (D-703، حكمُه:
 * «وحّد مقاسات الحروف، و«2 titles» خلها في نفس الصف مع الاسم»):
 * **الاسمُ ورقمُه في سطرٍ واحدٍ بمقاسٍ واحد** — والرقمُ بلون الهويّة
 * ووحدتُه هادئة. **وستُّ خاناتٍ بستّة أشكالٍ هي العطلُ بعينه** (القاعدة ٣).
 */
function TasteRow({
  name,
  value,
  unit,
  ltr = false,
  works,
  total = 0,
  locale,
}: {
  name: string;
  value: string;
  unit?: string;
  ltr?: boolean;
  /**
   * 🆕 **الأعمالُ خلف الرقم** (D-721) — **والغيابُ يعني صفّاً ساكناً**:
   * **صفٌّ يُضغط فيفتح فراغاً أسوأُ من صفٍّ لا يُضغط** (D-217/D-030).
   */
  works?: TasteWork[];
  total?: number;
  locale?: Locale;
}) {
  const face = (
    <div className="flex items-baseline gap-2 min-w-0 w-full">
      <span className="text-14 truncate" dir={ltr ? "ltr" : "auto"}>
        {name}
      </span>
      <span className="ms-auto shrink-0 text-14 font-semibold text-accent tabular-nums">
        {value}
        {unit && <span className="font-normal text-muted"> {unit}</span>}
      </span>
    </div>
  );
  if (!works || works.length === 0 || !locale) return face;
  const t = getDict(locale);
  return (
    /* ⚠️ **ولا ورقةَ جديدةٌ ولا زرَّ جديد** (القاعدة ٦/D-018):
       `ProfileStatSheet` بعينها — **الوجهُ يُمرَّر إليها والشبكةُ
       مرسومةٌ من الخادم فلا تعبر ملصقاتُها الحدَّ** (درسُ D-238). */
    <ProfileStatSheet
      title={name}
      closeLabel={t.closeLabel}
      className="block w-full text-start active:opacity-70 transition"
      content={
        <div className="space-y-3">
          {/* **والسقفُ يُقال حين يقصّ** (D-217): «٣٠ من ٣٤٠» —
              **وقائمةٌ مقصوصةٌ بلا خبرٍ تُقرأ قائمةً كاملة.** */}
          <p className="text-12 text-muted">
            {total > works.length
              ? `${num(works.length, locale)} / ${num(total, locale)}`
              : num(total, locale)}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {works.map((w) => (
              <PosterCard
                key={`${w.mediaType}-${w.tmdbId}`}
                href={`/${w.mediaType === "tv" ? "show" : "movie"}/${w.tmdbId}`}
                title={w.title}
                posterPath={w.poster}
              />
            ))}
          </div>
        </div>
      }
    >
      {face}
    </ProfileStatSheet>
  );
}

/** كلمةُ الوحدة من صيغةٍ قائمةٍ («٥ أعمال» → «أعمال») — بلا مفتاحٍ جديد */
function unitWord(phrase: string): string {
  return phrase.replace(/^[0-9,٠-٩\s]+/, "").trim();
}


/**
 * 🆕 **مُنتقي «ثلاثية الذوق»** (D-682، نصُّ المواصفة): **خانةٌ لكلِّ فئةٍ —
 * الأنمي المفضّل فالمسلسلُ فالفيلم** — لا أعلى ثلاثةٍ كيفما اتّفق (كما
 * كانت في D-679). **والاختيارُ اليدويُّ هو الأصل والانتقاءُ هذا سدُّه
 * المؤقّت** («أعلى عمل مكتمل وتقييماً في كل فئة») حتى يُبنى المُنتقي.
 *
 * ⚠️ **والأنمي هنا تقريبٌ مُعلَن**: عمودُ `follows.genres` يحمل الأنواعَ
 * بلا بلدِ المنشأ — **ومعيارُ `isAnime` الكامل (رسومٌ + يابان) يحتاج
 * نداءَ TMDB لكلِّ عمل** وهو ما أسقطته الهجرة ١٤٢ عمداً. فالرسومُ
 * المتحرّكة (١٦) تُحسب أنمي، **والاختيارُ اليدويُّ القادم يصحّح الشاذّ.**
 *
 * ⚠️ **وفئةٌ فارغةٌ تسقط لا تُحشى من جارتها** (D-217): من لا أنمي عنده
 * يرى بطاقتين صادقتين لا ثلاثاً إحداها كذب.
 */
export interface TrioCandidate {
  key: string;
  category: "anime" | "series" | "movie";
  title: string;
  posterPath: string | null;
  href: string;
  completed: boolean;
  rating: number | null;
  watched: number;
}

/**
 * 🆕 **بناءُ بطاقة «ذوقك»** (D-700) — مساعدٌ خالصٌ يطعمه القارئان
 * (D-145): توزيعُ الأنواع من عمود `follows.genres`، والباقي من كتالوج
 * `title_meta` (الهجرة ١٥٠) — **صفرُ نداء TMDB وقتَ العرض** (D-649).
 *
 * **والسماتُ اشتقاقٌ مُعلَنٌ من توزيع الأنواع** (دراما+رومانسي=عاطفي،
 * جريمة+إثارة+غموض+رعب=مظلم…) — **لا ذكاءٌ يدّعي قراءةَ النفوس**،
 * وثلاثُ سماتٍ على الأكثر ولا سمةَ لتوزيعٍ لا يحملها.
 */
export function buildTaste(args: {
  /**
   * 🆕 **العملُ لا مفتاحُه** (D-717): صار الصفُّ يحمل ملصقَه وأنواعَه
   * **لأن الخلفيّةَ تُبنى من الأعمال التي صنعت الرقم** — **ومَن يعدّ
   * وحدَه لا يعرف مَن عدّ.**
   */
  keys: {
    media_type: "tv" | "movie";
    tmdb_id: number;
    title?: string | null;
    poster?: string | null;
    genreIds?: number[] | null;
  }[];
  metas: Map<string, { release_year: number | null; original_language: string | null; origin_countries: string[] | null; director: string | null; top_cast: string[] | null; director_profile?: string | null; cast_profiles?: (string | null)[] | null }>;
  bySlug: Map<string, number>;
  genreTags: number;
  topGenres: { name: string; count: number }[];
  t: ReturnType<typeof getDict>;
  locale: Locale;
}): TasteData | null {
  const { keys, metas, bySlug, genreTags, topGenres, t, locale } = args;

  const g = (slug: string) => bySlug.get(slug) ?? 0;
  const themeScores: { label: string; score: number }[] = [
    { label: t.themeEmotional, score: g("drama") * 0.6 + g("romance") },
    { label: t.themeDark, score: g("crime") + g("thriller") + g("mystery") + g("horror") },
    { label: t.themeCharacter, score: g("drama") * 0.5 + g("mystery") * 0.3 + g("war") * 0.3 },
    { label: t.themeEpic, score: g("action") + g("scifi") + g("war") * 0.5 },
    { label: t.themeFeelGood, score: g("comedy") + g("family") + g("animation") * 0.5 },
  ];
  const themes = themeScores
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.label);

  /** **الأعمالُ خلف صفٍّ، مقصوصةً بسقفها ومعها عددُها الحقيقيّ** (D-721) */
  const rowOf = (list: TasteWork[] | undefined) => ({
    works: (list ?? []).slice(0, ROW_WORKS),
    total: (list ?? []).length,
  });
  const genres = topGenres.slice(0, 2).map((x) => ({
    name: x.name,
    pct: pct(x.count, genreTags),
    /* **ومفتاحُ النوع يُشتقّ من عدّه** — نفسُ وصفة `topSlug` أدناه */
    ...rowOf(genreW.get([...bySlug.entries()].find(([, n]) => n === x.count)?.[0] ?? "")),
  }));

  const decadeTally = new Map<number, number>();
  const langTally = new Map<string, number>();
  const countryTally = new Map<string, number>();
  const directorTally = new Map<string, number>();
  const actorTally = new Map<string, number>();
  /* 🆕 **سلالُ الملصقات** (D-717) — **تُملأ في المرور نفسِه الذي يعدّ**:
     **مرورٌ ثانٍ على المكتبة كلِّها ليجمع ما جمعه الأوّلُ ضريبةٌ بلا
     مقابل**، **والسلّةُ تقف عند ثلاثةٍ فلا تكبر بكِبَر المكتبة.** */
  /** **وجهُ كلِّ شخصٍ بالاسم** (D-718) — خريطةٌ واحدةٌ للمخرجين والممثّلين */
  const faceOf = new Map<string, string>();
  /* 🆕 **وسلالُ الأعمال نفسُها** (D-721) — **في المرور الذي يعدّ**
     (درسُ D-717): **والملصقاتُ الثلاثةُ تُشتقّ منها فلا سلّتان.** */
  const genreW = new Map<string, TasteWork[]>();
  const decadeW = new Map<number, TasteWork[]>();
  const langW = new Map<string, TasteWork[]>();
  const countryW = new Map<string, TasteWork[]>();
  const directorW = new Map<string, TasteWork[]>();
  const actorW = new Map<string, TasteWork[]>();
  const addW = <K,>(m: Map<K, TasteWork[]>, key: K, w: TasteWork) => {
    const cur = m.get(key);
    if (cur) cur.push(w);
    else m.set(key, [w]);
  };
  const genreP = new Map<string, string[]>();
  const decadeP = new Map<number, string[]>();
  const langP = new Map<string, string[]>();
  const countryP = new Map<string, string[]>();
  const directorP = new Map<string, string[]>();
  const actorP = new Map<string, string[]>();
  const push = <K,>(m: Map<K, string[]>, key: K, poster?: string | null) => {
    if (!poster) return;
    const cur = m.get(key);
    if (!cur) m.set(key, [poster]);
    else if (cur.length < BG_POSTERS && !cur.includes(poster)) cur.push(poster);
  };
  for (const k of keys) {
    const work: TasteWork = {
      mediaType: k.media_type,
      tmdbId: k.tmdb_id,
      title: k.title ?? "",
      poster: k.poster ?? null,
    };
    /* **والأنواعُ تُسلَّل هنا وإن عُدّت في `tallyGenres`**: العدُّ هناك
       يبتلع المفهومَ مرّةً للعمل (أكشن ومغامرة واحد)، **والسلّةُ تحتاج
       المفهومَ نفسَه لا الرقم** — والدالّةُ الواحدةُ (`browseGenreForId`)
       تضمن أنّهما يتكلّمان اللغةَ نفسَها (القاعدة ٦). */
    const seen = new Set<string>();
    for (const id of k.genreIds ?? []) {
      const g = browseGenreForId(id);
      if (!g || seen.has(g.slug)) continue;
      seen.add(g.slug);
      push(genreP, g.slug, k.poster);
      addW(genreW, g.slug, work);
    }
    const m = metas.get(`${k.media_type}-${k.tmdb_id}`);
    if (!m) continue;
    if (m.release_year && m.release_year > 1900) {
      const d = Math.floor(m.release_year / 10) * 10;
      decadeTally.set(d, (decadeTally.get(d) ?? 0) + 1);
      push(decadeP, d, k.poster);
      addW(decadeW, d, work);
    }
    if (m.original_language) {
      langTally.set(m.original_language, (langTally.get(m.original_language) ?? 0) + 1);
      push(langP, m.original_language, k.poster);
      addW(langW, m.original_language, work);
    }
    for (const c of m.origin_countries ?? []) {
      countryTally.set(c, (countryTally.get(c) ?? 0) + 1);
      push(countryP, c, k.poster);
      addW(countryW, c, work);
    }
    if (m.director) {
      directorTally.set(m.director, (directorTally.get(m.director) ?? 0) + 1);
      push(directorP, m.director, k.poster);
      addW(directorW, m.director, work);
      /* 🆕 **وجهُ الشخص يُلتقط أوّلَ مرّةٍ يُرى** (D-718) — **ولا
         يُدهَس بعدها**: العملُ الثاني قد يحمل صورةً أقدمَ أو فارغة،
         **وأوّلُ صورةٍ وُجدت تكفي وجهاً.** */
      if (m.director_profile && !faceOf.has(m.director)) faceOf.set(m.director, m.director_profile);
    }
    (m.top_cast ?? []).forEach((a, i) => {
      actorTally.set(a, (actorTally.get(a) ?? 0) + 1);
      push(actorP, a, k.poster);
      addW(actorW, a, work);
      const f = m.cast_profiles?.[i];
      if (f && !faceOf.has(a)) faceOf.set(a, f);
    });
  }

  const yearTotal = [...decadeTally.values()].reduce((a, b) => a + b, 0);
  const decades = [...decadeTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([d, n]) => ({ label: t.tasteDecade(d), pct: pct(n, yearTotal), ...rowOf(decadeW.get(d)) }));

  /* اسمُ اللغة بلغة القارئ — Intl لا سجلٌّ يدويّ، والسقوطُ رمزُها */
  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames([locale === "ar" ? "ar" : "en"], { type: "language" });
  } catch {
    dn = null;
  }
  const languages = [...langTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code, n]) => {
      let name = code.toUpperCase();
      try {
        name = dn?.of(code) ?? name;
      } catch {
        /* رمزٌ شاذٌّ يبقى رمزاً */
      }
      return { code, name, titles: n, ...rowOf(langW.get(code)) };
    });

  /* **اسمُ البلد بلغة القارئ** — `Intl` لا سجلٌّ يدويّ، والسقوطُ رمزُه */
  let rn: Intl.DisplayNames | null = null;
  try {
    rn = new Intl.DisplayNames([locale === "ar" ? "ar" : "en"], { type: "region" });
  } catch {
    rn = null;
  }
  const countryCount = countryTally.size;
  const countries = [...countryTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code, n]) => {
      let name = code;
      try {
        name = rn?.of(code) ?? code;
      } catch {
        /* رمزٌ شاذٌّ يبقى رمزاً */
      }
      return { name, titles: n, ...rowOf(countryW.get(code)) };
    });
  const diversityLevel =
    countryCount > 0
      ? `${countryCount >= 8 ? t.tasteDivHigh : countryCount >= 4 ? t.tasteDivMid : t.tasteDivLow}`
      : null;

  const top2 = (m: Map<string, number>, w: Map<string, TasteWork[]>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name, n]) => ({ name, titles: n, ...rowOf(w.get(name)) }));
  const directors = top2(directorTally, directorW);
  const actors = top2(actorTally, actorW);

  if (
    !themes.length &&
    !genres.length &&
    !decades.length &&
    !languages.length &&
    !countries.length &&
    !directors.length &&
    !actors.length
  ) {
    return null;
  }
  /* **وخلفيّةُ الخانة أعمالُ صدارتها** (D-717): الصفُّ الأوّلُ هو الذي
     يقود الرقم، **وخلطُ أعمالِ الصفَّين يجعل الخلفيّةَ لا تصف شيئاً.** */
  const topSlug = topGenres[0]
    ? [...bySlug.entries()].find(([, n]) => n === topGenres[0].count)?.[0]
    : undefined;
  const topDecade = [...decadeTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  /* 🆕 **والخريطةُ تُسلَّم روابطَ جاهزة** (D-718): **الخانةُ لا تعرف
     قاعدةَ مقاسات TMDB** — **وملصقٌ ووجهٌ لهما مقاسان مختلفان في نفس
     الخدمة** (`w185` للملصق و`w185` للشخص بسجلٍّ آخر)، **فمن يعرف نوعَ
     الصورة هو من يبني رابطَها** (سابقةُ `ActivityItem.poster`). */
  const url = (paths: string[] | undefined) =>
    (paths ?? []).map((p) => posterUrl(p, "w185")).filter((u): u is string => !!u);
  /** **ووجهُ كلِّ اسمٍ معروضٍ بترتيبه** — ومن لا وجهَ له يسقط لا يُزاح */
  const faces = (names: { name: string }[]) =>
    names
      .map((x) => faceOf.get(x.name))
      .filter((p): p is string => !!p)
      .map((p) => profileUrl(p, "w185"))
      .filter((u): u is string => !!u);
  const posters = {
    genres: url(topSlug ? genreP.get(topSlug) : undefined),
    decades: url(topDecade !== undefined ? decadeP.get(topDecade) : undefined),
    languages: url(langP.get(languages[0]?.code ?? "")),
    countries: url(
      countryP.get([...countryTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""),
    ),
    /* **والوجوهُ أوّلاً والملصقاتُ سدُّها**: من لا صورةَ له في TMDB
       **لا تُترك خانتُه عاريةً بين أخواتها** — أعمالُه تقوم مقامَه. */
    directors: faces(directors).length ? faces(directors) : url(directorP.get(directors[0]?.name ?? "")),
    actors: faces(actors).length ? faces(actors) : url(actorP.get(actors[0]?.name ?? "")),
  };

  return { themes, genres, decades, languages, countries, diversityLevel, directors, actors, posters };
}

export function pickTasteTrioSlots(
  cands: TrioCandidate[],
): Partial<Record<"anime" | "series" | "movie", { posterPath: string | null }>> {
  const out: Partial<Record<"anime" | "series" | "movie", { posterPath: string | null }>> = {};
  for (const cat of ["anime", "series", "movie"] as const) {
    const best = cands
      .filter((c) => c.category === cat)
      .sort(
        (a, b) =>
          Number(b.completed) - Number(a.completed) ||
          (b.rating ?? -1) - (a.rating ?? -1) ||
          b.watched - a.watched,
      )[0];
    if (best) out[cat] = { posterPath: best.posterPath };
  }
  return out;
}

/**
 * 🆕 **تعدادُ الذوق من عمود `follows.genres`** (D-649) — قارئان يستعملانه.
 *
 * 🔴 **وكان ثمانين نداءَ TMDB في كلِّ فتحةٍ للإحصائيات**: عيّنةُ أربعين
 * مسلسلاً وأربعين فيلماً تُطلب تفاصيلُها لأجل أسماءِ أنواعها وحدَها —
 * **والعمودُ يحملها الآن** (الهجرة ١٤٢) **فالعددُ صفر، والتعدادُ صار على
 * المكتبة كلِّها لا على عيّنةٍ منها.**
 *
 * 🔑 **والاسمُ من `BROWSE_GENRES` لا من TMDB**: اسمُ TMDB يأتي بلغة
 * النداء، **ورفُّ الاكتشاف يسمّي الأنواعَ بأسمائها في اللغتين أصلاً** —
 * **فسجلٌّ واحدٌ يخدم الرفَّ والملفَّ والإحصائيات** (القاعدة ٣/D-145).
 *
 * ⚠️ **والمفهومُ يُعدّ مرّةً للعملِ الواحد**: «أكشن ومغامرة» مفهومٌ يجمع
 * `28` و`12`، **وعملٌ يحمل الرقمين ليس ضِعفَ أكشن.**
 */
export function tallyGenres(
  rows: readonly (number[] | null | undefined)[],
  locale: Locale,
): { topGenres: { name: string; count: number }[]; genreTags: number; bySlug: Map<string, number> } {
  const tally = new Map<string, { name: string; count: number }>();
  let genreTags = 0;
  for (const ids of rows) {
    if (!ids?.length) continue;
    const seen = new Set<string>();
    for (const id of ids) {
      const g = browseGenreForId(id);
      if (!g || seen.has(g.slug)) continue;
      seen.add(g.slug);
      const name = browseGenreName(g, locale);
      const cur = tally.get(g.slug);
      if (cur) cur.count++;
      else tally.set(g.slug, { name, count: 1 });
      genreTags++;
    }
  }
  const topGenres = [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  /* 🆕 D-700: الخريطةُ الكاملةُ للسمات — القمّةُ وحدَها لا تكفي مشتقّها */
  const bySlug = new Map<string, number>();
  for (const [slug, v] of tally) bySlug.set(slug, v.count);
  return { topGenres, genreTags, bySlug };
}

/**
 * تحليل المكتبة — **شكلٌ سلّمه أحمد** (D-493) — **قارئُ صاحبِ الحساب.**
 *
 * ⚖️ 🆕 **والرسمُ غادر إلى `AnalysisView`** (D-649): الشاشةُ نفسُها تُرسم
 * لزائر ملفٍّ الآن، **ونسخةٌ ثانيةٌ من الوجه تفترق عند أوّل تعديل**
 * (D-145). **وهذه صارت قراءةً خالصة.**
 *
 * ⚠️ **والحلقاتُ تُقرأ كاملةً لا بسقفِ ألف** (`getAllWatchedEpisodes`
 * المُرقِّمة): **الرقمُ المعروض قبل اليوم كان «١٠٠٠ حلقة» بالضبط** —
 * وهو سقفُ الاستعلام لا عددُ ما شاهده. **ورقمٌ يساوي سقفَه ليس رقماً،
 * هو الحدُّ يرتدي زيَّ حقيقة.**
 */
export async function LibraryAnalysis({
  locale,
  range = "all",
}: {
  locale: Locale;
  range?: StatsRange;
}) {
  const t = getDict(locale);

  const [follows, ratings, episodes, watchedMovies, history, profile, user] =
    await Promise.all([
      getFollows(),
      getMyRatings(),
      getAllWatchedEpisodes(),
      getWatchedMovies(),
      getWatchHistory(1000),
      /* 🆕 **الهويّةُ للترويسة** (D-679) — `cache()` فلا رحلةَ جديدة */
      getProfile(),
      getUser(),
    ]);
  /* 🆕 **وعدُّ المتابِعين** (D-679) — دالّةُ `follow_stats` المحروسة (١٣٨) */
  const followStats = user
    ? await getFollowStats(user.id).catch(() => null)
    : null;

  if (!follows.length) {
    return <p className="text-sm text-muted text-center py-10">{t.analysisEmpty}</p>;
  }

  const watchedMovieIds = new Set(watchedMovies.map((m) => m.id));
  const movieMinutes = watchedMovieMinutes(watchedMovies);

  const watchedByShow = new Map<number, number>();
  let epMinutes = 0;
  for (const w of episodes) {
    watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
    epMinutes += w.runtime ?? 40;
  }

  const tvFollows = follows.filter((f) => f.media_type === "tv");

  /* ===== المدى المختار =====
     **البادئةُ نصٌّ لا تاريخ**: `watched_at` نصٌّ ISO، **ومقارنةُ
     بادئةٍ أرخصُ من بناء `Date` لكلِّ صفٍّ من آلاف** — ولا منطقةَ
     زمنيّةً تنزلق تحتها. */
  const nowY = new Date().getUTCFullYear();
  const monthKey = new Date().toISOString().slice(0, 7);
  const prefix = range === "year" ? String(nowY) : range === "month" ? monthKey : "";

  const inRange = (iso: string) => prefix === "" || iso.startsWith(prefix);

  const rangeEpRows = prefix ? episodes.filter((e) => inRange(e.watched_at)) : episodes;
  const rangeEpisodes = rangeEpRows.length;
  const rangeEpMinutes = rangeEpRows.reduce((n, e) => n + (e.runtime ?? 40), 0);

  /* ⚠️ **والأفلامُ من السجلّ لأنه وحدَه يحمل تاريخَها** — وهي عشراتٌ
     لا آلاف، **فسقفُ الألف لا يبلغها** (بخلاف الحلقات أعلاه). */
  const movieHistory = history.filter((h) => h.kind === "movie");
  const rangeMovieRows = prefix ? movieHistory.filter((h) => inRange(h.watchedAt)) : movieHistory;
  const rangeMovies = prefix ? rangeMovieRows.length : watchedMovieIds.size;
  const rangeMovieMinutes = prefix
    ? rangeMovieRows.reduce((n, h) => n + (h.runtime ?? 110), 0)
    : movieMinutes;

  const rangeMinutes = rangeEpMinutes + rangeMovieMinutes;

  /* 🆕 D-698: «المسلسلات» عدُّ مسلسلات مكتبته (لا يتبع المدى — المكتبةُ
     ليست حدثاً مؤرَّخاً)، و«التعليقات» ما كتب فيه نصٌّ فعلاً — تقييمٌ
     صامتٌ ليس تعليقاً، وتسميتُه تعليقاً كذبٌ صغير (D-219). */
  const shows = tvFollows.length;
  const rangeRatings = prefix ? ratings.filter((r) => inRange(r.updated_at)) : ratings;
  /* ⚖️ 🆕 D-708 (حكمُه: «وفي ريفيو خلّيه يعدّ كذلك التقييم»): **الخانةُ
     تعدّ ما قيّمتَه كلَّه** — بنصٍّ أو بلا نصّ. **نقضٌ مسجَّلٌ لتفريق
     D-698** («تقييمٌ صامتٌ ليس تعليقاً»): **الحجّةُ كانت صدقَ الاسم،
     وصاحبُ الاسم قرّر أن الرقمَ رقمُ رأيه لا رقمُ كلامه.** */
  const reviews = rangeRatings.length;

  /* ⚖️ 🆕 **والأنواعُ من العمود لا من ثمانين نداءَ TMDB** (D-649):
     `follows.genres` يحملها منذ الهجرة ١٤٢ — **والنداءُ لم يبقَ إلا لما
     لم يُقرأ بعد، بسقف أربعين كما كان**، **ويصير صفراً بعد تعبئة
     `‎/api/genres`.** **والتعدادُ صار على المكتبة كلِّها لا على عيّنة.** */
  const missing = follows.filter((f) => f.genres == null).slice(0, 40);
  const fetched = await Promise.all(
    missing.map((f) =>
      (f.media_type === "tv" ? getTv(f.tmdb_id) : getMovie(f.tmdb_id)).catch(() => null),
    ),
  );
  const fetchedIds = new Map<string, number[]>();
  missing.forEach((f, i) => {
    const ids = fetched[i]?.genres?.map((g) => g.id) ?? [];
    if (ids.length) fetchedIds.set(`${f.media_type}-${f.tmdb_id}`, ids);
  });
  const { topGenres, genreTags, bySlug } = tallyGenres(
    follows.map((f) => f.genres ?? fetchedIds.get(`${f.media_type}-${f.tmdb_id}`) ?? null),
    locale,
  );

  /* ===== 🆕 عقدُ D-679: الترويسةُ والثلاثيةُ والسلال ===== */
  const hero = profile
    ? {
        name: profile.nickname || t.anonymousUser,
        avatarUrl: profile.avatar_url,
        /* **النبذةُ تتبع الاسمَ في الإخفاء** (profile_bio.sql) */
        bio: profile.hide_name ? null : (profile.bio ?? null),
        followers: followStats ? followStats.followers : null,
      }
    : null;

  /* ⚖️ **الثلاثيةُ صارت فئويّةً** (D-682 ناقضاً انتقاءَ D-679 الحرّ):
     أنمي · مسلسل · فيلم — **مرشّحوها المكتبةُ كلُّها** والتقييمُ من
     خريطةٍ لا من ترتيب `getMyRatings` */
  const ratingByKey = new Map<string, number>();
  for (const r of ratings) {
    const key = `${r.media_type}-${r.tmdb_id}`;
    if (!ratingByKey.has(key)) ratingByKey.set(key, r.rating);
  }
  const trioCands: TrioCandidate[] = follows.map((f) => {
    const key = `${f.media_type}-${f.tmdb_id}`;
    const genreIds = f.genres ?? fetchedIds.get(key) ?? [];
    const watchedEp = f.media_type === "tv" ? (watchedByShow.get(f.tmdb_id) ?? 0) : 0;
    return {
      key,
      category:
        f.media_type === "movie" ? "movie" : genreIds.includes(16) ? "anime" : "series",
      title: f.title,
      posterPath: f.poster_path,
      href: f.media_type === "movie" ? `/movie/${f.tmdb_id}` : `/show/${f.tmdb_id}`,
      completed:
        f.media_type === "movie"
          ? watchedMovieIds.has(f.tmdb_id)
          : isComplete(watchedEp, f.aired_episodes ?? f.total_episodes ?? 0),
      rating: ratingByKey.get(key) ?? null,
      watched: f.media_type === "movie" ? (watchedMovieIds.has(f.tmdb_id) ? 1 : 0) : watchedEp,
    };
  });

  /* 🆕 D-700: خلفيّةُ الترويسة **أوّلُ المفضّلة في كلِّ قائمة** (حكمُه:
     «المسلسل والأنمي والفلم مأخوذ من المفضلة أول واحد في كل قائمة») —
     `profile_favorites` مرتّبةٌ بترتيبه (sort_order)، والانتقاءُ
     الفئويُّ (D-682) **سدُّ الخانة الفارغة** لا بديلُها. */
  const [favs, animeFlags, metas] = await Promise.all([
    getProfileFavorites(user!.id),
    getMyAnimeFlags(),
    getTitleMetaFor(follows.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id }))),
  ]);
  const slots = pickTasteTrioSlots(trioCands);
  const isAnimeFav = (f: { media_type: string; tmdb_id: number }) =>
    animeFlags.get(`${f.media_type}-${f.tmdb_id}`) === true;
  /* 🆕 **والاختيارُ خرج إلى `lib/heroPosters`** (D-715) — **جاء قارئُه
     الثاني**: بطاقةُ المشاركة تلبس الخلفيّةَ نفسَها، **وقاعدتان
     تقرّران «أيُّ ملصقٍ يمثّلك» تفترقان يوماً** (D-002/القاعدة ٦).
     **والسدُّ الفئويُّ يبقى هنا** لأنه وحدَه يملك مكتبةً محسوبة. */
  const heroPosters = trioPosterPaths(favoriteTrio(favs, isAnimeFav), slots);

  /* 🆕 D-700: المدى يُقال في الترويسة — «كل الأوقات» حين لا مدى */
  const rangeLabel =
    range === "year"
      ? String(nowY)
      : range === "month"
        ? new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "long" }).format(new Date())
        : t.statsAllTime;

  const taste = buildTaste({
    keys: follows.map((f) => ({
      media_type: f.media_type,
      tmdb_id: f.tmdb_id,
      title: f.title,
      poster: f.poster_path,
      genreIds: f.genres ?? fetchedIds.get(`${f.media_type}-${f.tmdb_id}`) ?? null,
    })),
    metas,
    bySlug,
    genreTags,
    topGenres,
    t,
    locale,
  });

  return (
    <AnalysisView
      locale={locale}
      data={{
        minutes: rangeMinutes,
        episodes: rangeEpisodes,
        movies: rangeMovies,
        shows,
        reviews,
        rangeLabel,
        heroPosters,
        taste,
        mine: true,
        hero,
      }}
    />
  );
}

/** هيكل عظمي بنفس ارتفاع التحليل تقريباً حتى لا تقفز الصفحة عند وصوله */
export function LibraryAnalysisSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* البطاقةُ السينمائيّة */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface-2 shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-36 rounded bg-surface-2" />
            <div className="h-3 w-24 rounded bg-surface-2" />
          </div>
        </div>
        <div className="h-9 w-44 rounded bg-surface-2 mt-5" />
        <div className="h-3 w-28 rounded bg-surface-2 mt-3" />
      </div>
      {/* شريطُ الأرقام */}
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded bg-surface-2" />
        ))}
      </div>
      {/* بطاقةُ الذوق الكاملة */}
      <div className="h-[26rem] rounded-2xl bg-surface-2" />
    </div>
  );
}
