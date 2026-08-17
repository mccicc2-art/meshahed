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
  "script-src 'self' 'unsafe-inline' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https://image.tmdb.org https://lh3.googleusercontent.com https://*.supabase.co https://media.giphy.com",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHost} https://*.supabase.co wss://*.supabase.co https://accounts.google.com`,
  "manifest-src 'self'",
  // مشغّل الترايلر لا يُحمَّل إلا بالضغط، ومن نطاق يوتيوب بلا كوكيز
  // نافذة Google تُرسم في إطارٍ من نطاقها — والترايلر من يوتيوب بلا كوكيز
  "frame-src https://www.youtube-nocookie.com https://accounts.google.com",
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
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },

  images: {
    /* AVIF قبل WebP: أصغر بنحو الربع بجودةٍ مساوية، وغلاف الرئيسية هو
       عنصر LCP — فربعُ حجمه ربعُ انتظاره. WebP يبقى احتياطاً للمتصفحات
       الأقدم، والاختيار تفاوضٌ عبر ترويسة Accept لا شيء نديره بأيدينا. */
    formats: ["image/avif", "image/webp"],
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
