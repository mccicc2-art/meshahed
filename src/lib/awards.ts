// قاموس الجوائز — بياناتٌ خالصة بلا شبكة (يستوردها العميل والخادم معاً).
//
// TMDB لا يعرف الجوائز إطلاقاً: لا حقلَ فائزٍ ولا مجموعةَ ترشيحات. فالجوائز
// عندنا قاموسٌ مكتوبٌ باليد كالعوالم (universes.ts) — الفارق أن مفتاح كل
// سطرٍ **سنة**، وهي التي تُعرض وتُرتَّب بها القائمة (طلب أحمد: «التاريخ
// مكتوب يمين الفلم مرتبه بالأحدث»).
//
// ولماذا الاسم لا المعرّف: معرّفات TMDB لا تُكتب باليد لمئتي عمل بلا خطأ،
// والاسم + السنة يثبّتهما `searchByName` (نفس مثبِّت بحث الذكاء) — ومن لا
// يُطابَق يسقط بصمت بدل أن يكسر القائمة.
//
// السنة سنةُ العمل لا سنةُ الحفل في جوائز الأفلام (أوسكار ٢٠٢٤ = فيلم
// ٢٠٢٤ الفائز في حفل ٢٠٢٥)، وسنةُ الحفل في الإيمي لأن المسلسل يمتدّ
// سنوات. ولذلك لا نقيّد بحث المسلسلات بسنة — نقيّد الأفلام وحدها.

export interface AwardWin {
  /** سنة العمل (الأفلام) أو سنة الحفل (المسلسلات) — تُعرض وتُرتَّب بها */
  year: number;
  /** الاسم كما تعرفه TMDB — إنجليزيٌّ غالباً */
  title: string;
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
  wins: AwardWin[];
}

/* ملاحظة صيانة: عند إعلان فائزٍ جديد أضف سطراً واحداً في رأس المصفوفة
   — لا شيء آخر. القوائم تُرتَّب بالسنة تنازلياً عند العرض لا هنا.
   آخر تحديث: **فائزو ٢٠٢٥** في القوائم الستّ (أوسكار أفضل فيلم «One
   Battle After Another» وأفضل فيلم دولي «Sentimental Value» من حفل
   ٢٠٢٦ · السعفة «It Was Just an Accident» من كان ٢٠٢٥ · جولدن جلوب
   دراما «Hamnet» من حفل ٢٠٢٦ · إيمي دراما «The Pitt» وكوميدي «The
   Studio» من حفل ٢٠٢٥). */

/* لماذا يبلغ **الأوسكار وحده** سنة ١٩٧٠ وتقف البقية عند ١٩٩٠:
   طلب أحمد التمديد إلى ما قبل ١٩٩٠ **إن أمكن** («اسحب عليها حالياً» إن
   لم تكفِ المساحة). وأفضلُ فيلمٍ في الأوسكار قائمةٌ واحدةٌ لا لبس فيها،
   تحقّقنا منها سطراً سطراً من مصدرٍ منشور. أما البقية فلا:
   - **السعفة قبل ١٩٧٥ ليست سعفة** أصلاً بل «الجائزة الكبرى»، وسنواتُ
     السبعينات والثمانينات فيها **تعادلاتٌ** (فيلمان في العام الواحد) —
     ونموذجنا سطرٌ واحدٌ لكل سنة، فالتمديد يكذب أو يُسقط فائزاً.
   - **الأوسكار الدولي والإيمي قبل ١٩٩٠** أعمالٌ كثيرٌ منها ضعيف التغطية
     في TMDB، فيسقط صفُّها بصمت في `searchByName` — قائمةٌ بثقوبٍ أسوأ
     من قائمةٍ قصيرةٍ صادقة.
   فائزٌ خاطئ في قاموسٍ دائم أسوأ من قائمةٍ أقصر. من أراد تمديدها فليأتِ
   بمصدرٍ مُتحقَّقٍ سنةً سنة، ولْيُعالج التعادل في `AwardWin` أوّلاً. */

