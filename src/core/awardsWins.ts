// قوائمُ الفائزين — **خادمٌ فقط عمليّاً**: `awards.ts` (الأسماء والجهات)
// يستورده العميلُ في رقاقات التصفية، وهذه الصفوفُ (~900 سطرٍ من
// {سنة، عنوان}) لا يقرؤها إلا بناءُ قوائم الجوائز على الخادم — ففصلُها
// يُخرجها من حِزم `/news` و`/lists` و`/library` كلِّها.
// (لا `server-only` عليها: لا سرَّ فيها، والفصلُ اقتصادٌ لا حراسة.)

import type { Award, AwardWin } from "./awards";

/* ملاحظة صيانة: عند إعلان فائزٍ جديد أضف سطراً واحداً في رأس المصفوفة
   — لا شيء آخر. القوائم تُرتَّب بالسنة تنازلياً عند العرض لا هنا.
   آخر تحديث: **فائزو ٢٠٢٥**، و**التمديد الكامل إلى أوّل سنةٍ لكل جائزة**
   (D-144، بطلب أحمد).

   كيف جُمعت بيانات التمديد، ولماذا يُذكر ذلك هنا: أوّل استخراجٍ آليّ
   لجدول السعفة من ويكيبيديا عاد **مزاحاً سنتين** (نسب «تاكسي درايفر»
   إلى ١٩٧٨ وهو ١٩٧٦)، وجدولُ الإيمي عاد بثلاثة فائزين خاطئين. فكل سطرٍ
   هنا مأخوذٌ من **مقالة سنته أو حفلته** لا من جدولٍ جامع، ومُثبَّتٌ
   بمصدرَين مستقلَّين على الأقل (ويكيبيديا لكل حفل · oscars.org ·
   televisionacademy.com · festival-cannes.com · filmsite · Ebert).
   **لا تُضِف سطراً من جدولٍ جامعٍ دون تثبيته بمقالة سنته.** */

/**
 * أوسكار أفضل فيلم — أكمل قوائمنا: من ١٩٢٧ إلى اليوم.
 *
 * الحفلات الستّ الأولى كانت **مواسمَ مقسّمة** بين سنتين (١٩٢٧/٢٨ …)،
 * ولا تحمل `AwardWin` سنتين. اعتمدنا **سنة الإصدار كما في TMDB** —
 * فالسنة المعروضة تطابق ما يراه المستخدم في صفحة العمل، والبحث يجدها.
 * ولذلك **لا سطر لـ١٩٢٨**: فيلم الحفل الثاني («The Broadway Melody»)
 * صدر ١٩٢٩. فجوةٌ مقصودة لا نقص.
 */
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
  { year: 1969, title: "Midnight Cowboy" },
  { year: 1968, title: "Oliver!" },
  { year: 1967, title: "In the Heat of the Night" },
  { year: 1966, title: "A Man for All Seasons" },
  { year: 1965, title: "The Sound of Music" },
  { year: 1964, title: "My Fair Lady" },
  { year: 1963, title: "Tom Jones" },
  { year: 1962, title: "Lawrence of Arabia" },
  { year: 1961, title: "West Side Story" },
  { year: 1960, title: "The Apartment" },
  { year: 1959, title: "Ben-Hur" },
  { year: 1958, title: "Gigi" },
  { year: 1957, title: "The Bridge on the River Kwai" },
  // سجلّ الأكاديمية «Around the World in Eighty Days»، وTMDB بالرقم
  { year: 1956, title: "Around the World in 80 Days" },
  { year: 1955, title: "Marty" },
  { year: 1954, title: "On the Waterfront" },
  { year: 1953, title: "From Here to Eternity" },
  { year: 1952, title: "The Greatest Show on Earth" },
  { year: 1951, title: "An American in Paris" },
  { year: 1950, title: "All About Eve" },
  { year: 1949, title: "All the King's Men" },
  { year: 1948, title: "Hamlet" },
  { year: 1947, title: "Gentleman's Agreement" },
  { year: 1946, title: "The Best Years of Our Lives" },
  { year: 1945, title: "The Lost Weekend" },
  { year: 1944, title: "Going My Way" },
  { year: 1943, title: "Casablanca" },
  { year: 1942, title: "Mrs. Miniver" },
  { year: 1941, title: "How Green Was My Valley" },
  { year: 1940, title: "Rebecca" },
  { year: 1939, title: "Gone with the Wind" },
  { year: 1938, title: "You Can't Take It with You" },
  { year: 1937, title: "The Life of Emile Zola" },
  { year: 1936, title: "The Great Ziegfeld" },
  { year: 1935, title: "Mutiny on the Bounty" },
  { year: 1934, title: "It Happened One Night" },
  /* من هنا إلى الأسفل: المواسم المقسّمة، بسنة الإصدار (انظر رأس القائمة) */
  { year: 1933, title: "Cavalcade" },
  { year: 1932, title: "Grand Hotel" },
  { year: 1931, title: "Cimarron" },
  { year: 1930, title: "All Quiet on the Western Front" },
  { year: 1929, title: "The Broadway Melody" },
  /* الحفل الأول منح جائزتين عُليَين: «Outstanding Picture» لـ«Wings»
     و«Unique and Artistic Production» لـ«Sunrise». الأكاديمية تعدّ
     الأولى سلسلةَ «أفضل فيلم»، والثانية أُلغيت بعد عامها الوحيد. */
  { year: 1927, title: "Wings" },
];

