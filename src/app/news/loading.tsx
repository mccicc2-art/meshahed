import { RailSkeleton } from "@/components/Skeletons";

// ديسكفر يعرض صفوف ملصقات أفقية — الهيكل يطابقها بدل بطاقات مقالات 16:9
export default function Loading() {
  return (
    <div>
      <header className="mb-6" aria-hidden>
        <div className="skeleton h-8 w-40 rounded" />
        <div className="skeleton h-3 w-72 max-w-full rounded mt-2" />
      </header>
      <div className="space-y-8">
        <RailSkeleton count={6} />
        <RailSkeleton count={6} />
        <RailSkeleton count={6} />
      </div>
    </div>
  );
}
