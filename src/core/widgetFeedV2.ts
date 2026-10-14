/**
 * 🆕 **بناءُ أقسام الودجت الواحد** (v2) — دوالُّ نقيّةٌ يقرؤها مسارُ `me/widget`.
 *
 * 🔑 **لماذا خارج المسار**: المسارُ يجلب، وهذا يصوغ. الصياغةُ (أيُّ سطرٍ يُكتب، أيُّ ترتيب، أيُّ حالة اشتراك)
 * قراراتُ أحمد، فتُختبر هنا بلا شبكةٍ ولا قاعدة — ومسارٌ يخلط الاثنين لا يُختبر إلّا بحسابٍ حقيقيّ.
 */
import type { Dict } from "./i18n.ts";
import { asPlan, isPlus, type PlanBearer } from "./plan.ts";
import { sanitizeWidgetConfig, defaultWidgetConfig, type WidgetLayoutConfig } from "./widgetLayout.ts";
import type {
  WidgetActivityItem,
  WidgetFriendItem,
  WidgetLayoutEntry,
  WidgetTitle,
  WidgetToWatchItem,
  WidgetUpcomingAny,
} from "./contracts/widget.ts";

/* ───────── التخزين: `profiles.ui_state.widget` — عمودٌ بلا قيدِ شكل، فلا هجرة (نهجُ خلفيّة المحادثات D-1382) ───────── */

export interface WidgetStore {
  /** إعدادُ الودجت الجديد في أندرويد — كلُّ ودجتٍ موضوعٍ ينسخه ثمّ يُعدَّل وحدَه */
  config: WidgetLayoutConfig;
  /** تخطيطاتُ الآيفون (W40 ب) — ورقةُ «تعديل الأداة» تختار منها */
  layouts: WidgetLayoutEntry[];
}

const LAYOUT_ID = /^[a-z0-9-]{1,40}$/;
/** التخطيطُ الرئيسيُّ في الآيفون هو `config` نفسُه — تعديلُه تعديلُ ودجت أندرويد، فلا نسختان تفترقان */
export const MAIN_LAYOUT = "main";
/** سقفٌ صمّام — أحدٌ لا يحتاج أكثر، وعمودُ الحالة مشترك */
export const WIDGET_LAYOUTS_CAP = 12;

/**
 * الشكلُ المخزَّنُ كما هو — بلا تخطيطٍ افتراضيّ: `null` = لم يُخصِّص بعد (فيأخذ كلُّ قارئٍ الافتراضيّ).
 * ⚠️ **وهذا ما يحفظه `ui_state`**: لو خُزّن «الرئيسي» المولَّدُ لتجمّد اسمُه بلغة يوم الحفظ.
 */
