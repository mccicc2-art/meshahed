/**
 * ============ أجزاءُ الموسم الطويل — منطقٌ نقيّ (D-1618) ============
 *
 * أحمد ١ نوفمبر بلقطة كونان («الموسم 1 · 1210/1218»): «قسم كونان إلى اجزاء و كل مسلسل طويل قسمه كذلك»، ثمّ
 * «اللي مقسمها كاركات خلها كاركات مثل ماهي» — «١أ» (آركاتُ TMDB إن وُجدت، وإلّا أجزاءٌ ثابتة) و«أ» (مئةُ حلقة).
 * TMDB تضع حلقاتِ بعض الأعمال الطويلة كلَّها في موسمٍ واحد (كونان ~١٢٠٠)، فيصير الموسمُ قائمةً بلا نهاية.
 *
 * 🔑 **لا يُقسَّم إلّا عملٌ كلُّه في موسمٍ عاديٍّ واحد** فوق مئة حلقة: عملٌ له مواسمُ أو آركاتٌ (ون بيس) يبقى كما هو
 * مهما طال موسمٌ منه — تقسيمُه هو تقسيمُ صاحبه، ولا نقسّم آركاً.
 * 🔑 **الأجزاءُ عرضٌ لا بيانات**: الحلقةُ تبقى «الموسم ١ · الحلقة n» في التتبّع والمفاتيح؛ الجزءُ مدىً من أرقامها.
 *
 * هنا الحسابُ وحدَه (لا نداء): الجلبُ والخبيئة في `lib/seasonParts.ts`، والاختبارُ في `seasonParts.test.ts`.
 */

export interface SeasonPart {
  /** أوّلُ رقمِ حلقةٍ في الجزء وآخرُه (شاملان) — أرقامُ الموسم نفسِها */
  first: number;
  last: number;
  /** اسمُ الآرك من TMDB، و`null` لجزءٍ ثابت (يُكتب «الجزء n») */
  name: string | null;
}

/** موسمٌ أطولُ من هذا يُقسَّم */
export const PARTS_FROM = 100;
/** طولُ الجزء الثابت — «أ»: مئة */
export const PART_SIZE = 100;

/**
 * أنواعُ مجموعات الحلقات عند TMDB بالأولويّة: ٥ آركاتُ القصّة · ٧ مواسمُ البثّ التلفزيونيّ · ٦ مواسمُ الإنتاج.
 * التاريخُ (١) والمطلقُ (٢) وأقراصُ DVD (٣) والرقميّ (٤) ليست تقسيماً يعرفه المشاهد.
 */
const GROUP_TYPES = [5, 7, 6] as const;
/** سقفُ عدد المجموعات: تقسيمُ «قضيّةٍ قضيّة» (حلقتان لكلّ واحدة) قائمةٌ أطولُ من الموسم نفسِه */
const MAX_GROUPS = 80;
/** نسبةُ ما تغطّيه المجموعاتُ من مداها (حلقاتٌ خارجها = تقسيمٌ ناقص) */
const MIN_COVER = 0.85;
/** ومدى المجموعات من الموسم: مجموعةٌ توقّف تحديثُها عند ثلثه لا تُعتمد */
const MIN_REACH = 0.6;

/** أيُّ موسمٍ يُقسَّم — العملُ كلُّه في موسمٍ عاديٍّ واحد (الخاصّاتُ «٠» لا تُعدّ) فوق `PARTS_FROM` حلقة؛ وإلّا `null` */
export function partSeason(seasons: readonly { season_number: number; episode_count: number }[]): number | null {
  const regular = seasons.filter((s) => s.season_number >= 1);
  if (regular.length !== 1) return null;
  return regular[0].episode_count > PARTS_FROM ? regular[0].season_number : null;
}

/** ذيلٌ أقصرُ من هذا يُضمّ إلى الجزء قبله (D-1623) */
const SHORT_TAIL = PART_SIZE / 4;

/**
 * أجزاءٌ ثابتة من `first` إلى `last` — الأخيرُ ما بقي.
 * 🆕 D-1623 — وذيلٌ قصير (أقلُّ من ربع جزء) يُضمّ إلى ما قبله: موسمٌ بـ١٠١ حلقة كان «جزء ١ (١٠٠) · جزء ٢ (حلقةٌ واحدة)».
 */
export function fixedParts(first: number, last: number, size = PART_SIZE): SeasonPart[] {
  const out: SeasonPart[] = [];
  for (let a = first; a <= last; a += size) out.push({ first: a, last: Math.min(last, a + size - 1), name: null });
  const tail = out[out.length - 1];
  if (out.length >= 2 && tail.last - tail.first + 1 < SHORT_TAIL) {
    out.pop();
    out[out.length - 1] = { ...out[out.length - 1], last: tail.last };
  }
  return out;
}

/** مجموعةُ حلقاتٍ كما تحتاجها الأجزاء — من `/tv/episode_group/{id}` */
export interface GroupSet {
  type: number;
  groups: { name: string; order: number; episodes: { season_number: number; episode_number: number }[] }[];
}

