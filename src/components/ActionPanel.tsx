import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export interface PanelItem {
  key: string;
  href: string;
  count: number;
  label: string;
  icon: IconName;
}

/**
 * شريط الأعداد — سطران.
 *
 * الأيقونة والرقم في سطر، والكلمة في سطر تحته. ثلاثة أسطر (أيقونة، رقم،
 * كلمة) كانت تجعل البطاقة مربّعاً طويلاً بلا داعٍ؛ والأيقونة بجانب الرقم
 * تقرأ نفسها معه: 🔔 ٣ = ثلاثةٌ تنتظرك.
 */
export function ActionPanel({ items }: { items: PanelItem[] }) {
  if (!items.some((i) => i.count > 0)) return null;

  return (
    <nav className="grid grid-cols-4 rounded-2xl border border-border bg-surface overflow-hidden divide-x divide-x-reverse divide-border">
      {items.map((item) => {
        // كلها بلون واحد أبيض: أربعة ألوان مختلفة كانت توحي بأولويّة بين
        // المربّعات لا وجود لها — كلها عدّادات متساوية
        const dim = item.count === 0;
        const tone = dim ? "text-muted" : "text-foreground";
        return (
          <Link
            key={item.key}
            href={dim ? "/library" : item.href}
            scroll={item.href.startsWith("#") ? true : undefined}
            className={`py-2.5 px-1 transition hover:bg-surface-2 ${dim ? "opacity-45" : ""}`}
          >
            <span className={`flex items-center justify-center gap-1.5 ${tone}`}>
              <Icon name={item.icon} size={16} />
              <span className="text-xl sm:text-2xl font-extrabold leading-none tabular-nums">
                {item.count}
              </span>
            </span>
            <span className="block text-[11px] text-muted mt-1 leading-tight text-center truncate">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
