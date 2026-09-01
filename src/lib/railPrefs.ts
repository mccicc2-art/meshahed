import type { Dict } from "@/lib/i18n";

/**
 * ====== صفوفُ «اكتشف» — أيُّها يظهر (D-826) ======
 *
 * **حكمُ أحمد** (٣٠ أغسطس): «يقدر يخفي أيَّ عنوانٍ من هذي العناوين،
 * **وتكون في فيو**» — **عناوينُ صفوف اكتشف، والعنوانُ وما تحته معاً.**
 *
 * 🔑 **وبيتُه كوكيٌّ لا عمود** — **نفسُ عقدِ `tabPrefs` حرفاً** (D-179):
 * **صفحةُ اكتشف تُرسم على الخادم قبل أن تُعرف الجلسة**، **وعمودٌ يعني
 * انتظارَ البروفايل قبل أوّل بايت** (D-122). **وهو تفضيلُ عرضٍ كالثيم
 * والكثافة** (D-014) — **ولا يراه أحدٌ غيرُ صاحبه** فلا يحتاج عموداً.
 *
 * 🔑 **ومفتاحٌ واحدٌ لصفٍّ واحدٍ داخلَ التبويب** (`top10` لا
 * `top10-movie` و`top10-tv`): **تبويبُ الأفلام يرسم نسخةَ الأفلام
 * وحدَها** (`wantMovies`) — **ومفتاحان لصفٍّ يراه المستخدمُ واحداً
 * يجعله يُطفئه مرّتين.**
 *
 * 🔴 **والمخزَّنُ `tab:key` لا `key` — وهذا تصحيحٌ لأوّل نسخة، قِيس
 * حيّاً فسقط**: **كانت المفاتيحُ عامّةً، فإطفاءُ «القادم قريباً» في
 * الأفلام أطفأ «أنميٌ قادم» في الأنمي** — **واللوحُ يقول «صفوفُ هذا
 * التبويب»** — **فوعدٌ في السطر ونقيضُه في التخزين** (D-217).
 * ⚠️ **والحجّةُ التي جمعت المفاتيح كانت عن نسختَي الصفِّ في التبويب
 * الواحد** (فيلم/مسلسل)، **ولا تمتدّ إلى تبويبين يراهما المستخدمُ
 * صفحتين باسمين مختلفين** — **وتوسيعُ حجّةٍ خارجَ مداها هو العطل.**
 *
 * ⚠️ **والاسمُ يُقرأ من القاموس نفسِه الذي يرسمه الصفّ** (D-703):
 * **من أطفأ «الأكثر شعبية» يجب أن يقرأ في القائمة ما يقرؤه فوق
 * الصفّ** — **واسمان لشيءٍ واحدٍ يفترقان عند أوّل تعديل** (درسُ
 * `headerStatMeta` في D-787).
 *
 * ⚠️ **ولا يشمل «القوائم»**: تبويبُها لا صفوفَ أعمالٍ فيه.
 */

export const RAILS_COOKIE = "loopz_rails";

/**
 * تبويباتُ اكتشف التي لها صفوف — **وصفحتان انضمّتا في D-874** بحكم
 * أحمد («نعم، للاثنين» على سؤال `05` §ب-٣): **«مكتبتي» و«المجتمع».**
 * 🔑 **والنطاقُ هو الشيءُ الذي يراه المستخدمُ صفحةً باسم** — تبويبُ
 * اكتشف عنده صفحة، **والمكتبةُ صفحة، والمجتمعُ صفحة** — **فالمفتاحُ
 * `library:` و`community:` على وزن `movies:` بلا استثناء.**
 */
export type RailTab = "movies" | "shows" | "anime" | "library" | "community";

/** **بترتيب الظهور في الشريط السفليّ** — **والقائمةُ الوحيدةُ للتبويبات** */
export const RAIL_TABS: readonly RailTab[] = ["movies", "shows", "anime", "library", "community"];

/**
 * 🔴 **المفاتيحُ نوعٌ لا نصّ** — **لأنّ خطأً في حرفٍ يسقط صامتاً**:
 * `hidden.has("top-10")` تعود `false` أبداً، **فيبقى الصفُّ ظاهراً ولا
 * يشتكي أحد** (نفسُ صنفِ عطلِ D-816 حين خُمِّنت قائمةُ السماح).
 * **والمترجِمُ هو الحَكَم** حين تمرّ المفاتيحُ كلُّها من `railOff`.
 */