/**
 * أوسكار أفضل فيلم دولي — تنافسيّةٌ من ١٩٥٦، وقبلها **جائزةٌ شرفية**
 * (١٩٤٧–١٩٥٥) تُدرجها الأكاديمية نفسها في تاريخ الجائزة، فأُدرجت هنا.
 * ولا جائزة سنة ١٩٥٣ أصلاً — فجوةٌ مقصودة.
 *
 * والحقبة الشرفية كانت تكرّم **إصدار السنة السابقة** غالباً، ولذلك
 * أكثرُها يحمل `tmdbYear`.
 */
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
  { year: 1989, title: "Cinema Paradiso", tmdbYear: 1988 },
  { year: 1988, title: "Pelle the Conqueror", tmdbYear: 1987 },
  { year: 1987, title: "Babette's Feast" },
  { year: 1986, title: "The Assault" },
  { year: 1985, title: "The Official Story" },
  { year: 1984, title: "Dangerous Moves" },
  { year: 1983, title: "Fanny and Alexander", tmdbYear: 1982 },
  /* TMDB لا يحمل لهذا الفيلم اسماً إنجليزياً (الأكاديمية: «To Begin
     Again»)، فالبحث بالاسم الإسباني هو الذي يجده */
  { year: 1982, title: "Volver a empezar" },
  { year: 1981, title: "Mephisto" },
  { year: 1980, title: "Moscow Does Not Believe in Tears" },
  { year: 1979, title: "The Tin Drum" },
  { year: 1978, title: "Get Out Your Handkerchiefs" },
  { year: 1977, title: "Madame Rosa" },
  { year: 1976, title: "Black and White in Color" },
  { year: 1975, title: "Dersu Uzala" },
  { year: 1974, title: "Amarcord", tmdbYear: 1973 },
  { year: 1973, title: "Day for Night" },
  { year: 1972, title: "The Discreet Charm of the Bourgeoisie" },
  { year: 1971, title: "The Garden of the Finzi-Continis", tmdbYear: 1970 },
  { year: 1970, title: "Investigation of a Citizen Above Suspicion" },
  { year: 1969, title: "Z" },
  { year: 1968, title: "War and Peace", tmdbYear: 1968 },
  { year: 1967, title: "Closely Watched Trains", tmdbYear: 1966 },
  { year: 1966, title: "A Man and a Woman" },
  { year: 1965, title: "The Shop on Main Street" },
  { year: 1964, title: "Yesterday, Today and Tomorrow", tmdbYear: 1963 },
  { year: 1963, title: "8½" },
  { year: 1962, title: "Sundays and Cybele" },
  { year: 1961, title: "Through a Glass Darkly" },
  { year: 1960, title: "The Virgin Spring" },
  { year: 1959, title: "Black Orpheus" },
  { year: 1958, title: "Mon Oncle" },
  { year: 1957, title: "Nights of Cabiria" },
  { year: 1956, title: "La Strada", tmdbYear: 1954 },
  /* ↓ الحقبة الشرفية (١٩٤٧–١٩٥٥)، ولا جائزة في ١٩٥٣ */
  { year: 1955, title: "Samurai I: Musashi Miyamoto", tmdbYear: 1954 },
  { year: 1954, title: "Gate of Hell", tmdbYear: 1953 },
  { year: 1952, title: "Forbidden Games" },
  { year: 1951, title: "Rashomon", tmdbYear: 1950 },
  { year: 1950, title: "The Walls of Malapaga", tmdbYear: 1949 },
  { year: 1949, title: "Bicycle Thieves", tmdbYear: 1948 },
  { year: 1948, title: "Monsieur Vincent", tmdbYear: 1947 },
  { year: 1947, title: "Shoeshine", tmdbYear: 1946 },
];

/**
 * كان — الجائزة العليا، بأسمائها كلّها: «الجائزة الكبرى» (١٩٤٦–١٩٥٤)،
 * «السعفة» (١٩٥٥–١٩٦٣)، «الجائزة الكبرى» (١٩٦٤–١٩٧٤)، ثم السعفة منذ
 * ١٩٧٥. السنةُ سنةُ **المهرجان**.
 *
 * فجواتٌ مقصودة كلّها موثّقة: **لا مهرجان** في ١٩٤٨ و١٩٥٠، و**لا جوائز
 * في ١٩٦٨** (أُغلقت الدورة تضامناً مع إضرابات مايو، وصوّت المجلس
 * بالإجماع على ألّا تُمنح جائزة)، و**لا سطر لـ١٩٤٦ و١٩٤٧**: الأولى
 * جائزةٌ مشتركة بين **أحد عشر** فيلماً، والثانية موزّعةٌ على ستّ فئاتٍ
 * بلا فائزٍ عامّ — إدراجهما يجعل سنةً واحدةً أطول من عقدٍ كامل ويسمّي
 * «دَمبو» فائزاً بالسعفة.
 *
 * وتسع سنواتٍ **تعادلٌ بفائزَين** (١٩٥١ · ١٩٥٢ · ١٩٦١ · ١٩٦٦ · ١٩٧٢ ·
 * ١٩٧٣ · ١٩٧٩ · ١٩٨٠ · ١٩٨٢) — سطران بالسنة نفسها، والنموذج يحتملهما.
 */
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
  { year: 1989, title: "Sex, Lies, and Videotape" },
  { year: 1988, title: "Pelle the Conqueror", tmdbYear: 1987 },
  { year: 1987, title: "Under the Sun of Satan" },
  { year: 1986, title: "The Mission" },
  { year: 1985, title: "When Father Was Away on Business" },
  { year: 1984, title: "Paris, Texas" },
  { year: 1983, title: "The Ballad of Narayama" },
  { year: 1982, title: "Missing" },
  { year: 1982, title: "Yol" },
  { year: 1981, title: "Man of Iron" },
  { year: 1980, title: "All That Jazz", tmdbYear: 1979 },
  { year: 1980, title: "Kagemusha" },
  { year: 1979, title: "Apocalypse Now" },
  { year: 1979, title: "The Tin Drum" },
  { year: 1978, title: "The Tree of Wooden Clogs" },
  { year: 1977, title: "Padre Padrone" },
  { year: 1976, title: "Taxi Driver" },
  { year: 1975, title: "Chronicle of the Years of Fire" },
  { year: 1974, title: "The Conversation" },
  { year: 1973, title: "Scarecrow" },
  { year: 1973, title: "The Hireling" },
  { year: 1972, title: "The Working Class Goes to Heaven", tmdbYear: 1971 },
  { year: 1972, title: "The Mattei Affair" },
  { year: 1971, title: "The Go-Between" },
  { year: 1970, title: "M*A*S*H" },
  { year: 1969, title: "if....", tmdbYear: 1968 },
  // ١٩٦٨: أُلغيت الدورة ولم تُمنح جوائز — فجوةٌ موثّقة لا نقص
  { year: 1967, title: "Blowup", tmdbYear: 1966 },
  { year: 1966, title: "A Man and a Woman" },
  { year: 1966, title: "The Birds, the Bees and the Italians" },
  { year: 1965, title: "The Knack ...and How to Get It" },
  { year: 1964, title: "The Umbrellas of Cherbourg" },
  { year: 1963, title: "The Leopard" },
  { year: 1962, title: "Keeper of Promises" },
  { year: 1961, title: "Viridiana" },
  { year: 1961, title: "The Long Absence" },
  { year: 1960, title: "La Dolce Vita" },
  { year: 1959, title: "Black Orpheus" },
  { year: 1958, title: "The Cranes Are Flying", tmdbYear: 1957 },
  { year: 1957, title: "Friendly Persuasion", tmdbYear: 1956 },
  { year: 1956, title: "The Silent World" },
  { year: 1955, title: "Marty" },
  { year: 1954, title: "Gate of Hell", tmdbYear: 1953 },
  { year: 1953, title: "The Wages of Fear" },
  // اسم TMDB الكامل لفيلم ويلز، وإلا التقط البحث أيَّ «عطيل»
  { year: 1952, title: "The Tragedy of Othello: The Moor of Venice", tmdbYear: 1951 },
  { year: 1952, title: "Two Cents Worth of Hope" },
  { year: 1951, title: "Miracle in Milan" },
  { year: 1951, title: "Miss Julie" },
  // ١٩٥٠ و١٩٤٨ بلا مهرجان
  { year: 1949, title: "The Third Man" },
];

