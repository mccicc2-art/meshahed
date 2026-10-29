/**
 * 🆕 **الودجت v4 — «المعمل»** (خالد ٣٠ أكتوبر، لوحاتُ «المعمل — ٣٠ أكتوبر» في قماشة «ودجت لوبز — القوالب الثابتة»؛ والمواصفةُ
 * `claude/WIDGETS-SPEC-2026-10-30.md` و`claude/claude_07-append-2026-10-30-d.md`).
 *
 * 🔑 **المحرّكُ يكتب المواضعَ نفسَها، والرسّامان يرسمون فقط**: كلُّ بطاقةٍ وخطٍّ وصفٍّ بموضعه ومقاسه بنقاط التصميم (أندرويد ٣٣٥ عرضاً،
 * والآيفون ٣٦٤) — والرسّامُ يضرب في نسبة عرضه الحقيقيّ. فتعديلُ أيِّ رقمٍ هنا (أو في `look.v4` من الخادم) يصل **بتحديثٍ هوائيّ بلا
 * بناء** (خالد ٠١:٥٥: «ضروري نقدر نعدل هوائي»). الشكلُ الجديدُ كلّيّاً وحدَه يحتاج بناءً.
 *
 * القواعدُ بترتيبها — كلُّها من المعمل بأرقامه:
 * - بوستراتٌ فقط، والعنوانُ داخل الصورة؛ لا صفوفَ عناوين ولا سطرَ «نشاطك» للتعبئة.
 * - ترتيبٌ واحد: أكملُ المشاهدة ثمّ الخانة الأولى ثمّ الثانية؛ وكلُّ مقاسٍ يأخذ ما يتّسع. الخانةُ تجرّب البوسترات، ثمّ شكلَها القصير،
 *   وإلّا تسقط. والتصغيرُ حتّى ٧٪، والتكبيرُ حتّى ١٠٪، وما بقي تأخذه آخرُ خانةٍ (حتّى ربعٍ زيادةً على طولها) قبل أن يصير فراغاً.
 * - المتوسطُ: البطاقتان وتحتهما صفُّ القادم (أندرويد) أو سطرُه النحيل (الآيفون)؛ أو أكملُ المشاهدة ٣ بوسترات تملأ الارتفاع؛
 *   أو الخانةُ الأولى تملؤه.
 *
 * نقيٌّ بلا شبكة: المدخلُ الإعدادُ والمنصّةُ والمقاسُ بنقاط التصميم، والمخرجُ مواضع.
 */

import type { WidgetPlatform, WidgetSectionKey } from "./widgetLayout.ts";
import type { SlotSection, WidgetSlot, WidgetV3 } from "./widgetSlots.ts";

/** أرقامُ المحرّك — تسافر في `look.v4` فتتعدّل من الخادم بلا بناء */
export interface WidgetV4Nums {
  /** عرضُ التصميم: أندرويد ٣٣٥ (جوال خالد ×١٫٣٠) والآيفون ٣٦٤ (Pro Max) — والصغيران ١٦٠ و١٧٠ */
  designW: number;
  smallW: number;
  padY: number;
  padX: number;
  gap: number;
  cardGap: number;
  posterGap: number;
  /** بين نصّي الخانة: ٨ + خطٌّ + ٨ */
  pairGap: number;
  /** نسبةُ بطاقة التطبيق (عرض ÷ ارتفاع) */
  cardRatio: number;
  grow: number;
  shrink: number;
  /** آخرُ خانةٍ تأخذ الفراغ حتّى هذا من طولها الكامل */
  absorb: number;
  /** صفُّ القادم تحت البطاقتين (أندرويد ٤×٢): خطٌّ ومسافةٌ ٨ ثمّ ٤٤ — والسطرُ النحيلُ في الآيفون ٢٣ */
  upBig: number;
  upRow: number;
  slim: number;
  /** حدُّ «المتوسط» بالارتفاع، وحدّا ٤×٣ (افتراضيُّه أصدقاؤك ٣ بوسترات) */
  mediumMax: number;
  l3Max: number;
}

