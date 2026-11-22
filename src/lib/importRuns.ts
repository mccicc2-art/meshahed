import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanImportRunSummary, planReviewWrites, type ExistingRating, type ImportRun, type ReviewPlanItem } from "@/core/importer";
import { safeImagePath } from "@/lib/watchMark";

/*
 * 🆕 T507 — **سجلُّ الاستيراد على الخادم** (`import_runs`، هجرة ٢٥٧). خارج `actions.ts` عمداً: كلُّ ما يُصدَّر من ملفّ
 * `"use server"` يصير فعلاً يناديه المتصفّح، وهاتان الدالّتان تأخذان عميلَ القاعدة ومعرّفَ الصاحب من مناديهما الموثوق —
 * فعلُ الويب (`finishImport` · `listImportRuns`) وطرقُ التطبيق وTrakt.
 */

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * سطرٌ لاستيرادٍ انتهى أو أُوقف — `userId` من جلسةٍ تحقّق منها المنادي (`requireUser`). ملخّصٌ غائبٌ أو مصدرٌ لا نعرفه ⇐ لا سطر (تطبيقٌ قديمٌ يرسل `{}`).
 * **وفشلُ الكتابة لا يُفشل الاستيراد**: ما كُتب في المكتبة كُتب، والسجلُّ ثانويٌّ عنه — يُسجَّل رمزُ الخطأ وحده.
 * والسطحُ (`platform`) يقوله الطريقُ الذي جاء منه النداء، لا العميل.
 */
export async function recordImportRun(userId: string, summary: unknown, platform: "web" | "app"): Promise<void> {
  const run = cleanImportRunSummary(summary);
  if (!run) return;
  try {
    /* **بعميل الخدمة**: الجدولُ لا يمنح `insert` لأحد (هجرة ٢٥٧) — منحُه كان يفتح لكلِّ عضوٍ أن يكتب فيه من PostgREST ما شاء
       متخطّياً التنقيةَ أعلاه. والمعرّفُ من الجلسة الموثوقة لمناديها، لا من الجسم */
    const db = await createServiceClient();
    const { error } = await db.from("import_runs").insert({
      user_id: userId,
      source: run.source,
      platform,
      status: run.status,
      shows: run.shows,
      episodes: run.episodes,
      movies: run.movies,
      reviews: run.reviews,
      unmatched: run.unmatched,
      headers: run.headers ?? null,
    });
    if (error) console.error(`[import] run log failed: ${error.code || "unknown"}`);
  } catch {
    console.error("[import] run log failed: network");
  }
}

/** آخرُ خمسين بأحدثها. غيابُ الجدول (قبل الهجرة) أو خطأٌ ⇐ قائمةٌ فارغة: الصفُّ لا يظهر، والصفحةُ لا تسقط */
export async function readImportRuns(supabase: Db, userId: string): Promise<ImportRun[]> {
  const { data, error } = await supabase
    .from("import_runs")
    .select("id, source, platform, status, shows, episodes, movies, reviews, unmatched, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error(`[import] runs read failed: ${error.code || "unknown"}`);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    source: r.source as ImportRun["source"],
    platform: r.platform === "app" ? "app" : "web",
    status: r.status === "cancelled" ? "cancelled" : "done",
    shows: r.shows ?? 0,
    episodes: r.episodes ?? 0,
    movies: r.movies ?? 0,
    reviews: r.reviews ?? 0,
    unmatched: r.unmatched ?? 0,
    createdAt: String(r.created_at),
  }));
}

/* ============================================================
   🆕 T507 — كتابةُ الآراء المستوردة (ملفّات الاستيراد وTrakt — طريقٌ واحد)
   ============================================================ */

export type ReviewItem = ReviewPlanItem & { title: string; posterPath: string | null };

/** خطأُ «لا عمودَ بهذا الاسم» — الكودُ نُشر قبل هجرة ٢٥٨ (PostgREST · Postgres) */
const missingColumn = (code: string | undefined) => code === "PGRST204" || code === "42703";

/**
 * يكتب آراءَ الدفعة بجلسة صاحبها (سياساتُ `ratings` نفسُها تحرس)، بحكم `planReviewWrites` (أحمد ٢٢ نوفمبر · مراجعتا الوكيلين).
 * 🔴 **التقييمُ لا يضيع مهما حدث للرأي** (مراجعةُ الوكيل الثاني، البند ١): كودٌ نُشر قبل هجرة ٢٥٨ يُرفض طلبُه لأنّ `imported_from`
 * غائب — فتُكتب التقييماتُ وحدها كما كانت تُكتب قبل T507، والآراءُ تُعدّ «لم تُستورد». والشرطُ في كتابة الملء نفسِها (`review`
 * فارغ) فلا يدهس رأياً كُتب بين القراءة والكتابة.
 */
