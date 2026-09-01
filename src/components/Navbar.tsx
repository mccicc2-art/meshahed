import { Suspense } from "react";
import Link from "next/link";
import {
  getUser,
  getProfile,
  getUnreadSignals,
  getUnreadShares,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { SearchBox } from "./SearchBox";
import { NavLinks } from "./NavLinks";
import { NavSettingsButton } from "./NavSettingsButton";
import { NavTitle } from "./NavTitle";
import { Logo } from "./Logo";
import { isPlus } from "@/lib/plan";
import { LangMenu } from "./LangMenu";
import { HeaderTrailing } from "./HeaderTrailing";
import { buttonClass } from "./ui/Button";

export async function Navbar() {
  const { locale, t } = await getT();
  /* موجةٌ واحدة لا أربعُ رحلاتٍ متسلسلة (جولة ٢٠ أغسطس): كانت
     `getUser` ثم البروفايل ثم العدّادان تتوالى — أربعُ رحلاتٍ قبل أن
     يكتمل الشريط في كلِّ تحميل مستند. كلُّها ذاتيّةُ الحراسة (تعود
     null/0 للزائر عبر RLS)، فتنطلق معاً ويحكم أبطؤها وحده.
     عدّاد الجرس مع بيانات الترويسة نفسها (D-125)، وعدّادُ الرسائل مع
     الموجة نفسها (D-187) — الأسطرُ لا تُحمَّل إلا لمن فتح، والجرس في
     الترويسة لا في الشريط السفليّ (قاعدة 7، D-051). */
  const [user, profile, unreadSignals, unreadMessages] = await Promise.all([
    getUser(),
    getProfile(),
    getUnreadSignals(),
    getUnreadShares(),
  ]);
  /* 🗑️ D-865: **وسقط `displayName` معه** — كان اسمَ الصورة وعنوانَها،
     **والترسُ لا يحمل اسمَ صاحبه.** و`profile` باقٍ لشارة Loopz+ وحدَها. */

  /* ⚖️ 🆕 **زائرٌ غير مسجّل: صار له زرُّ دخولٍ** (D-627) — كان الشريطُ
     اسمَ المنتج والعلمَ وحدَهما «فالصفحةُ نفسُها هي الدخول»، **وماتت
     الحجّةُ يومَ صار الزائرُ يتصفّح اكتشف والكوميونيتي والبروفايلات**:
     في كلِّ صفحةٍ يقف فيها يحتاج بابَ الدخول أمامه لا في ذاكرته. */
  if (!user) {
    return (
      <header className="chrome-top sticky top-0 z-30 bg-[color:var(--background)]/80 backdrop-blur pt-[var(--safe-top)]">
        {/* dir=ltr: الاسم يساراً والعلم يميناً بثبات، مهما كانت لغة الصفحة */}
        <div
          className="max-w-shell mx-auto px-5 h-16 flex items-center justify-between"
          dir="ltr"
        >
          {/* ⚖️ 🆕 الرمزُ لا الكلمة (D-628 — تطبيقُ D-256 على شريط الزائر:
              «الأيقونة في كل الصفحات بدل كلمة لوبز») — شريطُ الزائر كان
              الوحيدَ الذي بقي على الكلمة، وهويّتان في شريطٍ واحدٍ عطل */}
          <Link
            href="/"
            prefetch={false}
            className="shrink-0"
            aria-label={t.brand}
          >
            <Logo size={44} />
          </Link>
          <span className="flex items-center gap-2.5">
            <LangMenu locale={locale} />
            <Link
              href="/login"
              prefetch={false}
              className={buttonClass({ size: "sm" })}
            >
              {t.login}
            </Link>
          </span>
        </div>
      </header>
    );
  }

  return (
    /* حشوةٌ علوية بمقدار `--safe-top`: التطبيق المثبّت على الشاشة الرئيسية
       يبدأ من y=0 تحت ساعة النظام والبطارية، فكان اسم Loopz يجلس فوق
       الساعة حرفياً (D-040 عالج ترويسة الغلاف في الرئيسية وحدها، وكلّ
       صفحةٍ أخرى تحمل هذا الشريط). المتغيّر صفرٌ في المتصفّح فلا شيء
       يتغيّر هناك، و`max(env(), 47px)` في الوضع المثبّت. */
    <header className="chrome-top sticky top-0 z-30 border-b border-border bg-[color:var(--background)]/80 backdrop-blur pt-[var(--safe-top)]">
      {/* ⚖️ 🆕 **والتوائمُ الثلاثة غادرت إلى `AccountSync`** (D-498):
          **هذا الشريطُ يعود `null` في كلِّ مسارِ إعدادات** (D-462)،
          **فكان تفضيلُ الحساب لا ينزل إلى جهازٍ جديد في الصفحة التي
          فُتحت لضبطه.** **والمضيفُ الآن تخطيطُ الجذر** — لا يُلغى. */}
      <div className="relative max-w-shell mx-auto px-4 h-16 flex items-center gap-2 sm:gap-3">
        <Link
          href="/"
          prefetch={false}
          className="shrink-0"
          aria-label={t.brand}
        >
          {/* **الرمزُ وحده في الشريط** (D-256، طلبُ أحمد: «الأيقونة في كل
              الصفحات بدل كلمة لوبز اللي فوق»). **ونقضٌ يُسجَّل**: كان
              السطرُ هنا يقول «الرمزُ سقط من الهوية فالكلمة هي الشعار» —
              **والهويّةُ الجديدة أعادت الرمزَ ومعه الوردمارك المرسوم**،
              فالحجّةُ ماتت بموت سببها.

              **🆕 والمقاسُ ٤٤ لا ٣٢** (D-258، بلاغُ أحمد: «أحسه صغير
              شوي») — **والعلّةُ قِيست لا خُمِّنت**: الملفُّ مربّعٌ
              ٥١٢×٥١٢ **والعلامةُ فيه ٤٣٧×٢٢١** (بحشوٍ مقصودٍ ليصلح
              صورةَ حساب). **فمربّعُ ٣٢ يرسم `∞` ارتفاعُها ١٤px** —
              أصغرَ من حرفٍ في السطر المجاور. **والمربّعُ يكبر ولا يُقصّ
              الملفّ**: هو نفسُه صورةُ حساب Loopz، **وقصُّه هنا يقصّه
              هناك.** ٤٤ تعطي `∞` بـ٣٧×١٩ — تُقرأ ولا تزاحم. */}
          {/* 🆕 **وتجربةُ Loopz+ في الشريط أيضاً** (D-773): الزائدةُ
              الصفراء لصاحب البلس والبارتنر. **والزائرُ فوق لا يراها**
              — لا خطّةَ له، وشعارٌ يعِد بما لا يملكه إعلانٌ لا هويّة. */}
          <Logo size={44} plus={isPlus(profile)} />
        </Link>

        {user && <NavLinks locale={locale} />}

        {/* **اسمُ الصفحة في المنتصف** (D-258) — والمكوّنُ يقرّر متى يظهر */}
        {user && <NavTitle locale={locale} />}

        {/* ⚖️ **والظرفُ عاد إلى الطرف على كلِّ مقاس** (D-488، طلبُ أحمد
            ٢٠ أغسطس بلقطةٍ معلَّمة: «الرسائل دائماً مكانها يمين نفس
            الهوم») — **نقضُ نقلِ D-258 إلى البداية.**

            **وحجّةُ D-258 كانت توازنَ الطرفين ليصحّ المنتصف** — **وقد
            سقطت بأن العنوانَ مركَّزٌ بالمطلق لا بالتدفّق** (`NavTitle`:
            `absolute inset-x-0` مع حشوٍ جانبيّ)، **فمركزُه مركزُ الشريط
            مهما تفاوت طرفاه.**
            **والذي بقي بعد سقوطها هو العطلُ الذي رآه أحمد**: الظرفُ
            يقفز من يمين الشاشة في الرئيسية إلى يسارها في كلِّ صفحةٍ
            أخرى — **وبابٌ واحدٌ بموضعين يُبحث عنه في كلِّ مرّة**
            (D-150: العُرفُ يُبنى بالثبات لا بالتوازن). */}
        <div className="flex-1 flex justify-end items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <div className="hidden md:block w-56">
                <Suspense fallback={null}>
                  <SearchBox locale={locale} />
                </Suspense>
              </div>

              {/* 🆕 **بابٌ واحدٌ للبريد كلِّه** (D-463): الجرسُ سقط
                  **وصارت الإشعاراتُ تبويباً في `‎/messages`** — والعدُّ
                  هنا مجموعُهما، **وتفصيلُه على تبويبَي الصفحة** فلا
                  تعود الشارةُ الواحدةُ تعني ثلاثة أشياء (حجّةُ D-187). */}
              {/* **موضعٌ واحدٌ في كلِّ مقاسٍ وكلِّ صفحة** — بجوار صورة
                  الحساب كما في ترويسة الرئيسية بالضبط (D-488) */}
              {/* ⚖️ 🆕 **والجرسُ عاد بجانبه** (D-536، تصميمُ أحمد):
                  **الشارةُ الواحدةُ انقسمت رقمين** — الإشعاراتُ هنا
                  والرسائلُ هناك — **وكلُّ رقمٍ يفتح على ما يعدّه.**
                  **والترتيبُ جرسٌ ثمّ ظرفٌ ثمّ صورة** كما في تصميمه.
                  🆕 **والصفُّ صار مكوّناً واحداً** (D-541): **المسافةُ
                  والمقاسُ يُكتبان في `HeaderTrailing` مرّةً**، فلا يقفز
                  الجرسُ ولا الظرفُ بين هذا الشريط وشريط الرئيسية. */}
              <HeaderTrailing
                unreadSignals={unreadSignals}
                unreadShares={unreadMessages}
                locale={locale}
              >
                {/* 🆕 D-865: ترسٌ لا صورة — **ولا `Suspense`**: ما كان
                    يُنتظر هو صورةُ الملفّ، ولم يعد يُقرأ منها شيء. */}
                <NavSettingsButton
                  title={t.headerSettings}
                  ariaLabel={t.headerSettings}
                />
              </HeaderTrailing>

              {/* زر الخروج صار داخل إعدادات الحساب فقط */}
            </>
          ) : (
            <Link href="/login" className={buttonClass({ size: "sm" })}>
              {t.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
