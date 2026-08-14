"use client";

import { siteUrl } from "@/lib/site";
import { toast } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * **مشاركةُ عملٍ برمزٍ واحد** (D-225، طلبُ أحمد: «أحتاج المشاركة»).
 *
 * **ورقةُ النظام أوّلاً ثم الحافظة** — نفسُ سلّم `DetailTopBar` حرفاً:
 * `navigator.share` إن وُجدت (فالجوّالُ يعرف أين يرسل أفضلَ منّا)، وإلّا
 * نسخُ الرابط وتوستٌ يقول إنه نُسخ. **وإغلاقُ ورقة النظام ليس خطأً** فلا
 * يُتبَع بنسخٍ لم يُطلب.
 *
 * **والرابط من `siteUrl()` وحدها** (D-064): `window.location.origin` يعطي
 * نطاقَ المعاينة في نشرات Vercel، **فيُشارَك رابطٌ يموت بعد أسبوع.**
 *
 * ⚠️ **دَينٌ مُعلَن:** `DetailTopBar` تكتب هذا المنطق بنفسها منذ D-051،
 * **فصارت نسختان** — والقاعدة أن المنسوخ يُوحَّد (D-145). تُهاجَر إلى هنا
 * يوم تُمسّ `DetailTopBar` لسببٍ آخر، لا في دفعةٍ تخصّ صفحةً أخرى.
 */
export function ShareTitleButton({
  path,
  title,
  locale,
  className = "",
}: {
  /** مسارُ العمل عندنا — `/show/123` أو `/movie/456` */
  path: string;
  title: string;
  locale: Locale;
  className?: string;
}) {
  const t = getDict(locale);

  async function run() {
    tap(6);
    const url = siteUrl(path);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return; // أغلق المستخدم ورقة المشاركة — ليس خطأً
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(t.linkCopied);
    } catch {
      /* متصفّح بلا حافظة — لا رسالة تفيد هنا */
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      aria-label={t.shareLinkLabel}
      title={t.shareLinkLabel}
      className={`inline-flex items-center rounded-full px-2.5 py-1.5 text-muted hover:text-accent transition active:scale-90 ${className}`}
    >
      <Icon name="share" size={15} />
    </button>
  );
}
