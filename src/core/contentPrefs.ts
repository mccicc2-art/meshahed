import { ALL_LANGS, BROWSE_GENRES, expandGenreIds } from "@/core/browse";

/**
 * **تفضيلاتُ المحتوى — ما يُعزَّز وما يُخفَّض وما يُستبعد** (D-545،
 * مواصفةُ أحمد المكتوبة).
 *
 * ================= ملفٌّ نقيٌّ عمداً =================
 *
 * **لا Supabase ولا كوكي ولا `next/headers` هنا** — **قراءةُ التفضيل
 * في `data.ts`، وكتابتُه في `actions.ts`، وترتيبُه هنا.** **وشرطُ
 * النقاء أن تُختبر قواعدُ الترتيب بلا قاعدةِ بياناتٍ ولا متصفّح**، وهو
 * ما يجعل «اختبارات التوصيات» في المواصفة ممكنةً أصلاً.
 *
 * ================= والسجلّاتُ ليست هنا =================
 *
 * **الأنواعُ من `BROWSE_GENRES` واللغاتُ من `ALL_LANGS`** — **سجلّان
 * قائمان يقرؤهما الاكتشافُ منذ شهور** (D-145: سجلٌّ ثانٍ لنفس المفهوم
 * يفترق عند أوّل إضافة). **وهذا الملفّ يقرّر ما يُفعل بها لا ما هي.**
 */

export interface ContentPrefs {
  /** أنواعٌ مفضّلة — **وهي `profiles.favorite_genres` نفسُها**، لا عمودٌ ثانٍ */
  genres: number[];
  /** أنواعٌ غيرُ مرغوبة — **تُخفَّض بقوّةٍ ولا تُمنع** */
  unwantedGenres: number[];
  /** **لغاتٌ مفضّلةٌ مرتَّبة** — الأولى أعلى أولويّة (ISO 639-1) */
  languages: string[];
  /** لغاتٌ مستبعدة — **تُحذف من التوصيات والاستكشاف وحدهما** */
  excludedLanguages: string[];
}

export const EMPTY_CONTENT_PREFS: ContentPrefs = {
  genres: [],
  unwantedGenres: [],
  languages: [],
  excludedLanguages: [],
};

/**
 * ⚠️ **الحارسُ الذي تقوم عليه «السلوكُ الحالي مطابقٌ تماماً»**: من لم
 * يختر شيئاً **لا يمرّ بأيِّ ترشيحٍ ولا ضربٍ ولا فرزٍ جديد** — **يخرج
 * من الدالّة قبل أن تبدأ.**
 */
export function hasAnyPrefs(p: ContentPrefs): boolean {
  return (
    p.genres.length > 0 ||
    p.unwantedGenres.length > 0 ||
    p.languages.length > 0 ||
    p.excludedLanguages.length > 0
  );
}

/** سقوفٌ تمنع صفّاً منتفخاً من مدخلٍ عبثيّ */
const MAX_GENRES = 20;
const MAX_LANGS = 12;

const KNOWN_GENRE_IDS = new Set<number>(
  BROWSE_GENRES.flatMap((g) => [...g.movie, ...g.tv]),
);
const KNOWN_LANGS = new Set(ALL_LANGS.map((l) => l.code));

function ints(raw: unknown, known: Set<number>, cap: number): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isInteger(n) || !known.has(n)) continue;
    if (!out.includes(n)) out.push(n);
    if (out.length >= cap) break;
  }
  return out;
}