export const V4_NUMS: Record<WidgetPlatform, WidgetV4Nums> = {
  android: { designW: 335, smallW: 160, padY: 10, padX: 10, gap: 9, cardGap: 9, posterGap: 8, pairGap: 17, cardRatio: 1.45, grow: 0.1, shrink: 0.93, absorb: 1.25, upBig: 52, upRow: 44, slim: 23, mediumMax: 240, l3Max: 330 },
  ios: { designW: 364, smallW: 170, padY: 10, padX: 12, gap: 9, cardGap: 9, posterGap: 8, pairGap: 17, cardRatio: 1.45, grow: 0.1, shrink: 0.93, absorb: 1.25, upBig: 52, upRow: 44, slim: 23, mediumMax: 250, l3Max: 0 },
};

/**
 * موضعٌ واحدٌ يرسمه الرسّام. `i` رقمُ العنصر في قسمه (والرسّامُ يزيد عليه ما قلّبه ↻ في فيلم الليلة والسينما).
 * - `card`: بطاقةٌ بصورتها (`img`: بوستر · عريضة) — `lab` عنوانُ القسم داخلها · `cyc` زرُّ ↻ عليها بخطوته · `bt` موضعُ زرّ الفعل
 *   (`t` فوق يمين كبطاقة أكمل المشاهدة · `b` تحت يمين) · `bar` شريطُ التقدّم.
 * - `hair` خطٌّ رفيع · `up` صفُّ القادم المكبّر (أو آخرُ نشاطٍ لأصدقائك حين لا قادم) · `slim` سطرُه النحيل.
 */
export type V4Tile =
  | { k: "card"; x: number; y: number; w: number; h: number; s: WidgetSectionKey; i: number; img: "p" | "b"; lab?: 1; cyc?: number; bt?: "t" | "b"; bar?: 1 }
  | { k: "hair"; x: number; y: number; w: number; h: number }
  | { k: "up" | "slim"; x: number; y: number; w: number; h: number; s: "up" | "friends" };

/** أقسامٌ لها صورةٌ عريضةٌ في الخلاصة — غيرُها في الشكل القصير بوستراتٌ أقصر */
const WIDE: readonly WidgetSectionKey[] = ["cont", "tonight", "cine"];
/** ↻ للقسمين اللذين يدوران */
const CYCLES: readonly WidgetSectionKey[] = ["tonight", "cine"];

const r1 = (v: number) => Math.round(v * 10) / 10;

/** زرُّ الفعل: ✓ أكمل المشاهدة فوق يمين (كالتطبيق)، والبقيّةُ تحت يمين — وما لا فعلَ له بلا زرّ */
function btFor(s: WidgetSectionKey, wide: boolean): "t" | "b" | undefined {
  if (s === "cont") return wide ? "t" : "b";
  if (s === "tonight" || s === "tw" || s === "cine") return "b";
  return undefined;
}

function card(s: WidgetSectionKey, i: number, x: number, y: number, w: number, h: number, wide: boolean, o: { lab?: boolean; cyc?: number } = {}): V4Tile {
  const t: V4Tile = { k: "card", x: r1(x), y: r1(y), w: r1(w), h: r1(h), s, i, img: wide ? "b" : "p" };
  if (o.lab) t.lab = 1;
  if (o.cyc && CYCLES.includes(s)) t.cyc = o.cyc;
  const bt = btFor(s, wide);
  if (bt) t.bt = bt;
  if (s === "cont") t.bar = 1;
  return t;
}

/** خانةٌ كاملة: ٣ بوسترات، أو قصيرةٌ: بطاقتان عريضتان (لما له صورةٌ عريضة) أو ٣ بوستراتٍ أقصر */
function full(out: V4Tile[], s: WidgetSectionKey, x0: number, y: number, W: number, h: number, short: boolean, n: WidgetV4Nums) {
  const wide = short && WIDE.includes(s);
  const count = wide ? 2 : 3;
  const g = wide ? n.cardGap : n.posterGap;
  const cw = (W - g * (count - 1)) / count;
  for (let i = 0; i < count; i++) out.push(card(s, i, x0 + i * (cw + g), y, cw, h, wide, { lab: i === 0, cyc: i === count - 1 ? count : undefined }));
}