export type RailKey =
  | "trailers"
  | "foryou"
  | "artists"
  | "cinemas"
  | "airing"
  | "popular"
  | "top10"
  | "top10a-movies"
  | "top10a-shows"
  | "top50"
  | "soon"
  | "top50a-movies"
  | "top50a-shows"
  /* D-874 — صفوفُ المكتبة (تبويبُ «قوائمي») */
  | "autogroups"
  | "savedlists"
  /* D-874 — صفوفُ المجتمع (تبويبُ «أوائل») */
  | "featured"
  | "topweek"
  | "topreviews"
  | "talked"
  | "rising";

export interface RailSpec {
  key: RailKey;
  tabs: RailTab[];
  /** **الاسمُ من القاموس** — لا نصٌّ ثانٍ يُكتب هنا */
  label: (t: Dict, tab: RailTab) => string;
}

/**
 * **السجلُّ بترتيب ظهورها في الصفحة** — **فالقائمةُ تُقرأ كما تُرى**
 * (وقائمةٌ بترتيبٍ ثانٍ تجعل الإطفاءَ بحثاً).
 */
export const RAILS: RailSpec[] = [
  {
    key: "trailers",
    tabs: ["movies", "shows", "anime"],
    label: (t) => t.trailersForYou,
  },
  {
    key: "foryou",
    /* 🔴 **والأنمي منها — قِيس على الصفحة الحيّة** (D-662): **أوّلُ نسخةٍ
       حصرته في تبويبَي الأفلام والمسلسلات**، **و`AnimeRails` تستدعي
       `PersonalRails` أيضاً** فيُرسم «مقترح لك» في الأنمي — **وقائمةٌ
       تنقص صفّاً يراه صاحبُها تعني صفّاً لا يستطيع إطفاءه** (D-346).
       ⚠️ **و«من فنّانيك» ليست منها**: **`PersonalRails` تُسقطه للأنمي
       عمداً** (تعليقُ `anime` بنصّه) — **والفرقُ مقيسٌ لا مفترَض.** */
    tabs: ["movies", "shows", "anime"],
    label: (t) => t.suggestedForYou,
  },
  {
    key: "artists",
    tabs: ["movies", "shows"],
    label: (t) => t.artistsRail,
  },
  {
    key: "cinemas",
    tabs: ["movies", "anime"],
    label: (t, tab) => (tab === "anime" ? t.animeInCinemas : t.inCinemas),
  },
  {
    key: "airing",
    tabs: ["anime"],
    label: (t) => t.airingNowAnime,
  },
  {
    key: "popular",
    tabs: ["movies", "shows", "anime"],
    label: (t, tab) =>
      tab === "anime"
        ? t.mostPopularAnime
        : tab === "shows"
          ? t.mostPopularSeries
          : t.mostPopularMovies,
  },
  {
    key: "top10",
    tabs: ["movies", "shows"],
    label: (t, tab) => (tab === "shows" ? t.top10Series : t.top10Movies),
  },
  {
    key: "top10a-movies",
    tabs: ["anime"],
    label: (t) => t.top10AnimeMovies,
  },
  {
    key: "top10a-shows",
    tabs: ["anime"],
    label: (t) => t.top10AnimeSeries,
  },
  {
    key: "top50",
    tabs: ["movies", "shows"],
    label: (t, tab) => (tab === "shows" ? t.top50Series : t.top50Movies),
  },
  {
    key: "soon",
    tabs: ["movies", "shows", "anime"],
    label: (t, tab) => (tab === "anime" ? t.upcomingAnime : t.comingSoon),
  },
  {
    key: "top50a-movies",
    tabs: ["anime"],
    label: (t) => t.top50AnimeMovies,
  },
  {
    key: "top50a-shows",
    tabs: ["anime"],
    label: (t) => t.top50AnimeSeries,
  },
  /* ===== D-874 · المكتبة — تبويبُ «قوائمي» بترتيب ظهوره ===== */
  {
    key: "autogroups",
    tabs: ["library"],
    label: (t) => t.autoGroupsTitle,
  },
  {
    /* **مفتاحٌ واحدٌ للمحفوظة في الصفحتين** — على وزن `cinemas`:
       **الصفُّ واحدٌ عند المستخدم واسمُه يتبع صفحتَه.** */
    key: "savedlists",
    tabs: ["library", "community"],
    label: (t, tab) => (tab === "community" ? t.peopleBoardSavedLists : t.savedListsSection),
  },
  /* ===== D-874 · المجتمع — تبويبُ «أوائل» بترتيب ظهوره (D-289/D-291) ===== */
  {
    key: "featured",
    tabs: ["community"],
    label: (t) => t.peopleBoardFeatured,
  },
  {
    key: "topweek",
    tabs: ["community"],
    label: (t) => t.peopleBoardTop,
  },
  {
    key: "topreviews",
    tabs: ["community"],
    label: (t) => t.peopleBoardTopReview,
  },
  {
    key: "talked",
    tabs: ["community"],
    label: (t) => t.peopleBoardTalked,
  },
  {
    key: "rising",
    tabs: ["community"],
    label: (t) => t.peopleBoardRising,
  },
];

