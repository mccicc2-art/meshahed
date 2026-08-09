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
   وصدقُه شرطٌ عمليّ لا أخلاقيّ فقط: قوقل يقيس رضا من نقر ثم عاد. */
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
    a: "Loopz منصّة عربية لتتبّع ما تشاهده: مسلسلات وأفلام وأنمي في مكانٍ واحد. تعلّم الحلقة التي وصلتها فيحسب تقدّمك ويذكّرك بحلقتك القادمة، وتقيّم ما شاهدته وتبني قوائمك وتتابع أصدقاءك.",
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
    q: "هل يعمل بالعربية؟",
    a: "Loopz عربيٌّ أولاً: الواجهة كلها من اليمين إلى اليسار، وأسماء الأعمال وقصصها تُعرض بالعربية حين تتوفّر، وفيه إنجليزية كاملة لمن يفضّلها.",
  },
  {
    q: "هل أحتاج تنزيل تطبيق؟",
    a: "لا. Loopz يعمل في المتصفّح على الجوال والحاسوب، ويمكنك تثبيته على شاشتك الرئيسية فيفتح كتطبيقٍ ويعمل جزئياً بلا إنترنت.",
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
    a: "Loopz is an Arabic-first platform for tracking what you watch — shows, movies and anime in one place. Tick the episode you reached and it works out your progress and your next episode, and you can rate titles, build lists and follow friends.",
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
    q: "Does it work in Arabic?",
    a: "Loopz is Arabic-first: the whole interface is right-to-left, and titles and overviews are shown in Arabic wherever they exist. Full English is one tap away.",
  },
  {
    q: "Do I need to install an app?",
    a: "No. Loopz runs in the browser on phone and desktop, and you can install it to your home screen — it then opens like an app and keeps working partly offline.",
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

/* ───────────────────────── المقارنة ─────────────────────────
   من يبحث «بديل TV Time» يبحث عن جدول، لا عن إعلان. والجدول الذي يكذب
   يُكتشف في دقيقة ويكلّف الثقة — ولذلك تحته قسمٌ يعترف بما يتفوّق فيه
   الآخرون. المقارنة الصادقة هي التي تُقرأ وتُشارَك، وهي التي تُرتَّب. */
export interface CompareRow {
  ar: string;
  en: string;
  /** لكل تطبيق: نعم / جزئي / لا */
  loopz: Verdict;
  tvtime: Verdict;
  trakt: Verdict;
  letterboxd: Verdict;
  simkl: Verdict;
}

export type Verdict = "yes" | "part" | "no";

export const COMPARE_APPS = ["Loopz", "TV Time", "Trakt", "Letterboxd", "Simkl"] as const;

export const COMPARE_ROWS: CompareRow[] = [
  {
    ar: "واجهة عربية كاملة من اليمين لليسار",
    en: "Full Arabic, right-to-left interface",
    loopz: "yes",
    tvtime: "no",
    trakt: "no",
    letterboxd: "no",
    simkl: "part",
  },
  {
    ar: "مسلسلات وأفلام وأنمي في تطبيق واحد",
    en: "Shows, movies and anime in one app",
    loopz: "yes",
    tvtime: "part",
    trakt: "yes",
    letterboxd: "no",
    simkl: "yes",
  },
  {
    ar: "تقدّم الحلقات + موضع التوقّف في الفيلم بالدقيقة",
    en: "Episode progress and movie stop-point to the minute",
    loopz: "yes",
    tvtime: "part",
    trakt: "part",
    letterboxd: "no",
    simkl: "part",
  },
  {
    ar: "استيراد سجلّك من TV Time وTrakt",
    en: "Import your history from TV Time and Trakt",
    loopz: "yes",
    tvtime: "no",
    trakt: "part",
    letterboxd: "part",
    simkl: "yes",
  },
  {
    ar: "قوائم جاهزة بترتيب الأحداث (مارفل، هاري بوتر…)",
    en: "Ready-made lists in story order (Marvel, Harry Potter…)",
    loopz: "yes",
    tvtime: "no",
    trakt: "no",
    letterboxd: "no",
    simkl: "no",
  },
  {
    ar: "قوائم الجوائز وأفضل 250 جاهزة",
    en: "Award lists and ready-made Top 250s",
    loopz: "yes",
    tvtime: "no",
    trakt: "part",
    letterboxd: "part",
    simkl: "part",
  },
  {
    ar: "أصدقاء ورسائل فورية ومجتمعات",
    en: "Friends, instant messages and communities",
    loopz: "yes",
    tvtime: "part",
    trakt: "no",
    letterboxd: "part",
    simkl: "part",
  },
  {
    ar: "مجاني بالكامل بلا إعلانات",
    en: "Completely free, with no ads",
    loopz: "yes",
    tvtime: "no",
    trakt: "part",
    letterboxd: "part",
    simkl: "part",
  },
];

/** ما يتفوّق فيه غيرنا — يُكتب لأنه صحيح، ولأن المقارنة بلا اعترافٍ دعاية */
export function compareHonesty(locale: Locale): string[] {
  return locale === "ar"
    ? [
        "Letterboxd أعمق منّا في ثقافة النقد السينمائي: مجتمع كتّاب مراجعاتٍ ضخم وتاريخٌ طويل، ومن يريد القراءة قبل المشاهدة يجده هناك أوفر.",
        "Trakt يتفوّق بالتسجيل التلقائي: يربط Plex وKodi وأجهزةً أخرى فتُسجَّل مشاهدتك بلا ضغطة. Loopz يعتمد على تعليمك أنت — أدقّ، لكنّه ليس تلقائياً.",
        "TV Time أكبر منّا بسنوات وبعدد مستخدمين هائل، وشبكة أصدقائك الحالية غالباً هناك لا هنا.",
        "Simkl يتفوّق في تكاملاته وإضافات المتصفّح، ولديه ما لا نملكه بعد من روابط تشغيلٍ آلية.",
      ]
    : [
        "Letterboxd is far deeper on film criticism: a huge community of reviewers and years of writing. If you read before you watch, you will find more there.",
        "Trakt wins on automatic scrobbling — it connects to Plex, Kodi and other players so watches log themselves. Loopz relies on you ticking, which is more accurate but not automatic.",
        "TV Time is years older with a vastly larger user base, and your existing friends are probably there rather than here.",
        "Simkl has more integrations and browser extensions than we do, including automation we have not built yet.",
    ];
}

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

/** فتات الطريق — يُظهر مسار الصفحة في نتيجة البحث بدل الرابط الخام */
export function breadcrumbGraph(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: siteUrl(it.path),
    })),
  };
}
