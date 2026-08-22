/**
 * **روابطُ التواصل في الملفّ الشخصيّ** (D-546، طلبُ أحمد: «ضِف في
 * الإعدادات تحت كتابة النِّك نيم أماكنَ مخصّصةً لكتابة حساب تويتر
 * وسناب شات وإنستقرام وفيسبوك»).
 *
 * ================= ملفٌّ نقيٌّ لا يعرف قاعدةً ولا شبكة =================
 *
 * **سجلٌّ ودالّتان**: ما المنصّات، وكيف يُنقّى المعرّف، وكيف يُبنى
 * الرابط. **يقرؤه نموذجُ التحرير (عميل) وصفحةُ الملفّ (خادم) معاً**
 * (D-193)، **ويُختبر بلا متصفّح.**
 *
 * ================= ويُخزَّن المعرّفُ لا الرابط =================
 *
 * **«imeshal» لا «https://x.com/imeshal»** — لسببين:
 *  ١) **الرابطُ يُبنى عند العرض**، فيومَ صار «تويتر» اسمُه «X» لم
 *     تُعَد كتابةُ صفوف الناس.
 *  ٢) **ونصٌّ يكتبه المستخدمُ ويُوضع في `href` كما هو بابُ حقن**
 *     (`javascript:`): **المعرّفُ يمرّ بمصفاةِ حروفٍ ضيّقة**، **ولا
 *     يُبنى الرابطُ إلّا من نطاقٍ نكتبه نحن.** **وهذا هو الحارس، لا
 *     `rel="noopener"` وحدَه.**
 */

export type SocialKey = "x" | "snapchat" | "instagram" | "facebook";

export interface SocialSpec {
  key: SocialKey;
  /** اسمُ المنصّة كما تكتبه هي — **لا يُترجَم**: «إنستقرام» علامةٌ لا كلمة */
  label: string;
  /** أصلُ الرابط — **نكتبه نحن، ولا يأتي من المستخدم أبداً** */
  base: string;
  /** الحروفُ المسموحة في المعرّف عند تلك المنصّة */
  pattern: RegExp;
  max: number;
  /** مثالٌ في الحقل الفارغ — **يشرح الشكلَ المطلوب بلا سطر شرح** */
  placeholder: string;
}

/**
 * **الترتيبُ ترتيبُ الطلب** — تويتر ثمّ سناب شات ثمّ إنستقرام ثمّ
 * فيسبوك، **وهو الذي سيُرسم به الصفُّ في الملفّ**: ترتيبٌ واحدٌ في
 * التحرير والعرض (D-145).
 */
export const SOCIALS: readonly SocialSpec[] = [
  {
    key: "x",
    label: "X",
    base: "https://x.com/",
    pattern: /^[A-Za-z0-9_]{1,15}$/,
    max: 15,
    placeholder: "imeshal",
  },
  {
    key: "snapchat",
    label: "Snapchat",
    base: "https://snapchat.com/add/",
    pattern: /^[A-Za-z0-9._-]{3,15}$/,
    max: 15,
    placeholder: "imeshal",
  },
  {
    key: "instagram",
    label: "Instagram",
    base: "https://instagram.com/",
    pattern: /^[A-Za-z0-9._]{1,30}$/,
    max: 30,
    placeholder: "imeshal",
  },
  {
    key: "facebook",
    label: "Facebook",
    base: "https://facebook.com/",
    pattern: /^[A-Za-z0-9.]{2,50}$/,
    max: 50,
    placeholder: "imeshal",
  },
];

export type Socials = Partial<Record<SocialKey, string>>;

const BY_KEY = new Map(SOCIALS.map((s) => [s.key, s]));

/**
 * **تنقيةُ معرّفٍ واحد — والمستخدمُ يلصق ما يشاء.**
 *
 * **ثلاثةُ أشكالٍ تصل فعلاً**: `@imeshal` و`imeshal` و
 * `https://x.com/imeshal?igsh=…`. **ولصقُ الرابط هو الأكثر** — فمن
 * فتح تطبيقَه ونسخ حسابه نسخ رابطاً. **فيُقشَّر الرابطُ إلى آخر
 * مقطعٍ في مساره**، وتُرمى المعاملات.
 *
 * **ويعيد `null` لما لا يطابق المصفاة** — **ولا يُخزَّن نصٌّ لا يصلح
 * رابطاً** (D-063: الغائبُ أصدقُ من الكاذب).
 */
export function cleanHandle(key: SocialKey, raw: string): string | null {
  const spec = BY_KEY.get(key);
  if (!spec) return null;

  let v = String(raw ?? "").trim();
  if (!v) return null;

  /* **رابطٌ ملصوق؟ خُذ آخرَ مقطعٍ ذي معنًى** — وتسقط `?` و`#` معه */
  if (/^https?:\/\//i.test(v) || v.includes("/")) {
    v = v.split(/[?#]/)[0]!;
    const parts = v.split("/").filter(Boolean);
    v = parts[parts.length - 1] ?? "";
    /* **«snapchat.com/add/imeshal»** — آخرُ مقطعٍ هو المعرّف، **إلّا
       أن يكون كلمةَ المسار نفسَها** فيؤخذ ما قبله. */
    if (v === "add" && parts.length >= 2) v = parts[parts.length - 2] ?? "";
  }

  v = v.replace(/^@+/, "").trim();
  if (!v) return null;
  if (v.length > spec.max) return null;
  return spec.pattern.test(v) ? v : null;
}

/**
 * **تنقيةُ السجلّ كلِّه** — **المفتاحُ المجهولُ يسقط والقيمةُ الفاسدة
 * تسقط**، **والحقلُ الفارغ يعني الحذف** (فمن مسح حسابَه مسحه).
 *
 * **يقرؤها الكاتبُ والقارئُ معاً** (ثلاثيّةُ D-177): **عمودُ `jsonb`
 * بلا قيدِ مفاتيحَ في القاعدة، فالحارسُ هنا مرّتين.**
 */
export function sanitizeSocials(raw: unknown): Socials {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: Socials = {};
  for (const spec of SOCIALS) {
    const v = src[spec.key];
    if (typeof v !== "string") continue;
    const clean = cleanHandle(spec.key, v);
    if (clean) out[spec.key] = clean;
  }
  return out;
}

/**
 * **الرابطُ يُبنى من نطاقٍ نكتبه نحن ومعرّفٍ مرّ بالمصفاة** —
 * **ولا يُبنى من نصِّ المستخدم أبداً.** `null` تعني «لا رابط».
 */
export function socialUrl(key: SocialKey, handle: string | null | undefined): string | null {
  const spec = BY_KEY.get(key);
  if (!spec || !handle) return null;
  const clean = cleanHandle(key, handle);
  return clean ? spec.base + encodeURIComponent(clean) : null;
}

/** هل في السجلّ حسابٌ واحدٌ على الأقلّ؟ — **بلا واحدٍ لا يُرسم صفّ** (D-222) */
export function hasAnySocial(s: Socials): boolean {
  return SOCIALS.some((spec) => !!s[spec.key]);
}
