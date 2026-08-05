/** هيكل الهبوط: بطلٌ متمركز بنفس مقاسات الحقيقي — لا شاشة بيضاء */
export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-16 bottom-0 flex flex-col items-center justify-center px-4" aria-hidden>
      <div className="skeleton h-9 w-56 rounded-full" />
      <div className="skeleton mt-6 h-12 w-72 max-w-full rounded" />
      <div className="skeleton mt-3 h-12 w-60 max-w-full rounded" />
      <div className="skeleton mt-5 h-4 w-80 max-w-full rounded" />
      <div className="skeleton mt-8 h-12 w-full max-w-[312px] rounded-2xl" />
    </div>
  );
}
