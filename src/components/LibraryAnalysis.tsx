import {
  getFollows,
  getMyRatings,
  getWatchedMovies,
  watchedMovieMinutes,
  getAllWatchedEpisodes,
  getWatchHistory,
  getProfile,
  getUser,
  getFollowStats,
  getProfileFavorites,
  getMyAnimeFlags,
  getTitleMetaFor,
} from "@/lib/data";
import { getTv, getMovie } from "@/lib/tmdb";
import { posterUrl } from "@/lib/media";
import Image from "next/image";
import Link from "next/link";
import { getDict, num, type Locale } from "@/lib/i18n";
import { isComplete } from "@/lib/progress";
import { Icon, type IconName } from "./Icon";
import { browseGenreForId, browseGenreName } from "@/lib/browse";

/** المدى الزمنيّ الذي تحكمه تبويبات الصفحة */
export type StatsRange = "all" | "year" | "month";

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function fmtWatchTime(minutes: number, t: ReturnType<typeof getDict>) {
  const h = Math.round(minutes / 60);
  if (h < 24) return t.hours(h);
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest === 0 ? t.days(d) : t.daysAndHours(d, rest);
}

/**
 * 🆕 **خانةُ شريط الأرقام** (D-682، مواصفةُ أحمد المكتوبة): **رمزٌ أصفرُ
 * عارٍ فوق رقمٍ فوق اسمه** — القرصُ المطوَّق سقط بنصّها («لا كروت ولا
 * Pills منفصلة لكل رقم») — **وأربعُ خاناتٍ في صفٍّ واحدٍ دائماً**
 * بفواصلَ رأسيّةٍ خفيفة.
 */
function StripCell({
  icon,
  value,
  label,
  border,
}: {
  icon: IconName;
  value: string;
  label: string;
  border: string;
}) {
  return (
    /* 🆕 D-687 (حكمُه بلقطة الشريط): **الرمزُ بجوار الرقم لا فوقه** —
       سطرٌ واحدٌ للاثنين والاسمُ تحتهما، **والهوامشُ الداخليّةُ قُلّلت**
       (py-2 · gap-1). والرمزُ في طرف البداية فيتبع اتّجاهَ القراءة. */
    <div className={`flex flex-col items-center gap-1 py-2 px-1 min-w-0 ${border}`}>
      <span className="flex items-center gap-1.5">
        <Icon name={icon} size={15} className="text-accent shrink-0" />
        <span className="text-[16px] font-bold leading-none tabular-nums" dir="ltr">
          {value}
        </span>
      </span>
      <span className="text-[11px] text-muted truncate max-w-full">{label}</span>
    </div>
  );
}

/**
 * 🆕 **بياناتُ التحليل — عقدُ الوجهِ الواحد** (D-649).
 *
 * 🔴 **ولماذا عقدٌ لا مكوّنان**: الشاشةُ نفسُها تُرسم الآن لقارئين —
 * **صاحبُها بمداه الكامل، وزائرُ ملفِّه بما تسمح به دوالُّ `definer`** —
 * **ونسخةٌ ثانيةٌ من الوجه تفترق عند أوّل تعديل** (D-145/القاعدة ٣).
 * **فالوجهُ واحدٌ والقارئان اثنان.**
 *
 * ⚠️ **وما لا يُقرأ صدقاً يغيب لا يُصفَّر**: `year = null` تعني «هذا
 * القارئ لا يملك تواريخَ مشاهدةٍ يقرؤها» **فيسقط السطرُ كلُّه** —
 * **وصفرٌ في خانةٍ يقول «لم يشاهد شيئاً» وهو كذب** (D-217).
 */
/**
 * 🆕 **بطاقةُ «ذوقك» الكاملة** (D-700، صورةُ أحمد بالضبط): سماتٌ ثمّ
 * ستُّ خانات — أنواعٌ وسنواتٌ ولغاتٌ وتنوّعٌ ومخرجون وممثلون.
 * **وكلُّ خانةٍ بلا بياناتٍ تغيب لا تتصفّر** (D-217).
 */
export interface TasteData {
  /** سماتٌ مشتقّةٌ من توزيع الأنواع — نصوصٌ جاهزةٌ بلغة القارئ */
  themes: string[];
  genres: { name: string; pct: number }[];
  decades: { label: string; pct: number }[];
  languages: { code: string; name: string; titles: number }[];
  /** 🆕 D-703: أعلى بلدين بعدِّ أعمالهما — بدل رقمٍ مجرّد */
  countries: { name: string; titles: number }[];
  /** وصفُ التنوّع بجانب عنوان الخانة — `null` حين لا بلدَ يُقرأ */
  diversityLevel: string | null;
  directors: { name: string; titles: number }[];
  actors: { name: string; titles: number }[];
}