/** نصٌّ: بطاقةٌ واحدة — البوسترُ أو العريضةُ أيُّهما أقربُ لشكل مربّعها */
function half(out: V4Tile[], s: WidgetSectionKey, x: number, y: number, w: number, h: number) {
  const b = w / h;
  const wide = WIDE.includes(s) && Math.abs(Math.log(b / (16 / 9))) < Math.abs(Math.log(b / (2 / 3)));
  out.push(card(s, 0, x, y, w, h, wide, { lab: true, cyc: 1 }));
}

function hair(x: number, y: number, w: number, h = 1): V4Tile {
  return { k: "hair", x: r1(x), y: r1(y), w: r1(w), h };
}

export interface V4Layout {
  tiles: V4Tile[];
  /** للمعاينة والاختبار: التكبيرُ والفراغُ وما لم يتّسع */
  f: number;
  spare: number;
  dropped: SlotSection[][];
}

/** الخاناتُ كما يراها هذا المقاس — النصُّ الفارغُ يجعل أخاه كاملاً، والخانةُ الفارغةُ تسقط */
function liveSlots(v3: WidgetV3, l3: boolean, empty: ReadonlySet<WidgetSectionKey>): WidgetSlot[] {
  /* ٤×٣ وإعدادُه لم يُعدَّل: تحت أكمل المشاهدة أصدقاؤك ٣ بوسترات (خالد ٠١:٣٦) */
  const base: WidgetSlot[] = l3 && !v3.edited ? [{ mode: "full", a: { s: "friends", v: "poster" }, b: { s: "tonight", v: "poster" } }] : [...v3.xl.slots];
  return base
    .filter((s) => s.mode !== "off")
    .map((s): WidgetSlot | null => {
      const a = !empty.has(s.a.s);
      const b = s.mode === "pair" && !empty.has(s.b.s);
      if (s.mode === "pair" && a && b) return s;
      if (a) return { ...s, mode: "full" };
      if (b) return { mode: "full", a: s.b, b: s.a };
      return null;
    })
    .filter((s): s is WidgetSlot => s !== null);
}

type Row =
  | { k: "cont"; G: number; F: number; ex?: "up" | "slim"; posters: boolean; fill?: boolean }
  | { k: "slot"; G: number; F: number; s: WidgetSlot; form: "tall" | "short" | "fill"; T: number; X?: number };

/**
 * يحسم ودجتاً بمقاس `W×H` بنقاط التصميم. `empty`: أقسامٌ بلا محتوى الآن.
 */
