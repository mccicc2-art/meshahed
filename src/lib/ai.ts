/**
 * جسر Gemini — ترشيح أعمالٍ من وصفٍ حرّ (بحث الذكاء، D-076).
 *
 * النموذج يقترح والـTMDB هو الحقيقة: هذا الملف يعيد **أسماء مرشّحة**
 * فقط، ولا يصل شيءٌ منها للشاشة قبل أن يثبّته `searchByName` بنتيجة TMDB
 * حقيقية — فلا «هلوسة» تُعرض ولا رابط يُبنى على تخمين.
 *
 * المفتاح بالاسم لا بالقيمة (قاعدة المشروع): `GEMINI_API_KEY` يضعه أحمد
 * في Vercel env بنفسه، وغيابه يعيد `null` فتردّ الواجهة «غير مفعّل» بدل
 * أن تنكسر. والنموذج قابل للتبديل عبر `GEMINI_MODEL` لأن أسماء النماذج
 * تتقادم أسرع من الكود.
 */

export interface AiCandidate {
  /** الاسم الأصلي أو الإنجليزي — ما يُبحث به في TMDB */
  title: string;
  year?: number;
  type: "movie" | "tv";
}

const MODEL_FALLBACK = "gemini-2.5-flash";

/** `null` = المفتاح غير موجود (ميزة غير مفعّلة)؛ `[]` = فشل أو لا نتائج */
export async function aiSuggestTitles(description: string): Promise<AiCandidate[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || MODEL_FALLBACK;

  /* التعليمات إنجليزية والوصف يمرّ كما كُتب (عربياً أو إنجليزياً):
     النموذج يفهم الجهتين، وتثبيت لغة التعليمات يثبّت شكل الإخراج */
  const prompt =
    "You are a film and TV expert. The user describes a plot they remember, " +
    "a movie they forgot the name of, or a story they imagined. Reply with a " +
    "JSON array (max 10) of REAL movies or TV series that best match or " +
    "closely resemble the description, ordered by relevance. Each item: " +
    '{"title": "<original or English title as known on TMDB>", "year": <first release year>, "type": "movie" | "tv"}. ' +
    "JSON only, no commentary.\n\nUser description:\n" +
    description;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
            maxOutputTokens: 1200,
          },
        }),
        /* لا خبيئة: كل وصفٍ سؤالٌ جديد، وأجوبة النموذج ليست حقائق تُخبّأ */
        cache: "no-store",
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return parseCandidates(text);
  } catch {
    return [];
  }
}

/** قراءةٌ متسامحة: النموذج قد يلفّ الـJSON بأسوار كود رغم التعليمات */
function parseCandidates(text: string): AiCandidate[] {
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: AiCandidate[] = [];
  for (const item of raw) {
    if (out.length >= 10) break;
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim().slice(0, 200) : "";
    if (!title) continue;
    const type = o.type === "tv" ? "tv" : "movie";
    const yearNum = Number(o.year);
    const year = Number.isInteger(yearNum) && yearNum > 1870 && yearNum < 2200 ? yearNum : undefined;
    out.push({ title, year, type });
  }
  return out;
}
