import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * خريطة الموقع — الصفحات العامة فقط.
 *
 * كل ما خلف تسجيل الدخول (المكتبة، اليوميات، الرسائل…) ليس لمحركات
 * البحث، وروابط الأعمال والقوائم بحرٌ لا قاع له فلا تُسرد يدوياً —
 * تصل إليها المحركات من الصفحات العامة ومن روابط المشاركة.
 * العناوين تُبنى من `SITE_URL` فتشير كلها إلى النطاق الرسمي مهما كان
 * المضيف الذي قُدّمت منه.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; freq: "daily" | "weekly" }[] = [
    { path: "/", priority: 1, freq: "daily" },
    { path: "/welcome", priority: 0.8, freq: "weekly" },
    // صفحة المميزات (D-096): عامّة بلا حارس وتُعرّف بالمنتج — مكانها
    // الطبيعي في الخريطة، بأولوية تسويقية عالية كـ/welcome
    { path: "/features", priority: 0.8, freq: "weekly" },
    { path: "/news", priority: 0.7, freq: "daily" },
    { path: "/search", priority: 0.5, freq: "weekly" },
    { path: "/login", priority: 0.4, freq: "weekly" },
    { path: "/privacy", priority: 0.2, freq: "weekly" },
    { path: "/terms", priority: 0.2, freq: "weekly" },
  ];
  return pages.map((p) => ({
    url: siteUrl(p.path),
    changeFrequency: p.freq,
    priority: p.priority,
  }));
}
