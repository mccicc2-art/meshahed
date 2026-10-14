/**
 * 🆕 **محرّكُ ترتيب الودجت الواحد** (خطّةُ الودجت v2، W28–W43).
 *
 * 🔑 **منطقٌ واحدٌ وثلاثةُ رسّامين**: أندرويد والآيفون ومعاينةُ «إعداد الودجت» يرسمون ما يقوله هذا الملفّ،
 * ولا يحسب أحدٌ منهم «ماذا يتّسع» بنفسه — لو حسب كلٌّ منهم لاختلفت الثلاثةُ عند أوّل تعديلِ ارتفاع،
 * ووعدُ «الودجتُ يملأ نفسه» (W39) يسقط بفرق بكسلات.
 *
 * ⚠️ **الارتفاعاتُ هنا جدولٌ واحد** (`WIDGET_HEIGHTS`) يقرؤه الرسّامون أيضاً — لا رقمَ ارتفاعٍ مكتوبٌ بيدٍ في
 * Kotlin أو Swift أو المعاينة.
 *
 * نقيٌّ بلا شبكةٍ ولا قاموس: المدخلُ إعدادُ الشخص وحجمُ الودجت، والمخرجُ صفوفٌ مرتّبة.
 */

export const WIDGET_SECTION_KEYS = ["search", "cont", "up", "tonight", "friends", "tw", "act"] as const;
export type WidgetSectionKey = (typeof WIDGET_SECTION_KEYS)[number];

/** أندرويد: صغير ٢×٢ · متوسط ٤×٢ · كبير ٤×٤ · كبير جداً ٤×٦ (أندرويد وحده، W28) */
export type WidgetSize = "small" | "medium" | "large" | "xl";
export type WidgetPlatform = "android" | "ios";

export interface WidgetSectionOpts {
  /** W30 — «صغير» نصفُ العرض؛ قسمان صغيران متتاليان يتشاركان صفّاً */
  size: "full" | "small";
  /** شكلُ العرض الكامل — قائمةٌ أو بوسترات (والبحث: مختصر/كامل، وفيلم الليلة: عريض/بوستر) */
  view: string;
  /** عددُ أسطر القائمة في الحجم الكامل — الصغيرُ ثابت (W30) */
  count: 2 | 3;
  /** فيلم الليلة وحده: شكلُه الصغير (W42) */
  small?: "poster" | "list";
  /** البحثُ وحده: «الرائج اليوم» تحت الشريط في الشكل الكامل — قائمةٌ مرقّمة افتراضاً، أو بوستراتٌ مرقّمة (W31) */
  trend?: "list" | "posters";
}

export interface WidgetLayoutConfig {
  order: WidgetSectionKey[];
  on: Record<WidgetSectionKey, boolean>;
  opts: Record<WidgetSectionKey, WidgetSectionOpts>;
  /** ما يعرضه الحجمُ الصغير: أوّلُ قسمٍ في الترتيب أو قسمٌ يختاره (W29) */
  smallPick: "first" | WidgetSectionKey;
}

/** الترتيبُ والقيمُ الافتراضيّة لعضوٍ جديد — الأقسامُ السبعةُ ظاهرة (W29 «٤ ب») */
export function defaultWidgetConfig(): WidgetLayoutConfig {
  const full = (view: string, count: 2 | 3 = 2): WidgetSectionOpts => ({ size: "full", view, count });
  return {
    order: ["search", "cont", "up", "tonight", "friends", "tw", "act"],
    on: { search: true, cont: true, up: true, tonight: true, friends: true, tw: true, act: true },
    opts: {
      search: { ...full("compact"), trend: "list" },
      cont: full("cards"),
      up: full("list"),
      /* W42 — العريضُ للكامل، والبوسترُ مع العمود للصغير */
      tonight: { ...full("wide"), small: "poster" },
      friends: full("list"),
      tw: full("list"),
      act: full("recent"),
    },
    smallPick: "first",
  };
}

/**
 * ارتفاعاتُ الرسم بنقاط الودجت. **مصدرٌ واحد** للمحرّك والرسّامين.
 * `pad` حشوةُ الودجت أعلى وأسفل معاً، و`gap` فاصلٌ بين قسمين (خطٌّ ومسافتان).
 */
