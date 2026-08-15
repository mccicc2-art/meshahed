import type { Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

/**
 * **جملةُ نشرةِ الغرفة** — تُركَّب من حقائقَ في الصفّ لا تُقرأ نصّاً
 * مخزَّناً (D-261، وهو مبدأ D-211/`newsLine.ts` نفسُه).
 *
 * **ولماذا وحدةٌ مستقلّة ولها قارئان من يومها:**
 *  · `ReplyItem` يرسم الصفَّ في الخيط.
 *  · **و`generateMetadata` في `/talk` يصف الصفحة** — وكان يقرأ
 *    `thread[0].body`، **ونشرةُ Loopz بلا متن** فكانت الصفحةُ ستقول
 *    «لا مشاركات» وفيها نشرة (D-155: النصُّ جزءٌ من التسليم).
 * **وقارئٌ ثانٍ هو لحظةُ الاستخراج** — لا بعدها.
 */

/** الشكلُ كما يصل من `title_posts.data` — **مجهولُ النوع فيُقرأ متسامحاً** (D-179) */
function n(v: unknown): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function s(v: unknown): string | null {
  const x = typeof v === "string" ? v.trim() : "";
  return x ? x : null;
}

/**
 * **العنوانُ بلغة القارئ ثم بالأخرى ثم لا شيء** — عنوانُ حلقةٍ بلغةٍ
 * أخرى **أصدقُ من غيابه** (بخلاف الجملة، التي تُركَّب دائماً بلغته).
 */
function pickName(data: Record<string, unknown>, locale: Locale): string | null {
  const mine = locale === "en" ? data.name_en : data.name_ar;
  const other = locale === "en" ? data.name_ar : data.name_en;
  return s(mine) ?? s(other);
}

/**
 * **السطرُ الأوّل — حقائقُ بلا حرق** (قرارُ أحمد): رقمُ الحلقة وعنوانُها.
 * **ويعود `null` لما لا يعرفه القالب** — نشرةٌ بلا صيغةٍ صمتٌ لا خطأ.
 */
export function bulletinLine(
  kind: string | null,
  data: Record<string, unknown> | null,
  t: Dict,
  locale: Locale,
): string | null {
  if (kind !== "episode" || !data) return null;
  const season = n(data.s);
  const episode = n(data.e);
  if (season === null || episode === null) return null;
  return t.bulletinEpisode(season, episode, pickName(data, locale));
}

/**
 * **السطرُ الثاني — المدّةُ والتقييم**، كلٌّ منهما يغيب وحدَه.
 * **والصفرُ يُخفى** (D-219): حلقةٌ لم يصوّت عليها أحدٌ لا تقول «★0.0».
 */
export function bulletinFacts(
  data: Record<string, unknown> | null,
  t: Dict,
): { runtime: string | null; vote: string | null } {
  const runtime = n(data?.runtime);
  const vote = n(data?.vote);
  return {
    runtime: runtime !== null && runtime > 0 ? t.bulletinRuntime(runtime) : null,
    /* **بشكلٍ واحد `9.9`** (D-241) — والرقمُ لاتينيٌّ في اللغتين (D-015) */
    vote: vote !== null && vote > 0 ? vote.toFixed(1) : null,
  };
}

/**
 * **النثرُ المحجوب بلغة القارئ** — ثم بالأخرى، ثم لا شيء.
 * ⚠️ **ولا يُوضع في وصف الصفحة أبداً**: وصفُ المستند يخرج إلى محرّكات
 * البحث وبطاقات المشاركة، **وحاجبُ حرقٍ يُكشف في معاينةِ رابطٍ ليس حاجباً.**
 */
export function bulletinSpoiler(
  spoiler: Record<string, unknown> | null,
  locale: Locale,
): string | null {
  if (!spoiler) return null;
  const mine = locale === "en" ? spoiler.en : spoiler.ar;
  const other = locale === "en" ? spoiler.ar : spoiler.en;
  return s(mine) ?? s(other);
}
