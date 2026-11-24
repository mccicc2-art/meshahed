import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { safeImagePath } from "@/lib/watchMark";
import { FIX_CAP, planImportFixes, type FixItem, type FixPair } from "@/core/importFix";

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * 🆕 T537 — قراءةُ ما يقرّر التصحيح وكتابتُه — **بجلسة العضو** (RLS تحرس صفوفَه)، والقرارُ نقيٌّ في `core/importFix`.
 * الأزواجُ تأتي من العميل فلا تُصدَّق: الشروطُ تُعاد على الخادم عند العرض وعند التصحيح كليهما.
 */

/** الأزواجُ منقّاةً: أعدادٌ صحيحة، اسمٌ مقصوص، ملصقٌ آمن، وبالسقف */
export function cleanFixPairs(raw: unknown): FixPair[] {
  if (!Array.isArray(raw)) return [];
  const out: FixPair[] = [];
  for (const p of raw.slice(0, FIX_CAP)) {
    const r = p as Record<string, unknown>;
    const wrongId = Number(r?.wrongId);
    const rightId = Number(r?.rightId);
    if (!Number.isInteger(wrongId) || !Number.isInteger(rightId) || wrongId <= 0 || rightId <= 0) continue;
    out.push({
      wrongId,
      rightId,
      rightTitle: typeof r?.rightTitle === "string" ? r.rightTitle.slice(0, 300) : "",
      rightPoster: safeImagePath(typeof r?.rightPoster === "string" ? r.rightPoster : null),
    });
  }
  return out;
}