/**
 * جولدن جلوب — أفضل فيلم دراما. **تبدأ من ١٩٥١** لأن انقسام
 * دراما/كوميديا بدأ هناك؛ وما قبلها (١٩٤٣–١٩٥٠) جائزةٌ واحدة بلا
 * انقسام، وإدراجُها تحت عنوان «دراما» يسمّي «Going My Way» — وهو
 * كوميديا موسيقية — فائزاً بجائزة الدراما. **الفئةُ ليست الجائزةَ.**
 *
 * و١٩٥٣ استثناء: عُلِّق الانقسام في حفلها ومُنحت جائزةٌ واحدة لـ«The
 * Robe» — أُدرجت لأنها أعلى تكريمٍ سينمائيّ في سنتها ولأن ويكيبيديا
 * تدرجها في جدول الدراما نفسه.
 */
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
  { year: 1989, title: "Born on the Fourth of July" },
  { year: 1988, title: "Rain Man" },
  { year: 1987, title: "The Last Emperor" },
  { year: 1986, title: "Platoon" },
  { year: 1985, title: "Out of Africa" },
  { year: 1984, title: "Amadeus" },
  { year: 1983, title: "Terms of Endearment" },
  { year: 1982, title: "E.T. the Extra-Terrestrial" },
  { year: 1981, title: "On Golden Pond" },
  { year: 1980, title: "Ordinary People" },
  { year: 1979, title: "Kramer vs. Kramer" },
  { year: 1978, title: "Midnight Express" },
  { year: 1977, title: "The Turning Point" },
  { year: 1976, title: "Rocky" },
  { year: 1975, title: "One Flew Over the Cuckoo's Nest" },
  { year: 1974, title: "Chinatown" },
  { year: 1973, title: "The Exorcist" },
  { year: 1972, title: "The Godfather" },
  { year: 1971, title: "The French Connection" },
  { year: 1970, title: "Love Story" },
  { year: 1969, title: "Anne of the Thousand Days" },
  { year: 1968, title: "The Lion in Winter" },
  { year: 1967, title: "In the Heat of the Night" },
  { year: 1966, title: "A Man for All Seasons" },
  { year: 1965, title: "Doctor Zhivago" },
  { year: 1964, title: "Becket" },
  { year: 1963, title: "The Cardinal" },
  { year: 1962, title: "Lawrence of Arabia" },
  { year: 1961, title: "The Guns of Navarone" },
  { year: 1960, title: "Spartacus" },
  { year: 1959, title: "Ben-Hur" },
  { year: 1958, title: "The Defiant Ones" },
  { year: 1957, title: "The Bridge on the River Kwai" },
  { year: 1956, title: "Around the World in 80 Days" },
  { year: 1955, title: "East of Eden" },
  { year: 1954, title: "On the Waterfront" },
  { year: 1953, title: "The Robe" },
  { year: 1952, title: "The Greatest Show on Earth" },
  { year: 1951, title: "A Place in the Sun" },
];

/**
 * إيمي أفضل مسلسل دراما — بسنة **الحفل**، من ١٩٥١ (أوّل جائزةٍ
 * دراميّةٍ للبرامج) إلى اليوم. والمكرّر يُطوى إلى أحدث فوزٍ له عند
 * العرض: «ماد مِن» أربع مرات صفٌّ واحد لا أربعة.
 *
 * فجوتان موثّقتان: **١٩٦٥** (دُمجت الفئات كلّها في «إنجاز برامجيّ في
 * الترفيه» فلا فائزَ دراما)، و**١٩٥٧** (كانت الفئات بالمدّة لا
 * بالنوع). وسنتا ١٩٥٨ و١٩٥٩ مُنحت فيهما جوائزُ متوازية؛ اعتمدنا ما
 * تعدّه أكاديمية التلفزيون نفسها سلسلةَ الفئة الحديثة (Gunsmoke ثم
 * Playhouse 90) سطراً واحداً لكل سنة.
 *
 * و`tmdbYear` هنا ليست ترفاً: «شوغن» ١٩٨٠ أم ٢٠٢٤؟ «Upstairs,
 * Downstairs» ١٩٧١ أم ٢٠١٠؟ «The Defenders» ١٩٦١ أم ٢٠١٠ أم مارفل؟
 * بلا سنةِ أوّل بثٍّ كان البحث يلتقط أحدها بالحظّ.
 */
