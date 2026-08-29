/**
 * خطّةُ الحساب — **قاعدةٌ واحدةٌ لكلِّ قارئيها** (D-145، D-633).
 *
 * كلُّ سطحٍ يسأل «هل يملك هذا المزايا؟» يسأل من هنا. **ولا شرطَ
 * `plan === "plus"` مبعثرٌ في مكوّن**: يومَ تدخل طبقةٌ ثالثة أو ينتهي
 * اشتراكٌ بتاريخ، **يتبدّل نصٌّ واحدٌ لا اثنا عشر موضعاً** — وهو الدرسُ
 * نفسُه الذي أخرج `firstEpisodeOf` من ثلاثة قرّاء (D-603).
 *
 * ⚖️ **والتصنيفُ بحكم أحمد** (D-633): البلس **زينةٌ وتنسيقٌ** لا وظيفة.
 * المتابعةُ والقوائمُ والمجتمعُ والبحثُ والترجمةُ مجّانيّةٌ إلى الأبد
 * («لم أمنع خدمات مجانية على الأعضاء») — **وثلاثةٌ من التنسيق نفسِه
 * تبقى مجّانيّةً بحكم الإتاحة لا الكرم** (وافق عليها): اللغةُ وحجمُ
 * الخطّ والوضعُ النهاريّ. **من يكبّر الخطّ يفعلها لعينه لا لذوقه.**
 */

export type Plan = "free" | "plus" | "partner";

export const PLANS: readonly Plan[] = ["free", "plus", "partner"] as const;

/** قارئٌ متسامح: ما ليس في القائمة `free` — ولا يُرمى استثناء */
export function asPlan(value: unknown): Plan {
  return PLANS.includes(value as Plan) ? (value as Plan) : "free";
}

/** الشكلُ الأدنى الذي يكفي للحكم — يقبل `Profile` و`PublicProfile` معاً */
export interface PlanBearer {
  plan?: unknown;
  plus_until?: string | null;
  founder?: boolean | null;
  /* 🆕 **ختمُ التوثيق** (D-773) — **صفةٌ مستقلّةٌ عن الخطّة تماماً**:
     حكمُ أحمد «التوثيقُ لا يُباع ولا يأتي تلقائيّاً مع Plus · Partner
     لا يحصل عليه تلقائيّاً؛ يقدّم بشكلٍ مستقلّ». **فلا تُقرأ من هنا
     خطّةٌ ولا تُقرأ من الخطّة توثيق** — رافدان في شكلٍ واحد. */
  verified_at?: string | null;
}

/**
 * هل له مزايا Loopz+؟
 *
 * **والتاريخُ يُقرأ ولا يُهمَل**: `plus_until` الفارغةُ تعني «بلا انتهاء»
 * (وهي حالُ المؤسِّسين والمشتركِ ما دام مشتركاً)، **والماضيةُ تُسقط
 * المزايا بلا هجرةٍ ليليّةٍ تكنس الجدول** — الصلاحيةُ تُحسب عند القراءة
 * لا تُخزَّن، فلا تتأخّر ساعةَ انتهائها.
 */
export function isPlus(p: PlanBearer | null | undefined): boolean {
  if (!p) return false;
  const plan = asPlan(p.plan);
  if (plan === "free") return false;
  if (!p.plus_until) return true;
  const until = Date.parse(p.plus_until);
  return Number.isNaN(until) ? true : until > Date.now();
}

/** الطبقةُ العليا — البارتنر. **مبنيّةُ البنية، ولمّا تُبنَ سطوحُها** */
export function isPartner(p: PlanBearer | null | undefined): boolean {
  return !!p && asPlan(p.plan) === "partner" && isPlus(p);
}

/**
 * 🆕 **حسابٌ موثَّق** (D-773).
 *
 * ⚖️ **ولا شرطَ خطّةٍ هنا ولا في أيِّ قارئ**: بحكم أحمد التوثيقُ
 * **لا يُباع ولا يأتي تلقائيّاً مع Plus**، **والبارتنر لا يناله
 * تلقائيّاً بل يقدّم طلباً مستقلّاً.** **فمجّانيٌّ موثَّقٌ حالةٌ
 * صحيحةٌ تماماً** — ويومَ يصير التوثيقُ تابعاً للاشتراك تكون العلامةُ
 * قد ماتت («بهذا تبقى العلامةُ نادرةً وموثوقة، ولا تتحوّل إلى مجرّد
 * ميزةٍ مدفوعة»).
 *
 * **والختمُ تاريخٌ لا راية**: وجودُه توثيقٌ قائم، و`null` يعني
 * **مسحوباً أو لم يُمنح** — **وإعادةُ الفحص تكتب `null` بلا حذفِ صفّ**
 * (تغيّرُ الاسم جذريّاً أو انتقالُ ملكيّة الحساب).
 */
export function isVerified(p: PlanBearer | null | undefined): boolean {
  return !!p && typeof p.verified_at === "string" && p.verified_at.length > 0;
}

/** مؤسِّس: **صفةٌ لا خطّة** — تبقى بعد أيِّ تبدّلٍ في الاشتراك (D-633) */
export function isFounder(p: PlanBearer | null | undefined): boolean {
  return !!p && p.founder === true;
}

/**
 * الثيماتُ المجّانيّة — **الافتراضيُّ ووضعُ النهار**.
 *
 * `amber` هو الافتراضيُّ فلا يُقفل، **و`daylight` إتاحةٌ لا زينة**:
 * من يقرأ في الشمس ليس مشترياً محتملاً بل قارئٌ محبوس (D-633، بموافقته).
 * وما عداهما ألوانٌ خالصة — وهي البلس بحقّ.
 */
export const FREE_THEMES: readonly string[] = ["amber", "daylight"] as const;

export function themeNeedsPlus(themeId: string): boolean {
  return !FREE_THEMES.includes(themeId);
}
