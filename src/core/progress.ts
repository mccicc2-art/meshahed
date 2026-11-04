// مصدر واحد لحساب نسبة التقدّم في كل الشاشات.
//
// المشكلة التي يحلّها: صفحة المسلسل كانت تحسب على الحلقات المعروضة فقط،
// بينما الرئيسية والمكتبة تحسبان على كل الحلقات المعلنة — فتظهر ٨٨٪ هنا و٩٢٪ هناك.
// القاعدة الموحّدة الآن: المقام = الحلقات التي عُرضت فعلاً.

import type { TvDetails } from "@/lib/tmdb";
import { earliestAt, type ImportEpisode, type ImportShow, type ImportSpan } from "./importer.ts";

/** اليومُ بصيغة `YYYY-MM-DD` (UTC) — صيغةُ `air_date` نفسُها، فالمقارنةُ نصّيّة */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 🔴 🆕 **آخرُ حلقةٍ عُرضت — بتاريخها لا بتصنيف TMDB** (D-1253، بلاغُ أحمد بلقطة على Black Clover، ٣ أكتوبر
 * ٢٠٢٦: «حلقة السيزون الثاني نزلت .. ليش ماهي موجودة؟ في IMDb موجودة»).
 *
 * **العلّة**: TMDB يُبقي الحلقةَ في `next_episode_to_air` طوال يوم عرضها، ولا ينقلها إلى
 * `last_episode_to_air` إلّا في تحديثه بعد انقضاء اليوم. وحاسباتُ هذا الملفّ كانت تقرأ `last` وحدَه —
 * فحلقةٌ نزلت اليومَ تبقى «قادمةً» يوماً كاملاً: موسمُها صفر، والعملُ «مكتمل ١٠٠٪»، ولا تُعلَّم.
 *
 * **القاعدة**: «القادمةُ» التي حلّ تاريخُها (`air_date <= اليوم`) هي آخرُ ما عُرض. وقائمةُ الحلقات في
 * التطبيق تقرأ التاريخَ أصلاً (`SeasonAccordion`: `air_date <= today()`) — فالعدُّ الآن يوافق القائمة.
 *
 * ⚠️ **الثمنُ يُقال**: TMDB يعطي تاريخاً بلا ساعة، فالحلقةُ تُحسب من أوّل يومها — قبل بثّها الفعليّ
 * بساعات (ومسلسلٌ أمريكيٌّ يُبثّ ليلاً قد يسبق بنحو يوم). اختيارُ أحمد بعد أن عُرض عليه: حلقةٌ تسبق
 * موعدَها بساعاتٍ أهونُ من حلقةٍ نزلت ولا تُعلَّم. ⚠️ **ودفعةٌ تنزل في يومٍ واحد** (موسمٌ كامل) تُحسب
 * حلقتُها الأولى وحدَها حتى يلحق TMDB — `next` حلقةٌ واحدة.
 * الخاصّاتُ (الموسم ٠) لا تُحتسب هنا كما لا تُحتسب في العدّ كلِّه.
 */
export function lastAiredOf(tv: TvDetails, today: string = todayIso()): TvDetails["last_episode_to_air"] {
  const next = tv.next_episode_to_air;
  if (next?.air_date && next.season_number >= 1 && next.air_date <= today) return next;
  return tv.last_episode_to_air;
}

/**
 * عدد الحلقات التي عُرضت فعلاً، مشتقّ من `last_episode_to_air` بلا أي طلب إضافي:
 * كل مواسم ما قبل آخر حلقة مُذاعة + رقم تلك الحلقة داخل موسمها.
 * الموسم صفر (الحلقات الخاصة) لا يُحتسب لأن TMDB لا يحتسبه في number_of_episodes.
 */