export function layoutV4(v3: WidgetV3, platform: WidgetPlatform, W0: number, H: number, empty: ReadonlySet<WidgetSectionKey> = new Set(), nums?: Partial<WidgetV4Nums>): V4Layout {
  const n: WidgetV4Nums = { ...V4_NUMS[platform], ...(nums ?? {}) };
  const ios = platform === "ios";
  const W = W0 - 2 * n.padX;
  const avail = H - 2 * n.padY;
  const medium = H < n.mediumMax;
  const l3 = !medium && H < n.l3Max;
  const slots = liveSlots(v3, l3, empty);
  const posters = v3.cont === "posters";
  const contG = posters ? ((W - 2 * n.posterGap) / 3) * 1.5 : (W - n.cardGap) / 2 / n.cardRatio;
  const upKey: "up" | "friends" | null = !empty.has("up") ? "up" : !empty.has("friends") ? "friends" : null;
  const rows: Row[] = [];
  const dropped: SlotSection[][] = [];

  if (medium) {
    if (!v3.medium.top && slots[0]) rows.push({ k: "slot", s: slots[0], form: "fill", G: avail, F: 0, T: avail });
    else if (posters) rows.push({ k: "cont", G: avail, F: 0, posters, fill: true });
    else if (upKey) rows.push({ k: "cont", G: contG, F: ios ? n.slim : n.upBig, ex: ios ? "slim" : "up", posters });
    else rows.push({ k: "cont", G: contG, F: 0, posters });
  } else {
    rows.push({ k: "cont", G: contG, F: 0, posters });
    for (const s of slots) {
      const isFull = s.mode === "full";
      const tall = isFull ? ((W - 2 * n.posterGap) / 3) * 1.5 : ((W - n.pairGap) / 2) * 1.5;
      /* القصيرُ بارتفاع البطاقة العريضة نفسِها — والقسمُ بلا صورةٍ عريضة يملؤه بثلاثة بوستراتٍ أقصر (تغطّي بالمطّ والقصّ) */
      const short = isFull ? (W - n.cardGap) / 2 / n.cardRatio : (W - n.pairGap) / 2 / n.cardRatio;
      const used = rows.reduce((a, r) => a + r.G + r.F + n.gap, 0);
      if (used + tall <= avail / n.shrink) rows.push({ k: "slot", s, form: "tall", G: tall, F: 0, T: tall });
      else if (used + short <= avail / n.shrink) rows.push({ k: "slot", s, form: "short", G: short, F: 0, T: tall });
      else dropped.push(s.mode === "full" ? [s.a.s] : [s.a.s, s.b.s]);
    }
  }

  /* لا تصغيرَ تحت حدّه (٧٪): صفُّ القادم يسقط أوّلاً، ثمّ آخرُ خانة — ودجتٌ أقصرُ من كلِّ ما فيه لا يُعصر */
  const sums = () => rows.reduce((a, r) => ({ G: a.G + r.G, F: a.F + r.F }), { G: 0, F: n.gap * (rows.length - 1) });
  for (;;) {
    const t = sums();
    if (t.G <= 0 || (avail - t.F) / t.G >= n.shrink) break;
    const top = rows[0];
    if (top && top.k === "cont" && top.ex) {
      top.F = 0;
      top.ex = undefined;
    } else if (rows.length > 1) {
      const gone = rows.pop();
      if (gone && gone.k === "slot") dropped.push(gone.s.mode === "full" ? [gone.s.a.s] : [gone.s.a.s, gone.s.b.s]);
    } else break;
  }
  const { G, F } = sums();
  let f = G > 0 ? (avail - F) / G : 1;
  if (f > 1 + n.grow) f = 1 + n.grow;
  if (rows.length === 1 && rows[0].G === avail) f = 1;
  let spare = avail - (G * f + F);
  /* آخرُ خانةٍ تأخذ الفراغ الباقي — والقصيرةُ إن قاربت طولَها الكامل ترجع بوسترات */
  const last = rows[rows.length - 1];
  if (spare > 0 && last && last.k === "slot" && last.form !== "fill") {
    last.X = Math.max(0, Math.min(spare, last.T * n.absorb - last.G * f));
    spare -= last.X;
    if (last.form === "short" && last.G * f + last.X >= last.T * 0.8) last.form = "tall";
  }

  const tiles: V4Tile[] = [];
  let y = n.padY + Math.max(0, spare) / 2;
  rows.forEach((r, idx) => {
    if (idx) {
      tiles.push(hair(n.padX, y + (n.gap - 1) / 2, W));
      y += n.gap;
    }
    const h = r.G * f + (r.k === "slot" ? (r.X ?? 0) : 0);
    if (r.k === "cont") {
      if (r.posters) full(tiles, "cont", n.padX, y, W, h, false, n);
      else {
        const cw = (W - n.cardGap) / 2;
        for (let i = 0; i < 2; i++) tiles.push(card("cont", i, n.padX + i * (cw + n.cardGap), y, cw, h, true, { lab: i === 0 }));
      }
      if (r.ex === "up" && upKey) {
        tiles.push(hair(n.padX, y + h + 4, W));
        tiles.push({ k: "up", x: r1(n.padX), y: r1(y + h + 8), w: r1(W), h: n.upRow, s: upKey });
      }
      if (r.ex === "slim" && upKey) {
        tiles.push(hair(n.padX, y + h + 5, W));
        tiles.push({ k: "slim", x: r1(n.padX), y: r1(y + h + 6), w: r1(W), h: n.slim - 6, s: upKey });
      }
    } else if (r.s.mode === "full") {
      full(tiles, r.s.a.s, n.padX, y, W, h, r.form === "short", n);
    } else {
      const hf = (W - n.pairGap) / 2;
      half(tiles, r.s.a.s, n.padX, y, hf, h);
      tiles.push(hair(n.padX + hf + (n.pairGap - 1) / 2, y, 0, r1(h)));
      half(tiles, r.s.b.s, n.padX + hf + n.pairGap, y, hf, h);
    }
    y += h + r.F;
  });
  /* الخطُّ العموديُّ بين النصّين: عرضُه ١ (نقطة) */
  for (const t of tiles) if (t.k === "hair" && t.w === 0) t.w = 1;
  return { tiles, f, spare: Math.max(0, spare), dropped };
}

