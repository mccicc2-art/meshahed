import type { MetadataRoute } from "next";
import { SITE_URL, siteUrl } from "@/lib/site";

/**
 * خريطة الموقع — الصفحات التي تُجيب بمحتوى فعلاً، لا غير.
 *
 * تصحيحٌ صريح (D-122): كانت الخريطة تسرد `/welcome` و`/news` و`/search`
 * وثلاثتها خلف تسجيل الدخول — يزورها الزاحف فيتلقّى تحويلاً إلى `/login`.
 * ومعها `/login` نفسها التي صارت الآن `noindex`. أي أن نصف ما نُعلنه
 * للمحركات كان أبواباً مغلقة، وهذا يُنقص الثقة في الخريطة كلّها ويُهدر
 * ميزانية الزحف على تحويلات.
 *
 * الباقي هنا كلّه يُجيب 200 لزائرٍ بلا حساب: الجذر (صار صفحة هبوطٍ
 * بمحتوى)، المميزات، المقارنة، الخصوصية والشروط.
 *
 * وروابط الأعمال والقوائم ما تزال خارج الخريطة: كلها خلف تسجيل الدخول
 * اليوم. حين تُفتح صفحات الأعمال للقراءة بلا حساب تصير هي أكبر مصدر
 * ظهورٍ لدينا، وتُضاف هنا ديناميكياً.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; freq: "daily" | "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, freq: "daily" },
    { path: "/features", priority: 0.8, freq: "weekly" },
    { path: "/privacy", priority: 0.2, freq: "monthly" },
    { path: "/terms", priority: 0.2, freq: "monthly" },
  ];
  return pages.map((p) => ({
    // الجذر بلا شرطةٍ أخيرة كي يطابق `canonical` الذي يبنيه Next حرفياً
    url: p.path === "/" ? SITE_URL : siteUrl(p.path),
    changeFrequency: p.freq,
    priority: p.priority,
  }));
}