const EMMY_DRAMA: AwardWin[] = [
  { year: 2025, title: "The Pitt", tmdbYear: 2025 },
  { year: 2024, title: "Shōgun", tmdbYear: 2024 },
  { year: 2023, title: "Succession", tmdbYear: 2018 },
  { year: 2022, title: "Succession", tmdbYear: 2018 },
  { year: 2021, title: "The Crown", tmdbYear: 2016 },
  { year: 2020, title: "Succession", tmdbYear: 2018 },
  { year: 2019, title: "Game of Thrones", tmdbYear: 2011 },
  { year: 2018, title: "Game of Thrones", tmdbYear: 2011 },
  { year: 2017, title: "The Handmaid's Tale", tmdbYear: 2017 },
  { year: 2016, title: "Game of Thrones", tmdbYear: 2011 },
  { year: 2015, title: "Game of Thrones", tmdbYear: 2011 },
  { year: 2014, title: "Breaking Bad", tmdbYear: 2008 },
  { year: 2013, title: "Breaking Bad", tmdbYear: 2008 },
  { year: 2012, title: "Homeland", tmdbYear: 2011 },
  { year: 2011, title: "Mad Men", tmdbYear: 2007 },
  { year: 2010, title: "Mad Men", tmdbYear: 2007 },
  { year: 2009, title: "Mad Men", tmdbYear: 2007 },
  { year: 2008, title: "Mad Men", tmdbYear: 2007 },
  { year: 2007, title: "The Sopranos", tmdbYear: 1999 },
  { year: 2006, title: "24", tmdbYear: 2001 },
  { year: 2005, title: "Lost", tmdbYear: 2004 },
  { year: 2004, title: "The Sopranos", tmdbYear: 1999 },
  { year: 2003, title: "The West Wing", tmdbYear: 1999 },
  { year: 2002, title: "The West Wing", tmdbYear: 1999 },
  { year: 2001, title: "The West Wing", tmdbYear: 1999 },
  { year: 2000, title: "The West Wing", tmdbYear: 1999 },
  { year: 1999, title: "The Practice", tmdbYear: 1997 },
  { year: 1998, title: "The Practice", tmdbYear: 1997 },
  { year: 1997, title: "Law & Order", tmdbYear: 1990 },
  { year: 1996, title: "ER", tmdbYear: 1994 },
  { year: 1995, title: "NYPD Blue", tmdbYear: 1993 },
  { year: 1994, title: "Picket Fences", tmdbYear: 1992 },
  { year: 1993, title: "Picket Fences", tmdbYear: 1992 },
  { year: 1992, title: "Northern Exposure", tmdbYear: 1990 },
  { year: 1991, title: "L.A. Law", tmdbYear: 1986 },
  { year: 1990, title: "L.A. Law", tmdbYear: 1986 },
  { year: 1989, title: "L.A. Law", tmdbYear: 1986 },
  { year: 1988, title: "thirtysomething", tmdbYear: 1987 },
  { year: 1987, title: "L.A. Law", tmdbYear: 1986 },
  { year: 1986, title: "Cagney & Lacey", tmdbYear: 1981 },
  { year: 1985, title: "Cagney & Lacey", tmdbYear: 1981 },
  { year: 1984, title: "Hill Street Blues", tmdbYear: 1981 },
  { year: 1983, title: "Hill Street Blues", tmdbYear: 1981 },
  { year: 1982, title: "Hill Street Blues", tmdbYear: 1981 },
  { year: 1981, title: "Hill Street Blues", tmdbYear: 1981 },
  { year: 1980, title: "Lou Grant", tmdbYear: 1977 },
  { year: 1979, title: "Lou Grant", tmdbYear: 1977 },
  { year: 1978, title: "The Rockford Files", tmdbYear: 1974 },
  { year: 1977, title: "Upstairs, Downstairs", tmdbYear: 1971 },
  { year: 1976, title: "Police Story", tmdbYear: 1973 },
  { year: 1975, title: "Upstairs, Downstairs", tmdbYear: 1971 },
  { year: 1974, title: "Upstairs, Downstairs", tmdbYear: 1971 },
  { year: 1973, title: "The Waltons", tmdbYear: 1972 },
  { year: 1972, title: "Elizabeth R", tmdbYear: 1971 },
  { year: 1971, title: "The Bold Ones: The Senator", tmdbYear: 1970 },
  { year: 1970, title: "Marcus Welby, M.D.", tmdbYear: 1969 },
  { year: 1969, title: "NET Playhouse", tmdbYear: 1964 },
  { year: 1968, title: "Mission: Impossible", tmdbYear: 1966 },
  { year: 1967, title: "Mission: Impossible", tmdbYear: 1966 },
  { year: 1966, title: "The Fugitive", tmdbYear: 1963 },
  // ١٩٦٥: دُمجت الفئات — لا فائزَ دراما
  { year: 1964, title: "The Defenders", tmdbYear: 1961 },
  { year: 1963, title: "The Defenders", tmdbYear: 1961 },
  { year: 1962, title: "The Defenders", tmdbYear: 1961 },
  { year: 1961, title: "Hallmark Hall of Fame", tmdbYear: 1951 },
  { year: 1960, title: "Playhouse 90", tmdbYear: 1956 },
  { year: 1959, title: "Playhouse 90", tmdbYear: 1956 },
  { year: 1958, title: "Gunsmoke", tmdbYear: 1955 },
  // ١٩٥٧: الفئات بالمدّة لا بالنوع — لا جائزةَ دراما
  { year: 1956, title: "Producers' Showcase", tmdbYear: 1954 },
  { year: 1955, title: "The United States Steel Hour", tmdbYear: 1953 },
  { year: 1954, title: "The United States Steel Hour", tmdbYear: 1953 },
  { year: 1953, title: "Robert Montgomery Presents", tmdbYear: 1950 },
  { year: 1952, title: "Studio One", tmdbYear: 1948 },
  { year: 1951, title: "Pulitzer Prize Playhouse", tmdbYear: 1950 },
];

