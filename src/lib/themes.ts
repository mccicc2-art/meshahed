// ثيمات الواجهة — تُطبَّق كمتغيرات CSS على :root من الـ layout

export interface Theme {
  id: string;
  ar: string;
  en: string;
  vars: {
    background: string;
    surface: string;
    "surface-2": string;
    foreground: string;
    muted: string;
    accent: string;
    "accent-2": string;
    border: string;
    "on-accent": string;
    "on-accent-2": string;
    /** سطح الأوراق المنبثقة والقوائم — أعلى من `surface` بدرجة */
    elevated: string;
    /** خطّ الفصل الشعري داخل البطاقات والقوائم */
    divider: string;
    /** سطحٌ معاكس للخلفية: زرّ الفعل الأول والزرّ الاجتماعي */
    "surface-inverse": string;
    "on-surface-inverse": string;
    /**
     * درجات الألوان الدلالية — اختيارية، والغياب يعني قيم globals.css
     * الافتراضية. المعنى ثابتٌ عبر الثيمات (أخضر نجاح، أحمر خطأ، ذهبي
     * توثيق)؛ الدرجة وحدها تتبدّل حيث تفشل الافتراضية قراءةً — النهاري
     * (جولة تباين 9 Aug م٤): ‎#22c55e نصاً على الأبيض تباينه ~2.0،
     * كقصة الأصفر نفسها التي أنتجت ‎#8a6d00.
     */
    success?: string;
    error?: string;
    verified?: string;
    /** 🆕 النصُّ الخافت — الدرجةُ الثالثة بعد الأساسيّ والثانويّ (D-454) */
    disabled?: string;
    /**
     * 🆕 **قلبُ الشعار** (D-405): ملفّا العلامة أبيضان بالألفا — يقفان
     * على الأسطح الداكنة كما تقول الهويّة، **ويختفيان على الفاتحة.**
     * `0` لا قلب · `1` قلبٌ كامل. **والغيابُ يعني صفراً** فلا يُكتب
     * المتغيّر أصلاً (نفسُ عرف الدلاليات فوق).
     */
    "logo-invert"?: string;
    /**
     * 🆕 **لونُ ظلِّ الحرفِ فوق الفنّ** (D-737) — **الظلُّ لونُ الورقةِ
     * لا لونٌ ثابت**: أسودُ في الليل تحت نصٍّ أبيض، **وأبيضُ في النهار
     * تحت نصٍّ داكن**. **والغيابُ يعني افتراضَ `globals.css`** (أسود
     * ٧٠٪) كعرفِ الدلاليّات فوق — فالثيماتُ الداكنةُ لا تكتبه أصلاً.
     */
    "art-shadow-color"?: string;
    /**
     * 🆕 **قوّةُ حجابِ الفنّ** (D-738) — **٤٠٪ افتراضاً، والنهاريُّ
     * وحدَه يرفعها**: النصُّ الداكنُ فوق ملصقٍ متوسّطِ الإضاءة يحتاج
     * بياضاً أكثرَ ممّا يحتاجه الأبيضُ من سوادٍ فوق الملصق نفسِه.
     */
    "art-veil"?: string;
  };
  glowA: string;
  glowB: string;
  /** ألوان تدرّج الشعار — ثابتة عبر الثيمات لأنها الهوية لا الواجهة */
  brand?: [string, string, string];
  /** 🆕 درجةُ الهويّة حين تُقرأ نصّاً (D-846) — الغيابُ يعني `brand` نفسَه */
  brandText?: [string, string, string];
}

