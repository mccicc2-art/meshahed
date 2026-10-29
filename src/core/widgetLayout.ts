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

import { lookFor, type WidgetLook } from "./widgetLook.ts";
import { defaultV3, optsFromV3, resolveV3, sanitizeV3, type WidgetV3 } from "./widgetSlots.ts";

/* 🆕 D-1571 — `cine` «الآن في السينما» آخرَ القائمة: الإعدادُ المحفوظُ قبله يُكمَل به ولا يتغيّر ترتيبُه */
export const WIDGET_SECTION_KEYS = ["search", "cont", "up", "tonight", "friends", "tw", "act", "cine"] as const;
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
  /** شكلُ الحجم الصغير: فيلمُ الليلة «بوستر» أو «قائمة» (W42)؛ و🆕 أكملُ المشاهدة «صورة» أو «قائمة» (W45) */
  small?: "poster" | "list" | "image";
  /** البحثُ وحده: «الرائج اليوم» تحت الشريط في الشكل الكامل — قائمةٌ مرقّمة افتراضاً، أو بوستراتٌ مرقّمة (W31) */
  trend?: "list" | "posters";
  /** 🆕 W54 — «أصدقاؤك» و«للمشاهدة» وحدَهما: بوستراتُ الشكل الكامل ٣ أو ٤ (٤ افتراضاً) تملأ العرض؛ النصفُ يبقى ٢ */
  posters?: 3 | 4;
}

export interface WidgetLayoutConfig {
  order: WidgetSectionKey[];
  on: Record<WidgetSectionKey, boolean>;
  opts: Record<WidgetSectionKey, WidgetSectionOpts>;
  /** ما يعرضه الحجمُ الصغير: أوّلُ قسمٍ في الترتيب أو قسمٌ يختاره (W29) */
  smallPick: "first" | WidgetSectionKey;
  /**
   * 🆕 **الودجت v3 — «الخانات»** (`widgetSlots.ts`): متى وُجد حسم المحرّكُ به وحدَه، وما فوقه (الترتيبُ والإظهارُ والأحجام) يبقى محفوظاً
   * لنسخةٍ أقدمَ من التطبيق تقرؤه. الإعدادُ المحفوظُ قبله يأخذ الافتراضيَّ عند القراءة (`sanitizeWidgetConfig`).
   */
  v3?: WidgetV3;
}

/** الترتيبُ والقيمُ الافتراضيّة لعضوٍ جديد — الأقسامُ السبعةُ ظاهرة (W29 «٤ ب») */
export function defaultWidgetConfig(): WidgetLayoutConfig {
  const full = (view: string, count: 2 | 3 = 2): WidgetSectionOpts => ({ size: "full", view, count });
  return {
    order: ["search", "cont", "up", "tonight", "friends", "tw", "act", "cine"],
    on: { search: true, cont: true, up: true, tonight: true, friends: true, tw: true, act: true, cine: true },
    opts: {
      search: { ...full("compact"), trend: "list" },
      /* 🆕 W45 — أكملُ المشاهدة الصغير صورةٌ افتراضاً (أحمد «١ أ»، ١٤ أكتوبر): نصفُ العرض والمربّعُ كفيلم الليلة */
      cont: { ...full("cards"), small: "image" },
      up: full("list"),
      /* W42 — العريضُ للكامل، والبوسترُ مع العمود للصغير */
      tonight: { ...full("wide"), small: "poster" },
      /* 🆕 W54 — أربعةُ بوسترات افتراضاً (أحمد ١٥ أكتوبر) */
      friends: { ...full("list"), posters: 4 },
      tw: { ...full("list"), posters: 4 },
      act: full("recent"),
      cine: { ...full("posters"), posters: 4 },
    },
    smallPick: "first",
  };
}

/** 🆕 v3 — الإعدادُ الافتراضيُّ بالخانات: ما يأخذه عضوٌ جديد، وما يُرسم لغير المشترك */
export function defaultWidgetConfigV3(): WidgetLayoutConfig {
  return { ...defaultWidgetConfig(), v3: defaultV3() };
}