/**
 * إيمي أفضل مسلسل كوميدي — بسنة الحفل، من ١٩٥٢ (أوّل فئةٍ كوميدية؛
 * ١٩٥١ لا فئةَ كوميديا فيها أصلاً) إلى اليوم.
 *
 * فجوة **١٩٦٥** كفجوة الدراما، و**١٩٥٧ انقسمت بالمدّة** فمُنح فائزان
 * كوميديان — أُدرجا معاً لأن كليهما كوميديا حقيقية.
 *
 * وأخطرُ التباسٍ في هذه القائمة: **«The Bob Newhart Show» فائز ١٩٦٢
 * هو برنامجه المنوّع (١٩٦١)، لا السيتكوم الشهير (١٩٧٢)** — والاسم
 * واحد. ولذلك `tmdbYear` على كل سطر.
 */
const EMMY_COMEDY: AwardWin[] = [
  { year: 2025, title: "The Studio", tmdbYear: 2025 },
  { year: 2024, title: "Hacks", tmdbYear: 2021 },
  { year: 2023, title: "The Bear", tmdbYear: 2022 },
  { year: 2022, title: "Ted Lasso", tmdbYear: 2020 },
  { year: 2021, title: "Ted Lasso", tmdbYear: 2020 },
  { year: 2020, title: "Schitt's Creek", tmdbYear: 2015 },
  { year: 2019, title: "Fleabag", tmdbYear: 2016 },
  { year: 2018, title: "The Marvelous Mrs. Maisel", tmdbYear: 2017 },
  { year: 2017, title: "Veep", tmdbYear: 2012 },
  { year: 2016, title: "Veep", tmdbYear: 2012 },
  { year: 2015, title: "Veep", tmdbYear: 2012 },
  { year: 2014, title: "Modern Family", tmdbYear: 2009 },
  { year: 2013, title: "Modern Family", tmdbYear: 2009 },
  { year: 2012, title: "Modern Family", tmdbYear: 2009 },
  { year: 2011, title: "Modern Family", tmdbYear: 2009 },
  { year: 2010, title: "Modern Family", tmdbYear: 2009 },
  { year: 2009, title: "30 Rock", tmdbYear: 2006 },
  { year: 2008, title: "30 Rock", tmdbYear: 2006 },
  { year: 2007, title: "30 Rock", tmdbYear: 2006 },
  // النسخة الأمريكية (٢٠٠٥)، لا البريطانية (٢٠٠١)
  { year: 2006, title: "The Office", tmdbYear: 2005 },
  { year: 2005, title: "Everybody Loves Raymond", tmdbYear: 1996 },
  { year: 2004, title: "Arrested Development", tmdbYear: 2003 },
  { year: 2003, title: "Everybody Loves Raymond", tmdbYear: 1996 },
  { year: 2002, title: "Friends", tmdbYear: 1994 },
  { year: 2001, title: "Sex and the City", tmdbYear: 1998 },
  { year: 2000, title: "Will & Grace", tmdbYear: 1998 },
  { year: 1999, title: "Ally McBeal", tmdbYear: 1997 },
  { year: 1998, title: "Frasier", tmdbYear: 1993 },
  { year: 1997, title: "Frasier", tmdbYear: 1993 },
  { year: 1996, title: "Frasier", tmdbYear: 1993 },
  { year: 1995, title: "Frasier", tmdbYear: 1993 },
  { year: 1994, title: "Frasier", tmdbYear: 1993 },
  { year: 1993, title: "Seinfeld", tmdbYear: 1989 },
  { year: 1992, title: "Murphy Brown", tmdbYear: 1988 },
  { year: 1991, title: "Cheers", tmdbYear: 1982 },
  { year: 1990, title: "Murphy Brown", tmdbYear: 1988 },
  { year: 1989, title: "Cheers", tmdbYear: 1982 },
  { year: 1988, title: "The Wonder Years", tmdbYear: 1988 },
  { year: 1987, title: "The Golden Girls", tmdbYear: 1985 },
  { year: 1986, title: "The Golden Girls", tmdbYear: 1985 },
  { year: 1985, title: "The Cosby Show", tmdbYear: 1984 },
  { year: 1984, title: "Cheers", tmdbYear: 1982 },
  { year: 1983, title: "Cheers", tmdbYear: 1982 },
  { year: 1982, title: "Barney Miller", tmdbYear: 1975 },
  { year: 1981, title: "Taxi", tmdbYear: 1978 },
  { year: 1980, title: "Taxi", tmdbYear: 1978 },
  { year: 1979, title: "Taxi", tmdbYear: 1978 },
  { year: 1978, title: "All in the Family", tmdbYear: 1971 },
  { year: 1977, title: "The Mary Tyler Moore Show", tmdbYear: 1970 },
  { year: 1976, title: "The Mary Tyler Moore Show", tmdbYear: 1970 },
  { year: 1975, title: "The Mary Tyler Moore Show", tmdbYear: 1970 },
  { year: 1974, title: "M*A*S*H", tmdbYear: 1972 },
  { year: 1973, title: "All in the Family", tmdbYear: 1971 },
  { year: 1972, title: "All in the Family", tmdbYear: 1971 },
  { year: 1971, title: "All in the Family", tmdbYear: 1971 },
  { year: 1970, title: "My World and Welcome to It", tmdbYear: 1969 },
  { year: 1969, title: "Get Smart", tmdbYear: 1965 },
  { year: 1968, title: "Get Smart", tmdbYear: 1965 },
  { year: 1967, title: "The Monkees", tmdbYear: 1966 },
  { year: 1966, title: "The Dick Van Dyke Show", tmdbYear: 1961 },
  // ١٩٦٥: دُمجت الفئات — لا فائزَ كوميديا
  { year: 1964, title: "The Dick Van Dyke Show", tmdbYear: 1961 },
  { year: 1963, title: "The Dick Van Dyke Show", tmdbYear: 1961 },
  // برنامج نيوهارت المنوّع (١٩٦١) لا سيتكوم ١٩٧٢ الشهير
  { year: 1962, title: "The Bob Newhart Show", tmdbYear: 1961 },
  { year: 1961, title: "The Jack Benny Program", tmdbYear: 1950 },
  { year: 1960, title: "The Art Carney Special", tmdbYear: 1959 },
  { year: 1959, title: "The Jack Benny Program", tmdbYear: 1950 },
  { year: 1958, title: "The Phil Silvers Show", tmdbYear: 1955 },
  // ١٩٥٧: انقسمت الفئة بالمدّة، وكلا الفائزَين كوميديا
  { year: 1957, title: "The Phil Silvers Show", tmdbYear: 1955 },
  { year: 1957, title: "Caesar's Hour", tmdbYear: 1954 },
  { year: 1956, title: "The Phil Silvers Show", tmdbYear: 1955 },
  { year: 1955, title: "Make Room for Daddy", tmdbYear: 1953 },
  { year: 1954, title: "I Love Lucy", tmdbYear: 1951 },
  { year: 1953, title: "I Love Lucy", tmdbYear: 1951 },
  { year: 1952, title: "The Red Skelton Show", tmdbYear: 1951 },
  // ١٩٥١: لا فئةَ كوميديا بعد
];


