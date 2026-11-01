import "server-only";
import { unstable_cache } from "next/cache";
import { getEpisodeGroup, getEpisodeGroups } from "@/lib/tmdb";
import { fixedParts, partSeason, partsFromGroups, type GroupSet, type SeasonPart } from "@/core/seasonParts";

/**
 * ====== جلبُ أجزاء الموسم الطويل (D-1618) ======
 *
 * عملٌ كلُّه في موسمٍ واحد فوق مئة حلقة (`partSeason`): تُسأل TMDB عن مجموعات حلقاته البديلة، فإن كان فيها تقسيمُ
 * آركاتٍ (أو مواسمِ بثٍّ) صالحٌ صار أجزاءَه بأسمائه، وإلّا أجزاءٌ ثابتةٌ بمئة.
 *
 * 🔑 **الناتجُ يُخبّأ لا الردود**: ملفُّ المجموعة لعملٍ بألف حلقة كبيرٌ (حلقاتٌ بأوصافها) وقد يتجاوز سقفَ خبيئة الجلب —
 * فتُخبّأ الأجزاءُ نفسُها (بضعُ مئات بايت) يوماً، ومفتاحُها عددُ الحلقات: حلقةٌ جديدة ⇒ حسابٌ جديد.
 * 🔑 **ولا يوقف الصفحة**: سقفُ وقت، والفشلُ أو التأخّر ⇒ الأجزاءُ الثابتة (لا تُخبّأ — المرّةُ التالية تحاول الآركات).
 */
const BUDGET_MS = 2500;
/** أقصى عدد مجموعاتٍ تُفتح للعمل الواحد — الأولى بالأولويّة تكفي عادةً */
const MAX_FETCH = 3;
const ORDER = [5, 7, 6];

async function fromTmdb(tvId: number, season: number, first: number, last: number): Promise<SeasonPart[]> {
  const list = (await getEpisodeGroups(tvId))
    .filter((g) => ORDER.includes(g.type) && g.group_count >= 2)
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || b.episode_count - a.episode_count)
    .slice(0, MAX_FETCH);
  const sets: GroupSet[] = [];
  for (const g of list) {
    const d = await getEpisodeGroup(g.id);
    sets.push({ type: d.type ?? g.type, groups: d.groups ?? [] });
    const parts = partsFromGroups(sets, season, first, last);
    if (parts) return parts;
  }
  return fixedParts(first, last);
}

const cached = (tvId: number, season: number, first: number, last: number) =>
  unstable_cache(() => fromTmdb(tvId, season, first, last), ["season-parts-1", String(tvId), String(season), String(first), String(last)], {
    revalidate: 60 * 60 * 24,
  })();

/**
 * أجزاءُ موسم العمل إن كان يُقسَّم، وإلّا `null`.
 * `firstEpisode` أوّلُ رقمٍ في الموسم (١ عادةً — الترقيمُ المطلق يبدأ بغيره، D-603).
 */
export async function seasonPartsFor(
  tvId: number,
  seasons: readonly { season_number: number; episode_count: number }[],
  firstEpisode: (season: number) => number,
): Promise<{ season: number; parts: SeasonPart[] } | null> {
  const season = partSeason(seasons);
  if (season === null) return null;
  const count = seasons.find((s) => s.season_number === season)?.episode_count ?? 0;
  const first = firstEpisode(season);
  const last = first + count - 1;
  const parts = await Promise.race([
    cached(tvId, season, first, last).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), BUDGET_MS)),
  ]);
  return { season, parts: parts ?? fixedParts(first, last) };
}
