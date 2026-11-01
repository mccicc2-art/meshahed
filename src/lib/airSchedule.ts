import "server-only";
import { getEpisode, getSeason, getTv, type Episode } from "@/lib/tmdb";
import { airPlanOf, type AirEp, type AirPlan } from "@/core/airPlan";

/**
 * ====== جلبُ خططِ العرض من TMDB (D-1614) ======
 *
 * التقويمُ و«أسبوعك» كانا يعرفان موعدَ القادمة وحدَها من صفّ المتابعة (D-828). هنا لكلِّ مسلسلٍ يُعرض ويقع قادمُه في
 * المدى المطلوب نداءان: تفاصيلُه (أيُّ موسمٍ يُعرض الآن، وهل ما زال يُنتَج) وحلقاتُ ذلك الموسم بمواعيدها — ثمّ
 * `airPlanOf` تحسب المعلنَ والإيقاع. **النداءان من خبيئة TMDB نفسِها** (`tmdb()` بإعادة تحقّقٍ كلَّ ساعة)، وصفحةُ المسلسل
 * تسخّن الأوّلَ منهما أصلاً.
 *
 * 🔑 **لا يوقف الصفحة**: كلُّ مسلسلٍ له سقفُ وقت، وما تأخّر أو فشل يسقط إلى موعد صفّه وحده — التقويمُ يُرسم كما كان قبل
 * هذا لا فارغاً. والعددُ مسقوف (الأقربُ موعداً أوّلاً): مكتبةٌ بمئة مسلسلٍ يُعرض لا تفتح مئتي نداء.
 */
export interface PlanRow {
  tmdb_id: number;
  media_type: "tv" | "movie";
  next_air_date?: string | null;
  dropped?: boolean | null;
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);
}

/** موسمٌ أطولُ من هذا لا يُجلب كاملاً — يكفي ثلاثُ حلقاتٍ للحكم على الإيقاع */
const LONG_SEASON = 60;

const asEp = (e: Episode): AirEp => ({
  ep: e.episode_number,
  date: e.air_date || null,
  type: (e as { episode_type?: string | null }).episode_type ?? null,
});

async function planOf(id: number, today: string): Promise<AirPlan | null> {
  const tv = await getTv(id);
  const season = tv.next_episode_to_air?.season_number ?? tv.last_episode_to_air?.season_number;
  if (!season) return null;
  /* `in_production` يصل من TMDB ولا يحمله النوع — والحالةُ «مستمرّ» بديلُه إن غاب */
  const open = (tv as { in_production?: boolean }).in_production ?? tv.status === "Returning Series";
  /* 🆕 D-1614b — **الموسمُ الطويل** (أحمد ١ نوفمبر: «شفت بلاك كلوفر فقط» — كونان غاب): TMDB تضع حلقاتِ كونان كلَّها (~١٢٠٠)
     في موسمٍ واحد، فملفُّه يتجاوز مهلةَ التقويم وسقفَ الخبيئة فيسقط إلى موعد صفّه. هنا تكفي الأخيرةُ والقادمةُ من تفاصيل المسلسل
     (مجلوبةٌ أصلاً) وحلقةٌ واحدةٌ قبل الأخيرة: ثلاثةُ مواعيد = قاعدةُ الأسبوعيّة نفسُها في `airPlanOf` */
  const count = tv.seasons?.find((x) => x.season_number === season)?.episode_count ?? 0;
  if (count > LONG_SEASON) {
    const eps: AirEp[] = [];
    const last = tv.last_episode_to_air;
    if (last && last.season_number === season) {
      eps.push(asEp(last));
      if (last.episode_number > 1) {
        const prev = await getEpisode(id, season, last.episode_number - 1).catch(() => null);
        if (prev) eps.push(asEp(prev));
      }
    }
    if (tv.next_episode_to_air && tv.next_episode_to_air.season_number === season) eps.push(asEp(tv.next_episode_to_air));
    return airPlanOf(eps, today, open);
  }
  const s = await getSeason(id, season);
  return airPlanOf((s.episodes ?? []).map(asEp), today, open);
}

/**
 * خططُ المسلسلات التي يقع قادمُها بين `today` و`until` — بمفتاح `tv-<id>` كمداخل التقويم.
 * `limit` أقصى عددِ مسلسلات، و`ms` سقفُ كلِّ واحد.
 */
export async function airPlans(
  rows: readonly PlanRow[],
  { today, until, limit = 24, ms = 2500 }: { today: string; until: string; limit?: number; ms?: number },
): Promise<Map<string, AirPlan>> {
  const picked = rows
    .filter((r) => r.media_type === "tv" && !r.dropped && r.next_air_date && r.next_air_date >= today && r.next_air_date <= until)
    .sort((a, b) => (a.next_air_date ?? "").localeCompare(b.next_air_date ?? ""))
    .slice(0, limit);
  const got = await Promise.all(picked.map(async (r) => [r.tmdb_id, await timeout(planOf(r.tmdb_id, today), ms)] as const));
  const out = new Map<string, AirPlan>();
  for (const [id, plan] of got) if (plan) out.set(`tv-${id}`, plan);
  return out;
}