/**
 * ارتفاعاتُ الرسم بنقاط الودجت. **مصدرٌ واحد** للمحرّك والرسّامين.
 * `pad` حشوةُ الودجت أعلى وأسفل معاً، و`gap` فاصلٌ بين قسمين (خطٌّ ومسافتان).
 * 🆕 ما يختلف بالحجم والمنصّة (صفُّ القائمة والأصدقاء، صفُّ القسمين، شبكةُ البوسترات، بطاقتا «أكمل المشاهدة») انتقل إلى
 * `widgetLook.ts` — يسافر في الخلاصة ويقرؤه الرسّامان، فتعديلُه لا يحتاج بناءً. هنا ما لا يتغيّر بالحجم.
 */
export const WIDGET_HEIGHTS = {
  pad: 24,
  /* 🆕 فاصلٌ ثابتٌ صغير (تسجيلُ أحمد ١٤ أكتوبر، بناء 75: «جايه صغار ولا يغطي المساحات») — المساحةُ تروح للمحتوى لا للفراغ */
  gap: 13,
  searchCompact: 44,
  /** الشريطُ + عنوانُ «الرائج اليوم» + صفٌّ مرقّمٌ (عمودان) — أو شبكةُ البوسترات المرقّمة نفسُها (`posterGrid`) */
  searchFull: 44 + 8 + 16 + 8 + 40,
  searchFullPosters: 44 + 8 + 16 + 8 + 130,
  /** عنوانُ القسم (٢٠) + مسافةٌ (٨) + بطاقتا ١٦:٩ بمقاسهما الأصل (٩٣، `contCard`) — W33 */
  cont: 121,
  /** رأسُ «أكمل المشاهدة» ومسافتُه — البطاقتان تحته بارتفاع `look.contCard`/`contCardTall` */
  contHead: 28,
  /** سطرُ «القادم» تحت أكمل المشاهدة: فاصلٌ + سطر (W33) */
  upLine: 22,
  /** السطرُ المختصر لقسمٍ لا يتّسع (W39) */
  line: 44,
  /* الصفُّ ٥٠ بصورة ٣٢×٤٨ وخط ١٤/١٢، والأصدقاءُ سطران بالمقاس نفسِه (المعتمدُ «أ»، ١٤ أكتوبر) — المقاساتُ في `widgetLook.ts`.
     W48 (أصدقاؤك ٥٨ في أندرويد الكبير و٥٢ في الكبير جداً، والقسمان بسطرين ١٥٠ في الكبير جداً) هناك أيضاً */
  listHeader: 24,
  /** رأسُ القسم الصغير — الجسمُ تحته (`pairRow - pairHead`) */
  pairHead: 24,
  rowGap: 0,
  /** فيلم الليلة كاملاً: هيدر ١٦:٩ بعرض الودجت (W34) */
  tonightWide: 188,
  tonightPoster: 150,
  /** 🆕 W37 · «١ ب» — شريطُ «قيّم الفيلم» بعد ✓ فيلم: يُرسم فوق الصفوف، فيحسم الرسّامُ الصفوفَ لـ(الارتفاع − الشريط − الفاصل) */
  rateStrip: 80,
} as const;

/** ارتفاعُ كلِّ حجمٍ في التصميم المعتمد — الرسّامُ يقرأ الحقيقيَّ من النظام ويمرّره بدلاً منه */
/* 🆕 D-1571 — مقاساتُ لوحات الخطّة (٤×٢ ٣٣٥×١٧٨ · ٤×٤ ٣٨٤ · ٤×٦ ٥٩٠) — المعاينةُ ترسم بها، والودجتُ يحسم بمقاسه الحقيقيّ مقسوماً على نسبة العرض */
export const WIDGET_SIZE_HEIGHT: Record<WidgetSize, number> = { small: 178, medium: 178, large: 384, xl: 590 };

/**
 * 🆕 **مقاساتُ آبل أقصرُ من أندرويد**: المتوسطُ ١٧٠ والكبيرُ ٣٧٦ على أغلب الآيفونات (الكبيرُ ٣٨٢ في Pro Max) — فالصفوفُ
 * تُحسم للآيفون بمقاسه وإلّا قُصّ آخرُها. والمعاينةُ في التطبيق تأخذ مقاسَ منصّتها من هنا أيضاً.
 */