export interface AnalysisData {
  /** دقائقُ المدى المعروض */
  minutes: number;
  episodes: number;
  movies: number;
  /** 🆕 D-698: خانتا «المسلسلات» و«التعليقات» بأسماء أحمد الأربعة */
  shows: number;
  reviews: number;
  /** 🆕 D-700: مدى الترويسة نصّاً جاهزاً («كل الأوقات» · «2026» · «أغسطس») */
  rangeLabel: string;
  /** 🆕 D-700: ملصقاتُ خلفيّة الترويسة — أوّلُ المفضّلة في كلِّ قائمة
      (مسلسل · أنمي · فيلم) والانتقاءُ الفئويُّ سدُّ النقص */
  heroPosters: string[];
  /** 🆕 D-700: بطاقةُ «ذوقك» الكاملة — والغيابُ يُسقط البطاقةَ لا يصفّرها */
  taste: TasteData | null;
  /** 🆕 **القارئُ صاحبُ الأرقام؟** (D-649) — **يقرّر ضميرَ النصّ وحدَه**:
      «ذوقك» في ملفِّ غيرك تخاطب القارئ عن أرقام سواه (D-217). */
  mine: boolean;
  /** 🆕 **ترويسةُ الهويّة** (D-679، تصميمُ أحمد): وجهٌ واسمٌ ومتابِعون
      ونبذةٌ وغلافٌ خلفَها — والغيابُ يعني قارئاً بلا ملفٍّ يُقرأ. */
  hero?: {
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    followers: number | null;
  } | null;
}

/**
 * **وجهُ التحليل** — رسمٌ خالصٌ بلا قراءةٍ واحدة (D-649).
 *
 * **شكلُ الصفحة كما رسمه أحمد** (D-493) بحرفه — **والمنقولُ هنا هو
 * الرسمُ وحدَه**، ولم يُمسَّ منه شيءٌ سوى أن مصادرَه صارت وسائطَ.
 */
