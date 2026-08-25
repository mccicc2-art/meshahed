// تفضيلات البروفايل — ماذا يرى زائرُ صفحتك وبأي ترتيب (D-129)

import { sanitizeCardCount, type CardCount } from "./cardCount";
import { sanitizeDensity, type Density } from "./density";
import type { Dict } from "./i18n";
import type { IconName } from "@/components/Icon";

/**
 * **توأم `homePrefs` عمداً، لا نسخةٌ منه.**
 *
 * السجلّان منفصلان لأن الأقسام مختلفة، لكن **المحرّك واحد**: نفس
 * `SectionOrderList` يرسم الاثنين، ونفس `updateProfile` يحفظهما. ثاني
 * مصنعٍ لنفس الشيء خلل (قاعدة `06`) — وثاني **قائمة أسماء** ليس مصنعاً.
 *
 * والفرق الجوهري عن الرئيسية: هذه التفضيلات **يقرؤها الزائر**، فما تخفيه
 * هنا يختفي عنه. لكنها إخراجٌ لا خصوصية: القفل الحقيقي في SQL
 * (`can_view_profile`)، وترتيبُك لا يفتح ما أغلقه ولا يغلق ما فتحه.
 */

/** أقسام البروفايل القابلة للترتيب والإخفاء */
export const PROFILE_SECTIONS = [
  "shows",
  "movies",
  /* «فنّانوك»: نفس شبكة تبويب المكتبة الرابع (D-128) — تُبنى مرة وتظهر
     مرتين. خارج الافتراضي لأنها تكلّف نداءات TMDB لعدّ الأعمال */
  "artists",
  /* «مفضّلاتي» (D-152): القائمة المثبّتة من D-130 تصير قسماً يراه زائرك.
     خارج الافتراضي **لأن إظهاره هو الإعلان نفسه** — من لم يطلبه لم
     يعلنه، ولا نعلن عنه نيابةً عنه */
  "favorites",
  "lists",
  "ratings",
] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/**
 * أيقونةُ كل قسمٍ واسمُه — **سجلٌّ واحد لقارئَين** (D-152).
 *
 * كانت هذه الخريطة مكتوبةً في `ProfileCustomize` وحدها، ثم احتاجتها
 * صفحةُ البروفايل لترسم صفوف «مخفي عن الزائر». ونسخُها كان سيعني
 * قسماً يظهر في شاشة التخصيص باسمٍ وفي الصفحة باسمٍ آخر عند أوّل
 * تعديل — وهو بالضبط ما تحذّر منه قاعدة D-145.
 *
 * وهي **دالّةٌ تأخذ القاموس** لا ثابتٌ: الأسماء تتبع لغة الواجهة.
 */
export function profileSectionMeta(t: Dict): Record<ProfileSection, { icon: IconName; label: string }> {
  return {
    shows: { icon: "tv", label: t.shortShows },
    movies: { icon: "film", label: t.shortMovies },
    artists: { icon: "people", label: t.shortArtists },
    favorites: { icon: "heart", label: t.profileFavoritesRail },
    lists: { icon: "list", label: t.profileListsRail },
    ratings: { icon: "star", label: t.ratingsListTitle },
  };
}

/**
 * 🆕 **من يرى عدّاد الزيارات** (D-465، تصميمُ أحمد: قائمةٌ بجانب مفتاح
 * «الزيارات»).
 *
 * **وقد رُفض هذا سابقاً بحجّةٍ صحيحةٍ في حينها** (D-061): «مفتاحُ
 * الزيارات يُخفي الرقمَ عن الجميع وهو الخصوصيةُ نفسُها» — **والجوابُ
 * كان: قل «أريد أن أختار من يراه» فيصير خياراً ثلاثيّاً.** **وقد قالها،
 * فصار.**
 *
 * ⚠️ **والمفتاحُ يبقى فوق القائمة لا بدلاً منها**: الإطفاءُ يُخفي عنك
 * أنت أيضاً — **وهو حالةٌ رابعةٌ لا تُعبَّر عنها بالجمهور.**
 */
export const VISIT_AUDIENCES = ["everyone", "followers", "me"] as const;
export type VisitAudience = (typeof VISIT_AUDIENCES)[number];