const OSCAR_BEST_PICTURE: AwardWin[] = [
  { year: 2025, title: "One Battle After Another" },
  { year: 2024, title: "Anora" },
  { year: 2023, title: "Oppenheimer" },
  { year: 2022, title: "Everything Everywhere All at Once" },
  { year: 2021, title: "CODA" },
  { year: 2020, title: "Nomadland" },
  { year: 2019, title: "Parasite" },
  { year: 2018, title: "Green Book" },
  { year: 2017, title: "The Shape of Water" },
  { year: 2016, title: "Moonlight" },
  { year: 2015, title: "Spotlight" },
  { year: 2014, title: "Birdman" },
  { year: 2013, title: "12 Years a Slave" },
  { year: 2012, title: "Argo" },
  { year: 2011, title: "The Artist" },
  { year: 2010, title: "The King's Speech" },
  { year: 2009, title: "The Hurt Locker" },
  { year: 2008, title: "Slumdog Millionaire" },
  { year: 2007, title: "No Country for Old Men" },
  { year: 2006, title: "The Departed" },
  { year: 2005, title: "Crash" },
  { year: 2004, title: "Million Dollar Baby" },
  { year: 2003, title: "The Lord of the Rings: The Return of the King" },
  { year: 2002, title: "Chicago" },
  { year: 2001, title: "A Beautiful Mind" },
  { year: 2000, title: "Gladiator" },
  { year: 1999, title: "American Beauty" },
  { year: 1998, title: "Shakespeare in Love" },
  { year: 1997, title: "Titanic" },
  { year: 1996, title: "The English Patient" },
  { year: 1995, title: "Braveheart" },
  { year: 1994, title: "Forrest Gump" },
  { year: 1993, title: "Schindler's List" },
  { year: 1992, title: "Unforgiven" },
  { year: 1991, title: "The Silence of the Lambs" },
  { year: 1990, title: "Dances with Wolves" },
  /* عقدان إلى الوراء (طلب أحمد ١٠ أغسطس: «اللي قبل 1990 مهي موجودة»).
     أُضيفا هنا وحدهما دون بقية الجوائز — السبب مكتوبٌ في رأس الملف. */
  { year: 1989, title: "Driving Miss Daisy" },
  { year: 1988, title: "Rain Man" },
  { year: 1987, title: "The Last Emperor" },
  { year: 1986, title: "Platoon" },
  { year: 1985, title: "Out of Africa" },
  { year: 1984, title: "Amadeus" },
  { year: 1983, title: "Terms of Endearment" },
  { year: 1982, title: "Gandhi" },
  { year: 1981, title: "Chariots of Fire" },
  { year: 1980, title: "Ordinary People" },
  { year: 1979, title: "Kramer vs. Kramer" },
  { year: 1978, title: "The Deer Hunter" },
  { year: 1977, title: "Annie Hall" },
  { year: 1976, title: "Rocky" },
  { year: 1975, title: "One Flew Over the Cuckoo's Nest" },
  { year: 1974, title: "The Godfather Part II" },
  { year: 1973, title: "The Sting" },
  { year: 1972, title: "The Godfather" },
  { year: 1971, title: "The French Connection" },
  { year: 1970, title: "Patton" },
];

