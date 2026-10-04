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
 *
 * 🆕 D-1259 (٤ أكتوبر ٢٠٢٦ — يومَ أضاف أحمد المفتاح):
 *  - **سلسلةُ نماذج لا نموذجٌ واحد**: الافتراضيُّ القديم (`gemini-2.5-flash`)
 *    خرج من قائمة Google ولم يعلم أحد — الفشلُ كان صامتاً. الآن إن ردّ
 *    النموذجُ الأوّل بـ404 (اسمٌ تقادم) أو 429 (حدُّ الباقة المجّانيّة، وهو
 *    **لكلِّ نموذجٍ على حدة**) أو 5xx، يُجرَّب التالي.
 *  - **المفتاحُ في الترويسة `x-goog-api-key` لا في العنوان**: مفاتيحُ AI Studio
 *    الجديدة (auth keys) موثَّقةٌ بالترويسة وحدَها، والعنوانُ يُكتب في السجلّات.
 *  - **التفكيرُ منخفض**: نماذجُ 3.x تفكّر قبل الجواب، ورموزُ التفكير تُحسب من
 *    `maxOutputTokens` — فكان الجوابُ سيُقصّ قبل أن يكتمل الـJSON. إن رفض
 *    النموذجُ الحقلَ (400) يُعاد الطلبُ بدونه مرّةً.
 *  - **كلُّ فشلٍ يُكتب سطراً** (`[ai]`) في سجلّ Vercel — بلا المفتاح وبلا
 *    وصفِ المستخدم: النموذجُ والحالةُ ورسالةُ Google فقط.
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

/** الأجودُ أوّلاً، ثم الأخفُّ (حدٌّ مجّانيٌّ أوسع) — راجِع القائمة حين يُكتب سطرُ `[ai] … 404` */
const MODEL_CHAIN = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
/** مهلةُ النداء الواحد — سلسلةٌ بلا مهلةٍ تُبقي المستخدمَ أمام «جارٍ البحث» */
const ATTEMPT_MS = 14_000;

type Attempt =
  | { ok: true; text: string }
  /** `next`: جرّب النموذجَ التالي · `noThinking`: أعِد بلا حقل التفكير · `stop`: المفتاحُ نفسُه مرفوض */
  | { ok: false; then: "next" | "noThinking" | "stop" };

async function askModel(model: string, key: string, prompt: string, thinking: boolean): Promise<Attempt> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            /* حرارةٌ أدنى من السابق (0.4): الترشيح مهمّة دقّةٍ لا إنشاء،
               والارتفاع كان يولّد أسماءً قريبةً من الصحيح لا صحيحة */
            temperature: 0.25,
            /* كان 1600 يومَ لم يكن تفكير؛ السقفُ الآن يسع التفكيرَ والجواب معاً */
            maxOutputTokens: 4096,
            ...(thinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
          },
        }),
        /* لا خبيئة: كل وصفٍ سؤالٌ جديد، وأجوبة النموذج ليست حقائق تُخبّأ */
        cache: "no-store",
        signal: AbortSignal.timeout(ATTEMPT_MS),
      },
    );
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 240);
      console.error("[ai]", model, res.status, thinking ? "thinking" : "plain", body);
      if (res.status === 400 && thinking) return { ok: false, then: "noThinking" };
      if (res.status === 401 || res.status === 403) return { ok: false, then: "stop" };
      return { ok: false, then: "next" };
    }
    const data = (await res.json()) as {
      candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    const cand = data.candidates?.[0];
    const text = cand?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) {
      console.error("[ai]", model, "empty", cand?.finishReason ?? "no-candidate");
      return { ok: false, then: "next" };
    }
    return { ok: true, text };
  } catch (e) {
    console.error("[ai]", model, "threw", (e as Error)?.name ?? "error");
    return { ok: false, then: "next" };
  }
}

/** `null` = المفتاح غير موجود (ميزة غير مفعّلة)؛ `[]` = فشل أو لا نتائج */
export async function aiSuggestTitles(
  description: string,
  taste: AiTaste = {},
): Promise<AiCandidate[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const custom = process.env.GEMINI_MODEL?.trim();
  const models = [...new Set([...(custom ? [custom] : []), ...MODEL_CHAIN])];

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

  const prompt = lines.join("\n");
  for (const model of models) {
    let got = await askModel(model, key, prompt, true);
    if (!got.ok && got.then === "noThinking") got = await askModel(model, key, prompt, false);
    if (got.ok) {
      const parsed = parseCandidates(got.text);
      if (parsed.length) return parsed;
      /* جوابٌ وصل ولم يُقرأ (JSON مقصوص أو قائمةٌ فارغة) — يُكتب ويُجرَّب التالي */
      console.error("[ai]", model, "unparsed", got.text.length);
      continue;
    }
    if (got.then === "stop") break;
  }
  return [];
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
