// خلفيّةُ المحادثات — D-1382

/**
 * 🆕 D-1382 — **خلفيّةٌ واحدةٌ لكلِّ المحادثات** (أحمد ١٢ أكتوبر: «صورة واحده لكل المحادثات · نعتمد ١ و ٣»).
 *
 * ثلاثةُ أنواع:
 * • `loopz` — رسومُ Loopz الخفيفة (فيلمٌ · تلفاز · فشار…) — **الافتراضيُّ لكلِّ أحد**: الأسودُ الصامت كان
 *   يُقرأ «شاشةً لم تُحمَّل» لا محادثة، والرسومُ هويّةٌ لا زينةٌ فلا تُقفل خلف اشتراك (حجّةُ D-939 في الثيم).
 * • `plain` — الأسودُ كما كان، لمن يريده.
 * • `poster` — ملصقُ عملٍ من مفضّلاته يختاره بعينه، خفيفَ التضبيب ومعتّماً — **ميزةُ Loopz+** (تنسيقٌ لا وظيفة — D-633).
 *
 * ⚖️ 🆕 **D-1384 — الملصقُ لا الخلفيّةُ العريضة** (تسجيلُ أحمد ١٢ أكتوبر: «هذا شغل تسليكي»): الصورةُ العريضة على شاشةٍ
 * طوليّة **لا يبقى منها إلّا شريطٌ من وسطها**، ومع التضبيب صارت بقعةَ لونٍ لا يُعرف عملُها — **العيبُ في شكل الصورة لا في
 * أرقامها**، وD-1383 عالج الأرقام. **والملصقُ طوليٌّ كالشاشة** فلا يُقصّ منه إلّا طرفاه، **ولكلِّ عملٍ ١٥–٤٠ ملصقاً**
 * (`titleImages` — D-131) فيختار صاحبُها واحداً بعينه، **والنظيفُ بلا كتابةٍ أوّلاً**.
 * والقيمُ القديمة (`k: "title"` — خلفيّةٌ عريضة) **تسقط إلى Loopz** في `sanitizeChatBg`: شكلُها هو الخطأ.
 *
 * 🔒 **يراها صاحبُها وحدَه**: تُحفظ في `profiles.ui_state` (حالةُ صاحبِها، لا يقرؤها زائر — D-822)، والطرفُ
 * الآخر يرى خلفيّتَه هو. **ولا هجرة**: العمودُ بلا قيدِ شكلٍ عمداً (D-475).
 *
 * ⚠️ **والاشتراكُ يُقرأ عند العرض لا عند الحفظ** (`effectiveChatBg`): من انتهى اشتراكُه يرى Loopz، **واختيارُه
 * محفوظٌ** فيعود يومَ يعود — الصلاحيةُ تُحسب ولا تُخزَّن (حجّةُ `isPlus`).
 */
export type ChatBg =
  | { k: "loopz" }
  | { k: "plain" }
  | { k: "poster"; type: "tv" | "movie"; id: number; path: string };

export type ChatBgKind = ChatBg["k"];

export const DEFAULT_CHAT_BG: ChatBg = { k: "loopz" };

/** مسارُ صورةٍ من TMDB (`/abc123.jpg`) — يدخل رابطاً فيُقيَّد شكلُه قبل أن يُخزَّن */
const TMDB_PATH = /^\/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$/;

/** قيمةٌ مخزَّنةٌ أو مرسلة ← شكلٌ مضمون؛ الفاسدُ يسقط إلى الافتراضيّ صامتاً */
export function sanitizeChatBg(raw: unknown): ChatBg {
  if (!raw || typeof raw !== "object") return DEFAULT_CHAT_BG;
  const v = raw as Record<string, unknown>;
  if (v.k === "plain") return { k: "plain" };
  if (v.k === "poster") {
    const type = v.type === "tv" || v.type === "movie" ? v.type : null;
    const id = typeof v.id === "number" && Number.isInteger(v.id) && v.id > 0 ? v.id : null;
    const path = typeof v.path === "string" && TMDB_PATH.test(v.path) ? v.path : null;
    if (type && id && path) return { k: "poster", type, id, path };
  }
  return DEFAULT_CHAT_BG;
}

/** هل يحتاج هذا الاختيارُ Loopz+؟ — حكمٌ واحدٌ يقرؤه الخادمُ والسطحان */
export function chatBgNeedsPlus(bg: ChatBg): boolean {
  return bg.k === "poster";
}

/** ما يُرسم فعلاً: اختيارُ المشترك كما هو، **وغيرُ المشترك يرى Loopz بدل خلفيّةِ عمل** */
export function effectiveChatBg(stored: ChatBg, plus: boolean): ChatBg {
  return chatBgNeedsPlus(stored) && !plus ? DEFAULT_CHAT_BG : stored;
}

export function sameChatBg(a: ChatBg, b: ChatBg): boolean {
  if (a.k !== b.k) return false;
  if (a.k === "poster" && b.k === "poster") return a.type === b.type && a.id === b.id && a.path === b.path;
  return true;
}

/**
 * 📏 **أرقامُ الرسم — مصدرٌ واحدٌ للسطحين**:
 * • الرسومُ بلون النصّ وبهذه الشفافية — فتتبع الثيمَ والوضعَ النهاريّ بلا صورتين.
 * • صورةُ العمل تُغطّى بلون خلفيّة الثيم بهذه الكثافة: في الداكن تعتيمٌ وفي النهاريّ غسلٌ —
 *   فيبقى نصُّ الوقت والفواصل (بلون النصّ الخافت) مقروءاً فوقها في الثيمين.
 */
export const CHAT_BG_DOODLE_OPACITY = 0.07;
/* 🆕 D-1385 (أحمد ١٢ أكتوبر: «ابغى بدون زوم .. البوستر يكون ممتاز وحجمه كامل ظاهر» · «ما ابغى فيه فراغ فوق» · ثمّ «ب ..
   اصلي»): **الملصقُ كاملاً بعرض الشاشة، ملتصقاً بأعلى المحادثة، بلا تكبيرٍ ولا قصٍّ ولا تضبيب، وبحجمه الأصليّ من TMDB**
   (أكبرُ من الشاشة فلا يُمطّ — يُنزَّل مرّةً عند الاختيار ويبقى في ذاكرة الجهاز). الشاشةُ أطولُ من الملصق، **فما تحته يكمله**:
   آخرُ أسطره ممدودةً ومضبّبة (`CHAT_BG_TAIL_*`) — لا شريطٌ فارغ. والغشاءُ ٦٠٪ كما هو بحكمه. */
export const CHAT_BG_TITLE_VEIL = 0.6;
/** مقاسُ الملصق الحادّ — الأصليّ */
export const CHAT_BG_TITLE_SIZE = "original" as const;
/** تكملةُ ما تحت الملصق: مقاسٌ صغيرٌ يكفي لصورةٍ مضبّبة، والجزءُ الممدودُ آخرُ ١٠٪ من الملصق، والتضبيبُ قويّ */
export const CHAT_BG_TAIL_SIZE = "w342" as const;
export const CHAT_BG_TAIL_SLICE = 0.1;
export const CHAT_BG_TAIL_BLUR = 14;
/** نسبةُ الملصق (ارتفاعُه ÷ عرضه) */
export const POSTER_RATIO = 1.5;

/** أقصى عددٍ من المفضّلات يُعرض في المنتقي — ورقةٌ لا مكتبة */
export const CHAT_BG_CHOICES_MAX = 18;
