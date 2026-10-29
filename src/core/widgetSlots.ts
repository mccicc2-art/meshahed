/**
 * 🆕 **الودجت v3 — «الخانات»** (خطّةُ `claude/PLAN-WIDGETS-v3-templates.md`، خالد ٢٨ أكتوبر: «ما ابغى تمطيط وضغط كل شيء يظهر مثل
 * ما حنا محددين كيف يكون شكله»). يحلّ محلّ الترتيب الحرّ (W28–W55) ويكتب **أنواعَ الصفوف نفسَها** (`WidgetRow`) — فالرسّامان القائمان
 * يرسمانه بلا بناء، والخلاصةُ تبقى بشكلها.
 *
 * 🔑 **القواعد** (كلُّ واحدةٍ قرارٌ موثّق في الخطّة):
 * - فوقُ «أكمل المشاهدة» ومعه سطرُ «القادم» — ثابتٌ في الكبير والكبير جداً، واختيارٌ في المتوسط (هو أو خانة).
 * - **الخانة** صفٌّ ثابت: قسمٌ كامل، أو **نصّان** (قسمان مختلفان جنب بعض). وكلُّ قسمٍ **قائمة أو بوستر**؛ فيلمُ الليلة بوسترٌ دائماً.
 * - الكبير خانة، والكبير جداً خانتان و**سطرٌ أخير** (نشاطك افتراضاً) — لا سطورَ تعبئةٍ صغيرةٌ لأقسامٍ أخرى (خالد ٢١:٢٠).
 * - **«القادم» في خانة ⇒ يختفي سطرُه تحت أكمل المشاهدة** (لا يتكرّر) ويأخذ نشاطُك مكانَه تحت (خالد ٢١:٤٥).
 * - الصورُ لا تتمدّد (`grow` صفر): ما بقي من الارتفاع يتوزّع على الفواصل في الرسّام. وما لا يتّسع يصير سطراً مختصراً ثمّ يسقط.
 * - لا قسمَ مرّتين في ودجتٍ واحد.
 *
 * نقيٌّ بلا شبكة: المدخلُ الإعدادُ والحجمُ والارتفاعُ وأرقامُ الشكل، والمخرجُ صفوف.
 */

import type { WidgetLookSize } from "./widgetLook.ts";
import type { WidgetPlatform, WidgetRow, WidgetSectionKey, WidgetSectionOpts, WidgetSize } from "./widgetLayout.ts";

/** ما يدخل الخانة — البحثُ خرج من الودجت (خالد ١٦:٢٠)، و«أكمل المشاهدة» فوقها دائماً */
/* 🆕 D-1571 — «الآن في السينما» (`cine`، خالد ٢٩ أكتوبر): قسمُ بوسترٍ في كلِّ الأحجام كالبقيّة */
export const SLOT_SECTIONS = ["friends", "act", "up", "tw", "tonight", "cine"] as const;
export type SlotSection = (typeof SLOT_SECTIONS)[number];
/** الصغيرُ قسمٌ واحد: بوسترٌ كاملٌ وعمود */
export const SMALL_SECTIONS = ["cont", "up", "tonight", "friends", "cine"] as const;
export type SmallSection = (typeof SMALL_SECTIONS)[number];

export interface SlotPart {
  s: SlotSection;
  v: "list" | "poster";
}
export interface WidgetSlot {
  mode: "full" | "pair";
  /** القسمُ الكامل، أو النصفُ الأوّل (اليمين في العربيّة) */
  a: SlotPart;
  /** النصفُ الثاني — محفوظٌ حتى والخانةُ كاملة، فالرجوعُ إلى «نصّين» يعيده كما كان */
  b: SlotPart;
}
export interface WidgetV3 {
  small: SmallSection;
  medium: { top: boolean; slot: WidgetSlot };
  large: { slot: WidgetSlot };
  xl: { slots: [WidgetSlot, WidgetSlot]; line: SlotSection };
}

