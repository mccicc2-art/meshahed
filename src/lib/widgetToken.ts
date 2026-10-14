import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceClient, hasServiceKey } from "@/lib/supabase/service";
import { getMovie, getTv } from "@/lib/tmdb";
import { airedEpisodeCount, nextUnwatchedEpisode } from "@/core/progress";
import { episodeKey } from "@/core/keys";
import { getDict, type Locale } from "@/core/i18n";
import { intIn } from "@/core/validate";
import { ok } from "@/core/contracts/result";
import { handle, limited, fail } from "@/lib/v1";
import type { NextRequest } from "next/server";

/**
 * ====== 🆕 رمزُ الودجت — ✓ من الشاشة الرئيسيّة بلا جلسة (خطّةُ الودجتات W14 · الدفعة الثانية) ======
 *
 * 🔑 **لماذا رمزٌ خاصّ**: نسخةُ الجلسة لا تخرج من التطبيق (D-929) — لو جدّدها الودجتُ والتطبيقُ معاً لعدّها Supabase
 * سرقةً وأخرج صاحبَها. فيأخذ الودجتُ رمزاً **لا يقدر إلّا على «علّم» و«تراجع» لمسلسلٍ يتابعه صاحبُه**: لا قراءة،
 * لا إعدادات، لا تجديد. ومن يمسك الجوالَ مفتوحاً يعلّم حلقاتٍ لا غير.
 *
 * 🔒 **الجدولُ لا يحفظ الرمز** بل بصمتَه (sha-256)، ولا يصله إلّا مفتاحُ الخدمة (RLS بلا سياسة — هجرة ٢٠١).
 * ولذلك هذا الملفُّ في سياج عميل الخدمة (`eslint.config.mjs`) **والكتابةُ فيه مقيّدةٌ بصاحب الرمز**:
 * كلُّ نداءٍ يأخذ `user_id` من صفّ البصمة لا من الطلب.
 *
 * ⚠️ **الفشلُ صمتٌ لا سقوط**: قبل أن يشغّل المالكُ الهجرةَ على الإنتاج يغيب الجدول — فلا رمزَ يُصدر،
 * والخلاصةُ تكتب `check: false` فلا يُرسم ✓ أصلاً. لا شيءَ آخرُ يتغيّر.
 */

/** رمزٌ لكلِّ جهاز — ويُبقى أحدثُ خمسةٍ لكلِّ عضو: إعادةُ التثبيت لا تراكم رموزاً حيّةً بلا نهاية */
const KEEP_PER_USER = 5;

const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");

/** شكلُ الرمز وحدُّه قبل أيِّ نداءٍ للقاعدة — نصٌّ غريبٌ لا يكلّف استعلاماً */
const TOKEN_RE = /^lw_[A-Za-z0-9_-]{43}$/;

/** يُصدر رمزاً جديداً لهذا الجهاز ويعيده **مرّةً واحدة** — `null` إن غاب المفتاحُ أو الجدول */
export async function issueWidgetToken(userId: string, lang: Locale): Promise<string | null> {
  if (!hasServiceKey()) return null;
  const db = await createServiceClient();
  const token = `lw_${randomBytes(32).toString("base64url")}`;
  const { error } = await db.from("widget_tokens").insert({ token_hash: hashOf(token), user_id: userId, lang });
  if (error) return null;
  /* الأقدمُ استعمالاً يخرج أوّلاً — جهازٌ يعلّم كلَّ يومٍ لا يُطرد لأنّ آخرَ أُعيد تثبيتُه */
  const { data } = await db
    .from("widget_tokens")
    .select("token_hash, created_at, last_used_at")
    .eq("user_id", userId)
    .limit(50);
  const rows = (data ?? []) as { token_hash: string; created_at: string; last_used_at: string | null }[];
  if (rows.length > KEEP_PER_USER) {
    const stale = rows
      .sort((a, b) => (b.last_used_at ?? b.created_at).localeCompare(a.last_used_at ?? a.created_at))
      .slice(KEEP_PER_USER)
      .map((r) => r.token_hash);
    await db.from("widget_tokens").delete().in("token_hash", stale);
  }
  return token;
}

