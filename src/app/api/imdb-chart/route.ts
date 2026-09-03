import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/service";
import { allow, retryAfter } from "@/lib/ratelimit";
import {
  CANDIDATE_POOL,
  RESOLVE_BATCH,
  fetchCandidates,
  resolveOne,
  saveResolved,
} from "@/lib/imdbChart";

/** الوظيفة تحتاج وقتاً: تنزيلٌ وبثٌّ ثم مئتان وخمسون نداءَ TMDB */
export const maxDuration = 60;

/**
 * بناء قائمة IMDb الحقيقية — **مَهمّةٌ تُستأنف على دفعات** (D-135).
 *
 * لا تُبنى في نداءٍ واحد: ألفٌ وخمسمئة نداءِ TMDB لا تسع في مهلة وظيفةٍ
 * بلا خادم. فكلّ نداءٍ يحلّ شريحةً (`part`) ويكتبها في المسوّدة، والنداء
 * الأخير (`step=build`) يرتّب المسوّدة ويثبّتها في `imdb_chart` دفعةً
 * واحدة — فلا تُرى القائمة نصف ممتلئة.
 *
 * **الحارس، وحدوده بصدق:** جلسةٌ مسجَّلة + حدُّ معدّل. لا سرَّ جديداً في
 * البيئة (قرارٌ مقصود: كل سرٍّ إضافيّ خطوةٌ يدوية تُنسى). وهذا يعني أن أيّ
 * مستخدمٍ مسجَّل يستطيع تشغيلها — والضرر المحتمل **كلفةُ نداءات لا فسادُ
 * بيانات**: المحتوى كلّه من IMDb وTMDB، ولا شيء من جسم الطلب يدخل القاعدة.
 * حدُّ ثلاثة نداءاتٍ في الدقيقة يكفي لتقييد الكلفة.
 *
 * الاستعمال (من تبويب loopztv مسجَّلٍ فيه):
 *   for (let p = 0; p < 6; p++) await fetch(`/api/imdb-chart?part=${p}`);
 *   await fetch('/api/imdb-chart?step=build');
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const key = `imdbchart:${user.id}`;
  if (!allow(key, 3, 60_000)) {
    return NextResponse.json(
      { error: "rate" },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const url = new URL(request.url);
  const step = url.searchParams.get("step");

  // ===== التثبيت: المسوّدة تصير قائمةً مرتّبة =====
  if (step === "build") {
    try {
      // البناءُ بعميل الخدمة (D-898): الحارسُ جلسةٌ + حدُّ معدّل أعلاه، والدالّةُ لن تبقى ممنوحةً للمسجَّلين
      const supabase = await createServiceClient();
      const { data, error } = await supabase.rpc("build_imdb_chart", { p_limit: 250 });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ built: data });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  // ===== الحلّ: شريحةٌ من المرشّحين =====
  const part = Math.max(0, Number(url.searchParams.get("part") ?? 0) | 0);
  const parts = Math.ceil(CANDIDATE_POOL / RESOLVE_BATCH);
  if (part >= parts) {
    return NextResponse.json({ done: true, parts });
  }

  const t0 = Date.now();
  let candidates;
  try {
    candidates = await fetchCandidates();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const slice = candidates.slice(part * RESOLVE_BATCH, (part + 1) * RESOLVE_BATCH);

  /* خمسةٌ وعشرون متوازيةً: TMDB يتحمّلها، وأكثرُ منها يرفع خطرَ الخنق
     دون أن يقصّر الزمن كثيراً — الخانق هنا زمنُ الرحلة لا المعالجة */
  const CHUNK = 25;
  const resolved = [];
  for (let i = 0; i < slice.length; i += CHUNK) {
    const got = await Promise.all(slice.slice(i, i + CHUNK).map(resolveOne));
    for (const r of got) if (r) resolved.push(r);
  }

  const saved = await saveResolved(resolved);

  return NextResponse.json({
    part,
    parts,
    candidates: candidates.length,
    tried: slice.length,
    /* الفارق بين `tried` و`resolved` ليس عطلاً: حلقاتُ المسلسلات وما لا
       ملصق له وما لا تعرفه TMDB كلّها تسقط هنا عمداً */
    resolved: resolved.length,
    saved,
    secs: Math.round((Date.now() - t0) / 100) / 10,
    next: part + 1 < parts ? `/api/imdb-chart?part=${part + 1}` : "/api/imdb-chart?step=build",
  });
}
