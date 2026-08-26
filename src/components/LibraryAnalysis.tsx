import {
  getFollows,
  getMyRatings,
  getWatchedMovies,
  watchedMovieMinutes,
  getAllMovieProgress,
  getAllWatchedEpisodes,
  getWatchHistory,
  getProfile,
  getUser,
  getFollowStats,
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
    <div className={`flex flex-col items-center gap-1.5 py-3 px-1 min-w-0 ${border}`}>
      <Icon name={icon} size={22} className="text-accent" />
      <span className="text-20 font-bold leading-none tabular-nums" dir="ltr">
        {value}
      </span>
      <span className="text-12 text-muted truncate max-w-full">{label}</span>
    </div>
  );
}

/**
 * 🆕 **قرصُ تقدّم المكتبة** (D-679) — `conic-gradient` بثلاثة رموزِ
 * ثيمٍ لا ألوانٍ صمّاء، **والمركزُ نسبةُ المكتمل** كلقطته.
 */
function ProgressDonut({ done, watching, rest, pct: pctDone }: {
  done: number;
  watching: number;
  rest: number;
  pct: number;
}) {
  const total = Math.max(1, done + watching + rest);
  const a = (done / total) * 100;
  const b = a + (watching / total) * 100;
  return (
    <span
      aria-hidden
      className="shrink-0 grid place-items-center w-32 h-32 rounded-full"
      style={{
        background: `conic-gradient(var(--success) 0 ${a}%, var(--accent) ${a}% ${b}%, var(--disabled) ${b}% 100%)`,
      }}
    >
      {/* **النسبةُ 34px بنصّ المواصفة** — رقمٌ زخرفيٌّ خارج سلّم D-459 كجاراته */}
      <span className="grid place-items-center w-24 h-24 rounded-full bg-surface text-[34px] font-bold tabular-nums leading-none">
        {pctDone}
        <span className="text-12 font-bold text-muted ms-0.5">%</span>
      </span>
    </span>
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
export interface AnalysisData {
  /** دقائقُ المدى المعروض */
  minutes: number;
  /** نصيبُ المدى من الوقت كلِّه — `1` حين المعروضُ هو الكلّ */
  share: number;
  episodes: number;
  movies: number;
  titles: number;
  /** عددُ تقييمات المدى ومتوسطها — `0` عدداً يخفي المتوسّط */
  ratings: number;
  avgRating: number;
  /** سطرُ «منذ يناير» — `null` لقارئٍ بلا تواريخ */
  year: { year: number; episodes: number; movies: number; minutes: number } | null;
  topWatched: { id: number; title: string; posterPath: string | null; watched: number }[];
  /** توزيعُ الذوق — الاسمُ محسوبٌ عند القراءة بلغة القارئ */
  topGenres: { name: string; count: number }[];
  /** مقامُ النسب: مجموعُ الوسوم لا عددُ الأعمال */
  genreTags: number;
  status: { done: number; inProgress: number; notStarted: number };
  ratedTotal: number;
  avgAll: number;
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
  /** 🆕 **ثلاثيةُ الذوق** (D-679): أعلى ما قيّمه، وأكثرُ ما شاهده عند
      النقص — **وأقلُّ من واحدةٍ يُسقط القسمَ لا يزخرفه.** */
  trio?: { key: string; title: string; posterPath: string | null; href: string }[];
  /** 🆕 **توزيعُ التقييمات في خمس سلالٍ** (D-679): ١–٢ · ٣–٤ · ٥–٦ ·
      ٧–٨ · ٩–١٠ — من صفوف التقييم نفسِها بلا نداء. */
  buckets?: number[];
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
    titles: rangeTitles,
    ratings: rangeRatings,
    avgRating: rangeAvg,
    topWatched,
    topGenres,
    genreTags,
    status,
    ratedTotal,
    avgAll,
    mine,
    hero,
    trio,
    buckets,
  } = data;
  const { done, inProgress, notStarted } = status;
  const statusTotal = done + inProgress + notStarted;
  const donePct = statusTotal ? Math.round((done / statusTotal) * 100) : 0;
  const divider = "border-[color:var(--divider)]";
  const bucketTotal = (buckets ?? []).reduce((a, b) => a + b, 0);

  /* **فنُّ البطاقة السينمائيّة ملصقاتُ أعماله لا غلافُ ملفّه** (D-682،
     نصُّ المواصفة: «صور أعمال مدمجة في الجهة اليمنى») — الأكثرُ مشاهدةً
     أوّلاً لأنه توقيعُه، **والثلاثيةُ تسدّ النقص** — والمفتاحُ يمنع الثنائي */
  const heroArt: string[] = [];
  const seenArt = new Set<string>();
  for (const w of [...(topWatched ?? []), ...(trio ?? [])]) {
    const path = w.posterPath;
    if (!path || seenArt.has(path)) continue;
    seenArt.add(path);
    heroArt.push(path);
    if (heroArt.length >= 3) break;
  }

  /* **رقمُ الوقت الكبير بحرف Serif** — بنصّ المواصفة: «خط أنيق Serif
     للرقم الرئيسي فقط»، والباقي بخطّ النظام. **وبلا `dir` مفروض**:
     النصُّ عربيٌّ مركّب وفرضُ LTR قلبه (درسُ D-679 المقيس). */
  const bigTime = (
    <div className="mt-4">
      <div
        className="text-[52px] font-semibold leading-none tabular-nums"
        style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
        dir="auto"
      >
        {fmtWatchTime(rangeMinutes, t)}
      </div>
      <div className="mt-1.5 text-15 text-muted">{t.statWatchTime}</div>
      {/* خطٌّ أصفرُ منحنٍ رفيعٌ للزينة — كتلةٌ قائمةٌ بذاتها فلا يمرّ خلف نصّ */}
      <svg aria-hidden viewBox="0 0 220 24" fill="none" className="mt-2 h-5 w-44 text-accent/70">
        <path d="M2 20 C 58 4, 140 24, 218 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ===== البطاقةُ السينمائيّة: الهويّةُ والوقتُ الكبير (D-682) ===== */}
      {hero ? (
        <section className="relative overflow-hidden isolate rounded-2xl border border-border bg-surface p-4">
          {heroArt.length > 0 && (
            <>
              <span aria-hidden className="absolute inset-y-0 end-0 w-[55%] flex">
                {heroArt.map((path) => (
                  <span key={path} className="relative flex-1 min-w-0">
                    {/* **بحجم العرض لا أكبر** (نصُّ المواصفة): w342 لثلث بطاقة */}
                    <Image src={posterUrl(path, "w342")!} alt="" fill sizes="20vw" className="object-cover" />
                  </span>
                ))}
              </span>
              {/* **حجابُ D-678 نفسُه بلون البطاقة**: يحمي النصَّ في جهة البداية
                  ويذوب قبل الطرف فلا «غبار» فوق الملصقات */}
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[color:var(--surface)] from-[42%] via-[color:var(--surface)]/70 via-[60%] to-transparent to-[85%]"
              />
            </>
          )}
          <div className="relative">
            <div className="flex items-center gap-3">
              {/* **48px بإطارٍ أصفرَ داكنٍ 1px** — لا طوقَ `ring` سميكاً (المواصفة: بلا حدود سميكة) */}
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
                <span className="flex items-center gap-1.5 text-22 font-bold min-w-0">
                  <span className="truncate" dir="auto">{hero.name}</span>
                  <Icon name="sparkle-star" size={15} className="shrink-0 text-accent" aria-hidden />
                </span>
                {/* **المتابِعون وحدَهم** — لا اسمَ مستخدمٍ ولا «يتابِع» (نصُّ المواصفة) */}
                {hero.followers !== null && (
                  <span className="mt-0.5 flex items-center gap-1.5 text-14 text-muted">
                    <Icon name="people" size={15} />
                    {t.suggestFollowers(hero.followers)}
                  </span>
                )}
              </span>
            </div>
            {hero.bio && (
              <p className="mt-2 text-15 leading-[21px] text-muted line-clamp-2 max-w-[36ch]" dir="auto">
                {hero.bio}
              </p>
            )}
            {bigTime}
          </div>
        </section>
      ) : (
        bigTime
      )}

      {/* ===== شريطُ الأرقام: صفٌّ واحدٌ دائماً، فواصلُ لا بطاقات (D-682) ===== */}
      <div className="grid grid-cols-4">
        <StripCell icon="play" value={num(rangeEpisodes, locale)} label={t.statsCellEpisodesWatched} border="" />
        <StripCell icon="film" value={num(rangeMovies, locale)} label={t.statsCellMoviesWatched} border={`border-s ${divider}`} />
        <StripCell icon="bookmark" value={num(rangeTitles, locale)} label={t.statsCellTitles} border={`border-s ${divider}`} />
        <StripCell icon="star" value={rangeRatings ? rangeAvg.toFixed(1) : "—"} label={t.statsCellRating} border={`border-s ${divider}`} />
      </div>

      {/* ===== ثلاثيةُ الذوق: أنمي · مسلسل · فيلم — بلا وسمِ نوعٍ ولا رقم (D-682) ===== */}
      {trio && trio.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-22 font-bold mb-3">
            <Icon name="trio" size={22} className="text-accent" />
            {t.statsTasteTrio}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {trio.slice(0, 3).map((x) => {
              const url = posterUrl(x.posterPath, "w342");
              return (
                <Link
                  key={x.key}
                  href={x.href}
                  prefetch={false}
                  className="relative block aspect-[2/3] rounded-2xl overflow-hidden bg-surface-2"
                >
                  {url ? (
                    <Image src={url} alt="" fill sizes="(max-width: 640px) 33vw, 200px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted">
                      <Icon name="film" size={18} />
                    </span>
                  )}
                  {/* **الاسمُ فوق تدرّجٍ أسودَ خفيف** — أسودُ حرفيٌّ عمداً:
                      فوق ملصقٍ لا فوق سطحِ ثيم، فلا يتقلّب مع `daylight` */}
                  <span className="absolute inset-x-0 bottom-0 pt-10 pb-2 px-2 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                    <span className="block text-center text-14 font-semibold text-white truncate" dir="auto">
                      {x.title}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== بطاقتا الذوق والتقدّم — متجاورتان، وتتراصّان تحت 360px (D-682) ===== */}
      {(topGenres.length > 0 || statusTotal > 0) && (
        <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-3">
          {topGenres.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-20 font-bold mb-3">
                {mine ? t.analysisTaste : t.analysisTasteOther}
              </h3>
              <div className="space-y-3">
                {topGenres.map((g) => (
                  <div key={g.name} className="flex items-center gap-2">
                    <span className="flex-1 min-w-0">
                      <span className="block text-14 truncate mb-1" dir="auto">
                        {g.name}
                      </span>
                      {/* **أشرطةٌ صفراءُ قصيرةٌ واضحة** (نصُّ المواصفة) — لا قرصَ ولا DNA */}
                      <span className="block h-2 rounded-full bg-surface-2 overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${Math.max(pct(g.count, genreTags), 3)}%` }}
                        />
                      </span>
                    </span>
                    <span className="shrink-0 text-12 font-medium text-muted tabular-nums w-8 text-end">
                      {pct(g.count, genreTags)}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {statusTotal > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-20 font-bold mb-3">{t.statsLibraryProgress}</h3>
              <div className="flex flex-col items-center gap-3">
                <ProgressDonut done={done} watching={inProgress} rest={notStarted} pct={donePct} />
                <div className="w-full space-y-2">
                  {[
                    { l: t.statusDone, v: done, c: "bg-[color:var(--success)]" },
                    { l: t.statusWatching, v: inProgress, c: "bg-accent" },
                    { l: t.statusNotStarted, v: notStarted, c: "bg-[color:var(--disabled)]" },
                  ].map((sg) => (
                    <div key={sg.l} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sg.c}`} aria-hidden />
                      <span className="flex-1 min-w-0 truncate text-14">{sg.l}</span>
                      <span className="shrink-0 text-12 text-muted tabular-nums">
                        {pct(sg.v, statusTotal)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ===== بطاقةُ التقييمات: نجمةٌ عاريةٌ ومتوسّطٌ كبيرٌ وتوزيعٌ لا يُطغى عليه (D-682) ===== */}
      {ratedTotal > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4 flex items-center gap-4">
          <div className="shrink-0">
            <Icon name="star" size={22} className="text-accent" aria-hidden />
            <span className="block text-[40px] font-bold leading-none tabular-nums mt-1.5" dir="ltr">
              {avgAll.toFixed(1)}
            </span>
            <span className="block text-14 mt-1">{t.statsAvgLabel}</span>
            <span className="block text-12 text-muted mt-0.5">
              {mine ? t.ratedCount(ratedTotal) : t.ratedCountOther(ratedTotal)}
            </span>
          </div>
          {buckets && bucketTotal > 0 && (
            <div className={`flex-1 min-w-0 flex items-end justify-around gap-1 border-s ${divider} ps-4`}>
              {buckets.map((n, i) => {
                const share = pct(n, bucketTotal);
                return (
                  <span key={i} className="flex flex-col items-center gap-1 min-w-0">
                    <span className="flex flex-col justify-end h-16 w-4 rounded-md bg-surface-2 overflow-hidden" aria-hidden>
                      <span
                        className="block w-full rounded-md bg-accent"
                        style={{ height: `${Math.max(share, n > 0 ? 6 : 0)}%` }}
                      />
                    </span>
                    <span className="text-10 leading-none text-accent tracking-tighter" aria-hidden>
                      {"★".repeat(i + 1)}
                    </span>
                    <span className="text-12 text-muted tabular-nums">{share}%</span>
                  </span>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
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

export function pickTasteTrio(
  cands: TrioCandidate[],
): { key: string; title: string; posterPath: string | null; href: string }[] {
  const order = ["anime", "series", "movie"] as const;
  const out: { key: string; title: string; posterPath: string | null; href: string }[] = [];
  for (const cat of order) {
    const best = cands
      .filter((c) => c.category === cat)
      .sort(
        (a, b) =>
          Number(b.completed) - Number(a.completed) ||
          (b.rating ?? -1) - (a.rating ?? -1) ||
          b.watched - a.watched,
      )[0];
    if (best) out.push({ key: best.key, title: best.title, posterPath: best.posterPath, href: best.href });
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
): { topGenres: { name: string; count: number }[]; genreTags: number } {
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
  return { topGenres, genreTags };
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

  const [follows, ratings, episodes, watchedMovies, movieProgress, history, profile, user] =
    await Promise.all([
      getFollows(),
      getMyRatings(),
      getAllWatchedEpisodes(),
      getWatchedMovies(),
      getAllMovieProgress(),
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
  const totalMinutes = epMinutes + movieMinutes;

  const tvFollows = follows.filter((f) => f.media_type === "tv");
  const movieFollows = follows.filter((f) => f.media_type === "movie");
  const startedMovieIds = new Set(movieProgress.map((m) => m.movie_tmdb_id));

  // ===== أين وصلت =====
  let done = 0;
  let inProgress = 0;
  let notStarted = 0;
  for (const f of tvFollows) {
    const w = watchedByShow.get(f.tmdb_id) ?? 0;
    const aired = f.aired_episodes ?? f.total_episodes ?? 0;
    if (isComplete(w, aired)) done++;
    else if (w > 0) inProgress++;
    else notStarted++;
  }
  for (const f of movieFollows) {
    if (watchedMovieIds.has(f.tmdb_id)) done++;
    else if (startedMovieIds.has(f.tmdb_id)) inProgress++;
    else notStarted++;
  }

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
  const rangeTitles = prefix
    ? new Set([
        ...rangeEpRows.map((e) => `tv-${e.show_tmdb_id}`),
        ...rangeMovieRows.map((h) => `mv-${h.tmdbId}`),
      ]).size
    : follows.length;

  const rangeRatings = prefix ? ratings.filter((r) => inRange(r.updated_at)) : ratings;
  const rangeAvg = rangeRatings.length
    ? rangeRatings.reduce((n, r) => n + r.rating, 0) / rangeRatings.length
    : 0;

  // ===== ملخّص السنة — سطرٌ واحد تحت الأرقام =====
  const yearRows = episodes.filter((e) => e.watched_at.startsWith(String(nowY)));
  const yearMinutes =
    yearRows.reduce((n, e) => n + (e.runtime ?? 40), 0) +
    movieHistory
      .filter((h) => h.watchedAt.startsWith(String(nowY)))
      .reduce((n, h) => n + (h.runtime ?? 110), 0);

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
  const { topGenres, genreTags } = tallyGenres(
    follows.map((f) => f.genres ?? fetchedIds.get(`${f.media_type}-${f.tmdb_id}`) ?? null),
    locale,
  );

  // ===== الأكثر مشاهدة: ثلاثةٌ بملصقاتها =====
  const showById = new Map(tvFollows.map((f) => [f.tmdb_id, f]));
  const topWatched = [...watchedByShow.entries()]
    .filter(([id, n]) => n > 0 && showById.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => {
      const f = showById.get(id)!;
      return { id, title: f.title, posterPath: f.poster_path, watched: n };
    });

  const ratedTotal = ratings.length;
  const avgAll = ratedTotal ? ratings.reduce((n, r) => n + r.rating, 0) / ratedTotal : 0;

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

  /* **خمسُ سلالٍ للتقييم** — `ceil(r/2)` تضع ١–٢ في الأولى و٩–١٠ في الأخيرة */
  const buckets = [0, 0, 0, 0, 0];
  for (const r of ratings) {
    buckets[Math.min(4, Math.max(0, Math.ceil(r.rating / 2) - 1))]++;
  }

  return (
    <AnalysisView
      locale={locale}
      data={{
        minutes: rangeMinutes,
        share: range === "all" ? 1 : totalMinutes > 0 ? rangeMinutes / totalMinutes : 0,
        episodes: rangeEpisodes,
        movies: rangeMovies,
        titles: rangeTitles,
        ratings: rangeRatings.length,
        avgRating: rangeAvg,
        year: {
          year: nowY,
          episodes: yearRows.length,
          movies: movieHistory.filter((h) => h.watchedAt.startsWith(String(nowY))).length,
          minutes: yearMinutes,
        },
        topWatched,
        topGenres,
        genreTags,
        status: { done, inProgress, notStarted },
        ratedTotal,
        avgAll,
        mine: true,
        hero,
        trio: pickTasteTrio(trioCands),
        buckets,
      }}
    />
  );
}

/** هيكل عظمي بنفس ارتفاع التحليل تقريباً حتى لا تقفز الصفحة عند وصوله */
export function LibraryAnalysisSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* البطاقةُ السينمائيّة */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface-2 shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-36 rounded bg-surface-2" />
            <div className="h-3 w-24 rounded bg-surface-2" />
          </div>
        </div>
        <div className="h-12 w-52 rounded bg-surface-2 mt-5" />
        <div className="h-3 w-28 rounded bg-surface-2 mt-3" />
      </div>
      {/* شريطُ الأرقام */}
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded bg-surface-2" />
        ))}
      </div>
      {/* الثلاثية */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-[2/3] rounded-2xl bg-surface-2" />
        ))}
      </div>
      {/* الذوقُ والتقدّم */}
      <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-3">
        <div className="h-52 rounded-2xl bg-surface-2" />
        <div className="h-52 rounded-2xl bg-surface-2" />
      </div>
      {/* التقييمات */}
      <div className="h-32 rounded-2xl bg-surface-2" />
    </div>
  );
}
