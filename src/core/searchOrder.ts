import type { SearchPayload } from "./searchTypes.ts";

/**
 * 🆕 **ترتيبُ أقسام «الكل» — الأقربُ أوّلاً** (أحمد ١٩ نوفمبر، «ب»: بحثُ «rakan» يجد عضواً اسمُه Rakan بالضبط، وقسمُ الأعضاء
 * الأخيرُ تحت لوحة المفاتيح لا يُرى). القسمُ الذي فيه اسمٌ يساوي الكلمةَ كاملةً يصعد فوق غيره؛ والأقسامُ المتطابقةُ تبقى بترتيبها
 * المعتاد بينها، وغيرُ المتطابقة كذلك بعدها — فبحثٌ بلا تطابقٍ تامٍّ لا يتغيّر ترتيبُه أبداً.
 *
 * التطابقُ بلا فرقٍ بين الكبيرة والصغيرة، وبلا علامات (Räkan = rakan)، وبلا التشكيل والتطويل العربيّ، والمسافاتُ المتعدّدةُ واحدة.
 * العضو: اسمُه الظاهرُ أو اسمُ مستخدمه — والمخفيُّ اسمُه لا يُقارَن (لا يُكشف بالترتيب ما أُخفي بالاسم).
 */
export type SearchSection = "titles" | "artists" | "members" | "lists";
export const SECTION_ORDER: readonly SearchSection[] = ["titles", "artists", "members", "lists"];

export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function sectionOrder(data: Pick<SearchPayload, "titles" | "artists" | "members" | "lists">, query: string): SearchSection[] {
  const q = normalizeName(query);
  if (!q) return [...SECTION_ORDER];
  const eq = (s: string | null | undefined) => normalizeName(s) === q;
  const exact: Record<SearchSection, boolean> = {
    titles: data.titles.some((r) => eq(r.title) || eq(r.titleSecondary)),
    artists: data.artists.some((a) => eq(a.name)),
    members: data.members.some((m) => !m.hide_name && (eq(m.nickname) || eq(m.username))),
    lists: data.lists.some((l) => eq(l.name)),
  };
  return [...SECTION_ORDER.filter((k) => exact[k]), ...SECTION_ORDER.filter((k) => !exact[k])];
}