function codes(raw: unknown, cap: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const c = String(v ?? "").toLowerCase().trim();
    if (!KNOWN_LANGS.has(c)) continue;
    if (!out.includes(c)) out.push(c);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * **قارئٌ متسامحٌ وحارسٌ في آنٍ واحد** — يقرؤه الكاتبُ والقارئُ معاً
 * (ثلاثيّةُ D-177: العميلُ يعطّل، والكاتبُ يقصّ، والقارئُ يقصّ).
 *
 * ⚠️ **وحلُّ التعارض هنا وليس في الواجهة وحدَها**: **ما دخل المفضّلَ
 * يُطرد من المقابل** — **والمفضّلُ يغلب** لأنه الاختيارُ الإيجابيّ،
 * **ولأن قيدَ القاعدة (١٢٦) يرفض الصفَّ كلَّه لو تعارضا** فيصير الحفظُ
 * خطأً صامتاً بدل تصحيحٍ صامت.
 */
export function sanitizeContentPrefs(raw: {
  genres?: unknown;
  unwantedGenres?: unknown;
  languages?: unknown;
  excludedLanguages?: unknown;
}): ContentPrefs {
  const genres = ints(raw.genres, KNOWN_GENRE_IDS, MAX_GENRES);
  const languages = codes(raw.languages, MAX_LANGS);
  const unwantedGenres = ints(raw.unwantedGenres, KNOWN_GENRE_IDS, MAX_GENRES).filter(
    (id) => !genres.includes(id),
  );
  const excludedLanguages = codes(raw.excludedLanguages, MAX_LANGS).filter(
    (c) => !languages.includes(c),
  );
  return { genres, unwantedGenres, languages, excludedLanguages };
}

/* ================================================================
   منطقُ التخصيص — بترتيب المواصفة حرفاً
   ================================================================ */

/** ما يُقارَن من العمل — **`original_language` لا لغةُ الواجهة** */
export interface Rankable {
  original_language?: string | null;
  genre_ids?: number[];
}

/**
 * **(١) الاستبعاد** — **حذفٌ لا تخفيض**، وللتوصيات والاستكشاف وحدهما.
 *
 * ⚠️ **ولا يُنادى من البحث ولا المكتبة ولا الرابط المباشر** (بنصِّ
 * المواصفة): **الاستبعادُ تفضيلُ عرضٍ لا حجبُ محتوى** — **ومن بحث عن
 * عملٍ يريده بعينه.**
 */
export function isExcludedLanguage(r: Rankable, p: ContentPrefs): boolean {
  if (!p.excludedLanguages.length) return false;
  const lang = (r.original_language ?? "").toLowerCase();
  return !!lang && p.excludedLanguages.includes(lang);
}

/**
 * **مكافأةُ اللغة المفضّلة حسب ترتيب المستخدم** — الأولى أعلى.
 *
 * **والتناقصُ هندسيٌّ لا خطّيّ**: الفرقُ بين الأولى والثانية يجب أن
 * يُحسّ، **والفرقُ بين السادسة والسابعة لا معنى له** — **ولو كانت
 * الدرجاتُ متساوية لما كان للسحب معنًى أصلاً.**
 */
const LANG_BOOST = [0.34, 0.24, 0.17, 0.12, 0.08, 0.05];

/** **مكافأةُ النوع المفضّل** — تراكميّةٌ بسقف، فعملٌ يطابق نوعين أقوى */
const GENRE_BOOST = 0.12;
const GENRE_BOOST_CAP = 0.28;

/**
 * **معاملُ التخفيض للنوع غير المرغوب** — **«يقلّ بقوّة» لا «يُمنع»**:
 * ٠٫٢ تُنزل العملَ إلى ذيل القائمة **ولا تمحوه**، **فيبقى ظاهراً لو
 * لم يكن في الصفحة سواه** — وهو الفرقُ بين التخفيض والحذف.
 */
const UNWANTED_FACTOR = 0.2;

/**
 * **(٢)(٣)(٤) معاملُ التفضيلات** — يُضرب في الدرجة الحاليّة **ولا
 * يستبدلها** (شرطُ المواصفة: «لا تستبدل خوارزمية التوصيات الحالية؛
 * استخدم التفضيلات كعوامل إضافية»).
 *
 * **والترتيبُ ترتيبُها:** التخفيضُ أوّلاً ثمّ تعزيزُ اللغة ثمّ تعزيزُ
 * النوع — **وضربُ الأعدادِ تبادليٌّ فالترتيبُ لا يغيّر الناتج**،
 * **لكنّه يُقرأ في الكود كما كُتب في الطلب**، وهو ما يجعل مراجعتَه
 * ممكنة.
 *
 * **ويعيد ١ بالضبط لمن لا تفضيلات له** — فلا فرقَ في أرقامِ الفاصلة
 * العائمة، **ولا فرقَ في الترتيب النهائيّ.**
 */
export function prefFactor(r: Rankable, p: ContentPrefs): number {
  let f = 1;

  const ids = r.genre_ids ?? [];

  if (p.unwantedGenres.length && ids.length) {
    const bad = expandGenreIds(p.unwantedGenres);
    if (ids.some((id) => bad.has(id))) f *= UNWANTED_FACTOR;
  }

  if (p.languages.length) {
    const i = p.languages.indexOf((r.original_language ?? "").toLowerCase());
    if (i >= 0) f *= 1 + (LANG_BOOST[i] ?? LANG_BOOST[LANG_BOOST.length - 1]);
  }

  if (p.genres.length && ids.length) {
    const good = expandGenreIds(p.genres);
    const hits = ids.filter((id) => good.has(id)).length;
    if (hits) f *= 1 + Math.min(hits * GENRE_BOOST, GENRE_BOOST_CAP);
  }

  return f;
}

/* ================================================================
   تفضيلاتُ الزائر — كوكي، ثمّ تُدمج مع الحساب عند الدخول
   ================================================================ */

export const CONTENT_PREFS_COOKIE = "loopz_content_prefs";

/**
 * **الزائرُ بلا حساب يختار أيضاً** (شرطُ المواصفة) — **كوكيٌّ بنفس
 * عائلة بقيّة التفضيلات** (D-014)، **يُقرأ على الخادم قبل أوّل رسمة**
 * فلا وميض.
 */
export function serializeContentPrefs(p: ContentPrefs): string {
  return JSON.stringify({
    g: p.genres,
    u: p.unwantedGenres,
    l: p.languages,
    x: p.excludedLanguages,
  });
}

export function parseContentPrefs(raw: string | undefined): ContentPrefs {
  if (!raw) return EMPTY_CONTENT_PREFS;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return sanitizeContentPrefs({
      genres: o.g,
      unwantedGenres: o.u,
      languages: o.l,
      excludedLanguages: o.x,
    });
  } catch {
    return EMPTY_CONTENT_PREFS;
  }
}

