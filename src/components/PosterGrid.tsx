// شبكة الملصقات الموحّدة.
// auto-fill بدل عدد أعمدة ثابت: عنصران لا يتركان صفاً سداسياً شبه فارغ،
// والبطاقة تحافظ على عرضها بدل أن تتمدّد.
export function PosterGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(96px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
      {children}
    </div>
  );
}
