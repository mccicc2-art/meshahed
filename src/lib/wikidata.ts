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

/** هل في النصّ حرفٌ عربيّ؟ — نفس محدِّد `localize.ts` حرفاً بحرف */
const ARABIC = /[؀-ۿ]/;

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
