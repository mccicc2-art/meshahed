import * as SecureStore from "expo-secure-store";
import { DEFAULT_THEME, THEMES, themeById, themeScheme, type Theme } from "@/core/themes";

/**
 * ====== الثيمُ — tokens من النواة، لا NativeWind ======
 *
 * الألوانُ من `core/themes.ts` نفسِه (Phase 9 §7): **الثيمُ الذي يختاره
 * العضوُ في الويب هو ما يراه في التطبيق** — `profile.theme` يأتي من `/me`.
 * السُلَّمان (الزوايا والمقاسات) قيمٌ ثابتةٌ هنا حتى تُستخرج من `globals.css`
 * بعد إصلاح `0024`/`0025` (سُلَّمان متوازيان يُصحَّحان قبل الاستخراج لا بعده).
 */
export type Tokens = {
  bg: string;
  surface: string;
  surface2: string;
  fg: string;
  muted: string;
  accent: string;
  /** `--accent-2` — سطرُ «شاهدتَ له N أعمال» تحت اسم الفنّان (D-947) */
  accent2: string;
  onAccent: string;
  border: string;
  success: string;
  error: string;
  /* 🆕 Phase 11 · B2 — رموزُ الشاشة الأصليّة للمكتبة (B0 §٤): كلُّها من
     `core/themes.ts`/`globals.css` نفسِهما، **ولا قيمةَ مكتوبةً بيدٍ في شاشة.** */
  verified: string;
  /** «عندك» سماويٌّ دلاليٌّ لا يتبدّل مع الثيم (`--info` في `globals.css`) */
  info: string;
  divider: string;
  disabled: string;
  /** لوحُ المنسدلة `--elevated` (D-376) */
  elevated: string;
};

export function tokensOf(themeId: string | null | undefined): Tokens {
  const t: Theme = themeId ? themeById(themeId) : DEFAULT_THEME;
  const v = t.vars;
  return {
    bg: v.background,
    surface: v.surface,
    surface2: v["surface-2"],
    fg: v.foreground,
    muted: v.muted,
    accent: v.accent,
    accent2: v["accent-2"],
    onAccent: v["on-accent"],
    border: v.border,
    /* الافتراضاتُ هي قيمُ `globals.css` (`--success` · `--error` · `--verified` · `--info`) */
    success: v.success ?? "#22c55e",
    error: v.error ?? "#ef4444",
    verified: v.verified ?? "#ffd400",
    info: "#3b82f6",
    divider: v.divider,
    disabled: v.disabled ?? v.muted,
    elevated: v.elevated,
  };
}

/** `poster` = `--radius-poster: 12px` في `globals.css` — نصفُ قطر الملصق في كلِّ سطح */
/* 🆕 D-947 — أسماءُ `globals.css` نفسُها: `--radius-control` ١٠ · `--radius-card`/`rounded-2xl` ١٤ · `--radius-sheet` ٢٢ */
export const radius = { sm: 8, md: 12, lg: 16, control: 10, card: 14, sheet: 22, poster: 12, pill: 999 } as const;
/**
 * 🆕 **أرضيّةُ الغلاف قبل أن يرسم الويبُ شيئاً** (D-944، دَينُ `05` «`#0D0D0D`
 * في `app.json` و`web.tsx` والمعتمد `#050505`»): **لونُ الثيم الرسميّ نفسُه من
 * `themes.ts`** لا رقمٌ مكتوبٌ ثانيةً — فشاشةُ البداية والـWebView قبل التحميل
 * والصفحةُ بعده لونٌ واحد، **والوميضُ الرماديُّ عند كلِّ إقلاعٍ كان الفرقَ بين
 * الرقمين.** (`app.json` لا يقرأ TypeScript فيحمل الرقمَ نفسَه نصّاً — والتعليقُ
 * هناك يشير إلى هنا.)
 */
export const SHELL_BG = tokensOf(null).bg;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/**
 * ====== الثيمُ المختارُ على الجهاز — D-1125 ======
 *
 * **لماذا**: الألوانُ كانت تتبع `me.theme` وحده، فإن لم يتبدّل «من أنا» (رمزٌ غائبٌ من الـWebView،
 * أو طلبٌ متوقّف) حُفظ الثيمُ في الخادم ولم يتبدّل لونٌ أمام صاحبه — بلاغُ أحمد بتسجيلٍ على 1.11.15
 * بعد أن لم يُصلحه D-1121. الآن كحجم الخطّ (D-1105): يُلبَس لحظةَ اللمس، ويُحفظ هنا، ويُقرأ تزامنيّاً
 * عند الإقلاع فلا تُرسم الألوانُ الافتراضيّةُ ثمّ تقفز؛ و«من أنا» يصحّحه إن تغيّر من الويب أو جهازٍ آخر.
 */
const THEME_KEY = "loopz.theme";
const known = (v: unknown): string | null => (typeof v === "string" && THEMES.some((t) => t.id === v) ? v : null);
let themeId: string | null = (() => {
  try {
    return known(SecureStore.getItem(THEME_KEY));
  } catch {
    return null;
  }
})();
const themeListeners = new Set<() => void>();

export const themePref = {
  get(): string | null {
    return themeId;
  },
  set(id: unknown) {
    const next = known(id);
    if (!next || next === themeId) return;
    themeId = next;
    for (const l of themeListeners) l();
    SecureStore.setItemAsync(THEME_KEY, next).catch(() => {});
  },
  subscribe(l: () => void): () => void {
    themeListeners.add(l);
    return () => themeListeners.delete(l);
  },
};

/** شريطُ حالة الهاتف: أيقوناتٌ داكنةٌ على الثيم الفاتح — وإلّا اختفت الساعةُ والبطاريّة في «النهاري» */
export function statusBarStyleOf(themeId: string | null | undefined): "light" | "dark" {
  return themeScheme(themeById(themeId)) === "light" ? "dark" : "light";
}
