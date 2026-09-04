import "server-only";

import { eraRange, parseBrowse, seasonRange, type BrowseQuery } from "@/core/browse";
/* 🔑 **ومفرداتُ الشرط هي `FILTER_KEYS` بعينها** (D-816/D-818) — **ولا
   قائمةَ سماحٍ ثانيةً تُكتب من الذاكرة** (درسُ D-816 الذي كاد يُسقط
   كلَّ فلترٍ يُحفظ). */
import { FILTER_KEYS } from "@/core/savedFilters";
import { LIBRARY_RULE_KEYS, MY_RATING_MIN } from "@/core/smartListKeys";
import { isLibraryStatus } from "@/core/libraryStatus";
import { keywordId, companyId, ANIME_KEYWORD, type DiscoverFilter } from "@/lib/tmdb";
import type { SectionMedia } from "@/lib/sections";

/**
 * ========== القوائمُ الذكيّة — الشرطُ إلى استعلام (D-823) ==========
 *
 * **البندُ الثالثُ من خطّة الـ٢٤**، **وقواعدُه حُسمت في D-818 والهجرةِ
 * ١٦١**: **لا إضافةَ يدويّة · تُحسب عند الفتح · مصدرُها كتالوجُ Loopz.**
 *
 * 🔴 **وبناءُ الفلتر كان مكتوباً في صفحتين** — `‎/news` و
 * `‎/discover/[section]` — **وتعليقُ الثانية يقول بنصّه**: «ولو اختلف
 * حرفٌ لاختلفت الصفحةُ عن الصفّ الذي أتى منه القارئ». **وهذا قارئٌ
 * ثالث، فحانت لحظةُ الاستخراج** (D-376) — **والتحذيرُ المكتوبُ لا
 * يُترك ليصير عطلاً** (D-145: قاعدةٌ واحدةٌ في موضعٍ واحد).
 *
 * ⚠️ **ولا `season`/`studio` إلّا للأنمي** — **كما في الصفحة حرفاً**:
 * محورانِ لا معنى لهما خارج تبويبهما، **وتمريرُهما يصنع استعلاماً
 * يعود فارغاً بلا سبب.**
 */

/** حدُّ ما تعرضه القائمةُ الذكيّة — **جردٌ لا تصفّحٌ لا نهائيّ** */
export const SMART_LIST_LIMIT = 60;

/** مصادرُ الشرط — **وكلاهما مبنيٌّ منذ D-876** (كان `library` قيداً بلا قارئ من ١٦١) */
export type RuleSource = "catalog" | "library";

export function isRuleSource(v: unknown): v is RuleSource {
  return v === "catalog" || v === "library";
}

/**
 * **الشرطُ المخزَّن** — **مفاتيحُه مفاتيحُ الفلاتر بعينها** (D-816):
 * **ولغةُ شروطٍ ثانيةٌ تعني مطهِّرَين ومترجمَين يفترقان عند أوّل محور.**
 */
export type SmartRule = Record<string, string>;

/** قيمةُ معاملٍ — **نفسُ `VALUE_RE` في `savedFilters.ts` حرفاً** */
const VALUE_RE = /^[A-Za-z0-9,._-]{1,64}$/;

/**
 * قيمةُ العمود (أو أيُّ مجهول) إلى شرطٍ مضمون — **والفاسدُ يسقط صامتاً**.
 * **ويعود `null` للشرط الفارغ**: **قائمةٌ ذكيّةٌ بلا شرطٍ فارغةٌ إلى
 * الأبد** — **والقاعدةُ تمنعها، وهذا حارسُها في الشيفرة** (D-636).
 */
export function sanitizeRule(value: unknown, source: RuleSource = "catalog"): SmartRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const out: SmartRule = {};
  /* **بترتيبٍ ثابتٍ لا بترتيب وروده** — نفسُ حجّة `sanitizeQuery`.
     🆕 **والمفاتيحُ بمصدرها** (D-876): **الكتالوجُ `FILTER_KEYS`، والمكتبةُ
     `LIBRARY_RULE_KEYS`** — **ومفتاحٌ من غير مصدره يسقط صامتاً** (D-475).
     **ومطهِّرٌ واحدٌ لا اثنان**: **الفرقُ قائمةُ سماحٍ لا لغةٌ ثانية.** */
  const keys: readonly string[] = source === "library" ? LIBRARY_RULE_KEYS : FILTER_KEYS;
  for (const k of keys) {
    const x = v[k];
    if (typeof x !== "string" || !VALUE_RE.test(x)) continue;
    /* **والمفتاحان الخاصّان بالمكتبة قيمُهما مغلقة**: حالةٌ من أربع، وعتبةٌ
       من ثلاث — **ونصٌّ حرٌّ في شرطٍ يُخزَّن ثغرةٌ تنتظر قارئاً.** */
    if (k === "wst" && !isLibraryStatus(x)) continue;
    if (k === "my" && !(MY_RATING_MIN as readonly string[]).includes(x)) continue;
    out[k] = x;
  }
  return Object.keys(out).length ? out : null;
}