export const WIDGET_HEIGHTS = {
  pad: 24,
  gap: 21,
  searchCompact: 44,
  /** الشريطُ + عنوانُ «الرائج اليوم» + صفٌّ مرقّمٌ (عمودان) — أو شبكةُ البوسترات المرقّمة نفسُها (`posterGrid`) */
  searchFull: 44 + 8 + 16 + 8 + 40,
  searchFullPosters: 44 + 8 + 16 + 8 + 130,
  /** عنوانُ القسم + بطاقتا ١٦:٩ (W33) */
  cont: 121,
  /** سطرُ «القادم» تحت أكمل المشاهدة: فاصلٌ + سطر (W33) */
  upLine: 26,
  /** صفُّ القسمين الصغيرين (W30) */
  pairRow: 176,
  /** السطرُ المختصر لقسمٍ لا يتّسع (W39) */
  line: 44,
  listHeader: 28,
  listRow: 44,
  friendRow: 30,
  rowGap: 8,
  posterGrid: 130,
  /** فيلم الليلة كاملاً: هيدر ١٦:٩ بعرض الودجت (W34) */
  tonightWide: 188,
  tonightPoster: 150,
} as const;

/** ارتفاعُ كلِّ حجمٍ في التصميم المعتمد — الرسّامُ يقرأ الحقيقيَّ من النظام ويمرّره بدلاً منه */
export const WIDGET_SIZE_HEIGHT: Record<WidgetSize, number> = { small: 172, medium: 188, large: 440, xl: 720 };

/**
 * 🆕 **مقاساتُ آبل أقصرُ من أندرويد**: المتوسطُ ١٧٠ والكبيرُ ٣٧٦ على أغلب الآيفونات (الكبيرُ ٣٨٢ في Pro Max) — فالصفوفُ
 * تُحسم للآيفون بمقاسه وإلّا قُصّ آخرُها. والمعاينةُ في التطبيق تأخذ مقاسَ منصّتها من هنا أيضاً.
 */
const IOS_SIZE_HEIGHT: Record<WidgetSize, number> = { small: 170, medium: 170, large: 376, xl: 376 };

export function widgetSizeHeight(platform: WidgetPlatform, size: WidgetSize): number {
  return platform === "ios" ? IOS_SIZE_HEIGHT[size] : WIDGET_SIZE_HEIGHT[size];
}

const LIST_KEYS: readonly WidgetSectionKey[] = ["up", "friends", "tw", "act"];

export type WidgetRow =
  | { type: "search"; full: boolean; trend: "list" | "posters"; h: number }
  | { type: "cont"; upLine: boolean; h: number }
  | { type: "list"; key: WidgetSectionKey; view: "list" | "posters"; count: number; h: number }
  | { type: "tonight"; view: "wide" | "poster"; h: number }
  | { type: "pair"; keys: [WidgetSectionKey] | [WidgetSectionKey, WidgetSectionKey]; h: number }
  | { type: "line"; key: WidgetSectionKey; h: number };

export interface WidgetLayout {
  rows: WidgetRow[];
  /** أقسامٌ ظاهرةٌ في الإعداد لم تجد مكاناً ولا سطراً مختصراً */
  hidden: WidgetSectionKey[];
  /** ارتفاعُ ما رُسم مع الحشوة والفواصل */
  used: number;
}

function listHeight(key: WidgetSectionKey, view: string, n: number): number {
  const H = WIDGET_HEIGHTS;
  if (view === "posters") return H.listHeader + H.posterGrid;
  const row = key === "friends" ? H.friendRow : H.listRow;
  return H.listHeader + n * row + (n - 1) * H.rowGap;
}

function fullRow(cfg: WidgetLayoutConfig, key: WidgetSectionKey, upLine: boolean, n?: number): WidgetRow {
  const H = WIDGET_HEIGHTS;
  const o = cfg.opts[key];
  if (key === "search") {
    const full = o.view === "full";
    const trend = o.trend === "posters" ? "posters" : "list";
    return { type: "search", full, trend, h: !full ? H.searchCompact : trend === "posters" ? H.searchFullPosters : H.searchFull };
  }
  if (key === "cont") return { type: "cont", upLine, h: H.cont + (upLine ? H.upLine : 0) };
  if (key === "tonight") {
    const wide = o.view !== "poster";
    return { type: "tonight", view: wide ? "wide" : "poster", h: wide ? H.tonightWide : H.tonightPoster };
  }
  const view = o.view === "posters" ? "posters" : "list";
  const count = n ?? o.count;
  return { type: "list", key, view, count, h: listHeight(key, view, count) };
}

