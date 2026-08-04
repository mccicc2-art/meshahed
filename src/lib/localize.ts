import { getTv, getMovie } from "@/lib/tmdb";
import type { FollowRow } from "@/lib/data";
import type { Locale } from "@/lib/i18n";

/**
 * أسماء المتابعات بلغة الواجهة.
 *
 * صفّ المتابعة يحفظ الاسم والملصق كما كانا يوم المتابعة — بلغة الواجهة
 * حينها. فمن تابع بالعربية ثم بدّل إلى الإنجليزية كان يرى مكتبته عربيةً
 * في واجهة إنجليزية. والاسم المخزّن ليس خطأً يُصلَح في قاعدة البيانات:
 * الصفّ واحد والقارئ قد يقرأه بلغتين.
 *
 * فالحلّ هنا: نقرأ نصّ الاسم المخزّن، فإن خالف خطُّه لغة الواجهة سألنا
 * TMDB عن العمل باللغة الحالية وأخذنا اسمه وملصقه. والطلب مخبّأ ساعةً في
 * `tmdb()`، فالحساب يدفع ثمنه مرّةً لا مرّةً لكل فتح صفحة، والسقف يمنع
 * مكتبةً ضخمة من فتح مئة اتصال.
 */

const ARABIC = /[؀-ۿ]/;

/** سقف الطلبات: ما بعده يبقى باسمه المخزّن */
const LIMIT = 24;

export async function localizeFollows(
  rows: FollowRow[],
  locale: Locale,
): Promise<FollowRow[]> {
  const wantsArabic = locale !== "en";

  const stale = rows
    .filter((r) => ARABIC.test(r.title) !== wantsArabic)
    .slice(0, LIMIT);
  if (stale.length === 0) return rows;

  const fetched = await Promise.all(
    stale.map(async (r) => {
      try {
        const d = (await (r.media_type === "tv"
          ? getTv(r.tmdb_id)
          : getMovie(r.tmdb_id))) as {
          name?: string;
          title?: string;
          poster_path: string | null;
        };
        const name = d.name ?? d.title;
        if (!name) return null;
        return {
          key: `${r.media_type}-${r.tmdb_id}`,
          title: name,
          poster_path: d.poster_path ?? r.poster_path,
        };
      } catch {
        return null;
      }
    }),
  );

  const byKey = new Map(
    fetched.filter((f): f is NonNullable<typeof f> => f !== null).map((f) => [f.key, f]),
  );
  if (byKey.size === 0) return rows;

  return rows.map((r) => {
    const f = byKey.get(`${r.media_type}-${r.tmdb_id}`);
    return f ? { ...r, title: f.title, poster_path: f.poster_path } : r;
  });
}
