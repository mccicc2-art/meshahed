/** هيكل المكتبة: تبويبان ثم شبكة ملصقات — بشكل الصفحة الحقيقية نفسها */
export default function LibraryLoading() {
  return (
    <div>
      <div className="skeleton h-7 w-32 rounded-lg mb-4" />
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="skeleton h-12 rounded-2xl" />
        <div className="skeleton h-12 rounded-2xl" />
      </div>
      <div className="skeleton h-11 rounded-xl mb-4" />
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="skeleton aspect-[2/3] rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}