/**
 * **دمجُ تفضيلات الزائر مع الحساب عند الدخول — بلا فقدان** (شرطُ
 * المواصفة نصّاً).
 *
 * ⚠️ **والحسابُ يغلب عند التعارض**: **ما اختاره صاحبُ الحساب وهو
 * مسجَّلٌ أصدقُ ممّا اختاره وهو زائر** — **واللغاتُ المرتَّبةُ تبقى
 * بترتيب الحساب ثمّ يُلحَق الجديدُ بذيلها**، فلا يُقلب ترتيبٌ اختاره
 * بيده.
 *
 * ⚠️ **ولا يُدمج المستبعَدُ فوق المفضَّل**: `sanitize` في الآخر
 * يحسم أيَّ تعارضٍ نشأ من الدمج نفسِه — **ولولاه لرُفض الصفُّ بقيد
 * القاعدة ١٢٦.**
 */
export function mergeContentPrefs(account: ContentPrefs, guest: ContentPrefs): ContentPrefs {
  const uniq = (a: readonly number[], b: readonly number[]) => [...new Set([...a, ...b])];
  const uniqS = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];
  return sanitizeContentPrefs({
    genres: uniq(account.genres, guest.genres),
    unwantedGenres: uniq(account.unwantedGenres, guest.unwantedGenres),
    languages: uniqS(account.languages, guest.languages),
    excludedLanguages: uniqS(account.excludedLanguages, guest.excludedLanguages),
  });
}
