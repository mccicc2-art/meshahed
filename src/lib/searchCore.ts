import "server-only";
import { searchPeople as searchMembers, searchPublicLists } from "@/lib/data";
import { searchMulti, searchPeople, yearOf, getTv, getMovie } from "@/lib/tmdb";
import { resolveTmdbTitle } from "@/core/media";
import { posterUrl, profileUrl } from "@/core/media";
import { getT, getTitleMode } from "@/lib/locale";
import { roleName } from "@/core/i18n";
import { curatedName } from "@/core/universes";
import { getTranslits, searchTranslits } from "@/lib/titleAliases";
import { needsTranslit } from "@/core/titleMode";
import type { SearchPayload, SearchScope } from "@/core/searchTypes";

/**
 * ====== نواةُ البحث — منطقٌ واحدٌ لبابين (Phase 11-G · G0) ======
 *
 * 🔑 **لماذا خرج من `api/search/route.ts`**: صار للبحث قارئان — صفحةُ الويب
 * تقرأ `/api/search` عارياً كما كانت، **والتطبيقُ الأصليّ يقرأ `/api/v1/search`
 * بغلاف `{data}`** كبقيّة شاشاته. ونسختان من خلّاط الكتابة الصوتيّة وسقوفِ
 * الأقسام تفترقان في صمت (القاعدة ٦)؛ **فالمنطقُ هنا مرّةً، والمساران غلافان**.
 * لا حرفَ تغيّر في السلوك: السقوفُ والترتيبُ و`more` كما كانت (D-534 · D-710 · D-544).
 */

/** رؤوسُ الأقسام في «الكل» — ثلاثةُ صفوفٍ لكلٍّ (تصميمُ أحمد) */
export const PEEK = 3;
/** والأعمالُ عشرةٌ لا ثلاثة (D-710، بلاغُ أحمد: «١٠ نتائج أقل شي») */
export const PEEK_TITLES = 10;
/** والسقفُ حين تُختار الرقاقة — قائمةٌ تُمرَّر لا معاينة */
export const FULL = 24;
/** حرفان لا ثلاثة — «IT» و«٢٤» و«لو» أعمالٌ حقيقيّة (سابقةُ `suggest`) */
export const MIN_QUERY = 2;

export function asScope(raw: string | null | undefined): SearchScope {
  return raw === "titles" || raw === "artists" || raw === "members" || raw === "lists" ? raw : "all";
}

export function emptySearch(): SearchPayload {
  return {
    titles: [],
    artists: [],
    members: [],
    lists: [],
    more: { titles: false, artists: false, members: false, lists: false },
  };
}

/**
 * البحثُ الواحدُ للأنواع الأربعة. **النطاقُ يقرّر ما يُطلب لا ما يُعرض** (D-510):
 * «الكل» يجلب رؤوسَ الأقسام، ورقاقةٌ بعينها تجلب قسمَها وحدَه بسقفٍ أوسع.
 * لا يرمي: أيُّ فشلٍ خارجيٍّ يعود ردّاً فارغاً (كما كان المسارُ يفعل).
 */
export async function runSearch(rawQ: string, scope: SearchScope): Promise<SearchPayload> {
  const q = rawQ.trim();
  if (q.length < MIN_QUERY) return emptySearch();

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

    /* البحثُ يعرف الأسماءَ الثلاثةَ مهما كان وضعُ العرض (D-544): TMDB يطابق الأصليَّ
       والمترجَم، **والكتابةُ الصوتيّةُ عندنا** — وما وجدَته يُثبَّت بـTMDB ويُقدَّم. */
    const wantTitles = want("titles");
    const extra = wantTitles ? await byTranslit(q, wantTitles) : [];
    const known = new Set(titles.map((r) => `${r.media_type}-${r.id}`));
    const merged = [...extra.filter((r) => !known.has(`${r.media_type}-${r.id}`)), ...titles];

    const shown = merged.slice(0, wantTitles);
    const translits = needsTranslit(mode)
      ? await getTranslits(
          shown.map((r) => ({ tmdb_id: r.id, media_type: r.media_type === "tv" ? "tv" : "movie" })),
        )
      : new Map<string, string>();

    return {
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
          posterPath: r.poster_path ?? null,
        };
      }),
      artists: artists.slice(0, want("artists")).map((p) => ({
        id: p.id,
        name: p.name,
        role: roleName(p.known_for_department, t),
        photo: profileUrl(p.profile_path ?? null, "w185"),
      })),
      /* من أخفى اسمه يمرّ كما هو — `PersonName` وحدَها تقرّر (D-011/D-193) */
      members: members.slice(0, want("members")),
      lists: lists.slice(0, want("lists")).map((l) => ({
        id: l.id,
        name: curatedName(l.source_slug, l.name, locale === "en" ? "en" : "ar"),
        count: l.item_count,
        poster: posterUrl(l.posters?.[0] ?? null, "w185"),
      })),
      more: {
        titles: merged.length > want("titles"),
        artists: artists.length > want("artists"),
        members: members.length > want("members"),
        lists: lists.length > want("lists"),
      },
    };
  } catch {
    return emptySearch();
  }
}

/** أعمالُ الكتابة الصوتيّة مثبَّتةً بـTMDB — بشكل نتيجة البحث نفسِه (D-145). */
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