/** ما يُعرض للتصحيح — الشروطُ الثلاثة على صفوفه هو */
export async function findImportFixes(supabase: Db, userId: string, pairs: FixPair[]): Promise<FixItem[]> {
  if (!pairs.length) return [];
  const wrongIds = [...new Set(pairs.map((p) => p.wrongId))];
  const rightIds = [...new Set(pairs.map((p) => p.rightId))];
  const [runs, follows, lists, art, likes, replies, wrongRatings, rightRatings] = await Promise.all([
    supabase.from("import_runs").select("created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabase.from("follows").select("tmdb_id, added_at, title").eq("user_id", userId).eq("media_type", "movie").in("tmdb_id", wrongIds),
    supabase.from("user_list_items").select("tmdb_id").eq("added_by", userId).eq("media_type", "movie").in("tmdb_id", wrongIds),
    supabase.from("title_art").select("tmdb_id").eq("user_id", userId).eq("media_type", "movie").in("tmdb_id", wrongIds),
    supabase.from("review_likes").select("tmdb_id").eq("review_user_id", userId).eq("media_type", "movie").in("tmdb_id", wrongIds),
    supabase.from("review_replies").select("tmdb_id").eq("review_user_id", userId).eq("media_type", "movie").in("tmdb_id", wrongIds),
    supabase.from("ratings").select("tmdb_id, updated_at").eq("user_id", userId).eq("media_type", "movie").in("tmdb_id", wrongIds),
    supabase.from("ratings").select("tmdb_id").eq("user_id", userId).eq("media_type", "movie").in("tmdb_id", rightIds),
  ]);
  /* قراءةٌ فشلت ⇐ لا عرض: الشكُّ يُترك لا يُصحَّح */
  for (const r of [runs, follows, lists, art, likes, replies, wrongRatings, rightRatings]) {
    if (r.error) {
      console.error(`[import-fix] read failed: ${r.error.code || "unknown"}`);
      return [];
    }
  }
  const touched = new Set<number>();
  for (const rows of [lists.data, art.data, likes.data, replies.data]) for (const r of rows ?? []) touched.add(Number(r.tmdb_id));
  return planImportFixes(pairs, {
    runs: (runs.data ?? []).map((r) => String(r.created_at)),
    wrongFollows: new Map((follows.data ?? []).map((f) => [Number(f.tmdb_id), { addedAt: String(f.added_at), title: String(f.title ?? "") }])),
    touched,
    wrongRatings: new Map((wrongRatings.data ?? []).map((r) => [Number(r.tmdb_id), { updatedAt: r.updated_at ? String(r.updated_at) : null }])),
    rightRated: new Set((rightRatings.data ?? []).map((r) => Number(r.tmdb_id))),
  });
}

/**
 * التصحيح: لكلِّ زوجٍ يمرّ الشروطَ من جديد — العملُ الصحيحُ يدخل المكتبةَ بوقت إضافة الخطأ، ومشاهداتُه تنتقل بتواريخها،
 * وتقييمُه ورأيُه بتاريخهما وعلامة استيرادهما (فلا يدخل نشاطَ الأصدقاء)، ثمّ يُحذف الخطأ. خطوةٌ تفشل توقف زوجَها قبل الحذف.
 */
export async function applyImportFixes(supabase: Db, userId: string, pairs: FixPair[]): Promise<{ fixed: number; failed: number }> {
  const items = await findImportFixes(supabase, userId, pairs);
  let fixed = 0;
  let failed = 0;
  for (const it of items) {
    const ok = await fixOne(supabase, userId, it).catch(() => false);
    if (ok) fixed++;
    else failed++;
  }
  return { fixed, failed };
}

async function fixOne(supabase: Db, userId: string, it: FixItem): Promise<boolean> {
  const log = (step: string, e: { code?: string } | null) => {
    if (e) console.error(`[import-fix] ${step} failed: ${e.code || "unknown"}`);
    return !e;
  };
  const wrong = { user_id: userId, tmdb_id: it.wrongId, media_type: "movie" };

  const { data: f, error: fe } = await supabase.from("follows").select("added_at").match(wrong).maybeSingle();
  if (!log("read follow", fe) || !f) return false;
  const { error: e1 } = await supabase.from("follows").upsert(
    { user_id: userId, tmdb_id: it.rightId, media_type: "movie", title: it.rightTitle || it.wrongTitle, poster_path: it.rightPoster, added_at: f.added_at },
    { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
  );
  if (!log("follow", e1)) return false;

  const { data: watches, error: we } = await supabase.from("watched_movies").select("watched_at, runtime, source").eq("user_id", userId).eq("movie_tmdb_id", it.wrongId);
  if (!log("read watches", we)) return false;
  if (watches?.length) {
    const { error: e2 } = await supabase.from("watched_movies").upsert(
      watches.map((w) => ({ user_id: userId, movie_tmdb_id: it.rightId, watched_at: w.watched_at, runtime: w.runtime, source: w.source ?? "import" })),
      { onConflict: "user_id,movie_tmdb_id", ignoreDuplicates: true },
    );
    if (!log("watches", e2)) return false;
  }

  const { data: r, error: re } = await supabase
    .from("ratings")
    .select("rating, review, has_spoiler, imported_from, created_at, updated_at, hidden")
    .match(wrong)
    .maybeSingle();
  if (!log("read rating", re)) return false;
  if (r) {
    const { error: e3 } = await supabase.from("ratings").upsert(
      {
        user_id: userId,
        tmdb_id: it.rightId,
        media_type: "movie",
        rating: r.rating,
        review: r.review,
        has_spoiler: r.has_spoiler,
        imported_from: r.imported_from,
        hidden: r.hidden,
        created_at: r.created_at,
        updated_at: r.updated_at,
        title: it.rightTitle || it.wrongTitle,
        poster_path: it.rightPoster,
      },
      { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
    );
    if (!log("rating", e3)) return false;
    const { error: d3 } = await supabase.from("ratings").delete().match(wrong);
    if (!log("delete rating", d3)) return false;
  }

  const { error: d2 } = await supabase.from("watched_movies").delete().eq("user_id", userId).eq("movie_tmdb_id", it.wrongId);
  if (!log("delete watches", d2)) return false;
  const { error: d1 } = await supabase.from("follows").delete().match(wrong);
  return log("delete follow", d1);
}
