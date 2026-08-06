import type { MetadataRoute } from "next";

// يجعل التطبيق قابلاً للتثبيت على الشاشة الرئيسية في الجوال.
// ملاحظة: المتصفح يطلب هذا الملف بلا كوكيز، فلا يمكن أن يتبع لغة الواجهة —
// لذلك الاسم يجمع اللغتين بدل أن يُخمّن واحدة.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Loopz — لوبز",
    short_name: "Loopz",
    description: "منصة ذكية لتتبع الأفلام والمسلسلات والأنمي — كل ما تشاهده، في مكان واحد.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // أسود الهوية لا الرمادي المزرق القديم — شاشة الإقلاع المثبّتة تطلع منه
    background_color: "#0D0D0D",
    theme_color: "#0D0D0D",
    categories: ["entertainment", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