const KNOWN: ReadonlySet<string> = new Set<string>(RAILS.map((r) => r.key));

export function isRailTab(v: unknown): v is RailTab {
  return (RAIL_TABS as readonly unknown[]).includes(v);
}

/**
 * **السؤالُ الوحيدُ عن صفٍّ مطفأ** — **يمرّ بالنوع فلا يُخطئ حرفاً**.
 * ⚠️ **والمجموعةُ الممرَّرةُ مقصورةٌ على تبويبها** (`railsHiddenFor`)،
 * **فلا يحمل كلُّ نداءٍ اسمَ تبويبه معه.**
 */
export function railOff(hidden: ReadonlySet<string>, key: RailKey): boolean {
  return hidden.has(key);
}

/** **مفتاحُ التخزين** — `tab:key` (تصحيحُ النطاق أعلاه) */
export function railToken(tab: RailTab, key: string): string {
  return `${tab}:${key}`;
}

/**
 * **المخزَّنُ كلُّه إلى مفاتيحِ تبويبٍ واحدٍ عاريةً** — **وهي التي
 * تُمرَّر إلى الصفوف**: **فالصفُّ لا يعرف تبويبَه ولا يحتاج أن يعرفه.**
 */
export function railsHiddenFor(all: ReadonlySet<string>, tab: RailTab): Set<string> {
  const out = new Set<string>();
  const pre = `${tab}:`;
  for (const tok of all) if (tok.startsWith(pre)) out.add(tok.slice(pre.length));
  return out;
}

/** **صفوفُ تبويبٍ بترتيب ظهورها** */
export function railsOf(tab: RailTab): RailSpec[] {
  return RAILS.filter((r) => r.tabs.includes(tab));
}

/**
 * **قيمةُ الكوكي إلى مجموعةِ المخفيّ** — **والمجهولُ يسقط صامتاً**:
 * **مفتاحٌ حُذف من السجلّ غداً لا يُبقي صفّاً مطفأً إلى الأبد** (D-475).
 */
export function parseHiddenRails(raw: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const piece of (raw ?? "").split(",")) {
    const tok = piece.trim();
    const at = tok.indexOf(":");
    if (at < 1) continue;
    const tab = tok.slice(0, at);
    const key = tok.slice(at + 1);
    /* **وتبويبٌ لا يملك هذا الصفَّ يسقط أيضاً** — **فلا يبقى مفتاحٌ
       يُطفئ ما لا يُرسم أصلاً** (وينتفخ الكوكيُّ بلا أثر). */
    if (!isRailTab(tab) || !KNOWN.has(key)) continue;
    if (!RAILS.find((r) => r.key === key)?.tabs.includes(tab)) continue;
    out.add(tok);
  }
  return out;
}

/** **بترتيب التبويب ثمّ السجلّ** — فقيمتان متطابقتان نصٌّ واحد */
export function serializeHiddenRails(hidden: Iterable<string>): string {
  const clean = parseHiddenRails([...hidden].join(","));
  const out: string[] = [];
  for (const tab of RAIL_TABS) {
    for (const r of RAILS) {
      const tok = railToken(tab, r.key);
      if (clean.has(tok)) out.push(tok);
    }
  }
  return out.join(",");
}