export function airedEpisodeCount(tv: TvDetails, today?: string): number {
  const last = lastAiredOf(tv, today);
  const total = tv.number_of_episodes ?? 0;

  if (!last || !last.season_number || last.season_number < 1) {
    // مسلسل منتهٍ أو بلا بيانات بثّ: كل الحلقات المعلنة معروضة
    return tv.next_episode_to_air ? 0 : total;
  }

  let prev = 0;
  let lastCap = 0;
  for (const s of tv.seasons ?? []) {
    if (s.season_number < 1) continue;
    if (s.season_number < last.season_number) prev += s.episode_count ?? 0;
    if (s.season_number === last.season_number) lastCap = s.episode_count ?? 0;
  }
  const lastEp = last.episode_number ?? 0;

  /* 🔴 🆕 **الترقيمُ المطلق** (D-603، بلاغُ أحمد وخالد على One Piece):
     TMDB تعيد هيكلةَ بعض الأعمال إلى مواسمَ-آركاتٍ **تحمل حلقاتُها
     أرقامَها المطلقة** — حلقاتُ «Elbaph» أرقامُها ١١٥٦–١١٨١ لا ١–٢٦.
     **فرقمُ آخرِ حلقةٍ أكبرُ من سعةِ موسمها = الرقمُ نفسُه هو عدّادُ
     المعروض في العمل كلِّه** — وجمعُه فوق المواسم السابقة كان يفيض
     فيُقصّ إلى المعلَن كلِّه، **فتُحسب حلقاتُ المستقبل معروضةً.** */
  const count = lastCap > 0 && lastEp > lastCap ? lastEp : prev + lastEp;

  // لا تتجاوز العدد المعلن، ولا تنزل تحت الصفر
  return Math.max(0, Math.min(count, total || count));
}

/**
 * كم حلقة عُرضت من كل موسم — لعرض «٨/١٠» على رأس الموسم دون تحميل حلقاته.
 * المواسم قبل موسم آخر حلقة مُذاعة مكتملة، والموسم الجاري حتى رقم تلك الحلقة،
 * وما بعده صفر.
 */
export function airedPerSeason(tv: TvDetails, today?: string): Map<number, number> {
  const last = lastAiredOf(tv, today);
  const out = new Map<number, number>();

  /* الفرزُ لازمٌ لتجميع «ما قبل موسمِ آخر حلقة» — كشفُ الترقيم المطلق
     (D-603) يحتاج مجموعَ المواسم السابقة ليحوّل الرقمَ إلى داخل الموسم */
  const seasons = (tv.seasons ?? [])
    .filter((s) => s.season_number >= 1)
    .sort((a, b) => a.season_number - b.season_number);

  let prev = 0;
  for (const s of seasons) {
    const count = s.episode_count ?? 0;

    if (!last?.season_number) {
      out.set(s.season_number, tv.next_episode_to_air ? 0 : count);
    } else if (s.season_number < last.season_number) {
      out.set(s.season_number, count);
      prev += count;
    } else if (s.season_number === last.season_number) {
      const lastEp = last.episode_number ?? count;
      /* 🔴 🆕 **ترقيمٌ مطلق؟** (D-603): رقمٌ أكبرُ من سعة الموسم يعني
         أنه مطلقٌ — **وداخلُ الموسم هو الرقمُ ناقصَ ما قبله**
         (١١٧٥ − ١١٥٥ = ٢٠ من «Elbaph»)، لا ٢٦ التي كانت تُقصُّ إليها
         فتُحسب حلقاتُ المستقبل معروضة. */
      const within = count > 0 && lastEp > count ? lastEp - prev : lastEp;
      out.set(s.season_number, Math.max(0, Math.min(count, within)));
    } else {
      out.set(s.season_number, 0);
    }
  }
  return out;
}

/**
 * 🔴 🆕 **هل يرقّم العملُ حلقاتِه ترقيماً مطلقاً؟** (D-603 — One Piece):
 * رقمُ آخرِ حلقةٍ مُذاعةٍ أكبرُ من سعةِ موسمها = الأرقامُ أرقامُ العمل
 * كلِّه لا الموسم. **كاشفٌ واحدٌ يقرؤه الحاسبان والمتتبّعُ والصفحة**
 * (D-145) — نسختان منه تفترقان عند أوّل تعديل.
 */
export function isAbsoluteNumbering(tv: TvDetails, today?: string): boolean {
  const last = lastAiredOf(tv, today);
  if (!last?.season_number || last.season_number < 1) return false;
  const cap =
    (tv.seasons ?? []).find((s) => s.season_number === last.season_number)
      ?.episode_count ?? 0;
  return cap > 0 && (last.episode_number ?? 0) > cap;
}

