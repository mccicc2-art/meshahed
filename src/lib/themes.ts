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
    ar: "لوبز (OLED)",
    en: "Loopz (OLED)",
    vars: {
      background: "#090909",
      surface: "#141414",
      "surface-2": "#1A1A1A",
      foreground: "#FFFFFF",
      muted: "#A6A6A6",
      accent: "#7C3AED",
      "accent-2": "#EC4899",
      border: "#2A2A2A",
      "on-accent": "#FFFFFF",
      "on-accent-2": "#FFFFFF",
      elevated: "#1A1A1A",
      divider: "rgba(255, 255, 255, 0.08)",
      "surface-inverse": "#FFFFFF",
      "on-surface-inverse": "#111111",
    },
    glowA: "rgba(124, 58, 237, 0.12)",
    glowB: "rgba(236, 72, 153, 0.07)",
    brand: ["#7C3AED", "#EC4899", "#F59E0B"],
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
    ar: "النهاري (فاتح)",
    en: "Daylight (light)",
    vars: {
      background: "#f4f6fb",
      surface: "#ffffff",
      "surface-2": "#eaeef7",
      foreground: "#131a29",
      muted: "#5d6b85",
      accent: "#f59e0b",
      "accent-2": "#0ea371",
      border: "#d9e0ee",
      "on-accent": "#241500",
      "on-accent-2": "#ffffff",
      elevated: "#FFFFFF",
      divider: "rgba(19, 26, 41, 0.10)",
      "surface-inverse": "#131A29",
      "on-surface-inverse": "#FFFFFF",
    },
    glowA: "rgba(245, 158, 11, 0.10)",
    glowB: "rgba(14, 163, 113, 0.07)",
  },
];

export const DEFAULT_BRAND: [string, string, string] = ["#7C3AED", "#EC4899", "#F59E0B"];

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
 * يختفي على سطحٍ أبيض. اللون الدلاليّ (نجاح/خطأ/توثيق) وحده يبقى ثابتاً —
 * معناه لا يتبدّل بتبدّل اللوحة.
 */
export function themeCss(t: Theme) {
  const v = t.vars;
  // تدرّج الشعار يتبع الهوية لا الثيم: الثيمات تغيّر لون الواجهة، أما
  // العلامة فتبقى كما هي في كل مكان تُرى فيه
  const b = t.brand ?? DEFAULT_BRAND;
  return `:root{--background:${v.background};--surface:${v.surface};--surface-2:${v["surface-2"]};--foreground:${v.foreground};--muted:${v.muted};--accent:${v.accent};--accent-2:${v["accent-2"]};--border:${v.border};--on-accent:${v["on-accent"]};--on-accent-2:${v["on-accent-2"]};--glow-a:${t.glowA};--glow-b:${t.glowB};--brand-1:${b[0]};--brand-2:${b[1]};--brand-3:${b[2]};--elevated:${v.elevated};--divider:${v.divider};--surface-inverse:${v["surface-inverse"]};--on-surface-inverse:${v["on-surface-inverse"]};}`;
}
