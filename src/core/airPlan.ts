/**
 * ============ جدولُ عرض المسلسل — منطقٌ نقيّ (D-1614) ============
 *
 * أحمد ١ نوفمبر بلقطتَي التقويم و«أسبوعك»: «ليه الأسابيع الباقيه مافيها شي مع العلم بلاك كلوفر كل سبت؟» — «١ أ · ٢ أ».
 * صفُّ المتابعة يحمل موعدَ القادمة وحدَها (D-828)، فالتقويمُ يكتب سبتاً واحداً ويسكت عن الباقي. الآن لكلِّ مسلسلٍ يُعرض
 * «خطّة»: ما أعلنته TMDB من مواعيد حلقات موسمه (مؤكَّدٌ يُرسم كما هو)، ثمّ — إن كان يمشي أسبوعاً بأسبوع — ما بعدها
 * **متوقَّعاً** يُرسم باهتاً بكلمته («ليس موعداً مؤكَّداً» يُقال ولا يُخبّأ — D-063).
 *
 * 🔑 **هنا الحسابُ وحدَه** (لا نداءَ ولا `@/`): الجلبُ في `lib/airSchedule.ts`، والاختبارُ في `airPlan.test.ts`.
 */

/** حلقةٌ كما تحتاجها الخطّة — من حلقات موسم TMDB */
export interface AirEp {
  ep: number;
  /** `YYYY-MM-DD` أو `null` لحلقةٍ مُدرجةٍ بلا موعد */
  date: string | null;
  /** `episode_type` عند TMDB: `standard` · `finale` · `mid_season` */
  type?: string | null;
}

export interface AirPlan {
  /** المواعيدُ المعلنة من اليوم فصاعداً — مرتّبةٌ بلا تكرار (حلقتان في يومٍ يومٌ واحد) */
  announced: string[];
  /** آخرُ موعدٍ معروف (معروضٍ أو معلن) */
  last: string | null;
  /** يمشي أسبوعاً بأسبوع؟ — آخرُ المواعيد في يوم الأسبوع نفسِه (D-1614c) */
  weekly: boolean;
  /** كم حلقةً تُتوقَّع بعد آخر موعد: `null` مفتوحٌ (يُعرض ولا نهايةَ معلنة) · `0` لا شيء */
  more: number | null;
}

export interface PlanDate {
  date: string;
  /** متوقَّعٌ من الإيقاع الأسبوعيّ لا معلَن */
  expected: boolean;
}

const DAY = 86_400_000;
/** سقفُ ما يُتوقَّع لمسلسلٍ واحد — التقويمُ يرى أربعةَ أشهرٍ على الأكثر (`MONTHS_AHEAD` + الحاليّ) */
const MAX_EXPECTED = 20;

function dayMs(d: string): number {
  return Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
}

function addDays(d: string, n: number): string {
  return new Date(dayMs(d) + n * DAY).toISOString().slice(0, 10);
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * **الخطّةُ من حلقات الموسم.** `open` = المسلسلُ ما زال يُنتَج (`in_production` عند TMDB).
 *
 * - **الأسبوعيّة** تُحكم من آخر ستّة مواعيدَ مختلفة (ثلاثةٌ على الأقلّ): يومُ الأسبوع نفسُه، وتوقّفُ أسبوعٍ واحدٌ مسموح (D-1614c).
 *   موعدان وحدهما لا يكفيان — عرضٌ أوّلُ ثمّ ثانٍ بعد أسبوعٍ قد يكون حلقتين افتتاحيّتين لا إيقاعاً.
 * - **كم بعد الأخير**: حلقةٌ أخيرةٌ معلَّمةٌ «ختام» (`finale` / `mid_season`) تُغلق الباب. وإلّا فالحلقاتُ المُدرجةُ بلا موعدٍ
 *   بعد آخر حلقةٍ مؤرَّخة هي العدد (TMDB تُدرج الموسمَ أحياناً قبل مواعيده). ولا شيءَ مُدرجاً ⇒ مفتوحٌ إن كان يُنتَج، وإلّا لا شيء.
 */
export function airPlanOf(episodes: readonly AirEp[], today: string, open: boolean): AirPlan {
  const eps = [...episodes].filter((e) => Number.isFinite(e.ep)).sort((a, b) => a.ep - b.ep);
  const dated = eps.filter((e): e is AirEp & { date: string } => !!e.date && ISO_DAY.test(e.date));
  const dates = [...new Set(dated.map((e) => e.date))].sort();
  const last = dates.length ? dates[dates.length - 1] : null;
  const announced = dates.filter((d) => d >= today);

  /* 🆕 D-1614c — **قاعدةُ اليوم الثابت** (أحمد ١ نوفمبر: «نبغا جدول توقعي دقيق» — «٢ أ»): كانت آخرُ ثلاثة مواعيدَ متتاليةٍ
     سبعةً سبعة، فأسبوعُ توقّفٍ واحدٌ (كونان يتوقّف لمباراةٍ أو خاصّ) يُسقط المسلسلَ من التوقّع أسابيع. الآن آخرُ ستّةِ مواعيد
     (ثلاثةٌ على الأقلّ): كلُّ فرقٍ أسبوعٌ أو أسبوعان — فاليومُ نفسُه دائماً — وتوقّفٌ واحدٌ مسموح. يومٌ آخرُ أو توقّفان أو أكثرُ
     من أسبوعين ⇐ ليس أسبوعيّاً، فلا نخترع مواعيد. */
  const tail = dates.slice(-6);
  const gaps = tail.slice(1).map((d, i) => Math.round((dayMs(d) - dayMs(tail[i])) / DAY));
  const weekly = tail.length >= 3 && gaps.every((g) => g === 7 || g === 14) && gaps.filter((g) => g === 14).length <= 1;

  let more: number | null = 0;
  const lastEp = dated.length ? dated[dated.length - 1] : null;
  if (lastEp && (lastEp.type === "finale" || lastEp.type === "mid_season")) more = 0;
  else {
    const undated = lastEp ? eps.filter((e) => e.ep > lastEp.ep && !e.date).length : 0;
    more = undated > 0 ? undated : open ? null : 0;
  }
  return { announced, last, weekly, more };
}

/**
 * **أيّامُ المسلسل في مدىً** — المعلنُ كما هو، ثمّ المتوقَّعُ كلَّ سبعة أيّامٍ بعد آخر موعدٍ معروف حتى `until`.
 * لا توقّعَ لمسلسلٍ آخرُ موعدٍ له مضى (الصفُّ لم يُحدَّث بعد — لا نبني على قديم)، ولا أكثرَ من `more` ولا من السقف.
 */
export function planDates(plan: AirPlan, today: string, until: string): PlanDate[] {
  const out: PlanDate[] = plan.announced.filter((d) => d <= until).map((date) => ({ date, expected: false }));
  if (!plan.weekly || !plan.last || plan.last < today || plan.more === 0) return out;
  const cap = Math.min(plan.more ?? MAX_EXPECTED, MAX_EXPECTED);
  let d = addDays(plan.last, 7);
  for (let n = 0; n < cap && d <= until; n++, d = addDays(d, 7)) out.push({ date: d, expected: true });
  return out;
}
