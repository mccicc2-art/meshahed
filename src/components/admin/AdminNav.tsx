"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageTabs, type PageTab } from "../ui/PageTabs";
import { segmentedItem, chipRow } from "../ui/controls";
import type { AdminNavCounts } from "@/lib/admin";

/**
 * 🆕 **شريطُ أقسام الإدارة** (D-923، حكمُ أحمد: «صفحة الأدمن تحتاج تحسيناً
 * وترتيباً بحيث تسهّل المتابعة وفيها كل شيء»).
 *
 * 🆕 **ومجموعاتٌ لا أحدَ عشر تبويباً** (مهمّة ٥٩٣، ٢٧ نوفمبر — غرفةُ القيادة):
 * أحدَ عشرَ تبويباً على ٣٦٠px **صفٌّ يُمرَّر ولا يُرى آخرُه**، فمن يبحث عن
 * «التحويلات» يمرّر ليجدها كلَّ مرّة. **والأقسامُ ثلاثُ عائلاتٍ أصلاً**:
 * ما يقرّره أحمد (القيادة)، ما يُراقَب (التشغيل)، ما يخصّ الناس (المجتمع).
 * فالصفُّ الأوّل ثلاثةُ تبويباتٍ تُقرأ كلُّها، **والثاني يُفتح تحته في `extra`
 * لا شريطاً لاصقاً ثانياً** — شريطان لاصقان يتراكبان عند التمرير.
 *
 * 🔑 **والشريطُ `PageTabs` نفسُه لا شكلٌ سابع** (قرارُ المالك ١٢ أغسطس)،
 * **والصفُّ الثاني `segmentedItem` نفسُه بلا حشوٍ كبير** — عائلةٌ واحدة بدرجتين.
 *
 * 🔑 **والأرقامُ شاراتٌ لا جرد**: `badge` يختفي عند الصفر (D-002)، **وشارةُ
 * المجموعة مجموعُ شاراتِ أقسامها** — كي لا يختفي «بلاغٌ ينتظر» داخلَ مجموعةٍ مطويّة.
 *
 * ⚖️ **«المنتجُ والنمو» لا يظهر بعد**: مجموعةٌ بلا صفحةٍ تبويبٌ يَعِد ولا يفي.
 */
type Section = {
  key: string;
  href: string;
  label: string;
  of?: keyof AdminNavCounts;
};

const GROUPS: { key: string; label: string; sections: Section[] }[] = [
  {
    key: "command",
    label: "القيادة",
    sections: [
      { key: "command", href: "/admin/command", label: "غرفة القيادة" },
      { key: "items", href: "/admin/items", label: "البنود" },
      { key: "agents", href: "/admin/agents", label: "الوكلاء" },
    ],
  },
  {
    key: "ops",
    label: "التشغيل",
    sections: [
      { key: "overview", href: "/admin", label: "نظرة" },
      { key: "health", href: "/admin/health", label: "الأداء والحماية" },
      {
        key: "testers",
        href: "/admin/testers",
        label: "المختبِرون",
        of: "testers_missing",
      },
      /* D-1563 — شخصيات لوبز AI: الإيقافُ والطابور */
      { key: "personas", href: "/admin/personas", label: "الشخصيات" },
      { key: "links", href: "/admin/links", label: "الروابط" },
    ],
  },
  {
    key: "community",
    label: "المجتمع",
    sections: [
      {
        key: "users",
        href: "/admin/users",
        label: "المستخدمون",
        of: "suspended",
      },
      {
        key: "reports",
        href: "/admin/reports",
        label: "البلاغات",
        of: "reports",
      },
      /* D-1499 — بلا شارةِ عدٍّ (لا عدّادَ له في `admin_nav_counts` بعد) */
      { key: "feedback", href: "/admin/feedback", label: "الملاحظات" },
      { key: "verify", href: "/admin/verify", label: "التوثيق", of: "verify" },
      {
        key: "partners",
        href: "/admin/partners",
        label: "الشركاء",
        of: "partners",
      },
      {
        key: "payouts",
        href: "/admin/payouts",
        label: "التحويلات",
        of: "payouts",
      },
    ],
  },
];

export function AdminNav({ counts }: { counts: AdminNavCounts | null }) {
  const path = usePathname();
  const n = (s: Section) => (s.of ? (counts?.[s.of] ?? 0) : 0);

  /* المطابقةُ بالبادئة لا بالتساوي، و`/admin` وحدَها تساوٍ تامّ وإلا لأضاءت مع كلِّ قسم. */
  const all = GROUPS.flatMap((g) => g.sections.map((s) => ({ g, s })));
  const hit =
    all.find(({ s }) => s.href !== "/admin" && path.startsWith(s.href)) ??
    all.find(({ s }) => s.key === "overview")!;
  const group = hit.g;

  const items: PageTab[] = GROUPS.map((g) => {
    const sum = g.sections.reduce((a, s) => a + n(s), 0);
    return {
      key: g.key,
      label: g.label,
      /* التبويبُ يفتح أوّلَ أقسامه — والقيادةُ أوّلُها غرفةُ القيادة */
      href: g.sections[0].href,
      badge: sum,
      badgeLabel: `${g.label}: ${sum} ينتظر`,
    };
  });

  const sub = (
    <nav aria-label={`أقسام ${group.label}`} className={`${chipRow} flex`}>
      {group.sections.map((s) => {
        const on = s.key === hit.s.key;
        const c = n(s);
        return (
          <Link
            key={s.key}
            href={s.href}
            aria-current={on ? "page" : undefined}
            className={segmentedItem(on, "px-3 pt-1.5 pb-2 text-14", false)}
          >
            {s.label}
            {c > 0 && (
              <span
                dir="ltr"
                className="ms-1.5 inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-12 font-bold tabular-nums"
              >
                {c}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <PageTabs
      items={items}
      active={group.key}
      ariaLabel="أقسام الإدارة"
      asNav
      extra={sub}
    />
  );
}
