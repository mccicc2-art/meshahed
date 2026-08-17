import { AWARDS } from "./awards";

// العوالم السينمائية — قاموسٌ منسَّق لا بحث (روح D-050).
//
// TMDB يعرف «السلسلة» (belongs_to_collection) ولا يعرف «العالم»: سلسلة
// سبايدر-مان عنده ثلاث مجموعاتٍ منفصلة، ومارفل كله ليس مجموعةً أصلاً.
// فالعالم عندنا قاموسٌ مكتوبٌ باليد، ومصفوفةُ المعرّفات فيه تؤدّي عملين
// معاً: العضوية (هل هذا الفيلم من العالم؟) **والترتيب** — ترتيب الأحداث
// داخل القصة لا تاريخ الإصدار (قرار أحمد: من يفتح القائمة يعرف من أين
// يبدأ وكيف تتسلسل الأحداث، ويلحق ما فاته قبل أي فيلمٍ جديد).
//
// معرّفٌ خاطئ لا يكسر شيئاً: جلبُ تفاصيله يفشل فيسقط من القائمة بصمت
// (moviesByIds تتجاهل الفاشل) — لكن راجِع الإضافات الجديدة على TMDB.
// عند صدور فيلمٍ جديد من عالمٍ: أضف معرّفه في موضعه الزمني هنا، لا أكثر.

export interface Universe {
  slug: string;
  ar: string;
  en: string;
  /** معرّفات TMDB للأفلام **بترتيب الأحداث** — القاموس هو الترتيب.
      غيابها يعني أن المجموعة سلسلة TMDB جاهزة: انظر collectionId */
  movieIds?: number[];
  /** سلسلة TMDB تُحلّ عند الطلب (ترتيب الإصدار) — لما لا يحتاج تنسيقاً
      يدوياً: كتابة معرّفات ٢٧ فيلم كونان باليد دعوةٌ للخطأ، والسلسلة
      عند TMDB تتحدّث بالجديد وحدها. تُحلّ عبر resolveSetIds في tmdb.ts */
  collectionId?: number;
  /** ترتيب أحداثٍ منسّق (العوالم) أم ترتيب إصدار (المجموعات كديزني)؟
      يقرّر سطر الوعد على البطاقة: «بترتيب الأحداث» لا يُقال لما ليس كذلك */
  storyOrder?: boolean;
  /**
   * مجموعة «الأعلى تقييماً» الديناميكية (طلب أحمد — TOP 250): لا معرّفات
   * مكتوبة ولا سلسلة TMDB، بل قوائم top_rated تُحلّ عند الطلب عبر
   * `topRatedRows` في tmdb.ts — فتتحدّث وحدها كل ساعة مع خبيئة tmdb().
   * وجودُها يعني أن العناصر قد تكون مسلسلات لا أفلاماً فقط.
   */
  top?: "movie" | "tv" | "anime";
  /** حجم مجموعة top — الافتراضي ٢٥٠ */
  topLimit?: number;
  /**
   * مجموعة جائزة (طلب أحمد 9 Aug): slug من `awards.ts` — الفائزون
   * يُثبَّتون على TMDB عند الطلب (`awardWinners`) وتُعرض سنةُ الفوز في
   * صدر كل صفّ. لا معرّفات مكتوبة هنا: القاموس أسماءٌ وسنوات.
   */
  award?: string;
}

