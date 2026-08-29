import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { posterUrl } from "@/lib/media";
import { getDict, num, type Locale } from "@/lib/i18n";
import type { PeriodReport } from "@/lib/reports";

/**
 * ============ وجهُ تقرير المدّة (D-796) ============
 *
 * 🔑 **والمقارنةُ هي التقرير لا الزينة**: **رقمٌ بلا مرجعٍ ليس خبراً** —
 * «١٢ ساعة» لا تقول شيئاً، **و«١٢ ساعة، أكثرُ من أسبوعك الماضي بالثلث»
 * تقول.** ولذلك تجلس النسبةُ بجانب الرقم لا في ذيل الصفحة.
 *
 * ⚠️ **ولا لونَ دلاليٌّ للأعلى والأدنى**: **أخضرُ للزيادة وأحمرُ للنقص
 * يحكم على القارئ** — **ومن شاهد أقلَّ لأنّه كان يعمل لا يُقال له
 * «أحمر».** الرقمُ يُقال بلونٍ واحدٍ والسهمُ يقول الاتّجاه.
 *
 * ⚠️ **والأعمدةُ نسبةٌ من أعلاها لا مقياسٌ مطلق**: أسبوعٌ خفيفٌ يبقى
 * مقروءاً — **ورسمٌ كلُّ أعمدته خيطٌ رفيعٌ لا يقول شيئاً.**
 */