/**
 * **الآركاتُ من مجموعات TMDB** — أوّلُ مجموعةٍ صالحةٍ بأولويّة النوع، وإلّا `null` (فالأجزاءُ الثابتة).
 * صالحةٌ = من ٢ إلى `MAX_GROUPS`، مرتّبةٌ بلا تداخل، تغطّي مداها، وتبلغ أكثرَ الموسم. الفجوةُ بين آركين تُضمّ إلى التالي
 * (حلقةُ تلخيصٍ لا يذكرها أحد) فلا تضيع حلقة، وما بعد آخر آرك (الجديدُ الذي لم يُضمّ بعد) أجزاءٌ ثابتة.
 */
export function partsFromGroups(sets: readonly GroupSet[], season: number, first: number, last: number): SeasonPart[] | null {
  for (const type of GROUP_TYPES)
    for (const set of sets) {
      if (set.type !== type) continue;
      const parts = arcParts(set, season, first, last);
      if (parts) return parts;
    }
  return null;
}

/**
 * 🆕 D-1620 — **اسمُ الآرك يُعرض إن قُرئ** (أحمد ٢ نوفمبر بعد أن جاءت أجزاءُ كونان «ปี 1»: «٣أ»): مجموعاتُ TMDB يُدخلها
 * متطوّعون بلغاتهم، فاسمٌ بغير الحرف العربيّ أو اللاتينيّ (تايلنديّ · يابانيّ …) يسقط إلى «الجزء n» — رقمٌ يُقرأ خيرٌ من اسمٍ لا يُقرأ.
 */
export function readableName(name: string | null | undefined): string | null {
  const n = name?.trim();
  return n && /^[\p{Script=Latin}\p{Script=Arabic}\p{N}\p{P}\p{S}\s]+$/u.test(n) ? n : null;
}

function arcParts(set: GroupSet, season: number, first: number, last: number): SeasonPart[] | null {
  const ranges: { name: string | null; lo: number; hi: number; n: number }[] = [];
  for (const g of [...set.groups].sort((a, b) => a.order - b.order)) {
    const eps = [...new Set(g.episodes.filter((e) => e.season_number === season && e.episode_number >= first && e.episode_number <= last).map((e) => e.episode_number))];
    if (!eps.length) continue;
    ranges.push({ name: readableName(g.name), lo: Math.min(...eps), hi: Math.max(...eps), n: eps.length });
  }
  if (ranges.length < 2 || ranges.length > MAX_GROUPS) return null;
  for (let i = 1; i < ranges.length; i++) if (ranges[i].lo <= ranges[i - 1].hi) return null;
  const end = ranges[ranges.length - 1].hi;
  const covered = ranges.reduce((n, r) => n + r.n, 0);
  if (covered / (end - first + 1) < MIN_COVER) return null;
  if ((end - first + 1) / (last - first + 1) < MIN_REACH) return null;
  const out: SeasonPart[] = [];
  let start = first;
  for (const r of ranges) {
    out.push({ first: start, last: r.hi, name: r.name });
    start = r.hi + 1;
  }
  if (start <= last) out.push(...fixedParts(start, last));
  return out;
}

/** ما بُثّ من الجزء — من نافذة الموسم (`first_episode` · `aired`) بلا جلب حلقة */
export function partAired(part: SeasonPart, seasonFirst: number, seasonAired: number): number {
  const airedLast = seasonFirst + seasonAired - 1;
  return Math.max(0, Math.min(part.last, airedLast) - part.first + 1);
}

/** ما شوهد من الجزء — مفاتيحُ `episodeKey` («موسم:حلقة») داخل مداه */
export function partWatched(part: SeasonPart, season: number, watched: Iterable<string>): number {
  let n = 0;
  for (const k of watched) {
    const i = k.indexOf(":");
    if (i < 0 || Number(k.slice(0, i)) !== season) continue;
    const e = Number(k.slice(i + 1));
    if (e >= part.first && e <= part.last) n++;
  }
  return n;
}

/**
 * كلماتُ الجزء — هنا لا في `i18n.ts` لأنّ القاموسَ محجوزٌ لمهمّةٍ أخرى في السجلّ (274)؛ تنتقل إليه حين يُفرَج عنه.
 * «الجزء كامل ✓» على وزن «الموسم كامل ✓» حرفاً (D-145: الفعلُ الواحد بكلمةٍ واحدة).
 */
export const PART_WORDS = {
  ar: { label: (n: number) => `الجزء ${n}`, all: "الجزء كامل ✓", undo: "إلغاء الجزء" },
  en: { label: (n: number) => `Part ${n}`, all: "Whole part ✓", undo: "Clear part" },
} as const;

/** اسمُ الجزء: اسمُ آركه، وإلّا «الجزء n» */
export function partTitle(part: SeasonPart, index: number, locale: "ar" | "en"): string {
  return part.name ?? PART_WORDS[locale].label(index + 1);
}
