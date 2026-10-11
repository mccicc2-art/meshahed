// شبكة الملصقات الموحّدة.
// auto-fill بدل عدد أعمدة ثابت: عنصران لا يتركان صفاً سداسياً شبه فارغ،
// والبطاقة تحافظ على عرضها بدل أن تتمدّد.
/**
 * 🆕 `sheet` (D-1355) — داخل ورقةٍ لا صفحة: **ثلاثةُ أعمدةٍ ثابتة**. نقاطُ الانكسار تقيس الشاشةَ لا الورقة، فعلى
 * الحاسوب كانت الورقةُ (٤٤٨px) تأخذ عمودَي الشاشة الواسعة فيكبر الملصقُ ولا يظهر صفّان.
 */
export function PosterGrid({ children, sheet = false }: { children: React.ReactNode; sheet?: boolean }) {
  if (sheet) return <div className="grid grid-cols-3 gap-4">{children}</div>;
  return (
    <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(96px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
      {children}
    </div>
  );
}