/**
 * 🔴 🆕 **أوّلُ رقمِ حلقةٍ في كلِّ موسم** (بقيّةُ D-603، انكشفت يومَ
 * الهجرة ١٣٣): في الترقيم المطلق هو مجموعُ سعات المواسم قبله + ١
 * («Elbaph» يبدأ من ١١٥٦)، وفي النسبيّ ١ دائماً. **قاعدةٌ واحدةٌ
 * لقرّائها الأربعة** (D-145): الختمُ الكامل (`markShowWatched`)،
 * و«+١» (`markNextEpisode`)، واستيرادُ الترحيب، وحاسبُ «الحلقة
 * التالية» أدناه — **نسخةٌ خامسةٌ منها تفترق عند أوّل تعديل.**
 */
export function firstEpisodeOf(tv: TvDetails): Map<number, number> {
  const absolute = isAbsoluteNumbering(tv);
  const out = new Map<number, number>();
  let prev = 0;
  for (const s of (tv.seasons ?? [])
    .filter((x) => x.season_number >= 1)
    .sort((a, b) => a.season_number - b.season_number)) {
    out.set(s.season_number, absolute ? prev + 1 : 1);
    prev += s.episode_count ?? 0;
  }
  return out;
}

/**
 * 🆕 **كلُّ حلقةٍ عُرضت من العمل** — المواسمُ المنتظمة بنوافذها (`airedPerSeason` · `firstEpisodeOf`)، بلا الخاصّات.
 * **قارئاها**: «شفته كله» (`markShowWatched`) واستيرادُ IMDb («مسلسلٌ قيّمتَه = شاهدتَه كلَّه»، أحمد ٤ نوفمبر «١ ب»).
 * نسختان من هذه الحلقة تفترقان عند أوّل تعديلٍ في الترقيم (D-145 / D-603).
 */
export function airedEpisodesAll(tv: TvDetails): { s: number; e: number }[] {
  const per = airedPerSeason(tv);
  const firstOf = firstEpisodeOf(tv);
  const out: { s: number; e: number }[] = [];
  for (const [s, count] of per) {
    const first = firstOf.get(s) ?? 1;
    for (let i = 0; i < count; i++) out.push({ s, e: first + i });
  }
  return out;
}

/**
 * 🆕 **«شاهدتُ حتى هنا» — الحلقةُ وكلُّ ما عُرض قبلها** (R58 · حدودُ A-15) — خرجت من `markWatchedUpTo` يومَ صار
 * لها قارئٌ ثانٍ: استيرادُ IMDb («حلقةٌ قيّمتَها تُعلَّم وما قبلها»، أحمد ٤ نوفمبر «٢ أ»).
 * - الخاصّةُ (الموسم ٠) وحدَها: «قبلها» لا معنى له هناك.
 * - موسمٌ لا يعرفه TMDB لا يُعلِّم شيئاً (الموسمُ ٩٩ في مسلسلٍ من ثلاثة كان يعلّم الثلاثة).
 * - وفي موسمها: حتى آخر ما بُثّ لا حتى الرقم المرسَل — حلقةٌ لم تُعرض لا تُعلَّم.
 * - رقمٌ خارج الحدّين (٠–١٠٠٠ / ١–٢٠٠٠٠) ليس حلقةً: `[]`.
 */
export function airedEpisodesUpTo(tv: TvDetails, season: number, episode: number): { s: number; e: number }[] {
  if (!Number.isInteger(season) || season < 0 || season > 1000 || !Number.isInteger(episode) || episode < 1 || episode > 20_000) return [];
  if (season === 0) return [{ s: 0, e: episode }];
  const per = airedPerSeason(tv);
  const firstOf = firstEpisodeOf(tv);
  if (!per.has(season)) return [];
  const want: { s: number; e: number }[] = [];
  for (const [sn, count] of per) {
    if (sn === 0 || sn > season) continue;
    const first = firstOf.get(sn) ?? 1;
    const last = sn < season ? first + count - 1 : Math.min(episode, first + count - 1);
    for (let ep = first; ep <= last; ep++) want.push({ s: sn, e: ep });
  }
  /* الحلقةُ نفسُها تُضاف حين تقع داخل ما بُثّ وحده — وإلّا فهي حلقةٌ لم تُعرض */
  const inSeason = (firstOf.get(season) ?? 1) + (per.get(season) ?? 0) - 1;
  if (episode <= inSeason && !want.some((w) => w.s === season && w.e === episode)) want.push({ s: season, e: episode });
  return want;
}

