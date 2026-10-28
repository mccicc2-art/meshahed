/**
 * 🆕 **شكلُ الودجت بياناتٍ لا كوداً** (قرارُ أحمد، ١٥ أكتوبر — يُشحن مع 1.12.7).
 *
 * 🔑 **لماذا**: كلُّ تعديلٍ في مقاس صفٍّ أو حجمِ خطٍّ في الودجت كان يحتاج بناءً أصليّاً (Kotlin/Swift) ومراجعةَ متجرَين.
 * الآن الأرقامُ هنا، تسافر في الخلاصة (`v2.look`)، والمحرّكُ (`widgetLayout.ts`) يحسم بها الارتفاعات، والرسّامان يقرآنها —
 * فتعديلُ رقمٍ يصل من الخادم بلا بناء. **الأشكالُ الجديدةُ والأيقوناتُ والأزرارُ ما زالت تحتاج بناءً** (RemoteViews لا تنفخ
 * إلّا واجهاتٍ في الحزمة).
 *
 * ⚠️ **الافتراضيُّ هو اليومُ بالضبط**: كلُّ رقمٍ هنا كان مكتوباً بيدٍ في الرسّامَين — وخلاصةٌ أقدمُ بلا `look`، أو ودجتٌ بلا
 * شبكة، يرسم بالأرقام المكتوبة في الرسّام نفسِها. فالرقمُ هنا والرقمُ في Kotlin/Swift يجب أن يبقيا متساويَين حتى يتغيّر هنا.
 *
 * أندرويد قبل 12 (API 31) لا يغيّر مقاسَ عنصرٍ من RemoteViews: يقرأ منه أحجامَ الخطّ وحدَها، والمقاساتُ من الواجهة.
 */
import type { WidgetPlatform, WidgetSize } from "./widgetLayout.ts";

/** أرقامُ حجمٍ واحدٍ على منصّةٍ واحدة — نقاطُ الودجت (dp في أندرويد، pt في الآيفون)، والخطوطُ sp/pt */
export interface WidgetLookSize {
  /** عنوانُ القسم */
  header: number;
  /** عنوانُ «أكمل المشاهدة» — ١٣ في الكبير جداً (W48) */
  contHeader: number;
  /** عنوانُ «أصدقاؤك» — ١٥٫٥ في أندرويد الكبير (W48 «نسخة ٢») */
  friendsHeader: number;
  /** صفُّ القائمة الكاملة وصورتُه وخطّاه */
  listRow: number;
  listThumbW: number;
  listThumbH: number;
  listName: number;
  listSub: number;
  /** صفُّ «أصدقاؤك» — W48: ٥٨ في أندرويد الكبير و٥٢ في الكبير جداً */
  friendRow: number;
  friendThumbW: number;
  friendThumbH: number;
  friendName: number;
  friendSub: number;
  /** الوقتُ في طرف السطر (الأصدقاء، و🆕 W52 أنشطتك) */
  time: number;
  /** سطرُ القسم الصغير (نصفُ العرض) */
  halfThumbW: number;
  halfThumbH: number;
  halfName: number;
  halfSub: number;
  /** صفُّ القسمين الصغيرين بثلاثة أسطر وبسطرين — الجسمُ تحت رأسٍ ٢٤ */
  pairRow: number;
  pairRow2: number;
  /** شبكةُ البوسترات بثلاثة، و🆕 W54 بأربعة تملأ العرض (٤ × ٧٧٫٥ + ٣ × ٨ = ٣٣٤ عرضُ التصميم) */
  posterGrid: number;
  posterGrid4: number;
  posterGap: number;
  /** 🆕 W53 — شريطُ البوستر الداكن: الاسمُ والوقت، ثمّ الحلقاتُ أو التقييم */
  stripName: number;
  stripSub: number;
  /** ارتفاعُ بطاقتي «أكمل المشاهدة» — 🆕 W50: في الكبير بمقاسهما في ٤×٢ لا تتمدّدان */
  contCard: number;
  /** المتوسطُ وأكملُ المشاهدة وحدَه */
  contCardTall: number;
  /** 🆕 W50 — أقصى ما يكبر به صفٌّ من فراغ الودجت (والصورةُ معه بالقدر نفسِه، فالفاصلُ بين الصور ثابت) */
  growMax: number;
}

