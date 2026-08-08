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
  /** معرّفات TMDB للأفلام **بترتيب الأحداث** — القاموس هو الترتيب */
  movieIds: number[];
}

export const UNIVERSES: Universe[] = [
  {
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

/** أي عالمٍ ينتمي إليه هذا الفيلم؟ — فحصٌ محليّ بلا طلب شبكة */
export function universeOf(movieId: number): Universe | null {
  return UNIVERSES.find((u) => u.movieIds.includes(movieId)) ?? null;
}

export function universeBySlug(slug: string): Universe | null {
  return UNIVERSES.find((u) => u.slug === slug) ?? null;
}

export function universeName(u: Universe, locale: "ar" | "en") {
  return locale === "en" ? u.en : u.ar;
}
