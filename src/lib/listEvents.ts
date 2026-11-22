import { pinnedSets } from "@/core/universes";
import { eventBadge, eventWindow, orderForYou, riyadhMonth } from "@/core/listEvents";
import { AWARDS } from "@/core/awards";
import { getDict, type Locale } from "@/core/i18n";
import { getMovie, movieTheatricalDate, searchByName } from "@/lib/tmdb";
import { getListCardsByIds, type PublicListCard } from "@/lib/data";

/**
 * 🆕 442 — **قوائمُ الحدث القائمة الآن** — بابٌ واحدٌ يقرؤه الويب (`/news`) وواجهةُ التطبيق
 * (`/api/v1/discover/lists`) فلا يتباعدان (D-145).
 *
 * **الموعدُ من TMDB في كلِّ طلب** — مخبَّأٌ ساعةً في طبقة `tmdb` نفسِها، فلا نداءَ زائدٌ يُحسب،
 * **وتأجيلُ الفيلم يصل خلال ساعة** (قرار أحمد «١ ب»).
 *
 * ⚠️ **وما لا يعرفه القاموسُ أو لا قائمةَ له في القاعدة يسقط صامتاً**: بطاقةٌ مثبّتةٌ بلا قائمةٍ
 * تُفتح وعدٌ كاذب (D-217)، وفشلُ TMDB يعني «لا تثبيتَ الآن» لا خطأً في الصفحة.
 */
export async function getActiveEventLists(
  curated: Map<string, string>,
  locale: Locale,
  now = Date.now(),
): Promise<{ listId: string; label: string; badge: string; poster: string | null }[]> {
  const t = getDict(locale);
  /* 🆕 T517 — **قوائمُ الأحداث والمنسَّقةُ المثبَّتة معاً** (`pinnedSets`)، **والفيلمُ بمعرّفه أو باسمه وسنته**:
     لا مطابقةَ = لا تثبيت (D-217) — كما يسقط فشلُ TMDB صامتاً هنا */
  const pinned = pinnedSets().filter((e) => curated.has(e.slug));
  const rows = await Promise.all(
    pinned.map(async (e) => {
      const tmdbId =
        e.pin.tmdbId ?? (e.pin.film ? (await searchByName(e.pin.film.title, "movie", e.pin.film.year).catch(() => null))?.id : undefined);
      if (!tmdbId) return null;
      const date = await movieTheatricalDate(tmdbId).catch(() => null);
      const w = eventWindow(date, e.pin.graceDays, now);
      if (!w.active) return null;
      const label = w.phase === "before" ? t.listEventIn(w.days) : w.phase === "today" ? t.listEventToday : t.listEventNow;
      /* 🆕 T474 — ملصقُ الحدث: ما اختاره أحمد في `pin.poster`، وإلّا ملصقُ TMDB (مخبَّأٌ ساعةً في طبقة `tmdb`) */
      const poster = e.pin.poster ?? (await getMovie(tmdbId).catch(() => null))?.poster_path ?? null;
      return { listId: curated.get(e.slug)!, label, badge: eventBadge(w, t), poster };
    }),
  );
  return rows.filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * 🆕 T450 — **قوائمُ الجوائز في شهر حفلها** (`Award.month`): معرّفاتُها من خريطة قوائم لوبز (`award-<slug>`)،
 * بترتيب `AWARDS` نفسِه. **والغائبُ من الخريطة يسقط صامتاً** — جائزةٌ لم تُبنَ قائمتُها لا تُرفع بطاقةً فارغة (D-217).
 */
export function seasonAwardLists(curated: Map<string, string>, now = Date.now()): string[] {
  const month = riyadhMonth(now);
  return AWARDS.filter((a) => a.month === month)
    .map((a) => curated.get(`award-${a.slug}`))
    .filter((id): id is string => !!id);
}

/**
 * 🆕 442 — **رفُّ «تناسبك» بقائمة الحدث في صدره** — وصفةٌ واحدةٌ للويب وواجهة التطبيق.
 *
 * - **الحدثُ أوّلاً ولا يتكرّر**: يُحذف من «الرائجة» إن كان فيها (صفّان شخصيّان متجاوران لا يحملان
 *   البطاقةَ نفسَها — حكمُ D-366)، **ويبقى في «تناسبك»** لأن التثبيتَ هو قرارُ أحمد هنا.
 * - **وسطرُ عدّه يحمل الموعد**: «١٥ عملاً · يُعرض بعد ٢٩ يوماً» — في مكان سطر العدّ نفسِه، بلا
 *   عنصرٍ جديدٍ في البطاقة، **ويصل التطبيقَ في `count_label` بلا تحديثٍ له**.
 */
export async function forYouWithEvents(args: {
  curated: Map<string, string>;
  locale: Locale;
  forYouIds: string[];
  trending: PublicListCard[];
}): Promise<{ forYou: PublicListCard[]; trending: PublicListCard[] }> {
  const t = getDict(args.locale);
  const pins = await getActiveEventLists(args.curated, args.locale).catch(() => []);
  const event = new Map(pins.map((p) => [p.listId, { poster: p.poster, badge: p.badge }]));
  const { ids, trending } = orderForYou(
    pins.map((p) => p.listId),
    args.forYouIds,
    args.trending,
    seasonAwardLists(args.curated),
  );
  const cards = await getListCardsByIds(ids).catch(() => [] as PublicListCard[]);
  /* 🆕 T474 — **العدُّ خرج من السطر إلى الملصق** (أحمد: «اوت ان ٢٧ داي تنحط …» ثمّ «١ ج · ٢ ب»): السطرُ «16 عملاً» وحدَه، والحدثُ
     ملصقُه وشارتُه في `event` — **قاعدةٌ لكلِّ قائمة حدثٍ مثبّتة** لا لدومزداي وحدَه */
  const forYou = cards.map((c) => {
    const ev = event.get(c.id);
    /* 🆕 T486 — **لا يتكرّر الحدثُ في الغلاف** (أحمد: «ليش دومزداي جاي مرتين»): الصورُ مرتّبةٌ بالأحدث إضافةً،
       فعملُ الحدث المضافُ أخيراً يأخذ الخانةَ الأولى وملصقُه نفسُه في خانة الحدث — نُسقطه من الخانات العاديّة
       لأنّ خانةَ الحدث هي مكانُه، ويبقى العدُّ «16 عملاً» كما هو */
    return ev
      ? {
          ...c,
          posters: ev.poster ? c.posters.filter((p) => p !== ev.poster) : c.posters,
          count_label: t.listCount(c.item_count),
          event: ev,
        }
      : c;
  });
  return { forYou, trending };
}