/** الشرطُ إلى نصِّ استعلامٍ — **لِزرّ «افتح في اكتشف»** */
export function ruleToQuery(rule: SmartRule): string {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (rule[k]) p.set(k, rule[k]);
  return p.toString();
}

/**
 * **جهةُ الشرط — من `type` وحدَها.**
 *
 * 🔴 **والخريطةُ هي خريطةُ `‎/news` بعينها**: `movies → movie` ·
 * `shows → tv` · **`anime → all`** — **فالأنمي تبويبٌ يحمل صفَّي
 * أفلامٍ وصفَّي مسلسلاتٍ معاً**، **و«الكلّ» في الرابط هي علامتُه.**
 *
 * ⚠️ **والغائبُ فيلمٌ لا أنمي** (D-179: **الرابطُ الأعزل يُقرأ أفلاماً**)
 * — **وأوّلُ نسخةٍ من هذا السطر جعلت الغائبَ أنمي**، **فكان كلُّ شرطٍ
 * بلا `type` يستعلم مسلسلاتٍ بمفتاح الأنمي ويعود فارغاً بلا سبب.**
 * **والشرطُ يُكتب فيه `type` عند الإنشاء من التبويب** — **فلا يغيب
 * إلّا عن شرطٍ صُنع بيد.**
 */
export function ruleMedia(rule: SmartRule): SectionMedia {
  return rule.type === "tv" ? "tv" : rule.type === "all" ? "anime" : "movie";
}

/* **وخريطةُ التبويب إلى الجهة تسكن `smartListKeys.ts`** — **يقرؤها
   العميلُ وهذا الملفُّ `server-only`** — **وتُعاد تصديرُها هنا فلا
   يبحث قارئُ الخادم عن نصفِ الوحدة في ملفٍّ ثانٍ.** */
export { sectionToRuleType } from "@/core/smartListKeys";

/**
 * **الشرطُ إلى `DiscoverFilter`** — **المصدرُ الواحدُ الذي كان مكتوباً
 * في صفحتين.** **ويُنادي TMDB مرّةً لكلِّ محورٍ يحتاج معرّفاً**
 * (`keywordId`/`companyId`)، **وكلاهما مخبَّأٌ في طبقة الجلب.**
 */
export async function browseToFilter(
  browse: BrowseQuery,
  opts: { media: SectionMedia; watchRegion: string | null },
): Promise<{ base: DiscoverFilter; genreIds: number[] | undefined }> {
  const { media, watchRegion } = opts;
  const anime = media === "anime";
  const eraR = eraRange(browse.era);
  const tagId = browse.tag ? await keywordId(browse.tag.q) : null;
  const studioId = anime && browse.studio ? await companyId(browse.studio.name) : null;
  const seasonR =
    anime && browse.season
      ? seasonRange(
          browse.season,
          eraR.to ? Number(eraR.to.slice(0, 4)) : new Date().getUTCFullYear(),
        )
      : null;

  const base: DiscoverFilter = {
    lang: browse.lang?.code ?? null,
    country: browse.country?.code ?? null,
    provider: browse.provider,
    watchRegion,
    from: seasonR?.from ?? eraR.from,
    to: seasonR?.to ?? eraR.to,
    minRate: browse.rate,
    keywords: anime
      ? [ANIME_KEYWORD, ...(tagId ? [tagId] : [])]
      : tagId
        ? [tagId]
        : undefined,
    status: browse.status?.code ?? null,
    companies: studioId ? [studioId] : undefined,
  };

  const genreIds = browse.genre
    ? media === "tv"
      ? browse.genre.tv
      : media === "movie"
        ? browse.genre.movie
        : undefined
    : undefined;

  return { base, genreIds };
}

/** **الشرطُ إلى `BrowseQuery`** — **بالمطهِّر نفسِه الذي تقرأ به الصفحة** */
export function ruleToBrowse(rule: SmartRule): BrowseQuery {
  const media = ruleMedia(rule);
  return parseBrowse({ ...rule, type: media === "anime" ? "all" : media });
}
