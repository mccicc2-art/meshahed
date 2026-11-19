// قوائمُ الفائزين — **خادمٌ فقط عمليّاً**: `awards.ts` (الأسماء والجهات)
// يستورده العميلُ في رقاقات التصفية، وهذه الصفوفُ (~900 سطرٍ من
// {سنة، عنوان}) لا يقرؤها إلا بناءُ قوائم الجوائز على الخادم — ففصلُها
// يُخرجها من حِزم `/news` و`/lists` و`/library` كلِّها.
// (لا `server-only` عليها: لا سرَّ فيها، والفصلُ اقتصادٌ لا حراسة.)

import type { Award, AwardWin } from "./awards";

/* ملاحظة صيانة: عند إعلان فائزٍ جديد أضف سطراً واحداً في رأس المصفوفة
   — لا شيء آخر. القوائم تُرتَّب بالسنة تنازلياً عند العرض لا هنا.
   آخر تحديث: **فائزو ٢٠٢٦** (السعفة · الأسد · الإيمي)، و**التمديد الكامل
   إلى أوّل سنةٍ لكل جائزة** (D-144، بطلب أحمد).

   🔑 **`year` سنةُ الحفل أو المهرجان في كلِّ الجوائز** (أحمد، ١٩ نوفمبر
   ٢٠٢٦: «استخدم سنة الحفل وعمم النظام ذا على بقية الجوائز»). كانت
   الأوسكار وجولدن جلوب وبافتا تُكتب بسنة الفيلم، فقرأ المستخدم «٢٠٢٥»
   بجانب فائز حفل ٢٠٢٦ وظنّ القائمة متأخّرة — بينما الإيمي والمهرجانات
   بسنة حفلها. **سنةٌ واحدةٌ لكلِّ القوائم، وهي التي يسمّي بها الناسُ
   الحفل** («أوسكار ٢٠٢٦»). وسنةُ الفيلم لم تُرمَ: انتقلت إلى `tmdbYear`
   فبقي البحث في TMDB بالسنة نفسها حرفاً — **فلا عملَ يتغيّر تطابقُه.**
   ⚠️ **فائزُ الأوسكار القادم يُكتب بسنة حفله**: حفلُ مارس ٢٠٢٧ = ٢٠٢٧،
   و`tmdbYear` سنةُ الفيلم.

   كيف جُمعت بيانات التمديد، ولماذا يُذكر ذلك هنا: أوّل استخراجٍ آليّ
   لجدول السعفة من ويكيبيديا عاد **مزاحاً سنتين** (نسب «تاكسي درايفر»
   إلى ١٩٧٨ وهو ١٩٧٦)، وجدولُ الإيمي عاد بثلاثة فائزين خاطئين. فكل سطرٍ
   هنا مأخوذٌ من **مقالة سنته أو حفلته** لا من جدولٍ جامع، ومُثبَّتٌ
   بمصدرَين مستقلَّين على الأقل (ويكيبيديا لكل حفل · oscars.org ·
   televisionacademy.com · festival-cannes.com · filmsite · Ebert).
   **لا تُضِف سطراً من جدولٍ جامعٍ دون تثبيته بمقالة سنته.** */

/**
 * أوسكار أفضل فيلم — أكمل قوائمنا: من الحفل الأوّل (١٩٢٩) إلى اليوم.
 * `year` سنةُ الحفل و`tmdbYear` سنةُ الفيلم (رأس الملفّ).
 *
 * ⚠️ **الحفلات الستّ الأولى لا تتبع «سنة الفيلم + ١»**: كانت مواسمَ
 * مقسّمة، **وأُقيم حفلان في ١٩٣٠** (أبريل ونوفمبر) — فلـ«The Broadway
 * Melody» و«All Quiet on the Western Front» السنةُ نفسُها، **وهو ما وقع
 * لا تعادل.** ولا حفلَ في ١٩٣٣ (السادس أُقيم مارس ١٩٣٤). كُتبت هذه
 * السبعُ بتاريخ حفلها واحداً واحداً، وما بعدها حفلُه في السنة التالية
 * لفيلمه.
 */
