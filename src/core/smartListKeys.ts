/**
 * ====== مفاتيحُ القائمة الذكيّة — الطرفُ الذي يقرؤه العميل (D-823) ======
 *
 * 🔑 **و`smartLists.ts` مُعلَّمٌ `server-only`** — **لأنّه ينادي TMDB** —
 * **ومكوّنُ العميل يحتاج سطراً واحداً منه: خريطةَ التبويب إلى الجهة.**
 * **فالسطرُ يسكن هنا وحدَه، وذاك يستورده** — **ولا نسختان تفترقان**
 * (D-145/D-376).
 */

/**
 * **تبويبُ «اكتشف» إلى قيمة `type` في الشرط** — **نفسُ سطر `‎/news`
 * بحرفه**: `movies → movie` · `shows → tv` · **`anime → all`**
 * (تبويبُ الأنمي يحمل صفَّي أفلامٍ وصفَّي مسلسلاتٍ معاً).
 * **و`null` لِما لا جهةَ له** — تبويبُ «القوائم» — **فلا يُصنع منه
 * شرطٌ أصلاً** (D-217: لا بابَ لِما لا يُفتح).
 */
export function sectionToRuleType(section: string): "movie" | "tv" | "all" | null {
  return section === "movies"
    ? "movie"
    : section === "shows"
      ? "tv"
      : section === "anime"
        ? "all"
        : null;
}

/**
 * ====== مفرداتُ شرط المكتبة (D-876) — **عميلٌ وخادمٌ يقرآن الملفَّ نفسَه** ======
 *
 * **حكمُ أحمد**: «مفردات المكتبة وحدها» — **ما تجيب عنه جداولُها بلا
 * نداء TMDB ولا تقييمٍ خارجيّ.** **والمفاتيحُ المشتركةُ مع الكتالوج تحمل
 * أسماءَها هناك بحروفها** (`type` · `g` · `era` · `lang` · `co`) —
 * **واسمان لمحورٍ واحدٍ يفترقان** (D-816/D-818).
 *
 * 🆕 **ومفتاحان للمكتبة وحدَها**: `wst` حالةُ المشاهدة · `my` تقييمي.
 */
export const LIBRARY_RULE_KEYS = ["type", "g", "era", "lang", "co", "wst", "my", "sort"] as const;
export type LibraryRuleKey = (typeof LIBRARY_RULE_KEYS)[number];

/** عتباتُ «تقييمي» — **ثلاثٌ كعتبات اكتشف** (`BROWSE_RATES`)، ولا عشرُ خانات */
export const MY_RATING_MIN = ["7", "8", "9"] as const;

/** تبويبُ المكتبة إلى نوعِ الشرط — **نظيرُ `sectionToRuleType` لأقسام اكتشف** */
export function libraryTabToRuleType(tab: string): "movie" | "tv" | "all" | null {
  return tab === "movies" ? "movie" : tab === "shows" ? "tv" : tab === "anime" ? "all" : null;
}

/**
 * ====== 🆕 T450 — مفتاحا صفحة «قائمة جديدة» (أحمد ١٩ نوفمبر: «موجوده ف تراكت») ======
 *
 * **قيمٌ مغلقةٌ لا نصٌّ حرّ** — المطهِّرُ يرفض ما سواها كما يرفض `wst`/`my` (D-475):
 *  · `hide` (الكتالوج وحدَه): `watched` يُسقط ما شاهدتَه (فيلمٌ مشاهَد · مسلسلٌ بدأتَه)، و`library` يُسقط كلَّ ما في مكتبتك.
 *  · `sort` (الكتالوج): `pop` الأشهر (الافتراضيّ — ترتيبُ «اكتشف» نفسُه) · `rate` الأعلى تقييماً · `new` الأحدث.
 *  · `sort` (المكتبة): `added` الأحدث إضافةً (الافتراضيّ — ترتيبُها قبل اليوم) · `my` تقييمي · `title` الاسم.
 * **والغائبُ هو الافتراضيُّ بحرفه** — فكلُّ شرطٍ حُفظ قبل اليوم يُقرأ كما كان (D-028).
 */