/**
 * 🆕 **BAFTA — أفضل فيلم** (D-389، طلبُ أحمد: «ضيف BAFTA والأسد الذهبي
 * والدب الذهبي»). من ١٩٤٧ إلى اليوم.
 *
 * ⚠️ **والسنةُ سنةُ الفيلم لا سنةُ الحفل** (قاعدةُ هذا الملفّ): حفلُ ٢٠٢٦
 * كرّم فيلمَ ٢٠٢٥، **فطُرح واحدٌ من كلِّ سنةِ حفل** — **وهو الفرقُ الذي
 * أزاح استخراجاً آليّاً سابقاً بسنتين** (نصُّ الملفّ أعلاه).
 *
 * **والمصدران**: FilmAffinity للقائمة كاملةً، **وbafta.org لتثبيت
 * المحاذاة** — **تسعُ سنواتٍ متطابقةٌ حرفاً** (٢٠١٨→٢٠٢٦)، **وهي التي
 * تُثبت أن العمودَ عمودُ حفلٍ لا عمودُ إصدار.**
 */
export const BAFTA_BEST_FILM: AwardWin[] = [
  { year: 2025, title: "One Battle After Another" },
  { year: 2024, title: "Conclave" },
  { year: 2023, title: "Oppenheimer" },
  { year: 2022, title: "All Quiet on the Western Front" },
  { year: 2021, title: "The Power of the Dog" },
  { year: 2020, title: "Nomadland" },
  { year: 2019, title: "1917" },
  { year: 2018, title: "Roma" },
  { year: 2017, title: "Three Billboards Outside Ebbing, Missouri" },
  { year: 2016, title: "La La Land" },
  { year: 2015, title: "The Revenant" },
  { year: 2014, title: "Boyhood" },
  { year: 2013, title: "12 Years a Slave" },
  { year: 2012, title: "Argo" },
  { year: 2011, title: "The Artist" },
  { year: 2010, title: "The King's Speech" },
  { year: 2009, title: "The Hurt Locker" },
  { year: 2008, title: "Slumdog Millionaire" },
  { year: 2007, title: "Atonement" },
  { year: 2006, title: "The Queen" },
  { year: 2005, title: "Brokeback Mountain" },
  { year: 2004, title: "The Aviator" },
  { year: 2003, title: "The Lord of the Rings: The Return of the King" },
  { year: 2002, title: "The Pianist" },
  { year: 2001, title: "The Lord of the Rings: The Fellowship of the Ring" },
  { year: 2000, title: "Gladiator" },
  { year: 1999, title: "American Beauty" },
  { year: 1998, title: "Shakespeare in Love" },
  { year: 1997, title: "The Full Monty" },
  { year: 1996, title: "The English Patient" },
  { year: 1995, title: "Sense and Sensibility" },
  { year: 1994, title: "Four Weddings and a Funeral" },
  { year: 1993, title: "Schindler's List" },
  { year: 1992, title: "Howards End" },
  { year: 1991, title: "The Commitments" },
  { year: 1990, title: "Goodfellas" },
  { year: 1989, title: "Dead Poets Society" },
  { year: 1988, title: "The Last Emperor" },
  { year: 1987, title: "Jean de Florette" },
  { year: 1986, title: "A Room with a View" },
  { year: 1985, title: "The Purple Rose of Cairo" },
  { year: 1984, title: "The Killing Fields" },
  { year: 1983, title: "Educating Rita" },
  { year: 1982, title: "Gandhi" },
  { year: 1981, title: "Chariots of Fire" },
  { year: 1980, title: "The Elephant Man" },
  { year: 1979, title: "Manhattan" },
  { year: 1978, title: "Julia" },
  { year: 1977, title: "Annie Hall" },
  { year: 1976, title: "One Flew Over the Cuckoo's Nest" },
  { year: 1975, title: "Alice Doesn't Live Here Anymore" },
  { year: 1974, title: "Lacombe, Lucien" },
  { year: 1973, title: "Day for Night" },
  { year: 1972, title: "Cabaret" },
  { year: 1971, title: "Sunday Bloody Sunday" },
  { year: 1970, title: "Butch Cassidy and the Sundance Kid" },
  { year: 1969, title: "Midnight Cowboy" },
  { year: 1968, title: "The Graduate" },
  { year: 1967, title: "A Man for All Seasons" },
  { year: 1966, title: "Who's Afraid of Virginia Woolf?" },
  { year: 1965, title: "My Fair Lady" },
  { year: 1964, title: "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb" },
  { year: 1963, title: "Tom Jones" },
  { year: 1962, title: "Lawrence of Arabia" },
  { year: 1961, title: "Ballad of a Soldier" },
  { year: 1961, title: "The Hustler" },
  { year: 1960, title: "The Apartment" },
  { year: 1959, title: "Ben-Hur" },
  { year: 1958, title: "Room at the Top" },
  { year: 1957, title: "The Bridge on the River Kwai" },
  { year: 1956, title: "Gervaise" },
  { year: 1955, title: "Richard III" },
  { year: 1954, title: "The Wages of Fear" },
  { year: 1953, title: "Forbidden Games" },
  { year: 1952, title: "The Sound Barrier" },
  { year: 1951, title: "La Ronde" },
  { year: 1950, title: "All About Eve" },
  { year: 1949, title: "Bicycle Thieves" },
  { year: 1948, title: "Hamlet" },
  { year: 1947, title: "The Best Years of Our Lives" },
];

