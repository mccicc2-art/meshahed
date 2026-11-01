import * as SecureStore from "expo-secure-store";

/**
 * ====== آخرُ ما رآه القارئ في خطّ «النشاط» — D-1613b ======
 *
 * أحمد ١ نوفمبر بلقطة الخطّ وفاصلِه: «ابغاه يفتح صفحة النشاط كذا مثل الصوره و أنا بنفسي اطلع اشوف المنشورات الجديدة» — «ب».
 * `seen` في الشاشة لقطةٌ في ذاكرة التركيب: إقلاعٌ جديد أو إعادةُ بناءٍ بعد بابٍ ويبيّ أو خطٌّ سُخّن قبل فتحه يحسب الجديدَ كلَّه
 * «مرئيّاً» فيفتح من أعلاه بلا فاصل. هنا تُحفظ **أعلى المفاتيح التي رآها** (عشرةٌ تكفي لإيجاد موضعه — والمخزنُ الآمن يضيق
 * بما فوق ٢ك) لكلِّ شريحة، فيُحسب الجديدُ منذ آخر زيارة. والقراءةُ متزامنة (نهجُ `feedChoice.ts`) والفشلُ صمت: بلا ذاكرةٍ يفتح
 * الخطُّ من أعلاه كما كان.
 */
const KEY = "loopz.feedSeen";
const KEEP = 10;

type Store = Record<string, string[]>;

function read(): Store {
  try {
    const raw = SecureStore.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as unknown) : null;
    if (!p || typeof p !== "object") return {};
    const out: Store = {};
    for (const [slice, keys] of Object.entries(p as Record<string, unknown>))
      if (Array.isArray(keys)) out[slice] = keys.filter((k): k is string => typeof k === "string").slice(0, KEEP);
    return out;
  } catch {
    return {};
  }
}

let store: Store = read();

/** أعلى ما رآه في هذه الشريحة — بترتيب الخطّ */
export function lastSeen(slice: string): readonly string[] {
  return store[slice] ?? [];
}

/** يحفظ أعلى المفاتيح المرئيّة لهذه الشريحة — لا يكتب إن لم يتغيّر الأوّل */
export function rememberSeen(slice: string, keys: readonly string[]): void {
  const top = keys.slice(0, KEEP);
  if (!top.length || (store[slice]?.[0] === top[0] && store[slice]?.length === top.length)) return;
  store = { ...store, [slice]: top };
  try {
    SecureStore.setItem(KEY, JSON.stringify(store));
  } catch {
    /* راحةٌ لا شرط: يبقى في الذاكرة لهذه الجلسة */
  }
}
