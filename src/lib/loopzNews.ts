import { createClient } from "@/lib/supabase/server";

/**
 * **أخبارُنا نحن** (D-211) — الخبرُ تغيّرٌ نرصده، لا مقالٌ نأخذه.
 *
 * **طلبُ أحمد:** «هل بالإمكان بناء أخبارنا الخاصة؟ بحيث الشخص يقرأها
 * وهي مكتوبةٌ بموقعنا ويعلّق عليها داخل موقعنا؟» — **والجوابُ نعم، لأن
 * المادّةَ عندنا أصلاً**: نحفظ لقطةً لكل عملٍ نراقبه، وحين يتبدّل حقلٌ
 * فيها يولد خبرٌ **لم يكتبه أحدٌ قبلنا**. لا رابطَ خارجيّ، ولا مصدرَ
 * يُخفى، ولا حقوقَ أحد.
 *
 * **وما يُخزَّن حقائقُ لا جُمَل** (`kind` + `data`): الجملةُ تُركَّب عند
 * العرض من قوالب `i18n`، **فالخبرُ بلغتين معاً بلا عمودٍ ثانٍ**، ومن
 * بدّل لغته قرأ الخبرَ نفسَه بلغته الجديدة.
 *
 * **والحارسُ الأوّل ضدّ الضجيج هو قلّةُ الحقول المرصودة:** خمسةٌ لا
 * أكثر. TMDB تسجّل تغييرَ صورةٍ تغييراً، **ولو رصدنا كلَّ شيءٍ لصارت
 * الصفحةُ سجلَّ تعديلاتٍ لا أخباراً.**
 */

/**
 * **بلاغُ أحمد (D-212):** «كلّها موعد نزول الحلقة القادمة، وهو أصلاً في
 * Upcoming… أبغى أخبار أثقل». **فحُذف `episode` من الوجود**، وأُضيفت
 * ثلاثةٌ ثقيلة: انطلاقُ موسمٍ · التاريخُ الرسميّ في الصالات · صدورٌ فعليّ.
 *
 * **والقاعدةُ المستخلصة:** الخبرُ ما **لا يعرفه المستخدم من مكانٍ آخر في
 * التطبيق** — لا ما يسهل رصدُه.
 */
export type NewsKind =
  | "trailer"
  | "date"
  | "season"
  | "status"
  | "season_date"
  | "theatrical"
  | "released"
  | "chart"
  | "provider"
  | "report";

export interface Snapshot {
  tmdb_id: number;
  media_type: "tv" | "movie";
  status: string | null;
  release_date: string | null;
  next_air_date: string | null;
  seasons: number | null;
  trailer_key: string | null;
  last_air_date: string | null;
  next_season_date: string | null;
  next_season_num: number | null;
  theatrical_date: string | null;
  /** رتبةُ العمل في قائمتنا — **من جدولنا لا من TMDB**: خبرٌ بصفر نداءات */
  chart_rank: number | null;
  /** معرّفاتُ منصّات الاشتراك في السعودية، مرتّبةً ومفصولةً بفاصلة */
  providers: string | null;
}

/** «اليوم» بصيغة `YYYY-MM-DD` — والمقارنةُ نصّيةٌ لأن الصيغة مرتَّبة معجمياً */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** يومٌ بعد اليوم بعددٍ من الأيام — لسقفِ «قريبٌ بما يكفي ليكون خبراً» */
function inDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

export interface GeneratedPost {
  key: string;
  kind: NewsKind;
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  data: Record<string, string | number>;
}