const OSCAR_INTERNATIONAL: AwardWin[] = [
  { year: 2025, title: "Sentimental Value" },
  { year: 2024, title: "I'm Still Here" },
  { year: 2023, title: "The Zone of Interest" },
  { year: 2022, title: "All Quiet on the Western Front" },
  { year: 2021, title: "Drive My Car" },
  { year: 2020, title: "Another Round" },
  { year: 2019, title: "Parasite" },
  { year: 2018, title: "Roma" },
  { year: 2017, title: "A Fantastic Woman" },
  { year: 2016, title: "The Salesman" },
  { year: 2015, title: "Son of Saul" },
  { year: 2014, title: "Ida" },
  { year: 2013, title: "The Great Beauty" },
  { year: 2012, title: "Amour" },
  { year: 2011, title: "A Separation" },
  { year: 2010, title: "In a Better World" },
  { year: 2009, title: "The Secret in Their Eyes" },
  { year: 2008, title: "Departures" },
  { year: 2007, title: "The Counterfeiters" },
  { year: 2006, title: "The Lives of Others" },
  { year: 2005, title: "Tsotsi" },
  { year: 2004, title: "The Sea Inside" },
  { year: 2003, title: "The Barbarian Invasions" },
  { year: 2002, title: "Nowhere in Africa" },
  { year: 2001, title: "No Man's Land" },
  { year: 2000, title: "Crouching Tiger, Hidden Dragon" },
  { year: 1999, title: "All About My Mother" },
  { year: 1998, title: "Life Is Beautiful" },
  { year: 1997, title: "Character" },
  { year: 1996, title: "Kolya" },
  { year: 1995, title: "Antonia's Line" },
  { year: 1994, title: "Burnt by the Sun" },
  { year: 1993, title: "Belle Époque" },
  { year: 1992, title: "Indochine" },
  { year: 1991, title: "Mediterraneo" },
  { year: 1990, title: "Journey of Hope" },
];

const PALME_DOR: AwardWin[] = [
  { year: 2025, title: "It Was Just an Accident" },
  { year: 2024, title: "Anora" },
  { year: 2023, title: "Anatomy of a Fall" },
  { year: 2022, title: "Triangle of Sadness" },
  { year: 2021, title: "Titane" },
  // ٢٠٢٠ بلا مهرجان (كوفيد) — لا سطر لها
  { year: 2019, title: "Parasite" },
  { year: 2018, title: "Shoplifters" },
  { year: 2017, title: "The Square" },
  { year: 2016, title: "I, Daniel Blake" },
  { year: 2015, title: "Dheepan" },
  { year: 2014, title: "Winter Sleep" },
  { year: 2013, title: "Blue Is the Warmest Colour" },
  { year: 2012, title: "Amour" },
  { year: 2011, title: "The Tree of Life" },
  { year: 2010, title: "Uncle Boonmee Who Can Recall His Past Lives" },
  { year: 2009, title: "The White Ribbon" },
  { year: 2008, title: "The Class" },
  { year: 2007, title: "4 Months, 3 Weeks and 2 Days" },
  { year: 2006, title: "The Wind That Shakes the Barley" },
  { year: 2005, title: "L'Enfant" },
  { year: 2004, title: "Fahrenheit 9/11" },
  { year: 2003, title: "Elephant" },
  { year: 2002, title: "The Pianist" },
  { year: 2001, title: "The Son's Room" },
  { year: 2000, title: "Dancer in the Dark" },
  { year: 1999, title: "Rosetta" },
  { year: 1998, title: "Eternity and a Day" },
  { year: 1997, title: "Taste of Cherry" },
  { year: 1996, title: "Secrets & Lies" },
  { year: 1995, title: "Underground" },
  { year: 1994, title: "Pulp Fiction" },
  { year: 1993, title: "Farewell My Concubine" },
  { year: 1992, title: "The Best Intentions" },
  { year: 1991, title: "Barton Fink" },
  { year: 1990, title: "Wild at Heart" },
];

