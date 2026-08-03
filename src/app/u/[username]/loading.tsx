import { ProfileCardSkeleton, RowSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-10">
      <ProfileCardSkeleton />
      <RowSkeleton count={12} />
    </div>
  );
}
