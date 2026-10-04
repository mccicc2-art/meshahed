/**
 * ====== تثبيتُ ترشيحِ النموذج على نتيجةِ TMDB الصحيحة (D-1260) ======
 *
 * 🔴 **العلّة** (رآها الاختبارُ الحيّ يومَ D-1259): النموذجُ يقترح «A Day» (كوريّ ٢٠١٧)
 * فتظهر «A Good Day to Die Hard» وتحتها سببُ الفيلم الكوريّ. الاقتراحُ صحيحٌ والربطُ خطأ:
 * `searchByName` تأخذ أوّلَ نتيجةٍ لها ملصق، **ولا تسأل هل الاسمُ هو الاسم**. وهذا يليق
 * بالاستيراد (من شاهد «Friends» شاهد المشهور) ولا يليق هنا: سطرُ السبب مكتوبٌ لعملٍ بعينه.
 *
 * 🔑 **القاعدة: ما لا يثبت يسقط** — قائمةٌ من ثمانيةٍ صحيحة خيرٌ من عشرةٍ فيها ملصقٌ تحته
 * وصفُ عملٍ آخر. ثلاثُ درجات، من الأوثق:
 *   ٢ — الاسمُ هو الاسم (بعد التطبيع)، والسنةُ داخل ثلاث.
 *   ١ — أحدُهما بدايةُ الآخر ثم عنوانٌ فرعيّ («Dune» ↔ «Dune: Part One»)، والسنةُ داخل واحدة.
 *   ٠ — لا تطابقَ اسمٍ (اسمٌ بديل/رومَجي يعرفه TMDB ولا نراه): أوّلُ نتيجةِ البحثِ المقيَّدِ
 *       بالسنة وحدَها، وبشرط اسمٍ من كلمتين فأكثر — كلمةٌ واحدةٌ شائعةٌ تطابق أيَّ شيء.
 *
 * ملفٌّ نقيّ (لا شبكة) ليُختبر: الشبكةُ في `lib/tmdb.ts` (`groundByName`).
 */

export interface GroundRow {
  id: number;
  /** الأسماءُ المعروفة للصفّ: الإنجليزيُّ والأصليّ */
  names: string[];
  /** سنةُ الإصدار/أوّلِ بثّ — صفرٌ إن جُهلت */
  year: number;
  poster: boolean;
  /** ترتيبُه في البحث المقيَّد بالسنة (٠ = الأوّل) — `-1` إن لم يأتِ منه */
  yearRank: number;
}

export interface GroundWanted {
  title: string;
  original?: string;
  year?: number;
}

/** تطبيعُ الاسم للمقارنة: بلا تشكيلٍ ولا ترقيمٍ ولا «the» في أوّله */
export function normTitle(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");
}

function nameScore(wanted: string[], names: string[]): 0 | 1 | 2 {
  let best: 0 | 1 | 2 = 0;
  for (const w of wanted) {
    for (const n of names) {
      if (!w || !n) continue;
      if (w === n) return 2;
      const [short, long] = w.length <= n.length ? [w, n] : [n, w];
      if (long.startsWith(short + " ")) best = 1;
    }
  }
  return best;
}

export function pickGrounded(wanted: GroundWanted, rows: GroundRow[]): number | null {
  const names = [wanted.title, wanted.original ?? ""].map(normTitle).filter(Boolean);
  if (!names.length || !rows.length) return null;
  const year = wanted.year && wanted.year > 1870 && wanted.year < 2200 ? wanted.year : 0;
  const delta = (r: GroundRow) => (year && r.year ? Math.abs(r.year - year) : Infinity);
  const scored = rows.map((r, i) => ({ r, i, s: nameScore(names, r.names.map(normTitle)) }));
  /** الأقربُ سنةً، ثمّ ذو الملصق، ثمّ ترتيبُ TMDB */
  const best = (xs: typeof scored) =>
    [...xs].sort((a, b) => delta(a.r) - delta(b.r) || Number(b.r.poster) - Number(a.r.poster) || a.i - b.i)[0]?.r.id ?? null;

  const equal = scored.filter((x) => x.s === 2);
  if (equal.length) {
    if (!year) return [...equal].sort((a, b) => Number(b.r.poster) - Number(a.r.poster) || a.i - b.i)[0].r.id;
    const near = equal.filter((x) => delta(x.r) <= 3);
    if (near.length) return best(near);
    /* الاسمُ هو الاسمُ والسنةُ بعيدة: يُقبل إن كان وحيداً (سنةُ النموذج قد تخطئ)،
       ويسقط إن تعدّد («هاملت» خمسةُ أفلام) */
    return equal.length === 1 ? equal[0].r.id : null;
  }
  if (!year) return null;

  const sub = scored.filter((x) => x.s === 1 && delta(x.r) <= 1);
  if (sub.length) return best(sub);

  const words = normTitle(wanted.title).split(" ").length;
  const first = scored.find((x) => x.r.yearRank === 0);
  if (words >= 2 && first && delta(first.r) <= 1) return first.r.id;
  return null;
}