export function sanitizeStoredWidget(raw: unknown): { config: WidgetLayoutConfig; layouts: WidgetLayoutEntry[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const config = sanitizeWidgetConfig(v.config);
  const layouts: WidgetLayoutEntry[] = [];
  const seen = new Set<string>();
  if (Array.isArray(v.layouts)) {
    for (const l of v.layouts) {
      if (!l || typeof l !== "object") continue;
      const e = l as Record<string, unknown>;
      const id = typeof e.id === "string" && LAYOUT_ID.test(e.id) ? e.id : null;
      /* «main» محجوزٌ للإعداد نفسِه — يولَّد عند القراءة ولا يُخزَّن (انظر `sanitizeWidgetStore`) */
      if (!id || id === MAIN_LAYOUT || seen.has(id)) continue;
      const name = typeof e.name === "string" ? e.name.trim().slice(0, 40) : "";
      if (!name) continue;
      seen.add(id);
      layouts.push({ id, name, config: sanitizeWidgetConfig(e.config) });
      if (layouts.length >= WIDGET_LAYOUTS_CAP) break;
    }
  }
  return { config, layouts };
}

export function sanitizeWidgetStore(raw: unknown, defaultName: string): WidgetStore {
  const stored = sanitizeStoredWidget(raw) ?? { config: defaultWidgetConfig(), layouts: [] };
  /* «الرئيسي» أوّلاً دائماً — وهو الإعدادُ نفسُه باسمه بلغة القارئ اليوم؛ والمخزَّنةُ بعده (السقفُ يشملها معاً) */
  const layouts = [{ id: MAIN_LAYOUT, name: defaultName, config: stored.config }, ...stored.layouts].slice(0, WIDGET_LAYOUTS_CAP);
  return { config: stored.config, layouts };
}

/* ───────── W41 — لوبز+ ───────── */

/** `lapsed`: كان مشتركاً وانتهى تاريخُه — يُقفل عليه ويبقى إعدادُه (رسالةُ «جدّد» لا «اشترك») */
export function widgetPlanState(p: PlanBearer | null | undefined): { plus: boolean; lapsed: boolean } {
  const plus = isPlus(p);
  if (plus || !p) return { plus, lapsed: false };
  const until = p.plus_until ? Date.parse(p.plus_until) : NaN;
  return { plus: false, lapsed: asPlan(p.plan) !== "free" && !Number.isNaN(until) && until <= Date.now() };
}

/* ───────── «للمشاهدة» (W35): الأحدثُ إضافةً أوّلاً ───────── */

export interface ToWatchSource {
  mediaType: "tv" | "movie";
  tmdbId: number;
  title: string;
  posterPath: string | null;
}

export function widgetToWatch(
  items: readonly ToWatchSource[],
  addedAt: ReadonlyMap<string, string>,
  animeIds: ReadonlySet<number>,
  ratings: ReadonlyMap<string, number>,
  t: Pick<Dict, "typeMovie" | "typeSeries" | "widgetAnime">,
  max = 3,
): WidgetToWatchItem[] {
  const key = (x: ToWatchSource) => `${x.mediaType}-${x.tmdbId}`;
  return [...items]
    /* بلا تاريخٍ في الآخر — ثمّ الثبات: الفرزُ مستقرٌّ فيحفظ ترتيبَ الرئيسيّة بين المتساويين */
    .sort((a, b) => (addedAt.get(key(b)) ?? "").localeCompare(addedAt.get(key(a)) ?? ""))
    .slice(0, max)
    .map((x) => ({
      kind: x.mediaType,
      id: x.tmdbId,
      title: x.title,
      poster_path: x.posterPath,
      type_label: x.mediaType === "movie" ? t.typeMovie : animeIds.has(x.tmdbId) ? t.widgetAnime : t.typeSeries,
      rating: ratings.get(key(x)) ?? null,
      /* «ابدأ» للمسلسل والأنمي، «شاهدته» للفيلم */
      action: x.mediaType === "movie" ? "watched" : "start",
      added_at: addedAt.get(key(x)) ?? "",
    }));
}

/* ───────── «القادم» (W32): المسلسلاتُ والأفلامُ معاً ───────── */

export interface UpcomingSource {
  media: "tv" | "movie";
  tmdbId: number;
  title: string;
  posterPath: string | null;
  date: string;
}

export function widgetUpcomingAny(
  entries: readonly UpcomingSource[],
  episodeLabel: (tmdbId: number) => string | null,
  t: Pick<Dict, "widgetPremiereMovie">,
  max = 3,
): { items: WidgetUpcomingAny[]; total: number } {
  return {
    items: entries.slice(0, max).map((e) => ({
      kind: e.media,
      id: e.tmdbId,
      title: e.title,
      poster_path: e.posterPath,
      date: e.date,
      label: e.media === "movie" ? t.widgetPremiereMovie : episodeLabel(e.tmdbId),
    })),
    total: entries.length,
  };
}

/** سطرُ «القادم» تحت البطاقات (W33): أقربُ موعد، أو «لا مواعيد» — والتاريخُ يكتبه الرسّامُ بيوم الجهاز */
export function widgetUpLine(upcoming: { items: WidgetUpcomingAny[] }): { title: WidgetUpcomingAny | null } {
  return { title: upcoming.items[0] ?? null };
}

/* ───────── «أصدقاؤك» (W32) ───────── */

export interface FriendSource {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  at: string;
  people: { name: string; avatar_url: string | null }[];
}

/** صفٌّ لكلِّ عمل (D-299) باسم أحدثِ من تحرّك عليه — ومن أخفى اسمَه لا يصير سطراً بلا صاحب */
export function widgetFriends(rows: readonly FriendSource[], t: Pick<Dict, "widgetFriendWatched">, max = 3): WidgetFriendItem[] {
  const out: WidgetFriendItem[] = [];
  for (const r of rows) {
    const who = r.people[0];
    if (!who) continue;
    out.push({
      name: who.name,
      avatar_url: who.avatar_url,
      action: t.widgetFriendWatched,
      title: { kind: r.media_type, id: r.tmdb_id, title: r.title, poster_path: r.poster_path },
      at: r.at,
    });
    if (out.length >= max) break;
  }
  return out;
}

/* ───────── «أنشطتك» (W32): نشاطُك أنت، الأحدثُ أوّلاً ───────── */

export interface ActivitySource {
  kind: "watch" | "rate" | "review" | "list";
  at: string;
  mediaType: "tv" | "movie";
  tmdbId: number;
  title: string | null;
  posterPath: string | null;
  season?: number | null;
  episode?: number | null;
  rating?: number | null;
  listName?: string | null;
}

export function widgetActivity(
  rows: readonly ActivitySource[],
  meta: ReadonlyMap<string, { title: string; poster: string | null }>,
  t: Pick<Dict, "widgetActWatched" | "widgetActRated" | "widgetActReviewed" | "widgetActListed" | "epLabel">,
  max = 3,
): WidgetActivityItem[] {
  /* 🆕 عملٌ لا يُعرف اسمُه لا يُرسم «#138843» (تسجيلُ أحمد ١٤ أكتوبر) — يسقط ويأخذ الذي بعده مكانَه */
  const named = rows.filter((r) => !!(r.title ?? meta.get(`${r.mediaType}-${r.tmdbId}`)?.title));
  return [...named]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, max)
    .map((r) => {
      const info = meta.get(`${r.mediaType}-${r.tmdbId}`);
      const name = (r.title ?? info?.title) as string;
      const title: WidgetTitle = { kind: r.mediaType, id: r.tmdbId, title: name, poster_path: r.posterPath ?? info?.poster ?? null };
      const line =
        r.kind === "watch" ? t.widgetActWatched(name)
        : r.kind === "rate" ? t.widgetActRated(name)
        : r.kind === "review" ? t.widgetActReviewed(name)
        : t.widgetActListed(name);
      const sub =
        r.kind === "watch" && r.season != null && r.episode != null ? t.epLabel(r.season, r.episode)
        : (r.kind === "rate" || r.kind === "review") && r.rating != null ? `★ ${r.rating}/10`
        : r.kind === "list" ? r.listName ?? null
        : null;
      return { line, sub, title, at: r.at };
    });
}

export { defaultWidgetConfig };
