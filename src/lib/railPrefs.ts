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
 * 🔑 **ومفتاحٌ واحدٌ لصفٍّ واحدٍ عبر التبويبات** (`top10` لا
 * `top10-movie` و`top10-tv`): **تبويبُ الأفلام يرسم نسخةَ الأفلام
 * وحدَها** (`wantMovies`) — **ومفتاحان لصفٍّ يراه المستخدمُ واحداً
 * يجعله يُطفئه مرّتين.**
 *
 * ⚠️ **والاسمُ يُقرأ من القاموس نفسِه الذي يرسمه الصفّ** (D-703):
 * **من أطفأ «الأكثر شعبية» يجب أن يقرأ في القائمة ما يقرؤه فوق
 * الصفّ** — **واسمان لشيءٍ واحدٍ يفترقان عند أوّل تعديل** (درسُ
 * `headerStatMeta` في D-787).
 *
 * ⚠️ **ولا يشمل «القوائم»**: تبويبُها لا صفوفَ أعمالٍ فيه.
 */

export const RAILS_COOKIE = "loopz_rails";

/** تبويباتُ اكتشف التي لها صفوف */
export type RailTab = "movies" | "shows" | "anime";

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
  | "top50a-shows";

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
    tabs: ["movies", "shows"],
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
];

const KNOWN: ReadonlySet<string> = new Set<string>(RAILS.map((r) => r.key));

export function isRailTab(v: unknown): v is RailTab {
  return v === "movies" || v === "shows" || v === "anime";
}

/** **السؤالُ الوحيدُ عن صفٍّ مطفأ** — **يمرّ بالنوع فلا يُخطئ حرفاً** */
export function railOff(hidden: ReadonlySet<string>, key: RailKey): boolean {
  return hidden.has(key);
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
    const k = piece.trim();
    if (k && KNOWN.has(k)) out.add(k);
  }
  return out;
}

/** **بترتيب السجلّ لا بترتيب الإطفاء** — فقيمتان متطابقتان نصٌّ واحد */
export function serializeHiddenRails(hidden: Iterable<string>): string {
  const set = new Set([...hidden].filter((k) => KNOWN.has(k)));
  return RAILS.filter((r) => set.has(r.key))
    .map((r) => r.key)
    .join(",");
}
