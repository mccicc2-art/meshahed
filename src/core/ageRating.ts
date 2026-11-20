/**
 * ====== شارةُ التصنيف العمريّ — وصفةٌ واحدةٌ للويب والتطبيق (T492) ======
 *
 * أحمد ٢٠ نوفمبر: «TV PG الناس مايفهمونها يبغون +18 و +13 بنفس أيقوناتها المتعارف عليها» — «٤ أ ٥ب ٦ أ».
 * فرموزُ OMDb الأمريكيّة تُترجم إلى أربع درجاتٍ يعرفها الناس، **كلُّ درجةٍ بلونها المتعارف** (أخضر · أزرق · أصفر · أحمر).
 * ⚖️ **وهذا ينقض D-286** («إطارٌ لا لون»): الحجّةُ كانت أنّ التصنيفَ ليس حالة — وما زال ليس حالة؛ لكنّ الرمزَ الأصليّ
 * لم يُفهم، واللونُ هنا لغةٌ عامّةٌ للعمر لا لونُ حالةٍ من ألوان الثيم، فهو ثابتٌ في كلّ ثيم كشارة IMDb الصفراء.
 *
 * - **الرمزُ الأصليّ لا يضيع**: يبقى في اسم الإتاحة (`code`) لمن يقرأ بقارئ الشاشة.
 * - **ما لا نعرف درجتَه يُخفى** (Approved · Passed · Not Rated · Unrated…): شارةٌ مخمَّنةٌ أسوأ من لا شارة.
 * - وحدةٌ نقيّةٌ بلا React: الويبُ (`HeroRatings`) والتطبيقُ (`TitleExtras`) يقرآنها، فلا خريطتان تفترقان.
 * 🆕 T494 — **الرمزُ الرسميُّ نفسُه لا رقمٌ مترجَم، ومعناه عند الضغط** (أحمد ٢١ نوفمبر: «خلها بالأحرف مثل الرسمي و إذا ضغط عليها
 * الشخص يطلع التعريف و شرح لها»، ثمّ «نفذ» على الصور): الشارةُ تكتب R · TV-MA · PG-13… بلون درجتها، والضغطُ يفتح ورقةً فيها
 * المعنى بكلمة وشرحُه بسطرين وموقعُه بين رموز عائلته. «‎+13» كانت تُخفي الفرقَ بين PG-13 وTV-14 — والرمزُ الرسميُّ لا يخفي شيئاً.
 * والدرجاتُ الخمسُ بقيت **ألواناً** لا نصّاً:
 * T494 — **درجةٌ خامسة: ‎+16 برتقاليّة لِـR وTV-MA** (أحمد ٢١ نوفمبر بلقطة Ted Lasso: «ال R هي متعارف عليه ١٨ او ١٦؟» — «ج»):
 * حدُّهما الأمريكيُّ ١٧ بمرافقة وليّ أمر لا ١٨، وأغلبُ أعمالهما تأخذ ١٥–١٦ خارج أمريكا؛ فـ‎+18 صارت لِـNC-17 وحدَها (لا يدخل
 * من عمره ١٧ أو أقلّ) — التي تعني ١٨ فعلاً.
 */

export type AgeTier = "g" | "7" | "13" | "16" | "18";
export type AgeFamily = "movie" | "tv";
type Lang = "ar" | "en";

export type AgeBadge = {
  tier: AgeTier;
  family: AgeFamily;
  /** الرمزُ الرسميُّ كما يُكتب في الشارة (`TV-Y7-FV` يُكتب `TV-Y7`) — لاتينيٌّ باتّجاه LTR */
  text: string;
  /** لونُ الشارة — ثابتٌ في كلّ ثيم */
  bg: string;
  /** لونُ الكتابة عليها: الأسودُ على الأصفر والبرتقاليّ (T494)، فالأبيضُ لا يُقرأ عليهما */
  fg: string;
  /** الرمزُ كما جاء من OMDb */
  code: string;
};

