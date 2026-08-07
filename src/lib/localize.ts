import { getTv, getMovie } from "@/lib/tmdb";
import type { FollowRow } from "@/lib/data";
import type { Locale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";

/**
 * أسماء الأعمال المخزّنة، معروضةً بلغة الواجهة.
 *
 * أربعة جداول تحفظ `title` و`poster_path` وقت الإضافة — أي بلغة الواجهة
 * **يومها**: `follows` و`user_list_items` و`ratings` وما يُبنى عليها. فمن
 * تابع بالعربية ثم بدّل إلى الإنجليزية كان يرى رئيسيةً إنجليزية وقائمةً
 * عربية في الشاشة نفسها. والاسم المخزّن ليس خطأً يُصلَح في قاعدة البيانات:
 * الصفّ واحد والقارئ قد يقرأه بلغتين.
 *
 * فالحلّ هنا: نقرأ خطّ الاسم المخزّن، فإن خالف لغة الواجهة سألنا TMDB عن
 * العمل باللغة الحالية وأخذنا اسمه وملصقه. والطلب مخبّأ ساعةً في `tmdb()`،
 * فالحساب يدفع ثمنه مرّةً لا مرّةً لكل فتح صفحة.
 *
 * ولا تُحذف الأعمدة المخزّنة: هي ما يُبقي المكتبة مقروءةً حين يسقط TMDB أو
 * ينقطع الاتصال — تبقى احتياطاً، ويُترجَم فوقها عند العرض وحده.
 *
 * **تُستدعى من مكوّنات الخادم في الصفحات، لا من `data.ts`**: طبقة البيانات
 * لا تعرف اللغة ولا يجب أن تعرفها، والصفحة وحدها تملك `locale`.
 */

const ARABIC = /[؀-ۿ]/;

/** سقف الطلبات في النداء الواحد: ما بعده يبقى باسمه المخزّن */
const LIMIT = 24;

/** أقلّ ما يحتاجه المُترجِم من أي صفّ — الحقول الأربعة وحدها */
export interface LocalizableRow {
  tmdb_id: number;
  media_type: MediaType;
  title: string | null;
  poster_path: string | null;
}

/**
 * ترجمة أي مجموعة صفوف تحمل عنواناً مخزَّناً.
 *
 * المفاتيح تُجمَّع أولاً بلا تكرار: خطّ الآراء قد يحمل العمل نفسه من خمسة
 * أشخاص، ولا معنى لخمسة طلبات لجوابٍ واحد. والسقف يُحسب على الأعمال
 * المتمايزة لا على الصفوف، فصفحةٌ بستّين صفّاً لعشرة أعمال تُترجَم كلها.
 */
export async function localizeRows<T extends LocalizableRow>(
  rows: T[],
  locale: Locale,
  limit = LIMIT,
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const wantsArabic = locale !== "en";
  const keyOf = (r: LocalizableRow) => `${r.media_type}-${r.tmdb_id}`;

  // عملٌ يحتاج ترجمةً: خطّ اسمه يخالف لغة الواجهة، أو لا اسم له أصلاً
  const wanted = new Map<string, LocalizableRow>();
  for (const r of rows) {
    const stale = !r.title || ARABIC.test(r.title) !== wantsArabic;
    if (!stale) continue;
    const k = keyOf(r);
    if (!wanted.has(k)) wanted.set(k, r);
    if (wanted.size >= limit) break;
  }
  if (wanted.size === 0) return rows;

  const fetched = await Promise.all(
    [...wanted.values()].map(async (r) => {
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
          key: keyOf(r),
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
    const f = byKey.get(keyOf(r));
    return f ? ({ ...r, title: f.title, poster_path: f.poster_path } as T) : r;
  });
}

/** المتابعات — الاسم عندها غير قابلٍ للفراغ، وبقيّة السلوك واحد */
export function localizeFollows(rows: FollowRow[], locale: Locale): Promise<FollowRow[]> {
  return localizeRows(rows, locale);
}
