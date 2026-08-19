import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { PullToRefresh } from "@/components/PullToRefresh";
import { BottomNav } from "@/components/BottomNav";
import { OfflineSync } from "@/components/OfflineSync";
import { ToastHost } from "@/components/ToastHost";
import { TourMount } from "@/components/TourMount";
import { SwRegister } from "@/components/SwRegister";
import { cookies } from "next/headers";
import { getT } from "@/lib/locale";
import { getDict, isRtl } from "@/lib/i18n";
import { themeById, themeCss } from "@/lib/themes";
import { FONT_UI_COOKIE, FONT_CONTENT_COOKIE, fontAttr, sanitizeFontSize } from "@/lib/fontPrefs";
import { HeaderShell } from "@/components/HeaderShell";
import { getLocale } from "@/lib/locale";
import { seoKeywords } from "@/lib/seo";

export const viewport: Viewport = {
  themeColor: "#0D0D0D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale);
  /* صورة المشاركة لم تعد مذكورةً هنا: `app/opengraph-image.tsx` يتكفّل بها
     لكل المسارات آلياً (og:image وtwitter:image معاً) ببطاقةٍ عريضة
     1200×630 بدل المربّعة القديمة. ذكرُها هنا أيضاً كان سيُنتج وسمين.
     وسببُ وجودها أصلاً باقٍ: بلا `og:image` كانت منصّات المشاركة تكشط
     الصفحة وتلتقط أول صورةٍ مناسبة — علم بلد المشاهدة — فيظهر العلمُ لا
     الشعار. و`metadataBase` هو ما يجعل المسار مطلقاً للكاشطات. */
  return {
    metadataBase: new URL("https://loopztv.com"),
    /* قالبٌ للعنوان (D-122): كل صفحةٍ تكتب عنوانها وحده ويُلحَق اسم
       العلامة آلياً. قبله كانت كل صفحةٍ تكتب «— Loopz» بيدها، ومن نسيها
       ظهر في نتائج البحث بعنوانٍ بلا علامة — واسم العلامة في العنوان هو
       ما يجعل الباحث يتعرّف علينا قبل أن ينقر. */
    title: { default: t.metaTitle, template: `%s — ${t.brand}` },
    description: t.metaDescription,
    applicationName: t.brand,
    /* الوسم يتجاهله قوقل ويستعمله Bing بوزنٍ ضعيف — وجودُه رخيصٌ ولا يضرّ،
       والعمل الحقيقي أن تكون هذه المعاني مكتوبةً في نصّ صفحة الهبوط */
    keywords: seoKeywords(locale),
    category: "entertainment",
    creator: t.brand,
    publisher: t.brand,
    appleWebApp: { capable: true, title: t.brand, statusBarStyle: "black-translucent" },
    icons: {
      icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      siteName: t.brand,
      title: t.metaTitle,
      description: t.metaDescription,
      locale: locale === "ar" ? "ar_SA" : "en_US",
      /* لا `url` هنا: كانت تُورَّث فتصير `og:url` لكل صفحةٍ في التطبيق
         هي الجذر، فتُشارَك صفحة عملٍ بعنوان الصفحة الرئيسية */
    },
    twitter: {
      card: "summary_large_image",
      title: t.metaTitle,
      description: t.metaDescription,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, t } = await getT();
  // الثيم من كوكي لا من قاعدة البيانات: انتظارُ الجلسة والبروفايل هنا كان
  // يؤخّر أول بايت للصفحة كلها ~نصف ثانية. ThemeCookieSync يهاجر القدامى.
  const cookieStore = await cookies();
  const theme = themeById(cookieStore.get("theme")?.value);

  /* حجم الخطّ من كوكي كالثيم سواء: الخادم يكتب `data-fs-*` على الجذر
     قبل أول رسمة فلا وميضَ ولا فرقَ ترطيب. الافتراضي بلا سمةٍ أصلاً. */
  const fsUi = fontAttr(sanitizeFontSize(cookieStore.get(FONT_UI_COOKIE)?.value));
  const fsContent = fontAttr(sanitizeFontSize(cookieStore.get(FONT_CONTENT_COOKIE)?.value));

  /* هل الزائر مسجَّل؟ فحصُ كوكي الجلسة لا `getUser()` (D-122).
     الجذر صار يعرض صفحة هبوطٍ للزائر غير المسجّل، وشريطُ تبويبات التطبيق
     فوق صفحة تعريفٍ بالمنتج يقود إلى صفحاتٍ كلّها تردّه إلى الدخول.
     ولماذا الكوكي لا الجلسة الحقيقية: `getUser()` رحلة شبكةٍ كاملة إلى
     Supabase، ووضعُها هنا يحبس أول بايتٍ لكل صفحةٍ في التطبيق خلفها —
     وهي مخاطرة أداءٍ لا تستحقّها مسألةُ «هل نُظهر شريطاً». الخطأ الوحيد
     الممكن أن يرى صاحبُ كوكيٍّ منتهٍ الشريطَ لحظةً، وهو يراه اليوم دائماً. */
  const signedIn = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className="h-full antialiased"
      data-fs-ui={fsUi}
      data-fs-content={fsContent}
      suppressHydrationWarning
    >
      <head>
        {/* ألوان الثيم متغيّرات CSS مبنية من قائمة ثابتة في themes.ts — لا مدخلات مستخدم */}
        <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
        {/* هل نحن داخل تطبيقٍ مثبّت؟ سطرٌ واحد قبل أول رسمة.
            يجري هنا لا في تأثيرٍ بعد التركيب: لو تأخّر لرُسمت الترويسة
            مرّةً فوق الساعة ثم قفزت — والقفزة أسوأ من التراكب.
            ثابتٌ حرفياً بلا أي مدخلٍ من المستخدم. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var m=function(q){return window.matchMedia&&window.matchMedia(q).matches};" +
              "if(navigator.standalone||m('(display-mode: standalone)')||m('(display-mode: fullscreen)')||m('(display-mode: minimal-ui)'))" +
              "document.documentElement.setAttribute('data-standalone','1')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* رابط تخطّي للتنقّل بلوحة المفاتيح — يظهر عند التركيز فقط */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:start-3 focus:bg-accent focus:text-[color:var(--on-accent)] focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
        >
          {t.navHome}
        </a>
        <Suspense fallback={null}>
          <HeaderShell signedIn={signedIn}>
            <Navbar />
          </HeaderShell>
        </Suspense>
        {/* مساحة سفلية على الجوال حتى لا يغطي شريط التبويبات المحتوى */}
        {/* **السحبُ للتحديث في التخطيط لا في كل صفحة** (D-243، طلبُ
            أحمد: «إذا سحبت يعمل تحديث مثل تويتر»). **وتويتر لا يحصره في
            الخطّ**، وحصرُه في صفحةٍ يجعل الإيماءةَ تعمل مرّةً وتصمت
            مرّة — **وإيماءةٌ تعمل أحياناً أسوأ من إيماءةٍ لا توجد.**
            وهو خفيف: مستمعُ لمسٍ واحد، ولا يُركَّب على غير اللمس أصلاً. */}
        <PullToRefresh />
        {/* 🆕 **وذيلُ الصفحة صار مسؤوليّةَ التخطيط** (D-437): كان التذييل
            يحمل `pb-28` فيبعد المحتوى عن الشريط السفليّ، **فلمّا سقط
            سقطت معه المسافة** — **والمساحةُ تُحجز حيث تُستعمل لا في
            عنصرٍ يصادف أن يكون آخر ما في الصفحة.** */}
        <main
          id="main"
          className="flex-1 w-full max-w-6xl mx-auto px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8"
        >
          {children}
        </main>
        {/* 🗑️ 🆕 **وسطرُ «Every story matters» سقط من التطبيق** (D-437،
            طلبُ أحمد: «احذف عبارة every story matters المكتوب تحت»):
            **شعارٌ يُعاد تحت كلِّ شاشةٍ يُقرأ مرّةً ثم لا يُقرأ**،
            **وثمنُه ٩٠px من ذيل كلِّ صفحةٍ على الجوّال** (`pb-28`) —
            وهي بالضبط المساحةُ التي طُلبت للمحتوى.
            **والسطرُ باقٍ في مكانٍ واحدٍ يُقرأ فيه**: صفحةُ الهبوط تحت
            زرِّ الدخول (`LandingHero`) — **فالعلامةُ تُعرَّف مرّةً لمن
            لا يعرفها، لا في كلِّ شاشةٍ لمن يستعملها كلَّ يوم.** */}
                {/* نقطةُ «جديد» تُبثّ خلف Suspense: عدُّها نداءُ قاعدة، ولو انتظرته
            الصفحة لتأخّر أوّل بايت في كل مسار (نفس سبب Suspense للترويسة) */}
        <BottomNav
          locale={locale}
          signedIn={signedIn}
        />
        <OfflineSync />
        <ToastHost />
        {/* بوّابة الجولة التعريفية — تصمت في الحالة الشائعة، والمحرّك
            يُحمَّل عند الحاجة وحدها (D-469) */}
        <TourMount locale={locale} signedIn={signedIn} />
        {/* بصمة البناء تُخبز في الصفحة: بها يعرف التبويب المُستأنَف أنه
            عتيق فيُبدّل نفسه فوراً (علاج وميض «تسجيل الدخول القديم») */}
        <SwRegister build={process.env.VERCEL_GIT_COMMIT_SHA ?? "dev"} />
        {/* قياس Web Vitals من أجهزة المستخدمين الحقيقية — لا يرسم شيئاً،
            ويرسل لنطاقنا نفسه (/_vercel/speed-insights) فلا يوسّع CSP.
            به تُلتقط أي نكسة أداءٍ قادمة بالأرقام لا بالشكوى. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