const COLORS: Record<AgeTier, { bg: string; fg: string }> = {
  g: { bg: "#16a34a", fg: "#ffffff" },
  "7": { bg: "#2563eb", fg: "#ffffff" },
  "13": { bg: "#facc15", fg: "#000000" },
  /* T494 — برتقاليٌّ بين أصفر ‎+13 وأحمر ‎+18، والكتابةُ سوداء كالأصفر: الأبيضُ على البرتقاليّ ≈٣ تباينٌ لا يكفي خطّاً بحجم ١٠–١٢،
     والأسودُ ≈٧٫٦ — ويفترق عن الأحمر بالكتابة أيضاً لا باللون وحدَه */
  "16": { bg: "#f97316", fg: "#000000" },
  "18": { bg: "#dc2626", fg: "#ffffff" },
};

type Entry = { tier: AgeTier; family: AgeFamily; name: Record<Lang, string>; desc: Record<Lang, string> };

/**
 * الرموزُ الرسميّة: MPA للأفلام وTV Parental Guidelines للمسلسلات — **بترتيبها من الأصغر للأكبر** (ترتيبُ «السُّلَّم» في الورقة).
 * المعنى والشرحُ تلخيصٌ لتعريف الجهتين لا ترجمةٌ حرفيّة؛ والدرجاتُ: R وTV-MA ‎+16 برتقاليّ («ج»)، وNC-17 وحدَها أحمر.
 */
const CODES: Record<string, Entry> = {
  G: { tier: "g", family: "movie", name: { ar: "لكل الأعمار", en: "General audiences" }, desc: { ar: "مناسب لكل الأعمار، ولا شيء فيه يقلق الأهل.", en: "Suitable for all ages; nothing that would concern parents." } },
  PG: { tier: "7", family: "movie", name: { ar: "إرشاد الأهل", en: "Parental guidance suggested" }, desc: { ar: "بعض المحتوى قد لا يناسب الأطفال، ويُستحسن أن يقرّر الأهل.", en: "Some material may not be suitable for children; parents should decide." } },
  "PG-13": { tier: "13", family: "movie", name: { ar: "تحذير شديد للأهل", en: "Parents strongly cautioned" }, desc: { ar: "بعض المحتوى قد لا يناسب من هم دون 13 سنة.", en: "Some material may be inappropriate for children under 13." } },
  R: { tier: "16", family: "movie", name: { ar: "مقيّد", en: "Restricted" }, desc: { ar: "من هم دون 17 سنة يشاهدونه بصحبة أحد الوالدين أو وليّ أمر بالغ. قد يحتوي على عنف أو ألفاظ بذيئة أو مشاهد للكبار.", en: "Under 17 requires an accompanying parent or adult guardian. May contain violence, strong language or adult content." } },
  "NC-17": { tier: "18", family: "movie", name: { ar: "للبالغين فقط", en: "Adults only" }, desc: { ar: "لا يُسمح لمن عمره 17 سنة أو أقلّ.", en: "No one 17 and under admitted." } },
  "TV-Y": { tier: "g", family: "tv", name: { ar: "لكل الأطفال", en: "All children" }, desc: { ar: "مصمَّم ليناسب الأطفال من كل الأعمار.", en: "Designed to be appropriate for all children." } },
  "TV-Y7": { tier: "7", family: "tv", name: { ar: "من 7 سنوات", en: "Older children" }, desc: { ar: "للأطفال من 7 سنوات فأكثر، وقد يحتوي على عنف خيالي خفيف.", en: "For children 7 and older; may include mild fantasy violence." } },
  "TV-G": { tier: "g", family: "tv", name: { ar: "للجميع", en: "General audience" }, desc: { ar: "مناسب لأغلب الأعمار، بلا عنف أو ألفاظ أو مشاهد تُذكر.", en: "Suitable for most ages, with little or no violence, strong language or adult content." } },
  "TV-PG": { tier: "7", family: "tv", name: { ar: "إرشاد الأهل", en: "Parental guidance suggested" }, desc: { ar: "قد يحتوي على ما لا يناسب الأطفال الصغار، ويُستحسن أن يشاهده الأهل معهم.", en: "May contain material unsuitable for younger children; parents may want to watch with them." } },
  "TV-14": { tier: "13", family: "tv", name: { ar: "تحذير شديد للأهل", en: "Parents strongly cautioned" }, desc: { ar: "قد لا يناسب من هم دون 14 سنة.", en: "May be unsuitable for children under 14." } },
  "TV-MA": { tier: "16", family: "tv", name: { ar: "للكبار", en: "Mature audience only" }, desc: { ar: "مخصّص للبالغين، وقد لا يناسب من هم دون 17 سنة. قد يحتوي على عنف أو ألفاظ بذيئة أو مشاهد للكبار.", en: "Intended for adults and may be unsuitable for children under 17. May contain violence, crude language or adult content." } },
};

