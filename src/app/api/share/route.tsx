import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { isFounder, isPartner, isPlus, isVerified } from "@/lib/plan";
import {
  getUser,
  getProfile,
  getFollows,
  getFollowStats,
  getWatchSummary,
  getAllWatchedEpisodes,
  getWatchedMovies,
  watchedMovieMinutes,
  getMyRatings,
  getProfileFavorites,
  getMyAnimeFlags,
  getTitleMetaFor,
} from "@/lib/data";
/* 🆕 **حسابُ الذوق يُستورد لا يُنسخ** (D-720/القاعدة ٦): `buildTaste`
   و`tallyGenres` دالّتان خالصتان تغذّيان صفحةَ الإحصائيات — **وبطاقةٌ
   تحسب ذوقاً بقاعدةٍ ثانيةٍ تفترق عن الصفحة عند أوّل تعديل** (D-145).
   ⬜ **ودَينٌ يُقال**: بيتُهما `lib` لا ملفُّ مكوّن — **يُنقلان يومَ
   يوجد قارئٌ ثالث** (D-002)، ولا نُوسّع هذا الشحنَ بنقلةٍ لا تُطلب. */
import { buildTaste, tallyGenres } from "@/components/LibraryAnalysis";
import { posterUrl } from "@/lib/media";
import { favoriteTrio, trioPosterPaths } from "@/lib/heroPosters";
import {
  ShareCard,
  ReportShareCard,
  type ShareStripCell,
  type ShareTasteCell,
} from "@/lib/shareCard";
import { getT } from "@/lib/locale";
import { num, worksParts, type Dict, type Locale } from "@/lib/i18n";
/* 🆕 **بطاقةُ «شارك تقريرك»** (D-810) — **الرقمُ والجملةُ من المحرّك
   نفسِه الذي ترسمه الصفحة** (D-797: لا سطحان يقولان عن المدّة رقمين). */
import { asStatsPeriod, buildPeriodStats, statsRange } from "@/lib/periodStats";
import { hm, reportLead } from "@/lib/statsFormat";
import { asTimeZone } from "@/lib/zone";

export const runtime = "nodejs";

