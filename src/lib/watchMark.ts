import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMovie } from "@/lib/tmdb";
import { tagSource, type WatchSource } from "@/lib/watchSource";

/**
 * ====== 🆕 التعليمُ على الخادم — «شاهدتُ حتى هنا» والفيلمُ إلى المكتبة (هجرة ٢٣٧) ======
 *
 * 🔑 **بابان يعلّمان الشيءَ نفسَه**: جوابُ العضو ✓ على سؤال «شفتها؟» (`answerWatchSignal` بجلسته)، والتسجيلُ بلا سؤال
 * («سجّل بلا سؤال»، Loopz+) حين يرسل سيرفرُ البيت أو Kodi أنّ الحلقةَ انتهت (`linkTokens.ts` بعميل الخدمة). فخرجت الدوالُّ
 * من `actions.ts` إلى هنا بحرفها (D-145) ليقرأها الاثنان — **والقواعدُ نفسُها**: حدودُ A-15، والمسلسلُ يُتابَع، والفيلمُ
 * يدخل المكتبة (D-1468)، وشارةُ المصدر على ما أُدرج وحده (D-1505).
 * ⚠️ **العميلُ يُمرَّر ولا يُنشأ هنا**: جلسةُ العضو في الجواب، وعميلُ الخدمة في التسجيل التلقائيّ — والمعرّفُ يُمرَّر معه في
 * كلِّ كتابة، فعميلُ الخدمة لا يكتب إلّا لصاحب الرابط.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- عميلُ الجلسة وعميلُ الخدمة يختلفان في عامّ المخطّط فقط
type Db = SupabaseClient<any, any, any>;

/** كـ`fail` في `actions.ts`: نصُّ Postgres يُسجَّل ولا يصل العضو */
function failed(error: unknown): never {
  console.error("[watchMark]", error);
  throw new Error("تعذّر إتمام العملية، جرّب مرة أخرى / Something went wrong, try again.");
}

/** مسار ملصق TMDB فقط — لا نقبل عنواناً كاملاً من العميل */
export function safeImagePath(path: string | null): string | null {
  if (!path) return null;
  return /^\/[A-Za-z0-9._-]{1,64}$/.test(path) ? path : null;
}

/**
 * 🆕 **تأشيرُ حلقةٍ يُدخل المسلسلَ المكتبةَ** (D-777، سؤالُ أحمد: «هذا
 * المسلسل مثلاً ليه ماهو موجود في المكتبة؟» وحكمُه: «نعم — من أوّل تأشير»).
 *
 * 🔴 **والعطلُ كان صامتاً وقديماً**: المكتبةُ تُبنى من `follows`،
 * **والتأشيرُ يكتب في `watched_episodes` ولا يمسّ `follows`** — **فمن
 * أشّر ٩٢ حلقةً من Arrow لم يكن مسلسلُه في مكتبته**، وصفحةُ العمل تقول
 * «شاهدتَ ٩٢ من ١٧٠» بينما المكتبةُ لا تعرفه. **مقيسٌ في الإنتاج: ٤١
 * زوجاً (مستخدم، عمل) عند ١٢ حساباً، و٣١٦٢ حلقةً خارج المكتبات.**
 *
 * 🔑 **والتأشيرُ إقرارٌ بمتابعةٍ لا لمسةٌ عابرة**: أوّلُ صحٍّ يعلّم كلَّ ما
 * قبله أيضاً (نصُّ الشاشة نفسِها) — **فمن أشّر حلقةً واحدةً قال إنّه
 * يتابع.**
 *
 * ⚠️ **و`ignoreDuplicates` لا استبدال**: من تابَع ثمّ أسقط (`dropped`)
 * ثمّ أشّر حلقةً **لا تُمحى حالتُه** — **ولا `rewatch_count` ولا `genres`
 * ولا `added_at`.** **الصفُّ يُنشأ إن غاب، ولا يُلمس إن حضر.**
 * ⚠️ **ولا نداءَ قراءةٍ قبله**: `on conflict do nothing` جملةٌ واحدةٌ —
 * **والتأشيرُ أعلى فعلٍ تكراراً في التطبيق**، فقراءةٌ تسبق كلَّ ضغطةٍ
 * ثمنٌ لا يُدفع. **والعميلُ يرسل العنوانَ مرّةً واحدةً** (أوّلَ تأشيرٍ
 * وهو غيرُ متابع) فلا تتكرّر الجملةُ مع كلِّ حلقة.
 */
