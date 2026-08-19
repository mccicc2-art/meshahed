// قاموس الجوائز — بياناتٌ خالصة بلا شبكة (يستوردها العميل والخادم معاً).
//
// TMDB لا يعرف الجوائز إطلاقاً: لا حقلَ فائزٍ ولا مجموعةَ ترشيحات. فالجوائز
// عندنا قاموسٌ مكتوبٌ باليد كالعوالم (universes.ts) — الفارق أن مفتاح كل
// سطرٍ **سنة**، وهي التي تُعرض وتُرتَّب بها القائمة (طلب أحمد: «التاريخ
// مكتوب يمين الفلم مرتبه بالأحدث»).
//
// ولماذا الاسم لا المعرّف: معرّفات TMDB لا تُكتب باليد لمئتي عمل بلا خطأ،
// والاسم + السنة يثبّتهما `searchByName` — ومن لا يُطابَق يسقط بصمت بدل
// أن يكسر القائمة.
//
// السنة سنةُ العمل لا سنةُ الحفل في جوائز الأفلام (أوسكار ٢٠٢٤ = فيلم
// ٢٠٢٤ الفائز في حفل ٢٠٢٥)، وسنةُ الحفل في الإيمي لأن المسلسل يمتدّ
// سنوات.

export interface AwardWin {
  /** سنة العمل (الأفلام) أو سنة الحفل (المسلسلات) — تُعرض وتُرتَّب بها */
  year: number;
  /** الاسم كما تعرفه TMDB — إنجليزيٌّ غالباً */
  title: string;
  /**
   * سنةُ البحث في TMDB حين تخالف `year` — **للبحث لا للعرض** (D-144).
   *
   * حاجتان فرضتاها: (١) سنةُ الجائزة ليست دائماً سنةَ الإصدار —
   * «سينما باراديزو» جائزةُ ١٩٨٩ وإصدارُه ١٩٨٨، وفائزُ كان يُعرض في
   * المهرجان قبل إصداره. (٢) المسلسلات كانت تُبحث **بلا سنة إطلاقاً**،
   * فـ«شوغن» تلتقط نسخة ١٩٨٠ أو ٢٠٢٤ بالحظّ، و«ذا أوفيس» البريطاني
   * أو الأمريكي كذلك. هنا تُكتب سنةُ أوّل بثّ فينحسم الالتباس.
   */
  tmdbYear?: number;
}

export interface Award {
  slug: string;
  ar: string;
  en: string;
  /** جهة الأعمال — تقرّر مسار البحث وتقييد السنة */
  kind: "movie" | "tv";
  /** اسم الجهة المانحة، لسطر البطاقة الثاني */
  bodyAr: string;
  bodyEn: string;
  /* قوائمُ الفائزين ليست هنا عمداً: هذا الملفّ يستورده العميلُ (رقاقات
     التصفية) والخادمُ معاً، و~45KB من صفوف الفائزين كانت تُشحن إلى متصفّح
     كلِّ من فتح فلاتر «اكتشف» ولا يقرؤها إلا الخادم — فهي في
     `awardsWins.ts` وحدَه. */
}

export const AWARDS: Award[] = [
  {
    slug: "oscar-best-picture",
    ar: "الأوسكار — أفضل فيلم",
    en: "Oscars — Best Picture",
    kind: "movie",
    bodyAr: "أكاديمية فنون وعلوم الصور المتحركة",
    bodyEn: "Academy Awards",
  },
  {
    slug: "oscar-international",
    ar: "الأوسكار — أفضل فيلم دولي",
    en: "Oscars — Best International Feature",
    kind: "movie",
    bodyAr: "أكاديمية فنون وعلوم الصور المتحركة",
    bodyEn: "Academy Awards",
  },
  {
    slug: "palme-dor",
    ar: "كان — السعفة الذهبية",
    en: "Cannes — Palme d'Or",
    kind: "movie",
    bodyAr: "مهرجان كان السينمائي",
    bodyEn: "Cannes Film Festival",
  },
  {
    slug: "globe-drama",
    ar: "جولدن جلوب — أفضل فيلم دراما",
    en: "Golden Globes — Best Drama",
    kind: "movie",
    bodyAr: "رابطة هوليوود للصحافة الأجنبية",
    bodyEn: "Golden Globe Awards",
  },
  {
    slug: "bafta-best-film",
    ar: "بافتا — أفضل فيلم",
    en: "BAFTA — Best Film",
    kind: "movie",
    bodyAr: "الأكاديمية البريطانية لفنون الفيلم والتلفزيون",
    bodyEn: "British Academy Film Awards",
  },
  {
    slug: "golden-lion",
    ar: "فينيسيا — الأسد الذهبي",
    en: "Venice — Golden Lion",
    kind: "movie",
    bodyAr: "مهرجان فينيسيا السينمائي",
    bodyEn: "Venice Film Festival",
  },
  {
    slug: "golden-bear",
    ar: "برلين — الدبّ الذهبي",
    en: "Berlin — Golden Bear",
    kind: "movie",
    bodyAr: "مهرجان برلين السينمائي",
    bodyEn: "Berlin International Film Festival",
  },
  {
    slug: "emmy-drama",
    ar: "إيمي — أفضل مسلسل دراما",
    en: "Emmys — Outstanding Drama Series",
    kind: "tv",
    bodyAr: "أكاديمية التلفزيون",
    bodyEn: "Primetime Emmy Awards",
  },
  {
    slug: "emmy-comedy",
    ar: "إيمي — أفضل مسلسل كوميدي",
    en: "Emmys — Outstanding Comedy Series",
    kind: "tv",
    bodyAr: "أكاديمية التلفزيون",
    bodyEn: "Primetime Emmy Awards",
  },
];

export function awardBySlug(slug: string): Award | null {
  return AWARDS.find((a) => a.slug === slug) ?? null;
}

export function awardName(a: Award, locale: "ar" | "en") {
  return locale === "en" ? a.en : a.ar;
}

export function awardBody(a: Award, locale: "ar" | "en") {
  return locale === "en" ? a.bodyEn : a.bodyAr;
}

