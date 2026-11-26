import { showStatusOf, movieStatusOf, type StatusSource } from "./libraryStatus.ts";

/**
 * ====== 🆕 T530 — «بانتظار تقييمك»: ما شاهدتَه ولم تقيّمه ======
 *
 * **لماذا**: طلبُ عضوٍ نقله أحمد (٢٣ نوفمبر): «أبي أقيّم كل شي شفته لكن مافحالي أفتحها واحد واحد». في الإنتاج يومَها ٩٣٦
 * فيلماً شوهدت بلا تقييم عند ٥٤ عضواً، وأعلاهم ٢٢٨. **قرارُ أحمد**: قائمةٌ طويلةٌ تحت كلِّ عملٍ نجومُه («١أ»)، والوصولُ من
 * ثلاثة أبواب معاً (سطرٌ في «تقييماتي» والمكتبة · بطاقةٌ مدمجةٌ في الرئيسيّة «٢» · إشعارٌ أسبوعيّ)، والمتابعون يرون ما قيّمه
 * سطراً مجمّعاً («٣ب») — وهو قائمٌ أصلاً منذ T457 (`groupBareRatings`): ثلاثةُ تقييماتٍ بلا كتابةٍ في اليوم بطاقةٌ واحدة.
 *
 * 🔑 **«شاهدتَه» بقاعدة المكتبة نفسِها** (`showStatusOf`/`movieStatusOf` — «مكتمل»): الفيلمُ المُعلَّمُ مشاهَداً، والمسلسلُ
 * الذي بلغتَ آخرَ حلقةٍ عُرضت منه. **فلا تعريفٌ ثانٍ للاكتمال** — ما تسمّيه المكتبةُ «مكتمل» هو ما يُسأل عنه هنا. والمتروكُ
 * (`dropped`) ليس مكتملاً فلا يُسأل عنه.
 *
 * 🔑 **«تخطَّ» محفوظٌ في الحساب** (`ui_state.rateSkip`) لا في الجهاز: العددُ في الرئيسيّة والإشعارُ يُحسبان على الخادم، فتخطٍّ
 * لا يعرفه الخادمُ كان سيُبقي العددَ فوق العشرة إلى الأبد.
 */

/** البطاقةُ في الرئيسيّة والإشعارُ الأسبوعيّ من هذا العدد فما فوق (أحمد: «حين ينتظر ١٠ أعمال فأكثر») */
export const RATE_QUEUE_MIN = 10;
/** ✕ على بطاقة الرئيسيّة يُخفيها أسبوعاً */
export const RATE_CARD_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
/** سقفُ «تخطَّ» المحفوظ — الأقدمُ يسقط أوّلاً (مكتبةُ أكبر عضوٍ مئاتٌ لا آلاف) */
export const RATE_SKIP_CAP = 600;

export type RateKind = "tv" | "movie";

export type RateQueueItem = {
  kind: RateKind;
  id: number;
  title: string;
  poster_path: string | null;
  year: number | null;
  /** متى شوهد آخرَ مرّة (الفيلم: تعليمُه · المسلسل: آخرُ حلقة) — الأحدثُ أوّلاً */
  at: string;
  /** 🆕 أنمي (علَمُ المكتبة `follows.is_anime`، D-182): رزمةُ «الأنمي» الثالثة في التطبيق (قرارُ أحمد ٢٦ نوفمبر «٢أ»: بلا «الكلّ»،
      وأفلامٌ · مسلسلاتٌ · أنمي). اختياريٌّ لأنّ الملخّصَ لا يحتاجه، وغيابُه يعني «ليس أنمي» */
  anime?: boolean;
};

/** 🆕 الرزمُ الثلاث بترتيبها من البداية: الأفلام · المسلسلات · الأنمي — الأنمي فيلماً كان أو مسلسلاً رزمتُه الأنمي */
export type RateDeckId = "movie" | "tv" | "anime";
export const RATE_DECKS: readonly RateDeckId[] = ["movie", "tv", "anime"];
export const rateDeckOf = (r: Pick<RateQueueItem, "kind" | "anime">): RateDeckId => (r.anime ? "anime" : r.kind);

