import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { allow, retryAfter } from "@/lib/ratelimit";
import { runNewsSlice } from "@/lib/loopzNews";
import { runReportSlice } from "@/lib/newsReports";
import { NEWS_SOURCES, probeSources } from "@/lib/news";

/** ستّةٌ وعشرون عملاً × نداءين — والدفعةُ تنتهي في ثوانٍ */
export const maxDuration = 60;

/**
 * دورةُ رصدٍ يدوية — **بابُ الفحص، لا محرّكُ الميزة** (D-211).
 *
 * المحرّكُ هو `after()` في تبويب الأخبار (التجديدُ بحركة المرور، اختيارُ
 * أحمد)، **وهذا المسار يجعل الدورةَ قابلةً للاستدعاء والقياس** — وهو ما
 * كشف أعطالَ المطابقة في D-210 قبل أن يراها مستخدم.
 *
 * والحارسُ هو حارسُ `‎/api/imdb-chart` نفسُه: جلسةٌ + حدُّ معدّل،
 * **ولا سرَّ جديداً**. ولا شيءَ من جسم الطلب يدخل القاعدة: المعرّفاتُ
 * تأتي من `news_watch_slice` في القاعدة، والحقائقُ من TMDB.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const key = `newsgen:${user.id}`;
  if (!allow(key, 6, 60_000)) {
    return NextResponse.json(
      { error: "rate" },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(60, Number(url.searchParams.get("limit") ?? 26) | 0));

  /* **الفاحصُ انتقل إلى هنا** (D-214): مسارُ الأخبار المجمَّعة حُذف بطلب
     أحمد، **لكنّ فحصَ الفيدات بقي لأن `report` يقرأ من الفيدات نفسِها** —
     وهو ما يكشف موتَ مصدرٍ قبل أن يظهر بصمتٍ في صفر مطابقات. */
  if (url.searchParams.get("probe") === "1") {
    const results = await probeSources(NEWS_SOURCES.filter((s) => s.enabled));
    return NextResponse.json({
      mode: "probe",
      wrote: 0,
      ok: results.filter((x) => x.ok).length,
      of: results.length,
      results,
    });
  }

  const t0 = Date.now();
  const r = await runNewsSlice(limit);
  /* دفعةُ الصحافة في نفس الدورة — **وسقوطُها لا يُسقط رصدَ البيانات** */
  const rep = await runReportSlice().catch(() => ({ found: 0, saved: 0 }));
  return NextResponse.json({
    ...r,
    reportsFound: rep.found,
    reportsSaved: rep.saved,
    secs: Math.round((Date.now() - t0) / 100) / 10,
  });
}
