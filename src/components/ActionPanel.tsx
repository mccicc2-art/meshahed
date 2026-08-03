import Link from "next/link";

export interface PanelItem {
  key: string;
  href: string;
  count: number;
  label: string;
  sub: string;
  emoji: string;
  tone: "waiting" | "watching" | "ready" | "soon";
}

const TONES: Record<PanelItem["tone"], string> = {
  waiting: "text-accent",
  watching: "text-accent-2",
  ready: "text-foreground",
  soon: "text-muted",
};

/**
 * شريط الأعداد — سطر واحد.
 *
 * كان أربع بطاقات بأيقونة ورقم وعنوان وشرح، بارتفاع ١١٠ بكسل. مع الترويسة
 * كان الاثنان يلتهمان نصف الشاشة قبل أي عمل. الآن شريط مقسّم بارتفاع ٥٦
 * بكسل: رقم وكلمة واحدة. الشرح حُذف لا اختُصر — كلمة مثل «ينتظرك» تشرح
 * نفسها، والسطر تحتها كان يشرح ما لا يحتاج شرحاً.
 */
export function ActionPanel({ items }: { items: PanelItem[] }) {
  if (!items.some((i) => i.count > 0)) return null;

  return (
    <nav className="grid grid-cols-4 rounded-2xl border border-border bg-surface overflow-hidden divide-x divide-x-reverse divide-border">
      {items.map((item) => {
        const dim = item.count === 0;
        return (
          <Link
            key={item.key}
            href={dim ? "/library" : item.href}
            scroll={item.href.startsWith("#") ? true : undefined}
            className={`py-2.5 px-1 text-center transition hover:bg-surface-2 ${
              dim ? "opacity-45" : ""
            }`}
          >
            <span
              className={`block text-xl sm:text-2xl font-extrabold leading-none tabular-nums ${
                dim ? "text-muted" : TONES[item.tone]
              }`}
            >
              {item.count}
            </span>
            <span className="block text-[11px] text-muted mt-1 leading-tight truncate">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
