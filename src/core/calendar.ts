import type { FollowRow } from "@/lib/data";
import { zoneShiftMs } from "@/core/zone";
import type { Locale } from "@/core/i18n";

/**
 * ============ تقويمُ أعمالك — منطقٌ نقيّ (D-828) ============
 *
 * **البندُ التاسعُ من خطّة الـ٢٤.** **وسؤالُ هذه الصفحة واحد: «متى
 * ينزل؟»** — **والماضي («ماذا فعلتُ؟») صفحتُه `/activity` منذ D-537**،
 * **وسطحان يجيبان سؤالاً واحداً عطلٌ لا تنويع** (القاعدة ٣).
 *
 * 🔑 **ولا مصدرَ جديدٌ ولا هجرة**: كلُّ ما هنا مقروءٌ من صفوف `follows`
 * التي تحملها المكتبةُ أصلاً — **`next_air_date` موعدُ الحلقة القادمة
 * للمسلسل وتاريخُ الصدور للفيلم** (انظر `actions.ts`) — **وهو المصدرُ
 * نفسُه الذي يرسم منه شريطُ الأسبوع في الرئيسية** (D-491).
 * **فالصفحةُ عمقُ الرفِّ لا نداءٌ ثانٍ عنه** (D-199).
 *
 * ⚠️ **وسقفُ المعرفة يُقال ولا يُخبَّأ** (D-063): **صفُّ المتابعة يحمل
 * «القادمة» وحدَها لا جدولَ الموسم** — **فشهرٌ بعيدٌ فارغٌ بطبيعته لا
 * بعطل**، **والماضي غيرُ محفوظٍ أصلاً لأنّ العمودَ يُستبدل بكلِّ
 * تحديث.** **ولذلك المدى: الشهرُ الحاليُّ وثلاثةٌ بعده، ولا رجوعَ إلى
 * الوراء** — **وتقويمٌ يفتح شهراً لا يملك بياناتِه يكذب بصمته.**
 *
 * ⚠️ **ولا رقمَ حلقةٍ هنا**: رقمُها يكلّف نداءَ TMDB لكلِّ صفّ (D-437)،
 * **وصفحةٌ تفتح ثلاثين نداءً لتكتب «حلقة ٤» ليست تقويماً** — **والاسمُ
 * والتاريخُ هما السؤال.**
 */

/** كم شهراً إلى الأمام — **سقفٌ معلَنٌ لا صامت** */
export const MONTHS_AHEAD = 3;

export interface CalendarEntry {
  key: string;
  tmdbId: number;
  media: "tv" | "movie";
  title: string;
  posterPath: string | null;
  /** YYYY-MM-DD */
  date: string;
}

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  /** رقمُ اليوم في شهره */
  day: number;
  /** **هل هو من الشهر المعروض؟** — أطرافُ الشبكة من جارَيه */
  inMonth: boolean;
  isToday: boolean;
  past: boolean;
}

/** اليومُ بتقويم القارئ لا بغرينتش (D-806) — `YYYY-MM-DD` */
export function todayIn(tz: string): string {
  return new Date(Date.now() + zoneShiftMs(tz)).toISOString().slice(0, 10);
}