type Block = { one: WidgetSectionKey } | { pair: WidgetSectionKey[] };

/**
 * يرتّب الأقسامَ في الحجم المتوسط والكبير والكبير جداً.
 * القواعد بترتيبها: الصغيران المتتاليان صفٌّ واحد (W30) · ما لا يتّسع يُتخطّى ويُجرَّب ما بعده ·
 * والمتخطّى سطرٌ مختصرٌ إن اتّسع (W39) · وإن بقي فراغٌ تصير آخرُ قائمةٍ بسطرين ثلاثة (W39) ·
 * وسطرُ «القادم» تحت أكمل المشاهدة يختفي متى ظهر قسمُ «القادم» في الودجت نفسه (W33).
 */
export function resolveWidgetLayout(cfg: WidgetLayoutConfig, size: Exclude<WidgetSize, "small">, height = WIDGET_SIZE_HEIGHT[size]): WidgetLayout {
  const H = WIDGET_HEIGHTS;
  let visible = cfg.order.filter((k) => cfg.on[k]);
  /* المتوسطُ قسمٌ واحدٌ بحجمه الكامل، والبحثُ لا يكون وحدَه ودجتاً */
  if (size === "medium") visible = visible.filter((k) => k !== "search").slice(0, 1);

  const blocks: Block[] = [];
  for (let i = 0; i < visible.length; i++) {
    const k = visible[i];
    const small = size !== "medium" && k !== "search" && cfg.opts[k].size === "small";
    if (!small) { blocks.push({ one: k }); continue; }
    const next = visible[i + 1];
    if (next && next !== "search" && cfg.opts[next].size === "small") { blocks.push({ pair: [k, next] }); i++; }
    else blocks.push({ pair: [k] });
  }

  const lay = (upLine: boolean): WidgetLayout => {
    const rows: WidgetRow[] = [];
    const shown = new Set<WidgetSectionKey>();
    let used = H.pad;
    const push = (r: WidgetRow) => { used += r.h + (rows.length ? H.gap : 0); rows.push(r); };
    const fits = (h: number) => used + h + (rows.length ? H.gap : 0) <= height;

    for (const b of blocks) {
      const keys = "pair" in b ? b.pair : [b.one];
      const row: WidgetRow = "pair" in b
        ? { type: "pair", keys: b.pair as [WidgetSectionKey] | [WidgetSectionKey, WidgetSectionKey], h: H.pairRow }
        : fullRow(cfg, b.one, upLine);
      if (fits(row.h)) { push(row); keys.forEach((k) => shown.add(k)); continue; }
      /* لا يتّسع بشكله: سطرٌ مختصرٌ لكلِّ قسمٍ فيه بدل أن يختفي — والبحثُ لا سطرَ له */
      for (const k of keys) {
        if (k === "search" || !fits(H.line)) continue;
        push({ type: "line", key: k, h: H.line });
        shown.add(k);
      }
    }
    /* ما زال فيه فراغُ سطر: آخرُ قائمةٍ بسطرين تصير ثلاثة */
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r.type !== "list" || r.view !== "list" || r.count !== 2) continue;
      const grown = fullRow(cfg, r.key, upLine, 3);
      if (used - r.h + grown.h <= height) { used += grown.h - r.h; rows[i] = grown; }
      break;
    }
    return { rows, hidden: visible.filter((k) => !shown.has(k)), used };
  };

  const first = lay(false);
  const contShown = first.rows.some((r) => r.type === "cont");
  const upShown = !first.hidden.includes("up") && visible.includes("up");
  if (!contShown || upShown) return first;
  return lay(true);
}

/** ما يعرضه الحجمُ الصغير: القسمُ المختار، أو أوّلُ قسمٍ ظاهرٍ غيرِ البحث، وإلّا أكملُ المشاهدة */
export function smallWidgetSection(cfg: WidgetLayoutConfig): WidgetSectionKey {
  if (cfg.smallPick !== "first" && cfg.on[cfg.smallPick] && cfg.smallPick !== "search") return cfg.smallPick;
  return cfg.order.find((k) => cfg.on[k] && k !== "search") ?? "cont";
}