export async function ensureShowFollowed(
  supabase: Db,
  userId: string,
  showTmdbId: number,
  title: string | null | undefined,
  posterPath: string | null | undefined,
) {
  const name = String(title ?? "").trim().slice(0, 300);
  if (!name) return;
  try {
    await supabase.from("follows").upsert(
      {
        user_id: userId,
        tmdb_id: showTmdbId,
        media_type: "tv",
        title: name,
        poster_path: safeImagePath(posterPath ?? null),
      },
      { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
    );
  } catch {
    /* **والتأشيرُ لا يسقط لأنّ الإضافةَ سقطت** — المشاهدةُ محفوظةٌ
       أصلاً، والمكتبةُ تُصلَح في التأشير التالي. */
  }
}

/**
 * 🆕 R58 — **علِّم حلقةً وكلَّ ما قبلها مشاهَداً، على الخادم** (لا يُؤتمن العميلُ على قائمة الحلقات).
 * الترقيمُ المطلقُ من `firstEpisodeOf` (D-603: مواسمُ-الآركات تبدأ من ١١٥٦ لا من ١)، والمواسمُ السابقةُ بما بُثّ منها
 * (`airedPerSeason`). والحلقةُ الخاصّة (الموسم ٠) تُعلَّم وحدَها: «قبلها» لا معنى له هناك. وما شوهد يبقى بتاريخه.
 * ⚠️ **تسكن هنا لا في `actions.ts`**: ذاك الملفُّ `"use server"` وكلُّ دالّةٍ مصدَّرةٍ فيه بابٌ يناديه العميل — وهذه صارت لها
 * قارئةٌ خارجه (التسجيلُ بلا سؤال من سيرفر البيت، هجرة ٢٣٧). وهذا الملفُّ `server-only` لا بابَ فيه.
 */
export async function markWatchedUpTo(
  supabase: Db,
  userId: string,
  tmdbId: number,
  season: number,
  episode: number,
  meta?: { title?: string | null; posterPath?: string | null },
  /** 🆕 D-1505 — من سجّل (جوابُ إشارة Stremio) — يُوسَم به ما أُدرج هنا وحده */
  source?: WatchSource,
): Promise<number> {
  /* 🔴 A-15 (المدقّق ٢٢ أكتوبر) — **الرقمان من العميل، فالحدُّ هنا لا عند من نادى**: منشورُ القلم يمرّر الموسمَ والحلقةَ
     خارجَ حارسِ عموده (٠–٢٠٠ / ١–٥٠٠٠ يحرس الكتابةَ لا هذه الحلقة)، ورقمٌ كبيرٌ كان يدور حلقةً بلا سقف. الحدّان حدّا
     `rateEpisode` نفسُهما (`intIn`) — رقمٌ خارجهما ليس حلقةً، فلا يُعلَّم شيء. */
  if (!Number.isInteger(season) || season < 0 || season > 1000 || !Number.isInteger(episode) || episode < 1 || episode > 20_000) return 0;
  const { getTv } = await import("@/lib/tmdb");
  const { airedPerSeason, airedEpisodesUpTo } = await import("@/core/progress");
  const tv = await getTv(tmdbId);
  const runtime = tv.episode_run_time?.[0] ?? null;
  /* 🔴 A-15 — **موسمٌ لا يعرفه TMDB لا يُعلِّم ما قبله** ولا يُتابَع العملُ لأجله: الموسمُ ٩٩ في مسلسلٍ من ثلاثة كان
     يعلّم الثلاثةَ كلَّها. ⚖️ **والحسبةُ خرجت إلى `airedEpisodesUpTo`** يومَ صار لها قارئٌ ثانٍ (استيرادُ IMDb) —
     بحدودها كلِّها: الخاصّةُ وحدَها، وفي موسمها حتى آخر ما بُثّ لا حتى الرقم المرسَل (D-145). */
  if (season !== 0 && !airedPerSeason(tv).has(season)) return 0;
  const want = airedEpisodesUpTo(tv, season, episode);
  const { data: seen } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .match({ user_id: userId, show_tmdb_id: tmdbId })
    .limit(20_000);
  const have = new Set((seen ?? []).map((r) => `${r.season_number}-${r.episode_number}`));
  const now = new Date().toISOString();
  const rows = want
    .filter((w) => !have.has(`${w.s}-${w.e}`))
    .slice(0, 5000)
    .map((w) => ({ user_id: userId, show_tmdb_id: tmdbId, season_number: w.s, episode_number: w.e, runtime, watched_at: now }));
  if (rows.length) {
    const { data: added, error } = await supabase
      .from("watched_episodes")
      .upsert(rows, { onConflict: "user_id,show_tmdb_id,season_number,episode_number", ignoreDuplicates: true })
      .select("id");
    if (error) failed(error);
    if (source) await tagSource(supabase, "watched_episodes", added as { id: number }[] | null, source);
  }
  await ensureShowFollowed(supabase, userId, tmdbId, meta?.title ?? tv.name ?? null, meta?.posterPath ?? tv.poster_path ?? null);
  return rows.length;
}

/**
 * 🆕 **D-1468 — الفيلمُ المشاهَدُ يدخل المكتبة من أيِّ بابٍ عُلِّم** (بلاغُ أحمد ١٩ أكتوبر: ملفُّ عمر يعرض ٤ أفلام
 * وعنده ١٩ مشاهَداً). زرُّ الويب كان يتابع ثمّ يختم بنفسه (`TitleActions`)، **وأزرارُ التطبيق تنادي `track/movie`
 * وحدَه** — والملفُّ الشخصيّ والمكتبةُ يعدّان صفوفَ `follows`. فصار الحارسُ هنا في الخادم لا في كلِّ زرّ.
 *  - **`ignoreDuplicates`**: فيلمٌ في المكتبة أصلاً لا يُمسّ — لا اسمُه ولا «أوقفته» ولا تاريخُ إضافته.
 *  - الاسمُ والملصقُ من المستدعي إن حملهما، وإلا من TMDB بمهلة ثانيتين ونصف؛ وغيابُهما لا يمنع الصفّ.
 *  - ⚖️ إلغاءُ المشاهدة لا يُخرج الفيلمَ من المكتبة (كما في الويب: «لم أشاهده» حالةٌ في المكتبة لا خروجٌ منها).
 */
export async function ensureMovieInLibrary(
  supabase: Db,
  userId: string,
  tmdbId: number,
  meta?: { title: string; posterPath: string | null },
) {
  try {
    const { data: have } = await supabase
      .from("follows")
      .select("tmdb_id")
      .match({ user_id: userId, tmdb_id: tmdbId, media_type: "movie" })
      .maybeSingle();
    if (have) return;
    const m = await Promise.race([
      getMovie(tmdbId).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 2500)),
    ]);
    const genres = m ? (m.genres ?? []).map((g) => g.id).filter((n) => Number.isInteger(n)) : null;
    await supabase.from("follows").upsert(
      {
        user_id: userId,
        tmdb_id: tmdbId,
        media_type: "movie",
        title: (meta?.title || m?.title || "").slice(0, 300),
        poster_path: meta?.posterPath ?? safeImagePath(m?.poster_path ?? null),
        ...(genres && genres.length ? { genres } : {}),
      },
      { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
    );
  } catch {
    /* المشاهدةُ محفوظة؛ المكتبةُ تُكمَّل بزرّ الإضافة إن فشلت هنا */
  }
}