export interface ProfilePrefs {
  /** صفّ الأرقام الأربعة فوق المستوى */
  stats: boolean;
  /** شريط المستوى */
  level: boolean;
  /** شارة عدد الزيارات على الغلاف */
  visits: boolean;
  /** ومن يراها — **يُطبَّق في صفحة الملفّ لا هنا** (D-465) */
  visitsWho: VisitAudience;
  /**
   * 🆕 **هل يرى زائرُك قسمَ «القوائم المحفوظة»؟** (D-594، حكمُ أحمد
   * بلقطةٍ على القسم: «حتى هذي حطّ لها on off»).
   *
   * **رايةٌ هنا لا صفٌّ ولا عمود** — نفسُ حجّة `home_prefs.toWatch`
   * (D-559): إخراجُ صفحةٍ يقرؤه الزائر، وهو نصُّ رأسِ هذا الملفّ.
   * **وليست عضواً في `order`**: ذاك يرتّب أقسامَ النظرة العامّة،
   * وهذا قسمٌ داخل تبويب «قوائم» — **مفتاحُه على القسم نفسِه**
   * (نموذجُ D-559: البطاقةُ سطحُ التحكّم). **والإطفاءُ يُخفيه عن
   * الزائر ويُبقيه لصاحبه برقاقة «متوقّفة»** — وإلّا لم يجد بابَ
   * العودة.
   */
  savedLists: boolean;
  /** ترتيب الأقسام، والغائب عن القائمة مخفيّ */
  order: ProfileSection[];
  /** عرضُ الملصق — مضغوط/مريح/كبير (D-441) */
  density: Density;
  /** سقفُ بطاقات الصفّ — يقصّ ولا يمدّ (D-152) */
  cards: CardCount;
  /**
   * 🆕 **لقبٌ قصيرٌ تحت الصورة** (D-561، تصميمُ أحمد: «Story lover»).
   *
   * **ولماذا هنا لا عموداً في `profiles`:** هذا السجلُّ **هو ما يراه
   * زائرُك** بنصِّ رأسِ هذا الملفّ، **واللقبُ سطرٌ لا يُكتب إلا ليُقرأ
   * من الخارج** — **وعمودٌ جديد يعني هجرةً وإعادةَ بناءِ `public_profiles`
   * لأجل أربعةٍ وعشرين حرفاً** (نفسُ حجّة `home_prefs.toWatch` في D-559).
   *
   * ⚠️ **والفراغُ ليس غياباً بل ارتدادٌ إلى اسم المستوى** — تُقرَّر في
   * الصفحة لا هنا، **فالسجلُّ يحفظ ما كُتب لا ما يُعرض.**
   */
  title: string;
  /**
   * 🆕 **ترتيبٌ يدويٌّ لصفوف الأقسام** (D-581، طلبُ أحمد بلقطةٍ على
   * مقبض «Shows»: «هذي العلامة حطّها في كل شي في المفضّلة — وكل شي
   * أقدر أرتّبه»).
   *
   * **مفاتيحُ صفوفٍ لكلِّ قسمٍ قابلٍ للترتيب** — `tv-123` · `movie-456`
   * · `p-789` (فنّان) · `l-<uuid>` (قائمة). **والغائبُ عن القائمة يُذيَّل
   * بترتيبه الطبيعيّ** فلا يختفي عملٌ أُضيف بعد الترتيب.
   *
   * **ولماذا هنا لا عموداً في جداول المصدر**: `follows` و`user_artists`
   * ترتيبُهما ترتيبُ الإضافة بمعناه (D-350)، **وهذا ترتيبُ عرضٍ في
   * صفحتك أنت** — إخراجٌ يقرؤه الزائر، وهو نصُّ رأسِ هذا الملفّ.
   * **وقسمُ «الأعلى تقييماً» ليس هنا عمداً**: ترتيبُه هو تقييمُك،
   * **وصفٌّ عنوانُه «الأعلى تقييماً» ورُتِّب يدويّاً يكذب** (D-217) —
   * من أراد رفعَ عملٍ فيه يرفع تقييمَه.
   */
  sectionOrder: Partial<Record<SortableSection, string[]>>;
}

/** الأقسامُ التي تقبل ترتيباً يدويّاً — والمفضّلةُ لها بابُها القائم (D-567) */
export const SORTABLE_SECTIONS = ["shows", "movies", "artists", "lists"] as const;
export type SortableSection = (typeof SORTABLE_SECTIONS)[number];

/**
 * تطبيقُ الترتيب المحفوظ على صفوف قسم: **المحفوظُ أوّلاً بترتيبه، وما
 * ليس فيه يُذيَّل بترتيبه الطبيعيّ** — فعملٌ أُضيف بعد آخرِ ترتيبٍ يظهر
 * آخرَ الصفّ لا يختفي، **ومفتاحٌ محفوظٌ لعملٍ أُزيل يُهمَل بصمت.**
 */
