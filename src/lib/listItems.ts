import { buildSection } from "@/lib/sections";
import { titleOf, type SearchResult } from "@/lib/tmdb";
import { ruleTypes, parseMix, interleaveByMix } from "@/core/smartListKeys";
import { BROWSE_GENRES, genreFitsType } from "@/core/browse";
import { browseToFilter, ruleMedia, ruleToBrowse, sanitizeRule, smartLimit, isRuleSource, type RuleSource, type SmartRule } from "@/lib/smartLists";
import { evaluateLibraryRule } from "@/lib/librarySmart";
import { getFollows, getWatchSummary, getWatchedMovieIds, getAllWatchedEpisodes } from "@/lib/data";
import { getWatchRegion } from "@/lib/locale";
import type { ListItem } from "@/lib/data";
import type { Locale } from "@/core/i18n";

/**
 * ====== أعمالُ القائمة كما تُعرض — قارئٌ واحدٌ للصفحة وللتطبيق (D-1036) ======
 *
 * **لماذا**: صفحةُ القائمة صارت شاشةً أصليّة (`GET /api/v1/lists/[id]`) — وأعمالُ **القائمة الذكيّة**
 * لا تُقرأ من صفوف بل **تُحسب عند الفتح** (D-823/D-876). المنطقُ كان داخل `lists/[id]/page.tsx`؛
 * **استُخرج لا نُسخ** (درسُ D-289): قارئٌ ثانٍ لنفس الشرط يعني قائمةً تعرض في التطبيق غيرَ ما تعرضه
 * في الويب. التعليقاتُ الأصليّةُ للقرارين انتقلت معه.
 *
 * 🔑 **أعمالُها محسوبةٌ عند الفتح لا مخزَّنةٌ في صفوف** (D-818): شرطُ «رعبٌ فوق ٧٫٥» يُخزَّن صفوفاً
 * تتقادم في يومين. ⚠️ **وبنفس `buildSection` الذي تبني به «اكتشف»** (D-145). ⚠️ **والفشلُ فراغٌ لا
 * انهيار**: TMDB خارجُنا. **والمصدرُ يفرّق القارئ** (D-876): `library` من جداولنا، و`catalog` من
 * `buildSection` — وشرطٌ يُطهَّر بمفردات مصدره.
 */
export async function resolveSmartItems(
  list: { kind: string; rule?: unknown; rule_source?: string | null },
  locale: Locale,
): Promise<{ rule: ReturnType<typeof sanitizeRule> | null; source: RuleSource; rows: ListItem[] | null }> {
  const source: RuleSource = isRuleSource(list.rule_source) ? list.rule_source : "catalog";
  const rule = list.kind === "smart" ? sanitizeRule(list.rule, source) : null;
  if (!rule) return { rule: null, source, rows: null };
  try {
    return { rule, source, rows: await evaluateSmartRule(rule, source, locale, smartLimit(rule)) };
  } catch {
    return { rule, source, rows: [] };
  }
}

/**
 * 🆕 T450 — **أعمالُ شرطٍ مطهَّر** — يقرؤه `resolveSmartItems` (القائمةُ المحفوظة) **ومعاينةُ صفحة «قائمة جديدة»**
 * معاً، فما تراه قبل الإنشاء هو ما تفتحه بعده بحرفه (D-145). **ويرمي** — المنادي يقرّر أنّ الفشلَ فراغ.
 *
 * - **المكتبة**: `evaluateLibraryRule` كما كانت، ومعها ترتيبُها (`sort`).
 * - **الكتالوج**: `buildSection("my-row")` نفسُه بترتيبه (`sort`)، **ثمّ يُسقط ما في مكتبتك** (`hide`):
 *   `watched` فيلمٌ شاهدتَه أو مسلسلٌ بدأتَه · `library` كلُّ ما تتابعه. **والإخفاءُ يُطلب له ضعفُ الحدّ** (سقفُه ١٢٠)
 *   كي لا تنقص القائمةُ بقدر ما أُسقط منها — **والناقصُ بعدها يُعرض ناقصاً لا مُكمَّلاً بغير شرطه** (D-217).
 */