export function PeriodReportView({
  report,
  locale,
}: {
  report: PeriodReport;
  locale: Locale;
}) {
  const t = getDict(locale);
  const ar = locale !== "en";
  const hours = Math.round(report.minutes / 60);
  const prevHours = Math.round(report.prevMinutes / 60);
  const delta =
    report.prevMinutes > 0
      ? Math.round(((report.minutes - report.prevMinutes) / report.prevMinutes) * 100)
      : null;
  const peak = Math.max(1, ...report.buckets.map((b) => b.minutes));

  if (report.minutes === 0) {
    return (
      <p className="text-sm text-muted text-center py-14">
        {ar
          ? "لا مشاهدات في هذه المدّة — علّم حلقةً أو فيلماً ويظهر تقريرك هنا."
          : "Nothing watched in this period — tick an episode or a film and your report appears here."}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* ═══ الوقتُ الكبير والمقارنة ═══ */}
      <section className="rounded-2xl border border-border bg-surface px-5 py-4">
        <div className="flex items-end gap-3 flex-wrap">
          <span className="text-[44px] font-bold leading-none tabular-nums">
            {num(hours, locale)}
          </span>
          <span className="text-15 text-muted pb-1.5">{t.hours(hours).replace(/[0-9٠-٩,\s]/g, "")}</span>
          {delta !== null && (
            <span className="ms-auto flex items-center gap-1.5 text-13 font-bold text-muted pb-1.5">
              <Icon name={delta >= 0 ? "trending" : "pause"} size={15} />
              <span dir="ltr" className="tabular-nums">
                {delta >= 0 ? "+" : ""}
                {num(delta, locale)}%
              </span>
            </span>
          )}
        </div>
        <p className="text-12 text-muted mt-2 leading-relaxed">
          {delta === null
            ? ar
              ? "لا مدّة سابقة تُقارن بها بعد."
              : "No earlier period to compare with yet."
            : ar
              ? `المدّة السابقة: ${num(prevHours, locale)} ساعة.`
              : `Previous period: ${num(prevHours, locale)} hours.`}
        </p>
      </section>

      {/* ═══ الأعمدة ═══ */}
      <section className="rounded-2xl border border-border bg-surface px-4 py-4">
        <div className="flex items-end gap-1.5 h-28">
          {report.buckets.map((b, i) => (
            <div key={`${b.label}-${i}`} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
              <span
                className="w-full rounded-t-md bg-accent/80"
                style={{ height: `${Math.max(2, Math.round((b.minutes / peak) * 88))}px` }}
                aria-hidden
              />
              <span className="text-[10px] text-muted truncate w-full text-center">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ ثلاثةُ أرقام ═══ */}
      <section className="grid grid-cols-3 rounded-2xl border border-border bg-surface overflow-hidden">
        <Stat value={num(report.episodes, locale)} label={t.shortEpisodes} icon="play" />
        <Stat value={num(report.movies, locale)} label={t.shortMovies} icon="film" divider />
        <Stat
          value={num(report.streak, locale)}
          label={ar ? "أيام متتالية" : "Day streak"}
          icon="check"
          divider
        />
      </section>

      {report.busiest && (
        <section className="rounded-2xl border border-border bg-surface px-4 py-3 flex items-center gap-3">
          <Icon name="calendar" size={18} className="text-accent shrink-0" />
          <div className="min-w-0">
            <p className="text-12 text-muted leading-none">{ar ? "أكثف يوم" : "Busiest day"}</p>
            <p className="text-14 font-bold mt-1 truncate">{report.busiest.label}</p>
          </div>
          <span className="ms-auto shrink-0 text-14 font-bold text-accent tabular-nums">
            {num(Math.round(report.busiest.minutes / 60), locale)}
            <span className="font-normal text-muted text-12">
              {" "}
              {t.hours(2).replace(/[0-9٠-٩,\s]/g, "")}
            </span>
          </span>
        </section>
      )}

      {/* ═══ أكثرُ ما شاهدت ═══ */}
      <section>
        <h2 className="text-16 font-bold mb-2.5">{ar ? "أكثر ما شاهدت" : "What you watched most"}</h2>
        <ul className="space-y-2">
          {report.titles.map((x) => (
            <li key={x.key}>
              <Link
                href={`/${x.mediaType === "tv" ? "show" : "movie"}/${x.tmdbId}`}
                prefetch={false}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5 active:opacity-70 transition"
              >
                <span className="relative block w-10 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-surface-2">
                  {x.poster ? (
                    <Image src={posterUrl(x.poster, "w185")!} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
                      <Icon name={x.mediaType === "tv" ? "tv" : "film"} size={14} />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-14 font-bold truncate">{x.title}</span>
                  <span className="block text-12 text-muted mt-0.5">
                    {x.mediaType === "tv"
                      ? ar
                        ? `${num(x.count, locale)} حلقة`
                        : `${num(x.count, locale)} episodes`
                      : ar
                        ? "فيلم"
                        : "Film"}
                  </span>
                </span>
                <span className="shrink-0 text-13 font-bold text-accent tabular-nums">
                  {num(Math.max(1, Math.round(x.minutes / 60)), locale)}
                  <span className="font-normal text-muted text-12">
                    {" "}
                    {t.hours(2).replace(/[0-9٠-٩,\s]/g, "")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ═══ الأنواع ═══ */}
      {report.genres.length > 0 && (
        <section>
          <h2 className="text-16 font-bold mb-2.5">{ar ? "أنواعك في هذه المدّة" : "Your genres this period"}</h2>
          <ul className="rounded-2xl border border-border bg-surface divide-y divide-[color:var(--divider)]">
            {report.genres.map((g) => (
              <li key={g.slug} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-14 truncate min-w-0 flex-1">{g.name}</span>
                <span
                  aria-hidden
                  className="h-1.5 rounded-full bg-accent/70 shrink-0"
                  style={{
                    width: `${Math.max(8, Math.round((g.minutes / report.genres[0].minutes) * 84))}px`,
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** خانةُ رقمٍ — **وصفةُ بطاقة الأرقام نفسُها** لا عائلةٌ ثانية (القاعدة ٣) */
function Stat({
  value,
  label,
  icon,
  divider = false,
}: {
  value: string;
  label: string;
  icon: "play" | "film" | "check";
  divider?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center gap-1.5 px-1.5 py-3 ${
        divider ? "border-s border-[color:var(--divider)]" : ""
      }`}
    >
      <Icon name={icon} size={16} className="text-accent" />
      <span className="text-15 font-bold leading-none tabular-nums">{value}</span>
      <span className="min-w-0 truncate text-12 font-medium text-muted leading-none">{label}</span>
    </div>
  );
}
