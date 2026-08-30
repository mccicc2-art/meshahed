import Link from "next/link";
import Image from "next/image";
import { Icon } from "./Icon";
import { posterUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import {
  dayLabel,
  weekdayLabels,
  type CalendarDay,
  type CalendarEntry,
} from "@/lib/calendar";

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
}: {
  days: CalendarDay[];
  byDay: Map<string, CalendarEntry[]>;
  locale: Locale;
  /** نصُّ «اليوم» — يُمرَّر فلا يُترجم هنا */
  todayLabelText: string;
}) {
  const t = getDict(locale);
  const heads = weekdayLabels(locale);
  const withEntries = days.filter((d) => d.inMonth && (byDay.get(d.date)?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      {/* ═══ الخريطة ═══ */}
      <div>
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
                    has ? "bg-accent-2" : d.inMonth ? "bg-border" : "bg-transparent"
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
                className={`${cell} border border-accent-2/35 bg-accent-2/[0.06] hover:border-accent-2 transition`}
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

      {/* ═══ المحتوى ═══ */}
      {withEntries.length === 0 ? (
        <p className="text-14 text-muted text-center py-6" dir="auto">
          {t.calEmpty}
        </p>
      ) : (
        <ul className="space-y-5">
          {withEntries.map((d) => (
            <li key={d.date} id={`d-${d.date}`} className="scroll-mt-24">
              <p className="text-12 font-semibold text-muted mb-2" dir="auto">
                {d.isToday ? `${todayLabelText} · ` : ""}
                {dayLabel(d.date, locale)}
              </p>
              <ul className="space-y-2">
                {(byDay.get(d.date) ?? []).map((e) => {
                  const url = posterUrl(e.posterPath, "w185");
                  return (
                    <li key={e.key}>
                      <Link
                        href={e.media === "tv" ? `/show/${e.tmdbId}` : `/movie/${e.tmdbId}`}
                        prefetch={false}
                        className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2 hover:border-accent-2/60 transition"
                      >
                        <span className="relative block w-9 h-[54px] shrink-0 rounded-md overflow-hidden bg-surface-2">
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
                          <span className="block text-14 font-medium truncate" dir="auto">
                            {e.title}
                          </span>
                          {/* ⚠️ **ولا رقمَ حلقة**: رقمُها نداءُ TMDB لكلِّ
                              صفّ (D-437) — **والغائبُ يغيب ولا يُخمَّن**
                              (D-063). */}
                          <span className="block text-12 text-muted mt-0.5" dir="auto">
                            {e.media === "tv" ? t.calEpisode : t.calRelease}
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
