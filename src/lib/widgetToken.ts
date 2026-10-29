import "server-only";
import { tagSource } from "@/lib/watchSource";
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
import { notifyGroupMessage, notifyMessage } from "@/lib/push";
import { parseWidgetDmBody } from "@/core/contracts/widget";
import type { DmTarget } from "@/core/push";
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

/**
 * 🔴 A-05 (المدقّق ٢١ أكتوبر) — **الرمزُ يموت إن نام**: كان حيّاً إلى الأبد، ورمزٌ على جوّالٍ ضاع أو بِيع يبقى يعلّم ويرسل.
 * الآن يُقبل ما دام استُعمل (أو جدّده جهازُه) في آخر ٩٠ يوماً، وإلّا رُفض كرمزٍ لا وجود له. **والجهازُ نفسُه يجدّده**:
 * التطبيقُ يرسل رمزَه مع خلاصة الودجت (`x-loopz-widget` — `noteWidgetLang`)، فجوّالٌ يُفتح لا يموت رمزُه ولو لم يُلمس ✓.
 * ⚖️ ٩٠ يوماً: أطولُ من أيِّ عطلةٍ عن التطبيق، وأقصرُ من عمر جوّالٍ في درج.
 */
const IDLE_DAYS = 90;
const aliveSince = () => new Date(Date.now() - IDLE_DAYS * 86_400_000).toISOString();
/** شرطُ «حيّ» بصيغة PostgREST: آخرُ استعمالٍ في النافذة، أو لم يُستعمل بعد وصدر فيها */
const aliveFilter = () => {
  const cut = aliveSince();
  return `last_used_at.gt.${cut},and(last_used_at.is.null,created_at.gt.${cut})`;
};

