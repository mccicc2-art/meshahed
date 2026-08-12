import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { allow, retryAfter } from "@/lib/ratelimit";
import { NEWS_SOURCES, probeSources, fetchFeed } from "@/lib/news";

/** عشرةُ فيدٍ خارجيّة في نداءٍ واحد — وأبطؤها يقرّر المهلة */
export const maxDuration = 60;

/**
 * الأخبار الحقيقية — **المرحلة الأولى: الفحص وحده** (D-209).
 *
 * **لماذا يُشحن الفحصُ قبل الجدول:** بحثُ ١٠ أغسطس جُلب من أداةٍ لا من
 * خادمنا، فردّت ديدلاين وفارايتي **٤٠٢** وردّت مصادرُ الأنمي كلُّها **٤٠٣
 * أو حمولةً غير مقروءة** — **والنمطُ يقول إن الحجب على الأداة لا أن الفيد
 * غائب.** وبناءُ جدولٍ وواجهةٍ على مصادرَ لا نعرف أيُّها يُجلب من Vercel
 * هو بناءُ نصفِ ميزةٍ ثم اكتشافُها بعد النشر — **وهو بالضبط درسُ الهجرة
 * ٦٠.** فالسؤالُ الذي لا يجيبه إلا الخادم يُسأل أوّلاً.
 *
 * **والحارسُ هو حارسُ `‎/api/imdb-chart` نفسُه، لا حارسٌ ثانٍ:** جلسةٌ
 * مسجَّلة + حدُّ معدّل، **ولا سرَّ جديداً في البيئة** (كلُّ سرٍّ إضافيّ
 * خطوةٌ يدوية تُنسى). والضررُ المحتمل هنا **أرخصُ ممّا هناك**: هذا المسار
 * **لا يكتب حرفاً في القاعدة** — يقرأ فيداً عامّاً ويصف ما رأى.
 *
 * الاستعمال من تبويب loopztv مسجَّلٍ فيه:
 *   await fetch('/api/news-ingest?probe=1').then(r => r.json())
 *   await fetch('/api/news-ingest?probe=1&src=ann').then(r => r.json())
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const key = `news:${user.id}`;
  if (!allow(key, 6, 60_000)) {
    return NextResponse.json(
      { error: "rate" },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const url = new URL(request.url);
  const only = url.searchParams.get("src");
  const sources = only ? NEWS_SOURCES.filter((s) => s.slug === only) : NEWS_SOURCES;
  if (!sources.length) {
    return NextResponse.json(
      { error: "unknown source", known: NEWS_SOURCES.map((s) => s.slug) },
      { status: 400 },
    );
  }

  /* عيّنةٌ كاملة من مصدرٍ واحد: الفحصُ العامّ يعطي ثلاثة عناوين لكلٍّ،
     وهذا يعطي العشرين بأسرها حين نريد قياسَ «كم عنواناً يسمّي عملاً» */
  if (only && url.searchParams.get("full") === "1") {
    const r = await fetchFeed(sources[0], 20);
    return NextResponse.json({ slug: sources[0].slug, ...r });
  }

  const t0 = Date.now();
  const results = await probeSources(sources);
  return NextResponse.json({
    /* الكتابةُ ليست هنا بعد — **يُقال بالاسم** كي لا يُقرأ الردّ الناجح
       على أنه ابتلاعٌ جرى */
    mode: "probe",
    wrote: 0,
    secs: Math.round((Date.now() - t0) / 100) / 10,
    ok: results.filter((r) => r.ok).length,
    of: results.length,
    results,
  });
}
