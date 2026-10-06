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
 * ⚖️ 🆕 D-1283 — **ثلاثةٌ حدّاً لا اثنان** (أمرُ أحمد، ٥ أكتوبر: «ابغى اضافة row 3») —
 * **نقضٌ لحدِّ D-337**. وحجّتُه («الثالثُ يدفن الرفوفَ العامّة») عولجت بالموضع لا بالعدد:
 * صفوفُك نزلت تحت «الأكثر شهرة»، فالعامُّ يبقى فوقها مهما كثُرت.
 * 🔑 **والنوعُ يتكرّر إن اختلف الموضوع** («Drama · Zombies» و«Drama · War») — المكرَّرُ
 * حرفاً يُخزَّن (كي لا تسقط خانةٌ اختير نوعُها ولم يُختر موضوعُها بعد) **ويُرسم مرّةً**
 * (`uniqueMyRows`).
 */
export interface MyRow {
  /** slug من `BROWSE_GENRES` — **إجباريّ**: بلا نوعٍ لا صفَّ أصلاً */
  genre: string;
  /** slug من `BROWSE_TAGS` — اختياريّ («عن ماذا؟» فوق «من أيّ نوع؟») */
  tag: string | null;
}

/* 🔴 🆕 D-1304 — **اسمٌ جديدٌ عمداً** (كان `loopz-myrows`): الصفوفُ صارت **لكلِّ تبويبٍ** وافتراضُها قائمةٌ حدّدها
   أحمد لـ«الكلّ»، ومن اختار من قبلُ مشمول («يشملهم»). الكوكيُّ القديمُ لا يُقرأ فيسقط صاحبُه إلى الافتراض —
   وصفةُ D-1266 في اسم كوكيِّ طريقة الأسماء. */
export const MY_ROWS_COOKIE = "loopz-rows";
export const MY_ROWS_MAX = 3;

/** تبويباتُ «اكتشف» التي تحمل صفوفاً خاصّة — «القوائم» بلا صفوف */
export type MyRowsTab = "shows" | "movies" | "anime";
export const MY_ROWS_TABS: readonly MyRowsTab[] = ["shows", "movies", "anime"];
export type MyRowsByTab = Record<MyRowsTab, MyRow[]>;
export function isMyRowsTab(v: unknown): v is MyRowsTab {
  return v === "shows" || v === "movies" || v === "anime";
}

/**
 * 🆕 D-1304 — **الافتراضُ عند الجميع** (أحمد، ٦ أكتوبر، بعد لقطتَي «عرض» للأنمي والأفلام: «الانمي فيه اشياء غير عن
 * الفلم .. ابغى حتى الرو منفصله عن بعض» ثمّ القائمةُ بنصّه، «وهو يمدي يغير او يشيل»). ⚖️ ينقض شطرَ D-337: كانت
 * قائمةً واحدةً للتبويبات الثلاثة ولا صفَّ لمن لم يختر. **والرعبُ للأفلام وحدَها**: TMDB بلا نوع رعبٍ للمسلسلات.
 */
const DEFAULT_SLUGS: Record<MyRowsTab, string[]> = {
  shows: ["drama", "action", "comedy"],
  movies: ["drama", "action", "horror"],
  anime: ["drama", "action", "crime"],
};
export function defaultMyRows(tab: MyRowsTab): MyRow[] {
  return DEFAULT_SLUGS[tab].map((genre) => ({ genre, tag: null }));
}

/** «drama.zombie,scifi» → صفوفٌ مُتحقَّقةٌ ضدّ القاموسَين — والغريبُ يسقط صامتاً */
export function parseMyRows(raw: string | undefined | null): MyRow[] {
  if (!raw) return [];
  const out: MyRow[] = [];
  for (const part of String(raw).split(",")) {
    const [g, tg] = part.trim().split(".");
    if (!BROWSE_GENRES.some((x) => x.slug === g)) continue;
    out.push({ genre: g, tag: BROWSE_TAGS.some((x) => x.slug === tg) ? tg : null });
    if (out.length >= MY_ROWS_MAX) break;
  }
  return out;
}

/** مفتاحُ الصفّ — النوعُ وموضوعُه معاً (D-1283) */
/**
 * كوكيٌّ واحدٌ للتبويبات الثلاثة: `shows:drama,action|movies:…|anime:`.
 * **تبويبٌ غائبٌ عن الكوكي ⇒ افتراضُه** (لم يمسّه صاحبُه). **تبويبٌ حاضرٌ فارغ ⇒ فارغ**: من شال صفوفَه
 * كلَّها لا تعود إليه — «يمدي يغير او يشيل».
 */
export function parseMyRowsByTab(raw: string | undefined | null): MyRowsByTab {
  const seen = new Map<MyRowsTab, MyRow[]>();
  for (const part of String(raw ?? "").split("|")) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    const tab = part.slice(0, at).trim();
    if (isMyRowsTab(tab) && !seen.has(tab)) seen.set(tab, parseMyRows(part.slice(at + 1)));
  }
  return {
    shows: seen.get("shows") ?? defaultMyRows("shows"),
    movies: seen.get("movies") ?? defaultMyRows("movies"),
    anime: seen.get("anime") ?? defaultMyRows("anime"),
  };
}

export function serializeMyRowsByTab(all: MyRowsByTab): string {
  return MY_ROWS_TABS.map((tab) => `${tab}:${serializeMyRows(all[tab] ?? [])}`).join("|");
}

export function myRowKey(r: MyRow): string {
  return r.genre + (r.tag ? `.${r.tag}` : "");
}

/** **ما يُرسم**: المكرَّرُ حرفاً (النوعُ والموضوعُ نفسُهما) صفٌّ واحد — صفّان بعنوانٍ واحد حشوٌ */
export function uniqueMyRows(rows: MyRow[]): MyRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = myRowKey(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function serializeMyRows(rows: MyRow[]): string {
  return rows.map((r) => (r.tag ? `${r.genre}.${r.tag}` : r.genre)).join(",");
}
