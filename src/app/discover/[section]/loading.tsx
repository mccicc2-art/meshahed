import { PosterCardSkeleton } from "@/components/Skeletons";
import { PosterGrid } from "@/components/PosterGrid";

/**
 * هيكلُ صفحة القسم بشكلها هي: ترويسةُ رجوعٍ وعنوانٌ ثم شبكةُ ملصقات.
 * كانت الصفحةُ ترث هيكلَ الجذر (ترويسةُ الرئيسية وثلاثةُ رفوف) — شكلٌ
 * غريبٌ يُستبدل كلُّه عند الوصول فيقفز التخطيط، والصفحةُ `force-dynamic`
 * فتدفع القفزةَ في **كلِّ** فتحة.
 */
export default function Loading() {
  return (
    <main className="px-4 sm:px-6 py-5 max-w-shell mx-auto pb-24" aria-hidden>
      <div className="flex items-center gap-3 mb-5">
        <div className="skeleton w-10 h-10 rounded-full shrink-0" />
        <div className="min-w-0">
          <div className="skeleton h-6 w-48 max-w-full rounded" />
          <div className="skeleton h-3 w-20 rounded mt-1.5" />
        </div>
      </div>
      <PosterGrid>
        {Array.from({ length: 18 }, (_, i) => (
          <PosterCardSkeleton key={i} />
        ))}
      </PosterGrid>
    </main>
  );
}
