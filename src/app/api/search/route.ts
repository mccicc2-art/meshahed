import { NextResponse } from "next/server";
import { getUser, searchPeople as searchMembers, searchPublicLists } from "@/lib/data";
import { searchMulti, searchPeople, yearOf, getTv, getMovie } from "@/lib/tmdb";
import { resolveTmdbTitle } from "@/core/media";
import { posterUrl, profileUrl } from "@/core/media";
import { getT, getTitleMode } from "@/lib/locale";
import { roleName } from "@/core/i18n";
import { curatedName } from "@/core/universes";
import { allow, retryAfter } from "@/core/ratelimit";
import { getTranslits, searchTranslits } from "@/lib/titleAliases";
import { needsTranslit } from "@/core/titleMode";
import type { SearchPayload, SearchScope } from "@/core/searchTypes";

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
/**
 * 🆕 **والأعمالُ عشرةٌ لا ثلاثة** (D-710، بلاغُ أحمد: «إذا بحثت خليه
 * يظهر لي ١٠ نتائج أقل شي»).
 *
 * **والأقسامُ الثلاثةُ الأخرى تبقى على ثلاثة** — **لأن الأقسامَ الأربعةَ
 * ليست متساويةَ الاحتمال**: من كتب اسماً في Loopz يقصد عملاً في تسعٍ
 * من عشر، **وثلاثةُ صفوفٍ لأشهرِ ما يُبحث عنه معاينةٌ تُجبر القارئَ على
 * ضغطةٍ ثانية** لِما جاء لأجله وحدَه. **والفنّانون والأعضاءُ والقوائم
 * رؤوسٌ تقول «وهنا أيضاً» فيكفيها ثلاثة.**
 *
 * ⚠️ **ولا كلفةَ شبكةٍ زائدة**: نداءُ TMDB الواحد يعيد عشرين صفّاً
 * أصلاً — **القصُّ كان عندنا لا عنده** (D-510: لا يُطلب ما لا يُعرض،
 * **وقد كان يُطلب فعلاً**).
 */
const PEEK_TITLES = 10;
/** والسقفُ حين تُختار الرقاقة — قائمةٌ تُمرَّر لا معاينة */
const FULL = 24;

export async function GET(request: Request) {
  /* 🆕 **البحثُ مفتوحٌ للزائر** (D-627): كان 401 — والنتائجُ كلُّها
     كتالوجٌ وملفّاتٌ عامّة، فلا سرَّ يحرسه الرفض. **والحدُّ للزائر
     بعنوانه** (أوّلُ `x-forwarded-for` — ما يثبّته Vercel) بدل معرّفِ
     مستخدمٍ لا يملكه، فلا يتقاسم الزوّارُ كلُّهم سلّةً واحدة. */
  const user = await getUser();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  /* بحثٌ حيٌّ مع كلِّ ضغطةِ زرّ — والحدُّ حدُّ `suggest` نفسُه */
  const key = `search:${user?.id ?? ip}`;
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
  const want = (s: SearchScope) =>
    scope === "all" ? (s === "titles" ? PEEK_TITLES : PEEK) : scope === s ? FULL : 0;
  const { locale, t } = await getT();
  const mode = await getTitleMode();

  try {
    const [titles, artists, members, lists] = await Promise.all([
      want("titles") ? searchMulti(q).catch(() => []) : [],
      want("artists") ? searchPeople(q, want("artists")).catch(() => []) : [],
      want("members") ? searchMembers(q).catch(() => []) : [],
      want("lists") ? searchPublicLists(q, want("lists")).catch(() => []) : [],
    ]);

    /* ===== 🆕 البحثُ يعرف الأسماءَ الثلاثةَ مهما كان وضعُ العرض (D-544)
       =====

       **بنصِّ المواصفة: «اجعل البحث يتعرّف على الاسم المحلّي والأصلي
       والكتابة الصوتيّة مهما كان خيار العرض».**

       **والاثنان الأوّلان مجّانيّان**: بحثُ TMDB نفسُه يطابق الاسمَ
       الأصليَّ والمترجَم معاً — **وهو ما جعل «Game of Thrones» تجد
       «صراع العروش» قبل هذه الميزة.** **والذي لا يعرفه أحدٌ هو الكتابةُ
       الصوتيّة** («جيم أوف ثرونز»)، **فتُسأل قاعدتُنا عنها.**

       ⚠️ **ولا يُسأل إلّا حين يُحتمل الجواب**: الطلبُ لا يحمل حرفاً
       عربيّاً؟ **لا كتابةَ صوتيّةً تطابقه أصلاً** (D-510). **وحين
       يُسأل فاستعلامٌ واحدٌ لا استعلامٌ لكلِّ نتيجة.** */
    const wantTitles = want("titles");
    /* **وما وجدَته الكتابةُ الصوتيّةُ يُثبَّت بـTMDB قبل أن يُعرض**
       (سابقةُ `ai.ts`: النموذجُ يقترح وTMDB هو الحقيقة) — **فلا يُبنى
       رابطٌ على صفٍّ في جدولنا وحدَه.** **ويُقدَّم على نتائج TMDB**:
       من كتب «جيم أوف ثرونز» يقصد هذا العمل بعينه. */
    const extra = wantTitles ? await byTranslit(q, wantTitles) : [];
    const known = new Set(titles.map((r) => `${r.media_type}-${r.id}`));
    const merged = [
      ...extra.filter((r) => !known.has(`${r.media_type}-${r.id}`)),
      ...titles,
    ];

    /* **وخريطةُ الكتابات الصوتيّة للعرض** — نداءٌ واحدٌ مجمَّعٌ للنتائج
       كلِّها، **ولا يُنادى إلّا في وضع الكتابة الصوتيّة.** */
    const shown = merged.slice(0, wantTitles);
    const translits = needsTranslit(mode)
      ? await getTranslits(
          shown.map((r) => ({ tmdb_id: r.id, media_type: r.media_type === "tv" ? "tv" : "movie" })),
        )
      : new Map<string, string>();

    const payload: SearchPayload = {
      titles: shown.map((r) => {
        const mediaType = r.media_type === "tv" ? "tv" : "movie";
        const name = resolveTmdbTitle(r, mode, translits.get(`${mediaType}-${r.id}`) ?? null);
        return {
          id: r.id,
          mediaType,
          title: name.primary,
          titleSecondary: name.secondary,
          year: yearOf(r) ?? null,
          poster: posterUrl(r.poster_path ?? null, "w185"),
        };
      }),
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
        titles: merged.length > want("titles"),
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

/**
 * **أعمالُ الكتابة الصوتيّة، مثبَّتةً بـTMDB** — تُعاد بنفس شكل نتيجة
 * البحث كي تدخل الخلّاط بلا فرعٍ ثانٍ في الرسم (D-145).
 */
async function byTranslit(q: string, limit: number) {
  const hits = await searchTranslits(q, limit).catch(() => []);
  if (!hits.length) return [];
  const rows = await Promise.all(
    hits.map(async (h) => {
      try {
        const d = (await (h.media_type === "tv" ? getTv(h.tmdb_id) : getMovie(h.tmdb_id))) as {
          name?: string;
          title?: string;
          original_name?: string;
          original_title?: string;
          poster_path?: string | null;
          first_air_date?: string | null;
          release_date?: string | null;
        };
        return { ...d, id: h.tmdb_id, media_type: h.media_type };
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((r): r is NonNullable<typeof r> => r !== null);
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
