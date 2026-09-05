import { SITE_URL } from "@/lib/site";

/**
 * robots.txt ديناميكي بحسب المضيف.
 *
 * النطاق القديم meshahed.vercel.app ما يزال يخدم الموقع عمداً (قرار
 * D-039: يبقى بلا تحويل)، فصار المحتوى نفسه على مضيفَين — ومحركات
 * البحث تعاقب النسخ المتطابقة بتوزيع سلطة الفهرسة عليها. الحلّ من غير
 * كسر القديم: الفهرسة تُسمح على loopztv.com وحده، وأي مضيفٍ آخر
 * (نطاق النشرة، معاينات Vercel) يُحجب كاملاً.
 */
/** أسماءُ الزواحف كما تُعلن عن نفسها — القائمةُ نفسُها في `proxy.ts` (D-914). */
const AI_BOTS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai",
  "CCBot", "Bytespider", "Amazonbot", "PerplexityBot", "Perplexity-User", "meta-externalagent",
  "FacebookBot", "Applebot-Extended", "cohere-ai", "Diffbot", "ImagesiftBot", "omgili",
  "Timpibot", "YouBot", "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "DataForSeoBot",
  "PetalBot", "Scrapy",
];

export function GET(request: Request) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const official = host === "loopztv.com" || host === "www.loopztv.com";

  const body = official
    ? [
        "User-agent: *",
        "Allow: /",
        // 🆕 استثناءٌ واحدٌ قبل المنع (D-910): `/api/build` بصمةُ النشرة الحيّة،
        // **وهي الجوابُ الوحيد على «أيّ نسخةٍ تعمل الآن؟» من خارج لوحة Vercel**
        // — و`Disallow: /api/` كان يمنع كلَّ زاحفٍ يحترم الملفّ من قراءتها،
        // بما فيها أدواتُ المساعد، فيصير فحصُ النشر يدويّاً بلا سبب.
        // ⚠️ **والسماحُ بالزحف ليس سماحاً بالفهرسة**: المسارُ نفسُه يرسل
        // `X-Robots-Tag: noindex`، فلا يدخل نتائجَ البحث. ولا سرَّ فيه أصلاً:
        // أربعون حرفاً من هاش التزامٍ في مستودعٍ عامّ.
        "Allow: /api/build",
        // ما خلف الدخول أو ما هو واجهة برمجية ليس صفحةً تُفهرس
        "Disallow: /api/",
        "Disallow: /auth/",
        // 🔴 🆕 D-914 (لوحة Vercel ٥ سبتمبر: ٦٨ ألف صفحةِ شخصٍ و٨ آلاف صفحةِ نقاش
        // في ١٢ ساعة لثلاثةٍ وثلاثين مستخدماً): **صفحاتُ الأشخاص والنقاش تُرسم
        // لكلِّ طلبٍ ولا قيمةَ لها في البحث** — تُحجب عن الزواحف كلِّها.
        // أمّا الأعمالُ (/show، /movie) فتبقى: هي سطحُ البحث الوحيد الذي يستحقّ.
        "Disallow: /person/",
        "Disallow: /talk/",
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        "",
        // 🔴 🆕 D-914: زواحفُ الذكاء الاصطناعيّ والكشّاطات — ممنوعةٌ كلّيّاً.
        // **المهذَّبُ منها يقرأ هذا ويرحل، والباقي يوقفه الوسيط (`proxy.ts`)
        // وجدارُ Vercel** — ثلاثةُ أبوابٍ لسؤالٍ واحد لأنّ أحدَها لا يكفي.
        ...AI_BOTS.flatMap((ua) => [`User-agent: ${ua}`, "Disallow: /", ""]),
      ].join("\n")
    : ["User-agent: *", "Disallow: /", ""].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