export async function writeImportedReviews(
  supabase: Db,
  userId: string,
  items: ReviewItem[],
  stamp: string,
  /** مصدرُ الآراء — يُكتب في `ratings.imported_from` (هجرة ٢٥٨) فتستثنيها دوالُّ النشاط والمجتمع و«أفضل الأسبوع» */
  from: "letterboxd" | "trakt" | "auto",
): Promise<{ reviews: number; reviewsSkipped: number; reviewsKept: number }> {
  const withReview = items.filter((it) => it.review);
  if (!withReview.length) return { reviews: 0, reviewsSkipped: 0, reviewsKept: 0 };

  const { data: existing, error: readErr } = await supabase
    .from("ratings")
    .select("tmdb_id, media_type, rating, review, updated_at")
    .eq("user_id", userId)
    .in("tmdb_id", [...new Set(withReview.map((it) => it.tmdbId))]);
  if (readErr) {
    console.error(`[import] reviews read failed: ${readErr.code || "unknown"}`);
    return { reviews: 0, reviewsSkipped: withReview.length, reviewsKept: 0 };
  }
  const plan = planReviewWrites(withReview, (existing ?? []) as ExistingRating[], stamp);
  const meta = new Map(withReview.map((it) => [`${it.kind}-${it.tmdbId}`, it]));
  let reviews = 0;
  let reviewsSkipped = plan.skipped;
  let reviewsKept = plan.kept;

  if (plan.fresh.length) {
    const base = (it: (typeof plan.fresh)[number]) => ({
      user_id: userId,
      tmdb_id: it.tmdbId,
      media_type: it.kind,
      rating: it.rating,
      title: String(meta.get(`${it.kind}-${it.tmdbId}`)?.title ?? "").slice(0, 300),
      poster_path: safeImagePath(meta.get(`${it.kind}-${it.tmdbId}`)?.posterPath ?? null),
    });
    /* `ignoreDuplicates`: تقييمٌ كُتب في Loopz بين القراءة والكتابة يبقى — والمكتوبُ يُعدّ بما أعادته القاعدة لا بما أُرسل */
    const { data, error } = await supabase
      .from("ratings")
      .upsert(
        plan.fresh.map((it) => ({
          ...base(it),
          review: it.review.text,
          has_spoiler: it.review.spoiler,
          imported_from: from,
          created_at: it.review.at,
          updated_at: it.review.at,
        })),
        { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
      )
      .select("tmdb_id");
    if (!error) {
      reviews += data?.length ?? 0;
      reviewsKept += plan.fresh.length - (data?.length ?? 0);
    } else {
      console.error(`[import] reviews write failed: ${error.code || "unknown"}`);
      reviewsSkipped += plan.fresh.length;
      if (missingColumn(error.code)) {
        /* قبل الهجرة: التقييمُ وحده، بختم الدفعة كما كان قبل T507 */
        const { error: e2 } = await supabase
          .from("ratings")
          .upsert(
            plan.fresh.map((it) => ({ ...base(it), review: null, updated_at: stamp })),
            { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
          );
        if (e2) console.error(`[import] ratings fallback failed: ${e2.code || "unknown"}`);
      }
    }
  }

  /* الملءُ دفعاتٍ متوازيةً بعشرة — لا ستّين طلباً واحداً بعد واحد (مراجعةُ الوكيل الثاني، البند ٩) */
  for (let i = 0; i < plan.fills.length; i += 10) {
    const done = await Promise.all(
      plan.fills.slice(i, i + 10).map(async ({ item, at }) => {
        const { data, error } = await supabase
          .from("ratings")
          .update({ review: item.review.text, has_spoiler: item.review.spoiler, imported_from: from, updated_at: at })
          .match({ user_id: userId, tmdb_id: item.tmdbId, media_type: item.kind })
          .or("review.is.null,review.eq.")
          .select("tmdb_id");
        if (error) {
          console.error(`[import] review fill failed: ${error.code || "unknown"}`);
          return "skipped" as const;
        }
        return data?.length ? ("written" as const) : ("kept" as const);
      }),
    );
    for (const d of done) {
      if (d === "written") reviews++;
      else if (d === "kept") reviewsKept++;
      else reviewsSkipped++;
    }
  }
  return { reviews, reviewsSkipped, reviewsKept };
}