export type RateQueuePayload = {
  items: RateQueueItem[];
  total: number;
  movies: number;
  shows: number;
  /** بطاقةُ الرئيسيّة: العددُ بلغ الحدَّ ولم يُخفِها صاحبُها في أسبوعها */
  card: boolean;
};

export const rateKey = (kind: RateKind, id: number): string => `${kind}-${id}`;

const KEY_RE = /^(tv|movie)-[1-9]\d{0,9}$/;

/** «تخطَّ» كما يُخزَّن: مفاتيحُ `tv-123`/`movie-45` فريدةٌ بترتيب إضافتها، والأحدثُ آخراً */
export function sanitizeRateSkip(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out = [...new Set(v.filter((k): k is string => typeof k === "string" && KEY_RE.test(k)))];
  return out.length > RATE_SKIP_CAP ? out.slice(out.length - RATE_SKIP_CAP) : out;
}

/** حتى متى أُخفيت بطاقةُ الرئيسيّة — تاريخٌ صالحٌ أو لا شيء */
export function sanitizeRateCard(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 40) return null;
  return Number.isFinite(Date.parse(v)) ? v : null;
}

export function addRateSkip(list: readonly string[], key: string): string[] {
  return sanitizeRateSkip([...list.filter((k) => k !== key), key]);
}

export type RateSource = StatusSource & {
  tmdb_id: number;
  media_type: RateKind;
  title: string;
  poster_path: string | null;
  added_at: string;
};

/**
 * **من الوقائع إلى القائمة** — نقيٌّ ليُختبر: المكتملُ بقاعدة المكتبة، بلا تقييم، وليس في «تخطَّ»؛ الأحدثُ مشاهدةً أوّلاً.
 * `watchedMovies` تاريخُ تعليم كلِّ فيلم، و`shows` عددُ حلقات كلِّ مسلسلٍ وآخرُها.
 */
export function pickToRate(input: {
  follows: readonly RateSource[];
  shows: ReadonlyMap<number, { watched: number; last: string | null }>;
  watchedMovies: ReadonlyMap<number, string | null>;
  rated: ReadonlySet<string>;
  skipped: ReadonlySet<string>;
}): RateSource[] {
  const at = (f: RateSource): string =>
    (f.media_type === "tv" ? input.shows.get(f.tmdb_id)?.last : input.watchedMovies.get(f.tmdb_id)) || f.added_at;
  const done = input.follows.filter((f) => {
    const key = rateKey(f.media_type, f.tmdb_id);
    if (input.rated.has(key) || input.skipped.has(key)) return false;
    const status =
      f.media_type === "tv"
        ? showStatusOf(f, input.shows.get(f.tmdb_id)?.watched ?? 0)
        : movieStatusOf(f, input.watchedMovies.has(f.tmdb_id));
    return status === "completed";
  });
  return done
    .map((f) => ({ f, t: at(f) }))
    .sort((a, b) => (b.t > a.t ? 1 : b.t < a.t ? -1 : 0))
    .map((x) => x.f);
}

/** بطاقةُ الرئيسيّة: عشرةٌ فأكثر، وليست في أسبوع إخفائها */
export function rateCardShown(total: number, hiddenUntil: string | null, nowMs: number): boolean {
  if (total < RATE_QUEUE_MIN) return false;
  const until = hiddenUntil ? Date.parse(hiddenUntil) : NaN;
  return !(Number.isFinite(until) && until > nowMs);
}

/**
 * **أسبوعُ الإشعار** — مفتاحُه في `push_sent` (`rq:<user>:<week>`): الأسبوعُ يبدأ السبت بتوقيت صاحبه، فلا يرنّ مرّتين
 * في أسبوعٍ واحد ولو تبدّلت النافذة. `day` تاريخُ اليوم المحلّيّ `YYYY-MM-DD`.
 */
export function rateWeekOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return day;
  /* getUTCDay: الأحد ٠ … السبت ٦ — نرجع إلى السبت السابق (أو اليوم إن كان سبتاً) */
  const back = (d.getUTCDay() + 1) % 7;
  return new Date(d.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

/** يومُ الإشعار وساعتُه بتوقيت صاحبه: الخميس بعد السابعة مساءً — بدايةُ عطلة نهاية الأسبوع */
export const RATE_PUSH_WEEKDAY = 4;
export const RATE_PUSH_FROM_HOUR = 19;
