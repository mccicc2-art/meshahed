import "server-only";
import { unstable_cache } from "next/cache";
import { after } from "next/server";
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
 * 🔑 المفتاحُ «-2» (D-1620): أسماءُ الأجزاء صارت تُصفّى (`readableName`) فلا تُقرأ الخبيئةُ القديمة بأسمائها التايلنديّة.
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
  unstable_cache(() => fromTmdb(tvId, season, first, last), ["season-parts-2", String(tvId), String(season), String(first), String(last)], {
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
  /* 🆕 D-1623 — **ما سبق المهلةَ يكمل بعد الردّ** (مراجعة ٢ نوفمبر): الوعدُ الذي خسر السباق كان يُترك معلّقاً، وVercel قد
     يجمّد الدالّةَ بعد الردّ فلا تُكتب الآركاتُ في الخبيئة أبداً — فتعود الزيارةُ الباردة بأجزاءٍ ثابتة وتتبدّل الأسماء. `after`
     يُبقي الدالّةَ حيّةً حتى يكتمل، والمؤقّتُ يُلغى */
  const work = cached(tvId, season, first, last).catch(() => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const parts = await Promise.race([work, new Promise<null>((r) => (timer = setTimeout(() => r(null), BUDGET_MS)))]);
  clearTimeout(timer);
  if (parts === null) {
    try {
      after(work);
    } catch {
      /* خارج طلب (بناءٌ ثابت): لا شيءَ يُنتظر */
    }
  }
  const list = parts ?? fixedParts(first, last);
  /* D-1623 — جزءٌ واحدٌ ليس تقسيماً (١٠١ حلقة بعد ضمّ الذيل) */
  return list.length >= 2 ? { season, parts: list } : null;
}
