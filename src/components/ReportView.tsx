import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { posterUrl } from "@/lib/media";
import { num, type Locale } from "@/lib/i18n";
import { hm, clock, primeLabel } from "@/lib/statsFormat";
import { ImpossibleDayCard } from "@/components/stats/ImpossibleDayCard";
import type { PeriodStats } from "@/lib/periodStats";

/**
 * ============ «تقريرك» — الوجهُ كما سلّمه أحمد (D-799) ============
 *
 * **الصورةُ هي المرجع** (نصُّه: «نفّذ التقرير مثل هذا بالضبط… دون إعادة
 * تفسير التصميم») — **فالترتيبُ والمقاساتُ والألوانُ منها لا منّي.**
 *
 * ⚖️ **والأخضرُ والأحمرُ هنا بحكم الصورة**: كنتُ قد كتبتُ في D-796 أن
 * **لونَ الزيادة والنقص يحكم على القارئ** — **والصورةُ تقول غيرَه،
 * والرؤيةُ تغلب الحجّةَ حين يكون موضوعُ الحجّة هو المنظر** (D-662).
 *
 * 🔑 **ولا رقمَ من هنا**: كلُّه من `buildPeriodStats` — **مصدرٌ واحدٌ
 * لهذه الصفحة وللتبويبات الأربعة** (شرطُه المكتوب)، **فلا يقول سطحان
 * عن المدّة الواحدة رقمين** (D-797).
 */

/** ألوانُ شريط الذوق — **فئاتٌ لا تدرّج**، وأربعةٌ كما في الصورة */
const TASTE_COLORS = ["#7C4DFF", "#3DBE6B", "#E5484D", "#6B6B6B"];

