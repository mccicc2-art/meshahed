import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { HomeView } from "@/lib/homePrefs";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { LogoWordmark } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { HomeGreeting } from "./HomeGreeting";
import { HomeViewSwitch } from "./HomeViewSwitch";
import type { HeaderStat } from "./ProfileHeader";

/**
 * ترويسةُ الرئيسية — **الرئيسيةُ صفحةُ مكتبتك لا صفحةُ حسابك** (D-434).
 *
 * **ما سقط ولماذا:** كانت الرئيسية تفتح بترويسة الحساب كاملةً — غلافٌ
 * بارتفاع ١٦٠px واسمٌ ونبذةٌ ومتابعون ومستوى — **فأوّلُ ما يراه صاحبُ
 * الحساب هو صورةُ نفسه، وأوّلُ محتوًى حقيقيّ تحت منتصف الشاشة.**
 * **وتلك ترويسةُ ملفٍّ عامّ يقرؤه الآخرون**، ومكانُها الملفُّ العامّ
 * (`/u/<username>`) — **والرئيسيةُ تُفتح لتُستأنَف حلقة، لا لتُقرأ سيرة.**
 *
 * ⚖️ **ونقضٌ مسجَّل**: «الملفّ الشخصيّ صار جزءاً من الصفحة الرئيسية».
 * **والثمنُ مدفوعٌ في الدفعة نفسِها**: `/profile` صار يحوّل إلى ملفّك
 * العامّ لا إلى الجذر، **فما سقط رسمُه لم يسقط بابُه.**
 *
 * **وثلاثةُ صفوفٍ لا أكثر:** العلامةُ وأدواتُها · التحيّةُ ومبدّلُ العرض ·
 * بطاقةُ رقمين. **وكلُّها معاً أقصرُ من الغلاف وحدَه.**
 */
