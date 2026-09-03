import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTvIn, type Episode, type TvDetails } from "@/lib/tmdb";

/**
 * **نشراتُ Loopz في غرف النقاش** (D-261، الهجرة ٨٠).
 *
 * **طلبُ أحمد بنصّه:** «من مهام Loopz في غرف النقاشات أنه ينشّط الغرفة…
 * نزول حلقة كذا بعنوان كذا وأخذت تقييم كذا، ويذكر أبرز ما فيها — بحيث
 * فقط يكتب للمسلسلات الترينديق».
 *
 * ================= ⚠️ الحدُّ الذي وضعته D-212 قبل عام =================
 *
 * **بلاغُ أحمد يومها:** «الأخبار كلها موعد نزول الحلقة القادمة الذي هو
 * أصلاً موجود في Upcoming!! … المهم ما يذكر موعد نزول حلقة قادمة».
 * **فحُذف نوعُ `episode` من الأخبار حذفاً** (الهجرة ٦٦)، والقاعدةُ التي
 * بقيت: **الخبرُ ما لا يعرفه المستخدم من مكانٍ آخر في التطبيق.**
 *
 * **وهذه النشرةُ ليست ذلك، والفرقُ أربعةُ أشياء لا واحد:**
 *  ١) **زمنُها ماضٍ لا مستقبل** — «نزلت» لا «ستنزل». وUpcoming يعرض
 *     المستقبلَ وحده، **فلا تكرار.**
 *  ٢) **سطحُها الغرفةُ لا الخطّ** — لا تزاحم خبراً ثقيلاً في `/news`.
 *  ٣) **حمولتُها ليست تاريخاً**: عنوانُ الحلقة وتقييمُها ومدّتُها
 *     **وأبرزُ ما فيها** — ولا شيءَ من هذا في Upcoming.
 *  ٤) **وعملُها ليس الإخبار بل فتحُ الكلام** — بطاقةُ الغرفة تصعد،
 *     ومن ردَّ وصله ردُّ من ردَّ عليه (D-259).
 *
 * **⚠️ ولأن الخطرَ الذي أمسكته D-212 حقيقيٌّ وباقٍ** — «`episode` أسهلُ
 * إشارةٍ تُرصد فامتلأت الصفحةُ بأرخصها» — **فحارسان يُطبَّقان هنا حرفاً:**
 *  · **سقفٌ ثلاثٌ في الدورة** (`SLICE`)، وبوّابةُ زمنٍ قبله.
 *  · **ونشرةٌ بلا مادّةٍ لا تُكتب**: حلقةٌ بلا عنوانٍ حقيقيٍّ ولا وصفٍ
 *    ولا تقييم **هي بعينها الرقمُ الذي حذفته D-212** — تُسقَط صامتةً.
 *
 * ================= والحقائقُ لا الجملة =================
 *
 * الصفُّ يحمل الأرقامَ والأسماء، **و`i18n.ts` يصوغ الجملةَ بلغة القارئ**
 * (D-211/`newsLine.ts`). **وجملةٌ محفوظةٌ كانت تُقفل لغةَ النشرة يومَ
 * كُتبت** — وأحمد يتصفّح بالإنجليزية.
 */

/** **سقفُ الدورة الواحدة** — والقاعدةُ تسمح بعشرة، وهذا حدُّ المنتج */
const SLICE = 3;

/**
 * **نافذةُ «نزلت للتوّ»** — وهي رقمٌ واحدٌ يقرؤه موضعان.
 *
 * ⚠️ **والموضعُ الثاني هو `talk_bulletin_slice` في الهجرة ٨٠**:
 * `s.last_air_date::date >= (now() at time zone 'utc')::date - 2`
 * **= ثلاثةُ أيامٍ تقويمية = ٧٢ ساعة كحدٍّ أقصى.** فإن تغيّر أحدُهما
 * تغيّر الآخر معه.
 *
 * ⚠️ **وعطلٌ وقع فعلاً ويُسجَّل** (١٥ أغسطس، أوّلُ دورةٍ حيّة): كان هذا
 * الرقمُ **٤٨** والقاعدةُ تقبل **٧٢** — **فسلَّمت مرشَّحَين عمرُهما ٥٤.٩
 * ساعة لا تستطيع الشيفرةُ قبولَهما أبداً.** النتيجة: أربعةُ نداءاتِ TMDB
 * مقابل رفضٍ مضمون وصفرِ نشرات — **وهو بعينه الهدرُ الذي بُنيت الشريحةُ
 * لتمنعه** (D-164). **والدرسُ: نافذتان لرقمٍ واحد ليستا نافذتين، هما
 * عطلٌ ينتظر.**
 *
 * **ولماذا وُسِّع الرقمُ ولم يُضيَّق المرشَّحون؟** لأن المفتاحَ الفريد
 * يجعل النشرةَ **لا تعود**: حلقةٌ تخرج من النافذة تُفقد إلى الأبد.
 * **ونافذةٌ أضيقُ من إيقاع الزيارات تخسر حلقاتٍ صامتةً** — والموقعُ قد
 * لا يُزار يوماً كاملاً.
 */
