import "server-only";
import { createClient } from "@/lib/supabase/server";
import { harvestTrakt, traktRevoke } from "@/lib/trakt";
import { IMPORT_CAPS } from "@/core/importer";
import { planTraktImport, traktKey, type TraktKind } from "@/lib/traktImport";
import { safeImagePath } from "@/lib/watchMark";
import { revalidatePath } from "next/cache";

export type TraktRunResult =
  | { ok: true; shows: number; episodes: number; movies: number; unmatched: string[] }
  | { ok: false };

/**
 * 🆕 R281 — **استيرادُ Trakt بعد المفتاح، مرّةً واحدةً لقارئَين**: عودةُ الموقع (`/api/trakt/callback`، جلسةُ كوكي) ومسارُ
 * التطبيق (`/api/v1/me/import/trakt`، رمزُ Bearer). كان الجلبُ والكتابةُ داخل عودة الموقع وحدَها؛ ونسخةٌ ثانيةٌ للتطبيق تفترق
 * عنها يومَ يُصلَح شيءٌ في إحداهما (حلقاتُ السجلّ R278 · حمايةُ المكتبة R277 أمثلةٌ قريبة). `createClient` يقرأ الكوكي أو
 * الـBearer — فالقواعدُ نفسُها (RLS) تحرس الطريقين. والمفتاحُ يُلغى هنا في كلِّ حال: بعد الجلب أو عند فشله.
 */
