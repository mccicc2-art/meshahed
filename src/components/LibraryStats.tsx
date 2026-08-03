import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";

export interface LibraryStat {
  label: string;
  value: string;
  icon: IconName;
}

/**
 * أرقام المكتبة الأربعة — سطران لا ثلاثة.
 *
 * الأيقونة والرقم في سطر واحد، والوصف تحتهما. كان كل رقم ثلاثة أسطر
 * منفصلة فتصير البطاقة مربّعاً طويلاً، وأربعة مربّعات تملأ نصف الشاشة قبل
 * أن يُرى ملصقٌ واحد.
 */
export function LibraryStats({
  stats,
  locale,
  href,
}: {
  stats: LibraryStat[];
  locale: Locale;
  /** رابط اختياري إلى التحليل الكامل */
  href?: string;
}) {
  const t = getDict(locale);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {stats.map((s) => {
        const card = (
          <div
            key={s.label}
            className="bg-surface border border-border rounded-2xl px-3 py-2.5 h-full"
          >
            <div className="flex items-center gap-1.5">
              <Icon name={s.icon} size={16} className="text-muted" />
              <span className="text-lg sm:text-xl font-extrabold leading-none">{s.value}</span>
            </div>
            <div className="text-[11px] text-muted mt-1 leading-tight truncate">{s.label}</div>
          </div>
        );
        return href ? (
          <Link key={s.label} href={href} className="hover:brightness-110 transition">
            {card}
          </Link>
        ) : (
          card
        );
      })}
      <span className="sr-only">{t.statsTitle}</span>
    </div>
  );
}