const IOS_SIZE_HEIGHT: Record<WidgetSize, number> = { small: 170, medium: 170, large: 376, xl: 580 };
/* 🆕 D-1500 — **الكبيرُ جداً في الآيفون** (iOS 27: صفحةٌ كاملة ٤×٦، `systemExtraLargePortrait`): ٥٨٠ تقديرٌ للمعاينة
   وحدَها — الرسّامُ يقيس ارتفاعَه الحقيقيّ ويأخذ أقربَ مفتاحٍ من `heights` (حتّى ٨٠٠ أدناه)، فخطأُ التقدير لا يقصّ شيئاً. */

export function widgetSizeHeight(platform: WidgetPlatform, size: WidgetSize): number {
  return platform === "ios" ? IOS_SIZE_HEIGHT[size] : WIDGET_SIZE_HEIGHT[size];
}

const LIST_KEYS: readonly WidgetSectionKey[] = ["up", "friends", "tw", "act"];

export type WidgetRow =
  | { type: "search"; full: boolean; trend: "list" | "posters"; h: number }
  /** 🆕 W50 — `card` ارتفاعُ البطاقتين كما حُسم (٩٣ · ١٢٠)؛ `tall` يبقى لرسّامٍ أقدمَ لا يقرأ `card` */
  | { type: "cont"; upLine: boolean; tall?: boolean; card?: number; h: number }
  /** 🆕 W54 — `posters` عددُ البوسترات (٣ · ٤)؛ و🆕 W50 — `grow` ما زاده كلُّ سطرٍ (والصورةُ معه) من فراغ الودجت */
  | { type: "list"; key: WidgetSectionKey; view: "list" | "posters"; count: number; posters?: 3 | 4; grow?: number; h: number }
  | { type: "tonight"; view: "wide" | "poster"; h: number }
  /** 🆕 v3 — `views` شكلُ كلِّ نصفٍ (قائمة · بوستر) لرسّامٍ يقرؤه؛ والأقدمُ يقرأ `opts[key].view` كما كان */
  /** 🆕 D-1571 — `rows` أسطرُ كلِّ نصفٍ قائمة (أربعة مختصرة، و«أصدقاؤك» ثلاثة) */
  | { type: "pair"; keys: [WidgetSectionKey] | [WidgetSectionKey, WidgetSectionKey]; count: 2 | 3; grow?: number; views?: ("list" | "poster")[]; rows?: number[]; h: number }
  /** 🆕 D-1571 — `index` أيُّ عنصرٍ في القسم (سطرا نشاطك: الأحدثُ ثمّ الذي قبله) */
  | { type: "line"; key: WidgetSectionKey; index?: number; h: number };

export interface WidgetLayout {
  rows: WidgetRow[];
  /** أقسامٌ ظاهرةٌ في الإعداد لم تجد مكاناً ولا سطراً مختصراً */
  hidden: WidgetSectionKey[];
  /** ارتفاعُ ما رُسم مع الحشوة والفواصل */
  used: number;
}

/**
 * 🆕 ما يحسم به المحرّكُ غيرَ الإعداد: أرقامُ الشكل (`look`، من الخلاصة)، وهل يقدر الرسّامُ أن يغيّر مقاسَ عنصر (`resize`).
 * أندرويد قبل 12 (API 31) لا يقدر (`setViewLayoutHeight`) — فيُحسم له كما كان: لا تكبيرَ صفوف (W50)، وبطاقتا «أكمل المشاهدة»
 * تملآن الباقي في الرسّام (W48)، والبوستراتُ ثلاثة (W54 — الرابعُ لا مكانَ له في الواجهة الثابتة).
 */
export interface WidgetResolveOpts {
  look?: WidgetLook | null;
  resize?: boolean;
}

/** مقاساتُ الصفّ بحسب المنصّة والحجم (W48) — من `look` */
type RowSizes = ReturnType<typeof lookFor> & { resize: boolean };

function listHeight(key: WidgetSectionKey, view: string, n: number, rs: RowSizes, posters: 3 | 4 = 3): number {
  const H = WIDGET_HEIGHTS;
  if (view === "posters") return H.listHeader + (posters === 4 ? rs.posterGrid4 : rs.posterGrid);
  const row = key === "friends" ? rs.friendRow : rs.listRow;
  return H.listHeader + n * row + (n - 1) * H.rowGap;
}

