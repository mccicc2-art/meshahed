import { ListPageSkeleton } from "@/components/Skeletons";

/* هيكلُ صفحة نقاشٍ: رأسٌ وصفوفُ ردود — بشكل الصفحة الفعليّ فلا قفزةَ
   عند الوصول (جولة ١٩ أغسطس: «أضف loading.tsx مناسبًا لكل مسار ثقيل
   لا يملكه») */
export default function Loading() {
  return <ListPageSkeleton rows={6} />;
}