/** فيلمُ الليلة والسينما بوسترٌ دائماً — لا اختيارَ شكلٍ لهما */
export const POSTER_ONLY: readonly SlotSection[] = ["tonight", "cine"];
const part = (s: SlotSection, v: SlotPart["v"] = "list"): SlotPart => ({ s, v: POSTER_ONLY.includes(s) ? "poster" : v });

/**
 * الإعدادُ الافتراضيّ. 🆕 D-1571 — الكبيرُ جداً (خالد ٢٩ أكتوبر ١٤:١٦: «اصدقائك نص مكان للمشاهدة .. وفي السينما ياخذ مكان كامل له»):
 * أكمل المشاهدة + القادم · نص أصدقاؤك + نص فيلم الليلة · السينما خانةٌ كاملة · نشاطك سطرٌ صغير تحت إن بقي مكان.
 * «للمشاهدة» خرج من الافتراضيّ ويبقى يُختار.
 */
export function defaultV3(): WidgetV3 {
  return {
    small: "cont",
    medium: { top: true, slot: { mode: "pair", a: part("friends"), b: part("tonight") } },
    large: { slot: { mode: "full", a: part("friends"), b: part("tonight") } },
    xl: {
      slots: [
        { mode: "pair", a: part("friends"), b: part("tonight") },
        { mode: "full", a: part("cine"), b: part("tw", "poster") },
      ],
      line: "act",
    },
  };
}

const isSlotSection = (x: unknown): x is SlotSection => typeof x === "string" && (SLOT_SECTIONS as readonly string[]).includes(x);

function cleanPart(raw: unknown, fallback: SlotPart): SlotPart {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = isSlotSection(r.s) ? r.s : fallback.s;
  return part(s, r.v === "poster" ? "poster" : r.v === "list" ? "list" : fallback.v);
}

function cleanSlot(raw: unknown, fallback: WidgetSlot): WidgetSlot {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode = r.mode === "pair" ? "pair" : r.mode === "full" ? "full" : fallback.mode;
  const a = cleanPart(r.a, fallback.a);
  let b = cleanPart(r.b, fallback.b);
  /* النصّان قسمان مختلفان — إعدادٌ تالفٌ بقسمٍ مكرّر يأخذ أوّلَ قسمٍ غيرِه */
  if (b.s === a.s) b = part(SLOT_SECTIONS.find((k) => k !== a.s) ?? "tonight", b.v);
  return { mode, a, b };
}

/** يُصلح ما جاء من التخزين: الناقصُ افتراضيّ، والقيمُ المجهولةُ تسقط */
export function sanitizeV3(raw: unknown): WidgetV3 {
  const base = defaultV3();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const med = (r.medium && typeof r.medium === "object" ? r.medium : {}) as Record<string, unknown>;
  const lg = (r.large && typeof r.large === "object" ? r.large : {}) as Record<string, unknown>;
  const xl = (r.xl && typeof r.xl === "object" ? r.xl : {}) as Record<string, unknown>;
  const xs = Array.isArray(xl.slots) ? xl.slots : [];
  return {
    small: typeof r.small === "string" && (SMALL_SECTIONS as readonly string[]).includes(r.small) ? (r.small as SmallSection) : base.small,
    medium: { top: typeof med.top === "boolean" ? med.top : base.medium.top, slot: cleanSlot(med.slot, base.medium.slot) },
    large: { slot: cleanSlot(lg.slot, base.large.slot) },
    xl: {
      slots: [cleanSlot(xs[0], base.xl.slots[0]), cleanSlot(xs[1], base.xl.slots[1])],
      line: isSlotSection(xl.line) ? xl.line : base.xl.line,
    },
  };
}

/** أقسامُ الخانة الظاهرة — منها يُعرف المستخدَمُ فلا يُختار مرّتين */
export function slotKeys(slot: WidgetSlot): SlotSection[] {
  return slot.mode === "pair" ? [slot.a.s, slot.b.s] : [slot.a.s];
}