export const THEMES: Theme[] = [
  {
    id: "loopz",
    // أسودٌ عميق لا رماديّ مزرقّ: على شاشة OLED البكسل الأسود مطفأ، فالحدّ
    // بين الخلفية والبطاقة يُرى بفارق الإضاءة لا بفارق اللون — وهذا ما
    // يعطي الإحساس بالعمق دون ظلالٍ ثقيلة
    // الهوية الرسمية: أصفر #FFD200 على أسود #0D0D0D (كتيّب العلامة).
    // سُلَّم العمق ثلاث درجات كما كان (D-001): الخلفية فالسطح فالمرتفع —
    // والرمادي الداكن #1A1A1A وحدُّ #2A2A2A والفاتح #BDBDBD كلها من
    // ألوان الكتيّب الثانوية حرفياً.
    ar: "لوبز (الرسمي)",
    en: "Loopz (Official)",
    /* 🆕 ⚖️ **لوحةُ نظام التصميم الجديد** (D-454، مواصفةُ أحمد بالقيم
       الستّ). **والثيمُ الرسميُّ وحدَه يتبدّل**: البقيّةُ ألوانٌ اختارها
       صاحبُها، **ولوحةٌ تُفرض على ثيمٍ اسمُه «نهاريّ» تلغيه لا تحدّثه.**

       ⚠️ **وهذه هي «المواضع الثلاثة» التي حذّرتُ منها في
       `DECISIONS_NEEDED` بند ١**: اللونُ مكتوبٌ هنا وفي `globals.css`
       وفي الكتيّب — **ومن غيّر واحداً وحدَه صنع لونين في التطبيق.**
       **والثلاثةُ تتحرّك في هذه الدفعة والتي تليها.** */
    vars: {
      // #050505 لا #0D0D0D: أعمقُ درجتين على OLED، **والحدُّ بين الخلفية
      // والبطاقة يُرى بفارق الإضاءة لا بفارق اللون** (حجّةُ D-001 نفسُها،
      // وقد صارت أوضحَ لا أضعف)
      background: "#050505",
      surface: "#111111",
      "surface-2": "#181818",
      // #F7F7F7 لا #FFFFFF: **الأبيضُ الخالص على أسودٍ عميقٍ يهتزّ**
      // (halation)، ودرجةٌ تحته تُريح العينَ بلا أن تفقد التباين (≈18:1)
      foreground: "#F7F7F7",
      muted: "#B5B5B5",
      // نصٌّ أسود على الأصفر لا أبيض: الأبيض على #FFD400 لا يُقرأ أصلاً
      // (تباين ~1.6)، والأسود عليه ~14 — لهذا وُجد رمز on-accent
      accent: "#FFD400",
      "accent-2": "#F59E0B",
      border: "#292929",
      "on-accent": "#050505",
      "on-accent-2": "#050505",
      elevated: "#181818",
      divider: "rgba(255, 255, 255, 0.08)",
      "surface-inverse": "#F7F7F7",
      "on-surface-inverse": "#050505",
      // النصُّ الخافت — الدرجةُ الثالثة في سلّم النصّ (#777777)
      disabled: "#777777",
      verified: "#FFD400",
    },
    glowA: "rgba(255, 212, 0, 0.10)",
    glowB: "rgba(245, 158, 11, 0.05)",
    brand: ["#FFD200", "#FBBF24", "#F59E0B"],
  },
  {
    id: "amber",
    ar: "العنبر",
    en: "Amber",
    vars: {
      background: "#0b1220",
      surface: "#131c2e",
      "surface-2": "#1b2740",
      foreground: "#e8edf7",
      muted: "#93a1bd",
      accent: "#ffb43a",
      "accent-2": "#3ddc97",
      border: "#24314e",
      "on-accent": "#1a1200",
      "on-accent-2": "#062015",
      elevated: "#1B2740",
      divider: "rgba(255, 255, 255, 0.08)",
      "surface-inverse": "#FFFFFF",
      "on-surface-inverse": "#0B1220",
    },
    glowA: "rgba(255, 180, 58, 0.08)",
    glowB: "rgba(61, 220, 151, 0.06)",
  },
  {
    id: "ocean",
    ar: "المحيط",
    en: "Ocean",
    vars: {
      background: "#081221",
      surface: "#0f1d33",
      "surface-2": "#152744",
      foreground: "#e6eefb",
      muted: "#8ea4c6",
      accent: "#4cc3ff",
      "accent-2": "#6ee7c8",
      border: "#1d3355",
      "on-accent": "#04202e",
      "on-accent-2": "#04241d",
      elevated: "#152744",
      divider: "rgba(255, 255, 255, 0.08)",
      "surface-inverse": "#FFFFFF",
      "on-surface-inverse": "#081221",
    },
    glowA: "rgba(76, 195, 255, 0.10)",
    glowB: "rgba(110, 231, 200, 0.06)",
  },
  {
    id: "violet",
    ar: "البنفسجي",
    en: "Violet",
    vars: {
      background: "#0e0a1c",
      surface: "#191231",
      "surface-2": "#231945",
      foreground: "#ece8fb",
      muted: "#a397c9",
      accent: "#b18bff",
      "accent-2": "#ff9ecd",
      border: "#2f2258",
      "on-accent": "#1a0b33",
      "on-accent-2": "#33091f",
      elevated: "#231945",
      divider: "rgba(255, 255, 255, 0.09)",
      "surface-inverse": "#FFFFFF",
      "on-surface-inverse": "#0E0A1C",
    },
    glowA: "rgba(177, 139, 255, 0.12)",
    glowB: "rgba(255, 158, 205, 0.07)",
  },
  {
    id: "crimson",
    ar: "القرمزي",
    en: "Crimson",
    vars: {
      background: "#140a0e",
      surface: "#22111a",
      "surface-2": "#2f1824",
      foreground: "#f7e9ee",
      muted: "#c39aa9",
      accent: "#ff5d73",
      "accent-2": "#ffb86b",
      border: "#48212f",
      "on-accent": "#33060e",
      "on-accent-2": "#331d05",
      elevated: "#2F1824",
      divider: "rgba(255, 255, 255, 0.08)",
      "surface-inverse": "#FFFFFF",
      "on-surface-inverse": "#140A0E",
    },
    glowA: "rgba(255, 93, 115, 0.10)",
    glowB: "rgba(255, 184, 107, 0.06)",
  },
  {
    id: "forest",
    ar: "الغابة",
    en: "Forest",
    vars: {
      background: "#08130f",
      surface: "#102019",
      "surface-2": "#172d23",
      foreground: "#e6f5ec",
      muted: "#8fb5a2",
      accent: "#6ee787",
      "accent-2": "#ffd166",
      border: "#1f3b2e",
      "on-accent": "#04220e",
      "on-accent-2": "#2a1f02",
      elevated: "#172D23",
      divider: "rgba(255, 255, 255, 0.08)",
      "surface-inverse": "#FFFFFF",
      "on-surface-inverse": "#08130F",
    },
    glowA: "rgba(110, 231, 135, 0.09)",
    glowB: "rgba(255, 209, 102, 0.05)",
  },
  {
    id: "daylight",
    /* 🆕 **الهويّةُ نصّاً تُعمَّق نهاراً وحدَها** (D-846): الثلاثيُّ
       الأصفرُ يبقى شعاراً وشريطَ تقدّمٍ كما هو (`brand` غيرُ معلَنةٍ
       هنا)، **وهذه درجتُه حين يصير حروفاً** — وهي درجاتُ `accent`
       و`accent-2` المكتوبةُ أدناه نفسُها (٤٫٥١ و٤٫٦ على `#f5f5f3`
       مقيسة)، **ودرجةٌ بينهما**. */
    brandText: ["#8a6d00", "#9c6404", "#b45309"],
    // النسخة النهارية من الهوية: رماديّاتٌ محايدة لا مزرقّة (الكتيّب بلا
    // أزرق أصلاً)، والأصفر يُعتَّم إلى ذهبيٍّ داكن #8A6D00 لأن #FFD200
    // على الأبيض لا يُقرأ نصّاً (تباين ~1.5 — والذهبي ~4.9). لون الهوية
    // في النهار درجةٌ أعمق من نفسه، لا لونٌ آخر.
    ar: "النهاري (فاتح)",
    en: "Daylight (light)",
    vars: {
      background: "#f5f5f3",
      surface: "#ffffff",
      "surface-2": "#ececea",
      foreground: "#0d0d0d",
      muted: "#5f5f5a",
      accent: "#8a6d00",
      "accent-2": "#b45309",
      border: "#dbdbd8",
      "on-accent": "#ffffff",
      "on-accent-2": "#ffffff",
      elevated: "#FFFFFF",
      divider: "rgba(13, 13, 13, 0.10)",
      "surface-inverse": "#0D0D0D",
      "on-surface-inverse": "#FFFFFF",
      /* الدلاليات تُعتَّم كما عُتِّم الأصفر (م٤): درجةٌ أعمق من نفسها
         لا لونٌ آخر — النجاح ‎#15803d (~4.7 على الأبيض) والخطأ ‎#b91c1c
         (~5.9) والتوثيق يستعير ذهبيّ النهار نفسه */
      success: "#15803d",
      error: "#b91c1c",
      verified: "#8a6d00",
      /* 🆕 **والعلامةُ تُقلب** (D-405): البيضاءُ بالألفا على ورقٍ أبيض
         لا تُرى — **وهذا دَينٌ أُعلن يومَ وُلد الشعار صورةً** (D-256)
         **وسُدَّ اليومَ بعد أن رُئي الثيمُ الفاتح حيّاً** (شرطُ D-220). */
      "logo-invert": "1",
      /* 🆕 **والظلُّ يُقلب كما قُلبت العلامة** (D-737): الحرفُ هنا داكنٌ
         فوق ملصقٍ تحت حجابٍ أبيض — **وهالةٌ سوداءُ تحته وسخٌ لا وضوح**
         (نصُّ `HomeHeader` حرفيّاً). **وأبيضُ ٩٠٪ لا ٧٠٪** لأن الهالةَ
         الفاتحةَ تنافس ورقةً بيضاءَ أصلاً، فما يكفي على السواد يذوب على
         البياض. */
      "art-shadow-color": "rgba(255, 255, 255, 0.9)",
      /* 🆕 **والحجابُ يثقل في النهار** (D-738، بحكمه بعد معاينة): **٦٥٪
         لا ٤٠٪** — الحرفُ هنا داكنٌ والملصقُ متوسّطٌ، **فالمسافةُ إلى
         البياض أطولُ من المسافة إلى السواد.** */
      "art-veil": "65%",
    },
    glowA: "rgba(255, 210, 0, 0.14)",
    glowB: "rgba(245, 158, 11, 0.07)",
  },
];