export function applySectionOrder<T>(
  rows: T[],
  saved: string[] | undefined,
  keyOf: (r: T) => string,
): T[] {
  if (!saved || saved.length === 0 || rows.length < 2) return rows;
  const pos = new Map(saved.map((k, i) => [k, i]));
  const ranked: T[] = [];
  const rest: T[] = [];
  for (const r of rows) (pos.has(keyOf(r)) ? ranked : rest).push(r);
  ranked.sort((a, b) => (pos.get(keyOf(a)) ?? 0) - (pos.get(keyOf(b)) ?? 0));
  return [...ranked, ...rest];
}

export const DEFAULT_PROFILE_PREFS: ProfilePrefs = {
  stats: true,
  level: true,
  visits: true,
  /* **والافتراضيُّ «الجميع»** — **وهو ما كانت تفعله الصفحةُ فعلاً قبل
     وجود القائمة**، فلا يتبدّل شيءٌ لمن لم يختر (D-152). */
  visitsWho: "everyone",
  /** **والافتراضيُّ الظهور** — هو ما تفعله الصفحةُ منذ D-588 (D-152) */
  savedLists: true,
  // ما تعرضه الصفحة اليوم حرفياً — فمن لم يخصّص لا يرى شيئاً تغيّر
  order: ["shows", "movies", "lists", "ratings"],
  density: "comfortable",
  cards: "full",
  /** **والفراغُ هو الافتراضي** — من لم يكتب لقباً يُعرض اسمُ مستواه */
  title: "",
  /** **والفراغُ يعني الترتيبَ الطبيعيّ** — لا شيء يتبدّل لمن لم يرتّب */
  sectionOrder: {},
};

/**
 * تنقية ما جاء من قاعدة البيانات — نفس منطق `sanitizeHomePrefs`.
 *
 * العمود JSON حرّ، وقد كتبت فيه نسخةٌ قديمة أو يدٌ عابثة ما لا نتوقّع.
 * والفرق هنا أن **الفراغ مسموح**: من أخفى كل الأقسام أخفاها قصداً،
 * بخلاف الرئيسية حيث ترتيبٌ فارغ يعني صفحةً بيضاء بلا سبب.
 */
export function sanitizeProfilePrefs(raw: unknown): ProfilePrefs {
  const d = DEFAULT_PROFILE_PREFS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;

  const bool = (k: "stats" | "level" | "visits" | "savedLists") =>
    typeof o[k] === "boolean" ? (o[k] as boolean) : d[k];

  let order: ProfileSection[] = d.order;
  if (Array.isArray(o.order)) {
    const seen = new Set<string>();
    order = o.order.filter(
      (s): s is ProfileSection =>
        typeof s === "string" &&
        (PROFILE_SECTIONS as readonly string[]).includes(s) &&
        !seen.has(s) &&
        !!seen.add(s),
    );
  }

  const who = VISIT_AUDIENCES.includes(o.visitsWho as VisitAudience)
    ? (o.visitsWho as VisitAudience)
    : d.visitsWho;

  return {
    stats: bool("stats"),
    level: bool("level"),
    visits: bool("visits"),
    visitsWho: who,
    savedLists: bool("savedLists"),
    order,
    cards: sanitizeCardCount(o.cards),
    density: sanitizeDensity(o.density),
    /* **المسافاتُ تُطوى والحدُّ أربعةٌ وعشرون** — كنبذةِ `updateProfile`
       حرفاً: **سطرٌ يجلس بين الاسم والعدّادات لا يحتمل فقرةً**، **والقصُّ
       هنا لا في الرسم** فلا يُخزَّن ما لا يُعرض. */
    title:
      typeof o.title === "string"
        ? o.title.replace(/\s+/g, " ").trim().slice(0, 24)
        : d.title,
    sectionOrder: sanitizeSectionOrder(o.sectionOrder),
  };
}

/** تنقيةُ خريطة الترتيب — أقسامٌ معروفة، مفاتيحُ نصّيّةٌ قصيرة، وبسقف */
function sanitizeSectionOrder(raw: unknown): ProfilePrefs["sectionOrder"] {
  if (!raw || typeof raw !== "object") return {};
  const out: ProfilePrefs["sectionOrder"] = {};
  for (const sec of SORTABLE_SECTIONS) {
    const v = (raw as Record<string, unknown>)[sec];
    if (!Array.isArray(v)) continue;
    const seen = new Set<string>();
    const keys = v.filter(
      (k): k is string =>
        typeof k === "string" && k.length <= 64 && !seen.has(k) && !!seen.add(k),
    );
    /* **سقفٌ يمنع jsonb من التضخّم** — ٨٠٠ مفتاحٍ تكفي أضخمَ مكتبة،
       وما فاض يسقط من الذيل فيرث الترتيبَ الطبيعيّ */
    if (keys.length > 0) out[sec] = keys.slice(0, 800);
  }
  return out;
}