export function AnalysisView({ data, locale }: { data: AnalysisData; locale: Locale }) {
  const t = getDict(locale);
  const {
    minutes: rangeMinutes,
    episodes: rangeEpisodes,
    movies: rangeMovies,
    shows,
    reviews,
    rangeLabel,
    heroPosters,
    taste,
    mine,
    hero,
  } = data;
  const divider = "border-[color:var(--divider)]";

  /* ⚖️ 🆕 D-703 (حكمُه بمربّعين: «الي عليه مربع انقلي يمين وصغّر الرقم
     درجة»): **كتلةُ الوقت غادرت جهةَ البداية إلى جهة النهاية** —
     **وتحمل حجابَها معها** (قاعدةُ D-686: العتمةُ تتبع الكلام): هالةٌ
     محلّيّةٌ بعرض محتواها، فالملصقاتُ بين الهويّة والوقت تبقى صافية.
     والرقمُ ٣٤ ← ٢٨. */
  const bigTime = (
    <div className="shrink-0 text-end rounded-2xl bg-[color:var(--surface)]/70 px-3 py-2">
      <div
        className="text-[28px] font-semibold leading-none tabular-nums"
        style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
        dir="auto"
      >
        {fmtWatchTime(rangeMinutes, t)}
      </div>
      {/* 🆕 D-700: المدى المختارُ يُقال بجوار اسم الرقم */}
      <div className="mt-1.5 text-12 text-muted">
        {t.statWatchTime} · {rangeLabel}
      </div>
      <svg aria-hidden viewBox="0 0 220 24" fill="none" className="mt-1.5 ms-auto h-3.5 w-28 text-accent/70">
        <path d="M2 20 C 58 4, 140 24, 218 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ===== البطاقةُ السينمائيّة (D-682 → D-700) ===== */}
      {hero ? (
        <section className="relative overflow-hidden isolate rounded-2xl border border-border bg-surface p-4">
          {/* ⚖️ D-700: الخلفيّةُ أوّلُ المفضّلة في كلِّ قائمة (مسلسل ·
              أنمي · فيلم) — «نكتفي بوجودهم في الكارد الأوّل» فقسمُ
              الثلاثية حُذف والملصقاتُ ورثت مكانَها هنا. الدرزُ ذائبٌ
              (D-695) والحجابُ يشفّ (٨٥٪). */}
          {heroPosters.length > 0 && (
            <>
              <span aria-hidden className="absolute inset-0 flex">
                {heroPosters.map((path, i) => (
                  <span
                    key={path}
                    className={`relative flex-1 min-w-0 ${
                      i > 0
                        ? "-ms-8 [mask-image:linear-gradient(to_right,transparent,black_36px)] rtl:[mask-image:linear-gradient(to_left,transparent,black_36px)]"
                        : ""
                    }`}
                  >
                    <Image src={posterUrl(path, "w342")!} alt="" fill sizes="40vw" className="object-cover" />
                  </span>
                ))}
              </span>
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[color:var(--surface)]/85 from-[12%] via-[color:var(--surface)]/55 via-[48%] to-transparent to-[80%]"
              />
            </>
          )}
          {/* **والبطاقةُ تحفظ قامتَها**: الوقتُ نزل إلى قاعها لا إلى
              جنبِ الاسم — `min-h` يمنع انكماشَ البطاقة السينمائيّة إلى
              شريط (قِيس على المنشور بعد أوّل نشرة). */}
          <div className="relative flex flex-col min-h-[9rem]">
            <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="shrink-0 relative w-12 h-12 rounded-full overflow-hidden bg-surface-2 border border-accent/70">
                {hero.avatarUrl ? (
                  <Image src={hero.avatarUrl} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-muted">
                    <Icon name="people" size={20} />
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[17px] font-bold min-w-0">
                  <span className="truncate" dir="auto">{hero.name}</span>
                  <Icon name="sparkle-star" size={13} className="shrink-0 text-accent" aria-hidden />
                </span>
                {hero.followers !== null && (
                  <span className="mt-0.5 flex items-center gap-1.5 text-12 text-muted">
                    <Icon name="people" size={13} />
                    {t.suggestFollowers(hero.followers)}
                  </span>
                )}
              </span>
            </div>
            {hero.bio && (
              /* **النبذةُ تلزم عمودَ حجابها** (D-693) — والحجابُ يحمي
                 جهةَ البداية، فما جاوزها يغرق فوق الملصقات */
              <p className="mt-2 text-[13px] leading-snug text-muted line-clamp-2 max-w-[52%]" dir="auto">
                {hero.bio}
              </p>
            )}
            </div>
            <div className="mt-auto pt-3 flex justify-end">{bigTime}</div>
          </div>
        </section>
      ) : (
        bigTime
      )}

      {/* ===== شريطُ الأرقام (D-698) ===== */}
      <div className="grid grid-cols-4">
        <StripCell icon="tv" value={num(shows, locale)} label={t.statsCellShows} border="" />
        <StripCell icon="film" value={num(rangeMovies, locale)} label={t.statsCellMoviesWatched} border={`border-s ${divider}`} />
        <StripCell icon="play" value={num(rangeEpisodes, locale)} label={t.statsCellEpisodesWatched} border={`border-s ${divider}`} />
        <StripCell icon="comment" value={num(reviews, locale)} label={t.statsCellComments} border={`border-s ${divider}`} />
      </div>

      {/* ===== بطاقةُ «ذوقك» الكاملة (D-700 — الصورةُ بالضبط) ===== */}
      {taste && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="flex items-center gap-2.5 text-[17px] font-bold">
            <Icon name="trio" size={22} className="text-accent" />
            {mine ? t.analysisTaste : t.analysisTasteOther}
          </h3>

          {taste.themes.length > 0 && (
            <div className="mt-3.5 flex items-center gap-2.5 flex-wrap">
              <span className="text-13 text-muted shrink-0">{t.tasteThemes}</span>
              {taste.themes.map((th) => (
                <span
                  key={th}
                  className="rounded-full border border-accent/70 text-accent text-12 font-semibold px-3.5 py-1.5"
                >
                  {th}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-x-4">
            {taste.genres.length > 0 && (
              <TasteCell title={t.tasteGenres}>
                {taste.genres.map((g) => (
                  <TasteRow key={g.name} name={g.name} value={`${g.pct}%`} />
                ))}
              </TasteCell>
            )}
            {taste.decades.length > 0 && (
              <TasteCell title={t.tasteYears}>
                {taste.decades.map((d) => (
                  <TasteRow key={d.label} name={d.label} value={`${d.pct}%`} ltr />
                ))}
              </TasteCell>
            )}
            {taste.languages.length > 0 && (
              <TasteCell title={t.tasteLanguages} divider>
                {taste.languages.map((l) => (
                  <TasteRow
                    key={l.code}
                    name={l.name}
                    value={num(l.titles, locale)}
                    unit={unitWord(t.personWorksCount(l.titles))}
                  />
                ))}
              </TasteCell>
            )}
            {taste.countries.length > 0 && (
              /* ⚖️ 🆕 D-703 (حكمُه: «حسّن diversity»): الخانةُ كانت تقول
                 كلمةً مجرّدةً ورقماً — **صارت تسمّي البلدانَ نفسَها**
                 (أعلى اثنين بعدِّ أعمالهما) **والمستوى وصفٌ في عنوانها**،
                 فوافقت أخواتِها الخمسَ في الشكل وزادت معنًى. */
              <TasteCell title={t.tasteDiversity} note={taste.diversityLevel ?? undefined} divider>
                {taste.countries.map((c) => (
                  <TasteRow
                    key={c.name}
                    name={c.name}
                    value={num(c.titles, locale)}
                    unit={unitWord(t.personWorksCount(c.titles))}
                  />
                ))}
              </TasteCell>
            )}
            {taste.directors.length > 0 && (
              <TasteCell title={t.tasteDirectors} divider>
                {taste.directors.map((d) => (
                  <TasteRow
                    key={d.name}
                    name={d.name}
                    value={num(d.titles, locale)}
                    unit={unitWord(t.personWorksCount(d.titles))}
                  />
                ))}
              </TasteCell>
            )}
            {taste.actors.length > 0 && (
              <TasteCell title={t.tasteActors} divider>
                {taste.actors.map((a) => (
                  <TasteRow
                    key={a.name}
                    name={a.name}
                    value={num(a.titles, locale)}
                    unit={unitWord(t.personWorksCount(a.titles))}
                  />
                ))}
              </TasteCell>
            )}
          </div>
        </section>
      )}

    </div>
  );
}

/** خانةُ بطاقة الذوق: عنوانٌ (ووصفٌ اختياريٌّ) وصفوفُه — ⚖️ D-702:
    أقراصُ الأيقونات حُذفت، و⚖️ D-703: أقراصُ الحروف كذلك. */
function TasteCell({
  title,
  note,
  divider = false,
  children,
}: {
  title: string;
  /** وصفٌ بجانب العنوان — «متوسّط» بجانب «التنوّع» */
  note?: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`py-3.5 min-w-0 ${divider ? "border-t border-[color:var(--divider)]" : ""}`}>
      <span className="block text-13 text-muted mb-1.5">
        {title}
        {note && <span className="text-accent font-semibold"> · {note}</span>}
      </span>
      <span className="block space-y-1.5">{children}</span>
    </div>
  );
}

/**
 * ⚖️ 🆕 **صفُّ بطاقة الذوق — وصفةٌ واحدةٌ لخاناتها الستّ** (D-703، حكمُه:
 * «وحّد مقاسات الحروف، و«2 titles» خلها في نفس الصف مع الاسم»):
 * **الاسمُ ورقمُه في سطرٍ واحدٍ بمقاسٍ واحد** — والرقمُ بلون الهويّة
 * ووحدتُه هادئة. **وستُّ خاناتٍ بستّة أشكالٍ هي العطلُ بعينه** (القاعدة ٣).
 */
function TasteRow({
  name,
  value,
  unit,
  ltr = false,
}: {
  name: string;
  value: string;
  unit?: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-14 truncate" dir={ltr ? "ltr" : "auto"}>
        {name}
      </span>
      <span className="ms-auto shrink-0 text-14 font-semibold text-accent tabular-nums">
        {value}
        {unit && <span className="font-normal text-muted"> {unit}</span>}
      </span>
    </div>
  );
}

/** كلمةُ الوحدة من صيغةٍ قائمةٍ («٥ أعمال» → «أعمال») — بلا مفتاحٍ جديد */
function unitWord(phrase: string): string {
  return phrase.replace(/^[0-9,٠-٩\s]+/, "").trim();
}


/**
 * 🆕 **مُنتقي «ثلاثية الذوق»** (D-682، نصُّ المواصفة): **خانةٌ لكلِّ فئةٍ —
 * الأنمي المفضّل فالمسلسلُ فالفيلم** — لا أعلى ثلاثةٍ كيفما اتّفق (كما
 * كانت في D-679). **والاختيارُ اليدويُّ هو الأصل والانتقاءُ هذا سدُّه
 * المؤقّت** («أعلى عمل مكتمل وتقييماً في كل فئة») حتى يُبنى المُنتقي.
 *
 * ⚠️ **والأنمي هنا تقريبٌ مُعلَن**: عمودُ `follows.genres` يحمل الأنواعَ
 * بلا بلدِ المنشأ — **ومعيارُ `isAnime` الكامل (رسومٌ + يابان) يحتاج
 * نداءَ TMDB لكلِّ عمل** وهو ما أسقطته الهجرة ١٤٢ عمداً. فالرسومُ
 * المتحرّكة (١٦) تُحسب أنمي، **والاختيارُ اليدويُّ القادم يصحّح الشاذّ.**
 *
 * ⚠️ **وفئةٌ فارغةٌ تسقط لا تُحشى من جارتها** (D-217): من لا أنمي عنده
 * يرى بطاقتين صادقتين لا ثلاثاً إحداها كذب.
 */
export interface TrioCandidate {
  key: string;
  category: "anime" | "series" | "movie";
  title: string;
  posterPath: string | null;
  href: string;
  completed: boolean;
  rating: number | null;
  watched: number;
}

/**
 * 🆕 **بناءُ بطاقة «ذوقك»** (D-700) — مساعدٌ خالصٌ يطعمه القارئان
 * (D-145): توزيعُ الأنواع من عمود `follows.genres`، والباقي من كتالوج
 * `title_meta` (الهجرة ١٥٠) — **صفرُ نداء TMDB وقتَ العرض** (D-649).
 *
 * **والسماتُ اشتقاقٌ مُعلَنٌ من توزيع الأنواع** (دراما+رومانسي=عاطفي،
 * جريمة+إثارة+غموض+رعب=مظلم…) — **لا ذكاءٌ يدّعي قراءةَ النفوس**،
 * وثلاثُ سماتٍ على الأكثر ولا سمةَ لتوزيعٍ لا يحملها.
 */
export function buildTaste(args: {
  keys: { media_type: "tv" | "movie"; tmdb_id: number }[];
  metas: Map<string, { release_year: number | null; original_language: string | null; origin_countries: string[] | null; director: string | null; top_cast: string[] | null }>;
  bySlug: Map<string, number>;
  genreTags: number;
  topGenres: { name: string; count: number }[];
  t: ReturnType<typeof getDict>;
  locale: Locale;
}): TasteData | null {
  const { keys, metas, bySlug, genreTags, topGenres, t, locale } = args;

  const g = (slug: string) => bySlug.get(slug) ?? 0;
  const themeScores: { label: string; score: number }[] = [
    { label: t.themeEmotional, score: g("drama") * 0.6 + g("romance") },
    { label: t.themeDark, score: g("crime") + g("thriller") + g("mystery") + g("horror") },
    { label: t.themeCharacter, score: g("drama") * 0.5 + g("mystery") * 0.3 + g("war") * 0.3 },
    { label: t.themeEpic, score: g("action") + g("scifi") + g("war") * 0.5 },
    { label: t.themeFeelGood, score: g("comedy") + g("family") + g("animation") * 0.5 },
  ];
  const themes = themeScores
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.label);

  const genres = topGenres.slice(0, 2).map((x) => ({ name: x.name, pct: pct(x.count, genreTags) }));

  const decadeTally = new Map<number, number>();
  const langTally = new Map<string, number>();
  const countryTally = new Map<string, number>();
  const directorTally = new Map<string, number>();
  const actorTally = new Map<string, number>();
  for (const k of keys) {
    const m = metas.get(`${k.media_type}-${k.tmdb_id}`);
    if (!m) continue;
    if (m.release_year && m.release_year > 1900) {
      const d = Math.floor(m.release_year / 10) * 10;
      decadeTally.set(d, (decadeTally.get(d) ?? 0) + 1);
    }
    if (m.original_language) langTally.set(m.original_language, (langTally.get(m.original_language) ?? 0) + 1);
    for (const c of m.origin_countries ?? []) countryTally.set(c, (countryTally.get(c) ?? 0) + 1);
    if (m.director) directorTally.set(m.director, (directorTally.get(m.director) ?? 0) + 1);
    for (const a of m.top_cast ?? []) actorTally.set(a, (actorTally.get(a) ?? 0) + 1);
  }

  const yearTotal = [...decadeTally.values()].reduce((a, b) => a + b, 0);
  const decades = [...decadeTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([d, n]) => ({ label: t.tasteDecade(d), pct: pct(n, yearTotal) }));

  /* اسمُ اللغة بلغة القارئ — Intl لا سجلٌّ يدويّ، والسقوطُ رمزُها */
  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames([locale === "ar" ? "ar" : "en"], { type: "language" });
  } catch {
    dn = null;
  }
  const languages = [...langTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code, n]) => {
      let name = code.toUpperCase();
      try {
        name = dn?.of(code) ?? name;
      } catch {
        /* رمزٌ شاذٌّ يبقى رمزاً */
      }
      return { code, name, titles: n };
    });

  /* **اسمُ البلد بلغة القارئ** — `Intl` لا سجلٌّ يدويّ، والسقوطُ رمزُه */
  let rn: Intl.DisplayNames | null = null;
  try {
    rn = new Intl.DisplayNames([locale === "ar" ? "ar" : "en"], { type: "region" });
  } catch {
    rn = null;
  }
  const countryCount = countryTally.size;
  const countries = [...countryTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code, n]) => {
      let name = code;
      try {
        name = rn?.of(code) ?? code;
      } catch {
        /* رمزٌ شاذٌّ يبقى رمزاً */
      }
      return { name, titles: n };
    });
  const diversityLevel =
    countryCount > 0
      ? `${countryCount >= 8 ? t.tasteDivHigh : countryCount >= 4 ? t.tasteDivMid : t.tasteDivLow}`
      : null;

  const top2 = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name, n]) => ({ name, titles: n }));
  const directors = top2(directorTally);
  const actors = top2(actorTally);

  if (
    !themes.length &&
    !genres.length &&
    !decades.length &&
    !languages.length &&
    !countries.length &&
    !directors.length &&
    !actors.length
  ) {
    return null;
  }
  return { themes, genres, decades, languages, countries, diversityLevel, directors, actors };
}

