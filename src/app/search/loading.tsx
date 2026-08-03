import { RowSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-6 w-56 max-w-full rounded" aria-hidden />
      <RowSkeleton count={12} title={false} />
    </div>
  );
}
