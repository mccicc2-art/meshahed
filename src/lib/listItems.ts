import { buildSection } from "@/lib/sections";
import { titleOf } from "@/lib/tmdb";
import { browseToFilter, ruleMedia, ruleToBrowse, sanitizeRule, SMART_LIST_LIMIT, isRuleSource, type RuleSource, type SmartRule } from "@/lib/smartLists";
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
    return { rule, source, rows: await evaluateSmartRule(rule, source, locale, SMART_LIST_LIMIT) };
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
  const media = ruleMedia(rule);
  const browse = ruleToBrowse(rule);
  const region = await getWatchRegion();
  const { base, genreIds } = await browseToFilter(browse, { media, watchRegion: region });
  const sort = rule.sort === "rate" ? "vote_average.desc" : rule.sort === "new" ? "release.desc" : "popularity.desc";
  const hide = rule.hide === "watched" || rule.hide === "library" ? rule.hide : null;
  const [rows, hidden] = await Promise.all([
    buildSection("my-row", { media, base, genreIds, active: browse.active, win: "week", winRange: null, locale, sort }, hide ? Math.min(limit * 2, 120) : limit),
    hide ? hiddenKeys(hide) : Promise.resolve(null),
  ]);
  return rows
    .map((r) => ({ tmdb_id: r.id, media_type: (r.media_type === "tv" ? "tv" : "movie") as "tv" | "movie", title: titleOf(r) || "", poster_path: r.poster_path ?? null, added_at: "", sort_order: null }))
    .filter((r) => !hidden || !hidden.has(`${r.media_type}-${r.tmdb_id}`))
    .slice(0, limit);
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