export const UNIVERSES: Universe[] = [
  {
    storyOrder: true,
    slug: "mcu",
    ar: "عالم مارفل السينمائي",
    en: "Marvel Cinematic Universe",
    movieIds: [
      1771,   // Captain America: The First Avenger (1943)
      299537, // Captain Marvel (1995)
      1726,   // Iron Man
      10138,  // Iron Man 2
      1724,   // The Incredible Hulk
      10195,  // Thor
      24428,  // The Avengers
      68721,  // Iron Man 3
      76338,  // Thor: The Dark World
      100402, // Captain America: The Winter Soldier
      118340, // Guardians of the Galaxy
      283995, // Guardians of the Galaxy Vol. 2
      99861,  // Avengers: Age of Ultron
      102899, // Ant-Man
      271110, // Captain America: Civil War
      497698, // Black Widow
      284054, // Black Panther
      315635, // Spider-Man: Homecoming
      284052, // Doctor Strange
      284053, // Thor: Ragnarok
      363088, // Ant-Man and the Wasp
      299536, // Avengers: Infinity War
      299534, // Avengers: Endgame
      566525, // Shang-Chi and the Legend of the Ten Rings
      524434, // Eternals
      429617, // Spider-Man: Far From Home
      634649, // Spider-Man: No Way Home
      453395, // Doctor Strange in the Multiverse of Madness
      616037, // Thor: Love and Thunder
      505642, // Black Panther: Wakanda Forever
      640146, // Ant-Man and the Wasp: Quantumania
      447365, // Guardians of the Galaxy Vol. 3
      609681, // The Marvels
      533535, // Deadpool & Wolverine
      822119, // Captain America: Brave New World
      986056, // Thunderbolts*
      617126, // The Fantastic Four: First Steps
    ],
  },
  {
    storyOrder: true,
    slug: "dc",
    ar: "عالم DC السينمائي",
    en: "DC Universe",
    movieIds: [
      297762,  // Wonder Woman (1918)
      464052,  // Wonder Woman 1984
      49521,   // Man of Steel
      209112,  // Batman v Superman: Dawn of Justice
      297761,  // Suicide Squad
      141052,  // Justice League
      297802,  // Aquaman
      287947,  // Shazam!
      495764,  // Birds of Prey
      436969,  // The Suicide Squad
      436270,  // Black Adam
      594767,  // Shazam! Fury of the Gods
      298618,  // The Flash
      565770,  // Blue Beetle
      572802,  // Aquaman and the Lost Kingdom
      1061474, // Superman (2025)
    ],
  },
  {
    storyOrder: true,
    slug: "wizarding",
    ar: "عالم هاري بوتر السحري",
    en: "Wizarding World",
    movieIds: [
      259316, // Fantastic Beasts and Where to Find Them (1926)
      338952, // Fantastic Beasts: The Crimes of Grindelwald
      338953, // Fantastic Beasts: The Secrets of Dumbledore
      671,    // Harry Potter and the Philosopher's Stone
      672,    // Harry Potter and the Chamber of Secrets
      673,    // Harry Potter and the Prisoner of Azkaban
      674,    // Harry Potter and the Goblet of Fire
      675,    // Harry Potter and the Order of the Phoenix
      767,    // Harry Potter and the Half-Blood Prince
      12444,  // Harry Potter and the Deathly Hallows: Part 1
      12445,  // Harry Potter and the Deathly Hallows: Part 2
    ],
  },
  {
    storyOrder: true,
    slug: "starwars",
    ar: "عالم حرب النجوم",
    en: "Star Wars",
    movieIds: [
      1893,   // Episode I – The Phantom Menace
      1894,   // Episode II – Attack of the Clones
      1895,   // Episode III – Revenge of the Sith
      348350, // Solo: A Star Wars Story
      330459, // Rogue One: A Star Wars Story
      11,     // Episode IV – A New Hope
      1891,   // Episode V – The Empire Strikes Back
      1892,   // Episode VI – Return of the Jedi
      140607, // Episode VII – The Force Awakens
      181808, // Episode VIII – The Last Jedi
      181812, // Episode IX – The Rise of Skywalker
    ],
  },
];

/**
 * مجموعاتٌ منسّقة ليست «عوالم قصة» — ديزني وبيكسار أوّلها (طلب أحمد
 * لديسكفري القوائم). ترتيبها ترتيب الإصدار، وهي **خارج** `universeOf`
 * عمداً: بطاقة العالم في ترويسة الفيلم (D-080) للعوالم وحدها، وإلا صار
 * كل فيلم ديزني يحمل زرّ «احفظ العالم» بوعدٍ لا يصدق.
 */
export const CURATED: Universe[] = [
  {
    slug: "disney",
    ar: "كلاسيكيات ديزني وبيكسار",
    en: "Disney & Pixar Classics",
    movieIds: [
      408,    // Snow White and the Seven Dwarfs
      11224,  // Cinderella
      10882,  // Sleeping Beauty
      10144,  // The Little Mermaid
      10020,  // Beauty and the Beast
      812,    // Aladdin
      8587,   // The Lion King
      862,    // Toy Story
      10674,  // Mulan
      37135,  // Tarzan
      585,    // Monsters, Inc.
      11544,  // Lilo & Stitch
      12,     // Finding Nemo
      9806,   // The Incredibles
      2062,   // Ratatouille
      10681,  // WALL·E
      14160,  // Up
      38757,  // Tangled
      109445, // Frozen
      150540, // Inside Out
      269149, // Zootopia
      277834, // Moana
      354912, // Coco
      568124, // Encanto
    ],
  },
];