export function ReportView({
  stats,
  locale,
}: {
  stats: PeriodStats;
  locale: Locale;
}) {
  const ar = locale !== "en";
  const peakBar = Math.max(1, ...stats.buckets.map((b) => b.minutes));
  /* 🔴 **وشبكةُ الأسماء تُرسى على العمود الأعلى** (D-801، بقياسٍ حيّ):
     **كنتُ أُظهر كلَّ ثالثٍ ثمّ أضيف اسمَ الذروة فوقها** — **فإذا وقعت
     الذروةُ بجوار عمودٍ مُسمّىً تراكب الاسمان**: «يوليو» ٢٣ بكسلاً
     و«أغسطس» ٥٠ في خانتين عرضُ كلٍّ ٢٧ على هاتفٍ ٣٩٠. **والحلُّ ألّا
     يُستثنى أحد**: تبدأ الشبكةُ من الذروة نفسِها وتمشي كلَّ ثالث،
     **فالذروةُ مُسمّاةٌ دائماً والمسافاتُ متساويةٌ دائماً.** */
  const peakIndex = Math.max(
    0,
    stats.buckets.findIndex((b) => b.minutes === peakBar && b.minutes > 0),
  );
  const insight = stats.taste.shift[0];

  if (stats.empty) {
    return (
      <p className="text-sm text-muted text-center py-16 px-6 leading-relaxed">
        {ar
          ? "لا مشاهدات في هذه المدّة — علّم حلقةً أو فيلماً ويظهر تقريرك هنا."
          : "Nothing watched in this period — tick an episode or a film and your report appears here."}
      </p>
    );
  }

  return (
    <div className="pb-6">
      {/* 🗑️ 🆕 **ونطاقُ التاريخ صعد إلى الاسم** (D-804، حكمُ أحمد:
          «السنة والشهر لا تكتبهم في سطر لوحدهم، خلّهم مع أوّل صفّ —
          your 2026 report مثلاً»): **سطرٌ فيه كلمةٌ واحدةٌ متوسّطةٌ بين
          التبويبات والرقم الكبير يأخذ ارتفاعَ سطرٍ ويعطي معلومةَ
          كلمة** — **والاسمُ يحملها بلا سطرٍ جديد**، `تقريرك · ٢٠٢٦`. */}

      {/* ═══ الوقتُ الكبير · حلقةُ الأيّام ═══ */}
      <div className="mt-4 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[52px] leading-[1.05] font-bold tracking-tight">
            {hm(stats.minutes, locale)}
          </p>
          {/* 🆕 **والفرقُ يجلس على سطر الاسم** (D-805، حكمُ أحمد: «المحتوى
              الي فوق ماهو مرتّب وماخذ مساحة كبيرة»): **كان سطراً رابعاً
              تحت الرقم** — **وأربعةُ أسطرٍ تحت رقمٍ واحدٍ تجعل رأسَ
              الصفحة عمودَ نصٍّ لا عنواناً.** **والنسبةُ صفةٌ للاسم لا
              خبرٌ مستقلّ**، فمكانُها بجانبه. ⚠️ **و«عن المدّة السابقة»
              سقطت لا معناها**: صفحةٌ كلُّها مدّةٌ واحدة، **والمقارنةُ
              فيها لا تكون إلّا بما قبلها.** */}
          <p className="text-12 tracking-[0.12em] uppercase text-muted mt-1 flex items-center gap-2">
            <span>{ar ? "وقت المشاهدة" : "Watch time"}</span>
            {stats.deltaPct !== null && (
              <>
                <span aria-hidden className="w-1 h-1 rounded-full bg-muted/50 shrink-0" />
                <span
                  className="flex items-center gap-1 tracking-normal font-bold tabular-nums"
                  dir="ltr"
                  style={{ color: stats.deltaPct >= 0 ? "#3DBE6B" : "#E5484D" }}
                >
                  <Icon name={stats.deltaPct >= 0 ? "trending" : "pause"} size={14} />
                  {stats.deltaPct >= 0 ? "+" : ""}
                  {num(stats.deltaPct, locale)}%
                </span>
              </>
            )}
          </p>
          {/* 🔴 🆕 **والسطرُ يقول ما يقيسه** (D-800 — لحاقٌ بـD-797 سقط
              في إعادة البناء): **Loopz يعرف لحظةَ التعليم لا لحظةَ
              المشاهدة** — **ومن نقل مكتبتَه دفعةً يرى ألفَ ساعةٍ في
              أسبوع**، **وعنوانٌ يقول «وقت المشاهدة» وحدَه يكذب برقمٍ
              صحيح.** **ويسقط السطرُ من تلقائه** يومَ يؤرّخ القارئُ
              مشاهدتَه بتاريخها (D-798)، **لأنّ العددَ حينها يصدق
              بالاسمين.** */}
          <p className="text-12 text-muted mt-1.5 leading-relaxed">
            {ar ? "مدّة ما علّمتَه في هذه المدّة" : "Runtime of what you marked in this period"}
          </p>
        </div>
        <DaysRing active={stats.activeDays} total={stats.range.days} locale={locale} ar={ar} />
      </div>

      {/* 🔴 🆕 **اليومُ المستحيل** (D-801 — حكمُ أحمد): **يومٌ فيه أكثرُ
          من ٢٤ ساعةً ليس رقماً كبيراً، هو رقمٌ محال** — **والسطرُ الصادقُ
          فوقه يشرح الاسمَ ولا يصلح الصفّ.** فالبطاقةُ تعرض السببَ وتعرض
          الزرَّ، **والقرارُ لصاحب التاريخ لا لي.** */}
      {stats.impossible.days > 0 && <ImpossibleDayCard locale={locale} />}

      {/* ═══ الأعمدة ═══ */}
      {/* 🔴 🆕 **وكثافةُ الأعمدة تتبع عددَها** (D-801 — من الصورة الحيّة):
          الصورةُ سبعةُ أعمدةٍ فوق كلٍّ منها ساعتُه — **وواحدٌ وثلاثون عموداً
          للشهر بالفجوة نفسِها يأكل الفجواتُ فيها عرضَ الشاشة**، **واثنا عشر
          شهراً فوق كلٍّ منها «٤٨:١٩» أسماءٌ تتراكب.** فالقاعدةُ مكتوبة:
          **الساعةُ فوق العمود ما دامت الأعمدةُ سبعةً، وبعدها فوق الأعلى
          وحدَه**، **والاسمُ يتخطّى ليقرأ**: كلُّ ثالثٍ في السنة وكلُّ
          خامسٍ في الشهر. **وعمودٌ لا يُقرأ اسمُه رسمٌ لا بيان.** */}
      <div className={`mt-6 flex items-end ${stats.buckets.length > 12 ? "gap-[3px]" : stats.buckets.length > 7 ? "gap-1.5" : "gap-2 sm:gap-3"}`}>
        {stats.buckets.map((b, i) => {
          const full = Math.round((b.minutes / peakBar) * 112);
          const dense = stats.buckets.length > 7;
          const isPeak = b.minutes === peakBar && b.minutes > 0;
          const top = stats.period === "week" && isPeak;
          const showValue = dense ? isPeak : b.minutes > 0;
          const step = stats.buckets.length > 20 ? 5 : stats.buckets.length > 7 ? 3 : 1;
          const showLabel = (((i - peakIndex) % step) + step) % step === 0;
          return (
            <div key={`${b.label}-${i}`} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
              <span className="text-12 text-muted tabular-nums" dir="ltr">
                {showValue ? clock(b.minutes, locale) : ""}
              </span>
              {/* **العمودُ قامةٌ ثابتةٌ وداخلها الممتلئ** — كما في الصورة:
                  رمادٌ غامقٌ يقول المدى، وأصفرُ يقول القيمة. */}
              <span className="relative w-full max-w-[34px] h-[112px] flex items-end">
                <span aria-hidden className="absolute inset-x-0 bottom-0 top-0 rounded-md bg-surface-2/70" />
                <span
                  aria-hidden
                  className="relative w-full rounded-md bg-accent"
                  style={{ height: `${Math.max(b.minutes > 0 ? 6 : 0, full)}px` }}
                />
              </span>
              <span
                className={`text-12 w-full text-center whitespace-nowrap overflow-visible ${top ? "font-bold" : "text-muted"} ${showLabel ? "" : "invisible"}`}
              >
                {b.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 🆕 **وأكثرُ ما شوهد صعد فوق الأرقام** (D-805، حكمُ أحمد:
          «المحتوى المهمّ تحت… خلّ فائدة التقرير في بدايته»): **من فتح
          تقريرَه يسأل «كم شاهدتُ؟» ثمّ «ماذا شاهدتُ؟»** — **والملصقاتُ
          هي جوابُ السؤال الثاني**، **وستُّ خاناتِ أرقامٍ تفصلها عن
          الرقم الكبير تدفعها تحت طيّة الشاشة على الهاتف.** 📏 **مقيس**:
          كانت تبدأ عند ~٥٩٠ بكسلاً من رأس المحتوى، وصارت عند ~٣٩٠. */}
      {/* ═══ أكثرُ ما شوهد ═══ */}
      {stats.topTitles.length > 0 && (
        <>
          <h2 className="text-20 font-bold mt-8 mb-3">{ar ? "الأكثر مشاهدة" : "Most watched"}</h2>
          <div className="flex gap-3">
            {stats.topTitles.slice(0, 3).map((x, i) => (
              <Link
                key={x.key}
                href={`/${x.mediaType === "tv" ? "show" : "movie"}/${x.tmdbId}`}
                prefetch={false}
                className={`${i === 0 ? "flex-[1.6]" : "flex-1"} min-w-0 group`}
              >
                <span className="relative block w-full aspect-[2/3] rounded-2xl overflow-hidden bg-surface-2">
                  {x.poster ? (
                    <Image
                      src={posterUrl(x.poster, "w342")!}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 45vw, 240px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
                      <Icon name={x.mediaType === "tv" ? "tv" : "film"} size={20} />
                    </span>
                  )}
                  {i === 0 && (
                    <span className="absolute top-2 start-2 grid place-items-center w-6 h-6 rounded-md bg-accent text-[color:var(--on-accent)] text-12 font-bold">
                      {num(1, locale)}
                    </span>
                  )}
                </span>
                <span className="block text-12 font-bold mt-2 truncate group-hover:text-accent transition-colors">
                  {x.title}
                </span>
                <span className="block text-12 text-muted mt-0.5 truncate">
                  {hm(x.minutes, locale)}
                  {x.episodes > 0 && ` · ${num(x.episodes, locale)} ${ar ? "حلقة" : "eps"}`}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ═══ لمحةٌ عن المدّة — **عنوانٌ واحدٌ لستِّ حقائق** ═══ */}
      {/* 🆕 **وعنوانان لستِّ حقائقَ صارا عنواناً** (D-805): كان «ثلاثةُ
          أرقام» بلا عنوانٍ ثمّ «لمحة عن مدّتك» بعنوان — **وصفّان
          متجاوران من ثلاثِ خاناتٍ كلٌّ منهما يصف المدّةَ نفسَها**،
          **وعنوانٌ يفصل بينهما يقول إنّهما موضوعان وهما موضوع.**
          ⚖️ **والشكلان باقيان عمداً**: **الرقمُ المعدود مطوَّقٌ برمزه،
          والحقيقةُ الموصوفةُ سطرٌ تحت رمزها** — **وعددٌ ووصفٌ شيئان
          يُقرآن بشكلين**، ولو وُحِّدا لَما وسع «الثلاثاء · ٢٣س ٢٨د»
          مقاسُ رقمٍ كبير. */}
      <h2 className="text-20 font-bold mt-8 mb-3">
        {ar ? "لمحة عن مدّتك" : "Your period at a glance"}
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <RoundStat icon="play" value={num(stats.episodes, locale)} label={ar ? "حلقة" : "Episodes"} />
        <RoundStat icon="film" value={num(stats.movies, locale)} label={ar ? "فيلم" : "Movies"} />
        <RoundStat icon="check" value={num(stats.streak, locale)} label={ar ? "أيام متتالية" : "Day streak"} />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-5">
        <Glance
          icon="trending"
          label={ar ? "أكثف يوم" : "Peak day"}
          value={stats.peak ? `${stats.peak.label} · ${hm(stats.peak.minutes, locale)}` : "—"}
        />
        {/* ⚠️ **ووقتُ الذروة لا يُرسم بلا ساعةٍ حقيقيّة** (D-797/D-798):
            الصفوفُ المؤرَّخةُ رجعيّاً بلا ساعة — **وخانةٌ تقول «٩–١١ م»
            من وسمِ نظامٍ تكذب**، **والغيابُ أصدق** (D-063). */}
        <Glance
          icon="clock"
          label={ar ? "وقت الذروة" : "Prime time"}
          value={stats.habits.primeHours ? primeLabel(stats.habits.primeHours) : "—"}
        />
        <Glance
          icon="check"
          label={ar ? "الإكمال" : "Completion"}
          value={`${num(stats.completionPct, locale)}%`}
        />
      </div>

      {/* ═══ ذوقُك في هذه المدّة ═══ */}
      {!stats.taste.thin && stats.taste.genres.length > 0 && (
        <>
          <h2 className="text-20 font-bold mt-8 mb-3">
            {ar ? "ذوقك في هذه المدّة" : "Your taste this period"}
          </h2>
          <div className="flex rounded-lg overflow-hidden h-9">
            {stats.taste.genres.slice(0, 4).map((g, i) => (
              <span
                key={g.slug}
                className="grid place-items-center text-12 font-bold text-white min-w-0"
                style={{ flex: `${Math.max(1, g.pct)} 0 0`, background: TASTE_COLORS[i] }}
              >
                {g.pct >= 10 ? `${num(g.pct, locale)}%` : ""}
              </span>
            ))}
          </div>
          <div className="flex mt-1.5">
            {stats.taste.genres.slice(0, 4).map((g) => (
              <span
                key={g.slug}
                className="text-12 text-muted text-center truncate min-w-0"
                style={{ flex: `${Math.max(1, g.pct)} 0 0` }}
              >
                {g.name}
              </span>
            ))}
          </div>
        </>
      )}

      {/* ═══ سطرُ الاستنتاج — **ولا يُكتب بلا حركةٍ تُقاس** ═══ */}
      {insight && (
        <p className="mt-4 flex items-start gap-2 text-12 leading-relaxed">
          <Icon name="sparkles" size={16} className="text-accent shrink-0 mt-0.5" />
          <span>
            {ar
              ? `${insight.delta > 0 ? "زادت" : "قلّت"} مشاهدتُك لـ«${insight.label}» بمقدار ${num(Math.abs(insight.delta), locale)} نقطة عن المدّة السابقة.`
              : `You watched ${insight.delta > 0 ? "more" : "less"} ${insight.label} this period — ${num(Math.abs(insight.delta), locale)} points ${insight.delta > 0 ? "up" : "down"}.`}
          </span>
        </p>
      )}

      {/* ═══ الإحصائيات الكاملة ═══ */}
      {/* 🆕 **والبابُ صفٌّ يُرى لا سطرٌ رماديٌّ في الذيل** (D-805، حكمُ
          أحمد: «خيار view full statistics تحت وما هو واضح»): **كلمتان
          بلون النصِّ الخافت في آخر تمريرةٍ طويلةٍ تُقرآن حاشيةً لا
          باباً** — **وهو أهمُّ رابطٍ في الصفحة.**
          🔑 **وهو صفُّ «تقاريرك» في `/stats` نفسُه** (رمزٌ · اسمٌ ·
          سهم داخل بطاقةٍ محدودة) — **والبابُ من الإحصائيات إلى التقرير
          ومن التقرير إلى الإحصائيات وجهان لطريقٍ واحد، فيلبسان شكلاً
          واحداً** (القاعدة ٣). */}
      <Link
        href={`/statistics?p=${stats.period}${stats.offset ? `&o=${stats.offset}` : ""}`}
        className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 active:opacity-70 transition"
      >
        <Icon name="chart" size={18} className="text-accent shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-14 font-bold">
            {ar ? "الإحصائيات الكاملة" : "View full statistics"}
          </span>
          <span className="block text-12 text-muted mt-0.5">
            {ar
              ? "المحتوى والذوق والعادات بتفصيلها"
              : "Content, taste and habits in full"}
          </span>
        </span>
        {/* **سهمٌ نصّيٌّ لا أيقونةٌ سابعة** — العائلةُ لا تُوسَّع لحرف.
            **وبلا `dir="ltr"`** (D-801): الحرفُ مرآويٌّ في يونيكود
            **فينقلب مع العربيّة إلى جهة القراءة.** */}
        <span aria-hidden className="text-muted shrink-0">›</span>
      </Link>
    </div>
  );
}

/** حلقةُ «٥ / ٧ أيّام» — **قوسٌ لا شريط**، كما في الصورة */
function DaysRing({
  active,
  total,
  locale,
  ar,
}: {
  active: number;
  total: number;
  locale: Locale;
  ar: boolean;
}) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, active / total) : 0;
  return (
    <div className="relative shrink-0 w-[104px] h-[104px]">
      <svg viewBox="0 0 104 104" className="w-full h-full -rotate-90" aria-hidden>
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">
        <span>
          <span className="block leading-none" dir="ltr">
            <span className="text-[26px] font-bold tabular-nums">{num(active, locale)}</span>
            <span className="text-15 text-muted"> / {num(total, locale)}</span>
          </span>
          <span className="block text-12 text-muted mt-1">{ar ? "أيام" : "days"}</span>
        </span>
      </span>
    </div>
  );
}

/** خانةُ رقمٍ برمزٍ مطوَّق — الصفُّ الثلاثيُّ في الصورة */
function RoundStat({
  icon,
  value,
  label,
}: {
  icon: "play" | "film" | "check";
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="grid place-items-center w-9 h-9 rounded-full border border-accent/60 text-accent shrink-0">
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-20 font-bold leading-none tabular-nums">{value}</span>
        <span className="block text-12 text-muted mt-1 truncate">{label}</span>
      </span>
    </div>
  );
}

/** خانةُ «لمحة» — رمزٌ فوق سطرين */
function Glance({
  icon,
  label,
  value,
}: {
  icon: "trending" | "clock" | "check";
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <Icon name={icon} size={17} className="text-accent" />
      <p className="text-12 text-muted mt-1.5">{label}</p>
      <p className="text-12 font-bold mt-0.5 leading-snug break-words">{value}</p>
    </div>
  );
}
