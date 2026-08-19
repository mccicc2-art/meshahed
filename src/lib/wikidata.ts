/**
 * ويكي‑بيانات — اسمُ الشخص بالعربية (D-171).
 *
 * **الفجوة التي يسدّها، وهي الوحيدة التي ثبت أنها فجوة:** TMDB **لا يترجم
 * أسماء الأشخاص ولا سِيَرهم** — مذكورٌ في توثيقه نفسه. فصفحةُ «عادل إمام»
 * في واجهةٍ عربية كانت تكتب اسمه **`Adel Emam`**، وكذلك كل ممثّلٍ عربيّ
 * وكوريّ وياباني. الأعمال تُترجَم (D-048) والأشخاص لا.
 *
 * **ولماذا ويكي‑بيانات دون سواها** (بحث ١٢ أغسطس، `claude/apis-2026-08-12`):
 *  · **رخصة CC0** — لا نسبةَ مطلوبة ولا قيدَ تجاريّ. أنظفُ ما وجدناه.
 *  · **بلا مفتاح** — لا سرَّ يُضاف إلى Vercel ولا خطوةَ يدوية تُنسى.
 *  · **`P4985` معرّف TMDB للشخص حقلٌ أصيل عندهم** — فالربط **مباشر**،
 *    بلا جدولِ وسيطٍ ولا مطابقةٍ بالاسم (وهي التي ترفضها D-144).
 *
 * **والفشل صامتٌ بالكامل:** كل مسارٍ هنا يعود `null` عند أي خلل، فيبقى
 * اسمُ TMDB كما هو. لا شاشةَ خطأ، ولا انتظار — الصفحة لا ترى الفرق.
 */

/** نقطة SPARQL العامّة — بلا مفتاح */
const SPARQL = "https://query.wikidata.org/sparql";

/**
 * ترويسة `User-Agent` صريحة — **شرطٌ لا مجاملة:** سياسة ويكيميديا تحجب
 * العملاء المجهولين، ووثيقةُ الوصول تطلب اسم التطبيق ورابطه.
 */
const UA = "LoopzBot/1.0 (https://loopztv.com)";

interface SparqlValue {
  value: string;
}

/**
 * الاسم العربيّ لشخصٍ من معرّفه في TMDB — أو `null`.
 *
 * **الاستعلام يُقيَّد بـ`VALUES` لا بمرشِّح نصّي:** المعرّف يدخل الاستعلام
 * كسلسلة، فلو رُكّب بالسَّلق لأمكن حقنُ SPARQL. `VALUES` تحصره في قيمةٍ
 * واحدة، **والحارس الرقميّ قبله يمنع وصول أي محرفٍ غير رقم أصلاً.**
 *
 * **و`schema:description` لا تُطلب هنا عمداً:** المطلوب الاسم وحده. سيرةٌ
 * عربية كاملة تحتاج ويكيبيديا (CC BY-SA) وهي تُعرض منسوبةً مقتبسة —
 * قرارٌ آخر لم يُطلب بعد.
 */
export async function arabicPersonName(tmdbPersonId: number): Promise<string | null> {
  if (!Number.isInteger(tmdbPersonId) || tmdbPersonId <= 0) return null;

  const query = `SELECT ?ar WHERE {
  VALUES ?tmdb { "${tmdbPersonId}" }
  ?p wdt:P4985 ?tmdb .
  ?p rdfs:label ?ar .
  FILTER(LANG(?ar) = "ar")
} LIMIT 1`;

  try {
    const res = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": UA },
      /* سقفُ انتظارٍ ١٫٥ث: هذا النداء يجري قبل أوّل بايت في صفحات العمل
         والشخص، والنقطةُ العامّة تتباطأ إلى ثوانٍ تحت الضغط — والفشلُ هنا
         صامتٌ أصلاً (يبقى اسمُ TMDB)، فتحسينٌ جماليٌّ لا يُرهَن به TTFB. */
      signal: AbortSignal.timeout(1500),
      /* أسبوعٌ كامل: اسمُ الشخص بالعربية **لا يتغيّر**. وهذه أطول تخبئةٍ في
         التطبيق عن عمد — الغرض ألّا نُثقل نقطةً عامّةً مجانية بطلبٍ لجوابٍ
         ثابت. وأيُّ نشرةٍ جديدة تبدأ من صفر، وهو مقبولٌ لأن الفشل صامت. */
      next: { revalidate: 604_800 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      results?: { bindings?: { ar?: SparqlValue }[] };
    };
    const name = j.results?.bindings?.[0]?.ar?.value?.trim();
    return name && name.length > 0 ? name : null;
  } catch {
    /* الشبكة أو النقطة أو الصيغة — كلّها تعني «أبقِ اسم TMDB» */
    return null;
  }
}