// تدرّج الهوية صار سُلَّماً أصفرَ واحداً لا ثلاثةَ ألوان: الكتيّب الرسمي
// لونان لا غير — أصفر وأسود — فالتدرّج درجات الأصفر نفسه
/* 🆕 **وسلّمُ العلامة يتبع الأصفرَ الجديد** (D-454): `--brand-1` هو
   `--accent` نفسُه في كلِّ تدرّجٍ في التطبيق — **ولو بقي `#FFD200`
   لجرى في شريط التقدّم لونٌ وفي الأيقونة فوقه لونٌ آخر**، وهو فارقٌ
   لا يُسمّى فيُقرأ خطأَ عرضٍ لا لونين. */
export const DEFAULT_BRAND: [string, string, string] = ["#FFD400", "#FBBF24", "#F59E0B"];

/**
 * 🆕 **درجةُ الهويّة حين تُقرأ نصّاً** (D-846).
 *
 * 🔑 **الهويّةُ لا تتبدّل، ودرجتُها حين تُقرأ تتبدّل**: `--brand-*` هي
 * الأصفرُ الذي يُرى في الشعار وأشرطة التقدّم في كلِّ ثيم — **وذاك
 * صحيحٌ ما دام سطحاً أو علامة.** 📏 **أمّا نصّاً على خلفيّة `daylight`
 * فتباينُه ١٫٣١–١٫٩٧ : ١** — **وهو ما كتبه تعريفُ الثيم النهاريِّ
 * نفسُه يومَ وُلد**: «#FFD200 على الأبيض لا يُقرأ نصّاً».
 *
 * **فالنهاريُّ وحدَه يعمّق الثلاثيَّ، وما عداه يرثه حرفاً** — ولهذا
 * `brandText` اختياريّةٌ لا مطلوبة: **الغيابُ يعني الهويّةَ كما هي**
 * (عُرفُ `success`/`error` في `semantic` — D-454).
 *
 * ⚠️ **ولا يُبنى هذا التدرّجُ من `--accent`/`--accent-2`**: 🔴 **جُرّب
 * فسقط** — **زوجُ الواجهة ليس درجتين من لونٍ واحد في كلِّ ثيم**
 * (`amber`: كهرمانيٌّ `#ffb43a` وأخضرُ `#3ddc97`) — **فيصير عنوانُ
 * العلامة تدرّجاً من لونين مختلفين.** **والقياسُ الحيُّ هو الذي أمسكها
 * بعد النشر** (D-662).
 */