export async function runTraktImport(token: string, userId: string): Promise<TraktRunResult> {
  let harvest;
  try {
    harvest = await harvestTrakt(token);
  } catch {
    await traktRevoke(token);
    return { ok: false };
  }
  /* 🆕 R273 — المفتاحُ لا يلزم بعد الجلب: يُلغى الآن فلا يشغل «التطبيقَ الواحد» المسموحَ للحساب المجانيّ في Trakt */
  await traktRevoke(token);

  const supabase = await createClient();
  // ختمٌ واحد يحلّ محلّ التاريخ الغائب — انظر السبب في applyImportChunk
  const stamp = new Date().toISOString();
  const shows = harvest.shows.slice(0, IMPORT_CAPS.shows);
  const movies = harvest.movies.slice(0, IMPORT_CAPS.movies);

  /* الأخطاءُ تُسجَّل باسم الجدول ورمزِ الخطأ فقط — كانت حلقاتُ «ONE PIECE» تسقط صامتةً (أحمد ١٩ نوفمبر).
     `||` لا `??`: خطأُ الشبكة في postgrest-js يحمل رمزاً فارغاً */
  const logErr = (table: string, error: { code?: string } | null) => {
    if (error) console.error(`[trakt] import ${table} failed: ${error.code || "unknown"}`);
  };

  /* 🆕 R277 — ما في المكتبة يُقرأ أوّلاً كي لا يُكتب فوقه: الصفُّ الموجود (اسمُه وملصقُه وحالتُه) وتقييمُ Loopz يبقيان.
     تُقرأ المكتبةُ كلُّها لا بقائمة معرّفات (آلافُها في رابط PostgREST تتجاوز حدَّ طوله)، **وعلى صفحات**: PostgREST
     يقطع الطلبَ عند ألف صفّ مهما كان `limit`، فكان ما بعد الألف يُحسب جديداً ولا يُعبّأ ملصقُه (مراجعة الوكيل) */
  const readAll = async <T,>(
    table: string,
    page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>,
  ): Promise<T[]> => {
    const out: T[] = [];
    for (let from = 0; from < 50_000; from += 1000) {
      const { data, error } = await page(from, from + 999);
      logErr(`${table}-read`, error);
      if (!data?.length) break;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  };
  const [libRows, ratedRows] = await Promise.all([
    readAll("follows", (a, b) =>
      supabase.from("follows").select("tmdb_id, media_type, poster_path").eq("user_id", userId).order("id").range(a, b),
    ),
    readAll("ratings", (a, b) =>
      supabase.from("ratings").select("tmdb_id, media_type").eq("user_id", userId).order("tmdb_id").order("media_type").range(a, b),
    ),
  ]);
  const lib = {
    follows: new Map(
      (libRows ?? []).map((r) => [traktKey(r.media_type as TraktKind, r.tmdb_id), { hasPoster: !!r.poster_path }]),
    ),
    rated: new Set((ratedRows ?? []).map((r) => traktKey(r.media_type as TraktKind, r.tmdb_id))),
  };
  const plan = planTraktImport({ shows, movies }, lib);

  /* 🆕 R277 — الملصقُ والاسمُ من TMDB وقتَ الاستيراد: التطبيقُ لا يشغّل مزامنةَ المكتبة التي كانت تعبّئهما في الموقع،
     فبقيت أعمالُ Trakt بلا صورٍ فيه. عشرةٌ عشرةٌ بحدِّ `TRAKT_POSTER_CAP`، والباقي تعبّئه المزامنةُ كما كانت */
  const { getTv, getMovie } = await import("@/lib/tmdb");
  const meta = new Map<string, { title: string; poster: string | null }>();
  for (let i = 0; i < plan.posters.length; i += 10) {
    await Promise.all(
      plan.posters.slice(i, i + 10).map(async (p) => {
        try {
          const d = p.kind === "tv" ? await getTv(p.tmdbId) : await getMovie(p.tmdbId);
          const title = "name" in d ? d.name : "title" in d ? d.title : "";
          meta.set(traktKey(p.kind, p.tmdbId), { title: String(title ?? ""), poster: safeImagePath(d.poster_path ?? null) });
        } catch {
          /* عملٌ لا يجيب عنه TMDB الآن: يدخل باسم Trakt وتعبّئه المزامنة */
        }
      }),
    );
  }

  const addRows = plan.add.map((a) => {
    const m = meta.get(traktKey(a.kind, a.tmdbId));
    return {
      user_id: userId,
      tmdb_id: a.tmdbId,
      media_type: a.kind,
      title: (m?.title || a.title).slice(0, 300),
      poster_path: m?.poster ?? null,
    };
  });
  /* دفعةٌ فاشلة تُعاد صفّاً صفّاً كي لا يُسقط صفٌّ واحدٌ معطوب ٤٩٩ غيرَه، وما فشل نهائياً لا تُكتب مشاهداتُه ولا
     تقييمُه — مشاهدةٌ بلا صفٍّ في المكتبة لا تظهر لصاحبها (مراجعة الوكيل) */
  const failed = new Set<string>();
  const upsertFollows = (rows: typeof addRows) =>
    supabase.from("follows").upsert(rows, { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true });
  for (let i = 0; i < addRows.length; i += 500) {
    const batch = addRows.slice(i, i + 500);
    const { error } = await upsertFollows(batch);
    if (!error) continue;
    logErr("follows", error);
    for (const row of batch) {
      const { error: e1 } = await upsertFollows([row]);
      if (e1) failed.add(traktKey(row.media_type, row.tmdb_id));
    }
  }
  if (failed.size) console.error(`[trakt] import follows dropped: ${failed.size}`);
  // موجودٌ بلا ملصق (استيرادٌ سابق) ⇐ يُعبّأ ملصقُه وحدَه، ولا يُمسّ غيرُه
  for (const p of plan.posters.filter((x) => !x.isNew)) {
    const poster = meta.get(traktKey(p.kind, p.tmdbId))?.poster;
    if (!poster) continue;
    const { error } = await supabase
      .from("follows")
      .update({ poster_path: poster })
      .match({ user_id: userId, tmdb_id: p.tmdbId, media_type: p.kind })
      .is("poster_path", null);
    logErr("follows-poster", error);
  }

  /* المشاهداتُ تُضاف وما سجّله العضو يبقى بتاريخه (`ignoreDuplicates`). والتكرارُ يُطوى قبل الكتابة: حلقةٌ تتكرّر
     في ردّ Trakt (أو مسلسلٌ مكرّر) كانت تُسقط الدفعةَ كلَّها بـ«cannot affect row a second time» */
  const epSeen = new Set<string>();
  const noEps = shows.filter((sh) => sh.episodes.length === 0).length;
  const epRows = shows.filter((sh) => !failed.has(traktKey("tv", sh.tmdbId))).flatMap((sh) =>
    sh.episodes.slice(0, IMPORT_CAPS.episodesPerShow).map((ep) => ({
      user_id: userId,
      show_tmdb_id: sh.tmdbId,
      season_number: ep.s,
      episode_number: ep.e,
      runtime: null as number | null,
      watched_at: ep.at ?? stamp,
    })),
  ).filter((r) => {
    const k = `${r.show_tmdb_id}-${r.season_number}-${r.episode_number}`;
    if (epSeen.has(k)) return false;
    epSeen.add(k);
    return true;
  });
  let episodes = 0;
  for (let i = 0; i < epRows.length; i += 500) {
    const slice = epRows.slice(i, i + 500);
    // `count` يعدّ ما أُدخل فعلاً — المكرّرُ المتجاهَل لا يُحسب، فإعادةُ الاستيراد لا تدّعي حلقاتٍ جديدة
    const { error, count } = await supabase.from("watched_episodes").upsert(slice, {
      onConflict: "user_id,show_tmdb_id,season_number,episode_number",
      ignoreDuplicates: true,
      count: "exact",
    });
    logErr("watched_episodes", error);
    if (!error) episodes += count ?? 0;
  }

  const mvSeen = new Set<number>();
  const mvRows = movies
    .filter((mv) => {
      if (failed.has(traktKey("movie", mv.tmdbId)) || mvSeen.has(mv.tmdbId)) return false;
      mvSeen.add(mv.tmdbId);
      return true;
    })
    .map((mv) => ({
    user_id: userId,
    movie_tmdb_id: mv.tmdbId,
    runtime: null as number | null,
    watched_at: mv.at ?? stamp,
  }));
  for (let i = 0; i < mvRows.length; i += 500) {
    const { error } = await supabase
      .from("watched_movies")
      .upsert(mvRows.slice(i, i + 500), { onConflict: "user_id,movie_tmdb_id", ignoreDuplicates: true });
    logErr("watched_movies", error);
  }

  // تقييمُ Trakt لما لا تقييمَ له في Loopz فقط — و`ignoreDuplicates` يحمي من تقييمٍ كُتب بين القراءة والكتابة
  const rateRows = plan.rate.filter((r) => !failed.has(traktKey(r.kind, r.tmdbId))).map((r) => {
    const m = meta.get(traktKey(r.kind, r.tmdbId));
    return {
      user_id: userId,
      tmdb_id: r.tmdbId,
      media_type: r.kind,
      rating: r.rating,
      review: null,
      title: (m?.title || r.title).slice(0, 300),
      poster_path: m?.poster ?? null,
      updated_at: stamp,
    };
  });
  for (let i = 0; i < rateRows.length; i += 500) {
    const { error } = await supabase
      .from("ratings")
      .upsert(rateRows.slice(i, i + 500), { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true });
    logErr("ratings", error);
  }

  const showCount = new Set(shows.map((s) => s.tmdbId)).size;
  const movieCount = new Set(movies.map((m) => m.tmdbId)).size;
  // أعدادٌ فقط — ما وصل من Trakt مقابل ما كُتب، كي يُرى أين يضيع شيء
  console.log(
    `[trakt] import: shows=${showCount} movies=${movieCount} eps=${epRows.length}/${episodes} noEps=${noEps} new=${plan.add.length} posters=${meta.size}/${plan.posters.length} rated=${plan.rate.length} unmatched=${harvest.unmatched.length} fromHistory=${harvest.fromHistory}`,
  );

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/stats");
  revalidatePath("/diary");

  return { ok: true, shows: showCount, episodes, movies: movieCount, unmatched: harvest.unmatched };
}