export type WidgetLook = Record<WidgetPlatform, Partial<Record<WidgetSize, WidgetLookSize>>>;

const BASE: WidgetLookSize = {
  header: 14,
  contHeader: 14,
  friendsHeader: 14,
  /* 🆕 v3 — مقاساتُ الخطّة الثابتة (خالد ٢٨ أكتوبر: «ما ابغى تمطيط»): صفُّ القائمة ٤٤ بصورة ٢٨×٤٢، والأصدقاءُ بالمقاس نفسِه */
  listRow: 44,
  listThumbW: 28,
  listThumbH: 42,
  listName: 13.5,
  listSub: 11.5,
  friendRow: 44,
  friendThumbW: 28,
  friendThumbH: 42,
  friendName: 13.5,
  friendSub: 11.5,
  time: 11,
  halfThumbW: 26,
  halfThumbH: 39,
  halfName: 13,
  halfSub: 11.5,
  /* الخانةُ ١٥٨ = رأسٌ ٢٤ + ١٣٤ (ثلاثةُ أسطرٍ في النصف، أو بوستر ٨٩×١٣٤)؛ وبسطرين ١١٢ حيث لا تتّسع (المتوسط) */
  pairRow: 158,
  pairRow2: 112,
  posterGrid: 130,
  posterGrid4: 134,
  posterGap: 8,
  stripName: 11,
  stripSub: 10,
  /* بطاقتا «أكمل المشاهدة» بنسبة صورة الخلفية ١٦:٩ بلا زوم (خالد ٢٠:٥٣): ٨٦ في أندرويد (عرضُ ١٥٣٫٥) و٩٣ في الآيفون (١٦٦) */
  contCard: 86,
  contCardTall: 104,
  /* لا تمدّد: الفراغُ الباقي فواصل */
  growMax: 0,
};

/**
 * الشكلُ كما يرسله الخادم. 🆕 v3 — رقمٌ واحدٌ لكلِّ المقاسات (الخانةُ نفسُها في كلِّ حجم)؛ الآيفونُ يختلف في البطاقتين وحدَهما.
 */
export function defaultWidgetLook(): WidgetLook {
  const ios = { ...BASE, contCard: 93, contCardTall: 110 };
  return {
    android: { small: { ...BASE }, medium: { ...BASE }, large: { ...BASE }, xl: { ...BASE } },
    ios: { small: { ...ios }, medium: { ...ios }, large: { ...ios }, xl: { ...ios } },
  };
}

const KEYS = Object.keys(BASE) as (keyof WidgetLookSize)[];

/** أرقامُ حجمٍ بعينه — وما ليس له أرقامٌ (آيفون «الكبير جداً») يأخذ أقربَ حجمٍ أصغرَ منه */
export function lookFor(look: WidgetLook | null | undefined, platform: WidgetPlatform, size: WidgetSize): WidgetLookSize {
  const l = look ?? defaultWidgetLook();
  const order: WidgetSize[] = ["xl", "large", "medium", "small"];
  for (const s of order.slice(order.indexOf(size))) {
    const v = l[platform]?.[s];
    if (v) return v;
  }
  return { ...BASE };
}

/**
 * يُصلح شكلاً قادماً من الخلاصة: رقمٌ ناقصٌ أو غيرُ معقول يأخذ الافتراضيّ — فخطأٌ في الخادم لا يرسم ودجتاً بصفوفٍ صفريّة.
 * والمفاتيحُ المجهولةُ تسقط (رسّامٌ أقدمُ لا يقرؤها، والمحرّكُ لا يحتاجها).
 */
export function sanitizeWidgetLook(raw: unknown): WidgetLook {
  const out = defaultWidgetLook();
  if (!raw || typeof raw !== "object") return out;
  for (const p of ["android", "ios"] as const) {
    const plat = (raw as Record<string, unknown>)[p];
    if (!plat || typeof plat !== "object") continue;
    for (const s of ["small", "medium", "large", "xl"] as const) {
      const base = out[p][s];
      const got = (plat as Record<string, unknown>)[s];
      if (!base || !got || typeof got !== "object") continue;
      for (const k of KEYS) {
        const v = (got as Record<string, unknown>)[k];
        if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1000) base[k] = v;
      }
    }
  }
  return out;
}
