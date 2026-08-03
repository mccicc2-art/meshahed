import type { MetadataRoute } from "next";

// يجعل التطبيق قابلاً للتثبيت على الشاشة الرئيسية في الجوال.
// ملاحظة: المتصفح يطلب هذا الملف بلا كوكيز، فلا يمكن أن يتبع لغة الواجهة —
// لذلك الاسم يجمع اللغتين بدل أن يُخمّن واحدة.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مشاهد — Meshahed",
    short_name: "مشاهد",
    description: "تابع مسلسلاتك وأفلامك، أشّر الحلقات، وشوف القادم قريباً.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    categories: ["entertainment", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
