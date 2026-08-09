/**
 * طبقة الظهور في محركات البحث — نصوصٌ وبيانات مُهيكلة في مكانٍ واحد.
 * (D-122، بعد ملاحظة أحمد: «Loopz صار يطلع في قوقل، لكن نبي SEO أفضل»)
 *
 * التشخيص الذي أنتج هذا الملف: السطح القابل للفهرسة كان صفحة دخول.
 * `/` و`/news` و`/search` و`/welcome` كلها تُحوّل الزائر غير المسجَّل إلى
 * `/login`، فمحرّك البحث لا يرى من المنصّة إلا عنواناً وسطرَ وصفٍ وجدارَ
 * ملصقاتٍ بلا نص. لا يُرتّب محرّكٌ صفحةً على كلماتٍ لا توجد فيها.
 *
 * فالعلاج محتوىً لا حِيَل: نصٌّ حقيقي يجيب أسئلةً حقيقية (`FAQ`)، ومقارنةٌ
 * صادقة بمن يبحث عنهم الناس بالاسم (TV Time، Trakt، Letterboxd…) تعترف
 * بما يتفوّقون فيه، وبياناتٌ مُهيكلة تُعرّف المحرّك بالعلامة وأسمائها
 * البديلة. حشوُ الكلمات المفتاحية مُستبعد عمداً: قوقل يعاقب عليه منذ
 * Panda، وهو أسوأ من لا شيء.
 *
 * النصّ هنا لا في `i18n.ts`: محتوىً تحريريّ طويل — سابقته صفحة المميزات
 * وصفحة الشروط — لا مفردات واجهة تتكرّر في عشرين مكاناً.
 */

import { SITE_URL, siteUrl } from "@/lib/site";
import type { Locale } from "@/lib/i18n";

/* ───────────────────────── الأسماء البديلة ─────────────────────────
   من يكتب «Loopz TV» أو «لوبز» يقصدنا. الأسماء البديلة تدخل البيانات
   المهيكلة (`alternateName`) لا النصّ المرئي — فالمحرّك يربطها بالعلامة
   بلا أن نكرّرها على الشاشة تكراراً بشعاً. */
export const BRAND_ALT_NAMES = [
  "Loopz TV",
  "LoopzTV",
  "loopztv",
  "loopztv.com",
  "لوبز",
  "لوبز تي في",
];

/* ───────────────────────── الكلمات المفتاحية ─────────────────────────
   وسم `keywords` يتجاهله قوقل منذ 2009 ويستعمله Bing بوزنٍ ضعيف — فوجوده
   هنا رخيصٌ ولا يضرّ، لكنّه ليس الخطة. الخطة أن تكون هذه المعاني موجودة
   فعلاً في نصّ الصفحة أدناه. باللغتين لأن جمهورنا يبحث بالاثنتين. */
const KEYWORDS_AR = [
  "تتبع المسلسلات",
  "تطبيق متابعة المسلسلات",
  "تتبع الحلقات",
  "متابعة الأفلام",
  "تتبع الأنمي",
  "قائمة المشاهدة",
  "ماذا أشاهد",
  "تقييم الأفلام",
  "مذكرة المشاهدة",
  "ترتيب مشاهدة مارفل",
  "أفضل الأفلام والمسلسلات",
  "لوبز",
];

const KEYWORDS_EN = [
  "tv show tracker",
  "episode tracker",
  "movie tracker",
  "anime tracker",
  "watchlist app",
  "track what you watch",
  "what to watch next",
  "rate movies and shows",
  "watch diary",
  "TV Time alternative",
  "Trakt alternative",
  "Letterboxd alternative",
  "Simkl alternative",
  "Seen It alternative",
  "Loopz",
];

export function seoKeywords(locale: Locale): string[] {
  // اللغتان معاً في الوسم الواحد: الصفحة نفسها تُقدَّم بالعربية والإنجليزية
  // حسب زائرها، والزائر الآلي قد يأتي بأيّهما
  return locale === "ar" ? [...KEYWORDS_AR, ...KEYWORDS_EN] : [...KEYWORDS_EN, ...KEYWORDS_AR];
}