/**
 * بطاقة المشاركة.
 *
 * صورة ١٢٠٠×٦٣٠ تُولَّد على الخادم: المستخدم يشاركها في تويتر أو واتساب
 * فتظهر أرقامه صورةً لا رابطاً يحتاج تسجيل دخول ليُفتح. والخطّ يُقرأ من
 * `public/` لا من الشبكة — التوليد لا يتعطّل لو تعذّر الوصول لخادم خطوط،
 * والعربية تُرسم فعلاً بدل مربّعات فارغة.
 *
 * ⚖️ 🆕 **والوجهُ صار وجهَ الصفحة كاملاً** (D-715، حكمُه: «بطاقة
 * المشاركة حدّثها بالكامل لتتناسب مع الإحصائيات الحالية واجعل لها
 * خلفية») — **والرسمُ خرج إلى `lib/shareCard`** ليُجرَّب محلّيّاً قبل
 * النشر (انظر رأسَه: satori تكذب في وقت البناء).
 *
 * **وهذا الملفُّ صار جمعَ بياناتٍ لا رسماً.**
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { t, locale } = await getT();
  const rtl = locale === "ar";

  /* 🆕 **وبابان في مسارٍ واحد** (D-810): **بطاقةُ «كلِّ الأوقات» هي
     الافتراضُ ولم تُمسّ**، **و`kind=report` بطاقةُ مدّةٍ بعينها.**
     ⚖️ **ولمَ مسارٌ واحدٌ لا مساران**: **الخطوطُ و`dataUrl` وحارسُ
     الجلسة واحدةٌ لهما** — **ومسارٌ ثانٍ ينسخها ثمّ يفترق عند أوّل
     إصلاحٍ في أحدهما** (D-145). **والرسمان مفترقان في `shareCard`
     حيث يفترق المعنى فعلاً.** */
  const q = new URL(request.url).searchParams;
  if (q.get("kind") === "report") {
    return reportImage(q.get("p"), locale, rtl, t);
  }

  const [profile, follows, followStats, summary, episodes, watchedMovies, ratings, favs, animeFlags] =
    await Promise.all([
      getProfile(),
      getFollows(),
      getFollowStats(user.id).catch(() => null),
      getWatchSummary(),
      getAllWatchedEpisodes(),
      getWatchedMovies(),
      getMyRatings(),
      getProfileFavorites(user.id).catch(() => []),
      getMyAnimeFlags().catch(() => new Map<string, boolean>()),
    ]);

  /* 🆕 **بطاقاتُ هويّة الأعمال** (D-720) — نداءٌ واحدٌ مجمَّعٌ يغذّي
     «ذوقك» كلَّها، **بلا نداء TMDB وقتَ الرسم** (درسُ D-649). */
  const metas = await getTitleMetaFor(
    follows.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id })),
  ).catch(() => new Map());

  const movies = watchedMovies.length;
  const episodeCount = episodes.length;

  // دقائق الحلقات من الملخّص إن وُجد وإلا من زمن كل حلقة (افتراضي ٤٥)، ثم
  // **نضيف دقائق الأفلام الفعلية** — كانت البطاقة تُسقط الأفلام من الوقت
  const episodeMinutes =
    summary?.reduce((a, r) => a + (r.minutes ?? 0), 0) ??
    episodes.reduce((a, e) => a + (e.runtime ?? 45), 0);
  const minutes = episodeMinutes + watchedMovieMinutes(watchedMovies);
  const hours = Math.round(minutes / 60);
  const days = Math.floor(hours / 24);

  const [arabic, latin] = await Promise.all([
    /* 🔴 🆕 **والخطُّ العربيُّ صار Tajawal لا Cairo** (D-720) — **عطلٌ
       في satori لا في الخطّ**: `Cairo` تنهار على تسلسلٍ عربيٍّ بعينه
       (شين ثمّ نون في آخر الكلمة: «أكشن») بـ`codePointAt` على
       `undefined` — **وهو أوّلُ نوعٍ في مكتبة أحمد**، فكانت البطاقةُ
       ستسقط بـ500 لحظةَ شحنها. 📏 **وقِيس محلّيّاً على أربعة خطوط**:
       Cairo تسقط · Noto Sans Arabic تسقط في كلِّ كلمة · **IBM Plex
       Sans Arabic وTajawal تنجحان** — واختير Tajawal لأنه هندسيٌّ
       يقارب Cairo. ⚠️ **والتطبيقُ نفسُه يبقى على Cairo**: العطلُ في
       مولّد الصور وحدَه، **ولا يُغيَّر خطُّ منتجٍ كامل لعلّةِ سطحٍ واحد.** */
    readFile(join(process.cwd(), "public/fonts/tajawal-700-arabic.woff")),
    readFile(join(process.cwd(), "public/fonts/cairo-700-latin.woff")),
  ]);

  const name = profile?.nickname?.trim() || profile?.username || "Loopz";
  /* 🔴 **الوقتُ الكبيرُ أرقامٌ كبيرةٌ ووحداتٌ صغيرة، مركَّباً يدويّاً**:
     satori يقيس الكلمةَ العربيّة بأشكال حروفها المنفصلة ويرسمها
     موصولةً — ففي «يوم» بحجم ٨٠ فراغٌ داخليٌّ فاضح (قِيس بصناديق
     ملوّنة). الوحدةُ تُشتقّ من مفاتيح القاموس نفسِها (بلا مفتاحٍ
     جديد)، وصِغَرُها يبتلع الخطأ. */
  const dayUnit = t.days(9).replace(/[0-9٠-٩,\s]/g, "");
  const hourUnit = t.hours(9).replace(/[0-9٠-٩,\s]/g, "");
  /* ⚖️ D-709: **الأيّامُ وحدَها** — والبطاقةُ تتبع الصفحةَ (D-697):
     **رقمان لشيءٍ واحدٍ بوجهين يفترقان.** */
  const timeParts: { v: string; u: string }[] =
    days >= 1
      ? [{ v: String(days), u: dayUnit }]
      : [{ v: String(hours), u: hourUnit }];
  if (rtl) timeParts.reverse();

  /* D-698: خاناتُ أحمد الأربع — كما في صفحة الإحصائيات حرفاً */
  const shows = follows.filter((f) => f.media_type === "tv").length;
  /* ⚖️ 🆕 **والخانةُ الرابعةُ تعدّ كلَّ تقييم** (D-715 — لحاقٌ بـD-708):
     **كانت تعدّ ذواتِ النصِّ وحدَها والصفحةُ تعدّ الكلَّ** — **ورقمان
     بقاعدتين تحت اسمٍ واحدٍ أخطرُ من رقمٍ خاطئ**، لأن كليهما صحيحٌ في
     موضعه فلا يكشفهما إلّا من نظر إلى الاثنين معاً. */
  const reviewCount = ratings.length;
  const strip: ShareStripCell[] = [
    { icon: "tv", value: String(shows), label: t.statsCellShows },
    { icon: "film", value: String(movies), label: t.statsCellMoviesWatched },
    { icon: "play", value: episodeCount.toLocaleString("en-US"), label: t.statsCellEpisodesWatched },
    { icon: "comment", value: String(reviewCount), label: t.statsCellComments },
  ];

  /* 🆕 **الخلفيّةُ والوجهُ الشخصيُّ يُجلبان هنا لا داخل satori** (D-715):
     **المحرّكُ يجلب الروابطَ بنفسِه، وفشلُ جلبٍ واحدٍ يُسقط الصورةَ
     كلَّها بـ500** (عقيدةُ D-697) — **فنجلبُها نحن ونبتلع فشلَها**:
     ما وصل يُرسم، وما لم يصل يُترك، **والبطاقةُ تخرج في الحالين.** */
  const posterPaths = trioPosterPaths(
    favoriteTrio(favs, (f) => animeFlags.get(`${f.media_type}-${f.tmdb_id}`) === true),
  );
  const [posters, avatar] = await Promise.all([
    Promise.all(posterPaths.map((p) => dataUrl(posterUrl(p, "w342")))).then((a) =>
      a.filter((x): x is string => !!x),
    ),
    dataUrl(profile?.avatar_url ?? null),
  ]);

  /* ===== 🆕 «ذوقك» — بالحساب نفسِه الذي ترسمه الصفحة (D-720) ===== */
  const { topGenres, genreTags, bySlug } = tallyGenres(
    follows.map((f) => f.genres ?? null),
    locale,
  );
  const taste = buildTaste({
    keys: follows.map((f) => ({
      media_type: f.media_type,
      tmdb_id: f.tmdb_id,
      poster: f.poster_path,
      genreIds: f.genres ?? null,
    })),
    metas,
    bySlug,
    genreTags,
    topGenres,
    t,
    locale,
  });

  /* **وصورُ الخانات تُجلب هنا كذلك** (عقيدةُ `dataUrl` أعلاه): ستُّ
     خاناتٍ × ثلاث صور — **وما لم يصل يُترك، فتخرج الخانةُ بلا خلفيّةٍ
     لا بلا بطاقة.** ⚠️ **والثمنُ يُقال**: نحوُ ٢٢ صورةً في التوليدة
     الواحدة، **والتوليدةُ تقع بضغطة مشاركةٍ لا في كلِّ فتحة.** */
  const cellDefs: { title: string; note?: string; rows: { name: string; value: string; unit?: string }[]; paths: string[] }[] =
    taste
      ? [
          {
            title: t.tasteGenres,
            rows: taste.genres.map((g) => ({ name: g.name, value: `${g.pct}%` })),
            paths: taste.posters.genres,
          },
          {
            title: t.tasteYears,
            rows: taste.decades.map((x) => ({ name: x.label, value: `${x.pct}%` })),
            paths: taste.posters.decades,
          },
          {
            title: t.tasteLanguages,
            rows: taste.languages.map((x) => ({
              name: x.name,
              ...worksParts(x.titles, t, locale),
            })),
            paths: taste.posters.languages,
          },
          {
            title: t.tasteDiversity,
            rows: taste.countries.map((x) => ({
              name: x.name,
              ...worksParts(x.titles, t, locale),
            })),
            paths: taste.posters.countries,
          },
          {
            title: t.tasteDirectors,
            rows: taste.directors.map((x) => ({
              name: x.name,
              ...worksParts(x.titles, t, locale),
            })),
            paths: taste.posters.directors,
          },
          {
            title: t.tasteActors,
            rows: taste.actors.map((x) => ({
              name: x.name,
              ...worksParts(x.titles, t, locale),
            })),
            paths: taste.posters.actors,
          },
        ].filter((c) => c.rows.length > 0)
      : [];

  const tasteCells: ShareTasteCell[] = await Promise.all(
    cellDefs.map(async (c) => ({
      title: c.title,
      ...(c.note ? { note: c.note } : {}),
      rows: c.rows,
      images: (await Promise.all(c.paths.map((u) => dataUrl(u)))).filter(
        (x): x is string => !!x,
      ),
    })),
  );

  /* 🆕 **النبذةُ سطرٌ واحدٌ مقصوص** (D-715): **الصفحةُ تقصّها بسطرين
     (`line-clamp`) ولا `line-clamp` في satori** — **وقصٌّ بالحروف
     يقارب قصَّ الصفحة ولا يدّعي مطابقتَه.** */
  const bio = (profile?.bio ?? "").trim();

  return new ImageResponse(
    (
      <ShareCard
        rtl={rtl}
        name={name}
        followers={
          followStats ? t.suggestFollowers(followStats.followers) : null
        }
        bio={bio ? clip(bio, 64) : null}
        timeParts={timeParts}
        /* 🆕 **والمدى يُقال كما تقوله الصفحة** (D-700) — والبطاقةُ دائماً
           «كلُّ الأوقات»، **فتُكتب ولا تُفترض.** */
        watchLine={`${t.statWatchTime} · ${t.statsAllTime}`}
        headline={t.shareHeadline}
        strip={strip}
        posters={posters}
        avatar={avatar}
        /* 🆕 **وهويّتُه تخرج معه** (D-792): **القرصُ والختمُ من الحكم
           الواحد في `plan.ts`** (D-145) — **ومجّانيٌّ غيرُ موثَّقٍ لا
           يحمل شيئاً**، وهو الصدق. */
        tier={isPartner(profile) ? "partner" : isPlus(profile) ? "plus" : null}
        founder={isFounder(profile)}
        verified={isVerified(profile)}
        tasteTitle={taste ? t.analysisTaste : null}
        themesLabel={t.tasteThemes}
        themes={taste?.themes ?? []}
        tasteCells={tasteCells}
      />
    ),
    {
      /* ⚖️ 🆕 **قياسٌ طوليٌّ لا عرضيّ** (D-720): **الصفحةُ عمودٌ
         والعرضيُّ لا يحمل عموداً** — و`ShareCard` تشارك ملفَّ صورةٍ
         عبر واجهة النظام لا رابطاً بمعاينة، **فالنسبةُ حرّة**
         (و`og:image` لها مسارُها الخاصّ بنسبتها القديمة).
         📏 **و١٦٢٠ لا ١٩٢٠**: قِيس على الرسم المحلّيّ أن المحتوى ينتهي
         عند ~١٥٨٠، **وذيلٌ أسودُ ثلثُ الصورة يُقرأ صورةً مقصوصةً خطأً.** */
      width: 1080,
      height: 1800,
      fonts: [
        // عائلتان لا واحدة: المحرّك يختار خطاً واحداً لكل اسم عائلة، فلو
        // سمّيناهما باسم واحد ضاعت الأرقام والحروف اللاتينية مربّعاتٍ فارغة
        { name: "Cairo", data: arabic, weight: 700, style: "normal" }, // Tajawal تحت الاسم نفسِه — القارئُ في `shareCard` واحد
        { name: "CairoLatin", data: latin, weight: 700, style: "normal" },
      ],
      headers: {
        // الصورة تتغيّر مع كل حلقة يؤشّرها صاحبها، فلا تُخزَّن على الحافة
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    },
  );
}

