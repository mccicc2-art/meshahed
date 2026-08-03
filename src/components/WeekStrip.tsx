import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

export interface WeekEntry {
  /** YYYY-MM-DD */
  date: string;
  showTmdbId: number;
  title: string;
  label: string;
}

/**
 * شريط الأيام السبعة القادمة.
 *
 * سبعة أعمدة ثابتة تملأ العرض بلا تمرير — التقويم يُقرأ بالنظرة لا
 * بالسحب. واليوم الذي فيه حلقة يُلوَّن، والفارغ يبقى باهتاً: الفراغ نفسه
 * معلومة («ما فيه شيء الأربعاء»)، ولو أخفيناه لضاع معناه.
 */
export function WeekStrip({
  days,
  entries,
  locale,
}: {
  /** سبعة تواريخ متتابعة تبدأ من اليوم */
  days: { date: string; weekday: string; dayNum: string }[];
  entries: WeekEntry[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const byDay = new Map<string, WeekEntry[]>();
  for (const e of entries) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }

  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-bold mb-1">
        <Icon name="calendar" size={18} className="text-muted" />
        {t.weekTitle}
      </h2>
      <p className="text-[11px] text-muted mb-3">{t.weekSub}</p>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const list = byDay.get(d.date) ?? [];
          const has = list.length > 0;
          const first = list[0];
          const body = (
            <>
              <span className="block text-[10px] text-muted leading-none">{d.weekday}</span>
              <span
                className={`block text-sm font-bold mt-1 leading-none ${
                  i === 0 ? "text-accent" : ""
                }`}
              >
                {d.dayNum}
              </span>
              <span
                className={`mt-1.5 block h-1 rounded-full ${has ? "bg-accent-2" : "bg-border"}`}
              />
              <span className="block text-[9px] text-muted mt-1 leading-tight h-6 overflow-hidden">
                {has ? (list.length > 1 ? `+${list.length}` : first.title) : ""}
              </span>
            </>
          );

          return has ? (
            <Link
              key={d.date}
              href={`/show/${first.showTmdbId}`}
              prefetch={false}
              title={list.map((e) => `${e.title} — ${e.label}`).join("\n")}
              className="rounded-xl border border-accent-2/35 bg-accent-2/[0.06] px-1 py-2 text-center hover:border-accent-2 transition"
            >
              {body}
            </Link>
          ) : (
            <div
              key={d.date}
              className="rounded-xl border border-border bg-surface px-1 py-2 text-center opacity-60"
            >
              {body}
            </div>
          );
        })}
      </div>

      {entries.length === 0 && (
        <p className="text-[11px] text-muted mt-2 text-center">{t.weekNothing}</p>
      )}
    </section>
  );
}