export const DEFAULT_BRAND_TEXT: [string, string, string] = DEFAULT_BRAND;

export const DEFAULT_THEME = THEMES[0];

/**
 * ====== ألوانُ التمييز الشخصيّة — «لونُك أنت» (D-825) ======
 *
 * **حكمُ أحمد**: «اختيارُ ألوان الثيم حسب مزاجه، **والي يدخل حسابه يشوف
 * الألوان المختارة**».
 *
 * 🔑 **والمختارُ لونُ التمييز لا الثيمُ كلُّه — والحجّةُ تُقال:** الثيمُ
 * ثمانيةَ عشرَ متغيّراً فيها الخلفيّةُ والنصّ، **ومن ملك الخلفيّةَ
 * والنصَّ ملك أن يصنع تطبيقاً لا يُقرأ** (D-636). **ولونُ التمييز هو
 * الذي يُقرأ «لوني»**: الأزرارُ والحالُ المفعَّلةُ والروابط.
 * ⬜ **والثيمُ كاملاً قابلٌ للفتح لاحقاً** إن أراده صراحةً — **دَينٌ
 * مكتوبٌ لا نسيان.**
 *
 * 🔴 **وكلُّ لونٍ يحمل لونَ نصِّه معه** — **ولا يُحسب عند العرض**:
 * `on-accent` وُجد أصلاً لأنّ **الأبيضَ على الأصفر لا يُقرأ** (تعليقُ
 * الثيم الرسميّ بنصّه). **فالسجلُّ يضمن التركيبةَ ولا يتركها للحظّ.**
 *
 * ⚠️ **ولا يُبدَّل `--accent` وحدَه**: **`accent-2` تُشتقّ معه**
 * (التدرّجاتُ والهالاتُ تستعملهما معاً) — **ونصفُ تبديلٍ يصنع تدرّجاً
 * من لونين لا يجتمعان.**
 *
 * ⚖️ **وليس هذا سجلَّ `LIST_COLORS`** (D-824) رغم التشابه (القاعدة ٣):
 * **تلك تدرّجاتٌ تجلس خلف حجابٍ ولا نصَّ عليها**، **وهذه أسطحُ أفعالٍ
 * يُكتب فوقها** — **وعقدان مختلفان لا وصفةٌ مكرّرة.**
 */
