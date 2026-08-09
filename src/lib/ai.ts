/**
 * جسر Gemini — ترشيح أعمالٍ من وصفٍ حرّ (بحث الذكاء، D-076؛ أُعيد بناؤه
 * 9 Aug بعد حكم أحمد: «الـAI ما زال سيء جداً ويعتمد على الفلاتر»).
 *
 * النموذج يقترح والـTMDB هو الحقيقة: هذا الملف يعيد **أسماء مرشّحة**
 * فقط، ولا يصل شيءٌ منها للشاشة قبل أن يثبّته `searchByName` بنتيجة TMDB
 * حقيقية — فلا «هلوسة» تُعرض ولا رابط يُبنى على تخمين.
 *
 * ثلاثة أشياء تغيّرت لترتفع الجودة:
 *  1. **الذوق يُمرَّر**: أعلى ما قيّمه المستخدم وأنواعه المفضّلة تدخل
 *     التعليمات، فالجواب يصير له هو لا لأي أحد. هذا ما يفرّق «ذكاءً»
 *     عن «بحثٍ بكلمات».
 *  2. **السبب يُطلب**: سطرٌ قصير بلغة المستخدم يشرح لماذا هذا العمل —
 *     اقتراحٌ بلا سبب يُقرأ عشوائياً وإن كان صائباً.
 *  3. **ما شُوهد يُستبعد**: قائمة استبعادٍ تمنع اقتراح ما في مكتبته.
 *
 * المفتاح بالاسم لا بالقيمة (قاعدة المشروع): `GEMINI_API_KEY` يضعه أحمد
 * في Vercel env بنفسه، وغيابه يعيد `null` — والواجهة حينها **لا تنكسر**:
 * لها مسارٌ بديل بلا نموذج (كلمات TMDB المفتاحية، انظر actions.ts).
 * والنموذج قابل للتبديل عبر `GEMINI_MODEL` لأن أسماء النماذج تتقادم
 * أسرع من الكود.
 */

export interface AiCandidate {
  /** الاسم الأصلي أو الإنجليزي — ما يُبحث به في TMDB */
  title: string;
  year?: number;
  type: "movie" | "tv";
  /** لماذا هذا العمل — سطرٌ قصير بلغة المستخدم */
  reason?: string;
}

/** ما نعرفه عن ذوق صاحب الطلب — كلّه اختياري، وغيابه يُنقص الدقة لا يمنعها */
export interface AiTaste {
  /** أعلى ما قيّم — أقوى إشارةٍ ممكنة */
  loved?: string[];
  /** أنواعه المفضّلة بأسمائها */
  genres?: string[];
  /** ما في مكتبته — لا يُقترح عليه ما عنده */
  exclude?: string[];
  /** لغة الواجهة — بها يُكتب السبب */
  locale?: "ar" | "en";
}

const MODEL_FALLBACK = "gemini-2.5-flash";

/** `null` = المفتاح غير موجود (ميزة غير مفعّلة)؛ `[]` = فشل أو لا نتائج */
export async function aiSuggestTitles(
  description: string,
  taste: AiTaste = {},
): Promise<AiCandidate[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || MODEL_FALLBACK;

  const ar = taste.locale !== "en";
  const lines: string[] = [
    "You are a world-class film and TV curator with encyclopedic knowledge, including Arabic, Turkish, Korean and Japanese productions.",
    "The user writes freely: a half-remembered plot, a mood, a comparison to another title, or a very specific wish.",
    "Return the 10 REAL titles that genuinely best answer them, ordered by how well they fit.",
    "Rules that matter:",
    "- Prefer precision over popularity: an obscure perfect match beats a famous near-miss.",
    "- If the user names a title, do NOT return that title; return what a fan of it would love next.",
    "- Mix eras and countries when it serves the request; never fill the list with sequels of one franchise.",
    "- Never invent a title. If unsure it exists on TMDB, drop it.",
  ];

  if (taste.loved?.length) {
    lines.push(
      `The user rated these highly — match this taste unless the request contradicts it: ${taste.loved.slice(0, 12).join(", ")}.`,
    );
  }
  if (taste.genres?.length) {
    lines.push(`Favourite genres: ${taste.genres.slice(0, 6).join(", ")}.`);
  }
  if (taste.exclude?.length) {
    lines.push(
      `Already in their library — do NOT suggest these: ${taste.exclude.slice(0, 40).join(", ")}.`,
    );
  }

  lines.push(
    'Reply with a JSON array only (no commentary). Each item: {"title": "<title as known on TMDB, original or English>", "year": <first release year>, "type": "movie" | "tv", "reason": "<one short sentence, max 12 words, in ' +
      (ar ? "Arabic" : "English") +
      '>"}.',
    "",
    "User request:",
    description,
  );

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: lines.join("\n") }] }],
          generationConfig: {
            responseMimeType: "application/json",
            /* حرارةٌ أدنى من السابق (0.4): الترشيح مهمّة دقّةٍ لا إنشاء،
               والارتفاع كان يولّد أسماءً قريبةً من الصحيح لا صحيحة */
            temperature: 0.25,
            maxOutputTokens: 1600,
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
    if (out.length >= 12) break;
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim().slice(0, 200) : "";
    if (!title) continue;
    const type = o.type === "tv" ? "tv" : "movie";
    const yearNum = Number(o.year);
    const year = Number.isInteger(yearNum) && yearNum > 1870 && yearNum < 2200 ? yearNum : undefined;
    const reason = typeof o.reason === "string" ? o.reason.trim().slice(0, 140) : undefined;
    out.push({ title, year, type, reason: reason || undefined });
  }
  return out;
}
