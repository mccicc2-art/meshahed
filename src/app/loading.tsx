import { HomeHeaderSkeleton, RailSkeleton } from "@/components/Skeletons";

// هيكل بنفس تخطيط الرئيسية الفعلي: غلاف عريض ثم صفوف أفقية — كان
// الهيكل السابق بطاقة بروفايل وشبكة عمودية فتقفز الصفحة كلها عند الوصول
export default function Loading() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <HomeHeaderSkeleton />
      <RailSkeleton count={6} />
      <RailSkeleton count={6} />
      <RailSkeleton count={6} />
    </div>
  );
}
