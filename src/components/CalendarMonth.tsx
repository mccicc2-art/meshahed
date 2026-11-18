import Link from "next/link";
import Image from "next/image";
import { Icon } from "./Icon";
import { backdropUrl, posterUrl } from "@/core/media";
import { webWords } from "./webWords";
import { getDict, type Locale } from "@/core/i18n";
import {
  CAL_EXPECTED,
  dayLabel,
  weekdayLabels,
  type CalendarDay,
  type CalendarEntry,
} from "@/core/calendar";

/**
 * ============ شهرُ التقويم — شبكةٌ وجدول (D-828) ============
 *
 * **جسمان لسؤالٍ واحد**: **الشبكةُ خريطةٌ** (أين في الشهر يقع شيء؟)
 * **والقائمةُ محتوى** (ما هو؟). **ولا حالةَ اختيارٍ بينهما**: خانةُ
 * اليوم مرساةٌ (`#d-YYYY-MM-DD`) تنزل بك إلى يومها في القائمة —
 * **فالتنقّلُ بلا جافاسكربت ولا رحلةِ خادم**، **وشبكةٌ تحتاج ضغطةً
 * لتقول ما فيها تخفي نصفَ جوابها.**
 *
 * ⚠️ **والخانةُ الفارغةُ تبقى مرسومة**: **الفراغُ نفسُه معلومة**
 * («ما فيه شيء الأربعاء») — **وهي حجّةُ `WeekStrip` بعينها** (D-491).
 *
 * ⚠️ **وأطرافُ الشبكة من الشهرين المجاورين** بلا محتوى: **أسبوعٌ ناقصُ
 * الخانات يزيح أعمدةَ الأيام**، **وعمودٌ مكتوبٌ فوقه «الأحد» فيه ثلاثاء
 * أسوأُ من خانةٍ باهتة.**
 */
