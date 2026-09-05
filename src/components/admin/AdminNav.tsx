"use client";

import { usePathname } from "next/navigation";
import { PageTabs, type PageTab } from "../ui/PageTabs";
import type { AdminNavCounts } from "@/lib/admin";

/**
 * 🆕 **شريطُ أقسام الإدارة** (D-923، حكمُ أحمد: «صفحة الأدمن تحتاج تحسيناً
 * وترتيباً بحيث تسهّل المتابعة وفيها كل شيء»).
 *
 * 🔴 **العطلُ الذي دام**: ستُّ صفحاتِ إدارةٍ **بلا طريقٍ بينها** — خمسٌ منها
 * لا تحمل رابطاً واحداً يعود إلى `/admin`، **فالتنقّلُ بينها زرُّ رجوعِ
 * المتصفّح أو كتابةُ العنوان باليد.** ومتابعةٌ يوميّةٌ تمرّ بأربع شاشاتٍ لا
 * تُفعل بزرِّ الرجوع.
 *
 * 🔑 **والشريطُ `PageTabs` نفسُه لا شكلٌ سابع**: قرارُ المالك (١٢ أغسطس)
 * أنّ **التبويبَ الذي يغيّر الصفحة `segmented` بخطِّه السفليّ** لا رقاقة
 * (`controls.ts`) — **فالإدارةُ تتبع إيقاعَ التطبيق لا تخترع لنفسها واحداً.**
 *
 * 🔑 **والأرقامُ شاراتٌ لا جرد**: `badge` يختفي عند الصفر (D-002) —
 * **الشريطُ يقول «هنا عملٌ ينتظر» لا «هنا عمودٌ فيه صفر».**
 */
const SECTIONS: { key: string; href: string; label: string; of?: keyof AdminNavCounts }[] = [
  { key: "overview", href: "/admin", label: "نظرة" },
  { key: "testers", href: "/admin/testers", label: "المختبِرون", of: "testers_missing" },
  { key: "users", href: "/admin/users", label: "المستخدمون", of: "suspended" },
  { key: "verify", href: "/admin/verify", label: "التوثيق", of: "verify" },
  { key: "partners", href: "/admin/partners", label: "الشركاء", of: "partners" },
  { key: "payouts", href: "/admin/payouts", label: "التحويلات", of: "payouts" },
  { key: "links", href: "/admin/links", label: "الروابط" },
  { key: "health", href: "/admin/health", label: "الأداء والحماية" },
];

export function AdminNav({ counts }: { counts: AdminNavCounts | null }) {
  const path = usePathname();
  /* المطابقةُ بالبادئة لا بالتساوي: صفحاتٌ فرعيّةٌ يوماً ما تبقى تحت تبويبها،
     و`/admin` وحدَها تساوٍ تامّ وإلا لأضاءت مع كلِّ قسم. */
  const active =
    SECTIONS.find((s) => s.href !== "/admin" && path.startsWith(s.href))?.key ?? "overview";

  const items: PageTab[] = SECTIONS.map((s) => ({
    key: s.key,
    label: s.label,
    href: s.href,
    badge: s.of ? (counts?.[s.of] ?? 0) : undefined,
    badgeLabel: s.of ? `${s.label}: ${counts?.[s.of] ?? 0} ينتظر` : undefined,
  }));

  return <PageTabs items={items} active={active} ariaLabel="أقسام الإدارة" asNav />;
}