const GLOBE_DRAMA: AwardWin[] = [
  { year: 2025, title: "Hamnet" },
  { year: 2024, title: "The Brutalist" },
  { year: 2023, title: "Oppenheimer" },
  { year: 2022, title: "The Fabelmans" },
  { year: 2021, title: "The Power of the Dog" },
  { year: 2020, title: "Nomadland" },
  { year: 2019, title: "1917" },
  { year: 2018, title: "Bohemian Rhapsody" },
  { year: 2017, title: "Three Billboards Outside Ebbing, Missouri" },
  { year: 2016, title: "Moonlight" },
  { year: 2015, title: "The Revenant" },
  { year: 2014, title: "Boyhood" },
  { year: 2013, title: "12 Years a Slave" },
  { year: 2012, title: "Argo" },
  { year: 2011, title: "The Descendants" },
  { year: 2010, title: "The Social Network" },
  { year: 2009, title: "Avatar" },
  { year: 2008, title: "Slumdog Millionaire" },
  { year: 2007, title: "Atonement" },
  { year: 2006, title: "Babel" },
  { year: 2005, title: "Brokeback Mountain" },
  { year: 2004, title: "The Aviator" },
  { year: 2003, title: "The Lord of the Rings: The Return of the King" },
  { year: 2002, title: "The Hours" },
  { year: 2001, title: "A Beautiful Mind" },
  { year: 2000, title: "Gladiator" },
  { year: 1999, title: "American Beauty" },
  { year: 1998, title: "Saving Private Ryan" },
  { year: 1997, title: "Titanic" },
  { year: 1996, title: "The English Patient" },
  { year: 1995, title: "Sense and Sensibility" },
  { year: 1994, title: "Forrest Gump" },
  { year: 1993, title: "Schindler's List" },
  { year: 1992, title: "Scent of a Woman" },
  { year: 1991, title: "Bugsy" },
  { year: 1990, title: "Dances with Wolves" },
];

/* الإيمي بسنة الحفل، والمكرّر يُطوى إلى أحدث فوزٍ له عند العرض:
   «ماد مِن» أربع مرات صفٌّ واحد لا أربعة */
const EMMY_DRAMA: AwardWin[] = [
  { year: 2025, title: "The Pitt" },
  { year: 2024, title: "Shōgun" },
  { year: 2023, title: "Succession" },
  { year: 2022, title: "Succession" },
  { year: 2021, title: "The Crown" },
  { year: 2020, title: "Succession" },
  { year: 2019, title: "Game of Thrones" },
  { year: 2018, title: "Game of Thrones" },
  { year: 2017, title: "The Handmaid's Tale" },
  { year: 2016, title: "Game of Thrones" },
  { year: 2015, title: "Game of Thrones" },
  { year: 2014, title: "Breaking Bad" },
  { year: 2013, title: "Breaking Bad" },
  { year: 2012, title: "Homeland" },
  { year: 2011, title: "Mad Men" },
  { year: 2010, title: "Mad Men" },
  { year: 2009, title: "Mad Men" },
  { year: 2008, title: "Mad Men" },
  { year: 2007, title: "The Sopranos" },
  { year: 2006, title: "24" },
  { year: 2005, title: "Lost" },
  { year: 2004, title: "The Sopranos" },
  { year: 2003, title: "The West Wing" },
  { year: 2002, title: "The West Wing" },
  { year: 2001, title: "The West Wing" },
  { year: 2000, title: "The West Wing" },
  { year: 1999, title: "The Practice" },
  { year: 1998, title: "The Practice" },
  { year: 1997, title: "Law & Order" },
  { year: 1996, title: "ER" },
  { year: 1995, title: "NYPD Blue" },
  { year: 1994, title: "Picket Fences" },
  { year: 1993, title: "Picket Fences" },
  { year: 1992, title: "Northern Exposure" },
  { year: 1991, title: "L.A. Law" },
  { year: 1990, title: "L.A. Law" },
];

