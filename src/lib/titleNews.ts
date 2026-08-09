import { getFollows, getFollowedArtists, getWatchedMovieIds } from "@/lib/data";
import { getPersonCredits, titleOf, yearOf, type SearchResult } from "@/lib/tmdb";

/**
 * «أخبار أعمالك» — التبويب الرابع في المجتمع (طلب أحمد، D-134/D-137).
 *
 * **«ذكيّة حسب اهتمامي» تعني مصدرَ الخبر لا خوارزميةَ ترشيح:** كل سطرٍ
 * هنا عن عملٍ **في مكتبتك** أو فنّانٍ **تتابعه أنت**. لا شيء عامّ، ولا
 * «الأكثر رواجاً»، ولا خبرٌ عن عملٍ لا تعرفه — تلك صفحة اكتشف ولها
 * مكانها. الخبر الذي لا يخصّك ليس خبراً، هو ضجيج.
 *
 * **وبلا مصدرٍ جديد ولا هجرة:** ثلاثة أرباع الأخبار مقروءةٌ من صفوف
 * `follows` المخزَّنة أصلاً (`next_air_date` يحمل موعد الحلقة القادمة
 * للمسلسل وتاريخ الصدور للفيلم — انظر `actions.ts`)، فالتبويب لا يفتح
 * اتصالاً واحداً مع TMDB لأجلها. القسم الوحيد الذي يكلّف نداءات هو
 * «جديد فنّانيك»، وسقفه معلَنٌ أدناه.
 */

/** نافذة الماضي: خبرٌ أقدم من هذا لم يعد خبراً */
const PAST_DAYS = 21;
/** نافذة المستقبل: أبعد من هذا انتظارٌ لا خبر */
const FUTURE_DAYS = 120;
/**
 * كم فنّاناً يُسأل عن جديده.
 *
 * **سقفٌ معلَن لا صامت** (نفس قاعدة `artists.ts`): نداء
 * `combined_credits` لكل فنان. اثنا عشر أحدثَ متابعةً حدُّ ما يُدفع
 * لتبويبٍ يُفتح قصداً؛ ومن بعدهم لا يظهر جديدُه، وهذا مكتوبٌ هنا بدل
 * أن يُكتشف بالصدفة.
 */
const ARTIST_LOOKUPS = 12;
/** سقف الأسطر — القائمة الطويلة تُقرأ كأرشيف لا كأخبار */
const MAX_ITEMS = 40;

export type NewsKind =
  /** حلقةٌ تنزل اليوم */
  | "tonight"
  /** حلقةٌ قادمة */
  | "soon"
  /** حلقةٌ نزلت للتوّ */
  | "aired"
  /** فيلمٌ في مكتبتك صدر ولم تشاهده */
  | "released"
  /** فيلمٌ في مكتبتك لم يصدر بعد */
  | "upcoming"
  /** عملٌ جديد لفنّانٍ تتابعه */
  | "artist";

export interface NewsItem {
  key: string;
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  kind: NewsKind;
  /** اليوم بصيغة ISO — الواجهة تحوّله إلى «قبل يومين» أو «بعد أسبوع» */
  date: string;
  /** أهو موعدٌ قادم؟ يُحسم هنا لا في الرسم: قراءة الساعة أثناء الرسم
      تُنتج ناتجاً يختلف بين رسمتين، وقاعدة React تمنعها بحقّ */
  future: boolean;
  /** اسم الفنان — لأخبار `artist` وحدها */
  person?: string;
}

const DAY = 86_400_000;

/** فارق الأيام عن اليوم: موجبٌ للمستقبل، سالبٌ للماضي */
function daysFrom(today: number, iso: string): number | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.round((t - today) / DAY);
}

/**
 * **الترتيب: الأقرب إلى اليوم أوّلاً، والمستقبل يسبق الماضي عند التساوي.**
 *
 * لا «الأحدث أولاً» ولا «الأقرب موعداً أولاً» وحدهما: خبرُ اليوم أهمّ
 * من خبر الأسبوع الماضي وأهمّ من خبرٍ بعد شهرين، وكلاهما على مسافةٍ
 * واحدة من الآن. المسافةُ المطلقة هي ما يقيس «كم يعنيني الآن».
 */
function rank(a: NewsItem, b: NewsItem, today: number): number {
  const da = daysFrom(today, a.date) ?? 999;
  const db = daysFrom(today, b.date) ?? 999;
  return Math.abs(da) - Math.abs(db) || db - da;
}

export async function getTitleNews(): Promise<NewsItem[]> {
  const today = new Date().setHours(0, 0, 0, 0);
  const [follows, artists, watchedMovies] = await Promise.all([
    getFollows(),
    getFollowedArtists(ARTIST_LOOKUPS),
    getWatchedMovieIds(),
  ]);

  const out: NewsItem[] = [];
  /* ما في مكتبتك لا يُعاد عليك في «جديد فنّانيك»: أنت تعرفه، وتكراره
     يجعل التبويب يبدو ممتلئاً وهو فارغ */
  const known = new Set(follows.map((f) => `${f.media_type}-${f.tmdb_id}`));

  for (const f of follows) {
    // الموقوف عند صاحبه لا تصله أخباره — هذا معنى «أوقفتُه»
    if (f.dropped) continue;
    if (!f.next_air_date) continue;
    const d = daysFrom(today, f.next_air_date);
    if (d === null || d > FUTURE_DAYS || d < -PAST_DAYS) continue;

    let kind: NewsKind;
    if (f.media_type === "tv") {
      kind = d === 0 ? "tonight" : d > 0 ? "soon" : "aired";
    } else {
      /* الفيلم الذي صدر **وشاهدتَه** ليس خبراً — الخبر أن شيئاً ينتظرك */
      if (d <= 0 && watchedMovies.has(f.tmdb_id)) continue;
      kind = d > 0 ? "upcoming" : "released";
    }

    out.push({
      key: `f-${f.media_type}-${f.tmdb_id}`,
      tmdbId: f.tmdb_id,
      mediaType: f.media_type,
      title: f.title,
      posterPath: f.poster_path,
      kind,
      date: f.next_air_date,
      future: d > 0,
    });
  }

  /* جديد فنّانيك — القسم الوحيد الذي يكلّف نداءات. فنّانٌ فشل جلبه
     يسقط وحده ولا يُسقط التبويب */
  const credits = await Promise.all(
    artists.map(async (a) => {
      try {
        return { name: a.name, rows: await getPersonCredits(a.person_id) };
      } catch {
        return { name: a.name, rows: [] as SearchResult[] };
      }
    }),
  );

  const seen = new Set<string>();
  for (const { name, rows } of credits) {
    for (const r of rows) {
      const mt = r.media_type === "tv" ? "tv" : "movie";
      const key = `${mt}-${r.id}`;
      if (known.has(key) || seen.has(key)) continue;
      const when = r.release_date || r.first_air_date;
      if (!when) continue;
      const d = daysFrom(today, when);
      if (d === null || d > FUTURE_DAYS || d < -PAST_DAYS) continue;
      seen.add(key);
      out.push({
        key: `a-${key}`,
        tmdbId: r.id,
        mediaType: mt,
        title: titleOf(r) || String(yearOf(r)),
        posterPath: r.poster_path ?? null,
        kind: "artist",
        date: when,
        future: d > 0,
        person: name ?? undefined,
      });
    }
  }

  return out.sort((a, b) => rank(a, b, today)).slice(0, MAX_ITEMS);
}
