import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { searchMulti, searchPeople, titleOf, yearOf, posterUrl, profileUrl } from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { roleName } from "@/core/i18n";
import { allow, retryAfter } from "@/core/ratelimit";

// اقتراحات البحث الفورية — يبقى مفتاح TMDB على الخادم
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

  // بحث حيّ مع كل ضغطة زر — الحدّ يمنع حلقة طلبات من استنزاف حصة TMDB
  const key = `suggest:${user.id}`;
  if (!allow(key, 40, 60_000)) {
    return NextResponse.json(
      { results: [] },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  /* حرفان لا ثلاثة — كبحث الأشخاص: الحدّ الثلاثيّ كان يجعل «٢٤» و«IT»
     و«لو» غير قابلة للإيجاد أصلاً، لا بطيئةً بل مستحيلة. */
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    /* الأشخاص والأعمال معاً — كصفحة البحث: `searchMulti` يُسقط الأشخاص،
       فاسم ممثلٍ كان يعيد «لا نتائج» في الورقة بينما تجده الصفحة.
       **الأعمال أوّلاً** (طلب أحمد بفيديو «godf»: كانت خمسة أشخاص تدفن
       العراب تحتها — من يكتب اسم عملٍ أكثر ممن يكتب اسم ممثل، والممثل
       يبقى ظاهراً تحت الأعمال مباشرة). */
    const [titles, people] = await Promise.all([searchMulti(q), searchPeople(q, 6)]);
    const { t } = await getT();

    const peopleItems = people.map((p) => ({
      kind: "person" as const,
      id: p.id,
      title: p.name,
      poster: profileUrl(p.profile_path, "w185"),
      /* تحت اسم الشخص مهنتُه وحدها — «ممثل» أو «مخرج» (طلب أحمد): قائمة
         «أشهر أعماله» كانت تجعل صفّ الشخص يُقرأ كأنه صفّ عمل */
      subtitle: roleName(p.known_for_department, t),
    }));

    const titleItems = titles.slice(0, 9).map((r) => ({
      kind: r.media_type,
      id: r.id,
      title: titleOf(r),
      year: yearOf(r),
      poster: posterUrl(r.poster_path, "w185"),
      /* المسار الخام إلى جانب الرابط الجاهز (D-167): من يعرض الصفّ يريد
         رابطاً، ومن يضيفه إلى قائمة يريد المسار — `safeImagePath` في
         `actions.ts` ترفض الرابط الكامل فيُخزَّن الملصق فارغاً بدونه. */
      poster_path: r.poster_path ?? null,
      rating: r.vote_average ? Number(r.vote_average.toFixed(1)) : null,
    }));

    // سقفٌ ١٢: تسعة أعمال كحدٍّ أقصى والأشخاص يكمّلون الباقي —
    // وحين تشحّ الأعمال (اسمٌ لا يطابق إلا أشخاصاً) يملؤون المكان
    const results = [...titleItems, ...peopleItems].slice(0, 12);
    /* دقيقةٌ في متصفّح السائل وحده (سابقة `api/season`): من يمسح حرفاً
       ويعيد كتابته كان يدفع الرحلةَ كلَّها من جديد لسؤالٍ أُجيب للتوّ —
       و`private` لأن النتائج بلغة صاحب الكوكي. */
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch {
    return NextResponse.json({ results: [] });
  }
}