/** خاناتُ الحجم كما في الإعداد (المتوسطُ بلا خانةٍ حين يعرض أكمل المشاهدة) */
export function slotsFor(v3: WidgetV3, size: Exclude<WidgetSize, "small">): WidgetSlot[] {
  if (size === "medium") return v3.medium.top ? [] : [v3.medium.slot];
  if (size === "large") return [v3.large.slot];
  return [...v3.xl.slots];
}

/** القسمُ مستخدمٌ في الحجم نفسِه (لغير الموضع الذي يُعدَّل) — ورقةُ الاختيار ترسمه رماديّاً */
export function usedKeys(v3: WidgetV3, size: Exclude<WidgetSize, "small">): SlotSection[] {
  const keys = slotsFor(v3, size).flatMap(slotKeys);
  if (size === "xl") keys.push(v3.xl.line);
  return keys;
}

/** «القادم» في خانةٍ ظاهرة ⇒ لا سطرَ له تحت أكمل المشاهدة */
export function upInSlots(slots: readonly WidgetSlot[]): boolean {
  return slots.some((s) => slotKeys(s).includes("up"));
}

/* ───────── الحسم ───────── */

/**
 * الارتفاعاتُ بنقاط التصميم (مرجعُ S24 Ultra: ٤×٢ = ٣٣٥×١٧٨). 🆕 D-1571 — **الرسّامُ يكبّر كلَّ شيءٍ بنسبة عرض الودجت إلى ٣٣٥**
 * ويحسم الصفوفَ لـ(الارتفاع ÷ النسبة): ودجتُ خالد يرسمه One UI في مساحة ٤٣٥×٢٣١ ثمّ يصغّره، فبنقاطٍ ثابتةٍ ظهرت القطعُ صغيرةً
 * وبينها فراغات (فيديو خالد ٢٩ أكتوبر). بالنسبة يطابق ٤×٢ عنده التصميمَ بالضبط.
 * - رأسُ القسم ١٨ + ٦ · صفُّ «القادم» تحت البطاقتين ٣٤ بعد خطٍّ ومسافة ١٢ · السطرُ المختصر ٣٤ (بوستر ٢٢×٣٣ وسطران)
 * - الحشوةُ ١٠ فوق و١٠ تحت (عرضُ البطاقة ١٥٣٫٥ ⇒ ٨٦ بنسبة ١٦:٩)
 */
/* 🆕 D-1571 — الفاصلُ بين القوائم ٩ (خطٌّ ومسافتان ٤) لا ١٣ (خالد ١٤:٢٤: «الفراغات بين القوائم قللها»)، والمسافةُ فوق صفّ القادم ٨.
   وما يبقى من الارتفاع **لا يتوزّع بين القوائم**: الرسّامُ يقسمه فوق الودجت وتحته، فتبقى القوائمُ متلاصقةً بفواصلها */
const H = { pad: 20, gap: 9, contHead: 24, upGap: 8, upRow: 34, line: 34, listHeader: 24, tonightPoster: 150 } as const;
export const V3_HEIGHTS = H;

type Sizes = WidgetLookSize & { resize: boolean };

/** صفُّ قسمٍ كامل: قائمةٌ بثلاثة أسطر (أو اثنين إن لم يتّسع) أو بوسترات — والسينما بوستراتٌ دائماً */
function fullRow(p: SlotPart, rs: Sizes, room: number): WidgetRow | null {
  if (p.s === "tonight") return { type: "tonight", view: "poster", h: H.tonightPoster };
  if ((p.v === "poster" || p.s === "cine") && p.s !== "act") {
    const posters = rs.resize ? 4 : 3;
    /* 🆕 D-1571 — أربعةٌ بعرض التصميم (٣٣٥ ناقصاً الحشوة والفواصل) ٢:٣ = ١٠٩ — لا ١٣٤ يترك فراغاً تحتها (معاينةُ ١٤:٤٠) */
    const fit4 = Math.floor(((335 - H.pad - 3 * 8) / 4) * 1.5);
    return { type: "list", key: p.s, view: "posters", count: 3, posters, h: H.listHeader + (posters === 4 ? Math.min(rs.posterGrid4, fit4) : rs.posterGrid) };
  }
  const row = p.s === "friends" ? rs.friendRow : rs.listRow;
  for (const count of [3, 2] as const) {
    const h = H.listHeader + count * row;
    if (h <= room) return { type: "list", key: p.s, view: "list", count, h };
  }
  return null;
}

