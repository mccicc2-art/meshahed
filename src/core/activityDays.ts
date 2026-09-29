/**
 * ====== أيّامُ النشاط — قواعدُ شاشة `/activity` الخالصة (🆕 Phase 11-N · N1) ======
 *
 * نُقلت من `components/ActivityScreen.tsx` حرفاً كي يقرأها التطبيقُ (تبويبُ «النشاط» في ملفّ الشخص الأصليّ) والويبُ معاً:
 * الرقاقاتُ وشرطُها، ومفاتيحُ الأيّام بتوقيت القارئ، ودمجُ حلقات اليوم الواحد في مدى، والساعة — **قاعدةٌ واحدةٌ لقارئَين**
 * (القاعدة ٣). لا استيرادَ هنا إلّا القاموس.
 */
import type { Dict, Locale } from "./i18n";
export type ActivityKind = "watch" | "rate" | "review" | "list";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** لحظةُ الفعل — ISO من الخادم */
  at: string;
  mediaType: "tv" | "movie";
  tmdbId: number;
  title: string;
  /** رابطٌ جاهز — العميلُ لا يعرف قاعدةَ صور TMDB */
  poster: string | null;
  season?: number | null;
  episode?: number | null;
  rating?: number | null;
  listName?: string | null;
}

export type Scope = "all" | "watch" | "rate" | "review" | "list";
export const SCOPES: Scope[] = ["all", "watch", "rate", "review", "list"];


export function label(s: Scope, t: Dict): string {
  return s === "all"
    ? t.searchTabAll
    : s === "watch"
      ? t.activityTabWatched
      : s === "rate"
        ? t.activityTabRatings
        : s === "review"
          ? t.activityTabReviews
          : t.searchTabLists;
}

/**
 * **الرقاقةُ تسأل «ما نوعُ هذا الفعل؟»** — **و«تقييمات» تشمل الرأيَ ذا
 * النجمة**: من كتب رأياً وأعطى تسعةً **قيّم فعلاً**، **وإخفاؤه عن
 * رقاقة التقييمات كذبٌ صغير** (D-374). **و«آراء» وحدَها النصّ.**
 */
export function keep(it: ActivityItem, scope: Scope): boolean {
  if (scope === "all") return true;
  if (scope === "rate") return it.rating != null && (it.kind === "rate" || it.kind === "review");
  return it.kind === scope;
}

/**
 * 🔴 🆕 **مفتاحُ يومِ القارئ الآن** (D-656، بلاغُ أحمد: «فيه أشياء
 * عملتها قبل أسبوع وموجودة إني عملتها اليوم»).
 *
 * 🔴 **والعطلُ كان أن الشاشةَ بلا «الآن»**: «اليوم» كانت تُعرَّف **يومَ
 * أحدثِ صفٍّ معروض** — **فأحدثُ صفٍّ يُوسَم «اليوم» مهما شاخ**، ورأيٌ
 * كُتب في ١٨ أغسطس قُرئ «اليوم» في ٢٦ منه. **وتحته «هذا الأسبوع: صفر
 * نشاط»** لأن العدّادَ كان يقيس من أحدثِ صفٍّ **غيرِ مصفّى** —
 * **مبدآن للزمن في شاشةٍ واحدةٍ يتناقضان أمام القارئ** (D-145/D-374).
 *
 * 🔑 **والقاعدةُ «لا `Date.now()` في مكوّن» صحيحةٌ وسببُها الترطيب** —
 * **والعلاجُ ليس التخلّي عن «الآن» بل قراءتُه بالآلة التي في الملفّ
 * أصلاً**: `useSyncExternalStore` تعطي الخادمَ لقطةً والمتصفّحَ أخرى
 * بلا تحذيرِ ترطيب — **وهي بعينها ما يُقسَم بها اليومُ هنا منذ يومه.**
 * **فالخادمُ يحسب بـUTC والمتصفّحُ بساعة صاحبه، وكلاهما «الآن».**
 */
export function nowDayKey(local: boolean): string {
  return dayKey(new Date().toISOString(), local);
}

export interface DayGroup {
  key: string;
  label: string;
  rows: ActivityItem[];
}