export const SMART_HIDE = ["watched", "library"] as const;
export type SmartHide = (typeof SMART_HIDE)[number];
export const SMART_SORT = ["pop", "rate", "new"] as const;
export type SmartSort = (typeof SMART_SORT)[number];
export const LIBRARY_SORT = ["added", "my", "title"] as const;
export type LibrarySort = (typeof LIBRARY_SORT)[number];
/** مفتاحا الكتالوج الزائدان على مفاتيح الفلاتر (`FILTER_KEYS`) */
export const SMART_CATALOG_EXTRA = ["hide", "sort"] as const;

/**
 * 🆕 T454 — **أنواعُ القائمة الذكيّة تُجمع** (أحمد ١٩ نوفمبر: «تحدد فقط افلام او انمي او مسلسلات ما تقدر تخلط»):
 * `type` يحمل نوعاً أو أكثر مفصولةً بفاصلة (`movie,tv`) — **والقيمةُ المفردةُ القديمة تُقرأ كما هي** فلا يتغيّر شرطٌ مخزَّن.
 * `all` = الأنمي (خريطةُ `/news` — `ruleMedia`). الترتيبُ ثابتٌ (أفلام ← مسلسلات ← أنمي) فالشرطُ نفسُه نصٌّ واحد.
 */
export const SMART_TYPES = ["movie", "tv", "all"] as const;
export type SmartType = (typeof SMART_TYPES)[number];

export function ruleTypes(value: string | null | undefined): SmartType[] {
  const parts = new Set(String(value ?? "").split(","));
  return SMART_TYPES.filter((t) => parts.has(t));
}

/** تبديلُ نوعٍ في القائمة — **ولا يُفرَّغ**: آخرُ نوعٍ مختارٍ لا يُطفأ (الشرطُ يحمل نوعاً دائماً) */
export function toggleRuleType(value: string | null | undefined, t: SmartType): string {
  const cur = ruleTypes(value);
  const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
  return (next.length ? SMART_TYPES.filter((x) => next.includes(x)) : cur).join(",");
}

/**
 * ====== 🆕 T467 — نسبةُ الأنواع (أحمد ١٩ نوفمبر: «ليش ما يقدر يحدد نسبة ؟» ثمّ «١ج»: نسبةٌ حرّةٌ بعدّاد) ======
 *
 * **الدمجُ بالشعبيّة يُغرق الأقلَّ شهرةً**: «أفلام + مسلسلات» تبدأ بثلاثة مسلسلاتٍ قبل أوّل فيلم. فلكلِّ نوعٍ حصّةٌ
 * من العرض بخطوات ١٠٪، **مجموعُها ١٠٠ دائماً، ولا نوعَ دون ١٠٪** (الصفرُ إلغاءُ النوع، وبابُه شريحتُه فوق).
 *
 * المفتاحُ `mix` نصٌّ مغلقٌ يمرّ بمطهِّر القيم نفسِه (`movie-60,tv-40`). **وغيابُه هو السلوكُ القديمُ بحرفه** — الدمجُ
 * بمفتاح الترتيب — فكلُّ قائمةٍ حُفظت قبل اليوم تبقى كما هي (أحمد: «٢ ب»)، والجديدةُ تبدأ بالتساوي.
 */
export const MIX_STEP = 10;
export type TypeMix = Partial<Record<SmartType, number>>;

/** النصُّ إلى حصص — **ولا يُقبل إلا كاملاً**: كلُّ نوعٍ مختارٍ له حصّة، مضاعفاتُ ١٠ لا دون ١٠، والمجموعُ ١٠٠ */
export function parseMix(value: string | null | undefined, types: readonly SmartType[]): TypeMix | null {
  if (!value || types.length < 2) return null;
  const out: TypeMix = {};
  for (const part of value.split(",")) {
    const [t, n] = part.split("-");
    const v = Number(n);
    if (!(SMART_TYPES as readonly string[]).includes(t) || !Number.isInteger(v)) return null;
    out[t as SmartType] = v;
  }
  if (Object.keys(out).length !== types.length) return null;
  let sum = 0;
  for (const t of types) {
    const v = out[t];
    if (v === undefined || v < MIX_STEP || v % MIX_STEP) return null;
    sum += v;
  }
  return sum === 100 ? out : null;
}

export function formatMix(mix: TypeMix, types: readonly SmartType[]): string {
  return types.map((t) => `${t}-${mix[t] ?? 0}`).join(",");
}

