"use client";

import { Icon } from "../Icon";
import { getDict, type Locale } from "@/core/i18n";
import { tap } from "@/lib/haptics";
import { toast } from "@/lib/toast";

/**
 * 🆕 بطاقةُ رابط الدعوة — **بشكل نموذج أحمد النهائيّ** (D-770b): صفُّ
 * الرابط وبجانبه زرُّ نسخٍ صريح، وتحته زرُّ مشاركةٍ عريضٌ بلون الهوية.
 *
 * لماذا زرّان لا زرٌّ واحد (نقضُ شكل D-768 الأول بطلبه): المشاركةُ
 * تفتح ورقةَ النظام والنسخُ يضع النصَّ في الحافظة — **فعلان مختلفان
 * لمن يريد لصقَ الرابط في مكانٍ لا تعرفه ورقةُ النظام.**
 *
 * منطقُ المشاركة منطقُ `ShareTitleButton` حرفاً (D-145): `navigator.share`
 * إن وُجدت وإلا نسخٌ وتوست. وإغلاقُ ورقة النظام ليس خطأً فلا يُتبع
 * بنسخٍ لم يُطلب. والرابطُ يصل جاهزاً من الخادم (`siteUrl` — D-064).
 */
export function InviteLinkCard({ url, locale }: { url: string; locale: Locale }) {
  const t = getDict(locale);

  async function copy() {
    tap(6);
    try {
      await navigator.clipboard.writeText(url);
      toast(t.linkCopied);
    } catch {
      /* متصفّحٌ بلا حافظة — لا رسالةَ تفيد هنا */
    }
  }

  async function share() {
    tap(6);
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
    } catch {
      return; // أغلق ورقةَ المشاركة — ليس خطأً
    }
    void copy();
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-xl bg-surface p-2">
        <span
          dir="ltr"
          className="min-w-0 flex-1 truncate px-2 py-1.5 text-14 tabular-nums text-foreground/90"
        >
          {url.replace(/^https?:\/\//, "")}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={t.invCopy}
          className="shrink-0 grid place-items-center size-9 rounded-lg bg-surface-2 text-foreground/80 hover:text-foreground active:scale-95 transition"
        >
          <Icon name="copy" size={16} />
        </button>
      </div>
      <button
        type="button"
        onClick={share}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-15 font-bold text-[color:var(--on-accent)] hover:brightness-110 active:scale-[0.99] transition"
      >
        <Icon name="share" size={16} />
        {t.invShare}
      </button>
    </div>
  );
}