/** 🆕 W54 — عددُ البوسترات: «أصدقاؤك» و«للمشاهدة» بإعدادهما (٤ افتراضاً)، والبقيّةُ ثلاثة كما كانت */
function posterCount(cfg: WidgetLayoutConfig, key: WidgetSectionKey, rs: RowSizes): 3 | 4 {
  if (key !== "friends" && key !== "tw") return 3;
  if (!rs.resize) return 3;
  return cfg.opts[key].posters === 3 ? 3 : 4;
}

function fullRow(cfg: WidgetLayoutConfig, key: WidgetSectionKey, upLine: boolean, rs: RowSizes, n?: number): WidgetRow {
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
  if (view === "posters") {
    const posters = posterCount(cfg, key, rs);
    return { type: "list", key, view, count, posters, h: listHeight(key, view, count, rs, posters) };
  }
  return { type: "list", key, view, count, h: listHeight(key, view, count, rs) };
}

type Block = { one: WidgetSectionKey } | { pair: WidgetSectionKey[] };

/** 🆕 W50 — صفُّ قسمين يكبر إن كان فيه قسمٌ بأسطر (الصورةُ العريضةُ لفيلم الليلة و«أكمل المشاهدة» تملأ خانتها بنفسها) */
function pairGrows(r: Extract<WidgetRow, { type: "pair" }>): boolean {
  return r.keys.some((k) => k !== "tonight" && k !== "cont");
}

/**
 * يرتّب الأقسامَ في الحجم المتوسط والكبير والكبير جداً.
 * القواعد بترتيبها: الصغيران المتتاليان صفٌّ واحد (W30) · ما لا يتّسع يُتخطّى ويُجرَّب ما بعده ·
 * والمتخطّى سطرٌ مختصرٌ إن اتّسع (W39) · وإن بقي فراغٌ تصير آخرُ قائمةٍ بسطرين ثلاثة (W39) ·
 * وسطرُ «القادم» تحت أكمل المشاهدة يختفي متى ظهر قسمُ «القادم» في الودجت نفسه (W33).
 */
