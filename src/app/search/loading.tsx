/**
 * هيكلُ البحث — **بإيقاع الشاشة الجديدة** (D-534): ترويسةٌ ثمّ حقلٌ ثمّ
 * صفُّ رقائق. **وما يظهر أوّلاً هو ما لا يختفي بعدها** (D-046) — الحقلُ
 * في موضعه من أوّل إطار، فلا يقفز حين يصل المكوّن.
 */
export default function Loading() {
  return (
    <div aria-hidden>
      <div className="-mx-4 px-4 -mt-6 pt-[calc(var(--safe-top)+0.5rem)] pb-2">
        <div className="flex items-center gap-2 min-h-11">
          <div className="skeleton w-7 h-7 rounded-full" />
          <div className="skeleton h-4 w-20 rounded mx-auto" />
          <div className="w-7" />
        </div>
      </div>
      <div className="skeleton h-[50px] rounded-xl mb-4" />
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton h-9 w-16 rounded-full" />
        ))}
      </div>
      <div className="skeleton h-[66px] rounded-2xl" />
    </div>
  );
}