/**
 * 🆕 **فينيسيا — الأسد الذهبي** (D-389). من ١٩٤٦ إلى اليوم.
 *
 * ⚠️ **والسنةُ سنةُ المهرجان وهي سنةُ العرض الأوّل** — **لا تُطرح منها
 * سنة**: المهرجانُ يكرّم ما عُرض فيه، **والبحثُ يحتمل ثلاثَ سنواتٍ**
 * لمن تأخّر إصدارُه (`searchByName`).
 *
 * ⚠️ **وسنواتٌ بفائزين اثنين** (١٩٨٠ · ١٩٩٣ · ١٩٩٤ …) — **تعادلٌ حقيقيّ
 * لا تكرار**، **وسنواتٌ بلا فائز** (١٩٦٩–١٩٧٩ حين أُلغيت الجوائز) —
 * **والغيابُ يُترك غياباً** (D-063).
 */
export const GOLDEN_LION: AwardWin[] = [
  { year: 2025, title: "Father Mother Sister Brother" },
  { year: 2024, title: "The Room Next Door" },
  { year: 2023, title: "Poor Things" },
  { year: 2022, title: "All the Beauty and the Bloodshed" },
  { year: 2021, title: "Happening" },
  { year: 2020, title: "Nomadland" },
  { year: 2019, title: "Joker" },
  { year: 2018, title: "Roma" },
  { year: 2017, title: "The Shape of Water" },
  { year: 2016, title: "The Woman Who Left" },
  { year: 2015, title: "From Afar" },
  { year: 2014, title: "A Pigeon Sat on a Branch Reflecting on Existence" },
  { year: 2013, title: "Sacro GRA" },
  { year: 2012, title: "Pieta" },
  { year: 2011, title: "Faust" },
  { year: 2010, title: "Somewhere" },
  { year: 2009, title: "Lebanon" },
  { year: 2008, title: "The Wrestler" },
  { year: 2007, title: "Lust, Caution" },
  { year: 2006, title: "Still Life" },
  { year: 2005, title: "Brokeback Mountain" },
  { year: 2004, title: "Vera Drake" },
  { year: 2003, title: "The Return" },
  { year: 2002, title: "The Magdalene Sisters" },
  { year: 2001, title: "Monsoon Wedding" },
  { year: 2000, title: "The Circle" },
  { year: 1999, title: "Not One Less" },
  { year: 1998, title: "The Way We Laughed" },
  { year: 1997, title: "Fireworks" },
  { year: 1996, title: "Michael Collins" },
  { year: 1995, title: "Cyclo" },
  { year: 1994, title: "Before the Rain" },
  { year: 1994, title: "Vive L'Amour" },
  { year: 1993, title: "Three Colors: Blue" },
  { year: 1993, title: "Short Cuts" },
  { year: 1992, title: "The Story of Qiu Ju" },
  { year: 1991, title: "Close to Eden" },
  { year: 1990, title: "Rosencrantz & Guildenstern Are Dead" },
  { year: 1989, title: "A City of Sadness" },
  { year: 1988, title: "The Legend of the Holy Drinker" },
  { year: 1987, title: "Au revoir les enfants" },
  { year: 1986, title: "The Green Ray" },
  { year: 1985, title: "Vagabond" },
  { year: 1984, title: "A Year of the Quiet Sun" },
  { year: 1983, title: "First Name: Carmen" },
  { year: 1982, title: "The State of Things" },
  { year: 1981, title: "Marianne and Juliane" },
  { year: 1980, title: "Gloria" },
  { year: 1980, title: "Atlantic City" },
  { year: 1968, title: "Artists Under the Big Top: Perplexed" },
  { year: 1967, title: "Belle de Jour" },
  { year: 1966, title: "The Battle of Algiers" },
  { year: 1965, title: "Sandra of a Thousand Delights" },
  { year: 1964, title: "Red Desert" },
  { year: 1963, title: "Hands Over the City" },
  { year: 1962, title: "Family Diary" },
  { year: 1962, title: "Ivan's Childhood" },
  { year: 1961, title: "Last Year at Marienbad" },
  { year: 1960, title: "Le Passage du Rhin" },
  { year: 1959, title: "The Great War" },
  { year: 1959, title: "General della Rovere" },
  { year: 1958, title: "The Rickshaw Man" },
  { year: 1957, title: "Aparajito" },
  { year: 1955, title: "Ordet" },
  { year: 1954, title: "Romeo and Juliet" },
  { year: 1952, title: "Forbidden Games" },
  { year: 1951, title: "Rashomon" },
  { year: 1950, title: "Justice Is Done" },
  { year: 1949, title: "Manon" },
  { year: 1948, title: "Hamlet" },
  { year: 1947, title: "Sirena" },
  { year: 1946, title: "The Southerner" },
];

/**
 * 🆕 **برلين — الدبّ الذهبي** (D-389). من ١٩٥١ إلى اليوم.
 *
 * ⚠️ **والسنةُ سنةُ المهرجان** كأختها في فينيسيا.
 * ⚠️ **و١٩٥١ خمسةُ فائزين** — كانت الجائزةُ تُمنح لكلِّ نوعٍ على حدة،
 * **ويُترك ذلك كما وقع لا كما نتمنّاه.**
 */