/**
 * يُنادى مع كلِّ جلبٍ لخلاصة الودجت (بجلسة العضو): يحفظ لغةَ الواجهة لسطر الردّ، ويقول هل للعضو رمزٌ أصلاً —
 * **فـ`check` لا يكون `true` إلّا حيث يعمل ✓ فعلاً** (الجدولُ موجودٌ والرمزُ صادر).
 */
export async function noteWidgetLang(userId: string, lang: Locale): Promise<boolean> {
  if (!hasServiceKey()) return false;
  try {
    const db = await createServiceClient();
    const { data, error } = await db.from("widget_tokens").update({ lang }).eq("user_id", userId).select("token_hash");
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/** صاحبُ الرمز من ترويسة `Authorization: Bearer lw_…` — أو `null` */
export async function widgetUser(authHeader: string | null): Promise<{ userId: string; lang: Locale } | null> {
  const token = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!TOKEN_RE.test(token) || !hasServiceKey()) return null;
  const db = await createServiceClient();
  const { data, error } = await db
    .from("widget_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", hashOf(token))
    .select("user_id, lang")
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { user_id: string; lang: string };
  return { userId: row.user_id, lang: row.lang === "en" ? "en" : "ar" };
}

export type WidgetNext = { season: number; episode: number; label: string } | null;

/**
 * ✓ أو تراجعٌ عنه، ثمّ الحلقةُ التالية بسطر بطاقة الرئيسيّة نفسِه («S2 E5 · باقي 6»).
 * `null` من الدالّة = المسلسلُ ليس في متابعات صاحب الرمز (فلا كتابة)؛ و`next: null` = أنهى المعروض.
 */
export async function widgetMark(
  who: { userId: string; lang: Locale },
  input: { showTmdbId: number; season: number; episode: number },
  watched: boolean,
): Promise<{ next: WidgetNext } | null> {
  const db = await createServiceClient();
  const { userId } = who;
  const { showTmdbId, season, episode } = input;

  /* 🔒 **المتابَعُ وحدَه**: الودجتُ يعرض ما في «أكمل المشاهدة»، ورمزٌ مسروقٌ لا يزرع مسلسلاتٍ في مكتبة صاحبه */
  const { data: follow } = await db
    .from("follows")
    .select("rewatch_started_at")
    .eq("user_id", userId)
    .eq("tmdb_id", showTmdbId)
    .eq("media_type", "tv")
    .maybeSingle();
  if (!follow) return null;
  const since = (follow as { rewatch_started_at: string | null }).rewatch_started_at ?? null;

  const tv = await getTv(showTmdbId);
  if (watched) {
    const { error } = await db.from("watched_episodes").upsert(
      {
        user_id: userId,
        show_tmdb_id: showTmdbId,
        season_number: season,
        episode_number: episode,
        runtime: tv.episode_run_time?.[0] ?? null,
        /* طابعٌ جديد كـ`toggleEpisode`: إعادةُ تأشيرٍ في دورة إعادةٍ تُحسب للدورة */
        watched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,show_tmdb_id,season_number,episode_number" },
    );
    if (error) throw new Error("widget mark failed");
  } else {
    const { error } = await db.from("watched_episodes").delete().match({
      user_id: userId,
      show_tmdb_id: showTmdbId,
      season_number: season,
      episode_number: episode,
    });
    if (error) throw new Error("widget unmark failed");
  }

  /* المفاتيحُ بعد الكتابة وبحدِّ دورة الإعادة — **قراءةُ `getWatchedForShow` نفسُها** (الرئيسيّةُ تقترح من هنا) */
  const keys = new Set<string>();
  /* الموسمُ صفرٌ لا يُعدّ في «باقي N» — `airedEpisodeCount` لا يعدّه، فطرحُه منه يُنقص الباقيَ زوراً */
  let counted = 0;
  for (let from = 0; from < 20_000; from += 1000) {
    let q = db
      .from("watched_episodes")
      .select("season_number, episode_number")
      .eq("user_id", userId)
      .eq("show_tmdb_id", showTmdbId);
    if (since) q = q.gte("watched_at", since);
    const { data } = await q
      .order("season_number", { ascending: true })
      .order("episode_number", { ascending: true })
      .range(from, from + 999);
    const rows = (data ?? []) as { season_number: number; episode_number: number }[];
    rows.forEach((r) => {
      keys.add(episodeKey(r.season_number, r.episode_number));
      if (r.season_number >= 1) counted++;
    });
    if (rows.length < 1000) break;
  }

  /* الويبُ يرى التأشيرَ في زيارته التالية كما يراه بعد ✓ داخل التطبيق */
  revalidatePath("/");
  revalidatePath("/stats");

  const n = nextUnwatchedEpisode(tv, keys);
  if (!n) return { next: null };
  const t = getDict(who.lang);
  const aired = airedEpisodeCount(tv);
  const left = aired > counted ? aired - counted : 0;
  const label = [`S${n.season} E${n.episode}`, left > 0 ? t.leftEps(left) : null].filter(Boolean).join(" · ");
  return { next: { season: n.season, episode: n.episode, label } };
}

/**
 * `POST /api/v1/widget/mark|unmark` — مسارٌ واحدٌ بفعلين. **`open`**: لا جلسةَ هنا يُسأل عنها الترحيبُ أصلاً،
 * والهويّةُ من الرمز وحدَه. والحدُّ أعلى من دلو التطبيق قليلاً: نقراتٌ متتاليةٌ على ✓ لحلقاتٍ متلاحقة نمطٌ مشروع.
 */
export function widgetMarkRoute(watched: boolean) {
  return (req: NextRequest) =>
    handle(
      async () => {
        const who = await widgetUser(req.headers.get("authorization"));
        if (!who) return fail("unauthenticated");
        const rl = limited(`wmark:${who.userId}`, 60, 60_000);
        if (rl) return rl;
        const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        const input = {
          showTmdbId: intIn(b?.showTmdbId, 1, 100_000_000),
          season: intIn(b?.season, 0, 1000),
          episode: intIn(b?.episode, 1, 20_000),
        };
        const r = await widgetMark(who, input, watched);
        if (!r) return fail("not_found");
        return ok(r);
      },
      { open: true },
    );
}

/* ───────── 🆕 الدفعةُ الثانية (W35 · W37): فيلمٌ شاهدتُه · «ابدأ» · التقييم — وتراجعُ كلٍّ منها ───────── */

/**
 * ✓ فيلم أو تراجعٌ عنه — `toggleMovieWatched` نفسُه بهويّة الرمز. الفيلمُ يأتي من «للمشاهدة» أو «فيلم الليلة»،
 * و«فيلم الليلة» قد يكون **اقتراحاً ليس في المكتبة** (W42) — فلا يُشترط أن يكون متابَعاً كالمسلسل؛
 * ويُتحقّق أنّه فيلمٌ حقيقيٌّ في TMDB (ومنه المدّة)، فلا يُكتب رقمٌ عشوائيّ. أسوأُ ما يفعله رمزٌ مسروقٌ هنا
 * «شاهدتُ فيلماً» يتراجع عنه صاحبُه بلمسة — بلا قراءةٍ ولا حذفٍ لغير ما يكتبه.
 */
export async function widgetMovie(who: { userId: string }, movieTmdbId: number, watched: boolean): Promise<boolean> {
  const db = await createServiceClient();
  if (watched) {
    const m = await getMovie(movieTmdbId).catch(() => null);
    if (!m) return false;
    const { error } = await db.from("watched_movies").upsert(
      { user_id: who.userId, movie_tmdb_id: movieTmdbId, runtime: m.runtime ?? null },
      { onConflict: "user_id,movie_tmdb_id" },
    );
    if (error) throw new Error("widget movie failed");
  } else {
    const { error } = await db.from("watched_movies").delete().match({ user_id: who.userId, movie_tmdb_id: movieTmdbId });
    if (error) throw new Error("widget unmovie failed");
  }
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/movie/${movieTmdbId}`);
  return true;
}

/**
 * «▶ ابدأ» لمسلسلٍ في «للمشاهدة» أو تراجعٌ عنه — `setWatchState` نفسُه: البدءُ `started`، والتراجعُ فراغ
 * (D-1281: إيقافٌ بلا حلقةٍ تراجعٌ عن «ابدأ»). **المتابَعُ وحدَه** — كالحلقات.
 */
export async function widgetStart(who: { userId: string }, showTmdbId: number, start: boolean): Promise<boolean> {
  const db = await createServiceClient();
  const { data, error } = await db
    .from("follows")
    .update({ watch_state: start ? "started" : null })
    .match({ user_id: who.userId, tmdb_id: showTmdbId, media_type: "tv" })
    .select("tmdb_id");
  if (error) throw new Error("widget start failed");
  if (!data?.length) return false;
  revalidatePath("/");
  revalidatePath("/library");
  return true;
}

/**
 * ★ تقييمُ فيلمٍ من شريط الودجت (W37، قرارُ أحمد «١ ب»: شريطٌ تحت البحث). يكتب الرقمَ والعنوانَ والملصق
 * **ولا يلمس الريفيو ولا علامةَ الحرق**: حقلٌ غائبٌ لا يُكتب (D-152) — من كتب رأياً في التطبيق لا يمحوه نجمٌ في الودجت.
 */
export async function widgetRate(who: { userId: string }, movieTmdbId: number, rating: number): Promise<boolean> {
  const m = await getMovie(movieTmdbId).catch(() => null);
  if (!m) return false;
  const db = await createServiceClient();
  const { error } = await db.from("ratings").upsert(
    {
      user_id: who.userId,
      tmdb_id: movieTmdbId,
      media_type: "movie",
      rating,
      title: String(m.title ?? "").slice(0, 300),
      /* من TMDB نفسِه لا من الطلب — فلا تنقيةَ هنا */
      poster_path: m.poster_path ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tmdb_id,media_type" },
  );
  if (error) throw new Error("widget rate failed");
  revalidatePath(`/movie/${movieTmdbId}`);
  revalidatePath("/");
  return true;
}

type ActionKind = "movie" | "start" | "rate";

/**
 * `POST /api/v1/widget/movie|start|rate` — مسارٌ واحدٌ لكلِّ فعل، والهويّةُ من الرمز وحدَه كـ`widgetMarkRoute`،
 * ودلوُ الحدِّ نفسُه (`wmark`): نقراتُ الودجت كلُّها من جيبٍ واحد.
 * - `movie` `{ movieTmdbId, watched }` · `start` `{ showTmdbId, start }` · `rate` `{ movieTmdbId, rating: 1..10 }`
 * - الردُّ `{ done: true }`؛ و`not_found` = ليس فيلماً حقيقيّاً، أو مسلسلاً لا يتابعه صاحبُ الرمز.
 */
export function widgetActionRoute(kind: ActionKind) {
  return (req: NextRequest) =>
    handle(
      async () => {
        const who = await widgetUser(req.headers.get("authorization"));
        if (!who) return fail("unauthenticated");
        const rl = limited(`wmark:${who.userId}`, 60, 60_000);
        if (rl) return rl;
        const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        let done = false;
        if (kind === "movie") done = await widgetMovie(who, intIn(b?.movieTmdbId, 1, 100_000_000), b?.watched !== false);
        else if (kind === "start") done = await widgetStart(who, intIn(b?.showTmdbId, 1, 100_000_000), b?.start !== false);
        else done = await widgetRate(who, intIn(b?.movieTmdbId, 1, 100_000_000), intIn(b?.rating, 1, 10));
        if (!done) return fail("not_found");
        return ok({ done: true });
      },
      { open: true },
    );
}
