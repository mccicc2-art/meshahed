"use client";

import { Icon } from "../Icon";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { toast } from "@/lib/toast";

/**
 * 🆕 بطاقةُ رابط الدعوة (D-768) — الرابطُ مقروءاً وزرُّ مشاركةٍ واحد.
 *
 * المنطقُ منطقُ `ShareTitleButton` حرفاً (D-145: لا نسخةَ ثالثة تُخترع):
 * `navigator.share` إن وُجدت — فالجوّالُ يعرف أين يُرسل أفضلَ منّا —
 * وإلا نسخٌ وتوستُ «تم نسخ الرابط». وإغلاقُ ورقة النظام ليس خطأً فلا
 * يُتبع بنسخٍ لم يُطلب. والرابطُ يصل جاهزاً من الخادم (`siteUrl` —
 * D-064: لا `window.location.origin` يشارك نطاقَ معاينةٍ يموت).
 */
export function InviteLinkCard({ url, locale }: { url: string; locale: Locale }) {
  const t = getDict(locale);

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
    try {
      await navigator.clipboard.writeText(url);
      toast(t.linkCopied);
    } catch {
      /* متصفّحٌ بلا حافظة — لا رسالةَ تفيد هنا */
    }
  }

  return (
    <div className="flex items-center gap-2.5 p-3.5">
      <span
        dir="ltr"
        className="min-w-0 flex-1 truncate rounded-xl border border-border bg-surface-2 px-3 py-2 text-12 tabular-nums text-foreground/90"
      >
        {url}
      </span>
      <button
        type="button"
        onClick={share}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 h-9 text-12 font-bold text-[color:var(--on-accent)] hover:brightness-110 active:scale-95 transition"
      >
        <Icon name="share" size={14} />
        {t.invShare}
      </button>
    </div>
  );
}