const WINDOW_HOURS = 72;

export type BulletinKind = "episode";

/** **الحقائقُ كما تُخزَّن** — أسماءٌ قصيرةٌ لأن الصفَّ يُقرأ بالآلاف */
export interface BulletinData {
  /** رقمُ الموسم */
  s: number;
  /** رقمُ الحلقة */
  e: number;
  /** عنوانُ الحلقة بالعربية — قد يغيب فيسقط من الجملة */
  name_ar?: string;
  name_en?: string;
  /** بالدقائق */
  runtime?: number;
  /** تقييمُ الحلقة نفسِها لا العمل */
  vote?: number;
  /** تاريخُ البثّ `YYYY-MM-DD` */
  air?: string;
}

export interface GeneratedBulletin {
  bulletin_key: string;
  kind: BulletinKind;
  tmdb_id: number;
  media_type: "tv";
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  data: BulletinData;
  /** النثرُ المحجوب بلغتيه — يغيب كاملاً إن لم يكن له نصٌّ في أيٍّ منهما */
  spoiler: { ar?: string; en?: string } | null;
}

/** `ep:tv:1399:8:6` — **صيغةٌ يقرؤها موضعان فتملكها دالّة** (D-237) */
export function bulletinKey(tmdbId: number, season: number, episode: number): string {
  return `ep:tv:${tmdbId}:${season}:${episode}`;
}

/**
 * **هل يُذكر هذا النصُّ أصلاً؟** — TMDB يعيد `"Episode 6"` اسماً حين لا
 * اسمَ للحلقة، **وهو رقمٌ بلفظٍ آخر** (D-212). ويعيد `""` كثيراً.
 */
function realName(raw: unknown, episodeNumber: number): string | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  /* «Episode 6» · «الحلقة 6» · «Épisode 6» — الرقمُ وحدَه بأيّ لسان */
  const bare = new RegExp(`^[^\\d]{0,12}\\s*${episodeNumber}\\s*$`);
  if (bare.test(s)) return undefined;
  return s.slice(0, 200);
}

function prose(raw: unknown): string | undefined {
  const s = String(raw ?? "").trim();
  if (s.length < 20) return undefined; // سطرٌ من كلمتين ليس «أبرزَ ما فيها»
  return s.slice(0, 1400);
}

/** أقلُّ من يومين — **يُقاس بالساعة لا باليوم** فلا تمرّ حلقةُ أمسِ البعيد */
function airedRecently(airDate: string | null | undefined): boolean {
  if (!airDate || !/^\d{4}-\d{2}-\d{2}$/.test(airDate)) return false;
  const aired = Date.parse(`${airDate}T00:00:00Z`);
  if (!Number.isFinite(aired)) return false;
  const age = Date.now() - aired;
  /* **ولا نشرةَ لحلقةٍ لم تُبثّ بعد**: TMDB يضع أحياناً في
     `last_episode_to_air` حلقةً تاريخُها غداً بفارق المناطق — **ويومٌ
     من السماح يكفي**، وما بعده مستقبلٌ لا ماضٍ (D-212). */
  return age > -36 * 3600 * 1000 && age < WINDOW_HOURS * 3600 * 1000;
}

/**
 * **بناءُ نشرةٍ من نسختَي التفاصيل** — أو `null` إن لم تستحقّ الكتابة.
 * **مُصدَّرةٌ لأنها المنطقُ الذي يُقرأ ويُراجَع**، ولا تلمس شبكةً ولا قاعدة.
 */
