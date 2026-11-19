import { EDITORIAL } from "@/core/universes";
import { eventWindow, orderForYou, riyadhMonth } from "@/core/listEvents";
import { AWARDS } from "@/core/awards";
import { getDict, type Locale } from "@/core/i18n";
import { movieTheatricalDate } from "@/lib/tmdb";
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
): Promise<{ listId: string; label: string }[]> {
  const t = getDict(locale);
  const pinned = EDITORIAL.filter((e) => e.pin && curated.has(e.slug));
  const rows = await Promise.all(
    pinned.map(async (e) => {
      const date = await movieTheatricalDate(e.pin!.tmdbId).catch(() => null);
      const w = eventWindow(date, e.pin!.graceDays, now);
      if (!w.active) return null;
      const label = w.phase === "before" ? t.listEventIn(w.days) : w.phase === "today" ? t.listEventToday : t.listEventNow;
      return { listId: curated.get(e.slug)!, label };
    }),
  );
  return rows.filter((r): r is { listId: string; label: string } => r !== null);
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
  const label = new Map(pins.map((p) => [p.listId, p.label]));
  const { ids, trending } = orderForYou(
    pins.map((p) => p.listId),
    args.forYouIds,
    args.trending,
    seasonAwardLists(args.curated),
  );
  const cards = await getListCardsByIds(ids).catch(() => [] as PublicListCard[]);
  const forYou = cards.map((c) => {
    const l = label.get(c.id);
    return l ? { ...c, count_label: `${t.listCount(c.item_count)} · ${l}` } : c;
  });
  return { forYou, trending };
}