/* ───────────────────────── الأسئلة الشائعة ─────────────────────────
   كل سؤالٍ هنا سؤالٌ يُكتب فعلاً في مربّع البحث. الجواب قصيرٌ وصادق —
   وصدقُه شرطٌ عمليّ لا أخلاقيّ فقط: قوقل يقيس رضا من نقر ثم عاد.

   **«عربي أولاً» حُذفت من كل نصٍّ هنا بقرار أحمد:** الطموح عالميّ ولغاتٌ
   أخرى قادمة، ووصفُ المنتج بمنطقةٍ يسقّفه عند جمهورها ويصرف الباحث
   الأجنبي قبل أن يقرأ. لكنّ **القدرة** بقيت مذكورة صراحةً — عربية كاملة
   ودعم RTL — لأنها حقيقة، ولأنها السطر الوحيد في جدول المقارنة الذي
   نتفوّق فيه على المنافسين الأربعة جميعاً. الفرق بين هويةٍ تُضيّق وميزةٍ
   تُميّز. */
export interface Faq {
  q: string;
  a: string;
}

export function faqs(locale: Locale): Faq[] {
  return locale === "ar" ? FAQ_AR : FAQ_EN;
}

const FAQ_AR: Faq[] = [
  {
    q: "ما هو Loopz؟",
    a: "Loopz منصّة لتتبّع ما تشاهده: مسلسلات وأفلام وأنمي في مكانٍ واحد. تعلّم الحلقة التي وصلتها فيحسب تقدّمك ويذكّرك بحلقتك القادمة، وتقيّم ما شاهدته وتبني قوائمك وتتابع أصدقاءك.",
  },
  {
    q: "هل Loopz مجاني؟",
    a: "نعم، كل شيء فيه مجاني اليوم بلا اشتراك ولا إعلانات. إن أُضيف اشتراكٌ مستقبلاً فستجد في صفحة المميزات ما يبقى مجاناً وما يتطلّبه.",
  },
  {
    q: "كيف أنقل سجلّي من TV Time أو Trakt؟",
    a: "صدّر بياناتك من التطبيق القديم وارفع الملف في إعدادات Loopz — تُستورد مشاهداتك دفعةً واحدة فلا تبدأ من الصفر.",
  },
  {
    q: "هل يتتبّع الأنمي؟",
    a: "نعم. الأنمي مسلسلاتٌ وأفلامٌ في الكتالوج نفسه، بمواسمه وحلقاته وترتيب مشاهدته — لا يحتاج تطبيقاً منفصلاً.",
  },
  {
    q: "بأي لغة يعمل Loopz؟",
    a: "بالعربية والإنجليزية بالكامل اليوم — الواجهة كلها، وأسماء الأعمال وقصصها تُعرض بلغتك حين تتوفّر. ولغاتٌ أخرى في الطريق: Loopz ليس مبنياً لمنطقةٍ واحدة. ويدعم الكتابة من اليمين إلى اليسار دعماً كاملاً، وهو ما تفتقده أغلب تطبيقات التتبّع.",
  },
  {
    q: "هل أحتاج تنزيل تطبيق؟",
    a: "لا حاجة للانتظار: Loopz يعمل الآن في المتصفّح على الجوال والحاسوب، ويمكنك تثبيته على شاشتك الرئيسية فيفتح كتطبيقٍ ويعمل جزئياً بلا إنترنت. وتطبيقا App Store وأندرويد في الطريق.",
  },
  {
    q: "من أين تأتي بيانات الأعمال والتقييمات؟",
    a: "الكتالوج من TMDB، وأرقام التقييم من IMDb وRotten Tomatoes بشعاريهما. تقييمك أنت يبقى لك ويظهر إلى جانبها لا بدلاً منها.",
  },
  {
    q: "هل مكتبتي خاصة؟",
    a: "أنت من يقرّر: يمكن أن تكون المتابعة بموافقتك، وأن تختار من يرى مكتبتك، وأن تحظر من تشاء. وبياناتك كلها قابلة للتصدير أو الحذف النهائي بضغطة.",
  },
];

