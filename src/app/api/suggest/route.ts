import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { searchMulti, searchPeople, titleOf, yearOf, posterUrl, profileUrl } from "@/lib/tmdb";
import { allow, retryAfter } from "@/lib/ratelimit";

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
       فاسم ممثلٍ كان يعيد «لا نتائج» في الورقة بينما تجده الصفحة. طلبان
       متوازيان، والأشخاص أوّلاً لأن من كتب اسم ممثلٍ يريده هو، ومن كتب
       اسم عملٍ لا يعيد بحث الأشخاص شيئاً فلا يزاحمه. */
    const [titles, people] = await Promise.all([searchMulti(q), searchPeople(q, 6)]);

    const peopleItems = people.map((p) => ({
      kind: "person" as const,
      id: p.id,
      title: p.name,
      poster: profileUrl(p.profile_path, "w185"),
      subtitle: (p.known_for ?? [])
        .slice(0, 2)
        .map((k) => titleOf(k))
        .join(" · "),
    }));

    const titleItems = titles.slice(0, 10).map((r) => ({
      kind: r.media_type,
      id: r.id,
      title: titleOf(r),
      year: yearOf(r),
      poster: posterUrl(r.poster_path, "w185"),
      rating: r.vote_average ? Number(r.vote_average.toFixed(1)) : null,
    }));

    // سقفٌ ١٢ يترك مجالاً لخمسة اقتراحاتٍ فأكثر دائماً حين توجد
    const results = [...peopleItems, ...titleItems].slice(0, 12);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
