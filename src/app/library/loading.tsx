import { RowSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-12">
      <div className="skeleton h-8 w-40 rounded" aria-hidden />
      <RowSkeleton count={6} />
      <RowSkeleton count={12} />
      <RowSkeleton count={6} />
    </div>
  );
}