/** الصغير: بطاقةٌ واحدةٌ تملأ الودجت — والرسّامُ يرسمها بمقاسه هو */
export function smallV4(v3: WidgetV3): { s: WidgetSectionKey; cyc?: number } {
  const s = v3.small as WidgetSectionKey;
  return CYCLES.includes(s) ? { s, cyc: 1 } : { s };
}

/* ───────── أرقامُ الرسم — تسافر مع المواضع، فيقرؤها الرسّامان ولا رقمَ مكتوبٌ بيدٍ في Kotlin أو Swift ───────── */

/** أرقامُ رسم البطاقة بنقاط التصميم (تُضرب في نسبة العرض) — والمطُّ والقصُّ والزوم */
export interface WidgetV4Draw {
  /** أقصى مطٍّ للصورة قبل القصّ، وحصّةُ القصّ من فوق (والباقي من تحت) */
  lim: number;
  cropTop: number;
  /** الصغير: الزومُ أوت فوق وتحت (١ = البوسترُ كاملٌ من فوق لتحت — الآيفون، خالد ٠١:٤٩) */
  smallZoom: number;
  label: number;
  labelSmall: number;
  name: number;
  nameBig: number;
  nameSmall: number;
  line: number;
  lineSmall: number;
  circle: number;
  circleSmall: number;
  radius: number;
  avatar: number;
  avatarSmall: number;
  bar: number;
  textPad: number;
  textBottom: number;
  textPadSmall: number;
  textBottomSmall: number;
  upTitle: number;
  upName: number;
  upTail: number;
  upThumbW: number;
  upThumbH: number;
  slimFont: number;
  slimAvatar: number;
}

const DRAW_BASE: WidgetV4Draw = {
  lim: 0.25, cropTop: 0.35, smallZoom: 0,
  label: 10.5, labelSmall: 11.5, name: 11.5, nameBig: 12.5, nameSmall: 13, line: 9, lineSmall: 10,
  circle: 24, circleSmall: 26, radius: 10, avatar: 16, avatarSmall: 18, bar: 2.5,
  textPad: 8, textBottom: 7, textPadSmall: 10, textBottomSmall: 11,
  upTitle: 10.5, upName: 12, upTail: 10, upThumbW: 29, upThumbH: 44, slimFont: 11, slimAvatar: 14,
};

export type WidgetV4Look = Record<WidgetPlatform, { nums: WidgetV4Nums; draw: WidgetV4Draw }>;

export function defaultV4Look(): WidgetV4Look {
  return {
    android: { nums: { ...V4_NUMS.android }, draw: { ...DRAW_BASE } },
    ios: { nums: { ...V4_NUMS.ios }, draw: { ...DRAW_BASE, smallZoom: 1, nameSmall: 13.5, lineSmall: 10.5, circleSmall: 28 } },
  };
}

/** يُصلح ما جاء من الخادم (`v2.look4`): الرقمُ الناقصُ أو غيرُ المعقول يأخذ الافتراضيّ، والمجهولُ يسقط */
export function sanitizeV4Look(raw: unknown): WidgetV4Look {
  const out = defaultV4Look();
  if (!raw || typeof raw !== "object") return out;
  for (const p of ["android", "ios"] as const) {
    const plat = (raw as Record<string, unknown>)[p];
    if (!plat || typeof plat !== "object") continue;
    for (const part of ["nums", "draw"] as const) {
      const got = (plat as Record<string, unknown>)[part];
      if (!got || typeof got !== "object") continue;
      const into = out[p][part] as unknown as Record<string, number>;
      for (const k of Object.keys(into)) {
        const v = (got as Record<string, unknown>)[k];
        /* عرضُ التصميم لا يكون صفراً ولا صغيراً (نسبةُ الرسّام عرضُه ÷ هذا) */
        const min = k === "designW" || k === "smallW" ? 50 : 0;
        if (typeof v === "number" && Number.isFinite(v) && v >= min && v <= 2000) into[k] = v;
      }
    }
  }
  return out;
}