export function bulletinFrom(ar: TvDetails, en: TvDetails | null): GeneratedBulletin | null {
  const ep: Episode | null = ar.last_episode_to_air;
  if (!ep) return null;

  const season = Number(ep.season_number);
  const episode = Number(ep.episode_number);
  if (!Number.isFinite(season) || !Number.isFinite(episode) || episode < 1) return null;
  if (!airedRecently(ep.air_date)) return null;

  const enEp = en?.last_episode_to_air ?? null;
  /* **النسختان تصفان الحلقةَ نفسَها أو تُهمَل الثانية** — TMDB قد يتأخّر
     في لغةٍ عن أخرى، **وعنوانٌ إنجليزيٌّ لحلقةٍ أخرى أسوأُ من غيابه.** */
  const enSame = enEp && Number(enEp.episode_number) === episode && Number(enEp.season_number) === season;

  const nameAr = realName(ep.name, episode);
  const nameEn = enSame ? realName(enEp.name, episode) : undefined;
  const proseAr = prose(ep.overview);
  const proseEn = enSame ? prose(enEp.overview) : undefined;
  const vote = Number(ep.vote_average ?? 0);
  const hasVote = Number.isFinite(vote) && vote > 0;
  const runtime = Number(ep.runtime ?? 0);

  /* ⚠️ **حارسُ D-212**: بلا اسمٍ ولا وصفٍ ولا تقييم **لم يبقَ إلا الرقم** */
  if (!nameAr && !nameEn && !proseAr && !proseEn && !hasVote) return null;

  const data: BulletinData = { s: season, e: episode };
  if (nameAr) data.name_ar = nameAr;
  if (nameEn) data.name_en = nameEn;
  if (Number.isFinite(runtime) && runtime > 0) data.runtime = Math.round(runtime);
  if (hasVote) data.vote = Math.round(vote * 10) / 10;
  if (ep.air_date) data.air = ep.air_date;

  const spoiler =
    proseAr || proseEn ? { ...(proseAr ? { ar: proseAr } : {}), ...(proseEn ? { en: proseEn } : {}) } : null;

  /* **العنوانُ والملصقُ والغلافُ مع الصفّ** (نمطُ `ratings`، D-048/D-254) —
     **وبطاقةُ الغرفة تقرؤهما من أحدث صفٍّ يحملهما.**
     ⚠️ **والعنوانُ بلغةٍ واحدة كما يكتبه أيُّ إنسان**: العمودُ `text`
     لجميع الكاتبين منذ الهجرة ٧٨ — **قيدٌ قائمٌ لا يزيده D-261.** */
  const title = String(ar.name ?? en?.name ?? "").trim();
  if (!title) return null;

  return {
    bulletin_key: bulletinKey(ar.id, season, episode),
    kind: "episode",
    tmdb_id: ar.id,
    media_type: "tv",
    title: title.slice(0, 300),
    poster_path: ar.poster_path ?? null,
    backdrop_path: ar.backdrop_path ?? null,
    data,
    spoiler,
  };
}

/**
 * **دورةُ نشرٍ واحدة** — والقاعدةُ هي التي تختار المرشَّحين
 * (`talk_bulletin_slice`): **يُقصّون قبل نداء TMDB لا بعده** (D-164)،
 * فلا نداءَ إلا لثلاثةٍ على الأكثر — **ولكلٍّ نداءان، لغةً لغة.**
 *
 * **وسقوطُها صامت** قبل تشغيل الهجرة ٨٠: الشريحةُ تعود فارغةً فلا شيء.
 */
export async function runTalkBulletinSlice(limit = SLICE): Promise<{
  checked: number;
  posted: number;
}> {
  const supabase = await createClient();

  const { data: slice, error } = await supabase.rpc("talk_bulletin_slice", { p_limit: limit });
  if (error || !slice) return { checked: 0, posted: 0 };

  const rows = (slice as { tmdb_id: number; media_type: string }[]).filter((r) => r.media_type === "tv");
  if (!rows.length) return { checked: 0, posted: 0 };

  /* **اللغتان معاً لكل مرشَّح** — والنداءات كلُّها متوازية: ستّةُ نداءاتٍ
     في أسوأ الحالات، **وTMDB مخبّأٌ ساعةً** (`revalidate: 3600`). */
  const built = await Promise.all(
    rows.map(async (r) => {
      try {
        const [ar, en] = await Promise.all([
          getTvIn(r.tmdb_id, "ar-SA"),
          getTvIn(r.tmdb_id, "en-US").catch(() => null),
        ]);
        return bulletinFrom(ar, en);
      } catch {
        /* **عملٌ واحدٌ يسقط لا يُسقط الدورة** — القراءةُ متسامحة (D-179) */
        return null;
      }
    }),
  );

  const bulletins = built.filter((b): b is GeneratedBulletin => b !== null);
  if (!bulletins.length) return { checked: rows.length, posted: 0 };

  // الكتابةُ بعميل الخدمة (D-898) — القراءةُ أعلاه تبقى على عميل الجلسة
  const writer = await createServiceClient();
  const { data: saved } = await writer.rpc("set_talk_bulletins", { p_rows: bulletins });
  return { checked: rows.length, posted: Number(saved ?? 0) };
}