export async function evaluateSmartRule(
  rule: SmartRule,
  source: RuleSource,
  locale: Locale,
  limit: number,
): Promise<ListItem[]> {
  if (source === "library") {
    const rows = await evaluateLibraryRule(rule, limit);
    return rows.map((r) => ({ tmdb_id: r.tmdb_id, media_type: r.media_type, title: r.title, poster_path: r.poster_path, added_at: r.added_at, sort_order: null }));
  }
  const sort = rule.sort === "rate" ? "vote_average.desc" : rule.sort === "new" ? "release.desc" : "popularity.desc";
  const hide = rule.hide === "watched" || rule.hide === "library" ? rule.hide : null;
  const want = hide ? Math.min(limit * 2, 120) : limit;
  const region = await getWatchRegion();
  /* 🆕 T454 — **الأنواعُ المجموعة صفٌّ لكلِّ نوع** (`buildSection` جهةٌ واحدة)، **ثمّ دمجٌ بمفتاح الترتيب نفسِه**:
     الأشهرُ بالشعبيّة، والأعلى بالتقييم، والأحدثُ بالتاريخ — لا تناوبٌ يضع فيلماً مغموراً بجانب أشهر مسلسل */
  /* والنوعُ الفنّيُّ الذي لا يعرفه نوعٌ («أطفال» للأفلام) يُسقط ذلك النوعَ — لا صفَّ بلا فلتره يملأ القائمةَ بالأشهر عامّةً */
  const genre = rule.g ? BROWSE_GENRES.find((g) => g.slug === rule.g) : null;
  const types = ruleTypes(rule.type).filter((t) => !genre || genreFitsType(genre, t === "movie" ? "movie" : t === "tv" ? "tv" : "all"));
  if (rule.type && !types.length) return [];
  const singles = (types.length ? types : [undefined]).map((t) => (t ? { ...rule, type: t } : rule));
  const [lists, hidden] = await Promise.all([
    Promise.all(
      singles.map(async (one) => {
        const media = ruleMedia(one);
        const browse = ruleToBrowse(one);
        const { base, genreIds } = await browseToFilter(browse, { media, watchRegion: region });
        return buildSection("my-row", { media, base, genreIds, active: browse.active, win: "week", winRange: null, locale, sort }, want);
      }),
    ),
    hide ? hiddenKeys(hide) : Promise.resolve(null),
  ]);
  const toItem = (r: SearchResult): ListItem => ({ tmdb_id: r.id, media_type: (r.media_type === "tv" ? "tv" : "movie") as "tv" | "movie", title: titleOf(r) || "", poster_path: r.poster_path ?? null, added_at: "", sort_order: null });
  const shown = (r: ListItem) => !hidden || !hidden.has(`${r.media_type}-${r.tmdb_id}`);
  /* 🆕 T467 — **بالنسبة إن وُجدت**: كلُّ نوعٍ يُرشَّح (الإخفاء) **قبل** التوزيع — وإلّا أكل الإخفاءُ من حصّة نوعٍ دون غيره —
     ثمّ تتناوب الصفوفُ بالحصص (`interleaveByMix`). **وغيابُها الدمجُ بالترتيب كما كان** (أحمد: «٢ ب»). */
  /* والنسبةُ تُقرأ على الأنواع كلِّها — نوعٌ أسقطه نوعٌ فنّيٌّ لا يناسبه يخرج بحصّته، والباقون يتقاسمون العرضَ بنسبهم */
  const mix = parseMix(rule.mix, ruleTypes(rule.type));
  if (mix && lists.length > 1) {
    return interleaveByMix(
      lists.map((l) => l.map(toItem).filter(shown)),
      types.map((t) => mix[t] ?? 0),
      limit,
      (r) => `${r.media_type}-${r.tmdb_id}`,
    );
  }
  const rows = lists.length === 1 ? lists[0] : mergeBySort(lists, sort);
  return rows.map(toItem).filter(shown).slice(0, limit);
}

/** دمجُ صفوفِ الأنواع بمفتاح الترتيب، بلا تكرار (عملٌ في صفّين — أنمي ومسلسل — يُعدّ مرّة) */
function mergeBySort(lists: SearchResult[][], sort: "popularity.desc" | "vote_average.desc" | "release.desc"): SearchResult[] {
  const key = (r: SearchResult): number =>
    sort === "vote_average.desc"
      ? r.vote_average ?? 0
      : sort === "release.desc"
        ? Date.parse(r.release_date || r.first_air_date || "") || 0
        : r.popularity ?? 0;
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => key(b) - key(a))
    .filter((r) => {
      const k = `${r.media_type}-${r.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** مفاتيحُ ما يُخفى (`movie-603` · `tv-1396`) — من جداولنا وحدَها، بلا نداء TMDB */
async function hiddenKeys(hide: "watched" | "library"): Promise<Set<string>> {
  const follows = await getFollows();
  if (hide === "library") return new Set(follows.map((f) => `${f.media_type}-${f.tmdb_id}`));
  const [movies, summary] = await Promise.all([getWatchedMovieIds(), getWatchSummary()]);
  const started = new Set<number>();
  if (summary) {
    for (const s of summary) if (s.watched > 0) started.add(s.show_tmdb_id);
  } else {
    for (const w of await getAllWatchedEpisodes()) started.add(w.show_tmdb_id);
  }
  const out = new Set<string>();
  for (const id of movies) out.add(`movie-${id}`);
  for (const id of started) out.add(`tv-${id}`);
  return out;
}
