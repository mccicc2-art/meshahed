import { setLocale } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { normalizeLocale } from "@/core/i18n";
import type { LocaleBody } from "@/core/contracts/settings";

/**
 * `POST /api/v1/me/settings/locale` — اللغة (Phase 11-I). `setLocale` نفسُها:
 * الكوكي (المتقاسَمُ مع الـWebView — D-947) وعمودُ الملفّ. **والتطبيقُ يبدّل
 * قاموسَه واتّجاهَه بنفسه عبر `webLocale.set`** (D-946) بعد أن يعود الردّ —
 * فالصفحةُ تحت الشاشة تُعاد بلغتها عند أوّل تحميل.
 */
export const POST = bodyRoute<LocaleBody, { locale: "ar" | "en" }>(
  async (b) => {
    const locale = normalizeLocale(String(b.locale));
    await setLocale(locale);
    return { locale };
  },
  () => ["home", "me:library", "news"],
);
