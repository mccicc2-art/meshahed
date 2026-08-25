import { getTv, getMovie } from "@/lib/tmdb";
import type { FollowRow } from "@/lib/data";
import type { Locale } from "@/lib/i18n";
import { originalTitleOf, type MediaType } from "@/lib/media";
import { getTranslits } from "@/lib/titleAliases";
import { getTitleMode } from "@/lib/locale";
import {
  needsOriginal,
  needsTranslit,
  resolveMediaTitle,
  type ResolvedTitle,
  type TitleMode,
} from "@/lib/titleMode";

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

/**
 * 🔴 🆕 **خطوطٌ ليست من لغتَي الواجهة** (ذيلُ D-603 الأخير، بلاغُ أحمد:
 * «اسم ون بيس ما صحّح نفسه»): بطاقةُ One Piece عادت للرئيسية باسمها
 * المخزّن «ワンピース» — **والكاشفُ كان يعرف العربيةَ وضدَّها فقط**:
 * اليابانيّةُ ليست عربيةً فمرّت إنجليزيةً «سليمة» ولم يُسأل TMDB عنها
 * قطّ. **عنوانٌ بحروفٍ يابانيّة/صينيّة/كوريّة/سيريليّة بائتٌ في
 * الواجهتين معاً** (نطاقاتُ `bestSearchTitle` في `providerLinks`
 * نفسُها — قارئان لفكرةٍ واحدة).
 */
