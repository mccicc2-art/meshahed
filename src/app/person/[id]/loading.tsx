import { RowSkeleton } from "@/components/Skeletons";

/**
 * هيكلُ صفحة الشخص بشكلها هي: صورةٌ 2:3 بجانب اسمٍ وسيرة، ثم شبكةُ
 * أعمال. كانت ترث هيكلَ الجذر (ترويسةُ الرئيسية ورفوفُها) فيقفز التخطيط
 * كلُّه عند الوصول.
 */
export default function Loading() {
  return (
    <div aria-hidden>
      <div className="flex gap-4 sm:gap-5 items-start">
        <div className="w-28 sm:w-40 shrink-0">
          <div className="skeleton aspect-[2/3] rounded-poster border border-border" />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="skeleton h-6 w-44 max-w-full rounded" />
          <div className="skeleton h-3 w-24 rounded mt-2.5" />
          <div className="skeleton h-3 w-full rounded mt-4" />
          <div className="skeleton h-3 w-11/12 rounded mt-2" />
          <div className="skeleton h-3 w-2/3 rounded mt-2" />
        </div>
      </div>
      <div className="mt-10">
        <RowSkeleton count={12} />
      </div>
    </div>
  );
}