/**
 * W38 — **الصورةُ لا تُكبَّر ولا يُترك حولها فراغ**: صورُ TMDB شكلان فقط (بوستر ٢:٣ وهيدر ١٦:٩)،
 * فالخانةُ تختار الأقربَ وتمطّه للمقاس. المطُّ ٥٪ أساساً وحتّى ٨٪ عند الحاجة، وما زاد ليس مطّاً بل تشويه
 * — فيرجع `null` ويأخذ الرسّامُ شكلاً آخرَ للخانة (العمود أو الهيدر الذائب).
 */
export const WIDGET_STRETCH = { base: 0.05, max: 0.08 } as const;
export const POSTER_RATIO = 2 / 3;
export const BACKDROP_RATIO = 16 / 9;

export function stretchOf(slotRatio: number, imageRatio: number): number {
  return Math.abs(slotRatio / imageRatio - 1);
}

export function fitImage(width: number, height: number, limit: number = WIDGET_STRETCH.max): { image: "poster" | "backdrop"; stretch: number } | null {
  if (!(width > 0 && height > 0)) return null;
  const r = width / height;
  const poster = stretchOf(r, POSTER_RATIO);
  const backdrop = stretchOf(r, BACKDROP_RATIO);
  const best = poster <= backdrop ? { image: "poster" as const, stretch: poster } : { image: "backdrop" as const, stretch: backdrop };
  return best.stretch <= limit ? best : null;
}

/**
 * شكلُ الحجم الصغير لكلِّ قسم (W33 · W34 · W35 · W43).
 * - `posterFull` البوسترُ يملأ الودجت (أندرويد الطوليّ: شكلُ فيلم الليلة القديم + ✓)
 * - `posterColumn` بوسترٌ كاملٌ بطول الودجت وعمودٌ بجانبه (المربّع: فيلم الليلة وللمشاهدة)
 * - `headerFade` الهيدرُ كاملاً بعرض الودجت يذوب في الأسود (أكمل المشاهدة في المربّع)
 * - `list` قائمةٌ (بقيّةُ الأقسام، وفيلم الليلة إن اختارها)
 */
export type WidgetSmallForm = "posterFull" | "posterColumn" | "headerFade" | "list";

export function smallWidgetForm(cfg: WidgetLayoutConfig, key: WidgetSectionKey, width: number, height: number): WidgetSmallForm {
  if (key === "tonight" && cfg.opts.tonight.small === "list") return "list";
  if (key !== "cont" && key !== "tonight" && key !== "tw") return "list";
  /* طوليٌّ يقبل البوسترَ بمطٍّ مقبول: البوسترُ يملأ الودجت */
  const fit = fitImage(width, height);
  if (fit?.image === "poster") return "posterFull";
  /* مربّعٌ أو قريبٌ منه: أكملُ المشاهدة صورتُها هيدر فيذوب، والبقيّةُ بوسترٌ وعمود */
  return key === "cont" ? "headerFade" : "posterColumn";
}

/**
 * W41 — **الودجتُ لمشتركي لوبز+**: غيرُ المشترك يرى أكملَ المشاهدة في الصغير والمتوسّط وحدَهما،
 * وما عداه مقفول (لمستُه تفتح الاشتراك). ومن انتهى اشتراكه يُقفل عليه ويبقى إعدادُه محفوظاً كما هو.
 */
export function widgetAccess(plus: boolean, size: WidgetSize): "full" | "continueOnly" | "locked" {
  if (plus) return "full";
  return size === "small" || size === "medium" ? "continueOnly" : "locked";
}

/** إعدادُ غيرِ المشترك: أكملُ المشاهدة وحدَه، بلا تخصيص — إعدادُه الأصليُّ لا يُمسّ */
export function effectiveWidgetConfig(cfg: WidgetLayoutConfig, plus: boolean): WidgetLayoutConfig {
  if (plus) return cfg;
  const base = defaultWidgetConfig();
  const on = Object.fromEntries(WIDGET_SECTION_KEYS.map((k) => [k, k === "cont"])) as Record<WidgetSectionKey, boolean>;
  return { ...base, on, order: ["cont", ...base.order.filter((k) => k !== "cont")], smallPick: "cont" };
}

/** الآيفون لا يملك الحجمَ الكبيرَ جداً (W28) */
export function widgetSizesFor(platform: WidgetPlatform): WidgetSize[] {
  return platform === "android" ? ["small", "medium", "large", "xl"] : ["small", "medium", "large"];
}

