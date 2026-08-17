import { BROWSE_GENRES, BROWSE_TAGS } from "./browse";

/**
 * **صفوفُك الخاصة في اكتشف** (D-337، طلبُ أحمد: «يقدر يضيف اثنين عنوان —
 * يحدّد genre إجباريّاً ومعه ثيم اختياريّاً، فيطلع عنوان مثل Drama zombies»).
 *
 * **كوكيزٌ لا جدول** (نمطُ `tabPrefs` حرفاً): تفضيلُ عرضٍ خالص، وصفٌّ
 * في القاعدة لما يُقرأ في كلِّ طلبٍ إسراف (D-125 بمنطقه). والقيمةُ
 * `slugs` من قاموسَي `browse` — **فالاسمُ يُترجم عند العرض بلغة القارئ**
 * (D-147) ولا يُخزَّن بلغة يوم الاختيار.
 *
 * ⚠️ **صفّان حدّاً** — بنصِّ طلبه، ولأن الصفَّ الثالث يدفن الرفوفَ العامّة.
 */
export interface MyRow {
  /** slug من `BROWSE_GENRES` — **إجباريّ**: بلا نوعٍ لا صفَّ أصلاً */
  genre: string;
  /** slug من `BROWSE_TAGS` — اختياريّ («عن ماذا؟» فوق «من أيّ نوع؟») */
  tag: string | null;
}

export const MY_ROWS_COOKIE = "loopz-myrows";
export const MY_ROWS_MAX = 2;

/** «drama.zombie,scifi» → صفوفٌ مُتحقَّقةٌ ضدّ القاموسَين — والغريبُ يسقط صامتاً */
export function parseMyRows(raw: string | undefined | null): MyRow[] {
  if (!raw) return [];
  const out: MyRow[] = [];
  for (const part of String(raw).split(",")) {
    const [g, tg] = part.trim().split(".");
    if (!BROWSE_GENRES.some((x) => x.slug === g)) continue;
    if (out.some((r) => r.genre === g)) continue;
    out.push({ genre: g, tag: BROWSE_TAGS.some((x) => x.slug === tg) ? tg : null });
    if (out.length >= MY_ROWS_MAX) break;
  }
  return out;
}

export function serializeMyRows(rows: MyRow[]): string {
  return rows.map((r) => (r.tag ? `${r.genre}.${r.tag}` : r.genre)).join(",");
}