/**
 * قوائم فرعية داخل كل عالم — «مارفل كاملة ثم سبايدر-مان ثم آيرون مان»
 * (طلب أحمد لديسكفري القوائم). خارج `universeOf` كالمنسّقات: بطاقة
 * العالم في الترويسة للعوالم الكاملة وحدها. المعرّفات خارج قواميس
 * العوالم (ريمي، نولان، بيكسار…) مكتوبة يداً بنفس عقيدة D-050 —
 * والخاطئ منها يسقط بصمتٍ من moviesByIds.
 */
export const SUBLISTS: Universe[] = [
  // ---- مارفل ----
  {
    slug: "spiderman",
    ar: "أفلام سبايدر-مان",
    en: "Spider-Man Movies",
    movieIds: [
      557,    // Spider-Man (2002)
      558,    // Spider-Man 2
      559,    // Spider-Man 3
      1930,   // The Amazing Spider-Man
      102382, // The Amazing Spider-Man 2
      315635, // Homecoming
      429617, // Far From Home
      634649, // No Way Home
      324857, // Into the Spider-Verse
      569094, // Across the Spider-Verse
    ],
  },
  {
    storyOrder: true,
    slug: "ironman",
    ar: "آيرون مان",
    en: "Iron Man",
    movieIds: [1726, 10138, 68721],
  },
  {
    storyOrder: true,
    slug: "avengers",
    ar: "الأفنجرز",
    en: "The Avengers",
    movieIds: [24428, 99861, 299536, 299534],
  },
  {
    storyOrder: true,
    slug: "captainamerica",
    ar: "كابتن أمريكا",
    en: "Captain America",
    movieIds: [1771, 100402, 271110, 822119],
  },
  {
    storyOrder: true,
    slug: "thor",
    ar: "ثور",
    en: "Thor",
    movieIds: [10195, 76338, 284053, 616037],
  },
  {
    storyOrder: true,
    slug: "gotg",
    ar: "حراس المجرة",
    en: "Guardians of the Galaxy",
    movieIds: [118340, 283995, 447365],
  },
  // ---- DC ----
  {
    slug: "batman",
    ar: "أفلام باتمان",
    en: "Batman Movies",
    movieIds: [
      268,    // Batman (1989)
      364,    // Batman Returns
      414,    // Batman Forever
      415,    // Batman & Robin
      272,    // Batman Begins
      155,    // The Dark Knight
      49026,  // The Dark Knight Rises
      414906, // The Batman
    ],
  },
  {
    slug: "superman",
    ar: "أفلام سوبرمان",
    en: "Superman Movies",
    movieIds: [
      1924,    // Superman (1978)
      49521,   // Man of Steel
      209112,  // Batman v Superman
      1061474, // Superman (2025)
    ],
  },
  {
    storyOrder: true,
    slug: "joker",
    ar: "جوكر",
    en: "Joker",
    movieIds: [475557, 889737],
  },
  // ---- هاري بوتر ----
  {
    storyOrder: true,
    slug: "harrypotter",
    ar: "أفلام هاري بوتر الثمانية",
    en: "The Harry Potter Films",
    movieIds: [671, 672, 673, 674, 675, 767, 12444, 12445],
  },
  {
    storyOrder: true,
    slug: "fantasticbeasts",
    ar: "الوحوش المذهلة",
    en: "Fantastic Beasts",
    movieIds: [259316, 338952, 338953],
  },
  // ---- حرب النجوم ----
  {
    storyOrder: true,
    slug: "skywalker",
    ar: "ملحمة سكاي ووكر",
    en: "The Skywalker Saga",
    movieIds: [1893, 1894, 1895, 11, 1891, 1892, 140607, 181808, 181812],
  },
  {
    storyOrder: true,
    slug: "swstories",
    ar: "حكايات حرب النجوم",
    en: "A Star Wars Story",
    movieIds: [348350, 330459],
  },
  // ---- ديزني ----
  {
    slug: "pixar",
    ar: "أفلام بيكسار",
    en: "Pixar",
    movieIds: [
      862,     // Toy Story
      863,     // Toy Story 2
      585,     // Monsters, Inc.
      12,      // Finding Nemo
      9806,    // The Incredibles
      2062,    // Ratatouille
      10681,   // WALL·E
      14160,   // Up
      10193,   // Toy Story 3
      150540,  // Inside Out
      354912,  // Coco
      1022789, // Inside Out 2
    ],
  },
];