export function CalendarMonth({
  days,
  byDay,
  locale,
  todayLabelText,
  backdrops,
}: {
  /** 🆕 R268 — خلفيّةُ كلِّ عملٍ (`tv-123` ← مسارٌ خام) لصفوف الحاسوب العريضة — غائبةٌ ⇒ الملصقُ كما كان */
  backdrops?: Record<string, string | null>;
  days: CalendarDay[];
  byDay: Map<string, CalendarEntry[]>;
  locale: Locale;
  /** نصُّ «اليوم» — يُمرَّر فلا يُترجم هنا */
  todayLabelText: string;
}) {
  const t = getDict(locale);
  const heads = weekdayLabels(locale);
  const withEntries = days.filter((d) => d.inMonth && (byDay.get(d.date)?.length ?? 0) > 0);
  const w = webWords(locale);
  /* 🆕 R268 — ملخّصُ الشهر لعمود الحاسوب: حلقاتٌ وأفلامٌ وأعمالٌ مختلفة — من المداخل نفسِها، بلا نداء */
  const monthEntries = withEntries.flatMap((d) => byDay.get(d.date) ?? []);
  const sum = {
    eps: monthEntries.filter((e) => e.media === "tv").length,
    movies: monthEntries.filter((e) => e.media === "movie").length,
    works: new Set(monthEntries.map((e) => `${e.media}-${e.tmdbId}`)).size,
  };

  return (
    /* 🆕 R268 — **التقويمُ على الحاسوب عمودان** (أحمد ١٨ نوفمبر — «ب»): الأيامُ القادمة صفوفٌ عريضةٌ بخلفيّة العمل، وبجانبها
       الشهرُ صغيراً ثابتاً (يومٌ فيه شيءٌ رابطٌ ينزل إليه — كما في الجوال) وتحته ملخّصُ الشهر. الشهرُ فيه أيامٌ فارغةٌ كثيرة،
       والقائمةُ لا تعرض إلّا ما فيه شيء. وتحت ١٢٨٠ كما كان حرفاً: الشهرُ فوق والقائمةُ تحته. */
    <div className="space-y-6 desk:space-y-0 desk:grid desk:grid-cols-[minmax(0,1fr)_340px] desk:items-start desk:gap-x-10">
      {/* ═══ الخريطة ═══ */}
      <div className="desk:col-start-2 desk:row-start-1 desk:sticky desk:top-6 desk:space-y-3">
      <div className="desk:rounded-2xl desk:border desk:border-border desk:bg-surface desk:p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {heads.map((h, i) => (
            <span key={i} className="text-center text-[10px] text-muted leading-none py-1">
              {h}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const list = byDay.get(d.date) ?? [];
            const has = d.inMonth && list.length > 0;
            /* 🆕 D-1614 — يومٌ كلُّ ما فيه متوقَّعٌ يُرسم باهتاً بإطارٍ متقطّع: «هنا شيءٌ على الأرجح» لا «هنا شيء» */
            const guess = has && list.every((e) => e.expected);
            const body = (
              <>
                <span
                  className={`block text-sm font-bold leading-none ${
                    d.isToday ? "text-accent" : d.inMonth ? "" : "text-muted/50"
                  }`}
                >
                  {d.day}
                </span>
                {/* **الشريطُ هو نفسُه شريطُ `WeekStrip`** — **علامةٌ
                    واحدةٌ تعني «هنا شيء» في السطحين** (القاعدة ٣). */}
                <span
                  className={`mt-1.5 block h-1 rounded-full ${
                    has ? (guess ? "bg-accent-2/40" : "bg-accent-2") : d.inMonth ? "bg-border" : "bg-transparent"
                  }`}
                />
                <span className="block text-[9px] text-muted mt-1 leading-none h-3">
                  {has ? (list.length > 1 ? `+${list.length}` : "") : ""}
                </span>
              </>
            );
            const cell = "rounded-lg px-1 py-2 text-center";
            return has ? (
              <a
                key={d.date}
                href={`#d-${d.date}`}
                className={`${cell} border ${guess ? "border-dashed border-accent-2/30" : "border-accent-2/35 bg-accent-2/[0.06]"} hover:border-accent-2 transition`}
              >
                {body}
              </a>
            ) : (
              <div
                key={d.date}
                className={`${cell} border ${
                  d.inMonth ? "border-border bg-surface opacity-60" : "border-transparent"
                }`}
              >
                {body}
              </div>
            );
          })}
        </div>
      </div>

      {monthEntries.length ? (
        <div className="hidden desk:block rounded-2xl border border-border bg-surface p-3.5">
          <p className="mb-2 text-12 font-bold text-muted">{w.calThisMonth}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([
              [sum.eps, w.calEpisodesN],
              [sum.movies, w.calMoviesN],
              [sum.works, w.calWorksN],
            ] as const).map(([n, label]) => (
              <div key={label} className="rounded-xl bg-surface-2 py-2.5">
                <b className="block text-20 font-bold tabular-nums">{n}</b>
                <span className="text-12 text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      </div>

      {/* ═══ المحتوى ═══ */}
      {withEntries.length === 0 ? (
        <p className="text-14 text-muted text-center py-6 desk:col-start-1 desk:row-start-1" dir="auto">
          {t.calEmpty}
        </p>
      ) : (
        <ul className="space-y-5 desk:col-start-1 desk:row-start-1">
          {withEntries.map((d) => (
            <li key={d.date} id={`d-${d.date}`} className="scroll-mt-24">
              <p className="text-12 font-semibold text-muted mb-2" dir="auto">
                {d.isToday ? `${todayLabelText} · ` : ""}
                {dayLabel(d.date, locale)}
              </p>
              <ul className="space-y-2">
                {(byDay.get(d.date) ?? []).map((e) => {
                  const url = posterUrl(e.posterPath, "w185");
                  const bd = backdropUrl(backdrops?.[`${e.media}-${e.tmdbId}`] ?? null, "w780");
                  return (
                    <li key={e.key}>
                      <Link
                        href={e.media === "tv" ? `/show/${e.tmdbId}` : `/movie/${e.tmdbId}`}
                        prefetch={false}
                        className={`flex items-center gap-3 rounded-xl border bg-surface p-2 hover:border-accent-2/60 transition ${e.expected ? "border-dashed border-border opacity-60" : "border-border"} ${bd ? "desk:h-[92px] desk:gap-4 desk:overflow-hidden desk:rounded-2xl desk:p-0 desk:pe-4" : ""}`}
                      >
                        {bd ? (
                          <span className="relative hidden desk:block h-full w-[164px] shrink-0 bg-surface-2">
                            <Image src={bd} alt="" fill sizes="164px" className="object-cover" />
                          </span>
                        ) : null}
                        <span className={`relative block w-9 h-[54px] shrink-0 rounded-md overflow-hidden bg-surface-2 ${bd ? "desk:hidden" : ""}`}>
                          {url ? (
                            <Image
                              src={url}
                              alt=""
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="grid place-items-center w-full h-full text-muted">
                              <Icon name={e.media === "tv" ? "tv" : "film"} size={16} />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-14 font-medium truncate desk:text-15 desk:font-bold" dir="auto">
                            {e.title}
                          </span>
                          {/* ⚠️ **ولا رقمَ حلقة**: رقمُها نداءُ TMDB لكلِّ
                              صفّ (D-437) — **والغائبُ يغيب ولا يُخمَّن**
                              (D-063). */}
                          <span className="block text-12 text-muted mt-0.5" dir="auto">
                            {e.expected ? CAL_EXPECTED[locale === "en" ? "en" : "ar"] : e.media === "tv" ? t.calEpisode : t.calRelease}
                          </span>
                        </span>
                        {/* **بلا `dir` وبلا شرطِ لغة** (D-801): الحرفُ
                            مرآويٌّ في يونيكود فينقلب مع الصفحة وحدَه. */}
                        <span aria-hidden className="text-muted shrink-0">›</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
