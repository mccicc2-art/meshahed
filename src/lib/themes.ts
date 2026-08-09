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
  };
  glowA: string;
  glowB: string;
  /** ألوان تدرّج الشعار — ثابتة عبر الثيمات لأنها الهوية لا الواجهة */
  brand?: [string, string, string];
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
    vars: {
      background: "#0D0D0D",
      surface: "#141414",
      "surface-2": "#1A1A1A",
      foreground: "#FFFFFF",
      muted: "#BDBDBD",
      // نصٌّ أسود على الأصفر لا أبيض: الأبيض على #FFD200 لا يُقرأ أصلاً
      // (تباين ~1.6)، والأسود عليه ~14 — لهذا وُجد رمز on-accent
      accent: "#FFD200",
      "accent-2": "#F59E0B",
      border: "#2A2A2A",
      "on-accent": "#0D0D0D",
      "on-accent-2": "#0D0D0D",
      elevated: "#1A1A1A",
      divider: "rgba(255, 255, 255, 0.08)",
      "surface-inverse": "#FFFFFF",
      "on-surface-inverse": "#0D0D0D",
    },
    glowA: "rgba(255, 210, 0, 0.10)",
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
    },
    glowA: "rgba(255, 210, 0, 0.14)",
    glowB: "rgba(245, 158, 11, 0.07)",
  },
];

// تدرّج الهوية صار سُلَّماً أصفرَ واحداً لا ثلاثةَ ألوان: الكتيّب الرسمي
// لونان لا غير — أصفر وأسود — فالتدرّج درجات الأصفر نفسه
export const DEFAULT_BRAND: [string, string, string] = ["#FFD200", "#FBBF24", "#F59E0B"];

export const DEFAULT_THEME = THEMES[0];

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
  const semantic =
    (v.success ? `--success:${v.success};` : "") +
    (v.error ? `--error:${v.error};` : "") +
    (v.verified ? `--verified:${v.verified};` : "");
  return `:root{--background:${v.background};--surface:${v.surface};--surface-2:${v["surface-2"]};--foreground:${v.foreground};--muted:${v.muted};--accent:${v.accent};--accent-2:${v["accent-2"]};--border:${v.border};--on-accent:${v["on-accent"]};--on-accent-2:${v["on-accent-2"]};--glow-a:${t.glowA};--glow-b:${t.glowB};--brand-1:${b[0]};--brand-2:${b[1]};--brand-3:${b[2]};--elevated:${v.elevated};--divider:${v.divider};--surface-inverse:${v["surface-inverse"]};--on-surface-inverse:${v["on-surface-inverse"]};${semantic}}`;
}