/**
 * **يومٌ لكلِّ مجموعة، وحلقاتُ المسلسل الواحد فيه صفٌّ واحد.**
 *
 * **والدمجُ هنا لا في الخادم** لأن حدَّ اليوم نفسَه يتبدّل بالترطيب —
 * **ودمجٌ محسوبٌ على يومٍ خاطئ يُخرج مدًى خاطئاً.**
 */
export function groupDays(
  items: ActivityItem[],
  local: boolean,
  t: Dict,
  locale: Locale,
  todayKey: string,
): DayGroup[] {
  const byDay = new Map<string, ActivityItem[]>();
  for (const it of items) {
    const key = dayKey(it.at, local);
    const list = byDay.get(key);
    if (list) list.push(it);
    else byDay.set(key, [it]);
  }

  /* 🔴 **«اليوم» يومُ القارئ لا يومُ أحدثِ صفّ** (D-656): **كان
     `items[0]`** — **فأحدثُ صفٍّ يلبس «اليوم» ولو مضى عليه شهر**،
     **ورقاقةٌ تُبدِّل المعروضَ كانت تُبدِّل معنى «اليوم» نفسَه.** */
  const today = todayKey;
  const yesterday = shiftDay(today, -1);

  return [...byDay.entries()].map(([key, rows]) => ({
    key,
    label:
      key === today
        ? t.diaryToday
        : key === yesterday
          ? t.diaryYesterday
          : dayLabel(key, locale),
    rows: mergeEpisodes(rows, t),
  }));
}

/** مفتاحُ اليوم — بساعة القارئ بعد الترطيب، وبـUTC قبله */
export function dayKey(iso: string, local: boolean): string {
  const d = new Date(iso);
  if (!local) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDay(key: string, by: number): string {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, (d ?? 1) + by);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function dayLabel(key: string, locale: Locale): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** حلقاتُ مسلسلٍ واحدٍ في يومٍ واحد → صفٌّ واحدٌ بمداه (وصفةُ اليوميات) */
export function mergeEpisodes(rows: ActivityItem[], t: Dict): ActivityItem[] {
  const out: ActivityItem[] = [];
  const seen = new Map<number, number>();
  for (const r of rows) {
    if (r.kind !== "watch" || r.mediaType !== "tv" || r.episode == null) {
      out.push(r);
      continue;
    }
    const at = seen.get(r.tmdbId);
    if (at === undefined) {
      seen.set(r.tmdbId, out.length);
      out.push({ ...r });
      continue;
    }
    const head = out[at];
    const from = Math.min(head.episode ?? 0, r.episode);
    const to = Math.max(head.episode ?? 0, r.episode);
    /* **والموسمُ موسمُ الرأس** — ومن شاهد موسمين في يوم يرى مداً واحداً
       بموسم الأحدث؛ **وهو ما كانت تفعله اليومياتُ حرفاً.** */
    out[at] = {
      ...head,
      episode: to,
      season: head.season,
      listName: t.actEpisodeRange(head.season ?? 0, from, to),
    };
  }
  return out;
}

/** الساعةُ بتوقيت القارئ بعد الترطيب — وبـUTC في أوّل رسمةِ خادم */
export function clock(iso: string, locale: Locale, local: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: local ? undefined : "UTC",
  }).format(d);
}

/** فعلُ الصفّ («أنهى» · «شاهد» · «قيّم» · «راجع» · «أضاف») — `Row` الويب */
export function verbOf(item: ActivityItem, t: Dict): string {
  return item.kind === "watch"
    ? item.mediaType === "tv"
      ? t.actVerbFinished
      : t.actVerbWatched
    : item.kind === "rate"
      ? t.actVerbRated
      : item.kind === "review"
        ? t.actVerbReviewed
        : t.actVerbAdded;
}

/** مدى الحلقات يسكن `listName` بعد الدمج — وإلّا فحلقةٌ واحدة */
export function episodeOf(item: ActivityItem, t: Dict): string | null {
  return item.kind === "watch" && item.mediaType === "tv"
    ? (item.listName ?? (item.season != null && item.episode != null ? t.diaryEpisode(item.season, item.episode) : null))
    : null;
}