export function pickTasteTrioSlots(
  cands: TrioCandidate[],
): Partial<Record<"anime" | "series" | "movie", { posterPath: string | null }>> {
  const out: Partial<Record<"anime" | "series" | "movie", { posterPath: string | null }>> = {};
  for (const cat of ["anime", "series", "movie"] as const) {
    const best = cands
      .filter((c) => c.category === cat)
      .sort(
        (a, b) =>
          Number(b.completed) - Number(a.completed) ||
          (b.rating ?? -1) - (a.rating ?? -1) ||
          b.watched - a.watched,
      )[0];
    if (best) out[cat] = { posterPath: best.posterPath };
  }
  return out;
}

/**
 * 🆕 **تعدادُ الذوق من عمود `follows.genres`** (D-649) — قارئان يستعملانه.
 *
 * 🔴 **وكان ثمانين نداءَ TMDB في كلِّ فتحةٍ للإحصائيات**: عيّنةُ أربعين
 * مسلسلاً وأربعين فيلماً تُطلب تفاصيلُها لأجل أسماءِ أنواعها وحدَها —
 * **والعمودُ يحملها الآن** (الهجرة ١٤٢) **فالعددُ صفر، والتعدادُ صار على
 * المكتبة كلِّها لا على عيّنةٍ منها.**
 *
 * 🔑 **والاسمُ من `BROWSE_GENRES` لا من TMDB**: اسمُ TMDB يأتي بلغة
 * النداء، **ورفُّ الاكتشاف يسمّي الأنواعَ بأسمائها في اللغتين أصلاً** —
 * **فسجلٌّ واحدٌ يخدم الرفَّ والملفَّ والإحصائيات** (القاعدة ٣/D-145).
 *
 * ⚠️ **والمفهومُ يُعدّ مرّةً للعملِ الواحد**: «أكشن ومغامرة» مفهومٌ يجمع
 * `28` و`12`، **وعملٌ يحمل الرقمين ليس ضِعفَ أكشن.**
 */
