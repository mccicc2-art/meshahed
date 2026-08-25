// مصدر واحد لحساب نسبة التقدّم في كل الشاشات.
//
// المشكلة التي يحلّها: صفحة المسلسل كانت تحسب على الحلقات المعروضة فقط،
// بينما الرئيسية والمكتبة تحسبان على كل الحلقات المعلنة — فتظهر ٨٨٪ هنا و٩٢٪ هناك.
// القاعدة الموحّدة الآن: المقام = الحلقات التي عُرضت فعلاً.

import type { TvDetails } from "@/lib/tmdb";

/**
 * عدد الحلقات التي عُرضت فعلاً، مشتقّ من `last_episode_to_air` بلا أي طلب إضافي:
 * كل مواسم ما قبل آخر حلقة مُذاعة + رقم تلك الحلقة داخل موسمها.
 * الموسم صفر (الحلقات الخاصة) لا يُحتسب لأن TMDB لا يحتسبه في number_of_episodes.
 */
export function airedEpisodeCount(tv: TvDetails): number {
  const last = tv.last_episode_to_air;
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
export function airedPerSeason(tv: TvDetails): Map<number, number> {
  const last = tv.last_episode_to_air;
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
export function isAbsoluteNumbering(tv: TvDetails): boolean {
  const last = tv.last_episode_to_air;
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
  watchedKeys: Set<string>,
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
      if (!watchedKeys.has(`${season}:${e}`)) {
        return { season, episode: e };
      }
    }
  }
  return null;
}