/**
 * صفُّ النصّين: ١٥٨ (أو ١١٢ حيث لا يتّسع). 🆕 D-1571 — أسطرُ كلِّ نصفٍ قائمةٍ في `rows`: أربعةُ أسطرٍ مختصرة (٣٢)، و«أصدقاؤك» ثلاثة
 * (خالد ١٤:١٣: «خلها ثلاثة ف كل الحالات») — وبسطرٍ أقلّ في الصفّ القصير. `count` يبقى لرسّامٍ أقدم.
 */
function pairRow(slot: WidgetSlot, rs: Sizes, room: number): WidgetRow | null {
  const keys: [WidgetSectionKey, WidgetSectionKey] = [slot.a.s, slot.b.s];
  const views: ("list" | "poster")[] = [slot.a.v, slot.b.v];
  const rowsFor = (tall: boolean) => keys.map((k) => (k === "friends" ? 3 : 4) - (tall ? 0 : 1));
  if (rs.pairRow <= room) return { type: "pair", keys, count: 3, views, rows: rowsFor(true), h: rs.pairRow };
  if (rs.pairRow2 <= room) return { type: "pair", keys, count: 2, views, rows: rowsFor(false), h: rs.pairRow2 };
  return null;
}

function slotRow(slot: WidgetSlot, rs: Sizes, room: number): WidgetRow | null {
  const r = slot.mode === "pair" ? pairRow(slot, rs, room) : fullRow(slot.a, rs, room);
  /* البوستراتُ وفيلمُ الليلة بمقاسٍ واحد: لا يتّسع ⇒ سطرٌ مختصرٌ لا صفٌّ يتجاوز الودجت */
  return r && r.h <= room ? r : null;
}

/**
 * صفوفُ حجمٍ وارتفاع (بنقاط التصميم). الترتيبُ: أكملُ المشاهدة (وصفُّ القادم) ثمّ الخانات ثمّ السطرُ الأخير — وما لا يتّسع بشكله يصير
 * سطراً مختصراً لكلِّ قسمٍ فيه إن اتّسع، وإلّا يسقط. 🆕 D-1571 — **التعبئةُ نشاطُك وحدَه** (الخطّة: «ما فيه سطور صغيرة لأقسام ثانية»):
 * سطرٌ واحدٌ أو اثنان إن اتّسعا، في كلِّ حجم (الجوالاتُ تختلف بكم نقطة: صفٌّ كاملٌ يتّسع ينضاف). وما بقي يتوزّع على الفواصل.
 */