/**
 * 🆕 **مدىً من حلقات العمل في ترتيبه** — موسمُ MyAnimeList على مسلسل TMDB (جدولُ Fribb: موسمٌ وإزاحة):
 * يبدأ من أوّل حلقةٍ عُرضت في `season` (أو من أوّل العمل إن كان `null` — ترقيمٌ متّصلٌ كـ One Piece) بعد `offset`،
 * ويمتدّ `count` حلقةً **ويفيض إلى ما بعد موسمه** كما يفيض `placeOnTmdb` (جدولٌ يرقّم تسلسليّاً وTMDB يقسم)،
 * أو — بلا `count` — بقيّةَ موسمه. وما لم يُعرض لا يدخل: المدى يُقصّ على `airedEpisodesAll`.
 */
export function airedEpisodesSpan(tv: TvDetails, span: Pick<ImportSpan, "season" | "offset" | "count">): { s: number; e: number }[] {
  const all = airedEpisodesAll(tv);
  const start = span.season == null ? 0 : all.findIndex((x) => x.s === span.season);
  if (start < 0) return [];
  const from = start + (Number.isInteger(span.offset) && span.offset > 0 ? span.offset : 0);
  if (span.count == null) return span.season == null ? all.slice(from) : all.slice(from).filter((x) => x.s === span.season);
  const n = Number.isInteger(span.count) && span.count > 0 ? Math.min(span.count, 5000) : 0;
  return all.slice(from, from + n);
}

/** أقصى ما يُرسم من صفوفٍ عامّة — فوقه العطلُ أكبرُ من حلقةٍ تأخّرت، وصفوفٌ بلا أسماءٍ بالعشرات ضجيج */
const MAX_PADDED = 3;

/**
 * 🆕 **حلقاتٌ حُسبت معروضةً ولا صفَّ لها في قائمة الموسم** (D-1254).
 *
 * منذ D-1253 العدُّ يقرأ التاريخ، وقائمةُ الموسم تأتي من TMDB — وقد تتأخّر عنه (الحلقاتُ يُدخلها
 * متطوّعون). فيقول رأسُ الموسم «٠/١» ولا حلقةَ تحته. هذه تعيد **أرقامَ الناقص وتاريخَه** ليُرسم له صفٌّ
 * عامٌّ يُعلَّم؛ الاسمُ يضعه القارئ بلغته (`episodeNo`).
 *
 * 🔑 **الحارسان**: (١) لا يُضاف شيءٌ ما دام في القائمة من المعروض ما يساوي العدَّ — فاختلافُ ترقيمٍ بين
 * القائمة والحاسب (مطلقٌ/نسبيّ) لا يولّد صفوفاً وهميّة. (٢) العجزُ فوق `MAX_PADDED` لا يُرقَّع.
 * والناقصُ يُؤخذ من **آخر** الأرقام المتوقَّعة: القائمةُ تتأخّر عن الجديد لا عن القديم.
 * الخاصّاتُ (الموسم ٠) خارجَ العدّ فلا تُرقَّع.
 */
export function missingAiredEpisodes(
  tv: TvDetails,
  season: number,
  listed: { episode_number: number; air_date: string | null }[],
  today: string = todayIso(),
): { episode_number: number; air_date: string }[] {
  if (season < 1) return [];
  const aired = airedPerSeason(tv, today).get(season) ?? 0;
  const have = listed.filter((e) => e.air_date && e.air_date <= today).length;
  const deficit = aired - have;
  if (deficit <= 0 || deficit > MAX_PADDED) return [];

  const first = firstEpisodeOf(tv).get(season) ?? 1;
  const known = new Set(listed.map((e) => e.episode_number));
  const last = lastAiredOf(tv, today);
  /* تاريخُ الصفّ: تاريخُ آخر ما عُرض — ما قبله عُرض قبله أو معه، فلا يُرسم «مستقبلاً» */
  const date = last?.air_date && last.air_date <= today ? last.air_date : today;

  const out: { episode_number: number; air_date: string }[] = [];
  for (let n = first + aired - 1; n >= first && out.length < deficit; n--) {
    if (!known.has(n)) out.push({ episode_number: n, air_date: date });
  }
  return out.reverse();
}