const FAQ_EN: Faq[] = [
  {
    q: "What is Loopz?",
    a: "Loopz is a platform for tracking what you watch — shows, movies and anime in one place. Tick the episode you reached and it works out your progress and your next episode, and you can rate titles, build lists and follow friends.",
  },
  {
    q: "Is Loopz free?",
    a: "Yes. Everything is free today, with no subscription and no ads. If a paid tier ever arrives, the features page will say plainly what stays free.",
  },
  {
    q: "How do I import my history from TV Time or Trakt?",
    a: "Export your data from the old app and upload the file in Loopz settings — your watch history comes across in one go, so you never restart from zero.",
  },
  {
    q: "Does it track anime?",
    a: "Yes. Anime lives in the same catalogue as everything else, with its seasons, episodes and watch order — no second app needed.",
  },
  {
    q: "What languages does Loopz support?",
    a: "Full English and Arabic today — the whole interface, plus titles and overviews in your language wherever they exist. More languages are on the way: Loopz is not built for one region. Right-to-left is fully supported, which most trackers still lack.",
  },
  {
    q: "Do I need to install an app?",
    a: "No waiting required: Loopz runs today in the browser on phone and desktop, and installs to your home screen — it then opens like an app and keeps working partly offline. Native App Store and Android apps are on the way.",
  },
  {
    q: "Where do the catalogue and ratings come from?",
    a: "The catalogue is TMDB; the rating numbers are IMDb and Rotten Tomatoes, shown with their own marks. Your own rating stays yours and sits beside them, never instead of them.",
  },
  {
    q: "Is my library private?",
    a: "You decide. Follows can require your approval, you choose who sees your library, and blocking is one tap. Everything you have can be exported or permanently deleted whenever you want.",
  },
];

/* ───────────────────────── البيانات المُهيكلة ─────────────────────────
   `@graph` واحد بمعرّفاتٍ مترابطة بدل ثلاث كتلٍ منفصلة: قوقل يفهم الرسم
   البياني ويعرف أن الموقع والمنظمة والتطبيق شيءٌ واحد.

   ولا `aggregateRating` هنا: تقييمٌ مُختلَق مخالفةٌ صريحة لسياسة البيانات
   المهيكلة وعقوبتها إسقاط النتائج الغنيّة كلّها. حين تصير لدينا مراجعات
   حقيقية قابلة للعرض العام تُضاف من مصدرها.

   و`SearchAction` مُستبعد عمداً: قوقل أوقف مربّع البحث في النتائج، و`/search`
   عندنا خلف تسجيل الدخول — فالإشارة إليه توجيهٌ إلى صفحة دخول. */
export function siteGraph(locale: Locale, dict: { brand: string; metaDescription: string }) {
  const org = `${SITE_URL}/#organization`;
  const site = `${SITE_URL}/#website`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": org,
        name: dict.brand,
        alternateName: BRAND_ALT_NAMES,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: siteUrl("/icon-512.png"),
          width: 512,
          height: 512,
        },
      },
      {
        "@type": "WebSite",
        "@id": site,
        name: dict.brand,
        alternateName: BRAND_ALT_NAMES,
        url: SITE_URL,
        description: dict.metaDescription,
        inLanguage: ["ar", "en"],
        publisher: { "@id": org },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: dict.brand,
        alternateName: BRAND_ALT_NAMES,
        url: SITE_URL,
        applicationCategory: "EntertainmentApplication",
        applicationSubCategory: locale === "ar" ? "تتبّع المشاهدة" : "Watch tracking",
        operatingSystem: "Web, Android, iOS",
        browserRequirements: "Requires JavaScript",
        inLanguage: ["ar", "en"],
        description: dict.metaDescription,
        publisher: { "@id": org },
        screenshot: siteUrl("/icon-512.png"),
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "SAR",
          availability: "https://schema.org/InStock",
        },
        featureList:
          locale === "ar"
            ? [
                "تتبّع الحلقات والمواسم",
                "تتبّع الأفلام وموضع التوقّف",
                "تتبّع الأنمي",
                "يوميات مشاهدة وإحصاءات",
                "قوائم عامة وخاصة",
                "تقييمات ومراجعات",
                "أصدقاء ورسائل ومجتمعات",
                "استيراد من Trakt وTV Time",
              ]
            : [
                "Episode and season tracking",
                "Movie tracking with stop-point",
                "Anime tracking",
                "Watch diary and statistics",
                "Public and private lists",
                "Ratings and reviews",
                "Friends, messages and communities",
                "Import from Trakt and TV Time",
              ],
      },
    ],
  };
}

/** رسمٌ بيانيّ للأسئلة الشائعة — مرشّحٌ لنتيجةٍ غنيّة في قوقل */
export function faqGraph(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: faqs(locale).map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