const FOREIGN = /[぀-ヿ㐀-鿿가-힯Ѐ-ӿ]/;

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
async function localizeCore<T extends LocalizableRow>(
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
    const stale =
      !r.title || ARABIC.test(r.title) !== wantsArabic || FOREIGN.test(r.title);
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
export function localizeFollows(rows: FollowRow[], locale: Locale): Promise<ResolvedRow<FollowRow>[]> {
  return localizeRows(rows, locale);
}

/**
 * أسماء غرف الأعمال بلغة القارئ (D-147).
 *
 * غرفةُ العمل صفٌّ **واحد يراه كل الناس**، واسمُه يُكتب مرّةً بلغة أوّل
 * من ولّدها (D-140). فمن واجهتُه إنجليزية كان يرى «حكاية لعبة ٥»
 * و«الأوديسة» — وهو عيبٌ أثقل من عيب الأعمدة المخزّنة في `follows`، لأن
 * ذاك اختيارُ صاحبه وهذا اختيارُ **غريب**.
 *
 * ولا يُصلَح في القاعدة: الصفّ واحدٌ والقرّاء بلغتين، وترجمتُه هناك تعني
 * عمودَ اسمٍ لكل لغة. `tmdb_id` موجودٌ في الصفّ أصلاً — وهو كل ما يلزم
 * ليُرسم الاسم عند العرض، بنفس محرّك D-048 ونفس تخبئته.
 *
 * وغرف الناس لا تُمسّ: اسمُها من صاحبها لا من TMDB.
 */
/**
 * **أسماءُ غرف النقاش بلغة القارئ** (D-273 — **وهي حجّةُ D-147 بعينها**).
 *
 * **بلاغُ أحمد: «كيف طلع الاسم بالعربي؟»** — واجهتُه إنجليزية والبطاقةُ
 * تقول «Discussing the series انقر الرابط». **والسببُ ليس عطلاً في
 * الاسم، هو غيابُ الترجمة**: `title_posts.title` يُكتب **مرّةً بلغة أوّل
 * من فتح الغرفة** (الهجرة ٧٨)، **والغرفةُ صفٌّ واحدٌ يراه كل الناس.**
 *
 * **وغرفُ الأعمال التلقائية تُترجَم منذ D-147 وهذه لم تكن** — **وهو
 * سهوٌ لا قرار**: نفسُ العلّة ونفسُ العلاج، **وسطحٌ ثانٍ للمعنى نفسِه
 * نُسي** حتى رآه صاحبُه.
 *
 * ⚠️ **والفرقُ الوحيد عن `localizeTitleRooms` أسماءُ الحقول**: تلك تقرأ
 * `name`/`tmdb_id`، وصفُّ الغرفة `camelCase` — **فالغلافُ يترجم الشكل
 * ولا يُنسخ المحرّك** (D-145).
 */
export async function localizeTalkRooms<
  T extends {
    tmdbId: number;
    mediaType: MediaType;
    title: string | null;
    posterPath: string | null;
  },
>(rooms: T[], locale: Locale): Promise<T[]> {
  if (!rooms.length) return rooms;
  const done = await localizeRows(
    rooms.map((r) => ({
      tmdb_id: r.tmdbId,
      media_type: r.mediaType,
      title: r.title,
      poster_path: r.posterPath,
    })),
    locale,
  );
  return rooms.map((r, i) => {
    const d = done[i];
    return d.title === r.title && d.poster_path === r.posterPath
      ? r
      : ({ ...r, title: d.title, posterPath: d.poster_path } as T);
  });
}

export async function localizeTitleRooms<
  T extends {
    name: string;
    kind?: string;
    tmdb_id?: number | null;
    media_type?: MediaType | null;
  },
>(rooms: T[], locale: Locale): Promise<T[]> {
  const rows: LocalizableRow[] = [];
  for (const r of rooms) {
    if (r.kind !== "title" || !r.tmdb_id || !r.media_type) continue;
    rows.push({
      tmdb_id: r.tmdb_id,
      media_type: r.media_type,
      title: r.name,
      poster_path: null,
    });
  }
  if (!rows.length) return rooms;

  const done = await localizeRows(rows, locale);
  const byKey = new Map(done.map((r) => [`${r.media_type}-${r.tmdb_id}`, r.title]));

  return rooms.map((r) => {
    if (r.kind !== "title" || !r.tmdb_id || !r.media_type) return r;
    const name = byKey.get(`${r.media_type}-${r.tmdb_id}`);
    return name && name !== r.name ? { ...r, name } : r;
  });
}


/* ================================================================
   🆕 طريقةُ العرض تُطبَّق على الصفوف المخزَّنة (D-544)
   ================================================================ */

/** صفٌّ حُلَّ اسمُه: `title` هو السطرُ الرئيس، **والثاني بجانبه لا داخله** */
export type ResolvedRow<T> = T & { title_secondary: string | null };

/**
 * **تطبيقُ «طريقة عرض أسماء الأعمال» على صفوفٍ من قاعدتنا** (D-544).
 *
 * ================= لماذا هنا بالضبط =================
 *
 * **لأن هذا هو المكانُ الذي تمرّ به كلُّ صفوفِ المكتبة والقوائم
 * والتقييمات والنشاط أصلاً** (D-048): عشرُ صفحاتٍ تناديه اليوم،
 * **فالوضعُ يُطبَّق مرّةً في الطبقة بدل شرطٍ في كلِّ بطاقة** — وهو نصُّ
 * المواصفة: «اجعل التنفيذ مركزيّاً دون شروطٍ متفرّقة».
 *
 * ================= وثمنُه صفرٌ في الافتراض =================
 *
 * **الوضعُ الافتراضيُّ لا يزيد نداءً واحداً**: هو `localizeRows`
 * بحرفها ثمّ `title_secondary = null`. **ومن لم يفتح الإعدادات لا يدفع
 * شيئاً** (D-510/D-152).
 *
 * **والأوضاعُ الثلاثةُ الأخرى تحتاج الاسمَ الأصليّ**، **وهو لا يُخزَّن
 * عندنا** — فيُقرأ من تفصيل TMDB. ⚠️ **ولا نداءَ مكرَّراً**:
 * `getTv`/`getMovie` مغلَّفتان بـ`cache` للطلب و`tmdb()` تخبّئ ساعةً،
 * **فالعملُ الذي ترجمه السطرُ الأوّل لا يُطلب مرّةً ثانية.**
 * **والسقفُ سقفُ الترجمة نفسُه** (`LIMIT`): **ما بعده يبقى باسمه
 * المخزَّن** — **وصفحةٌ ناقصةُ الأسماء أفضلُ من صفحةٍ لا تُفتح.**
 *
 * **والكتابةُ الصوتيّة نداءٌ واحدٌ مجمَّع** لا نداءٌ لكلِّ بطاقة
 * (`titleAliases.ts`).
 */
export async function resolveRows<T extends LocalizableRow>(
  rows: T[],
  locale: Locale,
  mode: TitleMode,
  limit = LIMIT,
): Promise<ResolvedRow<T>[]> {
  const localized = await localizeCore(rows, locale, limit);

  /* **الافتراضُ يخرج من هنا** — بلا نداءٍ ولا خريطةٍ ولا حلقةِ حلّ */
  if (!needsOriginal(mode)) {
    return localized.map((r) => ({ ...r, title_secondary: null }));
  }

  const keyOf = (r: LocalizableRow) => `${r.media_type}-${r.tmdb_id}`;

  const distinct = new Map<string, LocalizableRow>();
  for (const r of localized) {
    const k = keyOf(r);
    if (!distinct.has(k)) distinct.set(k, r);
    if (distinct.size >= limit) break;
  }

  const [originals, translits] = await Promise.all([
    (async () => {
      const map = new Map<string, string>();
      await Promise.all(
        [...distinct.values()].map(async (r) => {
          try {
            const d = await (r.media_type === "tv" ? getTv(r.tmdb_id) : getMovie(r.tmdb_id));
            const o = originalTitleOf(d as { original_title?: string; original_name?: string });
            if (o) map.set(keyOf(r), o);
          } catch {
            /* عملٌ سقط نداؤه يبقى باسمه المخزَّن — لا فراغ (D-063) */
          }
        }),
      );
      return map;
    })(),
    needsTranslit(mode)
      ? getTranslits([...distinct.values()])
      : Promise.resolve(new Map<string, string>()),
  ]);

  return localized.map((r) => {
    const k = keyOf(r);
    const out = resolveMediaTitle(
      {
        localized: r.title,
        original: originals.get(k) ?? null,
        translit: translits.get(k) ?? null,
      },
      mode,
      r.title ?? "",
    );
    return { ...r, title: out.primary, title_secondary: out.secondary };
  });
}

/**
 * **ونفسُ الحلِّ لصفٍّ واحد** — صفحةُ العمل ورأسُ النقاش وما شابه.
 * **يقرأ التفصيلَ المخبَّأ نفسَه**، فلا نداءَ زائدٌ لمن قرأه أصلاً.
 */
export async function resolveOneTitle(
  row: LocalizableRow,
  locale: Locale,
  mode: TitleMode,
): Promise<ResolvedTitle> {
  const [r] = await resolveRows([row], locale, mode, 1);
  return { primary: r?.title ?? row.title ?? "", secondary: r?.title_secondary ?? null };
}


/**
 * ⚖️ 🆕 **والبابُ العامُّ صار يحمل الوضعَ بنفسه** (D-544).
 *
 * ================= لماذا لا يُمرَّر الوضعُ من الصفحات =================
 *
 * **لأنها عشرُ صفحاتٍ تناديه**، **ولأن نسيانَ تمريره في واحدةٍ منها
 * عطلٌ صامت**: تلك الصفحةُ وحدَها تبقى على الافتراض **ولا شيء يشتكي**
 * — **وهو بالضبط شكلُ العطل الذي أنتجته D-289** (وصفةٌ صُحّحت في نسخةٍ
 * وبقيت النسخةُ الأخرى سبعةَ أيام). **فالوضعُ يُقرأ حيث تُقرأ اللغة:
 * مرّةً، في الطبقة.**
 *
 * **والتوقيعُ لم يتغيّر** — عشرُ الصفحاتِ لا يتغيّر فيها حرف،
 * **والذي زاد حقلٌ اختياريٌّ في الناتج** (`title_secondary`) يقرؤه من
 * يرسم سطرين ويتجاهله من يرسم سطراً.
 *
 * ⚠️ **وأسماءُ الغرف تمرّ بها هي أيضاً** (`localizeTalkRooms` /
 * `localizeTitleRooms`): **اسمُ غرفةِ العمل هو اسمُ العمل** — **ولو
 * تُرك على الافتراض لصار للعمل الواحد اسمان في شاشةٍ واحدة**، وهو
 * بعينه العطلُ الذي عالجته D-147/D-273. **ومرّةً واحدة**: كلٌّ منهما
 * ينادي هذه مرّةً لا مرّتين.
 */
export async function localizeRows<T extends LocalizableRow>(
  rows: T[],
  locale: Locale,
  limit = LIMIT,
): Promise<ResolvedRow<T>[]> {
  if (rows.length === 0) return rows.map((r) => ({ ...r, title_secondary: null }));
  const mode = await getTitleMode();
  return resolveRows(rows, locale, mode, limit);
}
