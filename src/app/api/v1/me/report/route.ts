import type { NextRequest } from "next/server";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale } from "@/lib/locale";
import { getProfile } from "@/lib/data";
import { isPlus } from "@/core/plan";
import { asTimeZone } from "@/core/zone";
import { asOffset, buildPeriodStats, type StatsPeriod } from "@/lib/periodStats";
import type { MyReportPayload } from "@/core/contracts/report";

/**
 * `GET /api/v1/me/report?p=week|month|year|all&o=<إزاحة>` — **إحصاءاتُ مدّةٍ بعينها** (🆕 D-1366 · Phase 11-V · V-C · C5، قرارُ
 * أحمد ١١ أكتوبر بعد صورتين: «اعتمده» ثمّ «نفذ وارفع»). كان «تقريرك» صفحةَ ويبٍ خلف صفّ «تقاريرك» في شاشة الإحصائيات.
 *
 * 🔑 **الحسابُ حسابُ الصفحتين نفسُه**: `buildPeriodStats` بتقويم القارئ (D-806) ولغته — **مسارٌ واحدٌ لشاشتين**: «تقريرك»
 * (ثلاثُ مدد، بلا إزاحة) و«الإحصائيات الكاملة» (أربعٌ، وسهمان يتنقّلان بالإزاحة). لا حسابَ ثانياً ولا رقمَ يختلف عن الويب.
 *  - **الشهرُ افتراضُ هذا المسار** كما هو افتراضُ صفحة التقرير (D-805)؛ و`asOffset` يقصّ الإزاحةَ كما تقصّها الصفحة.
 *  - ⚖️ **القفلُ قفلُ عرض** (`plus` علمٌ يعود مع الأرقام): الصفحةُ ترسم لغير المشترك ما تحت الضباب في مستنده أيضاً (D-809)،
 *    والأرقامُ أرقامُ صاحبها — فالمسارُ لا يحجب ما لا تحجبه الصفحة. قراءةٌ لصاحبها وحدَه: لا معرّفَ في الطلب.
 */
const PERIODS: readonly StatsPeriod[] = ["week", "month", "year", "all"];

export async function GET(req: NextRequest) {
  return handle<MyReportPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:my-report:${auth.user.id}`, 40, 60_000);
    if (lim) return lim;

    const sp = req.nextUrl.searchParams;
    const raw = sp.get("p");
    const period = PERIODS.find((p) => p === raw) ?? "month";
    const offset = period === "all" ? 0 : asOffset(sp.get("o"));
    const [locale, profile] = await Promise.all([getLocale(), getProfile().catch(() => null)]);
    const s = await buildPeriodStats(period, offset, locale, asTimeZone(profile?.timezone));
    return ok({
      plus: isPlus(profile),
      stats: { ...s, range: { label: s.range.label, days: s.range.days, can_go_next: s.range.canGoNext } },
    });
  });
}