export interface ThemeAccent {
  /** الرمزُ المخزَّن — `^[a-z]{3,12}$` كقيد الجدول (الهجرة ١٦٣) */
  id: string;
  ar: string;
  en: string;
  accent: string;
  accent2: string;
  /** لونُ النصِّ فوقه — **مقيسٌ لا مخمَّن** */
  onAccent: string;
  onAccent2: string;
  glowA: string;
  glowB: string;
}

export const ACCENTS: ThemeAccent[] = [
  {
    id: "gold",
    ar: "ذهبي",
    en: "Gold",
    accent: "#FFD400",
    accent2: "#F59E0B",
    onAccent: "#050505",
    onAccent2: "#050505",
    glowA: "rgba(255, 212, 0, 0.10)",
    glowB: "rgba(245, 158, 11, 0.05)",
  },
  {
    id: "sky",
    ar: "سماوي",
    en: "Sky",
    accent: "#38BDF8",
    accent2: "#0EA5E9",
    onAccent: "#04121C",
    onAccent2: "#04121C",
    glowA: "rgba(56, 189, 248, 0.10)",
    glowB: "rgba(14, 165, 233, 0.05)",
  },
  {
    id: "mint",
    ar: "نعناعي",
    en: "Mint",
    accent: "#34D399",
    accent2: "#10B981",
    onAccent: "#04140D",
    onAccent2: "#04140D",
    glowA: "rgba(52, 211, 153, 0.10)",
    glowB: "rgba(16, 185, 129, 0.05)",
  },
  {
    id: "coral",
    ar: "مرجاني",
    en: "Coral",
    accent: "#FB7185",
    accent2: "#F43F5E",
    onAccent: "#1A0409",
    onAccent2: "#FFFFFF",
    glowA: "rgba(251, 113, 133, 0.10)",
    glowB: "rgba(244, 63, 94, 0.05)",
  },
  {
    id: "lavender",
    ar: "بنفسجي",
    en: "Lavender",
    accent: "#A78BFA",
    accent2: "#8B5CF6",
    onAccent: "#120428",
    onAccent2: "#FFFFFF",
    glowA: "rgba(167, 139, 250, 0.10)",
    glowB: "rgba(139, 92, 246, 0.05)",
  },
  {
    id: "flame",
    ar: "ناري",
    en: "Flame",
    accent: "#FB923C",
    accent2: "#EA580C",
    onAccent: "#1A0A02",
    onAccent2: "#FFFFFF",
    glowA: "rgba(251, 146, 60, 0.10)",
    glowB: "rgba(234, 88, 12, 0.05)",
  },
  {
    id: "ice",
    ar: "جليدي",
    en: "Ice",
    accent: "#CBD5E1",
    accent2: "#94A3B8",
    onAccent: "#0B1220",
    onAccent2: "#0B1220",
    glowA: "rgba(203, 213, 225, 0.10)",
    glowB: "rgba(148, 163, 184, 0.05)",
  },
  {
    id: "rose",
    ar: "وردي",
    en: "Rose",
    accent: "#F472B6",
    accent2: "#DB2777",
    onAccent: "#1A0410",
    onAccent2: "#FFFFFF",
    glowA: "rgba(244, 114, 182, 0.10)",
    glowB: "rgba(219, 39, 119, 0.05)",
  },
];