/** صيغٌ أخرى للرمز نفسِه */
const ALIAS: Record<string, string> = { "TV-Y7-FV": "TV-Y7" };

const key = (rated: string) => {
  const k = rated.toUpperCase().replace(/\s+/g, "");
  return ALIAS[k] ?? k;
};

/** رمزُ OMDb ⇐ شارتُه، أو `null` لِما لا تعريفَ له. يتسامح مع المسافات وحالة الأحرف («tv-ma ») */
export function ageBadge(rated: string | null | undefined): AgeBadge | null {
  if (!rated) return null;
  const code = rated.trim();
  const text = key(code);
  const e = CODES[text];
  if (!e) return null;
  return { tier: e.tier, family: e.family, text, code, ...COLORS[e.tier] };
}

export type AgeInfo = {
  /** المعنى بكلمة («للكبار») — عنوانُ الورقة */
  name: string;
  /** الشرح — سطرٌ أو اثنان */
  desc: string;
  /** «التصنيف الأمريكي الرسمي للمسلسلات» */
  source: string;
  /** «موقعه بين تصنيفات المسلسلات» */
  ladderLabel: string;
  /** طرفا السُّلَّم */
  young: string;
  old: string;
  /** رموزُ عائلته من الأصغر للأكبر، ورمزُه بينها (`on`) */
  ladder: (AgeBadge & { on: boolean })[];
};

/** ما تعرضه ورقةُ التعريف — للويب (`AgeMark`) والتطبيق (`RatingsLine`) معاً */
export function ageInfo(b: AgeBadge, locale: string): AgeInfo {
  const l: Lang = locale === "en" ? "en" : "ar";
  const e = CODES[b.text]!;
  const tv = b.family === "tv";
  return {
    name: e.name[l],
    desc: e.desc[l],
    source: l === "ar" ? (tv ? "التصنيف الأمريكي الرسمي للمسلسلات" : "التصنيف الأمريكي الرسمي للأفلام") : tv ? "Official US TV rating" : "Official US movie rating",
    ladderLabel: l === "ar" ? (tv ? "موقعه بين تصنيفات المسلسلات" : "موقعه بين تصنيفات الأفلام") : tv ? "Where it sits among TV ratings" : "Where it sits among movie ratings",
    young: l === "ar" ? "الأطفال" : "Kids",
    old: l === "ar" ? "الكبار" : "Adults",
    ladder: Object.keys(CODES)
      .filter((k) => CODES[k]!.family === b.family)
      .map((k) => ({ ...ageBadge(k)!, on: k === b.text })),
  };
}

/** اسمُ الإتاحة: «التصنيف العمري: TV-MA، للكبار» */
export function ageA11y(b: AgeBadge, label: string, locale: string): string {
  return `${label}: ${b.text}${locale === "en" ? ", " : "، "}${ageInfo(b, locale).name}`;
}