export function HomeHeader({
  displayName,
  avatarUrl,
  avatarPos,
  unread,
  myUsername,
  stats,
  showStats,
  levelPercent = 0,
  view,
  locale,
}: {
  displayName: string;
  avatarUrl: string | null;
  avatarPos?: number | null;
  unread: number;
  myUsername: string | null;
  /** خاناتُ بطاقة الأرقام — من التخصيص، اثنتان إلى أربع (D-152) */
  stats: HeaderStat[];
  showStats: boolean;
  /** ٠–١٠٠ — طولُ قوس المستوى حول الصورة (D-439) */
  levelPercent?: number;
  /** وضعُ العرض — للمبدّل وحدَه بعد D-439، فبطاقةُ الأرقام لم تعد تتبعه */
  view: HomeView;
  locale: Locale;
}) {
  const t = getDict(locale);

  return (
    /* 🆕 ⚖️ **ترويسةٌ لاصقة** (D-455، طلبُ أحمد بلقطةٍ معلَّمة: «هذا
       الهيدر خلّيه ثابت والقوائم اللي تحت إذا رفعتها تكون تحته»).

       **والذي يجعلها ممكنةً اليوم هو أنها خفّت**: كانت ترويسةَ حسابٍ
       بغلافٍ ١٦٠px (D-434)، **وسطحٌ بذلك الطول لا يُثبَّت** — يأكل نصفَ
       الشاشة في كلِّ تمريرة. **وبعد D-437 وD-451 صارت ثلاثةَ صفوفٍ
       قصيرة**، فالتثبيتُ يكلّف ما يستحقّه.

       ⚠️ **والحشوةُ العلويّة انتقلت من الصفِّ الداخليّ إلى الترويسة
       نفسِها** — **وهذا شرطُ صحّةٍ لا ترتيب**: `-mt-6` كانت على الابن،
       **فصندوقُ اللصق يبدأ حيث تبدأ حشوةُ الصفحة** ويُقصّ أعلاه ٢٤
       بكسلاً عند الالتصاق. **واللاصقُ يلصق حدَّه لا حدَّ ابنِه.**

       **و`-mx-4 px-4` كي تمتدّ الخلفيّةُ إلى حافّة الشاشة**: الصفحةُ
       تحمل `px-4`، **وخلفيّةٌ تقف عند الهامش تترك شريطين يمرّ تحتهما
       الملصقُ عارياً** على جانبَي الترويسة الثابتة.

       **وعلى الشاشة الواسعة تلتصق تحت الشريط العلويّ** (`--sticky-top`)
       لا فوقه — **والمقدارُ محسوبٌ هناك مرّةً واحدة** فلا يُجمع
       `--safe-top` مرّتين (تعليقُه في `globals.css`). */
    <header className="sticky top-0 md:top-[var(--sticky-top)] z-30 -mx-4 px-4 -mt-6 pt-[calc(var(--safe-top)+0.5rem)] md:pt-3 pb-3 space-y-3 bg-[color:var(--background)]">
      {/* ===== الصفُّ الأوّل: العلامةُ وأدواتُها =====
          **على الجوال وحدَه**: `HeaderShell` يُخفي الشريط العلويّ في
          الرئيسية على الجوال، **فهذا الصفُّ بديلُه هناك** — وعلى الشاشة
          الواسعة الشريطُ قائمٌ بالجرس وصورة الحساب، **ورأسان في شاشةٍ
          واحدة تكرارٌ لا اتّساق** (قاعدة ٦). */}
      {/* 🔴 🆕 **والحشوتان كانتا تُجمعان** (D-437، بلاغُ أحمد بلقطةٍ
          معلَّمة: «هامش كبير بين لوبز والإعدادات والساعة والبطارية»):
          `main` يحمل `py-6` **و`--safe-top` يُضاف فوقه** — **فسبعون
          بكسلاً فارغةً فوق العلامة في التطبيق المثبَّت** (٤٧ للشريط
          و٢٤ للحشوة). **والصوابُ أن يُلغى حشوُ الصفحة ثم يُحجز موضعُ
          شريط النظام وحدَه**: `-mt-6` تُعيد الصفَّ إلى رأس النافذة،
          و`safe-top + 0.5rem` تُنزله تحت الساعة بثمانية بكسلات لا أكثر.
          ⚠️ **ولا شيء يتغيّر في المتصفّح** حيث `env()` صفر. */}
      <div className="md:hidden flex items-center justify-between gap-2">
        <Link href="/" aria-label={t.brand} className="shrink-0">
          <LogoWordmark size={30} />
        </Link>

        <div className="flex items-center gap-1">
          <NotificationBell
            unread={unread}
            myUsername={myUsername}
            locale={locale}
          />
          <Link
            href="/profile/settings"
            aria-label={t.headerSettings}
            title={t.headerSettings}
            className="grid place-items-center w-11 h-11 rounded-full text-foreground hover:text-accent active:scale-95 transition"
          >
            <Icon name="settings" size={22} />
          </Link>
        </div>
      </div>

      {/* ===== الصفُّ الثاني: التحيّةُ ومبدّلُ العرض ===== */}
      <div className="flex items-center gap-3">
        {/* الصورةُ بابُ ملفّك العامّ — **ما تراه أنت هو ما يراه الناس**،
            ولا نسخةَ خاصّةً منه (قاعدة ٦) */}
        <Link href="/profile" className="shrink-0 md:hidden" aria-label={t.profile}>
          {/* 🆕 **الهلالُ الذهبيُّ حول الصورة** (D-439، طلبُ أحمد) —
              **وهو قوسُ مستواك لا زينة**: `conic-gradient` يرسم من
              التقدّم نسبتَه ذهباً والباقي خافتاً، **فيصير الهلالُ رقماً
              يُقرأ من طرف العين.**
              **⚖️ وبه يعود المستوى إلى الرئيسية بعد D-434** — **لا
              كشريطٍ يأخذ سطراً، بل كحدٍّ حول صورةٍ قائمةٍ أصلاً**:
              **معلومةٌ بلا بكسلٍ واحدٍ من الارتفاع.**
              ⚠️ **ولا نداءَ له**: المستوى محسوبٌ من عدّادَي الحلقات
              والأفلام المقروءَين في الموجة الأولى. */}
          <span
            className="block rounded-full p-[2.5px]"
            style={{
              background: `conic-gradient(var(--accent) ${Math.max(0, Math.min(100, levelPercent))}%, color-mix(in srgb, var(--foreground) 14%, transparent) 0)`,
            }}
          >
            <Avatar
              src={avatarUrl}
              name={displayName}
              size={44}
              alt={t.avatarAlt}
              posY={avatarPos}
              className="ring-2 ring-[color:var(--background)]"
            />
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <HomeGreeting name={displayName} locale={locale} />
        </div>

        <HomeViewSwitch view={view} locale={locale} />
      </div>

      {/* ===== الصفُّ الثالث: بطاقةُ الأرقام =====
          **والشكلُ يتبع الوضع**: بطاقةٌ واحدةٌ بفواصلَ رفيعة في المختصر —
          **سطرٌ أقلُّ ارتفاعاً لمن طلب الضغط** — وبطاقةٌ لكلِّ رقمٍ في
          البصريّ. **والمحتوى واحدٌ في الاثنين** فلا يفقد أحدُهما رقماً. */}
      {/* ===== الصفُّ الثالث: بطاقةُ الأرقام =====
          ⚖️ 🆕 **وبطاقةٌ واحدةٌ في الوضعين** (D-439، حكمُ أحمد بلقطةٍ
          للبطاقة: «خلّها بنفس هذا التصميم، **لا تقسمها**»). **كانت
          بطاقتين منفصلتين في البصريّ وواحدةً في المختصر** — **وشكلان
          لشيءٍ واحدٍ يتبدّلان بتبدّل وضع العرض يجعلان الترويسةَ نفسَها
          تُقرأ ترويستين** (القاعدة ٦). **والفاصلُ الرفيع يفرّق الخانات
          بلا أن يفصل البطاقة.** */}
      {showStats && stats.length > 0 && (
        <div
          className="grid rounded-2xl border border-border bg-surface"
          style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))` }}
        >
          {stats.map((s, i) => (
            <Link
              key={s.key}
              href={s.href ?? "/library"}
              className={`flex items-center justify-center gap-2 py-3.5 transition active:opacity-70 ${
                i > 0 ? "border-s border-[color:var(--divider)]" : ""
              }`}
            >
              <StatFace stat={s} />
            </Link>
          ))}
        </div>
      )}

    </header>
  );
}

/** وجهُ الخانة — **رسمٌ واحدٌ للوضعين**، والذي يتبدّل هو الإطار حولَه */
function StatFace({ stat }: { stat: HeaderStat }) {
  /* 🆕 **سطرٌ واحدٌ لا سطران** (D-437، بلاغُ أحمد: «الرقم طالع فوق
     الكلمة، صلّحه بحيث يكون سطر واحد») — **وارتفاعُ البطاقة نزل الثلث**
     بلا أن يسقط منها حرف. */
  return (
    <>
      <Icon
        name={stat.icon}
        size={20}
        style={{ color: stat.color ?? "var(--accent)" }}
      />
      {/* 🆕 **٢٤px/٧٠٠ — «الأرقام الكبيرة» في سلّم النصّ** (D-454)،
          **والكلمةُ تحتها ١٢ ثانويّاً.** و`font-bold` لا `extrabold`:
          السلّمُ يقول ٧٠٠، **ووزنٌ ثامنُ مئةٍ لرقمٍ في بطاقةٍ يجعله
          يصرخ فوق عنوان القسم الذي يليه.** */}
      <span className="text-[24px] font-bold leading-none tabular-nums">
        {stat.value}
      </span>
      <span className="min-w-0 truncate text-[12px] text-muted leading-none">
        {stat.label}
      </span>
    </>
  );
}
