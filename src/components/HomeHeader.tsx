import Link from "next/link";
import { getDict, type Locale } from "@/core/i18n";
import { Icon, type IconName } from "./Icon";
import { HEADER_ICON, headerIconControl } from "./ui/controls";
import { HomeAvatarLink } from "./HomeAvatarLink";
import { HomeViewSwitch } from "./HomeViewSwitch";
import { HeaderTrailing } from "./HeaderTrailing";
import { LogoWordmark } from "./Logo";
import { AccountIdentity } from "./AccountIdentity";
import { isPlus } from "@/core/plan";
/**
 * 🆕 **خانةُ بطاقة الأرقام — تسكن مع راسمها** (D-497): كانت تُستورد
 * نوعاً من `ProfileHeader` — **وتلك حُذفت بعد أن فقدت قارئَها في
 * D-438** (D-214)، **والنوعُ نُقل أوّلاً ثمّ حُذف الملفّ.**
 */
/* ⚖️ 🆕 D-1258 — **رأسُ الرئيسيّة صفٌّ واحد، كما في التطبيق** (D-1233 هناك؛ أحمد، ٣ أكتوبر ٢٠٢٦: «شكل الهوم الجديد
   طبّقه في الويب» بعد صورةٍ اعتمدها). **خرج من هنا**: الغلافُ خلف الشريط بوصفته كلِّها (`COVER_SCRIM`/`COVER_FADE`/
   `COVER_ART_SHADOW` — D-540 … D-853)، وسطرُ `@username • المتابعون` (D-618/D-621)، وختمُ التوثيق — مكانُها الملفُّ
   الشخصيّ. **وبقي**: الصورةُ ٣٢ · الاسمُ ٢٢/٧٠٠ (حجمُ عنوان القسم تحته) · شارةُ الاشتراك · مبدّلُ العرض على خطِّ «الكلّ».
   الشريطُ فوقه بلون الصفحة دائماً — لا شيءَ يقف على صورةٍ بعد اليوم. */

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
  plan = null,
  founder = false,
  plusUntil = null,
  locale,
}: {
  displayName: string;
  /* **شارةُ Loopz+** (D-633) — اختياريّان بافتراضٍ صامت (D-028). والتاريخُ يُمرَّر لا يُهمَل (D-773): غيابُه كان
     يُقرأ «بلا انتهاء» فيرى المنتهي اشتراكُه شارتَه حيّة. */
  plan?: string | null;
  founder?: boolean | null;
  plusUntil?: string | null;
  avatarUrl?: string | null;
  avatarPos?: number | null;
  /** عدّادان لا مجموع (D-536) — لكلِّ بابٍ رقمُه */
  unreadSignals?: number;
  unreadShares?: number;
  /** خاناتُ بطاقة الأرقام — من التخصيص، اثنتان إلى أربع (D-152) */
  stats: HeaderStat[];
  showStats: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  /* D-1129 (التطبيق) — أربعُ خاناتٍ في صفٍّ واحد، والخانةُ عندها عموديّة: ربعُ العرض لا يتّسع لرمزٍ ورقمٍ واسمٍ في سطر */
  const stacked = stats.length === 4;

  return (
    <>
      {/* ===== صفُّ العلامة وأدواتُها (D-536) — على الجوّال وحدَه (`md:hidden`)، والشريطُ الواسع باقٍ بروابطه
        (`hidesAppHeaderOnMobile` في `chromeRules`). `chrome-top` يُخفيه مع النزول (D-479)، وحشوةُ `--safe-top` لأنه
        أوّلُ ما تحت ساعة النظام (D-040). ارتفاعُه `10 + 44 + 10 = 64` — `h-16` في `Navbar` حرفاً (D-543) فلا يقفز
        شيءٌ رأسيّاً في الانتقال. ===== */}
      <header className="chrome-top md:hidden sticky top-0 z-30 -mx-4 px-4 -mt-6 pt-[calc(var(--safe-top)+0.625rem)] pb-2.5 bg-[color:var(--background)]">
        <div className="flex items-center gap-1">
          <Link
            href="/"
            prefetch={false}
            aria-label={t.brand}
            className="shrink-0 -ms-0.5"
          >
            {/* **الكلمةُ المرسومة لا الرمز** — علامةُ الرئيسية في تصميم أحمد؛ وصاحبُ البلس يرى `Loopz+` (D-773)،
              والحكمُ من `plan.ts` لا من شرطٍ مكتوبٍ هنا (D-145). */}
            <LogoWordmark
              size={30}
              on="surface"
              plus={isPlus({ plan, founder, plus_until: plusUntil })}
            />
          </Link>

          {/* **الطرفُ صفٌّ واحدٌ مشترك** (D-541): المسافةُ والمقاسُ في `HeaderTrailing` مرّةً، يقرؤها هذا الشريطُ
            و`Navbar` — فلا يقفز الجرسُ ولا الظرفُ في الانتقال. والترسُ في خانته الأخيرة (D-774)، بوصفة
            `headerIconControl` الواحدة (D-776). */}
          <div className="ms-auto">
            <HeaderTrailing
              unreadSignals={unreadSignals}
              unreadShares={unreadShares}
              locale={locale}
            >
              <Link
                href="/profile/settings"
                prefetch={false}
                aria-label={t.settingsNavHeading}
                title={t.settingsNavHeading}
                className={headerIconControl}
              >
                <Icon name="settings" size={HEADER_ICON} />
              </Link>
            </HeaderTrailing>
          </div>
        </div>
      </header>

      {/* ===== محتوًى يجري مع الصفحة (D-479): صفُّ الترحيب ثمّ بطاقةُ الأرقام ===== */}
      <div className="relative space-y-2.5">
        <div className="flex items-center gap-2.5">
          {/* الصورةُ بابٌ مباشرٌ إلى الملفّ (D-774) */}
          <HomeAvatarLink
            locale={locale}
            name={displayName}
            avatarUrl={avatarUrl}
            avatarPos={avatarPos}
          />
          {/* `flex-1` للحاوية لا للاسم (D-634): الشارةُ تبقى ملتصقةً بالاسم والمبدّلُ يُدفع إلى الطرف.
            وختمُ التوثيق لا يُرسم هنا (D-1233): `verified_at: null` — يبقى في الملفّ والإعدادات. */}
          <div className="min-w-0 flex-1">
            <AccountIdentity
              as="p"
              name={displayName}
              profile={{ plan, founder, plus_until: plusUntil, verified_at: null }}
              t={t}
              className="text-22 font-bold leading-tight"
            />
          </div>
          {/* **المبدّلُ على خطِّ «الكلّ»** (D-1233): هدفُ اللمس ٤٠ كما هو، والرمزُ (١٨) يُسنَد إلى حافّة الصفحة —
            `(40 − 18) ÷ 2 = 11` تُسحب من الطرف. و`shrink-0`: الاسمُ هو ما يُقصّ عند الضيق لا الزرّ. */}
          <span className="shrink-0 -me-[11px]">
            <HomeViewSwitch locale={locale} />
          </span>
        </div>

        {/* ===== بطاقةُ الأرقام — واحدةٌ في الوضعين (D-439) =====
          ⚖️ 🆕 D-1258 — **على لون الصفحة بلا فواصل بين الخانات** (D-1093 في التطبيق: «خلّ خلفيّتها سوداء بدل رصاصي
          وبدون خطوط بينهم») — ينقض سطحَ D-618 وفواصلَه. الإطارُ الرفيعُ وحدَه يحدّها، و`--background` لا لونٌ
          أصمّ كي يصحّ «النهاري». **وأربعُ خاناتٍ صفٌّ واحد** (D-1129) — ينقض عمودَي D-487. */}
        {showStats && stats.length > 0 && (
          <div
            className="grid rounded-2xl border border-border bg-[color:var(--background)] overflow-hidden"
            style={{
              /* العمودُ بمقاس محتواه ثمّ يُقسم الفائضُ بالتساوي (D-787) — وعند الأربعة أرباعٌ متساوية: الخانةُ
                 عموديّةٌ وموسَّطة، فالقسمةُ العادلةُ هي ما يصفّها */
              gridTemplateColumns: stacked
                ? "repeat(4, minmax(0,1fr))"
                : `repeat(${stats.length}, minmax(0,auto))`,
            }}
          >
            {stats.map((s) => (
              <Link
                key={s.key}
                href={s.href ?? "/library"}
                className={
                  stacked
                    ? "flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-[11px] lg:py-5 transition active:opacity-70"
                    : "flex items-center justify-center gap-1.5 px-1.5 py-3 lg:px-3 lg:py-5 transition active:opacity-70"
                }
              >
                <StatFace stat={s} stacked={stacked} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** وجهُ الخانة — سطرٌ واحد (رمزٌ · رقم · اسم — D-620)، أو عمودٌ عند الأربع: الرمزُ والرقمُ فوق والاسمُ تحته (D-1129) */
function StatFace({ stat, stacked }: { stat: HeaderStat; stacked: boolean }) {
  /* الدرجاتُ الثلاثُ تصعد معاً على الواسعة (D-847): ١٦/١٥/١٢ على الجوّال، ٢٠/٢٠/١٤ على الواسعة — والرمزُ بصنفٍ
     لا برقمٍ ثانٍ (`size` سِمةٌ والصنفُ يغلبها). */
  const icon = (
    <Icon
      name={stat.icon}
      size={16}
      className="lg:w-5 lg:h-5"
      style={{ color: stat.color ?? "var(--accent)" }}
    />
  );
  const value = (
    <span className="text-15 lg:text-20 font-bold leading-none tabular-nums">
      {stat.value}
    </span>
  );
  const label = (
    <span className="min-w-0 max-w-full truncate text-12 lg:text-14 font-medium text-muted leading-none">
      {stat.label}
    </span>
  );
  if (stacked)
    return (
      <>
        <span className="flex items-center gap-1">
          {icon}
          {value}
        </span>
        {label}
      </>
    );
  return (
    <>
      {icon}
      {value}
      {label}
    </>
  );
}