/** **صورةٌ بعيدةٌ تصير `data:`** — أو `null` إن تعذّرت، بلا رمي */
async function dataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    /* ⚠️ **وسقفُ الحجم حارسٌ لا زينة**: `data:` تدخل في ذاكرة الرسم،
       وثلاثُ صورٍ ضخمةٍ تُوقف التوليد بلا رسالةٍ مفهومة. */
    if (buf.byteLength > 900_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}


/** قصٌّ بالحروف مع نقاطٍ — أقربُ ما يُشبه `line-clamp` في صورة */
function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}


/* ================= 🆕 بطاقةُ «شارك تقريرك» (D-810) ================= */

/**
 * **صورةُ مدّةٍ بعينها** — «تقريرك · أغسطس ٢٠٢٦».
 *
 * 🔒 **والقفلُ هنا لا في الزرِّ وحدَه**: **زرُّ المشاركة لا يُرسم لغير
 * المشترك** (D-809)، **لكنّ رابطاً يُكتب باليد يتخطّى زرّاً غائباً** —
 * **وبابٌ حارسُه في الواجهة ليس بباب.** ⚖️ **وهذا يسدّ ثغرةً أوسعَ من
 * ثغرةِ المعاينة المُعلَنة في D-809**: تلك قيمٌ في DOM صفحته،
 * **وهذه صورةٌ كاملةٌ تُولَّد وتُشارَك.**
 *
 * ⚖️ **ولا رقمَ يُحسب هنا**: `buildPeriodStats` هي المحرّك — **الصفحةُ
 * والصورةُ يقرآن الدالّةَ نفسَها بالمنطقة الزمنيّة نفسِها** (D-806)،
 * **فلا تقول صورةٌ عن أغسطس ما لا تقوله صفحتُه** (D-797).
 *
 * ⚠️ **وحدُّ الجلب ثلاثةُ ملصقاتٍ ووجهٌ واحد** — **أربعُ صورٍ لا اثنتان
 * وعشرون** (بطاقةُ الإحصائيات)، **والتوليدةُ تقع بضغطةِ مشاركةٍ لا في
 * كلِّ فتحة.**
 */
