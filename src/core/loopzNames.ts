/**
 * ====== أسماءُ «Loopz» تُصحَّح عند مصدر TMDB — D-1266 ======
 *
 * **القاعدة** (أحمد، ٤ أكتوبر ٢٠٢٦): كلُّ عملٍ باسمه الإنجليزيّ، والعملُ العربيُّ باسمه العربيّ.
 *
 * **لماذا عند المصدر لا عند كلِّ سطح**: طريقةُ العرض كانت تُطبَّق على الصفوف المخزَّنة والبحث وحدَهما؛
 * صفوفُ «اكتشف» وصفحةُ العمل والمقترحاتُ والطاقمُ تأخذ اسمَ TMDB بلغة الواجهة مباشرةً. ووضعٌ صار افتراضَ
 * الجميع لا يصحّ أن يغيّر نصفَ الشاشة ويترك نصفَها — اسمان لعملٍ واحدٍ في شاشةٍ واحدة هو العطلُ الذي
 * عالجته D-147/D-273. فالتصحيحُ يقع مرّةً في `tmdb()`، وكلُّ قارئٍ يأخذ الاسمَ الصحيح بلا أن يتغيّر فيه حرف.
 *
 * **دالّتان خالصتان** (لا Supabase ولا `next/headers` — تُختبران بلا شبكة):
 * - `collectEnglish` تجمع أسماءَ الردِّ الإنجليزيّ بمفتاح العمل.
 * - `applyLoopzNames` تعيد **نسخةً** من الردِّ وقد صُحّحت أسماءُ صفوف الأعمال فيه. نسخةٌ لأنّ الردَّ
 *   الأصليَّ مشتركٌ بين طلباتٍ متزامنة (`inFlight`) ومحفوظٌ احتياطاً (`lastGood`) — وقارئٌ بوضعٍ آخر
 *   لا يجوز أن يرى ما صُحّح لغيره.
 *
 * **«صفُّ عملٍ»** = كائنٌ فيه `id` و`original_language` واسمٌ مع أصله (`title`+`original_title` أو
 * `name`+`original_name`). الحلقاتُ والمواسمُ والأشخاصُ والفيديوهاتُ لا تحمل الأصلَ فلا تُمسّ.
 */

type Json = unknown;

const MAX_DEPTH = 8;

function workKind(o: Record<string, unknown>): "m" | "t" | null {
  if (typeof o.id !== "number" || typeof o.original_language !== "string") return null;
  if (typeof o.title === "string" && typeof o.original_title === "string") return "m";
  if (typeof o.name === "string" && typeof o.original_name === "string") return "t";
  return null;
}

function walk(node: Json, visit: (o: Record<string, unknown>, kind: "m" | "t") => void, depth = 0): void {
  if (!node || typeof node !== "object" || depth > MAX_DEPTH) return;
  if (Array.isArray(node)) {
    for (const x of node) walk(x, visit, depth + 1);
    return;
  }
  const o = node as Record<string, unknown>;
  const kind = workKind(o);
  if (kind) visit(o, kind);
  for (const v of Object.values(o)) if (v && typeof v === "object") walk(v, visit, depth + 1);
}

const keyOf = (kind: "m" | "t", id: unknown) => `${kind}:${String(id)}`;

/** أسماءُ الأعمال في ردٍّ إنجليزيّ (`language=en-US`) — مفتاحُها `m:<id>` أو `t:<id>` */
export function collectEnglish(json: Json): Map<string, string> {
  const out = new Map<string, string>();
  walk(json, (o, kind) => {
    const name = (kind === "m" ? o.title : o.name) as string;
    if (name && name.trim()) out.set(keyOf(kind, o.id), name);
  });
  return out;
}

/**
 * يعيد نسخةً من `json` بأسماء Loopz.
 * - لغةُ العمل `ar` أو `en` ⇒ اسمُه الأصليّ (وهو ما في الصفّ نفسِه — بلا نداء).
 * - غيرُهما ⇒ الاسمُ الإنجليزيُّ من `english` إن وُجد؛ وإلّا يبقى ما في الصفّ: هو الإنجليزيُّ أصلاً حين
 *   يكون الردُّ نفسُه بـ`en-US` (`english = null`)، واسمُ لغة الواجهة حين يسقط النداءُ الإنجليزيّ.
 *   (TMDB يعيد الأصليَّ مكانَ الإنجليزيِّ الغائب — فعملٌ بلا اسمٍ إنجليزيٍّ يبقى بأصله.)
 */
export function applyLoopzNames<T>(json: T, english: Map<string, string> | null): T {
  if (!json || typeof json !== "object") return json;
  const copy = structuredClone(json);
  walk(copy, (o, kind) => {
    const field = kind === "m" ? "title" : "name";
    const original = (kind === "m" ? o.original_title : o.original_name) as string;
    const lang = o.original_language as string;
    if (lang === "ar" || lang === "en") {
      if (original && original.trim()) o[field] = original;
      return;
    }
    const en = english?.get(keyOf(kind, o.id));
    if (en) o[field] = en;
  });
  return copy;
}