/** يُصلح إعداداً قادماً من التخزين: مفاتيحُ مجهولةٌ تسقط، والناقصةُ تأخذ الافتراضيّ، والترتيبُ يحوي السبعةَ مرّةً واحدة */
export function sanitizeWidgetConfig(raw: unknown): WidgetLayoutConfig {
  const base = defaultWidgetConfig();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Record<keyof WidgetLayoutConfig, unknown>>;
  const isKey = (k: unknown): k is WidgetSectionKey => typeof k === "string" && (WIDGET_SECTION_KEYS as readonly string[]).includes(k);
  const seen = new Set<WidgetSectionKey>();
  const order: WidgetSectionKey[] = [];
  if (Array.isArray(r.order)) for (const k of r.order) if (isKey(k) && !seen.has(k)) { seen.add(k); order.push(k); }
  for (const k of base.order) if (!seen.has(k)) order.push(k);
  const on = { ...base.on };
  if (r.on && typeof r.on === "object") for (const [k, v] of Object.entries(r.on)) if (isKey(k) && typeof v === "boolean") on[k] = v;
  const opts = { ...base.opts };
  if (r.opts && typeof r.opts === "object") {
    for (const [k, v] of Object.entries(r.opts as Record<string, unknown>)) {
      if (!isKey(k) || !v || typeof v !== "object") continue;
      const o = v as Partial<WidgetSectionOpts>;
      opts[k] = {
        size: o.size === "small" && k !== "search" ? "small" : "full",
        view: typeof o.view === "string" ? o.view : base.opts[k].view,
        count: o.count === 3 ? 3 : 2,
        ...(k === "tonight" ? { small: o.small === "list" ? "list" : "poster" } : {}),
        ...(k === "search" ? { trend: o.trend === "posters" ? "posters" : "list" } : {}),
      };
    }
  }
  const smallPick = r.smallPick === "first" || isKey(r.smallPick) ? (r.smallPick as WidgetLayoutConfig["smallPick"]) : "first";
  return { order, on, opts, smallPick };
}

export const LIST_SECTION_KEYS = LIST_KEYS;

/* ───────── 🆕 ما يُكتب للرسّامَين الأصليّين (§11.2: «الرسّامُ يرسم ما تقوله الخلاصة») ───────── */

/** الحجمُ الصغيرُ محسوماً: القسمُ وشكلُه في الشكلين اللذين يقع عليهما المشغِّل (طوليٌّ ومربّع، W43) */
export interface ResolvedSmall {
  key: WidgetSectionKey;
  tall: WidgetSmallForm;
  square: WidgetSmallForm;
}

export interface ResolvedWidget {
  /** W41 — غيرُ المشترك في الكبير والكبير جداً: بطاقةُ قفلٍ لا محتوى */
  locked: Partial<Record<WidgetSize, boolean>>;
  small: ResolvedSmall;
  /** صفوفُ كلِّ حجمٍ بارتفاع التصميم — الرسّامُ يرسمها بالترتيب ويترك آخرَها يأخذ ما بقي */
  rows: Partial<Record<Exclude<WidgetSize, "small">, WidgetRow[]>>;
  /** إعداداتُ الأقسام (الحجمُ والعرضُ والعدد) — الرسّامُ يقرأ منها ما لا تقوله الصفوف (شكلُ فيلم الليلة الصغير) */
  opts: WidgetLayoutConfig["opts"];
}

/** أبعادُ الصغير في التصميم المعتمد: أندرويد الطوليّ (S24 ≈ 0.70) والمربّعُ (آيفون وبعضُ المشغّلات) */
const SMALL_TALL = { w: 173, h: 246 };
const SMALL_SQUARE = { w: 170, h: 170 };

export function resolveWidget(cfg: WidgetLayoutConfig, plus: boolean, platform: WidgetPlatform): ResolvedWidget {
  const eff = effectiveWidgetConfig(cfg, plus);
  const key = smallWidgetSection(eff);
  const rows: ResolvedWidget["rows"] = {};
  const locked: ResolvedWidget["locked"] = {};
  for (const size of widgetSizesFor(platform)) {
    if (size === "small") continue;
    if (widgetAccess(plus, size) === "locked") { locked[size] = true; continue; }
    rows[size] = resolveWidgetLayout(eff, size, widgetSizeHeight(platform, size)).rows;
  }
  return {
    locked,
    small: { key, tall: smallWidgetForm(eff, key, SMALL_TALL.w, SMALL_TALL.h), square: smallWidgetForm(eff, key, SMALL_SQUARE.w, SMALL_SQUARE.h) },
    rows,
    opts: eff.opts,
  };
}
