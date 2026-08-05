import { RowSkeleton } from "@/components/Skeletons";

/** هيكل البحث: كتلة بشكل صندوق الإدخال أولاً — الصندوق لا يختفي أبداً */
export default function Loading() {
  return (
    <div>
      <div className="max-w-xl mx-auto mb-8" aria-hidden>
        <div className="skeleton h-[52px] rounded-2xl border border-border" />
      </div>
      <div className="skeleton h-5 w-56 max-w-full rounded mb-4" aria-hidden />
      <RowSkeleton count={12} title={false} />
    </div>
  );
}
