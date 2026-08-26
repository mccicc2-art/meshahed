import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { PullToRefresh } from "@/components/PullToRefresh";
import { BottomNav } from "@/components/BottomNav";
import { OfflineSync } from "@/components/OfflineSync";
import { ToastHost } from "@/components/ToastHost";
import { LoginGateHost } from "@/components/LoginGateHost";
import { PlusGateHost } from "@/components/PlusGateHost";
import { TourMount } from "@/components/TourMount";
import { SwRegister } from "@/components/SwRegister";
import { cookies } from "next/headers";
import { getT } from "@/lib/locale";
import { getDict, isRtl } from "@/lib/i18n";
import { themeById, themeCss } from "@/lib/themes";
import { FONT_UI_COOKIE, FONT_CONTENT_COOKIE, fontAttr, sanitizeFontSize } from "@/lib/fontPrefs";
import { HeaderShell } from "@/components/HeaderShell";
import { ChromeAutoHide } from "@/components/ChromeAutoHide";
import { AccountSync } from "@/components/AccountSync";
import { LangPing } from "@/components/LangPing";
import { getLocale } from "@/lib/locale";
import { seoKeywords } from "@/lib/seo";

/* شاشاتُ إقلاع iOS المثبَّت (جولة ١٩ أغسطس ليلاً): بدونها يفتح تطبيقُ
   الشاشة الرئيسية على سوادٍ فارغٍ حتى يصل أوّلُ بايت — وهذه هي «الشاشة
   السوداء» التي بلّغ عنها أحمد بعينها. iOS لا يقبل إلا صورةً بمقاس
   الجهاز بالضبط، فالقائمةُ تغطّي أجهزةَ iPhone القائمة، والصورةُ نفسُها
   مطابقةٌ لواجهة `#lz-launch` (خلفيّةٌ سوداء وشعارٌ في المنتصف) —
   **فالانتقالُ من إقلاع النظام إلى شاشتنا لا يُرى أصلاً.**
   (w وh بالبكسل الفعليّ، وr كثافةُ الشاشة — يُشتقّ منها استعلامُ الوسائط.) */
