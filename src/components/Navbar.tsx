import { Suspense } from "react";
import Link from "next/link";
import { getUser, getProfile, getUnreadSignals, getUnreadShares } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SearchBox } from "./SearchBox";
import { NavLinks } from "./NavLinks";
import { NavAvatar } from "./NavAvatar";
import { NavTitle } from "./NavTitle";
import { Logo } from "./Logo";
import { LangFlagMenu } from "./LangFlagMenu";
import { MessagesLink } from "./MessagesLink";
import { buttonClass } from "./ui/Button";

export async function Navbar() {
  const { locale, t } = await getT();
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  /* عدّاد الجرس مع بيانات الترويسة نفسها (D-125): نداءُ عدٍّ واحد خفيف،
     والأسطر لا تُحمَّل إلا لمن فتح. الجرس في الترويسة لا في الشريط
     السفليّ — ذاك أربعة تبويبات لا خامس لها (قاعدة 7، D-051). */
  const unreadSignals = user ? await getUnreadSignals() : 0;
  /* عدّادُ الرسائل مع نفس الموجة (D-187): نداءٌ خفيف بجانب نداء الجرس،
     ولا يُحمَّل خيطٌ واحد لرسم رقم — نفسُ تقسيم D-125. */
  const unreadMessages = user ? await getUnreadShares() : 0;
  const displayName = profile?.nickname || user?.email?.split("@")[0] || "";

  // زائرٌ غير مسجّل: اسمُ المنتج وحده وعلمُ اللغة في الطرف — لا شعار
  // ولا زرّ دخول، فالصفحة نفسها هي الدخول
  if (!user) {
    return (
      <header className="chrome-top sticky top-0 z-30 bg-[color:var(--background)]/80 backdrop-blur pt-[var(--safe-top)]">
        {/* dir=ltr: الاسم يساراً والعلم يميناً بثبات، مهما كانت لغة الصفحة */}
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between" dir="ltr">
          <span className="font-extrabold text-22 tracking-tight">{t.brand}</span>
          <LangFlagMenu locale={locale} />
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
      <div className="relative max-w-6xl mx-auto px-4 h-16 flex items-center gap-2 sm:gap-3">
        <Link href="/" className="shrink-0" aria-label={t.brand}>
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
          <Logo size={44} />
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
              <MessagesLink unread={unreadMessages + unreadSignals} locale={locale} />

              {/* تختفي في الرئيسية وحدها — ترويسة الرئيسية تعرضها كبيرة */}
              <Suspense fallback={null}>
                <NavAvatar
                  src={profile?.avatar_url}
                  name={displayName}
                  title={displayName || t.profile}
                  alt={t.avatarAlt}
                  ariaLabel={t.profile}
                />
              </Suspense>

              {/* زر الخروج صار داخل إعدادات الحساب فقط */}
            </>
          ) : (
            <Link
              href="/login"
              className={buttonClass({ size: "sm" })}
            >
              {t.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
