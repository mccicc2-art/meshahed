import type { NextRequest } from "next/server";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale } from "@/lib/locale";
import { getFollows, getProfile } from "@/lib/data";
import { isPlus } from "@/core/plan";
import { asTimeZone } from "@/core/zone";
import { sanitizeUiState } from "@/lib/uiState";
import {
  MONTHS_AHEAD,
  asMonth,
  calendarEntries,
  dayLabel,
  groupByDate,
  monthDays,
  monthEnd,
  monthLabel,
  monthOf,
  monthShift,
  todayIn,
  weekdayLabels,
} from "@/core/calendar";
import type { CalendarPayload } from "@/core/contracts/calendar";

/**
 * 🆕 `GET /api/v1/me/calendar?m=YYYY-MM` — **تقويمُ الأعمال للتطبيق** (D-1317).
 *
 * 🔑 **حسابُ صفحة `/calendar` بحرفه لا نسخةٌ ثانية** (D-145): المنطقةُ الزمنيّةُ من الملفّ، والمدى من
 * اليوم إلى آخر الشهر، والمدخلُ يُحسب مرّةً ثمّ يُقصّ بشهره — وقاعدةُ البلس قاعدتُها: غيرُ المشترك يرى
 * شهرَه الحاليَّ، وما عداه يُرسل ومعه `locked` فيُرسم باهتاً تحت البوّابة (الويبُ يرسله تحت الضباب كذلك).
 */
export async function GET(req: NextRequest) {
  return handle<CalendarPayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const lim = limited(`v1:calendar:${auth.user.id}`, 60, 60_000);
      if (lim) return lim;

      const [locale, profile, follows] = await Promise.all([getLocale(), getProfile(), getFollows()]);
      const plus = isPlus(profile);
      const today = todayIn(asTimeZone(profile?.timezone));
      const now = monthOf(today);
      const month = asMonth(req.nextUrl.searchParams.get("m"), today);

      const entries = calendarEntries(follows, { today, until: monthEnd(month) });
      const byDay = groupByDate(entries.filter((e) => monthOf(e.date) === month));
      const days = monthDays(month, today);
      const prev = monthShift(month, -1);
      const next = monthShift(month, 1);

      return ok({
        month,
        label: monthLabel(month, locale),
        prev: prev >= now ? prev : null,
        next: next <= monthShift(now, MONTHS_AHEAD) ? next : null,
        plus,
        locked: !plus && month !== now,
        weekdays: weekdayLabels(locale),
        cells: days.map((d) => ({
          date: d.date,
          day: d.day,
          in_month: d.inMonth,
          is_today: d.isToday,
          count: d.inMonth ? (byDay.get(d.date)?.length ?? 0) : 0,
        })),
        groups: days
          .filter((d) => d.inMonth && (byDay.get(d.date)?.length ?? 0) > 0)
          .map((d) => ({
            date: d.date,
            label: dayLabel(d.date, locale),
            is_today: d.isToday,
            items: (byDay.get(d.date) ?? []).map((e) => ({
              key: e.key,
              tmdb_id: e.tmdbId,
              media: e.media,
              title: e.title,
              poster_path: e.posterPath,
            })),
          })),
        intro_hint: !sanitizeUiState(profile?.ui_state).hints.includes("calendar-intro"),
      });
    },
    { cacheControl: "private, no-store" },
  );
}
