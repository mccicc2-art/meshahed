import { buildSection } from "@/lib/sections";
import { titleOf } from "@/lib/tmdb";
import { browseToFilter, ruleMedia, ruleToBrowse, sanitizeRule, SMART_LIST_LIMIT, isRuleSource, type RuleSource } from "@/lib/smartLists";
import { evaluateLibraryRule } from "@/lib/librarySmart";
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
    if (source === "library") {
      const rows = await evaluateLibraryRule(rule, SMART_LIST_LIMIT);
      return { rule, source, rows: rows.map((r) => ({ tmdb_id: r.tmdb_id, media_type: r.media_type, title: r.title, poster_path: r.poster_path, added_at: r.added_at, sort_order: null })) };
    }
    const media = ruleMedia(rule);
    const browse = ruleToBrowse(rule);
    const region = await getWatchRegion();
    const { base, genreIds } = await browseToFilter(browse, { media, watchRegion: region });
    const rows = await buildSection("my-row", { media, base, genreIds, active: browse.active, win: "week", winRange: null, locale }, SMART_LIST_LIMIT);
    return {
      rule,
      source,
      rows: rows.map((r) => ({ tmdb_id: r.id, media_type: (r.media_type === "tv" ? "tv" : "movie") as "tv" | "movie", title: titleOf(r) || "", poster_path: r.poster_path ?? null, added_at: "", sort_order: null })),
    };
  } catch {
    return { rule, source, rows: [] };
  }
}