/**
 * صفوف ديسكفري القوائم: عنوانُ عالمٍ ثم بطاقاته — الكاملة أولاً ثم
 * الفرعيات (طلب أحمد: «مكان الأزرق عالم مارفل، والقوائم: مارفل كامل
 * مرتّب ثم سبايدر-مان ثم آيرون مان وهكذا»).
 */

/**
 * دفعة أحمد الثالثة: «كل القوائم المفروض تكون موجودة ومرتبة».
 * كل مجموعةٍ هنا سلسلة TMDB جاهزة (collectionId) — تتحدّث بالجديد
 * تلقائياً ولا تحتاج صيانة معرّفاتٍ يدوية. الاستثناء ملحمة الخواتم:
 * ترتيب الأحداث (الهوبيت قبل السيّد) منسّق يدوياً كالعوالم.
 */
export const SUBLISTS2: Universe[] = [
  // ===== عالم الأنمي =====
  { slug: "conan-movies", ar: "أفلام المحقق كونان", en: "Detective Conan Movies", collectionId: 39199 },
  { slug: "onepiece-movies", ar: "أفلام ون بيس", en: "One Piece Movies", collectionId: 23456 },
  // ===== مينيونز =====
  { slug: "despicable", ar: "كل أفلام دسبيكابل مي", en: "Despicable Me — All Films", collectionId: 86066 },
  { slug: "minions", ar: "مينيونز", en: "Minions", collectionId: 544669 },
  // ===== عوالم الأكشن =====
  { slug: "bond", ar: "جيمس بوند", en: "James Bond", collectionId: 645 },
  { slug: "mission-impossible", ar: "المهمة المستحيلة", en: "Mission: Impossible", collectionId: 87359 },
  { slug: "fast", ar: "سريع وغاضب", en: "Fast & Furious", collectionId: 9485 },
  { slug: "john-wick", ar: "جون ويك", en: "John Wick", collectionId: 404609 },
  { slug: "matrix", ar: "ماتريكس", en: "The Matrix", collectionId: 2344 },
  // ===== عوالم المغامرة =====
  { slug: "jurassic", ar: "حديقة الديناصورات", en: "Jurassic Park & World", collectionId: 328 },
  { slug: "hunger-games", ar: "ألعاب الجوع", en: "The Hunger Games", collectionId: 131635 },
  {
    storyOrder: true,
    slug: "rings-saga",
    ar: "ملحمة الخواتم بترتيب الأحداث",
    en: "The Rings Saga in Story Order",
    movieIds: [
      49051,  // The Hobbit: An Unexpected Journey
      57158,  // The Hobbit: The Desolation of Smaug
      122917, // The Hobbit: The Battle of the Five Armies
      120,    // The Fellowship of the Ring
      121,    // The Two Towers
      122,    // The Return of the King
    ],
  },
  // ===== أنيميشن عائلي =====
  { slug: "shrek", ar: "شريك", en: "Shrek", collectionId: 2150 },
  { slug: "toy-story", ar: "توي ستوري", en: "Toy Story", collectionId: 10194 },
];


/**
 * مجموعات الجوائز — تُبنى من قاموس `awards.ts` فلا يُكتب اسمٌ مرتين:
 * إضافة جائزةٍ هناك تُظهر بطاقتها هنا تلقائياً.
 */
export const AWARD_SETS: Universe[] = AWARDS.map((a) => ({
  slug: `award-${a.slug}`,
  ar: a.ar,
  en: a.en,
  award: a.slug,
}));

/**
 * TOP 250 (طلب أحمد 9 Aug): ثلاث قوائم ديناميكية — أفلام ومسلسلات
 * وأنمي — تُحلّ من قوائم TMDB top_rated عند الطلب. الترتيب بتقييم TMDB
 * لا IMDb عمداً: ٧٥٠ عملاً بترتيب IMDb تعني ٧٥٠ طلب OMDb — الحصة كلها.
 */
export const TOP_LISTS: Universe[] = [
  { slug: "top250-movies", ar: "أفضل ٢٥٠ فيلماً", en: "Top 250 Movies", top: "movie" },
  { slug: "top250-shows", ar: "أفضل ٢٥٠ مسلسلاً", en: "Top 250 Shows", top: "tv" },
  { slug: "top250-anime", ar: "أفضل ٢٥٠ أنمي", en: "Top 250 Anime", top: "anime" },
];

