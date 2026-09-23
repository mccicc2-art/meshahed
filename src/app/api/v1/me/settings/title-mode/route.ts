import { setTitleMode } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { parseTitleMode } from "@/core/titleMode";
import type { TitleModeBody } from "@/core/contracts/settings";

/**
 * `POST /api/v1/me/settings/title-mode` — أسماءُ الأعمال. كوكي وحدَه كما في الويب؛
 * والأسماءُ تُحلّ على الخادم في كلِّ حمولة، **فالإبطالُ يشمل كلَّ ما يحمل اسمَ عمل**.
 */
export const POST = bodyRoute<TitleModeBody, { mode: string }>(
  async (b) => {
    const mode = parseTitleMode(String(b.mode));
    await setTitleMode(mode);
    return { mode };
  },
  () => ["home", "me:library", "me:lists", "news"],
);
