import { ProfileCardSkeleton, NextUpSkeleton, RowSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-10">
      <ProfileCardSkeleton />
      <NextUpSkeleton />
      <RowSkeleton count={6} />
      <RowSkeleton count={6} />
    </div>
  );
}
