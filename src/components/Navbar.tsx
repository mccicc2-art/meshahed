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
import { ThemeCookieSync } from "./ThemeCookieSync";
import { FontPrefsSync } from "./FontPrefsSync";
import { UiStateSync } from "./UiStateSync";
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
      <header className="sticky top-0 z-30 bg-[color:var(--background)]/80 backdrop-blur pt-[var(--safe-top)]">
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
    <header className="sticky top-0 z-30 border-b border-border bg-[color:var(--background)]/80 backdrop-blur pt-[var(--safe-top)]">
      {/* يهاجر ثيم الحساب إلى الكوكي مرة واحدة — ثم لا يفعل شيئاً */}
      {profile?.theme && <ThemeCookieSync theme={profile.theme} />}
      {/* وحجمُ الخطّ سواء — ولا يُركَّب قبل الهجرة 121 (العمود null) */}
      {profile?.font_ui && profile?.font_content && (
        <FontPrefsSync fontUi={profile.font_ui} fontContent={profile.font_content} />
      )}
      {/* والتلميحاتُ والجولة سواء (طلب أحمد ١٩ أغسطس): الحسابُ ينزل إلى
          الجهاز والجهازُ يصعد إليه مرةً — ولا يُركَّب قبل الهجرة */}
      {profile?.ui_state != null && <UiStateSync uiState={profile.ui_state} />}
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

        {/* **الظرفُ في البداية على الهاتف** (D-258، طلبُ أحمد: «إذا
            الأيقونتين اليمين مسوّين زحمة، ودّي وحدة منهم تكون يمين
            اللوقو»). **وهو شرطُ المنتصف لا زينة**: بثلاثِ أيقوناتٍ في
            الطرف وواحدةٍ في البداية **يصير مركزُ الشريط غيرَ مركزِ
            الفراغ**، فعنوانٌ «في المنتصف» يلامس الجرس. **وبالنقل صار
            الطرفان ٦٤px لكلٍّ** — والمنتصفُ منتصفٌ حقّاً.
            **وعلى الشاشة الواسعة يبقى مكانَه** (D-187: الأخصُّ أقربُ إلى
            صورة الحساب) — **فلا زحامَ هناك، ولا عنوانَ يُوسَّط.** */}
        {user && (
          <div className="md:hidden shrink-0">
            <MessagesLink unread={unreadMessages + unreadSignals} locale={locale} />
          </div>
        )}

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
              <div className="hidden md:block">
                <MessagesLink unread={unreadMessages + unreadSignals} locale={locale} />
              </div>

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
