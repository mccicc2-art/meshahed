// خلفيّةُ المحادثات — D-1382

/**
 * 🆕 D-1382 — **خلفيّةٌ واحدةٌ لكلِّ المحادثات** (أحمد ١٢ أكتوبر: «صورة واحده لكل المحادثات · نعتمد ١ و ٣»).
 *
 * ثلاثةُ أنواع:
 * • `loopz` — رسومُ Loopz الخفيفة (فيلمٌ · تلفاز · فشار…) — **الافتراضيُّ لكلِّ أحد**: الأسودُ الصامت كان
 *   يُقرأ «شاشةً لم تُحمَّل» لا محادثة، والرسومُ هويّةٌ لا زينةٌ فلا تُقفل خلف اشتراك (حجّةُ D-939 في الثيم).
 * • `plain` — الأسودُ كما كان، لمن يريده.
 * • `title` — خلفيّةُ عملٍ من مفضّلاته، مضبّبةً ومعتّمة — **ميزةُ Loopz+** (تنسيقٌ لا وظيفة — D-633).
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
  | { k: "title"; type: "tv" | "movie"; id: number; path: string };

export type ChatBgKind = ChatBg["k"];

export const DEFAULT_CHAT_BG: ChatBg = { k: "loopz" };

/** مسارُ صورةٍ من TMDB (`/abc123.jpg`) — يدخل رابطاً فيُقيَّد شكلُه قبل أن يُخزَّن */
const TMDB_PATH = /^\/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$/;

/** قيمةٌ مخزَّنةٌ أو مرسلة ← شكلٌ مضمون؛ الفاسدُ يسقط إلى الافتراضيّ صامتاً */
export function sanitizeChatBg(raw: unknown): ChatBg {
  if (!raw || typeof raw !== "object") return DEFAULT_CHAT_BG;
  const v = raw as Record<string, unknown>;
  if (v.k === "plain") return { k: "plain" };
  if (v.k === "title") {
    const type = v.type === "tv" || v.type === "movie" ? v.type : null;
    const id = typeof v.id === "number" && Number.isInteger(v.id) && v.id > 0 ? v.id : null;
    const path = typeof v.path === "string" && TMDB_PATH.test(v.path) ? v.path : null;
    if (type && id && path) return { k: "title", type, id, path };
  }
  return DEFAULT_CHAT_BG;
}

/** هل يحتاج هذا الاختيارُ Loopz+؟ — حكمٌ واحدٌ يقرؤه الخادمُ والسطحان */
export function chatBgNeedsPlus(bg: ChatBg): boolean {
  return bg.k === "title";
}

/** ما يُرسم فعلاً: اختيارُ المشترك كما هو، **وغيرُ المشترك يرى Loopz بدل خلفيّةِ عمل** */
export function effectiveChatBg(stored: ChatBg, plus: boolean): ChatBg {
  return chatBgNeedsPlus(stored) && !plus ? DEFAULT_CHAT_BG : stored;
}

export function sameChatBg(a: ChatBg, b: ChatBg): boolean {
  if (a.k !== b.k) return false;
  if (a.k === "title" && b.k === "title") return a.type === b.type && a.id === b.id && a.path === b.path;
  return true;
}

/**
 * 📏 **أرقامُ الرسم — مصدرٌ واحدٌ للسطحين**:
 * • الرسومُ بلون النصّ وبهذه الشفافية — فتتبع الثيمَ والوضعَ النهاريّ بلا صورتين.
 * • صورةُ العمل تُغطّى بلون خلفيّة الثيم بهذه الكثافة: في الداكن تعتيمٌ وفي النهاريّ غسلٌ —
 *   فيبقى نصُّ الوقت والفواصل (بلون النصّ الخافت) مقروءاً فوقها في الثيمين.
 */
export const CHAT_BG_DOODLE_OPACITY = 0.07;
/* 🆕 D-1383 (تسجيلُ أحمد ١٢ أكتوبر: «فيها مشاكل» — الخلفيّةُ لطخةٌ بنّيّة لا يُعرف عملُها): الصورةُ العرضيّة تُكبَّر لتغطّي
   شاشةً طوليّة، **والتضبيبُ يقع على الصورة قبل تكبيرها فيتضخّم معها** — ٢٤ على `w780` صارت ~١١٥px على الشاشة، وفوقها
   غشاءٌ ٧٢٪. الآن `w1280` (تكبيرٌ ~٢٫٥× بدل ~٤٫٨×) وتضبيبٌ ٦ وغشاءٌ ٥٥٪: الوجوهُ تُعرف والفقاعاتُ المعتمة تحفظ القراءة. */
export const CHAT_BG_TITLE_VEIL = 0.55;
export const CHAT_BG_TITLE_BLUR = 6;
/** مقاسُ صورة العمل خلف المحادثة — أكبرُ ما يلزم كي لا يتضخّم التضبيبُ مع التكبير */
export const CHAT_BG_TITLE_SIZE = "w1280" as const;

/** أقصى عددٍ من المفضّلات يُعرض في المنتقي — ورقةٌ لا مكتبة */
export const CHAT_BG_CHOICES_MAX = 18;
