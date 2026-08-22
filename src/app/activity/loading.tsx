/**
 * هيكلُ النشاط — **بإيقاع الشاشة نفسِها** (D-046): فتاتُ رجوعٍ، صفُّ
 * رقائق، سطرُ حصيلة، ثمّ صفوفٌ بملصقٍ وسطرين.
 */
export default function Loading() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="skeleton h-3.5 w-24 rounded" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton h-9 w-20 rounded-full" />
        ))}
      </div>
      <div className="skeleton h-4 w-full rounded" />
      <div className="space-y-4 ps-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton w-11 aspect-[2/3] rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-1/2 rounded" />
              <div className="skeleton h-3 w-1/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