export interface Franchise {
  slug: string;
  ar: string;
  en: string;
  sets: Universe[];
}

const bySlug = (slug: string): Universe =>
  [...TOP_LISTS, ...AWARD_SETS, ...UNIVERSES, ...CURATED, ...SUBLISTS, ...SUBLISTS2].find((u) => u.slug === slug)!;

export const FRANCHISES: Franchise[] = [
  /* TOP 250 أول الصفوف (طلب أحمد): مرجعُ الجودة قبل صفوف العوالم */
  {
    slug: "top250",
    ar: "TOP 250",
    en: "TOP 250",
    sets: ["top250-movies", "top250-shows", "top250-anime"].map(bySlug),
  },
  /* صفّ الجوائز (طلب أحمد): بطاقة لكل جائزة — الفائزون من ١٩٩٠ مرتّبين
     بالأحدث، وسنة الفوز مكتوبة في صدر كل صفّ */
  {
    slug: "awards",
    ar: "الجوائز",
    en: "Awards",
    sets: AWARD_SETS,
  },
  {
    slug: "marvel",
    ar: "عالم مارفل",
    en: "Marvel",
    sets: ["mcu", "spiderman", "ironman", "avengers", "captainamerica", "thor", "gotg"].map(bySlug),
  },
  {
    slug: "dcworld",
    ar: "عالم DC",
    en: "DC",
    sets: ["dc", "batman", "superman", "joker"].map(bySlug),
  },
  {
    slug: "wizardingworld",
    ar: "عالم هاري بوتر",
    en: "Wizarding World",
    sets: ["wizarding", "harrypotter", "fantasticbeasts"].map(bySlug),
  },
  {
    slug: "starwarsworld",
    ar: "عالم حرب النجوم",
    en: "Star Wars",
    sets: ["starwars", "skywalker", "swstories"].map(bySlug),
  },
  {
    slug: "disneyworld",
    ar: "ديزني وبيكسار",
    en: "Disney & Pixar",
    sets: ["disney", "pixar"].map(bySlug),
  },
  {
    slug: "anime",
    ar: "عالم الأنمي",
    en: "Anime",
    sets: ["conan-movies", "onepiece-movies"].map(bySlug),
  },
  {
    slug: "minionsworld",
    ar: "مينيونز",
    en: "Minions",
    sets: ["despicable", "minions"].map(bySlug),
  },
  {
    slug: "actionworlds",
    ar: "عوالم الأكشن",
    en: "Action Worlds",
    sets: ["bond", "mission-impossible", "fast", "john-wick", "matrix"].map(bySlug),
  },
  {
    slug: "adventure",
    ar: "عوالم المغامرة",
    en: "Adventure Worlds",
    sets: ["rings-saga", "jurassic", "hunger-games", "shrek", "toy-story"].map(bySlug),
  },

];

export function franchiseName(f: Franchise, locale: "ar" | "en") {
  return locale === "en" ? f.en : f.ar;
}

/** كل المجموعات المنسّقة معاً — قاموس `universeBySlug` (محرّك حفظٍ واحد) */
export function allCuratedSets(): Universe[] {
  return [...TOP_LISTS, ...AWARD_SETS, ...UNIVERSES, ...CURATED, ...SUBLISTS, ...SUBLISTS2];
}

/** أي عالمٍ ينتمي إليه هذا الفيلم؟ — فحصٌ محليّ بلا طلب شبكة (العوالم وحدها) */
export function universeOf(movieId: number): Universe | null {
  return UNIVERSES.find((u) => u.movieIds?.includes(movieId)) ?? null;
}

/** البحث بالـslug يشمل المنسّقات — زرّ الحفظ واحدٌ للجميع (محرّك D-052) */
export function universeBySlug(slug: string): Universe | null {
  return allCuratedSets().find((u) => u.slug === slug) ?? null;
}

export function universeName(u: Universe, locale: "ar" | "en") {
  return locale === "en" ? u.en : u.ar;
}

