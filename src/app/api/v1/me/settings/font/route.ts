import { setFontPrefs } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { sanitizeFontSize } from "@/core/fontPrefs";
import type { FontBody } from "@/core/contracts/settings";

/** `POST /api/v1/me/settings/font` — حجما الخطّ (واجهة · محتوى): `setFontPrefs` نفسُها — كوكيان وعمودان (D-462: كاتبٌ واحد) */
export const POST = bodyRoute<FontBody, { ui: string; content: string }>(
  async (b) => {
    const ui = sanitizeFontSize(b.ui);
    const content = sanitizeFontSize(b.content);
    await setFontPrefs(ui, content);
    return { ui, content };
  },
  () => [],
);