export function resolveV3(
  v3: WidgetV3,
  size: Exclude<WidgetSize, "small">,
  height: number,
  rs: Sizes,
  /** أقسامٌ بلا محتوى الآن — تختفي ويأخذ ما معها مكانَها (قرارُ أحمد «ب»، ١٤ أكتوبر): نصٌّ فارغٌ يجعل أخاه كاملاً، وخانةٌ فارغةٌ تسقط */
  empty: ReadonlySet<WidgetSectionKey> = new Set(),
): { rows: WidgetRow[]; used: number } {
  const slots = slotsFor(v3, size)
    .map((s): WidgetSlot | null => {
      const a = !empty.has(s.a.s);
      const b = s.mode === "pair" && !empty.has(s.b.s);
      if (s.mode === "pair" && a && b) return s;
      if (a) return { ...s, mode: "full" };
      if (b) return { mode: "full", a: s.b, b: s.a };
      return null;
    })
    .filter((s): s is WidgetSlot => s !== null);
  /*
   * 🆕 D-1561 — «انتقل القادمُ لخانة» يُحسب من اختيار الشخص لا من البيانات: القادمُ في خانةٍ وهو فاضٍ الآن كان يُسقط الخانةَ
   * فيرجع سطرُه تحت أكمل المشاهدة بشَرطةٍ وحدها (خالد ٢:٣٦). وسطرُ القادم لا يُرسم فاضياً أصلاً.
   */
  const upMoved = upInSlots(slotsFor(v3, size)) || empty.has("up");
  const rows: WidgetRow[] = [];
  let used = H.pad;
  const gapNext = () => (rows.length ? H.gap : 0);
  const room = () => height - used - gapNext();
  const push = (r: WidgetRow) => {
    used += r.h + gapNext();
    rows.push(r);
  };
  const shown = new Set<WidgetSectionKey>();
  const pushLine = (k: SlotSection, index = 0) => {
    if (room() < H.line) return false;
    push({ type: "line", key: k, index, h: H.line });
    shown.add(k);
    return true;
  };

  const top = size !== "medium" || v3.medium.top;
  if (top) {
    const upLine = !upMoved;
    /* البطاقتان بنسبة ١٦:٩ بلا زوم (الرسّامُ يحسبها من عرضها الحقيقيّ) — وتحتهما صفُّ «القادم» المختصر ببوستره (الخطّة ٤×٢) */
    const card = rs.contCard;
    const h = H.contHead + card + (upLine ? H.upGap + H.upRow : 0);
    push({ type: "cont", upLine, card, tall: card >= rs.contCardTall, h });
  }

  for (const slot of slots) {
    const r = slotRow(slot, rs, room());
    if (r) {
      push(r);
      slotKeys(slot).forEach((k) => shown.add(k));
      continue;
    }
    for (const k of slotKeys(slot)) if (!shown.has(k)) pushLine(k);
  }

  /* السطرُ الأخيرُ المختار في الكبير جداً، ثمّ نشاطُك يعبّي ما يتّسع بسطرٍ كامل — حتى سطرين، ولا تعبئةَ بغيره */
  if (size === "xl" && !shown.has(v3.xl.line) && !empty.has(v3.xl.line)) pushLine(v3.xl.line);
  const actAsSection = rows.some((r) => (r.type === "list" && r.key === "act") || (r.type === "pair" && (r.keys as readonly string[]).includes("act")));
  if (!empty.has("act") && !actAsSection) {
    let n = rows.filter((r) => r.type === "line" && r.key === "act").length;
    while (n < 2 && pushLine("act", n)) n++;
  }
  return { rows, used };
}

/** خياراتُ الأقسام كما يقرؤها الرسّامُ الأقدم (`opts[key].view`) — شكلُ القسم في نصّه: بوسترٌ أو قائمة */
export function optsFromV3(v3: WidgetV3, base: Record<WidgetSectionKey, WidgetSectionOpts>, size: Exclude<WidgetSize, "small">): Record<WidgetSectionKey, WidgetSectionOpts> {
  const out = { ...base };
  for (const slot of slotsFor(v3, size)) {
    for (const p of slot.mode === "pair" ? [slot.a, slot.b] : [slot.a]) {
      if (p.s === "tonight") continue;
      out[p.s] = { ...out[p.s], view: p.v === "poster" ? "posters" : "list", ...(p.s === "friends" || p.s === "tw" || p.s === "cine" ? { posters: 4 as const } : {}) };
    }
  }
  return out;
}

/** للحجم الصغير: القسمُ المختار */
export function smallFromV3(v3: WidgetV3): WidgetSectionKey {
  return v3.small;
}

/** المنصّةُ لا تغيّر القواعد — أرقامُها تأتي من الشكل (`look`) فقط */
export type V3Platform = WidgetPlatform;
