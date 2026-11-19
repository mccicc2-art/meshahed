import Link from "next/link";
import { getDict, type Locale } from "@/core/i18n";
import { Icon } from "@/components/Icon";

/**
 * 🆕 T450 — **بابا الإنشاء في إطارٍ واحد**: «＋ قائمة جديدة | ✦ قائمة ذكيّة».
 *
 * أحمد: «لا اقصد مثل شكلها فالمكتبة» — إطارُ الزرّين في مكتبة التطبيق (D-1018) لا ورقتُها، فصار هو بابَ الويب في
 * «اكتشف» وفي المكتبة معاً بدل زرّ «+ قائمة جديدة» ونموذجِ الذكيّة المنسدل. **روابطُ لا أزرار** (D-017): الوجهةُ صفحة
 * (`/lists/new`)، و`from` يقرّر أيَّ مصدرٍ تفتح عليه.
 */
export function NewListBar({ locale, from, className = "" }: { locale: Locale; from: "discover" | "library"; className?: string }) {
  const t = getDict(locale);
  const base = from === "library" ? "/lists/new?from=library" : "/lists/new";
  const cell =
    "flex-1 min-w-0 inline-flex items-center justify-center gap-2 py-2.5 text-13 font-bold hover:bg-surface-2 transition focus-visible:outline-none focus-visible:bg-surface-2";
  return (
    <div className={`flex rounded-card border border-border overflow-hidden ${className}`}>
      <Link href={base} className={cell}>
        <Icon name="plus" size={16} />
        <span className="truncate">{t.listNewGroup}</span>
      </Link>
      <Link href={`${base}${base.includes("?") ? "&" : "?"}tab=smart`} className={cell}>
        <Icon name="sparkle-star" size={16} className="text-accent" />
        <span className="truncate">{t.smartListLabel}</span>
      </Link>
    </div>
  );
}
