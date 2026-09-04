import { NextResponse } from "next/server";
import { getUser, getCuratedListIds } from "@/lib/data";
import { allow, retryAfter } from "@/core/ratelimit";
import { buildCuratedList } from "@/lib/actions";
import { allCuratedSets } from "@/core/universes";

/** جائزةٌ بثمانيةٍ وتسعين فائزاً تعني ثمانيةً وتسعين نداءَ TMDB */
export const maxDuration = 60;

/**
 * **توليدُ المجموعات المنسّقة قوائمَ حقيقية** — بابُ التشغيل لا محرّكُ
 * الميزة (D-329، ذيلُ D-328).
 *
 * ================= لماذا مسارٌ أصلاً والفعلُ موجود =================
 *
 * **`buildCuratedList` فعلُ خادمٍ مكتوبٌ منذ D-328** — **ولا زرَّ يستدعيه**:
 * قوائمُ لوبز محتوى المنتَج لا فعلٌ لمستخدم، **وزرٌّ إداريٌّ في واجهةٍ
 * يراها الجميع بابٌ يُفتح لحارسٍ واحد** (D-011). والتوليدُ يجري **مرّةً
 * عند الإطلاق ثم كلّما تغيّر القاموس** — فالمناسبُ له نداءٌ لا سطحٌ.
 *
 * ================= والحارسُ حارسُ `‎/api/imdb-chart` نفسُه =================
 *
 * جلسةٌ مسجَّلة + حدُّ معدّل، **ولا سرَّ جديداً في البيئة** (كلُّ سرٍّ
 * إضافيّ خطوةٌ يدوية تُنسى — نصُّ D-135 حرفاً). **والحارسُ الحقيقيُّ في
 * القاعدة**: `upsert_curated_list` ترفع `forbidden` لغير `am_admin()`
 * (D-314) — **فمسجَّلٌ عاديٌّ ينادي هذا الباب يأخذ خطأً لا صفّاً**،
 * والضررُ الأقصى نداءاتُ TMDB التي يقطعها حدُّ المعدّل.
 *
 * ================= وسْلَغٌ واحدٌ لكلِّ نداء =================
 *
 * **ثلاثةٌ وستّون مجموعةً في نداءٍ واحد لا تسع في مهلة وظيفةٍ بلا خادم**
 * — **فالمهمّةُ تُستأنف على دفعات** (D-135، وصفةُ `imdb-chart` نفسُها):
 * كلُّ نداءٍ يبني واحدة، **والمتصفّحُ يدور**. و`?list=1` يعطي الدورةَ
 * جدولَها: ما بُني وما بقي.
 *
 * الاستعمال (من تبويب loopztv مسجَّلٍ فيه بحساب الإدارة):
 *   const { pending } = await (await fetch('/api/curated?list=1')).json();
 *   for (const s of pending) await fetch(`/api/curated?slug=${s}`);
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const key = `curated:${user.id}`;
  if (!allow(key, 20, 60_000)) {
    return NextResponse.json(
      { error: "rate" },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const url = new URL(request.url);

  /* ===== الجدول: ما بُني وما بقي — قراءةٌ لا كتابة ===== */
  if (url.searchParams.get("list") === "1") {
    const built = await getCuratedListIds();
    const all = allCuratedSets().map((u) => u.slug);
    return NextResponse.json({
      total: all.length,
      done: all.filter((s) => built.has(s)),
      pending: all.filter((s) => !built.has(s)),
    });
  }

  const slug = (url.searchParams.get("slug") ?? "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "slug" }, { status: 400 });

  try {
    /* **والخطأُ يُعاد نصّاً لا يُبتلع**: مجموعةٌ يسقط مصدرُها تُقرأ في
       ردِّها، **ودورةٌ تمرّ صامتةً على فشلٍ هي كيف يُطلَق نصفُ محتوى**
       (D-063). */
    const out = await buildCuratedList(slug);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ slug, error: (e as Error).message }, { status: 500 });
  }
}