/** صفُّ السؤال كما يُقرأ — العملُ والحلقةُ منه لا من العميل */
export interface SignalRow {
  id: number;
  media_type: string;
  tmdb_id: number;
  season: number | null;
  episode: number | null;
}

/**
 * ✓ على سؤال: حلقةٌ = «شاهدتُ حتى هنا» وتُغلق معها أسئلةُ ما قبلها في المسلسل نفسِه؛ فيلمٌ = مشاهَدٌ ويدخل المكتبة.
 * ثمّ يُغلق السؤالُ نفسُه (`watched`). يعيد عددَ الحلقات المعلَّمة.
 * ⚖️ **وإغلاقُ السؤال بشرط «ما زال منتظراً»**: جهازان أو ضغطتان لا تكتبان مرّتين.
 */
export async function markSignalWatched(supabase: Db, userId: string, sig: SignalRow, src: WatchSource): Promise<number> {
  let marked = 0;
  if (sig.media_type === "tv" && sig.season != null && sig.episode != null) {
    marked = await markWatchedUpTo(supabase, userId, sig.tmdb_id, sig.season, sig.episode, undefined, src);
    /* ما قبلها في المسلسل نفسِه أُجيب عنه بهذا الجواب — الخاصّةُ (الموسم ٠) وحدَها كما في `markWatchedUpTo` */
    if (sig.season > 0) {
      await supabase
        .from("watch_signals")
        .update({ state: "watched", answered_at: new Date().toISOString() })
        .match({ user_id: userId, media_type: "tv", tmdb_id: sig.tmdb_id, state: "pending" })
        .gt("season", 0)
        .or(`season.lt.${sig.season},and(season.eq.${sig.season},episode.lte.${sig.episode})`);
    }
  } else if (sig.media_type === "movie") {
    const m = await Promise.race([getMovie(sig.tmdb_id).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
    const runtime = m?.runtime && Number.isInteger(m.runtime) && m.runtime > 0 && m.runtime <= 10_000 ? m.runtime : null;
    const { data: added, error } = await supabase
      .from("watched_movies")
      .upsert({ user_id: userId, movie_tmdb_id: sig.tmdb_id, runtime }, { onConflict: "user_id,movie_tmdb_id", ignoreDuplicates: true })
      .select("id");
    if (error) failed(error);
    await tagSource(supabase, "watched_movies", added as { id: number }[] | null, src);
    await ensureMovieInLibrary(supabase, userId, sig.tmdb_id);
  }
  await closeSignal(supabase, userId, sig.id, true);
  return marked;
}

/** يُغلق السؤالَ بجوابه — ما دام منتظراً */
export async function closeSignal(supabase: Db, userId: string, id: number, watched: boolean): Promise<void> {
  await supabase
    .from("watch_signals")
    .update({ state: watched ? "watched" : "dismissed", answered_at: new Date().toISOString() })
    .match({ id, user_id: userId, state: "pending" });
}