/**
 * الاسم العربيّ لعملٍ من معرّفه في TMDB — أو `null` (D-176).
 *
 * **الفجوة:** TMDB **يترجم العناوين حين تُترجَم عنده وحسب**. فعملٌ لم يتطوّع
 * أحدٌ بترجمته يعود بعنوانه اللاتينيّ في واجهةٍ عربية — «Peninsula» و«Oldboy»
 * و«The Wailing» تُقرأ بالحروف اللاتينية في تطبيقٍ عربيٍّ أوّلاً.
 *
 * **ولماذا ويكي‑بيانات هنا أيضاً:** نفس الأسباب الثلاثة في `arabicPersonName`
 * (CC0 · بلا مفتاح · ربطٌ مباشر بالمعرّف) — والحقلان هنا **`P4947` للأفلام
 * و`P4983` للمسلسلات**.
 *
 * **والاستعلام واحدٌ لمجموعةٍ كاملة لا واحدٌ لكل عمل:** `VALUES` تقبل قائمة،
 * فعشرون عملاً نداءٌ واحد. **و`BIND` يفصل الجهتين**، لأن الفيلم ١٢٣ والمسلسل
 * ١٢٣ عملان مختلفان يحملان **نفس السلسلة** — ولولا الفاصل لاختلطا.
 *
 * **والحارس الرقميّ قبل التركيب** كما في `arabicPersonName`: لا يصل إلى
 * الاستعلام محرفٌ ليس رقماً، فلا حقنَ SPARQL.
 */
export async function arabicWorkTitles(
  keys: { id: number; media: "tv" | "movie" }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  const movies = [...new Set(keys.filter((k) => k.media === "movie").map((k) => k.id))].filter(
    (n) => Number.isInteger(n) && n > 0,
  );
  const shows = [...new Set(keys.filter((k) => k.media === "tv").map((k) => k.id))].filter(
    (n) => Number.isInteger(n) && n > 0,
  );
  if (movies.length === 0 && shows.length === 0) return out;

  /* فرعٌ لكل جهة، ويُحذف الفرع الفارغ: `VALUES { }` فارغةً تُرجع صفراً
     للفرعين معاً في بعض المحرّكات، فحذفُه أسلمُ من إرساله */
  const parts: string[] = [];
  if (movies.length)
    parts.push(`{ VALUES ?t { ${movies.map((n) => `"${n}"`).join(" ")} }
      ?w wdt:P4947 ?t . BIND("movie" AS ?k) }`);
  if (shows.length)
    parts.push(`{ VALUES ?t { ${shows.map((n) => `"${n}"`).join(" ")} }
      ?w wdt:P4983 ?t . BIND("tv" AS ?k) }`);

  const query = `SELECT ?k ?t ?ar WHERE {
  ${parts.join(" UNION ")}
  ?w rdfs:label ?ar .
  FILTER(LANG(?ar) = "ar")
}`;

  try {
    const res = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": UA },
      /* سقفُ انتظارٍ ١٫٥ث: هذا النداء يجري قبل أوّل بايت في صفحات العمل
         والشخص، والنقطةُ العامّة تتباطأ إلى ثوانٍ تحت الضغط — والفشلُ هنا
         صامتٌ أصلاً (يبقى اسمُ TMDB)، فتحسينٌ جماليٌّ لا يُرهَن به TTFB. */
      signal: AbortSignal.timeout(1500),
      /* أسبوعٌ كامل، كما في اسم الشخص: عنوانُ عملٍ بالعربية لا يتغيّر،
         والمفتاح هو الرابط نفسه — فمجموعةُ المعرّفات ذاتها لا تُسأل مرّتين */
      next: { revalidate: 604_800 },
    });
    if (!res.ok) return out;
    const j = (await res.json()) as {
      results?: { bindings?: { k?: SparqlValue; t?: SparqlValue; ar?: SparqlValue }[] };
    };
    for (const b of j.results?.bindings ?? []) {
      const k = b.k?.value;
      const t = b.t?.value;
      const ar = b.ar?.value?.trim();
      if (!k || !t || !ar) continue;
      /* أوّل تسميةٍ تفوز: ويكي‑بيانات قد تحمل أكثر من تسميةٍ عربية لعملٍ
         واحد (إعادات توجيه)، ولا معيارَ عندنا نفاضل به — فالثبات أهمّ */
      const key = `${k}-${t}`;
      if (!out.has(key)) out.set(key, ar);
    }
  } catch {
    /* الشبكة أو النقطة أو الصيغة — كلّها تعني «أبقِ عنوان TMDB» */
  }
  return out;
}

