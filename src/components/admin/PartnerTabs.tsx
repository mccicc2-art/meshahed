import Link from "next/link";
import { chipClass, chipRow } from "../ui/controls";
import { getAdminNavCounts } from "@/lib/admin";

/**
 * 🆕 **شريطُ «الشركاء والتوثيق»** (المهمّة ٦٠١ · مراجعةُ ٢٧ نوفمبر).
 *
 * ثلاثُ صفحاتٍ صغيرةٍ صارت قسماً واحداً في شريط الإدارة؛ وهذا الشريطُ يصل بينها **بعائلة الرقائق نفسِها**
 * (`chipClass`) لا شكلٍ ثالث. كلُّ صفحةٍ باقيةٌ بمسارها وأفعالها الخادميّة ورسائلها — **الدمجُ في التنقّل لا في
 * الشيفرة**: نقلُ ثلاثة طوابير بأفعالها إلى صفحةٍ واحدةٍ ثمنُه إعادةُ كتابةٍ تُخاطر بقرارات المال والتوثيق لأجل شكل.
 */
const TABS = [
  { href: "/admin/partners", label: "طلبات الشراكة", of: "partners" },
  { href: "/admin/payouts", label: "التحويلات", of: "payouts" },
  { href: "/admin/verify", label: "التوثيق", of: "verify" },
] as const;

export async function PartnerTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  const counts = await getAdminNavCounts();
  return (
    <nav aria-label="الشركاء والتوثيق" className={`${chipRow} flex gap-2`}>
      {TABS.map((t) => {
        const c = counts?.[t.of] ?? 0;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === active ? "page" : undefined}
            className={chipClass(t.href === active)}
          >
            {t.label}
            {c > 0 ? (
              <span className="ms-1 tabular-nums" dir="ltr">
                {c}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
