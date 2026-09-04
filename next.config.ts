import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "https://*.supabase.co";
  } catch {
    return "https://*.supabase.co";
  }
})();

/**
 * سياسة أمان المحتوى.
 *
 * ملاحظة على 'unsafe-inline' في script-src: Next.js يحقن سكربتات مضمّنة
 * لتمرير حالة الخادم للعميل، ومنعها يحتاج nonce لكل طلب عبر الوسيط.
 * تُشدَّد لاحقاً بـ nonce — انظر تقرير الأمان.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // accounts.google.com: مكتبة الدخول داخل الموقع (GIS). بلا هذا يُحجب
  // السكربت وتسقط الطريقة إلى التحويل القديم بصمت
  // 🆕 D-759: iframe_api الرسمي (بأمر أحمد — نقضُ «صفر جافاسكربت يوتيوب»
  // في D-726): المحمِّل من www.youtube.com والجسمُ من s.ytimg.com
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.youtube.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https://image.tmdb.org https://lh3.googleusercontent.com https://*.supabase.co https://media.giphy.com",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHost} https://*.supabase.co wss://*.supabase.co https://accounts.google.com`,
  "manifest-src 'self'",
  // 🆕 D-758: معاينات iTunes — ملفُّ MP4 يُشغَّل في <video> مباشرةً.
  // بلا media-src يسقط الاتجاه إلى default-src 'self' فتُحجب الملفّات صامتةً
  "media-src 'self' https://video-ssl.itunes.apple.com https://*.mzstatic.com",
  // مشغّل الترايلر لا يُحمَّل إلا بالضغط، ومن نطاق يوتيوب بلا كوكيز
  // نافذة Google تُرسم في إطارٍ من نطاقها — والترايلر من يوتيوب بلا كوكيز
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://accounts.google.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  /* `same-origin-allow-popups` لا `same-origin`.
     الفرق سطرٌ واحد وأثره أن الدخول يعمل أو لا يعمل: `same-origin` تقطع
     `window.opener` عن أي نافذةٍ منبثقة، فنافذة Google تفتح ويسجّل
     المستخدم دخوله ويوافق… ثم تعجز عن تسليم الرمز للصفحة التي فتحتها
     فتبقى بيضاء عند `accounts.google.com/gsi/transform`. وهذا ما وقع
     حرفياً. والصيغة المسموحة تُبقي الحماية الأهمّ — لا نافذةَ غريبةٍ
     تحمل مرجعاً إلينا — وتسمح فقط لما نفتحه نحن بأن يردّ علينا. */
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  /* كاش الراوتر في ذاكرة المتصفح (D-088).
     كان صفراً (افتراضي Next 15+): كل تنقّلٍ — حتى «رجوع» لصفحةٍ غادرتها
     قبل ثانيتين — رحلةُ خادمٍ كاملة، فبدا التطبيق أبطأ من المواقع التي
     تعيد رسم المحفوظ فوراً. الآن الصفحة المزارة تُعاد من الرام لحظياً
     لمدة ٦٠ ثانية ثم تُجلب من جديد (رُفعت من ٣٠ مع تسخين D-117: نافذة أطول للضغطة الأولى، والكتابة ما زالت تُبطل الكاش فوراً) — والكتابة لا تنتظر أبداً:
     revalidatePath وrouter.refresh() (كلُّ أفعالنا تمرّ بهما عبر
     coalescedRefresh) يُبطلان هذا الكاش فوراً، فالبيانات بعد أي تفاعلٍ
     طازجة والفورية المحسوسة مجانية. */
  /* 🆕 ورُفعت النافذة الديناميكية ٦٠ ← ١٨٠ (جولة أداء ٢٠ أغسطس):
     القياس أظهر أن «الرجوع لصفحةٍ سبق فتحها» يدفع رحلة خادمٍ كاملة
     (~٦٠٠م.ث) لأن الجولة الطبيعية بين التبويبات أطول من دقيقة.
     وثلاث دقائق آمنة بنفس ضمانة D-088: كل كتابةٍ تمرّ بـrevalidatePath
     وcoalescedRefresh فتُبطل هذا الكاش فوراً — الذي يشيخ ثلاث دقائق
     هو فقط ما تغيّر من جهازٍ آخر بلا فعلٍ منك. */
  experimental: {
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },

  images: {
    /* 🆕 D-841: محمِّلٌ مخصّص يفرز من يستحقّ المحسِّن المدفوع — المقاسات
       الصغيرة (w45–w500 وh632) تُقدَّم من الممرّ المخزَّن ‎/i/‎ كما خرجت
       من TMDB، والكبيرة (w780/w1280/original) تبقى هنا لأن AVIF على
       عنصر LCP يدفع ثمنَ تحويله. التفصيل والقياس في src/core/imageLoader.ts. */
    loader: "custom",
    loaderFile: "./src/core/imageLoader.ts",
    /* AVIF قبل WebP: أصغر بنحو الربع بجودةٍ مساوية، وغلاف الرئيسية هو
       عنصر LCP — فربعُ حجمه ربعُ انتظاره. WebP يبقى احتياطاً للمتصفحات
       الأقدم، والاختيار تفاوضٌ عبر ترويسة Accept لا شيء نديره بأيدينا. */
    formats: ["image/avif", "image/webp"],
    /* 🆕 **قائمتا العروض تُقصَّان — والقصُّ لا يُنقص جودةً بحرفه.**
       المقيس: `/news` يشحن **١٬٩٧١ مرجعَ صورة** في مستندٍ واحد
       (٦٩٣ ك.ب HTML)، **و١١٥ من ١٢٧ صورةً فيه تحمل `sizes="132px"`**.
       والسببُ قاعدةُ `getWidths` في Next: **`sizes` بلا وحدة `vw`
       يُصدر القائمةَ كاملةً** — ستَّ عشرةَ مرشَّحةً لكلِّ صورة.
       فالكلفةُ نصٌّ في الـHTML لا بايتاتُ صور.

       🔑 **والقصُّ اختير بالإثبات لا بالذوق**: حُسب العرضُ الذي يختاره
       المتصفّح فعلاً لكلِّ عنصرٍ حقيقيٍّ في التطبيق (٢٩ عرضاً) × سبعةِ
       أجهزةٍ واقعية (iPhone SE/15/15PM عند 3x · iPad · لابتوب · مكتب
       1x و2x) = ٢١٩ حالة. **والمحذوفُ ما لا يختاره أحدٌ منها إلا إلى
       أكبرَ منه**: صفرُ حالةٍ تختار صورةً أصغر.

       ⚖️ **وحدُّ هذا الادّعاء بحرفه**: هذا التعديلُ **لا يخفض دقّةَ
       المرشَّح المختار مقارنةً بالإعداد السابق ضمن الحالات المختبَرة**.
       وليس ادّعاءَ «لا ضبابَ مضموناً» — **ما لم يُختبر لم يُقَس**،
       والمصفوفةُ أعلاه حدُّها لا الكونُ كلُّه.

       **وما بقي عمداً**: `1200` و`2048` — إسقاطُهما كان يقفز ببطلِ
       الهاتف من ١٢٠٠ إلى ١٩٢٠ (**+١٥٦٪ بكسلاً على عنصر LCP نفسِه**)
       وبلابتوب من ٢٠٤٨ إلى ٣٨٤٠. **قِيس فبقيا.**

       **والثمنُ المعلَن**: ثلاثون حالةً تصعد درجةً — كلُّها صورٌ صغيرة
       (٢٤–٤٠px: 32→64 · 48→64 · 96→128) وستُّ حالاتٍ 750→828 لبطاقةِ
       ٢٤٠px على الهاتف. **بايتاتٌ زهيدةٌ مقابل ثلثِ مراجع الصور.**

       🆕 D-840: حُذفت 3840 — كانت ٤٣٪ من تحويلات الصور المدفوعة في لوحة
       Vercel (٥٤ من ١٢٧ ألفاً في ١٢ ساعة) على مصادرَ أقصاها w1280، أي
       تكبيرٌ لا يقع أصلاً: Next لا يكبّر فوق عرض المصدر فيعيد البايتات
       نفسَها ويقبض ثمنَ التحويل. لابتوب 2x يقف عند 2048 (المقيسة أعلاه)
       فلا بكسلَ واحداً يتغيّر على أي شاشة — والفاتورة تنقص ~$20 شهرياً. */
    deviceSizes: [640, 828, 1080, 1200, 1920, 2048],
    imageSizes: [64, 128, 256, 384],
    /* جودةٌ واحدة مقفولة (D-840): كل التحويلات عند 75 أصلاً، والقفل يمنع
       quality عابرة في مكوّنٍ قادم من مضاعفة متغيّرات الخبيئة صامتةً —
       كل (صورة×عرض×جودة×صيغة) تحويلٌ مدفوعٌ جديد. */
    qualities: [75],
    /* شهرٌ لا أربع ساعات (الافتراضي): كانت الصور المحسَّنة تُعاد معالجتها
       كل ٤ ساعات مع أن ملصق العمل لا يتغيّر. روابط TMDB وSupabase مجزّأة
       بالمحتوى أصلاً، فطول العمر آمن — تغيّر الصورة يغيّر رابطها. */
    minimumCacheTTL: 2678400,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // أعلام اللغات — تُجلب على الخادم وتُقدَّم من نطاقنا، فلا يُوسَّع
      // `img-src` في سياسة الأمان لنطاقٍ خارجيّ جديد
      { protocol: "https", hostname: "flagcdn.com", pathname: "/**" },
    ],
  },

  // لا نكشف أن الخادم Next.js
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