export function resolveWidgetLayout(
  cfg: WidgetLayoutConfig,
  size: Exclude<WidgetSize, "small">,
  height = WIDGET_SIZE_HEIGHT[size],
  platform: WidgetPlatform = "ios",
  ro: WidgetResolveOpts = {},
): WidgetLayout {
  const H = WIDGET_HEIGHTS;
  const resize = ro.resize !== false;
  const rs: RowSizes = { ...lookFor(ro.look, platform, size), resize };
  /* 🆕 v3 — الخاناتُ تحسم وحدَها (`widgetSlots.ts`) */
  if (cfg.v3) {
    /* «الفارغُ» هنا ما أطفأه `resolveWidget` لأنّه بلا محتوى الآن — لا إظهارُ الإعداد القديم (لم يعد خياراً) */
    const empty = new Set(WIDGET_SECTION_KEYS.filter((k) => cfg.on[k] === false));
    const v = resolveV3(cfg.v3, size, height, rs, empty);
    return { rows: v.rows, hidden: [], used: v.used };
  }
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
        ? { type: "pair", keys: b.pair as [WidgetSectionKey] | [WidgetSectionKey, WidgetSectionKey], count: 2, h: rs.pairRow2 }
        : fullRow(cfg, b.one, upLine, rs);
      if (fits(row.h)) { push(row); keys.forEach((k) => shown.add(k)); continue; }
      /* لا يتّسع بشكله: سطرٌ مختصرٌ لكلِّ قسمٍ فيه بدل أن يختفي — والبحثُ لا سطرَ له */
      for (const k of keys) {
        if (k === "search" || !fits(H.line)) continue;
        push({ type: "line", key: k, h: H.line });
        shown.add(k);
      }
    }
    /* 🆕 W50 — **بطاقتا «أكمل المشاهدة» في الكبير بمقاسهما في ٤×٢** (أحمد ١٥ أكتوبر؛ «تُقصّ على ١٦:٩» رُفض): تكبران إلى
       `contCard` إن اتّسع — ولا تتمدّدان بعده؛ الفراغُ الباقي يذهب للأقسام الأخرى تحت. قبل كلِّ شيء: هما ما يراه أوّلاً */
    if (resize && size !== "medium") {
      const i = rows.findIndex((r) => r.type === "cont");
      const r = rows[i];
      if (r && r.type === "cont") {
        const card = rs.contCard;
        const h = H.contHead + card + (r.upLine ? H.upLine : 0);
        if (h > r.h && used - r.h + h <= height) { used += h - r.h; rows[i] = { ...r, card, tall: card >= rs.contCardTall, h }; }
      }
    }
    /* 🆕 ما زال فيه فراغ: كلُّ قائمةٍ بسطرين تصير ثلاثة من الأعلى ما اتّسع، والقسمان الصغيران كذلك —
       الفراغُ يعود صفوفاً لا مسافاتٍ بين الأقسام (تسجيلُ أحمد ١٤ أكتوبر). وما يبقى أقلُّ من صفّ. */
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let grown: WidgetRow | null = null;
      if (r.type === "list" && r.view === "list" && r.count === 2) grown = fullRow(cfg, r.key, upLine, rs, 3);
      else if (r.type === "pair" && r.count === 2) grown = { ...r, count: 3, h: rs.pairRow };
      if (grown && used - r.h + grown.h <= height) { used += grown.h - r.h; rows[i] = grown; }
    }
    /* المتوسطُ وأكملُ المشاهدة وحدَه: البطاقتان تكبران لتعبّيا ما تحتهما */
    if (size === "medium" && rows.length === 1 && rows[0].type === "cont") {
      const r = rows[0];
      const tall = H.contHead + rs.contCardTall + (r.upLine ? H.upLine : 0);
      if (used - r.h + tall <= height) { used += tall - r.h; rows[0] = { ...r, tall: true, card: rs.contCardTall, h: tall }; }
    }
    /*
     * 🆕 W50 — **الفراغُ الباقي يكبّر صفوفَ الأقسام الأخرى** (أحمد ١٥ أكتوبر) — كان يذهب لبطاقتي «أكمل المشاهدة» (W48) فتتمدّدان.
     * كلُّ سطرٍ في قائمةٍ أو في قسمين صغيرين يكبر بالقدر نفسِه والصورةُ معه، فالفاصلُ بين الصور ثابت؛ وبسقفٍ (`growMax`) —
     * فما بقي بعده (أقلُّ من سطر) يتوزّع على الفواصل كما كان. الكبيرُ والكبيرُ جداً وحدَهما: المتوسطُ قسمٌ واحدٌ بمقاسه.
     */
    if (resize && size !== "medium") {
      const units = rows.reduce((n, r) => n + (r.type === "list" && r.view === "list" ? r.count : r.type === "pair" && pairGrows(r) ? r.count : 0), 0);
      const g = units ? Math.min(rs.growMax, Math.floor((height - used) / units)) : 0;
      if (g > 0) {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (r.type === "list" && r.view === "list") rows[i] = { ...r, grow: g, h: r.h + g * r.count };
          else if (r.type === "pair" && pairGrows(r)) rows[i] = { ...r, grow: g, h: r.h + g * r.count };
          else continue;
          used += g * (rows[i] as { count: number }).count;
        }
      }
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
  if (cfg.v3) return cfg.v3.small;
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
  /* 🆕 D-1571 — الخانات: الصغيرُ ٢×٢ بوسترٌ كاملٌ ١٠٨×١٦٢ وعمودُ أزرار لكلِّ قسم (لوحة الخطّة ٢×٢) */
  if (cfg.v3) return "posterColumn";
  if (key === "tonight" && cfg.opts.tonight.small === "list") return "list";
  if (key === "cont" && cfg.opts.cont.small === "list") return "list";
  if (key !== "cont" && key !== "tonight" && key !== "tw") return "list";
  /* طوليٌّ يقبل البوسترَ بمطٍّ مقبول: البوسترُ يملأ الودجت */
  const fit = fitImage(width, height);
  if (fit?.image === "poster") return "posterFull";
  /* مربّعٌ أو قريبٌ منه: أكملُ المشاهدة صورتُها هيدر فيذوب، والبقيّةُ بوسترٌ وعمود */
  return key === "cont" ? "headerFade" : "posterColumn";
}

