import { Suspense } from "react";
import Link from "next/link";
import { getUser, getProfile, getUnreadSignals, getUnreadShares } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SearchBox } from "./SearchBox";
import { NavLinks } from "./NavLinks";
import { NavAvatar } from "./NavAvatar";
import { LogoWordmark } from "./Logo";
import { LangFlagMenu } from "./LangFlagMenu";
import { ThemeCookieSync } from "./ThemeCookieSync";
import { NotificationBell } from "./NotificationBell";
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
          <span className="font-extrabold text-[22px] tracking-tight">{t.brand}</span>
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
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-2 sm:gap-3">
        <Link href="/" className="shrink-0" aria-label={t.brand}>
          {/* الكلمة تظهر كاملةً في كل المقاسات: كانت تُخفى على الجوال ويبقى
              الرمز — والرمز سقط من الهوية فالكلمة هي الشعار */}
          <LogoWordmark size={28} />
        </Link>

        {user && <NavLinks locale={locale} />}

        <div className="flex-1 flex justify-end items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <div className="hidden md:block w-56">
                <Suspense fallback={null}>
                  <SearchBox locale={locale} />
                </Suspense>
              </div>

              {/* الظرفُ قبل الجرس: الرسائل أخصُّ من الإشعارات، والأخصُّ
                  أقربُ إلى صورة صاحب الحساب (D-187) */}
              <MessagesLink unread={unreadMessages} locale={locale} />

              <NotificationBell unread={unreadSignals} locale={locale} />

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