/** هل في النصّ حرفٌ عربيّ؟ — نفس محدِّد `localize.ts` حرفاً بحرف */
const ARABIC = /[؀-ۿ]/;

/**
 * العنوان المعروض لعمل — عربيٌّ إن أمكن، وإلا كما جاء من TMDB (D-176).
 *
 * **نفس الشرطين** اللذين يحرسان اسم الشخص: الواجهة عربية، **والعنوان القادم
 * من TMDB ليس عربياً أصلاً** — فالعملُ المترجَم عند TMDB لا يُكلّفنا طلباً،
 * **وهو الحالة الغالبة**.
 *
 * **ولا تُستدعى إلا من صفحتَي العمل** (المسلسل والفيلم)، **وهذا حدٌّ مقصود
 * لا نقص:** لو طُبّق على الصفوف والرفوف لظهر العملُ نفسُه **باسمين في شاشةٍ
 * واحدة** — عربيّاً في رفٍّ يمرّ بـ`localizeRows` ولاتينيّاً في رفٍّ يأتي من
 * TMDB مباشرةً. **واسمان لعملٍ واحد أسوأ من اسمٍ لاتينيٍّ متّسق.**
 * *(وهذا نفسُ نطاق D-171: اسمُ الشخص عربيٌّ في صفحته، لا في صفّ الطاقم.)*
 */
export async function displayWorkTitle(
  tmdbId: number,
  media: "tv" | "movie",
  tmdbTitle: string,
  locale: string,
): Promise<string> {
  if (locale === "en") return tmdbTitle;
  if (ARABIC.test(tmdbTitle)) return tmdbTitle;
  const found = await arabicWorkTitles([{ id: tmdbId, media }]);
  return found.get(`${media}-${tmdbId}`) ?? tmdbTitle;
}

/**
 * الاسم المعروض لشخص — عربيٌّ إن أمكن، وإلا كما جاء من TMDB.
 *
 * **ولا يُسأل إلا عند الحاجة (شرطان):** الواجهة عربية، **والاسم القادم من
 * TMDB ليس عربياً أصلاً**. فممثّلٌ عربيٌّ سجّله متطوّعٌ بالعربية لا يُكلّفنا
 * طلباً، وواجهةٌ إنجليزية لا تُكلّفنا شيئاً إطلاقاً — **صفرُ طلباتٍ في
 * الحالة الشائعة.** (نفس شرط `localizeRows` في D-048.)
 */
export async function displayPersonName(
  tmdbPersonId: number,
  tmdbName: string,
  locale: string,
): Promise<string> {
  if (locale === "en") return tmdbName;
  if (ARABIC.test(tmdbName)) return tmdbName;
  return (await arabicPersonName(tmdbPersonId)) ?? tmdbName;
}
