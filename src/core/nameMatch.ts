/**
 * 🆕 T536 — **الاسمُ المطابقُ يتقدّم على الأشهر** (أحمد ٢٤ نوفمبر «٢أ»).
 *
 * لماذا: استيرادُ Letterboxd يحمل الاسمَ والسنةَ وحدهما، والبحثُ في TMDB يرتّب بالشهرة — فكان أوّلُ صفٍّ بملصقٍ يفوز:
 * «Harmony» ٢٠١٠ (الفيلمُ الكوريّ) صار «Harmony and Me» عند عضوةٍ استوردت ملفَّها. فبين نتائج البحث يُقدَّم ما يطابق
 * اسمُه (أو اسمُه الأصليّ) الاسمَ المطلوب حرفاً بعد التطبيع، ثمّ ما له ملصق — وإن لم يطابق شيءٌ فالقاعدةُ القديمة كما هي.
 * نقيّةٌ ومختبَرة (`nameMatch.test.ts`)، وقارئُها `searchByName` في `lib/tmdb.ts`.
 */

export type NamedRow = {
  title?: string | null;
  name?: string | null;
  original_title?: string | null;
  original_name?: string | null;
  poster_path?: string | null;
};

/** تطبيعُ الاسم للمقارنة: حروفٌ صغيرة، بلا تشكيلٍ ولا علاماتٍ ولا مسافاتٍ زائدة، و«&» ⇐ «and» */
export function normTitle(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ْ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** صفٌّ اسمُه أو اسمُه الأصليّ يطابق المطلوبَ بعد التطبيع */
export function titleMatches(row: NamedRow, wanted: string): boolean {
  const w = normTitle(wanted);
  if (!w) return false;
  return [row.title, row.name, row.original_title, row.original_name].some((t) => !!t && normTitle(t) === w);
}

/**
 * الاختيارُ من نتائجَ مرتّبةٍ سلفاً (بالشهرة أو بقرب السنة): المطابقُ بملصق، ثمّ المطابقُ، ثمّ القاعدةُ القديمة — أوّلُ صفٍّ بملصق،
 * ثمّ الأوّل. فالترتيبُ داخل كلِّ فئةٍ ترتيبُ المصدر نفسُه.
 */
export function pickByTitle<T extends NamedRow>(rows: T[], wanted: string): T | null {
  return exactByTitle(rows, wanted) ?? rows.find((r) => r.poster_path) ?? rows[0] ?? null;
}

/** المطابقُ وحدَه (بملصقٍ أوّلاً) أو لا شيء — لمن يجمع نتائجَ لغتين ويختار المعرّف من إحداهما */
export function exactByTitle<T extends NamedRow>(rows: T[], wanted: string): T | null {
  const exact = rows.filter((r) => titleMatches(r, wanted));
  return exact.find((r) => r.poster_path) ?? exact[0] ?? null;
}
