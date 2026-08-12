import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { allow, retryAfter } from "@/lib/ratelimit";
import { NEWS_SOURCES, probeSources, fetchFeed, collectNews } from "@/lib/news";

/** عشرةُ فيدٍ خارجيّة ثم ستّون نداءَ TMDB — وأبطؤها يقرّر المهلة */
export const maxDuration = 60;

/**
 * الأخبار الحقيقية — الفحصُ والابتلاع (D-209).
 *
 * **الحارسُ هو حارسُ `‎/api/imdb-chart` نفسُه، لا حارسٌ ثانٍ:** جلسةٌ
 * مسجَّلة + حدُّ معدّل، **ولا سرَّ جديداً في البيئة** (كلُّ سرٍّ إضافيّ
 * خطوةٌ يدوية تُنسى).
 *
 * **ولا يُوثَق بجسم الطلب أصلاً:** لا شيءَ من الطلب يصير خبراً — المصادرُ
 * من سجلٍّ في الشيفرة، **والقاعدةُ تعيد التحقّق منها بنفسها**
 * (`set_news_items` ترفض كلَّ نطاقٍ خارج القائمة البيضاء وكلَّ مصدرٍ خارج
 * السجلّ، وتفرض سقفاً وبرودةَ خمس دقائق، ولا تعيد كتابةَ خبرٍ موجود).
 *
 * وضعان:
 *   `?probe=1` — يقرأ ويصف ولا يكتب. **يبقى** لأنه ما يكشف موتَ مصدرٍ.
 *   بلا مُعامل — دفعةُ ابتلاعٍ كاملة.
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

  // ===== الفحص: يقرأ ولا يكتب =====
  if (url.searchParams.get("probe") === "1") {
    const sources = only ? NEWS_SOURCES.filter((s) => s.slug === only) : NEWS_SOURCES;
    if (!sources.length) {
      return NextResponse.json(
        { error: "unknown source", known: NEWS_SOURCES.map((s) => s.slug) },
        { status: 400 },
      );
    }
    if (only && url.searchParams.get("full") === "1") {
      const r = await fetchFeed(sources[0], 20);
      return NextResponse.json({ slug: sources[0].slug, ...r });
    }
    const t0 = Date.now();
    const results = await probeSources(sources);
    return NextResponse.json({
      mode: "probe",
      wrote: 0,
      secs: Math.round((Date.now() - t0) / 100) / 10,
      ok: results.filter((r) => r.ok).length,
      of: results.length,
      results,
    });
  }

  // ===== الابتلاع =====
  const t0 = Date.now();
  const rows = await collectNews();
  if (!rows.length) {
    return NextResponse.json({ mode: "ingest", collected: 0, wrote: 0, secs: 0 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_news_items", { p_rows: rows });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    mode: "ingest",
    collected: rows.length,
    /* «كم دخل» لا «كم أُرسل»: المكرّرُ يسقط في القاعدة بـ`on conflict`،
       **والصفرُ هنا يعني «لا جديد» أو «برودةُ الخمس دقائق»** لا عطلاً */
    wrote: Number(data ?? 0),
    matched: rows.filter((r) => r.tmdb_id).length,
    secs: Math.round((Date.now() - t0) / 100) / 10,
  });
}
