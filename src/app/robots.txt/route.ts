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
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        "",
      ].join("\n")
    : ["User-agent: *", "Disallow: /", ""].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
