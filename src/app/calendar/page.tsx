import { redirect } from "next/navigation";
import Link from "next/link";
import { getFollows, getProfile, getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { getDict } from "@/lib/i18n";
import { isPlus } from "@/lib/plan";
import { asTimeZone } from "@/lib/zone";
import {
  MONTHS_AHEAD,
  asMonth,
  calendarEntries,
  groupByDate,
  monthDays,
  monthEnd,
  monthLabel,
  monthOf,
  monthShift,
  todayIn,
} from "@/lib/calendar";
import { CalendarMonth } from "@/components/CalendarMonth";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { PlusPill } from "@/components/ui/PlusPill";
import { PlusPreview } from "@/components/stats/PlusPreview";

/**
 * ============ تقويمُ أعمالك (D-828) ============
 *
 * **الصفحةُ عمقُ شريط الأسبوع لا صفٌّ ثانٍ عنه** (D-199): الشريطُ في
 * الرئيسية يعطي أربعةَ عشرَ يوماً **من المسلسلات وحدَها وباسمٍ واحدٍ
 * لليوم**، **وهذه تعطي الشهرَ كلَّه بأفلامه وأسمائه** — **وثلاثةَ
 * أشهرٍ إلى الأمام.**
 *
 * 🔒 **والشهرُ الحاليُّ مفتوحٌ للجميع، والأشهرُ التالية بلس.**
 * **والسببُ قاعدةُ أحمد نفسُها** («ما منعتُ خدمةً مجّانيّةً عن
 * الأعضاء»، D-633): **شريطُ الأسبوعين يجيب سؤالَ هذا الشهر أصلاً
 * ومجّاناً** — **فمنعُه أخذُ ما بيده لا بيعُ ما ليس بيده.**
 * **والمبيعُ هو العمق**: أن ترى أبعدَ من أسبوعين.
 * **والمقفولُ يُموَّه ولا يُخفى** (D-809): **بياناتُه هو خلف الضباب لا
 * أرقامٌ مخترعة** — **ومن رأى ما يشتريه اشتراه.**
 *
 * ⚠️ **والبابُ نفسُه مفتوحٌ لغير المشترك**: **صفحةٌ تُقفل عند عتبتها
 * تعلّم قارئَها ألّا يطرقها** (درسُ D-628: تبويبٌ يبتلع شريطَه فخّ).
 *
 * ⚠️ **ولا نداءَ TMDB واحد**: المصدرُ صفوفُ `follows` المخزَّنة —
 * **والصفحةُ تُرسم من قراءةٍ واحدةٍ للقاعدة** (D-509/D-580).
 */

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const [{ locale }, params, profile, follows] = await Promise.all([
    getT(),
    searchParams,
    getProfile(),
    getFollows(),
  ]);
  const t = getDict(locale);
  const ar = locale !== "en";
  const plus = isPlus(profile);

  /* 🆕 **وتقويمُ الصفحة تقويمُ القارئ** (D-806) — والغائبُ غرينتش */
  const tz = asTimeZone(profile?.timezone);
  const today = todayIn(tz);
  const now = monthOf(today);
  const month = asMonth(params.m, today);
  const locked = !plus && month !== now;

  const days = monthDays(month, today);
  const entries = calendarEntries(follows, { today, until: monthEnd(month) });
  const byDay = groupByDate(entries.filter((e) => monthOf(e.date) === month));

  const href = (m: string) => (m === now ? "/calendar" : `/calendar?m=${m}`);
  const prev = monthShift(month, -1);
  const next = monthShift(month, 1);
  const canPrev = prev >= now;
  const canNext = next <= monthShift(now, MONTHS_AHEAD);

  /* **مِقودُ الشهر — سهمٌ واسمٌ وسهم، في صفِّ الترويسة لا تحته**:
     **وهو مِقودُ `‎/statistics` بعينه** (D-804) — **مقودان بشكلين في
     صفحتين شقيقتين عطلٌ** (القاعدة ٣).
     ⚠️ **و`replace` لا دفع** (D-805): **الشهرُ في الرابط**، **فمن قلّب
     ثلاثةَ أشهرٍ ثمّ ضغط الرجوع يمشي في ثلاثةِ مداخلَ قبل أن يخرج.** */
  const monthNav = (
    <span className="flex items-center gap-0.5 shrink-0">
      {canPrev ? (
        <Link
          href={href(prev)}
          scroll={false}
          replace
          aria-label={ar ? "الشهر السابق" : "Previous month"}
          className="grid place-items-center w-8 h-9 rounded-full text-muted hover:text-foreground transition"
        >
          {/* **ولا اتّجاهَ مقسورٌ على سهمِ تنقّل** (D-801) */}
          <span aria-hidden>‹</span>
        </Link>
      ) : (
        /* **والسهمُ الغائبُ يبقى مكانُه** فلا يقفز الاسمُ عند الحدّ */
        <span aria-hidden className="w-8 h-9" />
      )}
      <span className="text-12 font-semibold whitespace-nowrap">
        {monthLabel(month, locale)}
      </span>
      {canNext ? (
        <Link
          href={href(next)}
          scroll={false}
          replace
          aria-label={ar ? "الشهر التالي" : "Next month"}
          className="grid place-items-center w-8 h-9 rounded-full text-muted hover:text-foreground transition"
        >
          <span aria-hidden>›</span>
        </Link>
      ) : (
        <span aria-hidden className="w-8 h-9" />
      )}
    </span>
  );

  const body = (
    <CalendarMonth
      days={days}
      byDay={byDay}
      locale={locale}
      todayLabelText={ar ? "اليوم" : "Today"}
    />
  );

  return (
    <div>
      <SettingsHeader
        title={t.calTitle}
        badge={plus ? <PlusPill /> : undefined}
        fallbackHref="/"
        action={monthNav}
      />

      <div className="mt-2">
        <p className="text-12 text-muted mb-4" dir="auto">
          {t.calSub}{" "}
          {/* ⚠️ **وسقفُ معرفتنا مكتوبٌ في الصفحة لا في تعليقٍ وحدَه**
              (D-063): **شهرٌ شبهُ فارغٍ يُقرأ عطلاً ما لم يُقل سببُه.** */}
          <span className="opacity-80">{t.calHorizon}</span>
        </p>

        {locked ? <PlusPreview locale={locale} locked={body} /> : body}
      </div>
    </div>
  );
}
