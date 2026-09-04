import { DEFAULT_THEME, themeById, type Theme } from "@/core/themes";

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
  onAccent: string;
  border: string;
  success: string;
  error: string;
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
    onAccent: v["on-accent"],
    border: v.border,
    success: v.success ?? "#22C55E",
    error: v.error ?? "#EF4444",
  };
}

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
