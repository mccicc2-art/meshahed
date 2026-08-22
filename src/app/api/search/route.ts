import { NextResponse } from "next/server";
import { getUser, searchPeople as searchMembers, searchPublicLists } from "@/lib/data";
import { searchMulti, searchPeople, titleOf, yearOf } from "@/lib/tmdb";
import { posterUrl, profileUrl } from "@/lib/media";
import { getT } from "@/lib/locale";
import { roleName } from "@/lib/i18n";
import { curatedName } from "@/lib/universes";
import { allow, retryAfter } from "@/lib/ratelimit";
import type { SearchPayload, SearchScope } from "@/lib/searchTypes";

/**
 * **بحثٌ واحدٌ لأربعة أنواع** (D-534) — نداءٌ واحدٌ لصفحة البحث الجديدة.
 *
 * **ولماذا لم يُوسَّع `/api/suggest`:** ذاك يخدم قائمةَ الاقتراحات تحت
 * حقلٍ في شريطٍ علويّ — **صفٌّ واحدٌ مسطَّحٌ بسقف اثني عشر** — **وهذا
 * يعيد أربعةَ أقسامٍ بمفاتيحها.** **وشكلا ردٍّ مختلفان في مسارٍ واحدٍ
 * علَمٌ يقلب الردَّ كلَّه، وهو ما تمنعه القاعدة ٦.** ويبقى `suggest`
 * لقارئه القديم (شريطُ سطح المكتب) بلا حرفٍ يتغيّر.
 *
 * **والنطاقُ يقرّر ما يُطلب لا ما يُعرض** (D-510: لا يدفع أحدٌ كلفةَ ما
 * لن يراه): «الكل» يجلب رؤوسَ الأقسام الأربعة، **ورقاقةٌ بعينها تجلب
 * قسمَها وحدَه بسقفٍ أوسع** — فلا نداءَ TMDB لفنّانين وأنت في «أعضاء».
 */

/** رؤوسُ الأقسام في «الكل» — ثلاثةُ صفوفٍ لكلٍّ (تصميمُ أحمد) */
const PEEK = 3;
/** والسقفُ حين تُختار الرقاقة — قائمةٌ تُمرَّر لا معاينة */
const FULL = 24;

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json(empty(), { status: 401 });

  /* بحثٌ حيٌّ مع كلِّ ضغطةِ زرّ — والحدُّ حدُّ `suggest` نفسُه */
  const key = `search:${user.id}`;
  if (!allow(key, 40, 60_000)) {
    return NextResponse.json(empty(), {
      status: 429,
      headers: { "Retry-After": String(retryAfter(key)) },
    });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  /* حرفان لا ثلاثة — «IT» و«٢٤» و«لو» أعمالٌ حقيقيّة (سابقةُ `suggest`) */
  if (q.length < 2) return NextResponse.json(empty());

  const scope = asScope(url.searchParams.get("type"));
  const want = (s: SearchScope) => (scope === "all" ? PEEK : scope === s ? FULL : 0);
  const { locale, t } = await getT();

  try {
    const [titles, artists, members, lists] = await Promise.all([
      want("titles") ? searchMulti(q).catch(() => []) : [],
      want("artists") ? searchPeople(q, want("artists")).catch(() => []) : [],
      want("members") ? searchMembers(q).catch(() => []) : [],
      want("lists") ? searchPublicLists(q, want("lists")).catch(() => []) : [],
    ]);

    const payload: SearchPayload = {
      titles: titles.slice(0, want("titles")).map((r) => ({
        id: r.id,
        mediaType: r.media_type === "tv" ? "tv" : "movie",
        title: titleOf(r),
        year: yearOf(r) ?? null,
        poster: posterUrl(r.poster_path ?? null, "w185"),
      })),
      artists: artists.slice(0, want("artists")).map((p) => ({
        id: p.id,
        name: p.name,
        role: roleName(p.known_for_department, t),
        photo: profileUrl(p.profile_path ?? null, "w185"),
      })),
      /* **ومن أخفى اسمه يمرّ كما هو** — `PersonName` وحدَها تقرّر ما
         يُعرض وما يُفتح (D-011/D-193)، **ولا قاعدةَ ثانيةً للإخفاء هنا.** */
      members: members.slice(0, want("members")),
      lists: lists.slice(0, want("lists")).map((l) => ({
        id: l.id,
        /* **وكلُّ اسمِ قائمةٍ يُعرض يمرّ بـ`curatedName`** (D-063/D-427) */
        name: curatedName(l.source_slug, l.name, locale === "en" ? "en" : "ar"),
        count: l.item_count,
        poster: posterUrl(l.posters?.[0] ?? null, "w185"),
      })),
      /* **والأعدادُ تقول «هل من مزيد؟»** — بها يُرسم «عرض الكل» ولا
         يُرسم فوق قسمٍ لا شيءَ خلفه (D-222: الصفرُ لا يُرسم). */
      more: {
        titles: titles.length > want("titles"),
        artists: artists.length > want("artists"),
        members: members.length > want("members"),
        lists: lists.length > want("lists"),
      },
    };

    /* دقيقةٌ في متصفّح السائل وحدَه (سابقةُ `suggest`) — و`private`
       لأن النتائج بلغة صاحب الكوكي وفيها قوائمُ لا يراها غيرُه. */
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return NextResponse.json(empty());
  }
}

function asScope(raw: string | null): SearchScope {
  return raw === "titles" || raw === "artists" || raw === "members" || raw === "lists"
    ? raw
    : "all";
}

function empty(): SearchPayload {
  return {
    titles: [],
    artists: [],
    members: [],
    lists: [],
    more: { titles: false, artists: false, members: false, lists: false },
  };
}
