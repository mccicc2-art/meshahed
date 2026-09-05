import { notFound } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import { getAdminNavCounts } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";

/**
 * 🆕 **غلافُ الإدارة الواحد** (D-923، حكمُ أحمد: «تحتاج تحسيناً وترتيباً
 * بحيث تسهّل المتابعة وفيها كل شيء»).
 *
 * 🔴 **ما كان**: سبعُ صفحاتٍ **كلٌّ تبني قشرتَها بيدها** — حارسٌ مكرَّرٌ سبعَ
 * مرّات، وعرضان مختلفان (`2xl` في خمسٍ و`3xl` في اثنتين)، **وحشوٌ مزدوج**
 * (`px-4 py-8` داخلَ `main` التي تحمل `px-4 pt-6` أصلاً) فالإدارةُ وحدَها
 * كانت أضيقَ من التطبيق كلِّه، **ولا رابطَ بينها البتّة.**
 *
 * 🔑 **والغلافُ يحرس ولا يكفي وحدَه**: الحارسُ هنا للمسار، **وحرّاسُ القاعدة
 * (`am_admin()` في جسم كلِّ دالّة) هم الحكم** (D-011) — **غلافُ Next لا يحمي
 * فعلاً على الخادم**، فحارسُ كلِّ صفحةٍ يبقى مكانه. **والنداءان يصيران واحداً**
 * لأنّ `getAmAdmin` مغلَّفةٌ بـ`cache()` — طلبٌ واحدٌ، رحلةٌ واحدة.
 *
 * ⚖️ **ولا حشوَ ولا عرضَ هنا إلا `max-w-3xl`**: `main` تحمل الحشوَ للتطبيق
 * كلِّه (`layout.tsx`)، **وصفحةُ مشغّلٍ كثيفةُ الأرقام تُقرأ أضيقَ من الشبكة**
 * — وهو القرارُ الوحيدُ الذي يستحقّ سطراً.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const counts = await getAdminNavCounts();

  return (
    <div className="mx-auto max-w-3xl space-y-5" dir="rtl">
      <AdminNav counts={counts} />
      {children}
    </div>
  );
}
