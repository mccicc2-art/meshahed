import { setContentPrefs } from "@/lib/actions";
import { getContentPrefs } from "@/lib/data";
import { bodyRoute } from "@/lib/v1body";
import { sanitizeContentPrefs, type ContentPrefs } from "@/core/contentPrefs";
import type { ContentPrefsBody } from "@/core/contracts/settings";

/**
 * `POST /api/v1/me/settings/content-prefs` — تفضيلاتُ المحتوى الأربع (D-545).
 * الجسمُ كاملٌ أو جزئيّ: ما غاب يُقرأ من المحفوظ فلا يمحو حقلٌ أخاه —
 * **والتنقيةُ في `sanitizeContentPrefs` وحدَها** (التعارضُ يحسمه المفضَّل).
 * الردُّ ما حُفظ فعلاً ليرسمه التطبيقُ لا ما أرسل.
 */
export const POST = bodyRoute<ContentPrefsBody, ContentPrefs>(
  async (b) => {
    const cur = await getContentPrefs();
    const next = sanitizeContentPrefs({
      genres: b.genres ?? cur.genres,
      unwantedGenres: b.unwantedGenres ?? cur.unwantedGenres,
      languages: b.languages ?? cur.languages,
      excludedLanguages: b.excludedLanguages ?? cur.excludedLanguages,
    });
    await setContentPrefs(next);
    return next;
  },
  () => ["home", "news"],
);