/** `YYYY-MM` من يومٍ نصّيّ — **قصٌّ لا `Date`**، فلا منطقةَ تتدخّل */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** إزاحةُ شهرٍ نصّيٍّ بعددٍ من الأشهر */
export function monthShift(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * **الشهرُ المطلوبُ مقيَّداً بما نملكه.**
 *
 * 🔑 **والشهرُ مطلقٌ في الرابط (`?m=2026-09`) لا إزاحةٌ** (D-438):
 * **إزاحةٌ تعني أنّ الرابطَ يعني شهراً آخرَ غداً** — **ورابطٌ يتبدّل
 * معناه بمرور الوقت لا يُشارَك ولا يُحفظ.**
 */
export function asMonth(raw: string | null | undefined, today: string): string {
  const now = monthOf(today);
  const max = monthShift(now, MONTHS_AHEAD);
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return now;
  if (v < now) return now;
  if (v > max) return max;
  return v;
}

/**
 * **خاناتُ الشهر بأسابيعَ تامّة** — والأسبوعُ يبدأ الأحد.
 *
 * 🔑 **وتعريفُ الأسبوع واحدٌ في التطبيق**: `statsRange` تحسب أسبوعَها
 * بـ`getUTCDay()` (الأحدُ صفر) منذ D-799 — **وتقويمٌ يبدأ الاثنين
 * وإحصاءٌ يبدأ الأحد يجعلان «أسبوعَك» شيئين** (D-145).
 */
export function monthDays(month: string, today: string): CalendarDay[] {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const last = new Date(Date.UTC(y, m, 0));
  const end = new Date(last);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  const out: CalendarDay[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t);
    const date = d.toISOString().slice(0, 10);
    out.push({
      date,
      day: d.getUTCDate(),
      inMonth: date.slice(0, 7) === month,
      isToday: date === today,
      past: date < today,
    });
  }
  return out;
}

/**
 * **مداخلُ التقويم من صفوف المكتبة.**
 *
 * ⚠️ **والموقوفُ لا يدخل** (`dropped`): **البطاقةُ الحمراءُ تقول «لستُ
 * أنتظره»** (D-229/D-636) — **وتقويمُ انتظارٍ فيه ما أوقفتَه يعيد إليك
 * ما طردتَه بيدك.**
 * ⚠️ **وما مضى لا يدخل**: العمودُ يحمل «القادمة»، **فتاريخٌ سابقٌ فيه
 * صفٌّ لم يُحدَّث بعد لا حدثٌ مضى** — **وعرضُه يكتب حدثاً في يومٍ لم
 * يقع فيه.**
 */
export function calendarEntries(
  rows: readonly FollowRow[],
  { today, until }: { today: string; until: string },
): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  for (const r of rows) {
    if (r.dropped) continue;
    const date = r.next_air_date;
    if (!date || date < today || date > until) continue;
    out.push({
      key: `${r.media_type}-${r.tmdb_id}`,
      tmdbId: r.tmdb_id,
      media: r.media_type,
      title: r.title,
      posterPath: r.poster_path,
      date,
    });
  }
  /* **الترتيبُ بالتاريخ ثمّ بالاسم** — **ومرتَّبٌ بلا فاصلٍ ثانٍ يتبدّل
     ترتيبُه بين رسمتين على الصفوف نفسِها.** */
  out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return out;
}

/** تجميعٌ باليوم — والمفتاحُ نصُّ التاريخ نفسُه */
export function groupByDate(entries: readonly CalendarEntry[]): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

/** آخرُ يومٍ في شهر — `YYYY-MM-DD` */
export function monthEnd(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * **اسمُ الشهر بلغة القارئ** — `Intl` لا سجلٌّ مكتوبٌ بيد
 * (D-800: المنصّةُ تعرف أين يقع الشهرُ في كلِّ لغة).
 */
export function monthLabel(month: string, locale: Locale): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** أسماءُ أيّام الأسبوع مختصرةً، بادئةً بالأحد — بترتيب الشبكة نفسِه */
export function weekdayLabels(locale: Locale): string[] {
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    weekday: "short",
    timeZone: "UTC",
  });
  /* ٤ يناير ٢٠٢٦ أحدٌ — **مرساةٌ ثابتةٌ لا «اليوم»**، فلا تتبدّل
     الأسماءُ بتبدّل يوم الرسم. */
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2026, 0, 4 + i))),
  );
}

/** يومٌ نصّيٌّ بصيغةٍ يقرؤها الإنسان — «الأحد ٧ سبتمبر» */
export function dayLabel(date: string, locale: Locale): string {
  const d = new Date(`${date}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}
