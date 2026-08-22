import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/data";

/**
 * **نشاطُك أنت — أربعةُ مصادرَ في خيطٍ واحد** (D-537، تصميمُ أحمد).
 *
 * ================= ولماذا ملفٌّ لا دالّةٌ في `data.ts` =================
 *
 * `data.ts` يقارب المئة كيلوبايت، **وكلُّ تعديلٍ فيه يرفع الملفَّ كلَّه
 * ويخاطر بما لا علاقةَ له بالجولة** (سقفُ الرفع وقاعدةُ المقارنة
 * البايتيّة في `19`). **وهذه قراءةٌ واحدةٌ لسطحٍ واحد** — فبيتُها ملفُّها.
 *
 * ================= ولماذا لا دالّةَ SQL جديدة =================
 *
 * **`following_activity_v2` تجيب سؤالاً آخر**: «ماذا فعل من أتابعهم؟» —
 * **وهي مجمَّعةٌ ومرشَّحةٌ بمن تتابع**، فلا تصلح لسؤال «ماذا فعلتُ أنا؟».
 * **وأربعةُ استعلاماتٍ متوازيةٍ على جداولَ مفهرسةٍ بمالكها أرخصُ من
 * هجرةٍ ودالّةٍ تُصان** (القاعدة ١٠: لا هجرةَ بلا أثرٍ مثبت) — **والدمجُ
 * والفرزُ عملُ صفحةٍ لا عملُ قاعدة.**
 *
 * ⚠️ **والحارسُ RLS كما هو**، **وشرطُ المالك مكتوبٌ في الاستعلام أيضاً**
 * — دفاعٌ طبقتان لا واحدة (سابقةُ `getWatchHistory`).
 */

/** ما جرى — أربعةُ أفعالٍ لا أكثر */
export type ActivityKind = "watch" | "rate" | "review" | "list";

export interface ActivityRow {
  kind: ActivityKind;
  /** لحظةُ الفعل — ISO */
  at: string;
  mediaType: "tv" | "movie";
  tmdbId: number;
  /** ما نعرفه من الاسم والملصق وقتَ الكتابة — قد يغيب فتكمله الصفحة */
  title: string | null;
  posterPath: string | null;
  /** الحلقة — للمشاهدة التلفزيونيّة وحدَها */
  season?: number | null;
  episode?: number | null;
  /** التقييم من عشرة — للتقييم والرأي */
  rating?: number | null;
  /** اسمُ القائمة — للإضافة وحدَها */
  listName?: string | null;
}

interface EpRow {
  show_tmdb_id: number;
  season_number: number | null;
  episode_number: number | null;
  watched_at: string;
}
interface MovieRow {
  movie_tmdb_id: number;
  watched_at: string;
}
interface RateRow {
  tmdb_id: number;
  media_type: string;
  rating: number | null;
  review: string | null;
  title: string | null;
  poster_path: string | null;
  created_at: string;
  updated_at: string | null;
}
interface ItemRow {
  list_id: string;
  tmdb_id: number;
  media_type: string;
  title: string | null;
  poster_path: string | null;
  added_at: string;
}

/**
 * **آخرُ ما فعلتَه، مفروزاً بالزمن.**
 *
 * **والسقفُ لكلِّ مصدرٍ لا للمجموع**: من أشّر مئةَ حلقةٍ أمس **لا يبتلع
 * تقييماتِه** — **وسقفٌ واحدٌ على المجموع كان سيجعل الشاشةَ تعرض نوعاً
 * واحداً** ويظنّ القارئُ أنه لم يفعل غيره.
 */
export async function getMyActivity(perSource = 200): Promise<ActivityRow[]> {
  try {
    const supabase = await createClient();
    const uid = await getUserId();
    if (!uid) return [];

    /* **قوائمي أوّلاً**: `user_list_items` لا تحمل `user_id` — حارسُها
       قائمتُها. **فالمعرّفاتُ تُقرأ ثم تُسأل بها الصفوف**، ولا تُبنى
       علاقةٌ مضمّنة يصعب قراءةُ خطّتها. */
    const listRows = await supabase
      .from("user_lists")
      .select("id, name")
      .eq("user_id", uid);
    const listName = new Map<string, string>(
      ((listRows.data ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name]),
    );
    const listIds = [...listName.keys()];

    const [eps, movies, rates, items] = await Promise.all([
      supabase
        .from("watched_episodes")
        .select("show_tmdb_id, season_number, episode_number, watched_at")
        .eq("user_id", uid)
        .order("watched_at", { ascending: false })
        .limit(perSource),
      supabase
        .from("watched_movies")
        .select("movie_tmdb_id, watched_at")
        .eq("user_id", uid)
        .order("watched_at", { ascending: false })
        .limit(perSource),
      supabase
        .from("ratings")
        .select("tmdb_id, media_type, rating, review, title, poster_path, created_at, updated_at")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(perSource),
      listIds.length
        ? supabase
            .from("user_list_items")
            .select("list_id, tmdb_id, media_type, title, poster_path, added_at")
            .in("list_id", listIds)
            .order("added_at", { ascending: false })
            .limit(perSource)
        : Promise.resolve({ data: [] as ItemRow[] }),
    ]);

    const out: ActivityRow[] = [];

    for (const e of (eps.data ?? []) as EpRow[]) {
      out.push({
        kind: "watch",
        at: e.watched_at,
        mediaType: "tv",
        tmdbId: e.show_tmdb_id,
        title: null,
        posterPath: null,
        season: e.season_number,
        episode: e.episode_number,
      });
    }

    for (const m of (movies.data ?? []) as MovieRow[]) {
      out.push({
        kind: "watch",
        at: m.watched_at,
        mediaType: "movie",
        tmdbId: m.movie_tmdb_id,
        title: null,
        posterPath: null,
      });
    }

    /* 🔑 **صفٌّ واحدٌ لا صفّان**: الجدولُ يخزّن التقييمَ والرأيَ معاً،
       **وسطران بالطابع الزمنيّ نفسِه يُقرآن تكراراً لا فعلين.**
       **فمن كتب رأياً فهو «راجَع»، ومن اكتفى بالنجمة فهو «قيّم»** —
       **والرقاقتان تريان الصفَّ نفسَه من بابين** (رأيٌ له نجمةٌ يظهر
       تحت «تقييمات» أيضاً، وهو صادق). */
    for (const r of (rates.data ?? []) as RateRow[]) {
      const hasReview = !!r.review?.trim();
      if (!hasReview && !r.rating) continue;
      out.push({
        kind: hasReview ? "review" : "rate",
        /* **آخرُ لمسةٍ لا أوّلُها**: من عدّل تقييمَه اليوم فعل شيئاً
           اليوم — **والصفُّ يقول متى صار على ما هو عليه.** */
        at: r.updated_at ?? r.created_at,
        mediaType: r.media_type === "tv" ? "tv" : "movie",
        tmdbId: r.tmdb_id,
        title: r.title,
        posterPath: r.poster_path,
        rating: r.rating,
      });
    }

    for (const it of (items.data ?? []) as ItemRow[]) {
      out.push({
        kind: "list",
        at: it.added_at,
        mediaType: it.media_type === "tv" ? "tv" : "movie",
        tmdbId: it.tmdb_id,
        title: it.title,
        posterPath: it.poster_path,
        listName: listName.get(it.list_id) ?? null,
      });
    }

    out.sort((a, b) => b.at.localeCompare(a.at));
    return out;
  } catch {
    /* **وسقوطُها شاشةٌ فارغةٌ لا شاشةُ خطأ** (سابقةُ `getLibState`) */
    return [];
  }
}
