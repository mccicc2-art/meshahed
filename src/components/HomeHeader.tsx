import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./Avatar";
import { HomeGreeting } from "./HomeGreeting";
import { HomeViewSwitch } from "./HomeViewSwitch";
import { LogoWordmark } from "./Logo";
import { MessagesLink } from "./MessagesLink";
import { SignalsLink } from "./SignalsLink";
/**
 * 🆕 **خانةُ بطاقة الأرقام — تسكن مع راسمها** (D-497): كانت تُستورد
 * نوعاً من `ProfileHeader`، **وتلك بلا قارئٍ منذ D-438 وحكمُها الحذف**
 * (D-214) — **والنوعُ يُنقل أوّلاً ثم يُحذف الملفّ.**
 */
export interface HeaderStat {
  key: string;
  icon: IconName;
  value: string;
  label: string;
  href?: string;
  /** لون الأيقونة — ثابت لا يتبع الثيم، فالخانة تُعرف بلونها قبل كلمتها */
  color?: string;
}

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
  unreadSignals = 0,
  unreadShares = 0,
  stats,
  showStats,
  levelPercent,
  locale,
}: {
  displayName: string;
  /** ⚖️ 🆕 **يُقرأ مرّةً أخرى** (D-536): الصورةُ عادت إلى صفّ الترحيب */
  avatarUrl?: string | null;
  avatarPos?: number | null;
  /** 🆕 **عدّادان لا مجموع** (D-536) — لكلِّ بابٍ رقمُه */
  unreadSignals?: number;
  unreadShares?: number;
  /** خاناتُ بطاقة الأرقام — من التخصيص، اثنتان إلى أربع (D-152) */
  stats: HeaderStat[];
  showStats: boolean;
  /** ⚖️ 🆕 **والهلالُ عاد معها** (D-536/D-439) — **٠ يعني «لا هلال»** */
  levelPercent?: number;
  locale: Locale;
}) {
  const t = getDict(locale);

  return (
    /* ⚖️ 🆕 **وترويسةُ الرئيسية الخاصّةُ سقطت** (D-502، طلبُ أحمد
       بلقطتين: «الرسائل ليه مكانها في كل الصفحات ما هو مطابق لمكانها في
       الهوم؟ حتى الشعار والصورة الشخصية — لازم كلها في نفس المكان عشان
       وقت الانتقال بين الصفحات يطلع شكلها ثابت»).

       **كان في التطبيق شريطان علويّان لا واحد**: هذا (وردمارك + ظرف +
       ترس) في الرئيسية على الجوّال، **و`Navbar` (رمز + عنوان + ظرف +
       صورة) في كلِّ صفحةٍ سواها** — **فالظرفُ يقفز أفقيّاً، والعلامةُ
       تتبدّل شكلاً، والأيقونةُ الأخيرة تتبدّل معنًى** في كلِّ تنقّل.
       **وهذا نقضٌ لشطرٍ من D-122** (إخفاءُ الشريط في الرئيسية على
       الجوّال): **حجّتُه أن الشريط هناك لا يحمل إلا أيقونة**، **وقد
       صار يحمل الظرفَ والصورةَ معاً** — فماتت الحجّة.

       **والباقي هنا محتوًى يجري مع الصفحة** كما ثبّت D-479. */
    <>
    {/* ===== ⚖️ 🆕 صفُّ العلامة وأدواتُها — عادَ إلى الرئيسية (D-536)
        =====

        **طلبُ أحمد بلقطتين: «رجّع التصميم إلى الهوم».** **وهو نقضٌ
        مسجَّلٌ لـD-502** التي حذفت هذا الصفَّ لتوحيد الشريط —
        **وحجّتُها كانت ثبات موضع الظرف والعلامة بين الصفحات**،
        **والذي تبدّل أنّ المالك رأى الشكلين واختار.** **والثمنُ
        يُقال**: وردماركٌ هنا ورمزٌ هناك، وترسٌ هنا وصورةٌ هناك.

        **وعلى الجوّال وحدَه** (`md:hidden`) — **والشريطُ الواسع باقٍ
        كما هو** بروابطه وبحثه (`hidesAppHeaderOnMobile` في
        `chromeRules`)، **فالقرارُ في ملفِّ القواعد لا في مكوّنين.**

        **و`chrome-top` كي يختبئ مع النزول** كبقيّة الأشرطة (D-479)،
        **وحشوةُ `--safe-top`** لأنه أوّلُ ما تحت ساعة النظام في
        التطبيق المثبَّت (D-040). ===== */}
    <header className="chrome-top md:hidden sticky top-0 z-30 -mx-4 px-4 -mt-6 pt-[calc(var(--safe-top)+0.5rem)] pb-2.5 bg-[color:var(--background)]">
      <div className="flex items-center gap-1">
        <Link href="/" prefetch={false} aria-label={t.brand} className="shrink-0 -ms-0.5">
          {/* **الكلمةُ المرسومة لا الرمز** — هي علامةُ الرئيسية في
              تصميم أحمد، **والرمزُ يبقى للشريط الضيّق في بقيّة
              الصفحات** حيث يجاوره عنوانُ الصفحة. */}
          <LogoWordmark size={30} />
        </Link>

        {/* **الأدواتُ في الطرف بترتيب التصميم**: جرسٌ · ظرفٌ · ترس */}
        <div className="ms-auto flex items-center gap-0.5">
          <SignalsLink unread={unreadSignals} locale={locale} />
          <MessagesLink unread={unreadShares} locale={locale} />
          <Link
            href="/profile/settings"
            prefetch={false}
            aria-label={t.settingsNavHeading}
            title={t.settingsNavHeading}
            className="grid place-items-center w-10 h-10 rounded-full text-foreground/80 hover:text-foreground hover:bg-surface-2 active:scale-95 transition"
          >
            <Icon name="settings" size={20} />
          </Link>
        </div>
      </div>
    </header>

    {/* ===== ما بقي محتوًى عاديّاً يتحرّك مع الصفحة (طلبُ أحمد ١٩
        أغسطس): التحيّةُ والصورةُ والأرقامُ ومبدّلُ العرض تُقرأ عند
        الدخول وتغادر بالتمرير — **لا سقفَ يتكرّر في كلِّ شاشة.** ===== */}
    <div className="space-y-2.5">
      {/* ===== التحيّةُ ومبدّلُ العرض ===== */}
      <div className="flex items-center gap-3">
        {/* ⚖️ 🆕 **وصورةُ الترحيب عادت ومعها الهلال** (D-536/D-439،
            لقطةُ أحمد) — **بعد أن أسقطتهما D-502.**

            **والهلالُ مجّانيٌّ هنا وحدَه**: نسبةُ المستوى تُحسب من
            أرقامٍ تقرؤها هذه الصفحةُ أصلاً (`watch_summary` والأفلام
            المشاهَدة)، **ورسمُه حول صورة الشريط العلويّ كان سيكلّف
            نداءَي عدٍّ في كلِّ مسار** — **وهذا هو نصُّ ثمنِ D-502**،
            **والموضعُ الذي لا يدفعه هو هذا.**

            **ودائرةٌ واحدةٌ بتدرّجٍ مخروطيّ** لا حلقةُ SVG: قوسٌ بلونِ
            الهوية إلى النسبة ثم رماديُّ الحدّ — **ولا مكوّنَ جديد.**
            **و`0` تعني ألّا هلال** فلا تُرسم حلقةٌ فارغةٌ تعد بشيء
            (D-222). */}
        <Link
          href="/profile"
          prefetch={false}
          aria-label={t.profile}
          title={displayName || t.profile}
          className="shrink-0 rounded-full p-[2px] active:scale-95 transition"
          style={
            levelPercent && levelPercent > 0
              ? {
                  background: `conic-gradient(var(--accent) ${levelPercent}%, var(--border) 0)`,
                }
              : undefined
          }
        >
          <span className="block rounded-full p-[2px] bg-[color:var(--background)]">
            <Avatar
              src={avatarUrl}
              name={displayName}
              size={44}
              posY={avatarPos}
              alt={t.avatarAlt}
            />
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <HomeGreeting name={displayName} locale={locale} />
        </div>

        <HomeViewSwitch locale={locale} />
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
      {showStats && stats.length > 0 && (() => {
        /* 🆕 **أربعُ خاناتٍ تنزل صفّين** (D-487، لقطةُ أحمد على البطاقة:
           «هذي إذا كاتب أربعة خلّها بنظام ٢ وتحتها ٢ grid»).

           **والعلّةُ مقيسةٌ في لقطته**: أربعُ خاناتٍ على عرض هاتفٍ تعني
           ~٩٠px للخانة، **والخانةُ رمزٌ ورقمٌ واسم** — **فيُقصّ الاسمُ
           إلى «To w…» و«Movi…»**، **واسمٌ مقصوصٌ لا يقول ما يعدّه**،
           فيصير الرقمُ بلا معنى. **وبعمودين يصير للخانة ~١٨٠px** فيظهر
           الاسمُ كاملاً بلا أن يصغر الخطّ (`02`: لا تصغير).

           ⚠️ **والثلاثةُ تبقى صفّاً واحداً**: ١٢٠px تكفي، **وصفٌّ ونصفٌ
           أسوأُ من صفٍّ ممتلئ.** */
        const cols = stats.length === 4 ? 2 : stats.length;
        return (
        <div
          className="grid rounded-2xl border border-border bg-surface"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
        >
          {stats.map((s, i) => (
            <Link
              key={s.key}
              href={s.href ?? "/library"}
              /* **الفاصلُ يُحسب من موضع الخانة في الشبكة لا من ترتيبها**:
                 خطٌّ رأسيٌّ لكلِّ خانةٍ ليست أوّلَ عمودها، **وأفقيٌّ لكلِّ
                 خانةٍ في صفٍّ ثانٍ** — ومن أخذ `i > 0` وحدَها رسم خطّاً
                 رأسيّاً في رأس السطر الثاني. */
              className={`flex items-center justify-center gap-2 py-3.5 transition active:opacity-70 ${
                i % cols !== 0 ? "border-s border-[color:var(--divider)] " : ""
              }${i >= cols ? "border-t border-[color:var(--divider)]" : ""}`}
            >
              <StatFace stat={s} />
            </Link>
          ))}
        </div>
        );
      })()}
    </div>
    </>
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
      {/* 🆕 ⚖️ **٢٠ لا ٢٤** (D-459، حكمُ أحمد: «أرقام الكارد كبيرة شوي»)
          — **والعلّةُ هرميّةٌ لا مقاس**: عند ٢٤ كان **الرقمُ أكبرَ نصٍّ
          في الشاشة**، أكبرَ من «تابِع المشاهدة» (٢٢) — **فتقع العينُ على
          «١٠» قبل أن تقع على اسم القسم**، وشريطُ الأرقام اختصاراتٌ لا
          عنوانُ الصفحة. **والعنوانُ يجب أن يبقى أعلى السلّم.**
          ⚠️ **و٢٤/٧٠٠ تبقى في نظام التصميم** لسطحِ الأرقام الحقيقيّ
          (`/stats`) — **الدرجةُ لم تُلغَ، إنما لم تكن هذه موضعَها.** */}
      <span className="text-20 font-bold leading-none tabular-nums">
        {stat.value}
      </span>
      <span className="min-w-0 truncate text-12 font-medium text-muted leading-none">
        {stat.label}
      </span>
    </>
  );
}
