/**
 * ====== قسمُ السينما — القواعدُ الخالصة (T512) ======
 *
 * أحمد ٢٢ نوفمبر ٢٠٢٦: «نبي نطورها ونحسنها بحيث يكون فيها جميع الاعمال فالسينما السعودية سواء اعمال سعودية او
 * مصرية او عربية او اجنبية». الجدولُ `cinema_titles` (هجرة ٢٦٠) يملؤه وكيلٌ أسبوعيٌّ من مواقع الصالات، والخادمُ
 * يطابق كلَّ اسمٍ برقمه في TMDB ويرسم منه. **وهذا الملفُّ قواعدُ بلا شبكةٍ ولا قاعدة** — يقرؤها الخادمُ والاختبار.
 */

/** المنشأ كما تعرضه رقاقاتُ القسم — «الكل · عربي · أجنبي» (حكمُ أحمد: ثلاثُ رقاقاتٍ لا أربع) */
export type CinemaOrigin = "arabic" | "foreign";

/**
 * دولُ الجامعة العربيّة — **فيلمٌ مصريٌّ أو سعوديٌّ أو لبنانيٌّ «عربيّ»** ولو كانت لغتُه الأصليّةُ غيرَ مسجَّلةٍ في TMDB.
 * ISO 3166-1 alpha-2.
 */
const ARAB_COUNTRIES: ReadonlySet<string> = new Set([
  "SA", "EG", "AE", "KW", "QA", "BH", "OM", "YE", "IQ", "SY", "LB", "JO", "PS", "SD", "LY", "TN", "DZ", "MA", "MR", "SO", "DJ", "KM",
]);

/**
 * 🔑 **المنشأ من TMDB لا من لافتة الصالة**: الصالةُ تكتب «Arabic» على النسخة المدبلجة («القطّ في القبّعة» بالعربيّ) —
 * والفيلمُ أجنبيٌّ مهما دُبلج. فاللغةُ الأصليّةُ وبلدُ المنشأ يحكمان؛ ولافتةُ الصالة احتياطٌ لعملٍ لا يعرفه TMDB بعد.
 */
export function cinemaOrigin(
  tmdb: { original_language?: string | null; origin_country?: readonly string[] | null } | null,
  siteLangs: readonly string[] = [],
): CinemaOrigin {
  if (tmdb) {
    if (tmdb.original_language === "ar") return "arabic";
    if ((tmdb.origin_country ?? []).some((c) => ARAB_COUNTRIES.has(c))) return "arabic";
    if (tmdb.original_language || (tmdb.origin_country ?? []).length) return "foreign";
  }
  /* بلا TMDB: عملٌ كلُّ نسخه عربيّة عربيّ، وما عداه أجنبيّ */
  return siteLangs.length > 0 && siteLangs.every((l) => /arab|عرب/i.test(l)) ? "arabic" : "foreign";
}

/** اليومُ في الرياض (YYYY-MM-DD) — «ينزل الخميس» يعني خميسَ الرياض لا خميسَ الخادم في مومباي */
export function riyadhToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * 🔑 **فيلمُ «قريباً» ينتقل وحده يومَ نزوله** (حكمُ أحمد «٢ أ»): الوكيلُ يقرأ مرّةً في الأسبوع، والفيلمُ ينزل الخميس —
 * فلا ينتظر القسمُ قراءةَ الأربعاء التالية. الحالةُ تُحسب عند القراءة من التاريخ، لا تُكتب.
 */
export function cinemaStatus(row: { status: "now" | "soon"; release_date: string | null }, today: string): "now" | "soon" {
  if (row.status === "soon" && row.release_date && row.release_date <= today) return "now";
  return row.status;
}

/** صفٌّ ما زال حيّاً: رآه الوكيلُ في آخر قراءةٍ (أو قبلها بثلاثة أيّام — قراءةٌ تأخّرت لا تُفرغ القسم) */
export function cinemaFresh(lastSeen: string, latest: string): boolean {
  const d = (Date.parse(latest) - Date.parse(lastSeen)) / 86_400_000;
  return d <= 3;
}

/** تطبيعُ الاسم للمقارنة: حروفٌ وأرقامٌ صغيرةٌ فقط (مثل مفتاح الجدول) و`&`=`and` */
export function cinemaKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * 🔑 **مطابقةُ اسم الصالة بنتيجة بحث TMDB** — صارمةٌ عمداً: **فيلمٌ خطأٌ في قسم السينما أسوأُ من فيلمٍ ناقص** (الناقصُ
 * يصل في مراجعة الوكيل). المقبول: اسمٌ (معروضٌ أو أصليّ) يطابق بعد التطبيع، **وصدورٌ في نافذة السنة** — قبل سنة العرض
 * السعوديّ بسنتين إلى بعدها بسنة (العرضُ السعوديُّ يتأخّر عن الأوّل أحياناً، وتاريخُ TMDB قد يسبق الإعلانَ المحلّيّ). وبين
 * المتطابقين يفوز الأشهر.
 */
export function pickCinemaMatch<
  T extends { id: number; title?: string; original_title?: string; release_date?: string | null; popularity?: number },
>(results: readonly T[], title: string, expectedYear: number): T | null {
  const want = cinemaKey(title);
  if (!want) return null;
  const ok = results.filter((r) => {
    const names = [r.title, r.original_title].filter((n): n is string => !!n).map(cinemaKey);
    if (!names.includes(want)) return false;
    const y = Number((r.release_date ?? "").slice(0, 4));
    /* بلا تاريخٍ في TMDB: لا يُقبل إلّا اسمٌ طويلٌ لا يتكرّر عادةً */
    if (!y) return want.length >= 12;
    return y >= expectedYear - 2 && y <= expectedYear + 1;
  });
  if (ok.length === 0) return null;
  return [...ok].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];
}