async function reportImage(rawPeriod: string | null, locale: Locale, rtl: boolean, t: Dict) {
  const profile = await getProfile();
  if (!isPlus(profile)) return new Response("plus required", { status: 403 });

  const period = rawPeriod ? asStatsPeriod(rawPeriod) : "month";
  const tz = asTimeZone(profile?.timezone);
  const stats = await buildPeriodStats(period, 0, locale, tz);
  /* **ولا صورةَ لمدّةٍ فارغة** — **بطاقةٌ تقول صفراً تُشارَك مرّةً
     واحدةً ثمّ لا تُشارَك** (D-063: الغيابُ يُقال غياباً، ولا يُزيَّن). */
  if (stats.empty) return new Response("nothing to share", { status: 409 });

  const [arabic, latin] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/tajawal-700-arabic.woff")),
    readFile(join(process.cwd(), "public/fonts/cairo-700-latin.woff")),
  ]);

  const top = stats.topTitles.slice(0, 3);
  const [posters, avatar] = await Promise.all([
    Promise.all(top.map((x) => dataUrl(posterUrl(x.poster, "w342")))),
    dataUrl(profile?.avatar_url ?? null),
  ]);

  const strip: ShareStripCell[] = [
    /* **الخاناتُ الثلاثُ هي خاناتُ الصفحة حرفاً** (`ReportView`) —
       **ورابعةٌ تُخترع للصورة تجعلها سطحاً آخر** (درسُ D-720). */
    { icon: "play", value: num(stats.episodes, locale), label: rtl ? "حلقة" : "Episodes" },
    { icon: "film", value: num(stats.movies, locale), label: rtl ? "فيلم" : "Movies" },
    { icon: "check", value: num(stats.streak, locale), label: rtl ? "أيام متتالية" : "Day streak" },
  ];

  const lead = reportLead(stats, locale);

  return new ImageResponse(
    (
      <ReportShareCard
        rtl={rtl}
        title={rtl ? "تقريرك" : "Your Report"}
        range={statsRange(period, 0, locale, tz).label}
        name={profile?.nickname?.trim() || profile?.username || "Loopz"}
        avatar={avatar}
        tier={isPartner(profile) ? "partner" : "plus"}
        founder={isFounder(profile)}
        verified={isVerified(profile)}
        time={hm(stats.minutes, locale)}
        watchLine={t.statWatchTime}
        /* **والفرقُ يُرسم إن صدق وحدَه** — حارسُ D-805 في `periodStats` */
        delta={
          stats.deltaPct === null
            ? null
            : `${stats.deltaPct >= 0 ? "+" : ""}${num(stats.deltaPct, locale)}%`
        }
        deltaUp={(stats.deltaPct ?? 0) >= 0}
        lead={lead ? { avg: lead.avg, plain: lead.plain } : null}
        daysActive={stats.activeDays}
        daysTotal={stats.range.days}
        daysLabel={rtl ? "أيّام" : "days"}
        strip={strip}
        topLabel={top.length > 0 ? (rtl ? "الأكثر مشاهدة" : "Most watched") : null}
        top={top.map((x, i) => ({
          /* 🔴 **والاسمُ يُقصّ عند مصدره** (D-810، من الرسم المحلّيّ):
             **عنوانٌ طويلٌ يفيض عن عموده إلى جاره** — **و`line-clamp`
             لا وجودَ لها في satori**، **والالتفافُ في صفٍّ معكوسٍ ينزل
             إلى غير موضعه.** **فالقصُّ هنا حيث تُعرف اللغةُ والمقاس.** */
          title: clip(x.title, 18),
          time: hm(x.minutes, locale),
          poster: posters[i] ?? null,
        }))}
      />
    ),
    {
      /* 📏 **١٧٠٠ مقيسةٌ لا مخمَّنة**: **أطولُ الحالات الإنجليزيّة
         ١٥٠٧px محتوىً + ١١٢ حشوةً = ١٦١٩** — **والعربيّةُ أقصرُ فتتوسّط**
         (`justify-content: center`)، **وذيلٌ أسودُ يُقرأ صورةً مقصوصة.** */
      width: 1080,
      height: 1700,
      fonts: [
        { name: "Cairo", data: arabic, weight: 700, style: "normal" },
        { name: "CairoLatin", data: latin, weight: 700, style: "normal" },
      ],
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    },
  );
}
