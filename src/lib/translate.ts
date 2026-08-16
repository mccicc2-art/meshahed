import { unstable_cache } from "next/cache";

/**
 * 🆕 **ترجمةُ كلام الأعضاء عند العرض** (D-307، طلبُ أحمد: «لو شخص لغة
 * جهازه بالعربي تظهر له نشرات الأعضاء بالعربي، وعندها خيار صغير: إظهار
 * النص الأصلي»).
 *
 * ================= ولا جدولَ ولا هجرةَ ولا سياسة =================
 *
 * **الترجمةُ ذاكرةُ خادمٍ لا صفُّ قاعدة**: `unstable_cache` على Vercel
 * تدوم عبر الطلبات، **فتُدفع الترجمةُ مرّةً لكلِّ (مشاركة، لغة) لا مع
 * كلِّ فتحة.** **وجدولُ ترجماتٍ كان سيحتاج كاتباً بلا مالكٍ** — ودالّةُ
 * `definer` تكتبه يستطيع أيُّ عميلٍ مناداتَها بنصٍّ مسموم **يُعرض للناس
 * باسمنا** — **وأرخصُ هجرةٍ هي التي لا تُكتب** (D-013/D-263).
 * **والثمنُ المقبول**: إخلاءُ ذاكرةٍ يعيد ترجمةً — نداءٌ يُدفع مرّتين
 * خيرٌ من بابِ كتابةٍ عامٍّ يُدفع ثمنُه مرّةً واحدة.
 *
 * ================= والمفتاحُ باسمه لا بقيمته =================
 *
 * `DEEPL_API_KEY` في متغيّرات Vercel (القاعدة ٦: الأسرارُ تُذكر بأسمائها
 * ولا تُكتب). **وغيابُه تعطيلٌ صامتٌ لا عطل**: تعود `null` فيُعرض
 * الأصلُ وحدَه — **«غير مفعّل» حالةُ منتَجٍ لا خطأ** (D-077).
 *
 * ================= وثلاثةُ حرّاسٍ على النداء =================
 *
 * **١) لا يُترجَم ما هو بلغة القارئ أصلاً**: هدفٌ عربيٌّ ونصٌّ عربيُّ
 * الغالب يُتخطّى قبل النداء (فحصُ محارف رخيص). **وللإنجليزية لا فحصَ
 * رخيصاً يصدق** (البرتغاليةُ لاتينيةٌ أيضاً) — فيُنادى وDeepL يكشف
 * المصدر، **ومصدرٌ يساوي الهدفَ يُرَدّ `null`** فلا زرَّ يعد بترجمةٍ
 * هي النصُّ نفسُه (D-217).
 * **٢) ومهلةٌ ٤ ثوانٍ**: خطٌّ يتأخّر بترجمته أسوأُ من خطٍّ بلا ترجمة.
 * **٣) وسقفُ ٥٠٠٠ محرف** — وحدُّ المشاركة ٢٠٠٠ أصلاً.
 */
async function callDeepL(text: string, target: "ar" | "en"): Promise<string | null> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return null;
  const body = text.trim().slice(0, 5000);
  if (!body) return null;
  /* **عربيٌّ غالبٌ لهدفٍ عربيّ — لا نداء** */
  if (target === "ar") {
    const ar = (body.match(/[؀-ۿ]/g) ?? []).length;
    if (ar / body.length > 0.2) return null;
  }
  try {
    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [body], target_lang: target.toUpperCase() }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      translations?: { text?: string; detected_source_language?: string }[];
    };
    const out = j.translations?.[0]?.text;
    const src = j.translations?.[0]?.detected_source_language ?? "";
    if (typeof out !== "string" || !out.trim()) return null;
    /* **مصدرٌ هو الهدفُ نفسُه ليس ترجمة** */
    if (src.toLowerCase().startsWith(target)) return null;
    return out;
  } catch {
    return null;
  }
}

/**
 * **ترجمةُ نصٍّ واحدٍ بمفتاح هويّته** — الذاكرةُ على (المعرّف، الهدف):
 * **المشاركاتُ لا تُحرَّر عندنا فهويّتُها تكفي مفتاحاً**، ولا يدخل النصُّ
 * في المفتاح (مفاتيحُ الذاكرة لا تكون بطول مقال).
 */
export function getTextTranslation(
  id: string,
  text: string,
  target: "ar" | "en",
): Promise<string | null> {
  return unstable_cache(() => callDeepL(text, target), ["tr", target, id], {
    revalidate: 60 * 60 * 24 * 30,
  })();
}

/**
 * **دفعةُ خيطٍ كاملة** — `Promise.all` لأن الذاكرةَ تلتقط أكثرَها بعد
 * أوّل قارئ، **وسقفُ ٤٠** (حدُّ الخطّ نفسُه، D-164).
 * **وفشلُ واحدةٍ لا يُسقط أخواتها** — كلُّ نداءٍ يبتلع خطأه.
 */
export async function getBatchTranslations(
  items: { id: string; text: string }[],
  target: "ar" | "en",
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!process.env.DEEPL_API_KEY) return out;
  const capped = items.filter((x) => x.text.trim()).slice(0, 40);
  const results = await Promise.all(
    capped.map((x) => getTextTranslation(x.id, x.text, target)),
  );
  capped.forEach((x, i) => {
    const tr = results[i];
    if (tr) out[x.id] = tr;
  });
  return out;
}