const OSCAR_BEST_PICTURE: AwardWin[] = [
  { year: 2026, title: "One Battle After Another", tmdbYear: 2025 },
  { year: 2025, title: "Anora", tmdbYear: 2024 },
  { year: 2024, title: "Oppenheimer", tmdbYear: 2023 },
  { year: 2023, title: "Everything Everywhere All at Once", tmdbYear: 2022 },
  { year: 2022, title: "CODA", tmdbYear: 2021 },
  { year: 2021, title: "Nomadland", tmdbYear: 2020 },
  { year: 2020, title: "Parasite", tmdbYear: 2019 },
  { year: 2019, title: "Green Book", tmdbYear: 2018 },
  { year: 2018, title: "The Shape of Water", tmdbYear: 2017 },
  { year: 2017, title: "Moonlight", tmdbYear: 2016 },
  { year: 2016, title: "Spotlight", tmdbYear: 2015 },
  { year: 2015, title: "Birdman", tmdbYear: 2014 },
  { year: 2014, title: "12 Years a Slave", tmdbYear: 2013 },
  { year: 2013, title: "Argo", tmdbYear: 2012 },
  { year: 2012, title: "The Artist", tmdbYear: 2011 },
  { year: 2011, title: "The King's Speech", tmdbYear: 2010 },
  { year: 2010, title: "The Hurt Locker", tmdbYear: 2009 },
  { year: 2009, title: "Slumdog Millionaire", tmdbYear: 2008 },
  { year: 2008, title: "No Country for Old Men", tmdbYear: 2007 },
  { year: 2007, title: "The Departed", tmdbYear: 2006 },
  { year: 2006, title: "Crash", tmdbYear: 2005 },
  { year: 2005, title: "Million Dollar Baby", tmdbYear: 2004 },
  { year: 2004, title: "The Lord of the Rings: The Return of the King", tmdbYear: 2003 },
  { year: 2003, title: "Chicago", tmdbYear: 2002 },
  { year: 2002, title: "A Beautiful Mind", tmdbYear: 2001 },
  { year: 2001, title: "Gladiator", tmdbYear: 2000 },
  { year: 2000, title: "American Beauty", tmdbYear: 1999 },
  { year: 1999, title: "Shakespeare in Love", tmdbYear: 1998 },
  { year: 1998, title: "Titanic", tmdbYear: 1997 },
  { year: 1997, title: "The English Patient", tmdbYear: 1996 },
  { year: 1996, title: "Braveheart", tmdbYear: 1995 },
  { year: 1995, title: "Forrest Gump", tmdbYear: 1994 },
  { year: 1994, title: "Schindler's List", tmdbYear: 1993 },
  { year: 1993, title: "Unforgiven", tmdbYear: 1992 },
  { year: 1992, title: "The Silence of the Lambs", tmdbYear: 1991 },
  { year: 1991, title: "Dances with Wolves", tmdbYear: 1990 },
  { year: 1990, title: "Driving Miss Daisy", tmdbYear: 1989 },
  { year: 1989, title: "Rain Man", tmdbYear: 1988 },
  { year: 1988, title: "The Last Emperor", tmdbYear: 1987 },
  { year: 1987, title: "Platoon", tmdbYear: 1986 },
  { year: 1986, title: "Out of Africa", tmdbYear: 1985 },
  { year: 1985, title: "Amadeus", tmdbYear: 1984 },
  { year: 1984, title: "Terms of Endearment", tmdbYear: 1983 },
  { year: 1983, title: "Gandhi", tmdbYear: 1982 },
  { year: 1982, title: "Chariots of Fire", tmdbYear: 1981 },
  { year: 1981, title: "Ordinary People", tmdbYear: 1980 },
  { year: 1980, title: "Kramer vs. Kramer", tmdbYear: 1979 },
  { year: 1979, title: "The Deer Hunter", tmdbYear: 1978 },
  { year: 1978, title: "Annie Hall", tmdbYear: 1977 },
  { year: 1977, title: "Rocky", tmdbYear: 1976 },
  { year: 1976, title: "One Flew Over the Cuckoo's Nest", tmdbYear: 1975 },
  { year: 1975, title: "The Godfather Part II", tmdbYear: 1974 },
  { year: 1974, title: "The Sting", tmdbYear: 1973 },
  { year: 1973, title: "The Godfather", tmdbYear: 1972 },
  { year: 1972, title: "The French Connection", tmdbYear: 1971 },
  { year: 1971, title: "Patton", tmdbYear: 1970 },
  { year: 1970, title: "Midnight Cowboy", tmdbYear: 1969 },
  { year: 1969, title: "Oliver!", tmdbYear: 1968 },
  { year: 1968, title: "In the Heat of the Night", tmdbYear: 1967 },
  { year: 1967, title: "A Man for All Seasons", tmdbYear: 1966 },
  { year: 1966, title: "The Sound of Music", tmdbYear: 1965 },
  { year: 1965, title: "My Fair Lady", tmdbYear: 1964 },
  { year: 1964, title: "Tom Jones", tmdbYear: 1963 },
  { year: 1963, title: "Lawrence of Arabia", tmdbYear: 1962 },
  { year: 1962, title: "West Side Story", tmdbYear: 1961 },
  { year: 1961, title: "The Apartment", tmdbYear: 1960 },
  { year: 1960, title: "Ben-Hur", tmdbYear: 1959 },
  { year: 1959, title: "Gigi", tmdbYear: 1958 },
  { year: 1958, title: "The Bridge on the River Kwai", tmdbYear: 1957 },
  // سجلّ الأكاديمية «Around the World in Eighty Days»، وTMDB بالرقم
  { year: 1957, title: "Around the World in 80 Days", tmdbYear: 1956 },
  { year: 1956, title: "Marty", tmdbYear: 1955 },
  { year: 1955, title: "On the Waterfront", tmdbYear: 1954 },
  { year: 1954, title: "From Here to Eternity", tmdbYear: 1953 },
  { year: 1953, title: "The Greatest Show on Earth", tmdbYear: 1952 },
  { year: 1952, title: "An American in Paris", tmdbYear: 1951 },
  { year: 1951, title: "All About Eve", tmdbYear: 1950 },
  { year: 1950, title: "All the King's Men", tmdbYear: 1949 },
  { year: 1949, title: "Hamlet", tmdbYear: 1948 },
  { year: 1948, title: "Gentleman's Agreement", tmdbYear: 1947 },
  { year: 1947, title: "The Best Years of Our Lives", tmdbYear: 1946 },
  { year: 1946, title: "The Lost Weekend", tmdbYear: 1945 },
  { year: 1945, title: "Going My Way", tmdbYear: 1944 },
  { year: 1944, title: "Casablanca", tmdbYear: 1943 },
  { year: 1943, title: "Mrs. Miniver", tmdbYear: 1942 },
  { year: 1942, title: "How Green Was My Valley", tmdbYear: 1941 },
  { year: 1941, title: "Rebecca", tmdbYear: 1940 },
  { year: 1940, title: "Gone with the Wind", tmdbYear: 1939 },
  { year: 1939, title: "You Can't Take It with You", tmdbYear: 1938 },
  { year: 1938, title: "The Life of Emile Zola", tmdbYear: 1937 },
  { year: 1937, title: "The Great Ziegfeld", tmdbYear: 1936 },
  { year: 1936, title: "Mutiny on the Bounty", tmdbYear: 1935 },
  { year: 1935, title: "It Happened One Night", tmdbYear: 1934 },
  /* من هنا إلى الأسفل: المواسم المقسّمة، بتاريخ حفلها (انظر رأس القائمة) */
  { year: 1934, title: "Cavalcade", tmdbYear: 1933 },
  { year: 1932, title: "Grand Hotel", tmdbYear: 1932 },
  { year: 1931, title: "Cimarron", tmdbYear: 1931 },
  { year: 1930, title: "All Quiet on the Western Front", tmdbYear: 1930 },
  { year: 1930, title: "The Broadway Melody", tmdbYear: 1929 },
  /* الحفل الأول منح جائزتين عُليَين: «Outstanding Picture» لـ«Wings»
     و«Unique and Artistic Production» لـ«Sunrise». الأكاديمية تعدّ
     الأولى سلسلةَ «أفضل فيلم»، والثانية أُلغيت بعد عامها الوحيد. */
  { year: 1929, title: "Wings", tmdbYear: 1927 },
];