/**
 * W41 → 🆕 W49 — **الودجتُ مجانيٌّ والتخصيصُ لمشتركي لوبز+** (قرارُ أحمد «ج»، ١٥ أكتوبر — كان الكبيرُ مقفولاً على غير المشترك
 * والصغيرُ والمتوسطُ «أكمل المشاهدة» وحدَه): غيرُ المشترك يأخذ الودجتَ بكلِّ أحجامه **بالترتيب الأساسيّ**، والاشتراكُ يفتح
 * اختيارَ الأقسام وترتيبَها وحجمَها والتخطيطات. ومن انتهى اشتراكه يرجع للأساسيّ ويبقى تخصيصُه محفوظاً كما هو.
 */
export function widgetAccess(plus: boolean, _size: WidgetSize): "full" | "basic" {
  return plus ? "full" : "basic";
}

/** إعدادُ غيرِ المشترك: الأساسيُّ كما هو — إعدادُه الأصليُّ لا يُمسّ */
export function effectiveWidgetConfig(cfg: WidgetLayoutConfig, plus: boolean): WidgetLayoutConfig {
  /* 🆕 v3 — الأساسيُّ بالخانات (الإعدادُ القديمُ لم يعد يُرسم) */
  return plus ? cfg : defaultWidgetConfigV3();
}

/** الآيفون لا يملك الحجمَ الكبيرَ جداً (W28) — 🆕 D-1500: إلّا من iOS 27 (`iosXl`، يمرّره التطبيقُ من إصدار النظام) */
export function widgetSizesFor(platform: WidgetPlatform, iosXl = false): WidgetSize[] {
  return platform === "android" || iosXl ? ["small", "medium", "large", "xl"] : ["small", "medium", "large"];
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
        ...(k === "cont" ? { small: o.small === "list" ? "list" : "image" } : {}),
        ...(k === "search" ? { trend: o.trend === "posters" ? "posters" : "list" } : {}),
        /* 🆕 W54 — إعدادٌ محفوظٌ قبل الخيار يأخذ الافتراضيَّ الجديد (٤) */
        ...(k === "friends" || k === "tw" || k === "cine" ? { posters: o.posters === 3 ? 3 : 4 } : {}),
      };
    }
  }
  const smallPick = r.smallPick === "first" || isKey(r.smallPick) ? (r.smallPick as WidgetLayoutConfig["smallPick"]) : "first";
  /* 🆕 v3 — كلُّ إعدادٍ يُقرأ بالخانات: المحفوظُ قبلها يأخذ الافتراضيّ (الترتيبُ الحرُّ لم يعد يُرسم — الخطّةُ v3) */
  return { order, on, opts, smallPick, v3: sanitizeV3(r.v3) };
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
  /** W41 — بطاقةُ قفلٍ لا محتوى؛ 🆕 W49 فارغٌ دائماً (الودجتُ مجانيّ) ويبقى لأنّ رسّامَ بناءٍ أقدم يقرؤه */
  locked: Partial<Record<WidgetSize, boolean>>;
  small: ResolvedSmall;
  /** صفوفُ كلِّ حجمٍ بارتفاع التصميم — يقرؤها بناءُ أندرويد 74 وما قبله وحده */
  rows: Partial<Record<Exclude<WidgetSize, "small">, WidgetRow[]>>;
  /**
   * 🆕 **الصفوفُ لكلِّ ارتفاعٍ حقيقيّ** (تسجيلُ أحمد ١٤ أكتوبر: فراغٌ أسودُ تحت الودجت حين يطول، وقصٌّ حين يقصر) —
   * المفتاحُ الارتفاعُ بالنقاط كلَّ ٢٠ (أندرويد) أو ١٠ (آيفون)، والرسّامُ يأخذ أكبرَ مفتاحٍ لا يزيد على مقاسه.
   * `size` حجمُ ذلك الارتفاع (المتوسطُ قسمٌ واحد، والقفلُ للكبير وما فوقه).
   */
  heights: Record<string, { size: Exclude<WidgetSize, "small">; rows: WidgetRow[] }>;
  /** إعداداتُ الأقسام (الحجمُ والعرضُ والعدد) — الرسّامُ يقرأ منها ما لا تقوله الصفوف (شكلُ فيلم الليلة الصغير) */
  opts: WidgetLayoutConfig["opts"];
}