/** يُصدر رمزاً جديداً لهذا الجهاز ويعيده **مرّةً واحدة** — `null` إن غاب المفتاحُ أو الجدول */
export async function issueWidgetToken(userId: string, lang: Locale): Promise<string | null> {
  if (!hasServiceKey()) return null;
  const db = await createServiceClient();
  const token = `lw_${randomBytes(32).toString("base64url")}`;
  const { error } = await db.from("widget_tokens").insert({ token_hash: hashOf(token), user_id: userId, lang });
  if (error) return null;
  /* 🆕 A-05 — الميّتُ يُكنس عند الإصدار: لا يُقبل أصلاً، وبقاؤه صفٌّ بلا معنى */
  const cut = aliveSince();
  await db
    .from("widget_tokens")
    .delete()
    .eq("user_id", userId)
    .or(`and(last_used_at.not.is.null,last_used_at.lt.${cut}),and(last_used_at.is.null,created_at.lt.${cut})`);
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
 *
 * 🆕 A-05 — **ورمزُ هذا الجهاز يتجدّد هنا** حين يرسله التطبيق (`deviceToken`، ترويسةُ `x-loopz-widget`): يُطابَق بصاحب الجلسة
 * نفسِه (رمزُ غيرك لا يُجدَّد بجلستك)، و`check` يقول هل **هذا** الرمزُ حيّ — `false` يعني «اطلب رمزاً جديداً». ونسخةٌ أقدمُ
 * لا ترسله: تُجدَّد رموزُ العضو الحيّةُ كلُّها كما كان سلوكُها، فلا يموت ✓ عند من لم يصله التحديث.
 */
export async function noteWidgetLang(userId: string, lang: Locale, deviceToken?: string | null): Promise<boolean> {
  if (!hasServiceKey()) return false;
  try {
    const db = await createServiceClient();
    let q = db
      .from("widget_tokens")
      .update({ lang, last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .or(aliveFilter());
    if (deviceToken && TOKEN_RE.test(deviceToken)) q = q.eq("token_hash", hashOf(deviceToken));
    const { data, error } = await q.select("token_hash");
    return !error && (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * 🆕 A-05 — **الخروجُ يُلغي رمزَ الجهاز على الخادم** لا في ملفّه وحده: كان التطبيقُ يمحو الملفّ (`prune`) ويبقى الرمزُ حيّاً
 * عند من نسخه. الرمزُ نفسُه يثبت ملكيّته (لا جلسةَ بعد الخروج)، ولا يُلغي إلّا نفسَه.
 */
export async function revokeWidgetToken(authHeader: string | null): Promise<boolean> {
  const token = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!TOKEN_RE.test(token) || !hasServiceKey()) return false;
  const db = await createServiceClient();
  const { data, error } = await db.from("widget_tokens").delete().eq("token_hash", hashOf(token)).select("token_hash");
  return !error && (data?.length ?? 0) > 0;
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
    /* 🆕 A-05 — رمزٌ نام ٩٠ يوماً لا يُقبل ولا يُبعث باستعماله */
    .or(aliveFilter())
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
    const { data: marked, error } = await db.from("watched_episodes").upsert(
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
    ).select("id");
    if (error) throw new Error("widget mark failed");
    /* 🆕 D-1505 — «من الودجت» شارةٌ في سجلّ المشاهدة (وسمٌ يفشل قبل العمود يُبتلع — `watchSource`) */
    await tagSource(db, "watched_episodes", marked as { id: number }[] | null, "widget");
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

/**
 * 🆕 D-1571 — «+» على «الآن في السينما»: يضيف الفيلمَ إلى «للمشاهدة» (متابعةٌ كـ`follow` في التطبيق، والعنوانُ والملصقُ من TMDB لا من
 * الطلب)، والتراجعُ يحذفه **ما لم يكن له أثرٌ** (لا حالةَ مشاهدة) — فلا يمحو رمزٌ مسروقٌ فيلماً أضافه صاحبُه من قبل وتابعه.
 */
export async function widgetToWatch(who: { userId: string }, movieTmdbId: number, on: boolean): Promise<boolean> {
  const db = await createServiceClient();
  if (on) {
    const m = await getMovie(movieTmdbId).catch(() => null);
    if (!m) return false;
    const { error } = await db.from("follows").upsert(
      {
        user_id: who.userId,
        tmdb_id: movieTmdbId,
        media_type: "movie",
        title: String(m.title ?? "").slice(0, 300),
        poster_path: m.poster_path ?? null,
      },
      { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
    );
    if (error) throw new Error("widget towatch failed");
  } else {
    const { error } = await db.from("follows").delete().match({ user_id: who.userId, tmdb_id: movieTmdbId, media_type: "movie" }).is("watch_state", null);
    if (error) throw new Error("widget untowatch failed");
  }
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/movie/${movieTmdbId}`);
  return true;
}

type ActionKind = "movie" | "start" | "rate" | "towatch";

/**
 * `POST /api/v1/widget/movie|start|rate` — مسارٌ واحدٌ لكلِّ فعل، والهويّةُ من الرمز وحدَه كـ`widgetMarkRoute`،
 * ودلوُ الحدِّ نفسُه (`wmark`): نقراتُ الودجت كلُّها من جيبٍ واحد.
 * - `movie` `{ movieTmdbId, watched }` · `start` `{ showTmdbId, start }` · `rate` `{ movieTmdbId, rating: 1..10 }`
 * - 🆕 D-1571 `towatch` `{ movieTmdbId, on }` — «+» على «الآن في السينما»
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
        else if (kind === "towatch") done = await widgetToWatch(who, intIn(b?.movieTmdbId, 1, 100_000_000), b?.on !== false);
        else done = await widgetRate(who, intIn(b?.movieTmdbId, 1, 100_000_000), intIn(b?.rating, 1, 10));
        if (!done) return fail("not_found");
        return ok({ done: true });
      },
      { open: true },
    );
}

/* ───────── 🆕 1.12.7 — «رد» و«تمييز كمقروءة» من إشعار الرسالة، والتطبيقُ مقفول (`DmPush.kt`) ───────── */

/**
 * 🔑 **لماذا رمزُ الودجت هنا**: إشعارُ الرسالة يرسمه كودٌ أصليٌّ لا يملك جلسةً — ونسخةُ الجلسة لا تخرج من التطبيق (D-929).
 * فالرمزُ نفسُه (`files/widget/token`) يكسب فعلين آخرين: **ردٌّ نصّيٌّ لمن تراسله أصلاً، وختمُ «قرأت»** — لا قراءةَ
 * لرسالةٍ ولا بدءَ محادثةٍ مع من لا يقبل، فأسوأُ ما يفعله رمزٌ مسروقٌ رسالةٌ باسم صاحبه لمن يراسله.
 *
 * 🔒 **القواعدُ قواعدُ الجلسة نفسُها**: عميلُ الخدمة يتجاوز RLS، فما تفرضه السياساتُ هناك يُفرض هنا صراحةً قبل الكتابة —
 * الخاصُّ ببوّاب `can_message` نفسِه (حظرٌ · «من يراسلني» · محادثةٌ قائمة)، والقروبُ بالعضويّة (سياسةُ «members send as
 * self»). وما لا يُعرف (البوّابُ لم يُجب) رفضٌ لا سماح.
 */
type DmWho = { userId: string };

/**
 * «قرأتُ المحادثة» لصاحب الرمز — **نسخةُ `mark_conversation_read` (الهجرة ٢٠٠) سطراً سطراً**: تلك الدالّةُ تقرأ
 * `auth.uid()` ولا جلسةَ هنا. أيُّ تغييرٍ فيها يُنقل إلى هنا.
 */
async function markDmReadAs(db: Awaited<ReturnType<typeof createServiceClient>>, userId: string, peer: string): Promise<void> {
  const now = new Date().toISOString();
  await db.from("title_shares").update({ read_at: now }).eq("recipient_id", userId).eq("sender_id", peer).is("read_at", null);
  await db.from("list_shares").update({ read_at: now }).eq("recipient_id", userId).eq("sender_id", peer).is("read_at", null);
  /* ردودُ الشخص في خيوط المشاركة — والردُّ لا يكتبه إلّا طرفا المشاركة، فخيوطُه معي هي مشاركاتٌ بيننا نحن الاثنين */
  const { data: threads } = await db
    .from("title_shares")
    .select("id")
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${userId})`)
    .limit(500);
  const ids = ((threads ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length) await db.from("share_replies").update({ read_at: now }).eq("author_id", peer).is("read_at", null).in("share_id", ids);
  await db.from("direct_messages").update({ read_at: now }).eq("recipient_id", userId).eq("sender_id", peer).is("read_at", null);
}

/** «قرأتُ القروب» — `dm_group_mark_read` نفسُها (الهجرة ٢٠٥) لصاحب الرمز؛ `false` إن لم يكن عضواً */
async function markGroupReadAs(db: Awaited<ReturnType<typeof createServiceClient>>, userId: string, group: string): Promise<boolean> {
  const { data, error } = await db
    .from("dm_group_members")
    .update({ last_read_at: new Date().toISOString() })
    .match({ group_id: group, user_id: userId })
    .select("user_id");
  return !error && (data?.length ?? 0) > 0;
}

export type WidgetDmResult = "ok" | "forbidden" | "not_found";

/** «تمييز كمقروءة» من الإشعار */
export async function widgetDmRead(who: DmWho, target: DmTarget): Promise<WidgetDmResult> {
  const db = await createServiceClient();
  if ("to" in target) {
    if (target.to === who.userId) return "not_found";
    await markDmReadAs(db, who.userId, target.to);
    revalidatePath("/people");
    return "ok";
  }
  return (await markGroupReadAs(db, who.userId, target.group)) ? "ok" : "forbidden";
}

/**
 * «رد» من الإشعار: رسالةٌ نصّيّةٌ بقواعد مسار الجلسة (`sendDirectMessage` · `POST me/groups/<id>`)، ثمّ دفعٌ للطرف الآخر
 * كأيِّ رسالة، **ثمّ ما قبلها مقروء** (ردٌّ على ما في الإشعار — كالواتس؛ والقروبُ يختمه مشغِّلُ الهجرة ٢٠٥ بنفسه).
 */
/**
 * 🆕 1.12.7 — **من ردّ من الإشعار حاضرٌ الآن** (D-1307 كمسار الجلسة `presenceOnSend`): `touch_presence` تعتمد `auth.uid()`
 * ولا جلسةَ هنا، فيُكتب «آخر ظهور» وحدَه بخنق الدالّة نفسِه (٦٠ث). أيّامُ النشاط وصفُّ الجهاز لا تُلمس: الردُّ من الشريط
 * ليس فتحاً للتطبيق. وفشلُه صمت — الرسالةُ وصلت.
 */
async function seenNow(db: Awaited<ReturnType<typeof createServiceClient>>, userId: string): Promise<void> {
  try {
    const cut = new Date(Date.now() - 60_000).toISOString();
    await db.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId).or(`last_seen_at.is.null,last_seen_at.lt.${cut}`);
  } catch {
    /* لا شيء */
  }
}

export async function widgetDmReply(who: DmWho, target: DmTarget, body: string): Promise<WidgetDmResult> {
  const db = await createServiceClient();
  if ("to" in target) {
    if (target.to === who.userId) return "not_found";
    /* البوّابُ نفسُه الذي تشترطه سياسةُ «send direct message as self» — خطأٌ في السؤال رفضٌ لا سماح */
    const gate = await db.rpc("can_message", { a: who.userId, b: target.to });
    if (gate.error || gate.data !== true) return "forbidden";
    const { error } = await db.from("direct_messages").insert({ sender_id: who.userId, recipient_id: target.to, body });
    if (error) {
      if (error.code === "42501" || error.code === "23514" || error.code === "23503") return "forbidden";
      throw new Error(`widget dm reply: ${error.message}`);
    }
    notifyMessage({ to: target.to, actorId: who.userId, text: body });
    await Promise.all([markDmReadAs(db, who.userId, target.to), seenNow(db, who.userId)]);
    revalidatePath("/people");
    return "ok";
  }
  /* العضويّةُ شرطُ سياسة «members send as self» — من خرج أو حُذف لا يكتب من إشعارٍ قديم */
  const { data: member } = await db.from("dm_group_members").select("user_id").match({ group_id: target.group, user_id: who.userId }).maybeSingle();
  if (!member) return "forbidden";
  const { error } = await db.from("dm_group_messages").insert({ group_id: target.group, sender_id: who.userId, body });
  if (error) {
    if (error.code === "42501" || error.code === "23514" || error.code === "23503") return "forbidden";
    throw new Error(`widget group reply: ${error.message}`);
  }
  notifyGroupMessage({ groupId: target.group, actorId: who.userId, text: body });
  await seenNow(db, who.userId);
  return "ok";
}

/**
 * `POST /api/v1/widget/dm-reply` `{ to | group, body }` و`POST /api/v1/widget/dm-read` `{ to | group }` — الهويّةُ من الرمز
 * وحدَه كبقيّة مسارات الودجت. دلوُ حدٍّ خاصٌّ بالرسائل (`wdm`) بحدِّ مسار الإرسال بالجلسة: ردودُ الإشعار لا تأكل
 * نقراتِ ✓ ولا تتجاوز ما يُسمح به داخل التطبيق.
 */
export function widgetDmRoute(kind: "reply" | "read") {
  return (req: NextRequest) =>
    handle(
      async () => {
        const who = await widgetUser(req.headers.get("authorization"));
        if (!who) return fail("unauthenticated");
        const rl = limited(`wdm:${who.userId}`, 30, 60_000);
        if (rl) return rl;
        const b = parseWidgetDmBody(await req.json().catch(() => null), kind === "reply");
        if (!b) return fail("invalid_input");
        const r = kind === "reply" ? await widgetDmReply(who, b.target, b.body) : await widgetDmRead(who, b.target);
        if (r === "forbidden") return fail("forbidden");
        if (r === "not_found") return fail("not_found");
        return ok({ done: true as const });
      },
      { open: true },
    );
}