/**
 * أوسكار أفضل فيلم دولي — تنافسيّةٌ من حفل ١٩٥٧ (أفلام ١٩٥٦)، وقبلها
 * **جائزةٌ شرفية** (حفلات ١٩٤٨–١٩٥٦) تُدرجها الأكاديمية نفسها في تاريخ
 * الجائزة، فأُدرجت هنا. ولا جائزة في حفل ١٩٥٤ أصلاً — فجوةٌ مقصودة.
 * `year` سنةُ الحفل و`tmdbYear` سنةُ الفيلم (رأس الملفّ).
 *
 * والحقبة الشرفية كانت تكرّم **إصدار السنة السابقة** غالباً، ولذلك
 * أكثرُها يحمل `tmdbYear`.
 */
const OSCAR_INTERNATIONAL: AwardWin[] = [
  { year: 2026, title: "Sentimental Value", tmdbYear: 2025 },
  { year: 2025, title: "I'm Still Here", tmdbYear: 2024 },
  { year: 2024, title: "The Zone of Interest", tmdbYear: 2023 },
  { year: 2023, title: "All Quiet on the Western Front", tmdbYear: 2022 },
  { year: 2022, title: "Drive My Car", tmdbYear: 2021 },
  { year: 2021, title: "Another Round", tmdbYear: 2020 },
  { year: 2020, title: "Parasite", tmdbYear: 2019 },
  { year: 2019, title: "Roma", tmdbYear: 2018 },
  { year: 2018, title: "A Fantastic Woman", tmdbYear: 2017 },
  { year: 2017, title: "The Salesman", tmdbYear: 2016 },
  { year: 2016, title: "Son of Saul", tmdbYear: 2015 },
  { year: 2015, title: "Ida", tmdbYear: 2014 },
  { year: 2014, title: "The Great Beauty", tmdbYear: 2013 },
  { year: 2013, title: "Amour", tmdbYear: 2012 },
  { year: 2012, title: "A Separation", tmdbYear: 2011 },
  { year: 2011, title: "In a Better World", tmdbYear: 2010 },
  { year: 2010, title: "The Secret in Their Eyes", tmdbYear: 2009 },
  { year: 2009, title: "Departures", tmdbYear: 2008 },
  { year: 2008, title: "The Counterfeiters", tmdbYear: 2007 },
  { year: 2007, title: "The Lives of Others", tmdbYear: 2006 },
  { year: 2006, title: "Tsotsi", tmdbYear: 2005 },
  { year: 2005, title: "The Sea Inside", tmdbYear: 2004 },
  { year: 2004, title: "The Barbarian Invasions", tmdbYear: 2003 },
  { year: 2003, title: "Nowhere in Africa", tmdbYear: 2002 },
  { year: 2002, title: "No Man's Land", tmdbYear: 2001 },
  { year: 2001, title: "Crouching Tiger, Hidden Dragon", tmdbYear: 2000 },
  { year: 2000, title: "All About My Mother", tmdbYear: 1999 },
  { year: 1999, title: "Life Is Beautiful", tmdbYear: 1998 },
  { year: 1998, title: "Character", tmdbYear: 1997 },
  { year: 1997, title: "Kolya", tmdbYear: 1996 },
  { year: 1996, title: "Antonia's Line", tmdbYear: 1995 },
  { year: 1995, title: "Burnt by the Sun", tmdbYear: 1994 },
  { year: 1994, title: "Belle Époque", tmdbYear: 1993 },
  { year: 1993, title: "Indochine", tmdbYear: 1992 },
  { year: 1992, title: "Mediterraneo", tmdbYear: 1991 },
  { year: 1991, title: "Journey of Hope", tmdbYear: 1990 },
  { year: 1990, title: "Cinema Paradiso", tmdbYear: 1988 },
  { year: 1989, title: "Pelle the Conqueror", tmdbYear: 1987 },
  { year: 1988, title: "Babette's Feast", tmdbYear: 1987 },
  { year: 1987, title: "The Assault", tmdbYear: 1986 },
  { year: 1986, title: "The Official Story", tmdbYear: 1985 },
  { year: 1985, title: "Dangerous Moves", tmdbYear: 1984 },
  { year: 1984, title: "Fanny and Alexander", tmdbYear: 1982 },
  /* TMDB لا يحمل لهذا الفيلم اسماً إنجليزياً (الأكاديمية: «To Begin
     Again»)، فالبحث بالاسم الإسباني هو الذي يجده */
  { year: 1983, title: "Volver a empezar", tmdbYear: 1982 },
  { year: 1982, title: "Mephisto", tmdbYear: 1981 },
  { year: 1981, title: "Moscow Does Not Believe in Tears", tmdbYear: 1980 },
  { year: 1980, title: "The Tin Drum", tmdbYear: 1979 },
  { year: 1979, title: "Get Out Your Handkerchiefs", tmdbYear: 1978 },
  { year: 1978, title: "Madame Rosa", tmdbYear: 1977 },
  { year: 1977, title: "Black and White in Color", tmdbYear: 1976 },
  { year: 1976, title: "Dersu Uzala", tmdbYear: 1975 },
  { year: 1975, title: "Amarcord", tmdbYear: 1973 },
  { year: 1974, title: "Day for Night", tmdbYear: 1973 },
  { year: 1973, title: "The Discreet Charm of the Bourgeoisie", tmdbYear: 1972 },
  { year: 1972, title: "The Garden of the Finzi-Continis", tmdbYear: 1970 },
  { year: 1971, title: "Investigation of a Citizen Above Suspicion", tmdbYear: 1970 },
  { year: 1970, title: "Z", tmdbYear: 1969 },
  { year: 1969, title: "War and Peace", tmdbYear: 1968 },
  { year: 1968, title: "Closely Watched Trains", tmdbYear: 1966 },
  { year: 1967, title: "A Man and a Woman", tmdbYear: 1966 },
  { year: 1966, title: "The Shop on Main Street", tmdbYear: 1965 },
  { year: 1965, title: "Yesterday, Today and Tomorrow", tmdbYear: 1963 },
  { year: 1964, title: "8½", tmdbYear: 1963 },
  { year: 1963, title: "Sundays and Cybele", tmdbYear: 1962 },
  { year: 1962, title: "Through a Glass Darkly", tmdbYear: 1961 },
  { year: 1961, title: "The Virgin Spring", tmdbYear: 1960 },
  { year: 1960, title: "Black Orpheus", tmdbYear: 1959 },
  { year: 1959, title: "Mon Oncle", tmdbYear: 1958 },
  { year: 1958, title: "Nights of Cabiria", tmdbYear: 1957 },
  { year: 1957, title: "La Strada", tmdbYear: 1954 },
  /* ↓ الحقبة الشرفية (حفلات ١٩٤٨–١٩٥٦)، ولا جائزة في حفل ١٩٥٤ */
  { year: 1956, title: "Samurai I: Musashi Miyamoto", tmdbYear: 1954 },
  { year: 1955, title: "Gate of Hell", tmdbYear: 1953 },
  { year: 1953, title: "Forbidden Games", tmdbYear: 1952 },
  { year: 1952, title: "Rashomon", tmdbYear: 1950 },
  { year: 1951, title: "The Walls of Malapaga", tmdbYear: 1949 },
  { year: 1950, title: "Bicycle Thieves", tmdbYear: 1948 },
  { year: 1949, title: "Monsieur Vincent", tmdbYear: 1947 },
  { year: 1948, title: "Shoeshine", tmdbYear: 1946 },
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
  { year: 2026, title: "Fjord" },
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
 * جولدن جلوب — أفضل فيلم دراما. **تبدأ من حفل ١٩٥٢** (أفلام ١٩٥١) لأن
 * انقسام دراما/كوميديا بدأ هناك؛ وما قبلها (أفلام ١٩٤٣–١٩٥٠) جائزةٌ واحدة بلا
 * انقسام، وإدراجُها تحت عنوان «دراما» يسمّي «Going My Way» — وهو
 * كوميديا موسيقية — فائزاً بجائزة الدراما. **الفئةُ ليست الجائزةَ.**
 *
 * وحفلُ ١٩٥٤ (أفلام ١٩٥٣) استثناء: عُلِّق الانقسام فيه ومُنحت جائزةٌ واحدة لـ«The
 * Robe» — أُدرجت لأنها أعلى تكريمٍ سينمائيّ في سنتها ولأن ويكيبيديا
 * تدرجها في جدول الدراما نفسه.
 * `year` سنةُ الحفل و`tmdbYear` سنةُ الفيلم (رأس الملفّ).
 */
const GLOBE_DRAMA: AwardWin[] = [
  { year: 2026, title: "Hamnet", tmdbYear: 2025 },
  { year: 2025, title: "The Brutalist", tmdbYear: 2024 },
  { year: 2024, title: "Oppenheimer", tmdbYear: 2023 },
  { year: 2023, title: "The Fabelmans", tmdbYear: 2022 },
  { year: 2022, title: "The Power of the Dog", tmdbYear: 2021 },
  { year: 2021, title: "Nomadland", tmdbYear: 2020 },
  { year: 2020, title: "1917", tmdbYear: 2019 },
  { year: 2019, title: "Bohemian Rhapsody", tmdbYear: 2018 },
  { year: 2018, title: "Three Billboards Outside Ebbing, Missouri", tmdbYear: 2017 },
  { year: 2017, title: "Moonlight", tmdbYear: 2016 },
  { year: 2016, title: "The Revenant", tmdbYear: 2015 },
  { year: 2015, title: "Boyhood", tmdbYear: 2014 },
  { year: 2014, title: "12 Years a Slave", tmdbYear: 2013 },
  { year: 2013, title: "Argo", tmdbYear: 2012 },
  { year: 2012, title: "The Descendants", tmdbYear: 2011 },
  { year: 2011, title: "The Social Network", tmdbYear: 2010 },
  { year: 2010, title: "Avatar", tmdbYear: 2009 },
  { year: 2009, title: "Slumdog Millionaire", tmdbYear: 2008 },
  { year: 2008, title: "Atonement", tmdbYear: 2007 },
  { year: 2007, title: "Babel", tmdbYear: 2006 },
  { year: 2006, title: "Brokeback Mountain", tmdbYear: 2005 },
  { year: 2005, title: "The Aviator", tmdbYear: 2004 },
  { year: 2004, title: "The Lord of the Rings: The Return of the King", tmdbYear: 2003 },
  { year: 2003, title: "The Hours", tmdbYear: 2002 },
  { year: 2002, title: "A Beautiful Mind", tmdbYear: 2001 },
  { year: 2001, title: "Gladiator", tmdbYear: 2000 },
  { year: 2000, title: "American Beauty", tmdbYear: 1999 },
  { year: 1999, title: "Saving Private Ryan", tmdbYear: 1998 },
  { year: 1998, title: "Titanic", tmdbYear: 1997 },
  { year: 1997, title: "The English Patient", tmdbYear: 1996 },
  { year: 1996, title: "Sense and Sensibility", tmdbYear: 1995 },
  { year: 1995, title: "Forrest Gump", tmdbYear: 1994 },
  { year: 1994, title: "Schindler's List", tmdbYear: 1993 },
  { year: 1993, title: "Scent of a Woman", tmdbYear: 1992 },
  { year: 1992, title: "Bugsy", tmdbYear: 1991 },
  { year: 1991, title: "Dances with Wolves", tmdbYear: 1990 },
  { year: 1990, title: "Born on the Fourth of July", tmdbYear: 1989 },
  { year: 1989, title: "Rain Man", tmdbYear: 1988 },
  { year: 1988, title: "The Last Emperor", tmdbYear: 1987 },
  { year: 1987, title: "Platoon", tmdbYear: 1986 },
  { year: 1986, title: "Out of Africa", tmdbYear: 1985 },
  { year: 1985, title: "Amadeus", tmdbYear: 1984 },
  { year: 1984, title: "Terms of Endearment", tmdbYear: 1983 },
  { year: 1983, title: "E.T. the Extra-Terrestrial", tmdbYear: 1982 },
  { year: 1982, title: "On Golden Pond", tmdbYear: 1981 },
  { year: 1981, title: "Ordinary People", tmdbYear: 1980 },
  { year: 1980, title: "Kramer vs. Kramer", tmdbYear: 1979 },
  { year: 1979, title: "Midnight Express", tmdbYear: 1978 },
  { year: 1978, title: "The Turning Point", tmdbYear: 1977 },
  { year: 1977, title: "Rocky", tmdbYear: 1976 },
  { year: 1976, title: "One Flew Over the Cuckoo's Nest", tmdbYear: 1975 },
  { year: 1975, title: "Chinatown", tmdbYear: 1974 },
  { year: 1974, title: "The Exorcist", tmdbYear: 1973 },
  { year: 1973, title: "The Godfather", tmdbYear: 1972 },
  { year: 1972, title: "The French Connection", tmdbYear: 1971 },
  { year: 1971, title: "Love Story", tmdbYear: 1970 },
  { year: 1970, title: "Anne of the Thousand Days", tmdbYear: 1969 },
  { year: 1969, title: "The Lion in Winter", tmdbYear: 1968 },
  { year: 1968, title: "In the Heat of the Night", tmdbYear: 1967 },
  { year: 1967, title: "A Man for All Seasons", tmdbYear: 1966 },
  { year: 1966, title: "Doctor Zhivago", tmdbYear: 1965 },
  { year: 1965, title: "Becket", tmdbYear: 1964 },
  { year: 1964, title: "The Cardinal", tmdbYear: 1963 },
  { year: 1963, title: "Lawrence of Arabia", tmdbYear: 1962 },
  { year: 1962, title: "The Guns of Navarone", tmdbYear: 1961 },
  { year: 1961, title: "Spartacus", tmdbYear: 1960 },
  { year: 1960, title: "Ben-Hur", tmdbYear: 1959 },
  { year: 1959, title: "The Defiant Ones", tmdbYear: 1958 },
  { year: 1958, title: "The Bridge on the River Kwai", tmdbYear: 1957 },
  { year: 1957, title: "Around the World in 80 Days", tmdbYear: 1956 },
  { year: 1956, title: "East of Eden", tmdbYear: 1955 },
  { year: 1955, title: "On the Waterfront", tmdbYear: 1954 },
  { year: 1954, title: "The Robe", tmdbYear: 1953 },
  { year: 1953, title: "The Greatest Show on Earth", tmdbYear: 1952 },
  { year: 1952, title: "A Place in the Sun", tmdbYear: 1951 },
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
  { year: 2026, title: "The Pitt", tmdbYear: 2025 },
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
  { year: 2026, title: "Widow's Bay", tmdbYear: 2026 },
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
 * والدب الذهبي»). من الحفل الأوّل (١٩٤٩) إلى اليوم.
 *
 * ⚠️ **والسنةُ سنةُ الحفل** (قاعدةُ هذا الملفّ منذ ١٩ نوفمبر ٢٠٢٦):
 * حفلُ ٢٠٢٦ كرّم فيلمَ ٢٠٢٥، فـ`year` ٢٠٢٦ و`tmdbYear` ٢٠٢٥. **والخلطُ
 * بين العمودين هو الفرقُ الذي أزاح استخراجاً آليّاً سابقاً بسنتين** (نصُّ
 * الملفّ أعلاه). ⚠️ والاستثناءُ الوحيد أوّلُ صفّ: الحفلان الأوّل
 * والثاني أُقيما معاً في ١٩٤٩.
 *
 * **والمصدران**: FilmAffinity للقائمة كاملةً، **وbafta.org لتثبيت
 * المحاذاة** — **تسعُ سنواتٍ متطابقةٌ حرفاً** (٢٠١٨→٢٠٢٦)، **وهي التي
 * تُثبت أن العمودَ عمودُ حفلٍ لا عمودُ إصدار.**
 */
export const BAFTA_BEST_FILM: AwardWin[] = [
  { year: 2026, title: "One Battle After Another", tmdbYear: 2025 },
  { year: 2025, title: "Conclave", tmdbYear: 2024 },
  { year: 2024, title: "Oppenheimer", tmdbYear: 2023 },
  { year: 2023, title: "All Quiet on the Western Front", tmdbYear: 2022 },
  { year: 2022, title: "The Power of the Dog", tmdbYear: 2021 },
  { year: 2021, title: "Nomadland", tmdbYear: 2020 },
  { year: 2020, title: "1917", tmdbYear: 2019 },
  { year: 2019, title: "Roma", tmdbYear: 2018 },
  { year: 2018, title: "Three Billboards Outside Ebbing, Missouri", tmdbYear: 2017 },
  { year: 2017, title: "La La Land", tmdbYear: 2016 },
  { year: 2016, title: "The Revenant", tmdbYear: 2015 },
  { year: 2015, title: "Boyhood", tmdbYear: 2014 },
  { year: 2014, title: "12 Years a Slave", tmdbYear: 2013 },
  { year: 2013, title: "Argo", tmdbYear: 2012 },
  { year: 2012, title: "The Artist", tmdbYear: 2011 },
  { year: 2011, title: "The King's Speech", tmdbYear: 2010 },
  { year: 2010, title: "The Hurt Locker", tmdbYear: 2009 },
  { year: 2009, title: "Slumdog Millionaire", tmdbYear: 2008 },
  { year: 2008, title: "Atonement", tmdbYear: 2007 },
  { year: 2007, title: "The Queen", tmdbYear: 2006 },
  { year: 2006, title: "Brokeback Mountain", tmdbYear: 2005 },
  { year: 2005, title: "The Aviator", tmdbYear: 2004 },
  { year: 2004, title: "The Lord of the Rings: The Return of the King", tmdbYear: 2003 },
  { year: 2003, title: "The Pianist", tmdbYear: 2002 },
  { year: 2002, title: "The Lord of the Rings: The Fellowship of the Ring", tmdbYear: 2001 },
  { year: 2001, title: "Gladiator", tmdbYear: 2000 },
  { year: 2000, title: "American Beauty", tmdbYear: 1999 },
  { year: 1999, title: "Shakespeare in Love", tmdbYear: 1998 },
  { year: 1998, title: "The Full Monty", tmdbYear: 1997 },
  { year: 1997, title: "The English Patient", tmdbYear: 1996 },
  { year: 1996, title: "Sense and Sensibility", tmdbYear: 1995 },
  { year: 1995, title: "Four Weddings and a Funeral", tmdbYear: 1994 },
  { year: 1994, title: "Schindler's List", tmdbYear: 1993 },
  { year: 1993, title: "Howards End", tmdbYear: 1992 },
  { year: 1992, title: "The Commitments", tmdbYear: 1991 },
  { year: 1991, title: "Goodfellas", tmdbYear: 1990 },
  { year: 1990, title: "Dead Poets Society", tmdbYear: 1989 },
  { year: 1989, title: "The Last Emperor", tmdbYear: 1988 },
  { year: 1988, title: "Jean de Florette", tmdbYear: 1987 },
  { year: 1987, title: "A Room with a View", tmdbYear: 1986 },
  { year: 1986, title: "The Purple Rose of Cairo", tmdbYear: 1985 },
  { year: 1985, title: "The Killing Fields", tmdbYear: 1984 },
  { year: 1984, title: "Educating Rita", tmdbYear: 1983 },
  { year: 1983, title: "Gandhi", tmdbYear: 1982 },
  { year: 1982, title: "Chariots of Fire", tmdbYear: 1981 },
  { year: 1981, title: "The Elephant Man", tmdbYear: 1980 },
  { year: 1980, title: "Manhattan", tmdbYear: 1979 },
  { year: 1979, title: "Julia", tmdbYear: 1978 },
  { year: 1978, title: "Annie Hall", tmdbYear: 1977 },
  { year: 1977, title: "One Flew Over the Cuckoo's Nest", tmdbYear: 1976 },
  { year: 1976, title: "Alice Doesn't Live Here Anymore", tmdbYear: 1975 },
  { year: 1975, title: "Lacombe, Lucien", tmdbYear: 1974 },
  { year: 1974, title: "Day for Night", tmdbYear: 1973 },
  { year: 1973, title: "Cabaret", tmdbYear: 1972 },
  { year: 1972, title: "Sunday Bloody Sunday", tmdbYear: 1971 },
  { year: 1971, title: "Butch Cassidy and the Sundance Kid", tmdbYear: 1970 },
  { year: 1970, title: "Midnight Cowboy", tmdbYear: 1969 },
  { year: 1969, title: "The Graduate", tmdbYear: 1968 },
  { year: 1968, title: "A Man for All Seasons", tmdbYear: 1967 },
  { year: 1967, title: "Who's Afraid of Virginia Woolf?", tmdbYear: 1966 },
  { year: 1966, title: "My Fair Lady", tmdbYear: 1965 },
  { year: 1965, title: "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb", tmdbYear: 1964 },
  { year: 1964, title: "Tom Jones", tmdbYear: 1963 },
  { year: 1963, title: "Lawrence of Arabia", tmdbYear: 1962 },
  { year: 1962, title: "Ballad of a Soldier", tmdbYear: 1961 },
  { year: 1962, title: "The Hustler", tmdbYear: 1961 },
  { year: 1961, title: "The Apartment", tmdbYear: 1960 },
  { year: 1960, title: "Ben-Hur", tmdbYear: 1959 },
  { year: 1959, title: "Room at the Top", tmdbYear: 1958 },
  { year: 1958, title: "The Bridge on the River Kwai", tmdbYear: 1957 },
  { year: 1957, title: "Gervaise", tmdbYear: 1956 },
  { year: 1956, title: "Richard III", tmdbYear: 1955 },
  { year: 1955, title: "The Wages of Fear", tmdbYear: 1954 },
  { year: 1954, title: "Forbidden Games", tmdbYear: 1953 },
  { year: 1953, title: "The Sound Barrier", tmdbYear: 1952 },
  { year: 1952, title: "La Ronde", tmdbYear: 1951 },
  { year: 1951, title: "All About Eve", tmdbYear: 1950 },
  { year: 1950, title: "Bicycle Thieves", tmdbYear: 1949 },
  { year: 1949, title: "Hamlet", tmdbYear: 1948 },
  /* الحفلان الأوّل والثاني أُقيما معاً في ٢٩ مايو ١٩٤٩ (أفلام ١٩٤٧ و١٩٤٨)،
     والثالث في مايو ١٩٥٠ — فلا يصحّ «+١» هنا وحدَه */
  { year: 1949, title: "The Best Years of Our Lives", tmdbYear: 1947 },
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
  { year: 2026, title: "Woman Unknown" },
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
