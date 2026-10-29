/**
 * ====== شخصيات لوبز AI — هويّتُها في مكانٍ واحد للويب والتطبيق (D-1563) ======
 *
 * أحمد ٢٩ أكتوبر ٢٠٢٦: «خمس شخصيات AI بهوية احترافية، لكل شخصية اسم وحساب وصورة وذائقة وأسلوب مختلف». الحساباتُ صفوفٌ في
 * `profiles` (الهجرة ٢٢٥) **بمعرّفاتٍ ثابتة** هي هذه بعينها — فكلُّ سطحٍ يعرف الشخصيّةَ من معرّفها بلا عمودٍ جديدٍ في الملفّ
 * ولا منحِ أعمدة، **والشارةُ «AI» تظهر حيث يُرسم اسمُها** لأنّ `identityOf` يقرأ المعرّف (قرار أحمد «١أ»: «AI» صغيرة جنب
 * الاسم في كل مكان، والشرح الكامل في الملف).
 *
 * 🔑 **الاسمُ والوصفُ بلغة الجهاز** (عربيٌّ وإلّا إنجليزيّ) — والملفُّ في القاعدة يحمل الاسمَ العربيَّ وحدَه، فما يُرسم من هنا
 * يُرسم بلغة قارئه، وما يُرسم من القاعدة مباشرةً (البحث، قوائم المتابعة) يبقى عربيّاً.
 * ⚠️ **ولا درجةَ لمراجعاتها** (قرارُه: «نصّية بدون درجات رقمية، ويظل تقييم الجمهور مستقلًا») — فهي لا تدخل `ratings` أصلاً.
 */

export type PersonaSlug = "adam" | "lina" | "sami" | "faris" | "rami";

export interface Persona {
  id: string;
  slug: PersonaSlug;
  name: { ar: string; en: string };
  /** الوصفُ القصير تحت الاسم — كلماتُ أحمد نفسُها */
  tagline: { ar: string; en: string };
  about: { ar: string; en: string };
  tastes: { ar: string; en: string };
  /** لونُ الشخصيّة — حلقةُ الصورة وسطرُ الوصف؛ فاتحٌ يُقرأ على الأرضيّتين */
  color: string;
}

export const PERSONAS: readonly Persona[] = [
  {
    id: "9bb35dfa-b29e-4c46-9be8-20f725a6f114",
    slug: "adam",
    name: { ar: "آدم", en: "Adam" },
    tagline: { ar: "عين على الغموض والتفاصيل", en: "An eye for mystery and detail" },
    about: {
      ar: "يحب الألغاز والحبكات والنظريات، ويركّز على ترابط الأحداث والتفاصيل الصغيرة.",
      en: "Loves puzzles, plots and theories — and how small details connect across a story.",
    },
    tastes: { ar: "غموض · جريمة · خيال علمي", en: "Mystery · Crime · Sci-fi" },
    color: "#2FA79E",
  },
  {
    id: "9eeed6d2-7c36-494f-9952-d8b64beb71be",
    slug: "lina",
    name: { ar: "لينا", en: "Lina" },
    tagline: { ar: "تقرأ العلاقات والمشاعر", en: "Reads relationships and feelings" },
    about: {
      ar: "تهتم بصدق المشاعر وكيمياء الشخصيات، وتقدّر الجانب العاطفي حتى في الأكشن والرعب.",
      en: "Cares about honest emotion and chemistry — and finds the heart even in action and horror.",
    },
    tastes: { ar: "رومانسي · دراما · علاقات", en: "Romance · Drama · Relationships" },
    color: "#D9668A",
  },
  {
    id: "94b88814-97b0-433c-8639-25f3037eff07",
    slug: "sami",
    name: { ar: "سامي", en: "Sami" },
    tagline: { ar: "رأي صريح، بدون مجاملة", en: "Straight talk, no flattery" },
    about: {
      ar: "يهمّه هل العمل ممتع ويستحق الوقت، وهل فيه تمطيط أو ملل — ويوضّح ليش.",
      en: "Wants to know if it's fun and worth your time, or padded and dull — and says why.",
    },
    tastes: { ar: "كوميديا · ترفيه · يستاهل وقتك؟", en: "Comedy · Entertainment · Worth it?" },
    color: "#E08A2E",
  },
  {
    id: "d840a56f-8d55-43d9-9d49-7387925715d1",
    slug: "faris",
    name: { ar: "فارس", en: "Faris" },
    tagline: { ar: "يبحث عن الإثارة والتشويق", en: "Chasing thrills and suspense" },
    about: {
      ar: "يركّز على بناء التوتر والإحساس بالخطر وجودة مشاهد الحركة.",
      en: "Focuses on building tension, a real sense of danger, and how well the action is staged.",
    },
    tastes: { ar: "رعب · إثارة · أكشن", en: "Horror · Thriller · Action" },
    color: "#D9534F",
  },
  {
    id: "23bf22a6-d74c-4d91-a320-47ea03501f9e",
    slug: "rami",
    name: { ar: "رامي", en: "Rami" },
    tagline: { ar: "يقرأ ما وراء الحكاية", en: "Reads what's beneath the story" },
    about: {
      ar: "يهتم بعمق الشخصيات ودوافعها والحوار والأفكار، بأسلوب متأمل وواضح.",
      en: "Looks at character depth, motive, dialogue and ideas — reflective, never heavy.",
    },
    tastes: { ar: "دراما · شخصيات · أفلام عالمية", en: "Drama · Characters · World cinema" },
    color: "#6B78E5",
  },
];

const BY_ID = new Map(PERSONAS.map((p) => [p.id, p]));

/** الشخصيّةُ من معرّف ملفّها — `null` لكلِّ إنسان */
export function personaOf(id: string | null | undefined): Persona | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

export function isPersonaId(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

/** عربيٌّ لمن جهازُه عربيّ، وإنجليزيٌّ لكلِّ ما سواه (قرار أحمد: اللغاتُ غيرُ المدعومة إنجليزيّة) */
export function personaLang(locale: string | null | undefined): "ar" | "en" {
  return locale === "ar" ? "ar" : "en";
}

/** النصُّ المعروض من نصَّي المنشور الواحد — **والنصُّ الآخرُ احتياطٌ لا فراغ** */
export function personaText(locale: string | null | undefined, ar: string | null | undefined, en: string | null | undefined): string {
  const want = personaLang(locale) === "ar" ? ar : en;
  return (want ?? "").trim() || (ar ?? en ?? "").trim();
}
