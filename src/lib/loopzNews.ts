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

export type NewsKind = "trailer" | "date" | "season" | "status" | "episode";

export interface Snapshot {
  tmdb_id: number;
  media_type: "tv" | "movie";
  status: string | null;
  release_date: string | null;
  next_air_date: string | null;
  seasons: number | null;
  trailer_key: string | null;
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
): Promise<{ snap: Snapshot; title: string; poster: string | null } | null> {
  try {
    const { getTv, getMovie, getTrailer } = await import("@/lib/tmdb");
    if (mediaType === "tv") {
      const tv = await getTv(tmdbId);
      const trailer = await getTrailer("tv", tmdbId).catch(() => null);
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
        },
      };
    }
    const mv = await getMovie(tmdbId);
    const trailer = await getTrailer("movie", tmdbId).catch(() => null);
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
  if (!before) return [];
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
  if (after.release_date && after.release_date !== before.release_date) {
    const future = after.release_date >= new Date().toISOString().slice(0, 10);
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

  /* ٥) موعدُ الحلقة القادمة حين يتحدّد بعد انقطاع — **لا مع كل حلقة**:
     مسلسلٌ أسبوعيّ كان سيعطي خبراً كلَّ أسبوع لكل عمل. الشرطُ أن يكون
     الموعدُ غائباً قبلَه. */
  if (after.media_type === "tv" && after.next_air_date && !before.next_air_date) {
    out.push({
      ...base,
      kind: "episode",
      key: `episode:${id}:${after.next_air_date}`,
      data: { date: after.next_air_date },
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
  const rows = (slice ?? []) as { tmdb_id: number; media_type: "tv" | "movie" }[];
  if (!rows.length) return { checked: 0, posts: 0, snapshots: 0 };

  const keys = rows.map((r) => r.tmdb_id);
  const { data: prevRows } = await supabase
    .from("title_snapshots")
    .select("tmdb_id, media_type, status, release_date, next_air_date, seasons, trailer_key")
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
      rows.slice(i, i + CHUNK).map((r) => readTitle(r.tmdb_id, r.media_type)),
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