/** تاريخٌ نظيف: `YYYY-MM-DD` أو لا شيء — وما جاء مشوّهاً يُهمَل لا يُخمَّن */
function day(v: unknown): string | null {
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * قراءةُ عملٍ واحد من TMDB — تفاصيلُه ومقطعُه.
 *
 * **نداءان لا أكثر لكل عمل**، والمقطعُ ثانيهما لأنه الحقلُ الوحيد الذي
 * لا تحمله التفاصيل. وستّةٌ وعشرون عملاً في الدفعة = **٥٢ نداءً**، وهو
 * ما تحتمله الحصّة براحة.
 */
async function readTitle(
  tmdbId: number,
  mediaType: "tv" | "movie",
  chartRank: number | null,
): Promise<{ snap: Snapshot; title: string; poster: string | null } | null> {
  try {
    const { getTv, getMovie, getTrailer, movieTheatricalDate, getWatchProviders } = await import(
      "@/lib/tmdb"
    );
    /* **منصّاتُ السعودية وحدها**: الخبرُ يقول «صار متاحاً في السعودية»،
       وسلسلةُ جيرانٍ تجعل الجملةَ تكذب على من يقرؤها هنا. والاشتراكُ
       (`flatrate`) لا الشراء: «صار على نتفليكس» خبر، و«صار للشراء بـ٤٩
       ريالاً» ليس كذلك. */
    const prov = await getWatchProviders(mediaType, tmdbId, ["SA"]).catch(() => null);
    const providers =
      (prov?.options.flatrate ?? [])
        .map((x) => x.provider_id)
        .sort((a, b) => a - b)
        .join(",") || null;
    if (mediaType === "tv") {
      const tv = await getTv(tmdbId);
      const trailer = await getTrailer("tv", tmdbId).catch(() => null);
      /* **موسمٌ قادم له موعد**: أبعدُ موسمٍ تاريخُ انطلاقه في المستقبل —
         وهو خبرُ «الإعلان عن الموسم الثاني» الذي طلبه أحمد بالاسم */
      const upcoming = (tv.seasons ?? [])
        .filter((se) => se.season_number > 0 && day(se.air_date) && day(se.air_date)! > today())
        .sort((a, b) => (a.air_date ?? "").localeCompare(b.air_date ?? ""))[0];
      return {
        title: tv.name,
        poster: tv.poster_path ?? null,
        snap: {
          tmdb_id: tmdbId,
          media_type: "tv",
          status: tv.status ?? null,
          release_date: day(tv.first_air_date),
          next_air_date: day(tv.next_episode_to_air?.air_date),
          seasons: tv.number_of_seasons ?? null,
          trailer_key: trailer?.key ?? null,
          last_air_date: day(tv.last_air_date),
          next_season_date: upcoming ? day(upcoming.air_date) : null,
          next_season_num: upcoming ? upcoming.season_number : null,
          theatrical_date: null,
          chart_rank: chartRank,
          providers,
        },
      };
    }
    const mv = await getMovie(tmdbId);
    const trailer = await getTrailer("movie", tmdbId).catch(() => null);
    /* **والنداءُ الثالث لمن لم يصدر بعدُ وحده**: تاريخُ الصالات لا يتغيّر
       لفيلمٍ عُرض قبل سنة، ودفعُ نداءٍ عنه هدرٌ صافٍ */
    const notOut = (mv.status ?? "") !== "Released" || (day(mv.release_date) ?? "") > today();
    const theatrical = notOut ? await movieTheatricalDate(tmdbId).catch(() => null) : null;
    return {
      title: mv.title,
      poster: mv.poster_path ?? null,
      snap: {
        tmdb_id: tmdbId,
        media_type: "movie",
        status: mv.status ?? null,
        release_date: day(mv.release_date),
        next_air_date: null,
        seasons: null,
        trailer_key: trailer?.key ?? null,
        last_air_date: null,
        next_season_date: null,
        next_season_num: null,
        theatrical_date: theatrical,
        chart_rank: chartRank,
        providers,
      },
    };
  } catch {
    /* عملٌ واحد سقط لا يُسقط الدفعة */
    return null;
  }
}

/**
 * **الفرقُ بين لقطتين هو الخبر.**
 *
 * ⚠️ **ولا خبرَ من لقطةٍ أولى:** العملُ الذي نراه أوّلَ مرّة كلُّ حقولِه
 * «جديدة»، **فلو ولّدنا منها لأغرقنا الصفحةَ بخمسمئة خبرٍ يوم التشغيل**.
 * الأوّلُ يُحفظ صامتاً، والخبرُ يبدأ من الثاني.
 */
export function diffToPosts(
  before: Snapshot | null,
  after: Snapshot,
  title: string,
  poster: string | null,
): GeneratedPost[] {
  if (!before) return firstSightPosts(after, title, poster);
  const base = {
    tmdb_id: after.tmdb_id,
    media_type: after.media_type,
    title,
    poster_path: poster,
  };
  const id = `${after.media_type}:${after.tmdb_id}`;
  const out: GeneratedPost[] = [];

  /* ١) مقطعٌ دعائيّ جديد — أوضحُ خبرٍ وأكثرُه طلباً */
  if (after.trailer_key && after.trailer_key !== before.trailer_key) {
    out.push({
      ...base,
      kind: "trailer",
      key: `trailer:${id}:${after.trailer_key}`,
      data: { video: after.trailer_key },
    });
  }

  /* ٢) موعدُ الصدور: تحدَّد أو تبدّل. **والتاريخُ الذاهب إلى الماضي ليس
     خبراً** — TMDB تصحّح تواريخَ قديمة كثيراً، وتصحيحُ أرشيفٍ لا يهمّ
     أحداً. فالخبرُ لما هو آتٍ فقط. */
  /* **و`date` للأفلام وحدها** (D-212): «تحدّد موعد صدور» لمسلسلٍ يقولها
     `season_date` أصدقَ وأثقل — **ورأيتُ الخبرَ مكرّراً بصيغتين حيّاً**
     («General Anesthesia» مرّتين في اللقطة نفسها). */
  if (after.media_type === "movie" && after.release_date && after.release_date !== before.release_date) {
    const future = after.release_date >= today();
    if (future) {
      out.push({
        ...base,
        kind: "date",
        key: `date:${id}:${after.release_date}`,
        data: before.release_date
          ? { from: before.release_date, to: after.release_date }
          : { to: after.release_date },
      });
    }
  }

  /* ٣) موسمٌ جديد — الرقمُ يعلو ولا ينزل */
  if (
    after.media_type === "tv" &&
    typeof after.seasons === "number" &&
    typeof before.seasons === "number" &&
    after.seasons > before.seasons
  ) {
    out.push({
      ...base,
      kind: "season",
      key: `season:${id}:${after.seasons}`,
      data: { season: after.seasons },
    });
  }

  /* ٤) حالُ المسلسل: انتهى أو أُلغي أو عاد. **وثلاثُ حالاتٍ لا أكثر** —
     «In Production» و«Planned» تتقلّبان بلا معنى للقارئ. */
  const TOLD = new Set(["Ended", "Canceled", "Returning Series"]);
  if (
    after.media_type === "tv" &&
    after.status &&
    after.status !== before.status &&
    TOLD.has(after.status)
  ) {
    out.push({
      ...base,
      kind: "status",
      key: `status:${id}:${after.status}`,
      data: { status: after.status },
    });
  }

  /* ٥) **انطلاقُ موسمٍ قادم** — «الإعلان عن الموسم الثاني» بعينه.
     ويولد حين يظهر الموعدُ أوّلَ مرّة أو يتبدّل، **لا مع كل حلقة**. */
  if (
    after.media_type === "tv" &&
    after.next_season_date &&
    after.next_season_date !== before.next_season_date
  ) {
    out.push({
      ...base,
      kind: "season_date",
      key: `seasondate:${id}:${after.next_season_num ?? 0}:${after.next_season_date}`,
      data: { season: after.next_season_num ?? 0, date: after.next_season_date },
    });
  }

  /* ٦) **رسمياً في الصالات** — تاريخُ العرض السينمائيّ حين يتحدّد أو
     يتبدّل، وهو غيرُ `release_date` العامّ (قد يكون رقميّاً أو مهرجانياً) */
  if (
    after.media_type === "movie" &&
    after.theatrical_date &&
    after.theatrical_date !== before.theatrical_date &&
    after.theatrical_date >= today()
  ) {
    out.push({
      ...base,
      kind: "theatrical",
      key: `theatrical:${id}:${after.theatrical_date}`,
      data: { date: after.theatrical_date },
    });
  }

  /* ٧) **دخل قائمتنا** — أرخصُ خبرٍ نملكه: رتبةٌ من جدولنا بلا نداء.
     والحدُّ خمسون لأنه اسمُ الرفّ الذي يراه المستخدم («أفضل ٥٠»). */
  if (
    after.chart_rank !== null &&
    after.chart_rank <= 50 &&
    (before.chart_rank === null || before.chart_rank > 50)
  ) {
    out.push({
      ...base,
      kind: "chart",
      key: `chart:${id}:${after.chart_rank}`,
      data: { rank: after.chart_rank },
    });
  }

  /* ٨) **صار متاحاً على منصّة** — معرّفٌ جديد في قائمة الاشتراك.
     **ولا خبرَ من لقطةٍ فارغة**: من لم نكن نعرف منصّاتِه لا نقول إنها
     «صارت» — قد تكون هناك منذ سنة. */
  if (after.providers && before.providers !== null) {
    const had = new Set(before.providers.split(",").filter(Boolean));
    const fresh = after.providers.split(",").filter((x) => x && !had.has(x));
    if (fresh.length) {
      out.push({
        ...base,
        kind: "provider",
        key: `provider:${id}:${fresh[0]}`,
        data: { provider: Number(fresh[0]) || 0 },
      });
    }
  }

  /* ٩) **صدر فعلاً** — الحالةُ عبرت إلى `Released`. خبرٌ ينتظره من وضع
     الفيلم في قائمته منذ شهور. */
  if (
    after.media_type === "movie" &&
    after.status === "Released" &&
    before.status &&
    before.status !== "Released"
  ) {
    out.push({
      ...base,
      kind: "released",
      key: `released:${id}`,
      data: {},
    });
  }

  return out;
}

/**
 * **أوّلُ لقاءٍ بعملٍ لا يولّد «تغيّراً» — لكنه قد يحمل حقيقةً هي خبرٌ
 * بنفسها.**
 *
 * لو صمتنا عند اللقطة الأولى لبقيت الصفحةُ فارغةً حتى يتبدّل شيءٌ في
 * الدنيا — يوماً أو أسبوعاً. **والصمتُ ليس صدقاً أكثر:** «الحلقةُ
 * القادمة من س يوم الثلاثاء» جملةٌ صحيحةٌ اليوم سواءٌ عرفناها أمس أم لا.
 *
 * **فالمسموحُ في اللقاء الأوّل ما كان صحيحاً كحالةٍ لا كحدث:** موعدٌ
 * **قادم** لحلقةٍ (أسبوعان) أو لصدورٍ (شهران). **والمقطعُ الدعائيّ
 * ممنوع** — «نزل مقطعٌ جديد» عن مقطعٍ عمرُه سنة كذبة.
 */
function firstSightPosts(
  after: Snapshot,
  title: string,
  poster: string | null,
): GeneratedPost[] {
  const base = {
    tmdb_id: after.tmdb_id,
    media_type: after.media_type,
    title,
    poster_path: poster,
  };
  const id = `${after.media_type}:${after.tmdb_id}`;
  const out: GeneratedPost[] = [];
  const now = today();

  /* **موسمٌ قادم بموعدٍ معلن** — أثقلُ ما يمكن قولُه عن مسلسلٍ اليوم */
  if (
    after.media_type === "tv" &&
    after.next_season_date &&
    after.next_season_date > now &&
    after.next_season_date <= inDays(180)
  ) {
    out.push({
      ...base,
      kind: "season_date",
      key: `seasondate:${id}:${after.next_season_num ?? 0}:${after.next_season_date}`,
      data: { season: after.next_season_num ?? 0, date: after.next_season_date },
    });
  }

  /* **رسمياً في الصالات** */
  if (
    after.media_type === "movie" &&
    after.theatrical_date &&
    after.theatrical_date > now &&
    after.theatrical_date <= inDays(180)
  ) {
    out.push({
      ...base,
      kind: "theatrical",
      key: `theatrical:${id}:${after.theatrical_date}`,
      data: { date: after.theatrical_date },
    });
  }

  /* **مسلسلٌ انتهى أو أُلغي حديثاً** — و«حديثاً» شرطٌ لا زينة: «انتهى
     Friends» ليس خبراً، **و«انتهى قبل أسبوعين» خبرٌ لمن يتابعه.** */
  if (
    after.media_type === "tv" &&
    (after.status === "Ended" || after.status === "Canceled") &&
    after.last_air_date &&
    after.last_air_date >= inDays(-45) &&
    after.last_air_date <= now
  ) {
    out.push({
      ...base,
      kind: "status",
      key: `status:${id}:${after.status}`,
      data: { status: after.status },
    });
  }
  /* **ومسلسلٌ يعرض حلقاته الآن لا يُقال فيه «تحدّد موعد صدوره».**
     `first_air_date` لمسلسلٍ جارٍ هو تاريخُ حلقةٍ قادمة أحياناً، فيظهر
     الخبرُ مرّتين بصيغتين — رأيتُه حيّاً في «General Anesthesia».
     **فسطرُ الحلقة أولى، وسطرُ الصدور للأفلام ولمسلسلٍ لم يبدأ.** */
  /* **ولا يُقال «تحدّد موعدُ صدوره» لفيلمٍ قيل فيه «رسمياً في الصالات»** —
     خبرٌ واحد بصيغتين هو العيبُ الذي أصلحناه أمس بعينه */
  /* **الأفلامُ وحدها، وما لم يُقل بصيغةٍ أثقل**: من له تاريخُ صالاتٍ قيل
     فيه «رسمياً»، ومن له موسمٌ قادم قيل فيه «ينطلق». */
  const said = after.media_type === "movie" && !!after.theatrical_date;
  if (
    after.media_type === "movie" &&
    !said &&
    after.release_date &&
    after.release_date > now &&
    after.release_date <= inDays(60)
  ) {
    out.push({
      ...base,
      kind: "date",
      key: `date:${id}:${after.release_date}`,
      data: { to: after.release_date },
    });
  }
  return out;
}

/**
 * دورةُ رصدٍ واحدة: شريحةٌ من قائمة المراقبة ← قراءةُ TMDB ← فرقٌ ←
 * أخبارٌ ولقطاتٌ محدَّثة.
 *
 * **والقاعدةُ هي التي تختار الشريحة** (`news_watch_slice`): أقدمُ لقطةً
 * أوّلاً، **فالدورةُ تمرّ على الجميع بلا سجلِّ مواضع** — ولا حالةَ في
 * الشيفرة تنسى نفسها بعد كل نشرة.
 */
export async function runNewsSlice(limit = 26): Promise<{
  checked: number;
  posts: number;
  snapshots: number;
}> {
  const supabase = await createClient();

  const { data: slice } = await supabase.rpc("news_watch_slice", { p_limit: limit });
  const rows = (slice ?? []) as {
    tmdb_id: number;
    media_type: "tv" | "movie";
    chart_rank: number | null;
  }[];
  if (!rows.length) return { checked: 0, posts: 0, snapshots: 0 };

  const keys = rows.map((r) => r.tmdb_id);
  const { data: prevRows } = await supabase
    .from("title_snapshots")
    .select(
      "tmdb_id, media_type, status, release_date, next_air_date, seasons, trailer_key, last_air_date, next_season_date, next_season_num, theatrical_date, chart_rank, providers",
    )
    .in("tmdb_id", keys);
  const prev = new Map<string, Snapshot>();
  for (const s of (prevRows ?? []) as Snapshot[]) {
    prev.set(`${s.media_type}:${s.tmdb_id}`, s);
  }

  const snaps: Snapshot[] = [];
  const posts: GeneratedPost[] = [];

  /* ستّةٌ متوازية: TMDB يتحمّلها، والدفعةُ تنتهي في ثوانٍ بدل دقيقة */
  const CHUNK = 6;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const got = await Promise.all(
      rows.slice(i, i + CHUNK).map((r) => readTitle(r.tmdb_id, r.media_type, r.chart_rank ?? null)),
    );
    for (const g of got) {
      if (!g) continue;
      snaps.push(g.snap);
      posts.push(
        ...diffToPosts(prev.get(`${g.snap.media_type}:${g.snap.tmdb_id}`) ?? null, g.snap, g.title, g.poster),
      );
    }
  }

  let saved = 0;
  if (posts.length) {
    const { data } = await supabase.rpc("set_news_posts", { p_rows: posts });
    saved = Number(data ?? 0);
  }
  const { data: snapCount } = await supabase.rpc("set_title_snapshots", { p_rows: snaps });

  return { checked: snaps.length, posts: saved, snapshots: Number(snapCount ?? 0) };
}