/**
 * 🆕 **اسمُ قائمةِ لوبز بلغة القارئ** (D-328، الدَّينُ المعلَن).
 *
 * **المولَّدُ يُترجَم عند العرض ولا يُخزَّن بلغتين** (D-147/D-273):
 * `upsert_curated_list` تكتب الاسمَ العربيَّ صفّاً في `user_lists`
 * **لأن للصفِّ عموداً واحداً للاسم**، **والهويّةُ في `source_slug` لا في
 * النصّ** — فالقارئُ الإنجليزيُّ كان يرى «أفضل ٢٥٠ فيلماً» في كلِّ سطحٍ
 * إلّا بطاقةَ الرفّ التي تبني اسمَها من القاموس.
 *
 * **فهذه بوّابةٌ واحدة يمرّ بها كلُّ سطحٍ يعرض اسمَ قائمة**،
 * **وقائمةٌ بلا `source_slug` تعود باسمها كما هو** — فلا يتغيّر شيءٌ
 * لقوائم الناس (D-063: الغيابُ يُقرأ «ليست منسّقة» لا خطأً).
 */
export function curatedName(
  sourceSlug: string | null | undefined,
  storedName: string,
  locale: "ar" | "en",
): string {
  if (!sourceSlug) return storedName;
  const u = universeBySlug(sourceSlug);
  return u ? universeName(u, locale) : storedName;
}

/**
 * 🆕 **نبذةُ قائمةِ لوبز** (D-373، بلاغُ أحمد: «ليستات لوبز لازم يكون لها
 * شرح ونبذة مثل ليستة مشعل»).
 *
 * ================= لماذا تُصاغ ولا تُخزَّن =================
 *
 * **البابُ الرخيص كان عمود `subtitle`**: اثنتان وأربعون قائمةً تُكتب
 * نبذتُها بيدٍ في هجرة. **ورُفض بحجّتين**: عمودُ الاسم واحدٌ في الصفّ
 * فيلحقه عمودُ الوصف بلغةٍ واحدة — **وهو بعينه الدَّينُ الذي سدّدته
 * D-343** (اسمٌ عربيٌّ يقرؤه الإنجليزيّ) — **ونبذةٌ مكتوبةٌ بيدٍ لاثنتين
 * وأربعين قائمةً تتقادم يومَ تتغيّر طريقةُ بنائها.**
 *
 * **فالنبذةُ تُصاغ من القاموس عند العرض** (D-147/D-273 حرفاً): **القاموسُ
 * يعرف كيف بُنيت القائمة** — بترتيب أحداثٍ أم إصدار، من جائزةٍ أم من
 * تقييمات — **فالجملةُ تصف طريقةَ البناء لا تمدح المحتوى.**
 *
 * ⚠️ **ولا رقمَ في الجملة**: «أفضل ٢٥٠» وعدٌ لا عدّ (D-340)، **وقائمةُ
 * الأنمي ١٤٥ اليوم** — **فجملةٌ تقول «مئتان وخمسون» تكذب مرّةً ثانية**
 * (D-219).
 *
 * **وقائمةُ العضو لا تُمَسّ**: `null` تعني «اقرأ `subtitle` كما كتبه
 * صاحبُه» (D-063).
 */
export function curatedBlurb(
  sourceSlug: string | null | undefined,
  locale: "ar" | "en",
): string | null {
  if (!sourceSlug) return null;
  const u = universeBySlug(sourceSlug);
  if (!u) return null;
  const name = universeName(u, locale);
  const en = locale === "en";

  /* **الأعلى تقييماً** — تُبنى من تقييمات IMDb بعتبة D-323/D-365 */
  if (u.top) {
    return en
      ? `Ranked from IMDb ratings, with a floor of 20,000 votes so a high score on a handful of votes cannot climb it.`
      : `مرتَّبةٌ بتقييمات IMDb، وبعتبة عشرين ألف صوتٍ فأكثر — فلا يعلوها عملٌ نال درجةً عاليةً من أصواتٍ قليلة.`;
  }

  /* **الجوائز** — الفائزون بأسمائهم وسنواتهم */
  if (u.award) {
    return en
      ? `Every ${name} winner, year by year — each title carries the year it won.`
      : `الفائزون بـ${name} عبر سنواتها — ومع كلِّ عملٍ سنةُ فوزه.`;
  }

  /* **ترتيبُ الأحداث** — وهو سببُ وجود القاموس أصلاً */
  if (u.storyOrder) {
    return en
      ? `Every ${name} title in story order, not release order — so you know where to start and what follows.`
      : `أعمالُ ${name} كلُّها بترتيب الأحداث لا بترتيب الإصدار — لتعرف من أين تبدأ وما الذي يليه.`;
  }

  /* **والباقي سلسلةٌ بترتيب إصدارها** */
  return en
    ? `The ${name} films in release order, from the first to the newest.`
    : `أفلامُ ${name} بترتيب إصدارها، من أوّلها إلى أحدثها.`;
}
