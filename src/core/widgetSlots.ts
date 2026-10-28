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
export const SLOT_SECTIONS = ["friends", "act", "up", "tw", "tonight"] as const;
export type SlotSection = (typeof SLOT_SECTIONS)[number];
/** الصغيرُ قسمٌ واحد: بوسترٌ كاملٌ وعمود */
export const SMALL_SECTIONS = ["cont", "up", "tonight", "friends"] as const;
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

const part = (s: SlotSection, v: SlotPart["v"] = "list"): SlotPart => ({ s, v: s === "tonight" ? "poster" : v });

/** الإعدادُ الافتراضيّ (خالد ٢١:٢٠): الكبيرُ جداً = أكمل المشاهدة + القادم · نص للمشاهدة + نص فيلم الليلة · أصدقاؤك كامل · نشاطك سطر */
export function defaultV3(): WidgetV3 {
  return {
    small: "cont",
    medium: { top: true, slot: { mode: "pair", a: part("friends"), b: part("tonight") } },
    large: { slot: { mode: "full", a: part("friends"), b: part("tonight") } },
    xl: {
      slots: [
        { mode: "pair", a: part("tw", "poster"), b: part("tonight") },
        { mode: "full", a: part("friends"), b: part("act") },
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

/** الارتفاعاتُ التي يرسم بها الرسّامان القائمان (`WIDGET_HEIGHTS` — تُكرَّر هنا أرقاماً لا استيراداً، كي لا يدور الاستيرادُ بين الملفّين) */
const H = { pad: 24, gap: 13, contHead: 28, upLine: 22, line: 44, listHeader: 24, tonightPoster: 150 } as const;

type Sizes = WidgetLookSize & { resize: boolean };

/** صفُّ قسمٍ كامل: قائمةٌ بثلاثة أسطر (أو اثنين إن لم يتّسع) أو بوسترات */
function fullRow(p: SlotPart, rs: Sizes, room: number): WidgetRow | null {
  if (p.s === "tonight") return { type: "tonight", view: "poster", h: H.tonightPoster };
  if (p.v === "poster" && p.s !== "act") {
    const posters = rs.resize ? 4 : 3;
    return { type: "list", key: p.s, view: "posters", count: 3, posters, h: H.listHeader + (posters === 4 ? rs.posterGrid4 : rs.posterGrid) };
  }
  const row = p.s === "friends" ? rs.friendRow : rs.listRow;
  for (const count of [3, 2] as const) {
    const h = H.listHeader + count * row;
    if (h <= room) return { type: "list", key: p.s, view: "list", count, h };
  }
  return null;
}

/** صفُّ النصّين: بثلاثة أسطر في الكبير وما فوق، وبسطرين حيث لا يتّسع (المتوسط) */
function pairRow(slot: WidgetSlot, rs: Sizes, room: number): WidgetRow | null {
  const keys: [WidgetSectionKey, WidgetSectionKey] = [slot.a.s, slot.b.s];
  const views: ("list" | "poster")[] = [slot.a.v, slot.b.v];
  if (rs.pairRow <= room) return { type: "pair", keys, count: 3, views, h: rs.pairRow };
  if (rs.pairRow2 <= room) return { type: "pair", keys, count: 2, views, h: rs.pairRow2 };
  return null;
}

function slotRow(slot: WidgetSlot, rs: Sizes, room: number): WidgetRow | null {
  return slot.mode === "pair" ? pairRow(slot, rs, room) : fullRow(slot.a, rs, room);
}

/**
 * صفوفُ حجمٍ وارتفاع. الترتيبُ: أكملُ المشاهدة (وسطرُ القادم) ثمّ الخانات ثمّ السطرُ الأخير — وما لا يتّسع بشكله يصير سطراً مختصراً
 * لكلِّ قسمٍ فيه إن اتّسع، وإلّا يسقط. الفراغُ الباقي لا يُكبّر شيئاً: يتوزّع على الفواصل في الرسّام.
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
  const pushLine = (k: SlotSection) => {
    if (shown.has(k) || room() < H.line) return false;
    push({ type: "line", key: k, h: H.line });
    shown.add(k);
    return true;
  };

  const top = size !== "medium" || v3.medium.top;
  if (top) {
    const upLine = !upMoved;
    /* البطاقتان بمقاسهما في كلِّ حجم (لا تمدّد — نسبةُ صورة الخلفية ١٦:٩، خالد ٢٠:٥٣): الباقي فواصل */
    const card = rs.contCard;
    const h = H.contHead + card + (upLine ? H.upLine : 0);
    push({ type: "cont", upLine, card, tall: card >= rs.contCardTall, h });
  }

  for (const slot of slots) {
    const r = slotRow(slot, rs, room());
    if (r) {
      push(r);
      slotKeys(slot).forEach((k) => shown.add(k));
      continue;
    }
    for (const k of slotKeys(slot)) pushLine(k);
  }

  /*
   * السطرُ الأخير والتعبئة (قاعدةُ المساحة الباقية: «صفٌّ كاملٌ إن اتّسع»): الكبيرُ جداً بسطره المختار، والكبيرُ بنشاطك — ثمّ ما زالت
   * المساحةُ تتّسع لسطرٍ فالقسمُ التالي غيرُ المستخدم (لا فيلمَ الليلة: لا سطرَ له يُقرأ)، حتى سطرين. «القادم» في خانة ⇒ سطرُه تحت
   * أكمل المشاهدة اختفى فهذا مكانُه. وما بقي (أقلُّ من سطر) يتوزّع على الفواصل في الرسّام.
   */
  if (size !== "medium") {
    const first = size === "xl" ? v3.xl.line : "act";
    const order: SlotSection[] = [first, ...SLOT_SECTIONS.filter((k) => k !== first && k !== "tonight")];
    let added = 0;
    for (const k of order) {
      if (added >= 2) break;
      if (empty.has(k) || shown.has(k)) continue;
      if (!pushLine(k)) break;
      added++;
    }
  }
  return { rows, used };
}

/** خياراتُ الأقسام كما يقرؤها الرسّام (`opts[key].view`) — شكلُ القسم في نصّه: بوسترٌ أو قائمة */
export function optsFromV3(v3: WidgetV3, base: Record<WidgetSectionKey, WidgetSectionOpts>, size: Exclude<WidgetSize, "small">): Record<WidgetSectionKey, WidgetSectionOpts> {
  const out = { ...base };
  for (const slot of slotsFor(v3, size)) {
    for (const p of slot.mode === "pair" ? [slot.a, slot.b] : [slot.a]) {
      if (p.s === "tonight") continue;
      out[p.s] = { ...out[p.s], view: p.v === "poster" ? "posters" : "list", ...(p.s === "friends" || p.s === "tw" ? { posters: 4 as const } : {}) };
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