/** أبعادُ الصغير في التصميم المعتمد: أندرويد الطوليّ (S24 ≈ 0.70) والمربّعُ (آيفون وبعضُ المشغّلات) */
const SMALL_TALL = { w: 173, h: 246 };
const SMALL_SQUARE = { w: 170, h: 170 };

/** الارتفاعاتُ التي تُحسم لها الصفوف، وحجمُ كلٍّ منها — الحدودُ نفسُها في الرسّامَين */
const HEIGHT_STEPS: Record<WidgetPlatform, { from: number; to: number; step: number; size: (h: number) => Exclude<WidgetSize, "small"> }> = {
  /* 🆕 D-1571 — بنقاط التصميم (الرسّامُ يقسم الارتفاعَ الحقيقيّ على نسبة العرض): ٤×٢ ≈ ١٧٨ · ٤×٣ ≈ ٢٧٥ · ٤×٥ ≈ ٤٧٠ (كبيرٌ بسطرَي نشاطك)
     · ٤×٦ ≈ ٥٧٠ وما فوق (كبيرٌ جداً) — مقاساتُ جوال خالد (`claude/WIDGET-SIZES-khaled-S24U-2026-10-29.md`) */
  android: { from: 140, to: 900, step: 10, size: (h) => (h < 240 ? "medium" : h < 520 ? "large" : "xl") },
  /* 🆕 D-1500 — حتّى ٨٠٠ ليصل الكبيرُ جداً (iOS 27)، وما فوق ٤٥٠ حجمُه «xl»: الكبيرُ ٣٧٦–٣٨٢ لا يبلغه */
  ios: { from: 130, to: 800, step: 10, size: (h) => (h < 250 ? "medium" : h < 450 ? "large" : "xl") },
};

/**
 * يحسم الودجتَ للرسّامَين. `empty`: أقسامٌ بلا محتوى الآن — **تختفي ويأخذ ما بعدها مكانَها** (قرارُ أحمد «ب»، ١٤ أكتوبر)؛
 * وأكملُ المشاهدة والبحثُ لا يُعدّان فارغين (للأوّل «ابدأ عملاً»، والثاني شريط).
 */
export function resolveWidget(
  cfg: WidgetLayoutConfig,
  plus: boolean,
  platform: WidgetPlatform,
  empty: readonly WidgetSectionKey[] = [],
  ro: WidgetResolveOpts = {},
): ResolvedWidget {
  const base = effectiveWidgetConfig(cfg, plus);
  /* 🆕 v3 — الإظهارُ في الإعداد القديم لا يحكم الخانات: كلُّها «ظاهرة» إلّا الفارغ الآن (أدناه) */
  const eff: WidgetLayoutConfig = { ...base, on: base.v3 ? (Object.fromEntries(WIDGET_SECTION_KEYS.map((k) => [k, true])) as WidgetLayoutConfig["on"]) : { ...base.on } };
  for (const k of empty) if (k !== "cont" && k !== "search") eff.on[k] = false;
  const key = smallWidgetSection(eff);
  const rows: ResolvedWidget["rows"] = {};
  const locked: ResolvedWidget["locked"] = {};
  for (const size of widgetSizesFor(platform)) {
    if (size === "small") continue;
    rows[size] = resolveWidgetLayout(eff, size, widgetSizeHeight(platform, size), platform, ro).rows;
  }
  const heights: ResolvedWidget["heights"] = {};
  const st = HEIGHT_STEPS[platform];
  for (let h = st.from; h <= st.to; h += st.step) {
    const size = st.size(h);
    heights[String(h)] = { size, rows: locked[size] ? [] : resolveWidgetLayout(eff, size, h, platform, ro).rows };
  }
  return {
    locked,
    small: { key, tall: smallWidgetForm(eff, key, SMALL_TALL.w, SMALL_TALL.h), square: smallWidgetForm(eff, key, SMALL_SQUARE.w, SMALL_SQUARE.h) },
    rows,
    heights,
    /* 🆕 v3 — شكلُ القسم في خانته (بوسترٌ أو قائمة) يُكتب في خياراته: الرسّامُ القائمُ يقرأ النصفَ من هنا */
    opts: eff.v3 ? (["medium", "large", "xl"] as const).reduce((o, sz) => optsFromV3(eff.v3 as WidgetV3, o, sz), eff.opts) : eff.opts,
  };
}