export const GOLDEN_BEAR: AwardWin[] = [
  { year: 2026, title: "Yellow Letters" },
  { year: 2025, title: "Dreams (Sex Love)" },
  { year: 2024, title: "Dahomey" },
  { year: 2023, title: "On the Adamant" },
  { year: 2022, title: "Alcarras" },
  { year: 2021, title: "Bad Luck Banging or Loony Porn" },
  { year: 2020, title: "There Is No Evil" },
  { year: 2019, title: "Synonyms" },
  { year: 2018, title: "Touch Me Not" },
  { year: 2017, title: "On Body and Soul" },
  { year: 2016, title: "Fire at Sea" },
  { year: 2015, title: "Taxi Tehran" },
  { year: 2014, title: "Black Coal, Thin Ice" },
  { year: 2013, title: "Child's Pose" },
  { year: 2012, title: "Caesar Must Die" },
  { year: 2011, title: "A Separation" },
  { year: 2010, title: "Honey" },
  { year: 2009, title: "The Milk of Sorrow" },
  { year: 2008, title: "Elite Squad" },
  { year: 2007, title: "Tuya's Marriage" },
  { year: 2006, title: "Grbavica" },
  { year: 2005, title: "U-Carmen e-Khayelitsha" },
  { year: 2004, title: "Head-On" },
  { year: 2003, title: "In This World" },
  { year: 2002, title: "Spirited Away" },
  { year: 2002, title: "Bloody Sunday" },
  { year: 2001, title: "Intimacy" },
  { year: 2000, title: "Magnolia" },
  { year: 1999, title: "The Thin Red Line" },
  { year: 1998, title: "Central Station" },
  { year: 1997, title: "The People vs. Larry Flynt" },
  { year: 1996, title: "Sense and Sensibility" },
  { year: 1995, title: "The Bait" },
  { year: 1994, title: "In the Name of the Father" },
  { year: 1993, title: "The Women from the Lake of Scented Souls" },
  { year: 1993, title: "The Wedding Banquet" },
  { year: 1992, title: "Grand Canyon" },
  { year: 1991, title: "The House of Smiles" },
  { year: 1990, title: "Larks on a String" },
  { year: 1990, title: "Music Box" },
  { year: 1989, title: "Rain Man" },
  { year: 1988, title: "Red Sorghum" },
  { year: 1987, title: "The Theme" },
  { year: 1986, title: "Stammheim" },
  { year: 1985, title: "Wetherby" },
  { year: 1985, title: "The Woman and the Stranger" },
  { year: 1984, title: "Love Streams" },
  { year: 1983, title: "Ascendancy" },
  { year: 1983, title: "The Beehive" },
  { year: 1982, title: "Veronika Voss" },
  { year: 1981, title: "Fast, Fast" },
  { year: 1980, title: "Palermo or Wolfsburg" },
  { year: 1980, title: "Heartland" },
  { year: 1979, title: "David" },
  { year: 1978, title: "The Trout" },
  { year: 1978, title: "What Max Said" },
  { year: 1977, title: "The Ascent" },
  { year: 1976, title: "Buffalo Bill and the Indians, or Sitting Bull's History Lesson" },
  { year: 1975, title: "Adoption" },
  { year: 1974, title: "The Apprenticeship of Duddy Kravitz" },
  { year: 1973, title: "Distant Thunder" },
  { year: 1972, title: "The Canterbury Tales" },
  { year: 1971, title: "The Garden of the Finzi-Continis" },
  { year: 1969, title: "Early Works" },
  { year: 1968, title: "Who Saw Him Die?" },
  { year: 1967, title: "The Departure" },
  { year: 1966, title: "Cul-de-sac" },
  { year: 1965, title: "Alphaville" },
  { year: 1964, title: "Dry Summer" },
  { year: 1963, title: "The Devil" },
  { year: 1963, title: "Bushido, Samurai Saga" },
  { year: 1962, title: "A Kind of Loving" },
  { year: 1961, title: "La Notte" },
  { year: 1960, title: "Lazarillo de Tormes" },
  { year: 1959, title: "The Cousins" },
  { year: 1958, title: "Wild Strawberries" },
  { year: 1957, title: "12 Angry Men" },
  { year: 1956, title: "Invitation to the Dance" },
  { year: 1955, title: "The Rats" },
  { year: 1954, title: "Hobson's Choice" },
  { year: 1953, title: "The Wages of Fear" },
  { year: 1952, title: "One Summer of Happiness" },
  { year: 1951, title: "Four in a Jeep" },
  { year: 1951, title: "Cinderella" },
  { year: 1951, title: "Justice Is Done" },
  { year: 1951, title: "Beaver Valley" },
];


/** الفائزون بمفتاح السلغ — من أضاف جائزةً في `awards.ts` يضيف صفَّها هنا */
export const AWARD_WINS: Record<string, AwardWin[]> = {
  "oscar-best-picture": OSCAR_BEST_PICTURE,
  "oscar-international": OSCAR_INTERNATIONAL,
  "palme-dor": PALME_DOR,
  "globe-drama": GLOBE_DRAMA,
  "bafta-best-film": BAFTA_BEST_FILM,
  "golden-lion": GOLDEN_LION,
  "golden-bear": GOLDEN_BEAR,
  "emmy-drama": EMMY_DRAMA,
  "emmy-comedy": EMMY_COMEDY,
};

/**
 * الفائزون بلا تكرار — الأحدث أولاً.
 *
 * المسلسل يفوز مواسمَ متتالية، فأربعة أسطرٍ لعملٍ واحد تُقرأ خطأً لا
 * إنجازاً: يُطوى إلى أحدث فوزٍ له. والأفلام لا تتكرّر في الجائزة
 * الواحدة إلا نادراً فالطيّ لا يمسّها. (والعمل الذي فاز بجائزتين
 * مختلفتين يظهر في قائمة كلٍّ منهما — هذا صحيحٌ لا تكرار.)
 *
 * والتعادل — فائزان في السنة نفسها — يمرّ كما هو: الطيّ بالعنوان لا
 * بالسنة، فيبقى الصفّان (السعفة تسع سنواتٍ منها).
 */
export function awardWins(a: Award): AwardWin[] {
  const best = new Map<string, AwardWin>();
  for (const w of AWARD_WINS[a.slug] ?? []) {
    const prev = best.get(w.title);
    if (!prev || w.year > prev.year) best.set(w.title, w);
  }
  return [...best.values()].sort((x, y) => y.year - x.year);
}