/** النسبة المئوية الموحّدة: مشاهَد ÷ معروض */
export function percentOf(watched: number, aired: number): number {
  if (!aired || aired <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((watched / aired) * 100)));
}

/** هل أنهى المستخدم كل ما عُرض من العمل؟ */
export function isComplete(watched: number, aired: number): boolean {
  return aired > 0 && watched >= aired;
}

/**
 * أول حلقة مُذاعة لم تُشاهد بعد — أساس بطاقة «الحلقة التالية».
 * يمشي على المواسم بالترتيب ويتوقّف عند حدّ آخر حلقة عُرضت،
 * فلا يقترح حلقة لم تنزل. يرجع null لو المستخدم لاحق على كل المعروض.
 */
export function nextUnwatchedEpisode(
  tv: TvDetails,
  watchedKeys: ReadonlySet<string>,
  /** 🆕 D-1623 — المخفيُّ بالفلر/الذهبيّ (`skipKeysOf`) لا يُقترح: «التالية» هي التالية في صفحة العمل */
  skip?: ReadonlySet<string> | null,
): { season: number; episode: number } | null {
  /* 🔴 🆕 **بقيّةُ D-603**: كان يعدّ من ١ في كلِّ موسم، ففي العمل
     المطلق ظنّ «S2 E1» غيرَ مشاهَدةٍ ومفاتيحُ صاحبها 62–77 —
     فاقترحت البطاقةُ حلقةً لا وجودَ لها. **صار يمشي على نافذة كلِّ
     موسمٍ الحقيقيّة** (`firstEpisodeOf`)، **وسقفُ المعروض من
     `airedPerSeason` نفسِها** (D-374: ما يُقترح هو ما يُعدّ) —
     فمسلسلٌ لم يُذَع منه شيءٌ لا تُقترح حلقتُه الأولى بعد اليوم. */
  const per = airedPerSeason(tv);
  const firstOf = firstEpisodeOf(tv);
  for (const [season, count] of per) {
    const first = firstOf.get(season) ?? 1;
    for (let i = 0; i < count; i++) {
      const e = first + i;
      if (!watchedKeys.has(`${season}:${e}`) && !skip?.has(`${season}:${e}`)) {
        return { season, episode: e };
      }
    }
  }
  return null;
}

/**
 * 🆕 **ما يُعلَّم ضمناً من مسلسلٍ مستورد** — «كلُّه» (`all`) و«حتى هنا» (`upTo`) ومدى MyAnimeList (`spans`) — **على الخادم وبتفاصيل TMDB**
 * (R58: العميلُ لا يُؤتمن على قائمة الحلقات). وحدةٌ نقيّةٌ ليُختبر فيها القراران — **هنا لا في `importBuild`**: تقرأ تفاصيلَ TMDB، والتطبيقُ يحمل `importBuild` ولا يحمل هذا الملفّ:
 * - **التاريخ** («٣ أ»): كلُّ حلقةٍ بتاريخ **أبكرِ** تقييمٍ يغطّيها — من قيّم الحلقة الخامسة في مايو والثالثة في أبريل
 *   شاهد الأولى قبل أبريل. ولا تاريخ ⇐ `undefined` (يأخذ ختمَ الدفعة عند الكاتب).
 * - **الحدود** حدودُ `airedEpisodesUpTo` / `airedEpisodesAll` بحرفها: ما لم يُعرض لا يُعلَّم، والخاصّةُ وحدَها.
 * الحلقاتُ الصريحة (`episodes`) خارجَها: تُكتب بتواريخها هي.
 */
export function impliedEpisodes(
  tv: TvDetails,
  show: Pick<ImportShow, "upTo" | "all" | "spans">,
): ImportEpisode[] {
  const dates = new Map<string, ImportEpisode>();
  const cover = (eps: { s: number; e: number }[], at: string | undefined) => {
    for (const { s, e } of eps) {
      const k = `${s}-${e}`;
      const prev = dates.get(k);
      dates.set(k, { s, e, at: prev ? earliestAt(prev.at, at) : at });
    }
  };
  if (show.all) cover(airedEpisodesAll(tv), show.all.at);
  for (const a of show.upTo ?? []) cover(airedEpisodesUpTo(tv, a.s, a.e), a.at);
  for (const sp of show.spans ?? []) cover(airedEpisodesSpan(tv, sp), sp.at);
  return [...dates.values()];
}