const ACCENT_BY_ID = new Map(ACCENTS.map((a) => [a.id, a]));

/** **رمزٌ لا نعرفه لا لون** — والفاسدُ يسقط صامتاً */
export function themeAccent(id: string | null | undefined): ThemeAccent | null {
  return id ? (ACCENT_BY_ID.get(id) ?? null) : null;
}

/** **حارسُ الكتابة في الخادم** */
export function isThemeAccent(id: unknown): id is string {
  return typeof id === "string" && ACCENT_BY_ID.has(id);
}

/**
 * **متغيّراتُ لونِ التمييز وحدَها** — **تُكتب على `:root` بعد الثيم
 * فتغلبه**، **أو تُكتب سطريّاً على حاوية** فتسري على نسلها وحدَه.
 * 🔑 **وهي الوصفةُ الواحدةُ للحالتين** (D-145): **صفحةُ الزائر تلبس
 * لونَ صاحبِ الملفّ بنفس الأسطر التي يلبسها التطبيق لصاحبه** — **ولا
 * قائمتان تفترقان عند إضافة متغيّر.**
 */
export function accentVars(a: ThemeAccent): Record<string, string> {
  return {
    "--accent": a.accent,
    "--accent-2": a.accent2,
    "--on-accent": a.onAccent,
    "--on-accent-2": a.onAccent2,
    "--glow-a": a.glowA,
    "--glow-b": a.glowB,
  };
}

/** نفسُها نصّاً لِـ`<style>` في الرأس — **مصدرٌ واحدٌ لا نسختان** */
export function accentCss(a: ThemeAccent): string {
  const v = accentVars(a);
  return `:root{${Object.entries(v)
    .map(([k, x]) => `${k}:${x}`)
    .join(";")}}`;
}