const EMMY_COMEDY: AwardWin[] = [
  { year: 2025, title: "The Studio" },
  { year: 2024, title: "Hacks" },
  { year: 2023, title: "The Bear" },
  { year: 2022, title: "Ted Lasso" },
  { year: 2021, title: "Ted Lasso" },
  { year: 2020, title: "Schitt's Creek" },
  { year: 2019, title: "Fleabag" },
  { year: 2018, title: "The Marvelous Mrs. Maisel" },
  { year: 2017, title: "Veep" },
  { year: 2016, title: "Veep" },
  { year: 2015, title: "Veep" },
  { year: 2014, title: "Modern Family" },
  { year: 2013, title: "Modern Family" },
  { year: 2012, title: "Modern Family" },
  { year: 2011, title: "Modern Family" },
  { year: 2010, title: "Modern Family" },
  { year: 2009, title: "30 Rock" },
  { year: 2008, title: "30 Rock" },
  { year: 2007, title: "30 Rock" },
  { year: 2006, title: "The Office" },
  { year: 2005, title: "Everybody Loves Raymond" },
  { year: 2004, title: "Arrested Development" },
  { year: 2003, title: "Everybody Loves Raymond" },
  { year: 2002, title: "Friends" },
  { year: 2001, title: "Sex and the City" },
  { year: 2000, title: "Will & Grace" },
  { year: 1999, title: "Ally McBeal" },
  { year: 1998, title: "Frasier" },
  { year: 1997, title: "Frasier" },
  { year: 1996, title: "Frasier" },
  { year: 1995, title: "Frasier" },
  { year: 1994, title: "Frasier" },
  { year: 1993, title: "Seinfeld" },
  { year: 1992, title: "Murphy Brown" },
  { year: 1991, title: "Cheers" },
  { year: 1990, title: "Murphy Brown" },
];

export const AWARDS: Award[] = [
  {
    slug: "oscar-best-picture",
    ar: "الأوسكار — أفضل فيلم",
    en: "Oscars — Best Picture",
    kind: "movie",
    bodyAr: "أكاديمية فنون وعلوم الصور المتحركة",
    bodyEn: "Academy Awards",
    wins: OSCAR_BEST_PICTURE,
  },
  {
    slug: "oscar-international",
    ar: "الأوسكار — أفضل فيلم دولي",
    en: "Oscars — Best International Feature",
    kind: "movie",
    bodyAr: "أكاديمية فنون وعلوم الصور المتحركة",
    bodyEn: "Academy Awards",
    wins: OSCAR_INTERNATIONAL,
  },
  {
    slug: "palme-dor",
    ar: "كان — السعفة الذهبية",
    en: "Cannes — Palme d'Or",
    kind: "movie",
    bodyAr: "مهرجان كان السينمائي",
    bodyEn: "Cannes Film Festival",
    wins: PALME_DOR,
  },
  {
    slug: "globe-drama",
    ar: "جولدن جلوب — أفضل فيلم دراما",
    en: "Golden Globes — Best Drama",
    kind: "movie",
    bodyAr: "رابطة هوليوود للصحافة الأجنبية",
    bodyEn: "Golden Globe Awards",
    wins: GLOBE_DRAMA,
  },
  {
    slug: "emmy-drama",
    ar: "إيمي — أفضل مسلسل دراما",
    en: "Emmys — Outstanding Drama Series",
    kind: "tv",
    bodyAr: "أكاديمية التلفزيون",
    bodyEn: "Primetime Emmy Awards",
    wins: EMMY_DRAMA,
  },
  {
    slug: "emmy-comedy",
    ar: "إيمي — أفضل مسلسل كوميدي",
    en: "Emmys — Outstanding Comedy Series",
    kind: "tv",
    bodyAr: "أكاديمية التلفزيون",
    bodyEn: "Primetime Emmy Awards",
    wins: EMMY_COMEDY,
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

/**
 * الفائزون بلا تكرار — الأحدث أولاً.
 *
 * المسلسل يفوز مواسمَ متتالية، فأربعة أسطرٍ لعملٍ واحد تُقرأ خطأً لا
 * إنجازاً: يُطوى إلى أحدث فوزٍ له. والأفلام لا تتكرّر أصلاً فالطيّ لا
 * يمسّها. (والعمل الذي فاز بجائزتين مختلفتين يظهر في قائمة كلٍّ منهما —
 * هذا صحيحٌ لا تكرار.)
 */
export function awardWins(a: Award): AwardWin[] {
  const best = new Map<string, AwardWin>();
  for (const w of a.wins) {
    const prev = best.get(w.title);
    if (!prev || w.year > prev.year) best.set(w.title, w);
  }
  return [...best.values()].sort((x, y) => y.year - x.year);
}