const IOS_SPLASH: { w: number; h: number; r: number }[] = [
  { w: 750, h: 1334, r: 2 }, // SE2/SE3/8
  { w: 828, h: 1792, r: 2 }, // XR/11
  { w: 1080, h: 2340, r: 3 }, // 12/13 mini
  { w: 1125, h: 2436, r: 3 }, // X/XS/11 Pro
  { w: 1170, h: 2532, r: 3 }, // 12/13/14
  { w: 1179, h: 2556, r: 3 }, // 14 Pro/15/16
  { w: 1206, h: 2622, r: 3 }, // 16 Pro
  { w: 1242, h: 2688, r: 3 }, // XS Max/11 Pro Max
  { w: 1260, h: 2736, r: 3 }, // Air — ٤٢٠×٩١٢ نقطة، ولا مقاسَ آخرَ يقاربه
  { w: 1284, h: 2778, r: 3 }, // 12/13 Pro Max/14 Plus
  { w: 1290, h: 2796, r: 3 }, // 14 Pro Max/15 Plus/16 Plus
  { w: 1320, h: 2868, r: 3 }, // 16 Pro Max
];

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
    appleWebApp: {
      capable: true,
      title: t.brand,
      statusBarStyle: "black-translucent",
      /* شعارُ Loopz من أوّل إطارٍ في التطبيق المثبَّت — انظر IOS_SPLASH */
      startupImage: IOS_SPLASH.map(({ w, h, r }) => ({
        url: `/splash/launch-${w}x${h}.png`,
        media: `(device-width: ${w / r}px) and (device-height: ${h / r}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
      })),
    },
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
        {/* 🔴 **الوسمُ الذي بلا وجودِه لا تُقرأ صورُ الإقلاع أصلاً** (D-500،
            بلاغُ أحمد بعد إعادة التثبيت: «ما زالت سوداء»): سفاري لا يقرأ
            `apple-touch-startup-image` **إلا إذا وُجد
            `apple-mobile-web-app-capable`** — والمانيفست لا يُغني عنه مهما
            قال `display: standalone`. **وNext أسقطه من `appleWebApp.capable`
            وأبقى البديلَ القياسيَّ `mobile-web-app-capable` وحدَه**، فصارت
            الاثنتا عشرة صورةً مكتوبةً في `<head>` **ولا يقرؤها أحد**،
            وiOS يرسم خلفيّةَ النظام السوداء. **يُكتب بيدٍ هنا لأن واجهةَ
            `metadata` لم تعد تكتبه.** */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* 🔴 🆕 **قماشُ المتصفّح داكنٌ من أوّل بايت** (D-532): هذا الوسمُ
            يُقرأ قبل أيِّ CSS، **فالفجواتُ التي يرسم فيها iOS قماشَه هو —
            لا صفحتَنا — تصير بلون الثيم لا بيضاء.** التفصيلُ في
            `themes.ts`. والقيمةُ من الثيم نفسِه فلا يختلف الوسمُ والأنماط. */}
        <meta name="color-scheme" content={theme.id === "daylight" ? "light" : "dark"} />
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
        {/* جافاسكربت معطّلة؟ شاشةُ الإقلاع لن تجد من يذيبها — فلا تُرسم */}
        <noscript>
          <style>{`#lz-launch{display:none}`}</style>
        </noscript>
      </head>
      <body className="min-h-full flex flex-col">
        {/* شاشةُ الإقلاع — في HTML الأوّل نفسِه فتُرسم مع أوّل بايت،
            قبل أيّ جافاسكربت أو شبكة. سكربتُ الإذابة في ذيل القشرة
            أدناه، وأنماطُها في globals.css. التنقّلُ الداخليُّ لا يعيد
            رسمَ التخطيط فلا تظهر فيه. ولمن عطّل جافاسكربت: تُخفى فوراً
            (noscript في الرأس) فلا تحبس الصفحة.

            🔴 **ولماذا `dangerouslySetInnerHTML` لا JSX مباشر** (عطلُ
            ٢٠ أغسطس، لقطةُ أحمد من الآيفون: global-error يبتلع التطبيق
            كلَّه): النسخةُ الأولى كانت عنصرَ JSX يديره React، وسكربتُ
            الإذابة كان **يحذف العقدةَ من DOM قبل اكتمال الترطيب** —
            فيجد React شجرةً غيرَ التي أرسلها الخادم. كروم سطحِ المكتب
            يرطّب قبل أن يعمل السكربت فلا يرى شيئاً، **وسفاري iOS أبطأُ
            ترطيباً فيُرطِّب بعد الحذف وينهار إلى global-error.**
            **فالقاعدة: عقدةٌ يلمسها سكربتٌ مضمَّنٌ لا يجوز أن يديرها
            React** — هنا React يملك الغلافَ وحدَه ولا يقرأ ما بداخله،
            **والإذابةُ صنفُ CSS يُضاف ولا عقدةَ تُحذف أبداً.** */}
        <div
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              '<div id="lz-launch" aria-hidden="true">' +
              '<img src="/loopz-wordmark.png" alt="" width="720" height="247"></div>',
          }}
        />
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
        {/* 🆕 **مزامنةُ تفضيلات الحساب — خارج الشريط لا داخله** (D-498):
            الشريطُ يُلغى في الإعدادات، **والتفضيلُ يجب أن ينزل هناك
            بالذات.** لا ترسم شيئاً، وتُبثّ فلا تحبس أوّل بايت. */}
        <Suspense fallback={null}>
          <AccountSync />
        </Suspense>
        {/* 🆕 **نبضةُ لغةِ الزائر** (D-666، طلبُ أحمد: «فعّل العدّاد»):
            **لا ترسم شيئاً ولا ترسل شيئاً** — تنادي بابَها فارغاً بعد
            الرسم مرّةً في الجلسة، **والترويسةُ تُقرأ على الخادم.**
            ⚠️ **وليست في `Suspense`**: لا تجلب شيئاً ولا تُبثّ. */}
        <LangPing />
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
            عنصرٍ يصادف أن يكون آخر ما في الصفحة.**

            ⚖️ 🆕 **والحجزُ صار مقعدَ الدوك بالضبط لا تقديراً فوقه**
            (D-506، لقطةُ أحمد بخربشةٍ حمراء على قاع الرئيسية: «إذا
            سحبت لفوق يستجيب وتحت أصلاً ما فيه شي — فيه هامش احذفه»):
            كانت `5.75rem + env()` **فتحجز ٤٤نقطة فوق حاجة الدوك على
            الآيفون** (الدوك ٦٥ + `max(8, env/2)` — وenv تُضاف هنا
            كاملةً وهناك نصفاً). **والصيغةُ الآن جسدُ الدوك + ٦px
            نَفَس**: `71px + max(0.5rem, env/2)` — **الرقمان من ملفّ
            `BottomNav` نفسِه (pt-2.5 + المحتوى = 65، وpb مطابق)**،
            فإن كبر الدوك يوماً كبر هذا معه أو انكشف فوراً. */}
        <main
          id="main"
          className="flex-1 w-full max-w-6xl mx-auto px-4 pt-6 pb-[calc(71px+max(0.5rem,env(safe-area-inset-bottom)/2))] md:pb-8"
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
        {/* 🔴 🆕 **إزالةُ شاشة الإقلاع — عند الجاهزيّة لا عند التحليل**
            (D-529، تسجيلُ أحمد للإقلاع البارد: «شعاران متداخلان عند
            ~١٫٠٣ث مع ظهور App Shell خلف شاشة الإقلاع»).

            **العطلُ كان توقيتاً لا هندسة**: القياسُ أثبت أن شاشتنا
            مطابقةٌ لصور splash النظام دون البكسل (الشعارُ ١٤٧٫٧px
            مركّزٌ تماماً والخلفيّةُ `#0D0D0D` في الاثنتي عشرة صورة) —
            **لكنّ rAF المزدوجة كانت تبدأ الإذابةَ بعد إطارين من
            التحليل**، **وiOS ما يزال يسلّم من splash النظام إلى أوّل
            إطار HTML** (~ثانيةٌ في الإقلاع البارد): فيجتمع شعارُ
            النظام وشاشتُنا نصفُ الشفّافة والهيكلُ خلفهما — **ثلاثُ
            طبقاتٍ في مشهدٍ واحد.**

            **فالآن لا إذابةَ تلقائيّةً عند التحليل أصلاً**: السكربتُ
            يعرّف البابَ وحدَه، **و`ChromeAutoHide` يناديه بعد اكتمال
            الترطيب** (أوّلُ لحظةٍ يكون التطبيقُ فيها حيّاً) — **والشاشةُ
            معتمةٌ إلى تلك اللحظة وتُزال مرّةً واحدةً** (`display: none`
            في `globals.css` — لا شفافيّةَ تكشف طبقتين). **وصمّامُ
            العشر ثوانٍ باقٍ** لمن تعطّل ترطيبُه.
            **والإزالةُ صنفٌ يُضاف لا عقدةٌ تُحذف** (عطلُ آيفون ٢٠
            أغسطس أعلاه — React لا يقرأ ما بداخل الغلاف). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){window.__lzMelt=function(){try{var l=document.getElementById('lz-launch');" +
              "if(l)l.classList.add('lz-out')}catch(e){}}})();",
          }}
        />
        {/* الكسوةُ الذكيّة — مستمعُ التمرير المركزيّ (chromeRules) */}
        <ChromeAutoHide />
        <OfflineSync />
        <ToastHost />
        {/* 🆕 بوّابة الزائر (D-627 مرحلة ٢): تُفتح حين يلمس زائرٌ فعلَ
            كتابةٍ — عمارةُ التوست نفسُها، مضيفٌ واحدٌ وحدثُ نافذة */}
        <LoginGateHost locale={locale} />
        {/* 🆕 وبوّابةُ Loopz+ (D-633) — العمارةُ نفسُها للمرّة الثالثة:
            حدثُ نافذةٍ ومضيفٌ واحد، **ولا ورقةَ ثالثةَ الشكل** */}
        <PlusGateHost locale={locale} />
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