export function themeById(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

export function themeName(t: Theme, locale: "ar" | "en") {
  return locale === "en" ? t.en : t.ar;
}

/**
 * CSS يُحقن في <head> فيتجاوز قيم :root الافتراضية.
 *
 * `elevated` و`divider` و`surface-inverse` تُكتب هنا الآن بعد أن كانت
 * ثابتةً في globals.css: قيمها الداكنة كانت تُطبَّق على الثيم الفاتح أيضاً،
 * فكل ورقةٍ منبثقة تخرج سوداء على صفحةٍ بيضاء، وزرُّ الفعل الأول الأبيض
 * يختفي على سطحٍ أبيض. اللون الدلاليّ (نجاح/خطأ/توثيق) معناه ثابتٌ عبر
 * اللوحات، ودرجتُه تتبدّل حيث لا تُقرأ الافتراضية (النهاري — م٤): الغياب
 * يعني قيمة globals.css فلا يُكتب المتغير أصلاً.
 */
export function themeCss(t: Theme) {
  const v = t.vars;
  // تدرّج الشعار يتبع الهوية لا الثيم: الثيمات تغيّر لون الواجهة، أما
  // العلامة فتبقى كما هي في كل مكان تُرى فيه
  const b = t.brand ?? DEFAULT_BRAND;
  /* 🆕 ودرجةُ الهويّة حين تُقرأ نصّاً (D-846) — انظر `DEFAULT_BRAND_TEXT` */
  const bt = t.brandText ?? t.brand ?? DEFAULT_BRAND_TEXT;
  const semantic =
    (v.success ? `--success:${v.success};` : "") +
    (v.error ? `--error:${v.error};` : "") +
    (v.verified ? `--verified:${v.verified};` : "") +
    /* 🆕 والخافتُ كأخواته: **يُكتب إن وُجد ويسقط إن غاب** (D-454) —
       فالثيمُ الذي لم يعلن درجتَه يرث افتراضَ `globals.css` */
    (v.disabled ? `--disabled:${v.disabled};` : "") +
    (v["logo-invert"] ? `--logo-invert:${v["logo-invert"]};` : "") +
    /* 🆕 **وظلُّ الفنِّ كأخواته** (D-737): النهاريُّ وحدَه يقلبه أبيض */
    (v["art-shadow-color"] ? `--art-shadow-color:${v["art-shadow-color"]};` : "") +
    /* 🆕 **وحجابُ الفنِّ كأخيه** (D-738): النهاريُّ وحدَه يرفعه */
    (v["art-veil"] ? `--art-veil:${v["art-veil"]};` : "");
  /* 🔴 🆕 **`color-scheme` — قماشُ المتصفّح نفسُه** (D-532، برقُ الإقلاع
     والدخول الأبيض): iOS يرسم «قماشَ الوكيل» — لا صفحتَنا — في الفجوات
     التي لا HTML مرسوماً فيها: بين انقضاء splash النظام وأوّل رسم، وبين
     مستندٍ ومستندٍ في التنقّل الكامل، وعند العودة من دخول Google.
     **ولونُه الافتراضيُّ أبيض** — وهو البرقُ بعينه، **ولا تصميمَ شاشةِ
     إقلاعٍ يستطيع تغطيتَه لأنه يظهر قبل أن يوجد HTML أصلاً** (ولهذا نجا
     من تصميمَي الشاشة كليهما). **و`color-scheme` هي أداةُ المنصّة
     المخصَّصةُ لهذا القماش بالذات** — فيصير داكناً مع الثيمات الداكنة
     وفاتحاً مع النهاريّ. */
  const scheme = t.id === "daylight" ? "light" : "dark";
  return `:root{color-scheme:${scheme};--background:${v.background};--surface:${v.surface};--surface-2:${v["surface-2"]};--foreground:${v.foreground};--muted:${v.muted};--accent:${v.accent};--accent-2:${v["accent-2"]};--border:${v.border};--on-accent:${v["on-accent"]};--on-accent-2:${v["on-accent-2"]};--glow-a:${t.glowA};--glow-b:${t.glowB};--brand-1:${b[0]};--brand-2:${b[1]};--brand-3:${b[2]};--brand-text-1:${bt[0]};--brand-text-2:${bt[1]};--brand-text-3:${bt[2]};--elevated:${v.elevated};--divider:${v.divider};--surface-inverse:${v["surface-inverse"]};--on-surface-inverse:${v["on-surface-inverse"]};${semantic}}`;
}
