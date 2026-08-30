/**
 * ============ مقارنةُ ذوقين — حسابٌ خالصٌ بلا قراءة (D-814) ============
 *
 * **حكمُ أحمد**: «المقارنة».
 *
 * 🔑 **ولمَ هنا لا في مكوّن**: **قارئاه سطحان** — قسمُ المقارنة في
 * `‎/u/<user>/stats` واحدٌ، **وبطاقةُ مشاركتها إن بُنيت ثانٍ** — **ودالّةٌ
 * تُنسخ في سطحين تفترق عند أوّل تعديلٍ للوزن** (D-145/D-376).
 * **ونقيّةٌ بلا `server-only`** فتُختبر بمصفوفتين في سطرين.
 *
 * ⚖️ **ولا هجرةَ ولا دالّةَ قاعدةٍ جديدة**: **مدخلُها ما تُخرجه
 * `tallyGenres` أصلاً** من `user_public_follows` و`user_follow_genres`
 * — **وكلتاهما محروسةٌ بـ`can_view_profile`** (الهجرتان ١٤٢/١٤٥).
 * **فحسابٌ خاصٌّ لا تخرج منه صفوفٌ أصلاً، ولا قفلَ يُكتب هنا.**
 */

/** توزيعُ أنواعٍ بمفاتيحَ وأعداد — مخرَجُ `tallyGenres.bySlug` بعينه */
export type GenreTally = ReadonlyMap<string, number>;

export interface TasteMatchRow {
  slug: string;
  /** حصّةُ النوع من مكتبة كلٍّ منهما — نسبةٌ مئويّةٌ مقرَّبة */
  mine: number;
  theirs: number;
}

export interface TasteMatch {
  /** نسبةُ التطابق ٠–١٠٠ */
  pct: number;
  /** ما يجتمعان عليه — الأعلى مجموعاً، مرتَّبةً */
  shared: TasteMatchRow[];
  /** أبعدُ ما يفترقان فيه — الأعلى فرقاً، مرتَّبةً */
  apart: TasteMatchRow[];
  /** **بياناتٌ أقلُّ من أن تُقارَن** — والغيابُ يُقال غياباً (D-063) */
  thin: boolean;
}

/**
 * 🔑 **والتطابقُ زاويةٌ لا فرقُ نسبٍ** (جيبُ تمام الزاوية بين المتّجهين):
 * **من تابع ٢٠ عملاً ومن تابع ٤٠٠ قد يكون ذوقُهما واحداً** — **وطرحُ
 * النسب يعاقب الأصغرَ مكتبةً على صِغَرها لا على ذوقه.**
 * **والزاويةُ لا تعرف الحجم**، وهي المعنى المقصود: **«كم نتشابه؟» لا
 * «كم شاهد كلٌّ منّا؟».**
 *
 * ⚠️ **والحدُّ الأدنى ثلاثةُ أنواعٍ لكلٍّ منهما**: **نوعان مشتركان
 * يعطيان ١٠٠٪ بلا معنى** — **ورقمٌ يصدق حسابيّاً ويكذب دلاليّاً أسوأُ
 * من غيابه** (D-217).
 */
const MIN_GENRES = 3;

export function tasteMatch(mine: GenreTally, theirs: GenreTally): TasteMatch {
  const empty: TasteMatch = { pct: 0, shared: [], apart: [], thin: true };
  if (mine.size < MIN_GENRES || theirs.size < MIN_GENRES) return empty;

  const sum = (m: GenreTally) => [...m.values()].reduce((a, b) => a + b, 0);
  const myTotal = sum(mine);
  const theirTotal = sum(theirs);
  if (myTotal === 0 || theirTotal === 0) return empty;

  const slugs = new Set([...mine.keys(), ...theirs.keys()]);
  let dot = 0;
  let myLen = 0;
  let theirLen = 0;
  const rows: TasteMatchRow[] = [];

  for (const slug of slugs) {
    /* **الحصّةُ لا العدد** — وإلّا غلبت المكتبةُ الكبيرةُ في كلِّ محور */
    const a = (mine.get(slug) ?? 0) / myTotal;
    const b = (theirs.get(slug) ?? 0) / theirTotal;
    dot += a * b;
    myLen += a * a;
    theirLen += b * b;
    rows.push({ slug, mine: Math.round(a * 100), theirs: Math.round(b * 100) });
  }

  const denom = Math.sqrt(myLen) * Math.sqrt(theirLen);
  const pct = denom === 0 ? 0 : Math.round((dot / denom) * 100);

  /* **المشتركُ ما يحمله كلاهما** — **ونوعٌ عند أحدهما بصفرٍ ليس اشتراكاً**،
     والترتيبُ بالأصغر من الحصّتين: **٤٠٪ عنده و٣٪ عندي ليس ذوقاً مشتركاً.** */
  const shared = rows
    .filter((r) => r.mine > 0 && r.theirs > 0)
    .sort((a, b) => Math.min(b.mine, b.theirs) - Math.min(a.mine, a.theirs))
    .slice(0, 4);

  /* **والفراقُ أكبرُ فارقٍ مطلق** — يُقرأ «هو يشاهد هذا وأنت لا» */
  const apart = rows
    .filter((r) => Math.abs(r.mine - r.theirs) >= 5)
    .sort((a, b) => Math.abs(b.mine - b.theirs) - Math.abs(a.mine - a.theirs))
    .slice(0, 3);

  return { pct, shared, apart, thin: false };
}

/**
 * **أعمالٌ في مكتبته وليست في مكتبتك** — **ثمرةُ المقارنة لا زينتُها.**
 *
 * 🔑 **ومقارنةٌ لا تنتهي إلى شيءٍ يُشاهَد رقمٌ يُنظر إليه مرّةً** —
 * **والقيمةُ في الصفِّ الأخير لا في النسبة.**
 * ⚠️ **والمفتاحُ `media-tmdbId`** كما في كلِّ هذا المستودع.
 */
export function onlyTheirs<T extends { media_type: string; tmdb_id: number }>(
  mineRows: readonly T[],
  theirRows: readonly T[],
  cap = 12,
): T[] {
  const have = new Set(mineRows.map((r) => `${r.media_type}-${r.tmdb_id}`));
  const out: T[] = [];
  for (const r of theirRows) {
    if (have.has(`${r.media_type}-${r.tmdb_id}`)) continue;
    out.push(r);
    if (out.length >= cap) break;
  }
  return out;
}