export function tallyGenres(
  rows: readonly (number[] | null | undefined)[],
  locale: Locale,
): { topGenres: { name: string; count: number }[]; genreTags: number; bySlug: Map<string, number> } {
  const tally = new Map<string, { name: string; count: number }>();
  let genreTags = 0;
  for (const ids of rows) {
    if (!ids?.length) continue;
    const seen = new Set<string>();
    for (const id of ids) {
      const g = browseGenreForId(id);
      if (!g || seen.has(g.slug)) continue;
      seen.add(g.slug);
      const name = browseGenreName(g, locale);
      const cur = tally.get(g.slug);
      if (cur) cur.count++;
      else tally.set(g.slug, { name, count: 1 });
      genreTags++;
    }
  }
  const topGenres = [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  /* 🆕 D-700: الخريطةُ الكاملةُ للسمات — القمّةُ وحدَها لا تكفي مشتقّها */
  const bySlug = new Map<string, number>();
  for (const [slug, v] of tally) bySlug.set(slug, v.count);
  return { topGenres, genreTags, bySlug };
}

/**
 * تحليل المكتبة — **شكلٌ سلّمه أحمد** (D-493) — **قارئُ صاحبِ الحساب.**
 *
 * ⚖️ 🆕 **والرسمُ غادر إلى `AnalysisView`** (D-649): الشاشةُ نفسُها تُرسم
 * لزائر ملفٍّ الآن، **ونسخةٌ ثانيةٌ من الوجه تفترق عند أوّل تعديل**
 * (D-145). **وهذه صارت قراءةً خالصة.**
 *
 * ⚠️ **والحلقاتُ تُقرأ كاملةً لا بسقفِ ألف** (`getAllWatchedEpisodes`
 * المُرقِّمة): **الرقمُ المعروض قبل اليوم كان «١٠٠٠ حلقة» بالضبط** —
 * وهو سقفُ الاستعلام لا عددُ ما شاهده. **ورقمٌ يساوي سقفَه ليس رقماً،
 * هو الحدُّ يرتدي زيَّ حقيقة.**
 */
export async function LibraryAnalysis({
  locale,
  range = "all",
}: {
  locale: Locale;
  range?: StatsRange;
}) {
  const t = getDict(locale);

  const [follows, ratings, episodes, watchedMovies, history, profile, user] =
    await Promise.all([
      getFollows(),
      getMyRatings(),
      getAllWatchedEpisodes(),
      getWatchedMovies(),
      getWatchHistory(1000),
      /* 🆕 **الهويّةُ للترويسة** (D-679) — `cache()` فلا رحلةَ جديدة */
      getProfile(),
      getUser(),
    ]);
  /* 🆕 **وعدُّ المتابِعين** (D-679) — دالّةُ `follow_stats` المحروسة (١٣٨) */
  const followStats = user
    ? await getFollowStats(user.id).catch(() => null)
    : null;

  if (!follows.length) {
    return <p className="text-sm text-muted text-center py-10">{t.analysisEmpty}</p>;
  }

  const watchedMovieIds = new Set(watchedMovies.map((m) => m.id));
  const movieMinutes = watchedMovieMinutes(watchedMovies);

  const watchedByShow = new Map<number, number>();
  let epMinutes = 0;
  for (const w of episodes) {
    watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
    epMinutes += w.runtime ?? 40;
  }

  const tvFollows = follows.filter((f) => f.media_type === "tv");

  /* ===== المدى المختار =====
     **البادئةُ نصٌّ لا تاريخ**: `watched_at` نصٌّ ISO، **ومقارنةُ
     بادئةٍ أرخصُ من بناء `Date` لكلِّ صفٍّ من آلاف** — ولا منطقةَ
     زمنيّةً تنزلق تحتها. */
  const nowY = new Date().getUTCFullYear();
  const monthKey = new Date().toISOString().slice(0, 7);
  const prefix = range === "year" ? String(nowY) : range === "month" ? monthKey : "";

  const inRange = (iso: string) => prefix === "" || iso.startsWith(prefix);

  const rangeEpRows = prefix ? episodes.filter((e) => inRange(e.watched_at)) : episodes;
  const rangeEpisodes = rangeEpRows.length;
  const rangeEpMinutes = rangeEpRows.reduce((n, e) => n + (e.runtime ?? 40), 0);

  /* ⚠️ **والأفلامُ من السجلّ لأنه وحدَه يحمل تاريخَها** — وهي عشراتٌ
     لا آلاف، **فسقفُ الألف لا يبلغها** (بخلاف الحلقات أعلاه). */
  const movieHistory = history.filter((h) => h.kind === "movie");
  const rangeMovieRows = prefix ? movieHistory.filter((h) => inRange(h.watchedAt)) : movieHistory;
  const rangeMovies = prefix ? rangeMovieRows.length : watchedMovieIds.size;
  const rangeMovieMinutes = prefix
    ? rangeMovieRows.reduce((n, h) => n + (h.runtime ?? 110), 0)
    : movieMinutes;

  const rangeMinutes = rangeEpMinutes + rangeMovieMinutes;

  /* 🆕 D-698: «المسلسلات» عدُّ مسلسلات مكتبته (لا يتبع المدى — المكتبةُ
     ليست حدثاً مؤرَّخاً)، و«التعليقات» ما كتب فيه نصٌّ فعلاً — تقييمٌ
     صامتٌ ليس تعليقاً، وتسميتُه تعليقاً كذبٌ صغير (D-219). */
  const shows = tvFollows.length;
  const rangeRatings = prefix ? ratings.filter((r) => inRange(r.updated_at)) : ratings;
  const reviews = rangeRatings.filter((r) => (r.review ?? "").trim().length > 0).length;

  /* ⚖️ 🆕 **والأنواعُ من العمود لا من ثمانين نداءَ TMDB** (D-649):
     `follows.genres` يحملها منذ الهجرة ١٤٢ — **والنداءُ لم يبقَ إلا لما
     لم يُقرأ بعد، بسقف أربعين كما كان**، **ويصير صفراً بعد تعبئة
     `‎/api/genres`.** **والتعدادُ صار على المكتبة كلِّها لا على عيّنة.** */
  const missing = follows.filter((f) => f.genres == null).slice(0, 40);
  const fetched = await Promise.all(
    missing.map((f) =>
      (f.media_type === "tv" ? getTv(f.tmdb_id) : getMovie(f.tmdb_id)).catch(() => null),
    ),
  );
  const fetchedIds = new Map<string, number[]>();
  missing.forEach((f, i) => {
    const ids = fetched[i]?.genres?.map((g) => g.id) ?? [];
    if (ids.length) fetchedIds.set(`${f.media_type}-${f.tmdb_id}`, ids);
  });
  const { topGenres, genreTags, bySlug } = tallyGenres(
    follows.map((f) => f.genres ?? fetchedIds.get(`${f.media_type}-${f.tmdb_id}`) ?? null),
    locale,
  );

  /* ===== 🆕 عقدُ D-679: الترويسةُ والثلاثيةُ والسلال ===== */
  const hero = profile
    ? {
        name: profile.nickname || t.anonymousUser,
        avatarUrl: profile.avatar_url,
        /* **النبذةُ تتبع الاسمَ في الإخفاء** (profile_bio.sql) */
        bio: profile.hide_name ? null : (profile.bio ?? null),
        followers: followStats ? followStats.followers : null,
      }
    : null;

  /* ⚖️ **الثلاثيةُ صارت فئويّةً** (D-682 ناقضاً انتقاءَ D-679 الحرّ):
     أنمي · مسلسل · فيلم — **مرشّحوها المكتبةُ كلُّها** والتقييمُ من
     خريطةٍ لا من ترتيب `getMyRatings` */
  const ratingByKey = new Map<string, number>();
  for (const r of ratings) {
    const key = `${r.media_type}-${r.tmdb_id}`;
    if (!ratingByKey.has(key)) ratingByKey.set(key, r.rating);
  }
  const trioCands: TrioCandidate[] = follows.map((f) => {
    const key = `${f.media_type}-${f.tmdb_id}`;
    const genreIds = f.genres ?? fetchedIds.get(key) ?? [];
    const watchedEp = f.media_type === "tv" ? (watchedByShow.get(f.tmdb_id) ?? 0) : 0;
    return {
      key,
      category:
        f.media_type === "movie" ? "movie" : genreIds.includes(16) ? "anime" : "series",
      title: f.title,
      posterPath: f.poster_path,
      href: f.media_type === "movie" ? `/movie/${f.tmdb_id}` : `/show/${f.tmdb_id}`,
      completed:
        f.media_type === "movie"
          ? watchedMovieIds.has(f.tmdb_id)
          : isComplete(watchedEp, f.aired_episodes ?? f.total_episodes ?? 0),
      rating: ratingByKey.get(key) ?? null,
      watched: f.media_type === "movie" ? (watchedMovieIds.has(f.tmdb_id) ? 1 : 0) : watchedEp,
    };
  });

  /* 🆕 D-700: خلفيّةُ الترويسة **أوّلُ المفضّلة في كلِّ قائمة** (حكمُه:
     «المسلسل والأنمي والفلم مأخوذ من المفضلة أول واحد في كل قائمة») —
     `profile_favorites` مرتّبةٌ بترتيبه (sort_order)، والانتقاءُ
     الفئويُّ (D-682) **سدُّ الخانة الفارغة** لا بديلُها. */
  const [favs, animeFlags, metas] = await Promise.all([
    getProfileFavorites(user!.id),
    getMyAnimeFlags(),
    getTitleMetaFor(follows.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id }))),
  ]);
  const slots = pickTasteTrioSlots(trioCands);
  const isAnimeFav = (f: { media_type: string; tmdb_id: number }) =>
    animeFlags.get(`${f.media_type}-${f.tmdb_id}`) === true;
  const favSeries = favs.find((f) => f.media_type === "tv" && !isAnimeFav(f));
  const favAnime = favs.find((f) => isAnimeFav(f));
  const favMovie = favs.find((f) => f.media_type === "movie" && !isAnimeFav(f));
  const heroPosters = [
    favSeries?.poster_path ?? slots.series?.posterPath,
    favAnime?.poster_path ?? slots.anime?.posterPath,
    favMovie?.poster_path ?? slots.movie?.posterPath,
  ].filter((x): x is string => !!x);

  /* 🆕 D-700: المدى يُقال في الترويسة — «كل الأوقات» حين لا مدى */
  const rangeLabel =
    range === "year"
      ? String(nowY)
      : range === "month"
        ? new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "long" }).format(new Date())
        : t.statsAllTime;

  const taste = buildTaste({
    keys: follows.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id })),
    metas,
    bySlug,
    genreTags,
    topGenres,
    t,
    locale,
  });

  return (
    <AnalysisView
      locale={locale}
      data={{
        minutes: rangeMinutes,
        episodes: rangeEpisodes,
        movies: rangeMovies,
        shows,
        reviews,
        rangeLabel,
        heroPosters,
        taste,
        mine: true,
        hero,
      }}
    />
  );
}

/** هيكل عظمي بنفس ارتفاع التحليل تقريباً حتى لا تقفز الصفحة عند وصوله */
export function LibraryAnalysisSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* البطاقةُ السينمائيّة */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface-2 shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-36 rounded bg-surface-2" />
            <div className="h-3 w-24 rounded bg-surface-2" />
          </div>
        </div>
        <div className="h-9 w-44 rounded bg-surface-2 mt-5" />
        <div className="h-3 w-28 rounded bg-surface-2 mt-3" />
      </div>
      {/* شريطُ الأرقام */}
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded bg-surface-2" />
        ))}
      </div>
      {/* بطاقةُ الذوق الكاملة */}
      <div className="h-[26rem] rounded-2xl bg-surface-2" />
    </div>
  );
}
