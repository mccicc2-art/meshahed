import { notFound } from "next/navigation";
import Link from "next/link";
import { getAmAdmin } from "@/lib/data";

/**
 * 🆕 **فهرسُ لوحة الإدارة** (D-901) — **أربعُ صفحاتٍ بلا بابٍ أربعةُ
 * روابطَ محفوظةٍ في رأس أحمد**، وهذا هو البابُ. لا نظامَ صلاحيّاتٍ
 * جديد: `am_admin()` نفسُها، وغيرُ الإداريِّ يرى 404 — **فوجودُ اللوحة
 * لا يُقال لمن لا يملكها** (نمطُ D-608).
 */
const PAGES: { href: string; title: string; hint: string }[] = [
  { href: "/admin/users", title: "المستخدمون", hint: "بحث · إيقافُ حسابٍ وفكُّه" },
  { href: "/admin/partners", title: "طلبات الشركاء", hint: "قبولٌ ورفضٌ ووَلْدُ كود الإحالة" },
  { href: "/admin/payouts", title: "طلبات التحويل", hint: "طابورُ الصرف — فارغٌ حتى تُفتح المدفوعات" },
  { href: "/admin/verify", title: "طلبات التوثيق", hint: "طابورُ التوثيق الأزرق" },
  { href: "/admin/links", title: "روابط المنصّات", hint: "ربطُ عملٍ بمنصّةٍ في بلد" },
];

export default async function AdminIndexPage() {
  const admin = await getAmAdmin();
  if (!admin) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-22 font-bold">لوحة الإدارة</h1>
      <div className="grid gap-3">
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="rounded-card border border-border bg-surface p-4 hover:border-accent transition-colors"
          >
            <p className="text-16 font-bold">{p.title}</p>
            <p className="text-13 text-muted mt-0.5">{p.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