/** **البدايةُ بالتساوي** — ١٠٠ لا تقبل القسمةَ على ثلاثة بخطوة ١٠، فالباقي لأوّل الأنواع (٤٠/٣٠/٣٠) */
export function defaultMix(types: readonly SmartType[]): TypeMix {
  const base = Math.floor(100 / types.length / MIX_STEP) * MIX_STEP;
  let rest = 100 - base * types.length;
  const out: TypeMix = {};
  for (const t of types) {
    const extra = rest > 0 ? MIX_STEP : 0;
    rest -= extra;
    out[t] = base + extra;
  }
  return out;
}

/**
 * خطوةٌ على نوع — **والمجموعُ يبقى ١٠٠**: الزيادةُ تُؤخذ من أكبر الأنواع الأخرى (التعادلُ للأخير)، والنقصُ يُعطى
 * لأصغرها (التعادلُ للأوّل). **ونوعان يتحرّكان معاً بداهةً.** وما لا يتحرّك يعود كما هو — والعدّادُ يُطفئ زرَّه (`mixCan`).
 */
export function stepMix(mix: TypeMix, types: readonly SmartType[], t: SmartType, dir: 1 | -1): TypeMix {
  const others = types.filter((x) => x !== t);
  const cur = mix[t] ?? 0;
  if (dir === 1) {
    let pick: SmartType | null = null;
    for (const o of others) if ((mix[o] ?? 0) > MIX_STEP && (pick === null || (mix[o] ?? 0) >= (mix[pick] ?? 0))) pick = o;
    if (!pick) return mix;
    return { ...mix, [t]: cur + MIX_STEP, [pick]: (mix[pick] ?? 0) - MIX_STEP };
  }
  if (cur <= MIX_STEP || !others.length) return mix;
  let give = others[0];
  for (const o of others) if ((mix[o] ?? 0) < (mix[give] ?? 0)) give = o;
  return { ...mix, [t]: cur - MIX_STEP, [give]: (mix[give] ?? 0) + MIX_STEP };
}

export function mixCan(mix: TypeMix, types: readonly SmartType[], t: SmartType): { up: boolean; down: boolean } {
  return {
    up: types.some((o) => o !== t && (mix[o] ?? 0) > MIX_STEP),
    down: (mix[t] ?? 0) > MIX_STEP,
  };
}

/**
 * **الصفوفُ بالحصص متناوبةً** — كلَّ خانةٍ يأخذها النوعُ الأبعدُ عن حصّته حتّى الآن (فـ٦٠/٤٠ في كلِّ خمسٍ ثلاثةُ أفلامٍ
 * ومسلسلان متداخلة، لا ستّون فيلماً ثمّ أربعون مسلسلاً). **ونوعٌ نفد يُكمَل من غيره** فلا تقصر القائمةُ عمّا يُرى، **والمكرّرُ يُعدّ مرّة**
 * (مسلسلُ أنمي في صفّي «مسلسلات» و«أنمي»). كلُّ صفٍّ مرتّبٌ بمفتاح القائمة سلفاً — والترتيبُ داخل النوع باقٍ.
 */
export function interleaveByMix<T>(lists: readonly (readonly T[])[], weights: readonly number[], limit: number, keyOf: (x: T) => string): T[] {
  const pos = lists.map(() => 0);
  const taken = lists.map(() => 0);
  const seen = new Set<string>();
  const out: T[] = [];
  const next = (i: number): T | null => {
    while (pos[i] < lists[i].length) {
      const x = lists[i][pos[i]++];
      const k = keyOf(x);
      if (!seen.has(k)) {
        seen.add(k);
        return x;
      }
    }
    return null;
  };
  const alive = lists.map((l) => l.length > 0);
  while (out.length < limit && alive.some(Boolean)) {
    let best = -1;
    let gap = -Infinity;
    for (let i = 0; i < lists.length; i++) {
      if (!alive[i]) continue;
      const g = (weights[i] ?? 0) * (out.length + 1) - taken[i] * 100;
      if (g > gap) {
        gap = g;
        best = i;
      }
    }
    const x = next(best);
    if (x === null) {
      alive[best] = false;
      continue;
    }
    taken[best]++;
    out.push(x);
  }
  return out;
}
