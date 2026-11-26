import { Icon } from "../Icon";
import { HISTORY_WORDS } from "./historyWords";
import { dayKey, shiftDay, watchSummary, type ActivityItem, type WatchSource } from "@/core/activityDays";
import { SIGNAL_SOURCE_NAME } from "@/core/contracts/stremio";
import { getDict, num, type Locale } from "@/core/i18n";

/**
 * ====== 🆕 عمودُ «سجلّ المشاهدة» الجانبيّ على الحاسوب (التصميم «أ»، T412) ======
 *
 * **حصيلةُ الأسبوع** بأرقام التطبيق الثلاثة (`watchSummary` — حلقة · فيلم · ساعة، والساعاتُ تغيب إن لم تصل مدّة: لا صفرَ كاذب)
 * ومعها **سبعةُ أعمدةٍ لأيّام الأسبوع** (اليومُ أوّلاً من البداية، ملوّنٌ كاملاً) — و**«من أين وصلت»**: عدُّ مشاهدات الأيّام السبعة
 * نفسِها بحسب مصدرها، من الحقل نفسِه الذي يكتب شارةَ الصفّ. لا طلبَ جديد: كلُّه من السجلّ الذي تقرؤه الصفحة.
 * 🔑 **المشاهدةُ وحدَها تُعدّ** أيّاً كانت الرقاقة: العمودُ يصف أسبوعَ المشاهدة، والرقاقةُ تصف القائمة.
 */
export function WeekAside({ items, locale, local, todayKey }: { items: ActivityItem[]; locale: Locale; local: boolean; todayKey: string }) {
  const t = getDict(locale);
  const w = HISTORY_WORDS[locale === "en" ? "en" : "ar"];
  const start = shiftDay(todayKey, -6);
  const week = items.filter((it) => it.kind === "watch" && dayKey(it.at, local) >= start);
  const sum = watchSummary(week);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(todayKey, -i));
  const per = days.map((k) => week.filter((it) => dayKey(it.at, local) === k).length);
  const max = Math.max(1, ...per);
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { weekday: "narrow", timeZone: "UTC" });

  const counts = new Map<string, number>();
  for (const it of week) {
    const k = sourceName(it.source ?? null, t, w.manual);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sources = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const stats = [
    { n: sum.episodes, label: t.activityWeekEpisodes },
    { n: sum.movies, label: t.activityWeekMovies },
    ...(sum.hours != null ? [{ n: sum.hours, label: t.activityWeekHours }] : []),
  ];

  return (
    <>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <Icon name="calendar" size={17} className="text-accent" />
          {t.activityThisWeek}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <p className="text-2xl font-extrabold tabular-nums">{num(s.n, locale)}</p>
              <p className="truncate text-12 text-muted">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-end gap-1.5" aria-hidden>
          {days.map((k, i) => (
            <div key={k} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-20 w-full items-end">
                <div
                  className={`w-full rounded-t-md rounded-b-sm bg-accent ${i === 0 ? "" : "opacity-45"}`}
                  style={{ height: per[i] ? `${Math.max(8, (per[i] / max) * 100)}%` : 3 }}
                />
              </div>
              <span className="text-[11px] text-muted">{fmt.format(new Date(`${k}T12:00:00Z`))}</span>
            </div>
          ))}
        </div>
      </div>

      {sources.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Icon name="tv" size={17} className="text-accent" />
            {w.sources}
          </h2>
          <p className="mb-1 text-12 text-muted">{w.sourcesSub}</p>
          <ul>
            {sources.map(([name, n]) => (
              <li key={name} className="flex items-center justify-between border-b border-[color:var(--divider)] py-2 text-sm last:border-0">
                <bdi>{name}</bdi>
                <span className="font-bold tabular-nums">{num(n, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** اسمُ المصدر — كشارة الصفّ في التطبيق (`sourceLabel`): أسماءُ المنتجات لا تُترجم */
export function sourceName(s: WatchSource | null, t: ReturnType<typeof getDict>, manual: string): string {
  if (!s) return manual;
  if (s === "plex" || s === "jellyfin" || s === "emby" || s === "kodi" || s === "stremio" || s === "nuvio") return SIGNAL_SOURCE_NAME[s];
  /* 🆕 هجرة ٢٦٥ — اسمُ منتجٍ لا يُترجم */
  if (s === "netflix") return "Netflix";
  if (s === "osn") return "OSN+";
  /* 🆕 المهمّة ٥٦٧ — شاهد بلغة القارئ */
  if (s === "shahid") return t.shahidName;
  return s === "widget" ? t.srcWidget : s === "import" ? t.srcImport : t.srcAuto;
}
