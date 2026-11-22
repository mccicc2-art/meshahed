/**
 * 🆕 T517 — **قوائمُ المخرجين** (أحمد ٢٢ نوفمبر ٢٠٢٦: «سوي قائمة للمخرجين .. وحط فيها المخرج واعماله»،
 * ثمّ «٢ ب»: برقم الشخص في TMDB فتتحدّث وحدها، و«هذي قوائم للمخرجين لا تخلطها»).
 *
 * **دوالُّ صافيةٌ بلا شبكة** — تُختبر وحدها، ويناديها `resolveSetIds` في `tmdb.ts`:
 * - `pickDirector` يختار الشخصَ من نتائج البحث بالاسم. **الاسمُ لا المعرّف** في القاموس — نصُّ D-388
 *   («معرّفاتُ TMDB لا تُكتب باليد بلا خطأ»)، **ومن لا يُطابَق يسقط فلا تُبنى قائمةٌ لشخصٍ آخر**.
 * - `directedFilms` يُبقي ما **أخرجه بنفسه** من رصيده — لا ما كتبه أو أنتجه أو ظهر فيه (لا تخلطها) —
 *   بترتيب صدوره، بلا تكرار، **وبلا عملٍ لا تاريخَ له** (مشروعٌ معلَنٌ بلا موعد ليس فيلماً بعد).
 * - `isFeature` يُسقط الأفلامَ القصيرة: رصيدُ كوبريك وهيتشكوك يبدأ بأفلامٍ قصيرةٍ ووثائقيّاتِ دقائق،
 *   **وقائمةُ «أفلام كوبريك» تَعِد بأفلامه الطويلة**.
 */

export interface PersonHit {
  id: number;
  name: string;
  /** الاسمُ الأصليّ بحروفه — لا يُترجم مع لغة الطلب (T520) */
  original_name?: string | null;
  known_for_department?: string | null;
  popularity?: number | null;
}

export interface CrewCredit {
  id: number;
  job?: string | null;
  release_date?: string | null;
  video?: boolean | null;
}

/** طولُ الفيلم الطويل بالدقائق — الحدُّ الذي يفصل الطويلَ عن القصير في الأكاديميّة نفسِها (أكثر من ٤٠) مرفوعٌ إلى ساعة:
 *  وثائقيّاتُ التلفزيون القصيرة (٤٥–٥٥ دقيقة) ليست ما يُقصد بـ«أفلام المخرج» */
export const FEATURE_MINUTES = 60;

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** الشخصُ الذي اسمُه هذا تماماً، **ومن قسم الإخراج إن وُجد** — والأشهرُ عند التساوي. لا مطابقةَ تامّة = لا أحد. */
export function pickDirector(results: readonly PersonHit[], name: string): PersonHit | null {
  const want = norm(name);
  /* 🔴 T520 — **والاسمُ الأصليُّ يُقبل أيضاً**: `name` يُترجم بلغة الطلب، و`original_name` لا */
  const exact = results.filter((r) => norm(r.name ?? "") === want || norm(r.original_name ?? "") === want);
  if (!exact.length) return null;
  const byPop = (a: PersonHit, b: PersonHit) => (b.popularity ?? 0) - (a.popularity ?? 0);
  const directing = exact.filter((r) => r.known_for_department === "Directing").sort(byPop);
  return directing[0] ?? [...exact].sort(byPop)[0];
}

/** ما أخرجه بنفسه، بترتيب صدوره (الأقدمُ أوّلاً)، بلا تكرار ولا فيديو منزليّ ولا عملٍ بلا تاريخ */
export function directedFilms(
  crew: readonly CrewCredit[],
  /** 🆕 T521 — معرّفاتُ TMDB لما يُستبعد بالاسم من قائمة هذا المخرج (`Universe.directorSkip`) */
  skip: readonly number[] = [],
): { id: number; release_date: string }[] {
  const seen = new Set<number>(skip);
  const out: { id: number; release_date: string }[] = [];
  for (const c of crew) {
    if (c.job !== "Director" || c.video) continue;
    const date = (c.release_date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, release_date: date });
  }
  return out.sort((a, b) => (a.release_date < b.release_date ? -1 : a.release_date > b.release_date ? 1 : a.id - b.id));
}

/**
 * فيلمٌ طويل؟ — **ساعةٌ فأكثر**. **والقادمُ بلا طولٍ معلَنٍ يبقى**: TMDB لا يعرف طولَ فيلمٍ لم يُعرض،
 * وفيلمُ المخرج القادم (Dune: Part Three لفيلنوف) هو أوّلُ ما يبحث عنه قارئُ قائمته. **والقديمُ بلا طولٍ يسقط**:
 * غيابُ الطول عن فيلمٍ عُرض علامةُ صفٍّ ناقصٍ لا فيلمٍ طويل.
 */
export function isFeature(runtime: number | null | undefined, releaseDate: string, today: string): boolean {
  if (runtime && runtime > 0) return runtime >= FEATURE_MINUTES;
  return releaseDate > today;
}

/**
 * 🆕 T521 — **فيلمٌ مجمَّع؟** (أحمد «نفذ أ»): ثلاثةُ مخرجين فأكثر = فيلمٌ من مقاطع لكلِّ مخرجٍ مقطعُه
 * (Four Rooms · Twilight Zone: The Movie · New York Stories · Cosmos) — **ليس فيلمَ المخرج، وقائمتُه لا تُخلط**
 * («هذي قوائم للمخرجين لا تخلطها»). **ومخرجان يبقيان**: الإخراجُ المشترك عملٌ واحدٌ لهما معاً (Personality Crisis
 * لسكورسيزي وتيديسكي).
 */
export const MAX_CO_DIRECTORS = 2;

export function isAnthology(crew: readonly { id: number; job?: string | null }[]): boolean {
  const ids = new Set(crew.filter((c) => c.job === "Director").map((c) => c.id));
  return ids.size > MAX_CO_DIRECTORS;
}
