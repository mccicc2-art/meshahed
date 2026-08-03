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

const TONES: Record<PanelItem["tone"], { ring: string; text: string; bar: string }> = {
  waiting: {
    ring: "border-accent/45 bg-accent/[0.07] hover:border-accent",
    text: "text-accent",
    bar: "bg-accent",
  },
  watching: {
    ring: "border-accent-2/40 bg-accent-2/[0.07] hover:border-accent-2",
    text: "text-accent-2",
    bar: "bg-accent-2",
  },
  ready: {
    ring: "border-border bg-surface hover:border-accent/50",
    text: "text-foreground",
    bar: "bg-foreground/40",
  },
  soon: {
    ring: "border-border bg-surface hover:border-accent/50",
    text: "text-muted",
    bar: "bg-muted/50",
  },
};

/**
 * لوحة «وش أسوي الحين» أعلى الرئيسية.
 *
 * حلّت محل شريط «وقت المشاهدة / حلقة / مسلسل / فيلم». الفرق ليس شكلياً:
 * تلك أرقام تُقرأ ولا يُفعل بها شيء، وهذه أعداد قابلة للنقر تقود كل واحدة
 * إلى القائمة التي تخصّها. والشبكة ثابتة الأعمدة تتّسع لعرض الشاشة، بدل
 * صفّ أفقي كان يخفي نصف البطاقات خلف سحب لا يظهر أنه موجود.
 */
export function ActionPanel({ items }: { items: PanelItem[] }) {
  if (!items.some((i) => i.count > 0)) return null;

  return (
    // البطاقات الأربع تُعرض دائماً — إخفاء الأصفار كان يترك بطاقة وحيدة
    // في نصف صفّ والنصف الآخر فراغاً. الصفر خبر أيضاً: «ما فيه شيء ينتظرك».
    <nav className="grid grid-cols-4 gap-2">
      {items.map((item) => {
        const tone = TONES[item.tone];
        const dim = item.count === 0;
        return (
          <Link
            key={item.key}
            href={dim ? "/library" : item.href}
            scroll={item.href.startsWith("#") ? true : undefined}
            aria-disabled={dim}
            className={`relative overflow-hidden rounded-2xl border p-2.5 sm:p-4 transition ${
              dim ? "border-border bg-surface/60 opacity-55 hover:opacity-80" : tone.ring
            }`}
          >
            <span
              className={`absolute inset-x-0 top-0 h-0.5 ${dim ? "bg-border" : tone.bar}`}
            />

            <span className="block text-base sm:text-lg leading-none" aria-hidden>
              {item.emoji}
            </span>

            {/* بلا dir="ltr": ضبطها LTR كان يدفع الرقم لحافة البطاقة اليسرى
                بينما الأيقونة والعنوان على اليمين، فتنفصل أجزاء البطاقة */}
            <span
              className={`block text-xl sm:text-3xl font-extrabold leading-none mt-1.5 tabular-nums ${
                dim ? "text-muted" : tone.text
              }`}
            >
              {item.count}
            </span>

            <span className="block text-[11px] sm:text-xs font-bold mt-1 leading-tight">
              {item.label}
            </span>

            {/* الشرح يظهر على الشاشات الواسعة فقط — على الجوال يزحم البطاقة */}
            <span className="hidden sm:block text-[11px] text-muted mt-0.5 leading-tight">
              {item.sub}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
